import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { logger } from '../logger.js';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high';
}

export type PushSender = (messages: PushMessage[]) => Promise<void>;

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;
export const isValidPushToken = (t: unknown): t is string => typeof t === 'string' && EXPO_TOKEN.test(t);

/** Default sender: Expo's free push service (no extra paid service needed). */
const expoPushSender: PushSender = async (messages) => {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) throw new Error(`Expo push responded ${res.status}`);
};

let sender: PushSender = expoPushSender;
/** For tests. */
export function setPushSender(fn: PushSender | null) {
  sender = fn ?? expoPushSender;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Pure: build messages for the tokens we actually have. */
export function buildPushMessages(tokens: string[], payload: PushPayload): PushMessage[] {
  return [...new Set(tokens)].filter(isValidPushToken).map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: 'default' as const,
    priority: 'high' as const,
  }));
}

/**
 * Fire-and-forget push to users. Never throws: a push failure must never break a game or a request.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  try {
    const ids = userIds.filter((id) => mongoose.isValidObjectId(id));
    if (ids.length === 0) return;
    const users = await User.find({ _id: { $in: ids }, pushToken: { $exists: true, $ne: null } }).select('pushToken');
    const messages = buildPushMessages(
      users.map((u) => u.pushToken as string),
      payload
    );
    for (let i = 0; i < messages.length; i += 100) {
      await sender(messages.slice(i, i + 100));
    }
  } catch (err) {
    logger.warn('Push notification failed:', err instanceof Error ? err.message : err);
  }
}
