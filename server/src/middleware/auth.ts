import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/auth.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing token.', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (_err) {
    return next(new AppError('Invalid or expired authentication token.', 401));
  }
}
