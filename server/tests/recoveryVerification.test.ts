import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from '../src/db/sqliteAdapter.js';
import { initDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { EnvConfig } from '../src/config/env.js';
import { UserIntent, FinalDeal } from '../src/schemas/dealSchemas.js';
import { authHeader, TEST_SECRET } from './authTestHelper.js';
import { PayPalClient, PayPalOrderParams, PayPalOrderResult, PayPalCaptureResult, HttpPayPalClient } from '../src/services/paypalClient.js';
import { MockLLMProvider } from '../src/llm/mockProvider.js';
import { OpenAICompatibleProvider } from '../src/llm/openaiProvider.js';
import { NegotiationCoordinator } from '../src/services/negotiation/negotiationCoordinator.js';
import { NegotiationRepository } from '../src/repositories/negotiationRepository.js';
import { DealRepository } from '../src/repositories/dealRepository.js';
import { AuditRepository } from '../src/repositories/auditRepository.js';

const testConfig: EnvConfig = {
  PORT: 4001,
  NODE_ENV: 'test',
  CORS_ORIGIN: '*',
  DATABASE_PATH: ':memory:',
  APPROVAL_VALIDITY_SECONDS: 900,
  TOKEN_HMAC_SECRET: TEST_SECRET,
  PAYPAL_CLIENT_ID: '',
  PAYPAL_CLIENT_SECRET: '',
  PAYPAL_ENV: 'sandbox',
  PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
  LLM_PROVIDER: 'mock',
  LLM_API_KEY: '',
  LLM_MODEL: 'llama-3.3-70b-versatile',
  LLM_BASE_URL: '',
  LLM_TIMEOUT_MS: 5000,
  LLM_MAX_RETRIES: 1,
};

class TrackingPayPalClient implements PayPalClient {
  public readonly isMock = true;
  public readonly gatewayMode = 'mock_sandbox' as const;
  public captureCalls = 0;
  public getOrderCalls = 0;
  public simulateNetworkError = false;
  public simulatedOrderStatus: string = 'COMPLETED';
  public simulatedCaptureId: string = 'CAP-REC-VALID-123';
  public simulatedAmount: number = 7000;
  public simulatedCurrency: string = 'USD';

  public async createOrder(params: PayPalOrderParams): Promise<PayPalOrderResult> {
    const id = `ORDER-${params.dealId}`;
    return {
      id,
      status: 'CREATED',
      links: [{ rel: 'approve', href: `https://sandbox.paypal.com/checkout?token=${id}` }],
    };
  }

  public async captureOrder(orderId: string): Promise<PayPalCaptureResult> {
    this.captureCalls++;
    if (this.simulateNetworkError) {
      throw new Error('Simulated network timeout during capture');
    }
    return {
      id: orderId,
      status: 'COMPLETED',
      captureId: `CAP-${orderId}`,
      amount: this.simulatedAmount,
      currency: this.simulatedCurrency,
      payerEmail: 'buyer@test.sandbox',
      payerId: 'PAYER-123',
    };
  }

  public async getOrder(orderId: string): Promise<PayPalCaptureResult> {
    this.getOrderCalls++;
    if (this.simulateNetworkError) {
      throw new Error('Simulated network timeout during getOrder reconciliation');
    }
    return {
      id: orderId,
      status: this.simulatedOrderStatus,
      captureId: this.simulatedCaptureId,
      amount: this.simulatedAmount,
      currency: this.simulatedCurrency,
      payerEmail: 'buyer@test.sandbox',
      payerId: 'PAYER-123',
    };
  }
}

describe('Recovery Verification Suite: Idempotency, Model Transparency, & Reconciliation', () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;
  let trackingPayPal: TrackingPayPalClient;
  const userA = 'user-alice-001';
  const userB = 'user-bob-002';

  const baseIntent: UserIntent = {
    id: 'deal-recovery-001',
    rawQuery: 'Dell XPS 15 32GB RAM under $7,500 in new condition.',
    productTitle: 'Dell XPS 15',
    maxBudget: 7500,
    currency: 'USD',
    requiredCondition: 'new',
    maxDeliveryDays: 5,
    requiredWarrantyMonths: 12,
    prohibitSubscriptions: true,
    requireAllFeesIncluded: true,
    hardConstraints: ['budget', 'condition', 'warranty', 'no_subscription'],
    flexiblePreferences: [],
    createdAt: new Date().toISOString(),
  };

  const validFinalDeal: FinalDeal = {
    dealId: 'deal-recovery-001',
    originalOfferId: 'off-techhaven-01',
    sellerId: 'off-techhaven-01',
    sellerName: 'TechHaven Direct',
    productTitle: 'Dell XPS 15',
    condition: 'new',
    productPrice: 7000,
    deliveryFee: 0,
    otherCharges: 0,
    totalPayable: 7000,
    deliveryEstimateDays: 2,
    warrantyMonths: 60,
    hasSubscription: false,
    negotiationStatus: 'agreed',
    roundCount: 3,
    messages: [],
    isAcceptedBySeller: true,
    currency: 'USD',
    totalSaved: 299,
    stopReason: 'agreed',
  };

  beforeEach(() => {
    db = initDatabase(':memory:');
    trackingPayPal = new TrackingPayPalClient();
    app = createApp(db, testConfig, trackingPayPal);
  });

  // =========================================================================
  // 1. DEAL IDEMPOTENCY
  // =========================================================================
  describe('1. Deal Creation & Synchronization Idempotency', () => {
    it('1.1 Allows repeated deal creation calls with the same deal ID without UNIQUE constraint errors', async () => {
      // First sync
      const res1 = await request(app)
        .post('/api/deals')
        .set(authHeader(userA))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      expect(res1.status).toBe(201);
      expect(res1.body.success).toBe(true);

      // Second sync with identical ID (e.g. from negotiation start)
      const res2 = await request(app)
        .post('/api/deals')
        .set(authHeader(userA))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      expect(res2.status).toBe(201);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.id).toBe(baseIntent.id);

      // Third sync with same ID (e.g. proceed to verification)
      const res3 = await request(app)
        .post('/api/deals')
        .set(authHeader(userA))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      expect(res3.status).toBe(201);
      expect(res3.body.success).toBe(true);

      // Confirm only ONE record exists in SQLite
      const count = db.prepare('SELECT COUNT(*) as c FROM deals WHERE id = ?').get(baseIntent.id) as { c: number };
      expect(count.c).toBe(1);
    });

    it('1.2 Strictly prevents user B from overwriting user A\'s deal', async () => {
      // User A creates deal
      await request(app)
        .post('/api/deals')
        .set(authHeader(userA))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      // User B attempts to overwrite deal with same ID
      const spoofRes = await request(app)
        .post('/api/deals')
        .set(authHeader(userB))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      expect(spoofRes.status).toBe(403);
      expect(spoofRes.body.success).toBe(false);
      expect(spoofRes.body.error).toMatch(/Unauthorized/i);

      // Verify deal ownership remained User A
      const dealInDb = db.prepare('SELECT user_id FROM deals WHERE id = ?').get(baseIntent.id) as { user_id: string };
      expect(dealInDb.user_id).toBe(userA);
    });

    it('1.3 Preserves advanced deal status and does not reset verified or payment_completed deals to draft', async () => {
      // Create deal
      await request(app)
        .post('/api/deals')
        .set(authHeader(userA))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      // Advance status directly
      db.prepare('UPDATE deals SET status = ? WHERE id = ?').run('payment_completed', baseIntent.id);

      // Subsequent sync call
      const res = await request(app)
        .post('/api/deals')
        .set(authHeader(userA))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('payment_completed');

      const dealInDb = db.prepare('SELECT status FROM deals WHERE id = ?').get(baseIntent.id) as { status: string };
      expect(dealInDb.status).toBe('payment_completed');
    });
  });

  // =========================================================================
  // 2. MODEL TRANSPARENCY (PHASE 7 P1)
  // =========================================================================
  describe('2. Model Identifier Transparency (Phase 7 P1)', () => {
    it('2.1 MockLLMProvider exposes explicit modelName', () => {
      const mock = new MockLLMProvider();
      expect(mock.modelName).toBe('mock-model-v1');
      expect(mock.name).toBe('mock-llm-provider');
    });

    it('2.2 OpenAICompatibleProvider exposes configured modelName accurately', () => {
      const groqProvider = new OpenAICompatibleProvider({
        providerName: 'groq',
        apiKey: 'test-key',
        model: 'llama-3.3-70b-versatile',
      });

      expect(groqProvider.name).toBe('groq');
      expect(groqProvider.modelName).toBe('llama-3.3-70b-versatile');

      const customGroq = new OpenAICompatibleProvider({
        providerName: 'groq',
        apiKey: 'test-key',
        model: 'openai/gpt-oss-120b',
      });
      expect(customGroq.modelName).toBe('openai/gpt-oss-120b');
    });

    it('2.3 NegotiationCoordinator includes modelName in execution result', async () => {
      const mockProvider = new MockLLMProvider();
      const negRepo = new NegotiationRepository(db);
      const dealRepo = new DealRepository(db);
      const auditRepo = new AuditRepository(db);

      dealRepo.createDeal(userA, baseIntent, validFinalDeal);

      const coordinator = new NegotiationCoordinator(mockProvider, negRepo, dealRepo, auditRepo);
      const result = await coordinator.executeNegotiation(baseIntent.id, userA, baseIntent, {
        id: 'off-techhaven-01',
        sellerName: 'TechHaven Direct',
        productTitle: 'Dell XPS 15',
        basePrice: 7299,
        deliveryFee: 0,
        otherCharges: 0,
        estimatedDeliveryDays: 2,
        warrantyMonths: 24,
        hasSubscription: false,
        condition: 'new',
        currency: 'USD',
      });

      expect(result.modelName).toBe('mock-model-v1');
      expect(result.providerName).toBe('mock-llm-provider');
      expect(result.engineMode).toBe('mock_llm');
    });

    it('2.4 POST /api/deals/:id/negotiate returns modelName and providerName in response', async () => {
      await request(app)
        .post('/api/deals')
        .set(authHeader(userA))
        .send({ intent: baseIntent, finalDeal: validFinalDeal });

      const res = await request(app)
        .post(`/api/deals/${baseIntent.id}/negotiate`)
        .set(authHeader(userA))
        .send({
          offerId: 'off-techhaven-01',
          productOffer: {
            id: 'off-techhaven-01',
            sellerName: 'TechHaven Direct',
            productTitle: 'Dell XPS 15',
            basePrice: 7299,
            deliveryFee: 0,
            otherCharges: 0,
            estimatedDeliveryDays: 2,
            warrantyMonths: 24,
            hasSubscription: false,
            condition: 'new',
            currency: 'USD',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.modelName).toBe('mock-model-v1');
      expect(res.body.data.providerName).toBe('mock-llm-provider');
    });
  });

  // =========================================================================
  // 3. PAYMENT RECONCILIATION (PHASE 7 P2)
  // =========================================================================
  describe('3. Dedicated Payment Reconciliation Flow (Phase 7 P2)', () => {
    let authHeaderA: { Authorization: string };
    let approvalId: string;
    let authToken: string;

    beforeEach(async () => {
      authHeaderA = authHeader(userA);

      // Setup verified and approved deal
      await request(app).post('/api/deals').set(authHeaderA).send({ intent: baseIntent, finalDeal: validFinalDeal });
      await request(app).post(`/api/deals/${baseIntent.id}/verify`).set(authHeaderA).send({ finalDeal: validFinalDeal });
      const apprReq = await request(app).post(`/api/deals/${baseIntent.id}/approval-request`).set(authHeaderA);
      approvalId = apprReq.body.data.id;

      const approveRes = await request(app).post(`/api/deals/${baseIntent.id}/approve`).set(authHeaderA).send({
        approvalId,
        finalDeal: validFinalDeal,
      });

      authToken = approveRes.body.data.authorizationToken;

      // Initiate checkout to create PayPal order
      await request(app)
        .post(`/api/deals/${baseIntent.id}/checkout`)
        .set(authHeaderA)
        .send({ authorizationToken: authToken });
    });

    it('3.1 Successfully reconciles a COMPLETED order, marks deal completed, and NEVER calls captureOrder', async () => {
      trackingPayPal.simulatedOrderStatus = 'COMPLETED';
      trackingPayPal.simulatedCaptureId = 'CAP-CONFIRMED-RECON-777';
      trackingPayPal.simulatedAmount = 7000;
      trackingPayPal.simulatedCurrency = 'USD';

      const initialCaptureCalls = trackingPayPal.captureCalls;

      const res = await request(app)
        .post(`/api/deals/${baseIntent.id}/reconcile`)
        .set(authHeaderA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.paymentStatus).toBe('COMPLETED');
      expect(res.body.data.dealStatus).toBe('payment_completed');
      expect(res.body.data.captureId).toBe('CAP-CONFIRMED-RECON-777');

      // Crucial verification: captureOrder was NEVER invoked
      expect(trackingPayPal.captureCalls).toBe(initialCaptureCalls);
      expect(trackingPayPal.getOrderCalls).toBeGreaterThan(0);

      // Verify approval record was atomically marked CONSUMED
      const approvalInDb = db.prepare('SELECT status, consumed_at FROM approvals WHERE id = ?').get(approvalId) as any;
      expect(approvalInDb.status).toBe('CONSUMED');
      expect(approvalInDb.consumed_at).toBeTruthy();
    });

    it('3.2 Returns structured PENDING without marking deal completed when PayPal order is still pending', async () => {
      trackingPayPal.simulatedOrderStatus = 'APPROVED'; // Not yet captured on PayPal

      const res = await request(app)
        .post(`/api/deals/${baseIntent.id}/reconcile`)
        .set(authHeaderA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');

      // Deal remains NOT completed
      const dealInDb = db.prepare('SELECT status FROM deals WHERE id = ?').get(baseIntent.id) as any;
      expect(dealInDb.status).not.toBe('payment_completed');
    });

    it('3.3 Handles PayPal FAILED / CANCELLED order by updating payment to FAILED', async () => {
      trackingPayPal.simulatedOrderStatus = 'VOIDED';

      const res = await request(app)
        .post(`/api/deals/${baseIntent.id}/reconcile`)
        .set(authHeaderA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('FAILED');
      expect(res.body.data.paymentStatus).toBe('FAILED');

      const paymentInDb = db.prepare('SELECT status FROM payments WHERE deal_id = ?').get(baseIntent.id) as any;
      expect(paymentInDb.status).toBe('FAILED');
    });

    it('3.4 Returns HTTP 502 on network timeout and safely preserves REQUIRES_RECONCILIATION status', async () => {
      trackingPayPal.simulateNetworkError = true;

      const res = await request(app)
        .post(`/api/deals/${baseIntent.id}/reconcile`)
        .set(authHeaderA);

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/network interruption/i);

      const paymentInDb = db.prepare('SELECT status FROM payments WHERE deal_id = ?').get(baseIntent.id) as any;
      expect(paymentInDb.status).toBe('REQUIRES_RECONCILIATION');
    });

    it('3.5 Repeated reconciliation on an already completed payment is fully idempotent', async () => {
      trackingPayPal.simulatedOrderStatus = 'COMPLETED';

      // First reconciliation
      const res1 = await request(app)
        .post(`/api/deals/${baseIntent.id}/reconcile`)
        .set(authHeaderA);
      expect(res1.status).toBe(200);
      expect(res1.body.data.status).toBe('COMPLETED');

      // Second reconciliation
      const res2 = await request(app)
        .post(`/api/deals/${baseIntent.id}/reconcile`)
        .set(authHeaderA);
      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe('COMPLETED');
      expect(res2.body.data.dealStatus).toBe('payment_completed');
    });

    it('3.6 Strictly prevents unauthorized user from reconciling another user\'s deal', async () => {
      const res = await request(app)
        .post(`/api/deals/${baseIntent.id}/reconcile`)
        .set(authHeader(userB));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });
  });

  describe('4. PayPal Hosted Checkout Return/Cancel URL and Secret Sanitization Verification', () => {
    it('4.1 HttpPayPalClient includes return_url, cancel_url, intent, custom_id, and amount in order payload', async () => {
      let capturedUrl = '';
      let capturedBody: any = null;

      const client = new HttpPayPalClient(
        'mock_client_id_test',
        'mock_secret_test_xyz',
        'https://api-m.sandbox.paypal.com',
        'http://localhost:5173/return',
        'http://localhost:5173/cancel'
      );

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url: any, init: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/v1/oauth2/token')) {
          return new Response(JSON.stringify({ access_token: 'fake_access_token_123', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/v2/checkout/orders')) {
          capturedUrl = urlStr;
          capturedBody = JSON.parse(init.body);
          return new Response(
            JSON.stringify({
              id: '7C_TEST_ORDER_123',
              status: 'CREATED',
              links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=7C_TEST_ORDER_123' }],
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      }) as any;

      try {
        const result = await client.createOrder({
          dealId: 'intent_1793891217448',
          referenceId: 'DM-intent_179389121',
          description: 'DealMind: Samsung 980 1TB SSD',
          amount: 74,
          currency: 'USD',
        });

        expect(result.id).toBe('7C_TEST_ORDER_123');
        expect(capturedUrl).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders');
        expect(capturedBody).toBeDefined();
        expect(capturedBody.intent).toBe('CAPTURE');
        expect(capturedBody.purchase_units[0].amount.currency_code).toBe('USD');
        expect(capturedBody.purchase_units[0].amount.value).toBe('74.00');
        expect(capturedBody.purchase_units[0].custom_id).toBe('intent_1793891217448');
        expect(capturedBody.purchase_units[0].reference_id).toBe('DM-intent_179389121');
        expect(capturedBody.application_context.return_url).toBe('http://localhost:5173/return');
        expect(capturedBody.application_context.cancel_url).toBe('http://localhost:5173/cancel');
        expect(capturedBody.application_context.user_action).toBe('PAY_NOW');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('4.2 HttpPayPalClient error handling strictly redacts client ID, secret, and bearer tokens', async () => {
      const client = new HttpPayPalClient(
        'super_secret_client_id_999',
        'super_secret_key_888',
        'https://api-m.sandbox.paypal.com'
      );

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        return new Response(
          'Error details containing super_secret_key_888 and super_secret_client_id_999 and Bearer secret_token_xyz',
          { status: 401 }
        );
      }) as any;

      try {
        await expect(
          client.createOrder({
            dealId: 'd-test',
            referenceId: 'ref-test',
            description: 'Test order',
            amount: 74,
            currency: 'USD',
          })
        ).rejects.toThrow();

        try {
          await client.createOrder({
            dealId: 'd-test',
            referenceId: 'ref-test',
            description: 'Test order',
            amount: 74,
            currency: 'USD',
          });
        } catch (err: any) {
          expect(err.message).not.toContain('super_secret_client_id_999');
          expect(err.message).not.toContain('super_secret_key_888');
          expect(err.message).not.toContain('secret_token_xyz');
          expect(err.message).toContain('***REDACTED');
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
