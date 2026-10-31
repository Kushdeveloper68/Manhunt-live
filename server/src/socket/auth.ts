import { Socket } from 'socket.io';
import { JwtPayload, verifyToken } from '../utils/auth.js';
import { logger } from '../logger.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtPayload;
  };
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const authHeader = socket.handshake.headers.authorization;
    let token: string | undefined = socket.handshake.auth?.token;

    if (!token && authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    }

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const payload = verifyToken(token);
    socket.data.user = payload;
    next();
  } catch (err: any) {
    logger.warn(`Socket authentication failed: ${err.message}`);
    next(new Error('Authentication error: Invalid or expired token'));
  }
}
