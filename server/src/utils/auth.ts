import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { IUser } from '../models/User.js';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === key;
}

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
}

export function generateToken(user: IUser): string {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function formatUserProfile(user: IUser) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    googleId: user.googleId,
    avatarId: user.avatarId || 'wolf',
    dob: user.dob,
    emergencyContact: user.emergencyContact,
    stats: user.stats || {
      games: 0,
      wins: 0,
      tags: 0,
      escapes: 0,
      kmRun: 0,
    },
    fcmToken: user.fcmToken,
    createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
  };
}
