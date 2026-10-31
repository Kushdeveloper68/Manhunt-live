import crypto from 'node:crypto';
import { Game } from '../models/Game.js';

// Unambiguous character set (no 0/O, 1/I)
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRandomCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
}

export async function generateUniqueGameCode(maxAttempts = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRandomCode(6);
    const existing = await Game.findOne({ code });
    if (!existing) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique game code. Please try again.');
}
