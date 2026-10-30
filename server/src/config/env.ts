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

    // LLM Provider Configuration
    LLM_PROVIDER: z.enum(['mock', 'openai', 'anthropic', 'gemini']).default('mock'),
    LLM_API_KEY: z.string().default(''),
    LLM_MODEL: z.string().default('mock-model-v1'),
    LLM_BASE_URL: z.string().default(''),
    LLM_TIMEOUT_MS: z.coerce.number().default(15000),
    LLM_MAX_RETRIES: z.coerce.number().default(2),
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
  )
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production' && data.LLM_PROVIDER !== 'mock' && (!data.LLM_API_KEY || data.LLM_API_KEY.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'In production mode, LLM_API_KEY must be explicitly set when LLM_PROVIDER is not mock.',
      path: ['LLM_API_KEY'],
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
