import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Game } from '../models/Game.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateUniqueGameCode } from '../utils/gameCode.js';

export const gamesRouter = Router();

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const noGoZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  polygon: z.array(coordinatesSchema).min(3, 'No-go zones must have at least 3 polygon points'),
});

const createGameSchema = z.object({
  name: z.string().min(1, 'Game callsign is required').max(28, 'Callsign cannot exceed 28 characters'),
  mode: z.enum(['Classic Manhunt', 'Last Runner Standing']).default('Classic Manhunt'),
  settings: z.object({
    zone: z.object({
      center: coordinatesSchema,
      radius: z.number().min(500, 'Minimum zone radius is 500m').max(10000, 'Maximum zone radius is 10,000m'),
    }),
    noGoZones: z.array(noGoZoneSchema).default([]),
    durationMin: z.number().min(5).max(240).default(60),
    headStartMin: z.number().min(1).max(30).default(3),
    revealIntervalMin: z.number().min(1).max(15).default(2),
    revealMode: z.enum(['RUNNERS_TO_CHASERS', 'BOTH_WAYS']).default('RUNNERS_TO_CHASERS'),
    zoneShrink: z.object({
      startAfterMin: z.number().min(0).default(30),
      percent: z.number().min(5).max(75).default(25),
      count: z.number().min(1).max(10).default(3),
    }).default({
      startAfterMin: 30,
      percent: 25,
      count: 3,
    }),
    tagMethod: z.enum(['CODE', 'QR']).default('CODE'),
    outOfZonePenalty: z.enum(['WARNING', 'REVEAL', 'ELIMINATE']).default('WARNING'),
    teamVisibility: z.enum(['TEAMMATES_ONLY', 'ALL_PLAYERS']).default('TEAMMATES_ONLY'),
  }),
});

// Create Game (Host Lobby)
gamesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = createGameSchema.parse(req.body);
    const hostId = new mongoose.Types.ObjectId(req.user!.userId);

    const code = await generateUniqueGameCode();

    const newGame = await Game.create({
      code,
      hostId,
      name: data.name,
      mode: data.mode,
      settings: data.settings,
      status: 'lobby',
      players: [
        {
          userId: hostId,
          role: 'RUNNER', // Default role until assigned in lobby
          status: 'ACTIVE',
          ready: true,
        },
      ],
    });

    const populated = await Game.findById(newGame._id)
      .populate('hostId', 'username avatarId')
      .populate('players.userId', 'username avatarId stats');

    return res.status(201).json({
      game: populated,
    });
  } catch (err) {
    next(err);
  }
});

// Lookup Game by 6-Character Code
gamesRouter.get('/code/:code', async (req, res, next) => {
  try {
    const rawCode = req.params.code;
    if (!rawCode || rawCode.trim().length !== 6) {
      throw new AppError('A valid 6-character game code is required', 400);
    }

    const cleanCode = rawCode.trim().toUpperCase();
    const game = await Game.findOne({ code: cleanCode })
      .populate('hostId', 'username avatarId')
      .populate('players.userId', 'username avatarId stats');

    if (!game) {
      throw new AppError(`No active game session found for code "${cleanCode}"`, 404);
    }

    return res.status(200).json({
      game,
    });
  } catch (err) {
    next(err);
  }
});

// Get User's Active and Recent Games
gamesRouter.get('/my-games', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    const games = await Game.find({
      'players.userId': userId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('hostId', 'username avatarId')
      .populate('players.userId', 'username avatarId');

    const activeGames = games.filter((g) => g.status === 'lobby' || g.status === 'running' || g.status === 'countdown');
    const recentGames = games.filter((g) => g.status === 'ended');

    return res.status(200).json({
      active: activeGames,
      recent: recentGames,
    });
  } catch (err) {
    next(err);
  }
});

// Get Game by ID
gamesRouter.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new AppError('Invalid game ID format', 400);
    }

    const game = await Game.findById(req.params.id)
      .populate('hostId', 'username avatarId')
      .populate('players.userId', 'username avatarId stats');

    if (!game) {
      throw new AppError('Game session not found', 404);
    }

    return res.status(200).json({
      game,
    });
  } catch (err) {
    next(err);
  }
});
