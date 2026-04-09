import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).default('postgresql://gymhelper:gymhelper@localhost:5432/gymhelper?schema=public'),
  REDIS_URL: z.string().min(1).optional(),
  REDIS_KEY_PREFIX: z.string().default('gymhelper:'),
  JWT_SECRET: z.string().min(16).default('gymhelper_super_secret_dev_key'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
  AUTH_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_EMAILS: z.string().default(''),
});

export const env = envSchema.parse(process.env);
