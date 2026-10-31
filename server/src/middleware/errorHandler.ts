import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  logger.error('Unhandled server error:', err.stack || err.message);

  return res.status(500).json({
    error: 'Internal server error',
  });
}
