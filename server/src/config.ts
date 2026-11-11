import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const DEV_JWT_SECRET = 'dev-jwt-secret-key-change-me';

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/manhunt_dev'),
  JWT_SECRET: z.string().default(DEV_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default('7d'),
  MAP_STYLE_URL: z.string().default('https://demotiles.maplibre.org/style.json'),
  CLIENT_ORIGINS: z.string().default('*'),
  // Comma-separated OAuth client IDs (web + android) that Google ID tokens may be issued for
  GOOGLE_CLIENT_IDS: z.string().default(''),
  // DEV ONLY: accept unverified googleId/email (never honoured when NODE_ENV=production)
  ALLOW_DEV_GOOGLE_MOCK: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
});

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Refuse to boot in production with insecure defaults (a known JWT secret
 * would let anyone forge login tokens).
 */
export function assertProductionConfig(
  cfg: Pick<AppConfig, 'NODE_ENV' | 'JWT_SECRET' | 'MONGODB_URI'>
): void {
  if (cfg.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  if (
    cfg.JWT_SECRET === DEV_JWT_SECRET ||
    cfg.JWT_SECRET.length < 32 ||
    /replace|change-?me|super-secret/i.test(cfg.JWT_SECRET)
  ) {
    problems.push('JWT_SECRET must be set to a random string of at least 32 characters');
  }
  if (cfg.MONGODB_URI.includes('localhost') || cfg.MONGODB_URI.includes('127.0.0.1')) {
    problems.push('MONGODB_URI must not point to localhost in production');
  }
  if (problems.length) {
    throw new Error(`Insecure production configuration:\n- ${problems.join('\n- ')}`);
  }
}

export const config = envSchema.parse(process.env);
assertProductionConfig(config);

export function googleAudiences(): string[] {
  return config.GOOGLE_CLIENT_IDS.split(',').map((s) => s.trim()).filter(Boolean);
}
