import dotenv from 'dotenv';
import { loadConfig } from '../config/env.js';
import { createLLMProvider } from '../llm/providerFactory.js';

// Load environment variables from process.cwd() or fallback paths
dotenv.config();
dotenv.config({ path: 'server/.env' });
dotenv.config({ path: '../.env' });

console.log('====================================================');
console.log(' DealMind + IntentLock: LLM Provider Smoke Test');
console.log('====================================================');

async function runSmokeTest() {
  let config;
  try {
    config = loadConfig();
  } catch (err: any) {
    console.error('[FAIL] Invalid server configuration:', err.message);
    process.exit(1);
  }

  const providerName = config.LLM_PROVIDER;
  const modelName = config.LLM_MODEL;
  const hasKey = Boolean(config.LLM_API_KEY && config.LLM_API_KEY.trim().length > 0);

  console.log(`[CONFIG] Provider: ${providerName}`);
  console.log(`[CONFIG] Model:    ${modelName}`);
  console.log(`[CONFIG] Base URL: ${config.LLM_BASE_URL || '(default provider endpoint)'}`);
  console.log(`[CONFIG] Key Set:  ${hasKey ? 'YES (Key present, hidden for safety)' : 'NO (Missing)'}`);

  if (providerName === 'mock') {
    console.log('\n[INFO] LLM_PROVIDER is configured as "mock".');
    console.log('[INFO] Testing deterministic MockLLMProvider response...');
    const provider = createLLMProvider(config);
    const start = Date.now();
    const result = await provider.generateCompletion([
      { role: 'user', content: 'Ping test' },
    ]);
    const duration = Date.now() - start;
    console.log(`[OK] Mock provider responded in ${duration}ms.`);
    console.log(`     Output: ${result.slice(0, 100)}...`);
    console.log('\n====================================================');
    console.log(' SMOKE TEST RESULT: Mock Provider Verified.');
    console.log(' (To test a real provider, set LLM_PROVIDER=openai and LLM_API_KEY in server/.env)');
    console.log('====================================================');
    return;
  }

  // External live provider requested (openai, anthropic, gemini)
  if (!hasKey) {
    console.error(`\n[FAIL] LLM_PROVIDER is set to "${providerName}", but LLM_API_KEY is not configured.`);
    console.error('[FAIL] Refusing silent fallback to mock. Configure LLM_API_KEY to execute real LLM calls.');
    console.log('\n====================================================');
    console.log(' SMOKE TEST FAILED: Missing API credentials.');
    console.log('====================================================');
    process.exit(1);
  }

  console.log(`\n[DIAGNOSTIC] Sending minimal diagnostic ping to external provider: ${providerName}...`);
  const provider = createLLMProvider(config);
  const start = Date.now();

  try {
    const response = await provider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a diagnostic health check. Respond strictly with valid JSON: {"ping":"pong"}',
        },
        {
          role: 'user',
          content: 'Diagnostic check. Return {"ping":"pong"}',
        },
      ],
      {
        temperature: 0,
        maxTokens: 50,
        jsonMode: true,
      }
    );
    const duration = Date.now() - start;

    console.log(`[OK] External provider returned successful response in ${duration}ms.`);
    console.log(`     Response payload: ${response.trim()}`);
    console.log('\n====================================================');
    console.log(' SMOKE TEST PASSED: Real LLM connectivity verified.');
    console.log('====================================================');
  } catch (err: any) {
    const duration = Date.now() - start;
    // Strictly sanitize error message to prevent accidental key exposure
    let sanitized = err instanceof Error ? err.message : String(err);
    if (config.LLM_API_KEY) {
      sanitized = sanitized.replaceAll(config.LLM_API_KEY, '***REDACTED_API_KEY***');
    }
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***REDACTED***');

    console.error(`\n[FAIL] External provider request failed after ${duration}ms.`);
    console.error(`       Sanitized error: ${sanitized}`);
    console.log('\n====================================================');
    console.log(' SMOKE TEST FAILED: Provider communication error.');
    console.log('====================================================');
    process.exit(1);
  }
}

runSmokeTest();
