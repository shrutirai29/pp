import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_PATH: z.string().default('data/dealmind.sqlite'),
  APPROVAL_VALIDITY_SECONDS: z.coerce.number().default(900), // 15 mins
  TOKEN_HMAC_SECRET: z.string().default('dev_insecure_hmac_secret_for_demo_only'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function loadConfig(): EnvConfig {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Configuration validation error:', result.error.format());
    throw new Error('Invalid server configuration');
  }
  return result.data;
}
