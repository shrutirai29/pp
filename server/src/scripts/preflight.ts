import dotenv from 'dotenv';
import { loadConfig } from '../config/env.js';
import { isPayPalSupportedCurrency, PAYPAL_SUPPORTED_CURRENCIES } from '../config/currencies.js';
import { initDatabase } from '../db/database.js';

// Load environment variables from process.cwd() or fallback paths
dotenv.config();
dotenv.config({ path: 'server/.env' });
dotenv.config({ path: '../.env' });

console.log('====================================================');
console.log(' DealMind + IntentLock: Safe Preflight Verification');
console.log('====================================================');

let hasError = false;

// 1. Config Validation
let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig();
  console.log('[OK] Environment configuration parsed successfully.');
  console.log(`     NODE_ENV: ${config.NODE_ENV}`);
  console.log(`     PORT: ${config.PORT}`);
  console.log(`     DATABASE_PATH: ${config.DATABASE_PATH}`);
} catch (err: any) {
  console.error('[FAIL] Invalid server configuration:', err.message);
  process.exit(1);
}

// 2. LLM Provider Check
console.log('\n--- LLM Provider Configuration ---');
console.log(`     LLM_PROVIDER: ${config.LLM_PROVIDER}`);
console.log(`     LLM_MODEL: ${config.LLM_MODEL}`);
if (config.LLM_PROVIDER === 'mock') {
  console.log('[OK] Mock LLM provider active (deterministic, zero API cost).');
} else {
  if (config.LLM_API_KEY && config.LLM_API_KEY.trim().length > 0) {
    console.log('[OK] Live LLM provider configured with API key present (backend-only).');
  } else {
    if (config.NODE_ENV === 'production') {
      console.error('[FAIL] Production requires LLM_API_KEY for provider:', config.LLM_PROVIDER);
      hasError = true;
    } else {
      console.log('[WARN] LLM_API_KEY missing in development; will fall back to mock provider.');
    }
  }
}

// 3. PayPal Sandbox Safety
console.log('\n--- PayPal Payment Gateway Safety ---');
console.log(`     PAYPAL_ENV: ${config.PAYPAL_ENV}`);
console.log(`     PAYPAL_BASE_URL: ${config.PAYPAL_BASE_URL}`);

if (config.PAYPAL_ENV !== 'sandbox') {
  console.error('[FAIL] PayPal must be configured for sandbox (PAYPAL_ENV=sandbox).');
  hasError = true;
} else {
  console.log('[OK] PayPal environment is sandbox.');
}

if (config.PAYPAL_BASE_URL.includes('api-m.paypal.com') && !config.PAYPAL_BASE_URL.includes('sandbox')) {
  console.error('[FAIL] Production PayPal endpoint detected! Strictly prohibited.');
  hasError = true;
} else if (config.PAYPAL_BASE_URL === 'https://api-m.sandbox.paypal.com') {
  console.log('[OK] Base URL is standard PayPal Sandbox endpoint.');
} else {
  console.log(`[OK] Base URL configured: ${config.PAYPAL_BASE_URL}`);
}

async function runPreflight() {
  const hasPayPalCreds = Boolean(config.PAYPAL_CLIENT_ID && config.PAYPAL_CLIENT_SECRET);
  if (hasPayPalCreds) {
    console.log('[OK] PayPal Sandbox credentials configured for live sandbox calls.');
    try {
      const auth = Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await fetch(`${config.PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (tokenRes.ok) {
        console.log('[OK] PayPal Sandbox OAuth authentication verified (HTTP 200 OK).');
      } else {
        console.warn(`[WARN] PayPal Sandbox OAuth authentication returned HTTP ${tokenRes.status}.`);
      }
    } catch (err: any) {
      console.warn('[WARN] PayPal Sandbox OAuth network probe failed:', err.message);
    }
  } else {
    console.log('[INFO] PayPal credentials not set; server will use internal MockPayPalClient for checkout.');
  }

  // 4. Currency Allowlist Check
  console.log('\n--- Currency Safety Allowlist ---');
  console.log(`[OK] Supported PayPal currencies: ${PAYPAL_SUPPORTED_CURRENCIES.length} ISO codes.`);
  console.log(`     USD supported: ${isPayPalSupportedCurrency('USD')}`);
  console.log(`     EUR supported: ${isPayPalSupportedCurrency('EUR')}`);
  console.log(`     INR supported: ${isPayPalSupportedCurrency('INR')} (Rejected safely by design)`);

  // 5. Database Connection Check
  console.log('\n--- Persistence Integrity ---');
  try {
    const db = initDatabase(config.DATABASE_PATH);
    console.log('[OK] SQLite database initialized and schema verified.');
  } catch (err: any) {
    console.error('[FAIL] Database initialization failed:', err.message);
    hasError = true;
  }

  console.log('\n====================================================');
  if (hasError) {
    console.error(' PREFLIGHT FAILED: Please fix errors above.');
    process.exit(1);
  } else {
    console.log(' PREFLIGHT PASSED: System ready for safe demonstration.');
    console.log(' (No orders created, zero payments captured)');
    console.log('====================================================\n');
  }
}

runPreflight();
