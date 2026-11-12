import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { User } from '../models/User.js';
import { Game } from '../models/Game.js';
import { Friendship } from '../models/Friendship.js';
import { GameInvite } from '../models/GameInvite.js';
import { gameStateStore } from '../game/gameStateStore.js';
import {
  pairKey,
  decideFriendRequest,
  relationshipOf,
  deriveFriendStatus,
  lastSeenLabel,
  escapeRegex,
  ExistingFriendship,
} from '../game/friendRules.js';
import { isOnline, emitToUserAnywhere } from '../socket/presence.js';
import { sendPushToUsers } from '../services/push.js';

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

const MAX_PENDING_OUTGOING = 50;
const INVITE_TTL_MS = 30 * 60 * 1000;
const INVITE_RESEND_COOLDOWN_MS = 60 * 1000;

const idOf = (v: any): string => (v?._id ?? v).toString();
const publicUser = (u: any) => ({
  userId: idOf(u),
  username: u.username as string,
  avatarId: (u.avatarId as string) || 'wolf',
});
const toExisting = (row: any): ExistingFriendship => ({
  requester: idOf(row.requester),
  recipient: idOf(row.recipient),
  status: row.status,
});
const validId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

// ───────── Friends + requests overview ─────────
friendsRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const me = req.user!.userId;
    const rows = await Friendship.find({ $or: [{ requester: me }, { recipient: me }] })
      .populate('requester recipient', 'username avatarId lastSeenAt')
      .sort({ updatedAt: -1 });

    const friendDocs: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];
    for (const row of rows as any[]) {
      if (!row.requester || !row.recipient) continue; // a deleted account
      const iAmRequester = idOf(row.requester) === me;
      const other = iAmRequester ? row.recipient : row.requester;
      if (row.status === 'ACCEPTED') friendDocs.push(other);
      else if (iAmRequester) outgoing.push({ requestId: row.id, ...publicUser(other) });
      else incoming.push({ requestId: row.id, ...publicUser(other), createdAt: row.createdAt });
    }

    const friendIds = friendDocs.map(idOf);
    const inGameIds = new Set<string>();
    for (const state of await gameStateStore.listActive()) {
      if (state.status === 'ended') continue;
      for (const p of state.players) inGameIds.add(p.userId);
    }
    const lobbyByUser = new Map<string, string>();
    if (friendIds.length) {
      const lobbies = await Game.find({ status: 'lobby', 'players.userId': { $in: friendIds } }).select('name players.userId');
      for (const g of lobbies) for (const p of g.players) lobbyByUser.set(p.userId.toString(), g.name);
    }

    const rank = { IN_LOBBY: 0, ONLINE: 1, IN_GAME: 2, OFFLINE: 3 } as const;
    const friends = friendDocs
      .map((f) => {
        const id = idOf(f);
        const status = deriveFriendStatus({
          online: isOnline(id),
          inGame: inGameIds.has(id),
          lobbyName: lobbyByUser.get(id),
        });
        return {
          ...publicUser(f),
          ...status,
          lastSeenLabel: status.status === 'OFFLINE' ? lastSeenLabel(f.lastSeenAt) : undefined,
        };
      })
      .sort((a, b) => rank[a.status] - rank[b.status] || a.username.localeCompare(b.username));

    return res.json({ friends, incoming, outgoing });
  } catch (err) {
    next(err);
  }
});

// ───────── Search by @username (prefix) ─────────
friendsRouter.get('/search', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const me = req.user!.userId;
    const q = z.string().trim().min(2).max(20).parse(String(req.query.q ?? '').replace(/^@/, '').toLowerCase());
    const users = await User.find({ username: new RegExp(`^${escapeRegex(q)}`), _id: { $ne: me } })
      .select('username avatarId')
      .limit(10);

    const keys = users.map((u) => pairKey(me, u.id));
    const rows = keys.length ? await Friendship.find({ pairKey: { $in: keys } }) : [];
    const byKey = new Map(rows.map((r) => [r.pairKey, r]));

    return res.json({
      results: users.map((u) => {
        const row = byKey.get(pairKey(me, u.id)) as any;
        return {
          ...publicUser(u),
          relationship: relationshipOf(me, row ? toExisting(row) : null),
          requestId: row && row.status === 'PENDING' ? row.id : undefined,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// ───────── Send a friend request ─────────
friendsRouter.post('/request', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const me = req.user!.userId;
    const { username } = z
      .object({ username: z.string().trim().min(3).max(20) })
      .parse({ username: String(req.body?.username ?? '').replace(/^@/, '').toLowerCase() });

    const target = await User.findOne({ username }).select('username avatarId');
    if (!target) throw new AppError('No operative found with that callsign', 404);

    const key = pairKey(me, target.id);
    const existing = await Friendship.findOne({ pairKey: key });
    const decision = decideFriendRequest(me, target.id, existing ? toExisting(existing) : null);
    if (decision.action === 'REJECT') throw new AppError(decision.message, decision.statusCode);

    if (decision.action === 'AUTO_ACCEPT') {
      existing!.status = 'ACCEPTED';
      await existing!.save();
      emitToUserAnywhere(target.id, SOCKET_EVENTS.FRIEND_UPDATE, { reason: 'ACCEPTED' });
      void sendPushToUsers([target.id], {
        title: 'Friend request accepted',
        body: `@${req.user!.username} is now in your squad`,
        data: { type: 'FRIEND_ACCEPTED' },
      });
      return res.json({ status: 'FRIENDS' });
    }

    const pending = await Friendship.countDocuments({ requester: me, status: 'PENDING' });
    if (pending >= MAX_PENDING_OUTGOING) throw new AppError('Too many pending requests', 429);

    try {
      await Friendship.create({ requester: me, recipient: target.id, pairKey: key });
    } catch (err: any) {
      if (err?.code === 11000) throw new AppError('Friend request already exists', 409);
      throw err;
    }

    emitToUserAnywhere(target.id, SOCKET_EVENTS.FRIEND_REQUEST, { fromUsername: req.user!.username });
    void sendPushToUsers([target.id], {
      title: 'New friend request',
      body: `@${req.user!.username} wants to join your squad`,
      data: { type: 'FRIEND_REQUEST' },
    });
    return res.status(201).json({ status: 'REQUESTED' });
  } catch (err) {
    next(err);
  }
});

// ───────── Accept / decline / cancel ─────────
friendsRouter.post('/requests/:id/accept', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const me = req.user!.userId;
    const id = validId.parse(req.params.id);
    const row = await Friendship.findOne({ _id: id, recipient: me, status: 'PENDING' });
    if (!row) throw new AppError('Friend request not found', 404);
    row.status = 'ACCEPTED';
    await row.save();
    const requesterId = row.requester.toString();
    emitToUserAnywhere(requesterId, SOCKET_EVENTS.FRIEND_UPDATE, { reason: 'ACCEPTED' });
    void sendPushToUsers([requesterId], {
      title: 'Friend request accepted',
      body: `@${req.user!.username} accepted your request`,
      data: { type: 'FRIEND_ACCEPTED' },
    });
    return res.json({ status: 'FRIENDS' });
  } catch (err) {
    next(err);
  }
});

friendsRouter.post('/requests/:id/decline', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const id = validId.parse(req.params.id);
    const deleted = await Friendship.findOneAndDelete({ _id: id, recipient: req.user!.userId, status: 'PENDING' });
    if (!deleted) throw new AppError('Friend request not found', 404);
    return res.json({ status: 'DECLINED' });
  } catch (err) {
    next(err);
  }
});

