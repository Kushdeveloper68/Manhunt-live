import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { Game } from '../models/Game.js';
import { Report, REPORT_REASONS } from '../models/Report.js';
import { logger } from '../logger.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

export const MAX_REPORTS_PER_DAY = 10;

const reportSchema = z.object({
  reportedUserId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid user id'),
  gameId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid game id').optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(300).optional(),
});

/** Report another player. Stored for moderation review. */
reportsRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const me = req.user!.userId;
    const data = reportSchema.parse(req.body);
    if (data.reportedUserId === me) throw new AppError('You cannot report yourself', 400);

    // You can only report people you actually played with
    const shared = await Game.exists({ $and: [{ 'players.userId': me }, { 'players.userId': data.reportedUserId }] });
    if (!shared) throw new AppError('You can only report players you have played with', 403);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = await Report.countDocuments({ reporter: me, createdAt: { $gte: since } });
    if (today >= MAX_REPORTS_PER_DAY) throw new AppError('Report limit reached for today', 429);

    await Report.create({
      reporter: me,
      reported: data.reportedUserId,
      gameId: data.gameId,
      reason: data.reason,
      details: data.details,
    });
    logger.warn(`[REPORT] ${req.user!.username} reported ${data.reportedUserId} for ${data.reason}`);
    return res.status(201).json({ status: 'REPORTED' });
  } catch (err) {
    next(err);
  }
});
