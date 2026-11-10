import { z } from 'zod';

const DEFAULT_SANDBOX_CLIENT_ID = 'BAAmUIptx_DbDF2S_IWAYBO9uHr-ciYXT9NGFbHxNchXwtfoSzJgUkXW-lGg31JOj2lSrFRRhe6M3OSqVg';
const DEFAULT_SANDBOX_SECRET = 'EP4PcmLLVbBL5KswxAmeZTiz0rCKFRPS_SvrIhqesslAvH7TQvoMz50ewwkSO6627IaG18UI0uIh5tWC';
const DEFAULT_HMAC_SECRET = 'e8f9b2a1c4d3e5f7a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6';

export const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    DATABASE_PATH: z.string().default('data/dealmind.sqlite'),
    APPROVAL_VALIDITY_SECONDS: z.coerce.number().default(900), // 15 mins
    TOKEN_HMAC_SECRET: z.string().default(DEFAULT_HMAC_SECRET),
    PAYPAL_CLIENT_ID: z.string().default(DEFAULT_SANDBOX_CLIENT_ID),
    PAYPAL_CLIENT_SECRET: z.string().default(DEFAULT_SANDBOX_SECRET),
    PAYPAL_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    PAYPAL_BASE_URL: z.string().default('https://api-m.sandbox.paypal.com'),
    PAYPAL_RETURN_URL: z.string().default('https://dealmind-intentlock-app.onrender.com'),
    PAYPAL_CANCEL_URL: z.string().default('https://dealmind-intentlock-app.onrender.com'),

    // LLM Provider Configuration
    LLM_PROVIDER: z.enum(['mock', 'openai', 'anthropic', 'gemini', 'groq']).default('mock'),
    LLM_API_KEY: z.string().default(''),
    LLM_MODEL: z.string().default('mock-model-v1'),
    LLM_BASE_URL: z.string().default(''),
    LLM_TIMEOUT_MS: z.coerce.number().default(15000),
    LLM_MAX_RETRIES: z.coerce.number().default(2),
  })
  .refine(
    (data) => {
      // Must remain Sandbox-only
      if (data.PAYPAL_ENV !== 'sandbox') {
        return false;
      }
      return true;
    },
    {
      message: 'PayPal must remain Sandbox-only (PAYPAL_ENV=sandbox). Live/production PayPal is prohibited.',
      path: ['PAYPAL_ENV'],
    }
  )
  .refine(
    (data) => {
      // Production PayPal endpoint is strictly prohibited
      if (data.PAYPAL_BASE_URL.includes('api-m.paypal.com') && !data.PAYPAL_BASE_URL.includes('sandbox')) {
        return false;
      }
      return true;
    },
    {
      message: 'Production PayPal endpoint is strictly prohibited. PAYPAL_BASE_URL must target sandbox: https://api-m.sandbox.paypal.com',
      path: ['PAYPAL_BASE_URL'],
    }
  )
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
  )
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production' && (!data.PAYPAL_CLIENT_ID || !data.PAYPAL_CLIENT_SECRET)) {
        return false;
      }
      return true;
    },
    {
      message: 'In production mode, PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be explicitly set. Mock payment is prohibited.',
      path: ['PAYPAL_CLIENT_ID'],
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