friendsRouter.delete('/requests/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const id = validId.parse(req.params.id);
    const deleted = await Friendship.findOneAndDelete({ _id: id, requester: req.user!.userId, status: 'PENDING' });
    if (!deleted) throw new AppError('Friend request not found', 404);
    return res.json({ status: 'CANCELLED' });
  } catch (err) {
    next(err);
  }
});

// ───────── Game invites ─────────
friendsRouter.post('/invite', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const me = req.user!.userId;
    const { gameId, userId } = z.object({ gameId: validId, userId: validId }).parse(req.body);

    const friendship = await Friendship.findOne({ pairKey: pairKey(me, userId), status: 'ACCEPTED' });
    if (!friendship) throw new AppError('You can only invite friends', 403);

    const game = await Game.findById(gameId);
    if (!game) throw new AppError('Game not found', 404);
    if (game.status !== 'lobby') throw new AppError('This game has already started', 409);
    if (!game.players.some((p) => p.userId.toString() === me)) {
      throw new AppError('You are not in this game', 403);
    }
    if (game.players.some((p) => p.userId.toString() === userId)) {
      throw new AppError('That player is already in the lobby', 409);
    }

    const prior = await GameInvite.findOne({ gameId, toUserId: userId });
    if (prior && Date.now() - prior.updatedAt.getTime() < INVITE_RESEND_COOLDOWN_MS) {
      throw new AppError('Invite already sent. Try again in a minute.', 429);
    }

    const invite = await GameInvite.findOneAndUpdate(
      { gameId, toUserId: userId },
      { $set: { code: game.code, gameName: game.name, fromUserId: me, expiresAt: new Date(Date.now() + INVITE_TTL_MS) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    emitToUserAnywhere(userId, SOCKET_EVENTS.GAME_INVITE, {
      inviteId: invite.id,
      gameId,
      code: game.code,
      gameName: game.name,
      fromUsername: req.user!.username,
      expiresAt: invite.expiresAt,
    });
    void sendPushToUsers([userId], {
      title: 'Squad invite',
      body: `@${req.user!.username} invited you to "${game.name}"`,
      data: { type: 'GAME_INVITE', code: game.code },
    });
    return res.status(201).json({ status: 'INVITED' });
  } catch (err) {
    next(err);
  }
});

friendsRouter.get('/invites', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const invites = await GameInvite.find({ toUserId: req.user!.userId, expiresAt: { $gt: new Date() } })
      .populate('fromUserId', 'username avatarId')
      .sort({ createdAt: -1 })
      .limit(20);
    const open = new Set(
      (await Game.find({ _id: { $in: invites.map((i) => i.gameId) }, status: 'lobby' }).select('_id')).map((g) => g.id)
    );
    return res.json({
      invites: invites
        .filter((i) => open.has(i.gameId.toString()) && (i as any).fromUserId)
        .map((i) => ({
          inviteId: i.id,
          gameId: i.gameId.toString(),
          code: i.code,
          gameName: i.gameName,
          from: publicUser((i as any).fromUserId),
          expiresAt: i.expiresAt,
        })),
    });
  } catch (err) {
    next(err);
  }
});

friendsRouter.post('/invites/:id/decline', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const id = validId.parse(req.params.id);
    await GameInvite.deleteOne({ _id: id, toUserId: req.user!.userId });
    return res.json({ status: 'DECLINED' });
  } catch (err) {
    next(err);
  }
});

// ───────── Remove a friend ─────────
friendsRouter.delete('/:userId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const me = req.user!.userId;
    const other = validId.parse(req.params.userId);
    const deleted = await Friendship.findOneAndDelete({ pairKey: pairKey(me, other), status: 'ACCEPTED' });
    if (!deleted) throw new AppError('Friend not found', 404);
    return res.json({ status: 'REMOVED' });
  } catch (err) {
    next(err);
  }
});
