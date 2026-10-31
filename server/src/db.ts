import mongoose from 'mongoose';
import { config } from './config.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<typeof mongoose | null> {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    logger.error('Failed to connect to MongoDB:', err instanceof Error ? err.message : err);
    if (config.NODE_ENV === 'production') {
      process.exit(1);
    }
    return null;
  }
}
