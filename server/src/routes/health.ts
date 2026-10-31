import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    database: dbStatus,
  });
});
