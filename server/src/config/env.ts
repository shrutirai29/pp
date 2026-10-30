import { z } from 'zod';

export const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    DATABASE_PATH: z.string().default('data/dealmind.sqlite'),
    APPROVAL_VALIDITY_SECONDS: z.coerce.number().default(900), // 15 mins
    TOKEN_HMAC_SECRET: z.string().default('dev_insecure_hmac_secret_for_demo_only'),
    PAYPAL_CLIENT_ID: z.string().default(''),
    PAYPAL_CLIENT_SECRET: z.string().default(''),
    PAYPAL_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    PAYPAL_BASE_URL: z.string().default('https://api-m.sandbox.paypal.com'),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production' && data.TOKEN_HMAC_SECRET === 'dev_insecure_hmac_secret_for_demo_only') {
        return false;
      }
      return true;
    },
    {
      message: 'In production mode, TOKEN_HMAC_SECRET must be explicitly set to a cryptographically secure secret.',
      path: ['TOKEN_HMAC_SECRET'],
    }
  );

export type EnvConfig = z.infer<typeof EnvSchema>;

export function loadConfig(): EnvConfig {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Configuration validation error:', result.error.format());
    throw new Error('Invalid server configuration');
  }
  return result.data;
}
