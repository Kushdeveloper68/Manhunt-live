import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/manhunt_dev'),
  JWT_SECRET: z.string().default('dev-jwt-secret-key-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  MAP_STYLE_URL: z.string().default('https://demotiles.maplibre.org/style.json'),
  CLIENT_ORIGINS: z.string().default('*'),
});

export const config = envSchema.parse(process.env);
