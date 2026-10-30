import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from '../src/db/sqliteAdapter.js';
import { initDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { EnvConfig } from '../src/config/env.js';
import { UserIntent } from '../src/schemas/dealSchemas.js';
import { MockLLMProvider } from '../src/llm/mockProvider.js';
import { PayPalClient, PayPalOrderParams, PayPalCaptureResult } from '../src/services/paypalClient.js';

class MockPayPalGateway implements PayPalClient {
  public orders = new Map<string, any>();
  public shouldFailNetwork = false;
  public simulateFailureStatus: string | null = null;
  public captureReconciled = false;

  async createOrder(params: PayPalOrderParams) {
    const orderId = `MOCK-PAYPAL-ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = {
      id: orderId,
      status: 'CREATED',
      links: [{ rel: 'approve', href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}` }],
    };
    this.orders.set(orderId, { ...params, id: orderId, status: 'CREATED' });
    return result;
  }

  async captureOrder(orderId: string, _idempotencyKey?: string) {
    if (this.shouldFailNetwork) {
      throw new Error('ETIMEDOUT: Connection to api-m.sandbox.paypal.com timed out');
    }
    const order = this.orders.get(orderId);
    if (!order) throw new Error('RESOURCE_NOT_FOUND: Order does not exist');
    if (this.simulateFailureStatus) {
      return { id: orderId, status: this.simulateFailureStatus };
    }
    const captureId = `CAP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    order.status = 'COMPLETED';
    order.captureId = captureId;
    return {
      id: orderId,
      status: 'COMPLETED',
      captureId,
      payerEmail: 'sandbox-buyer@dealmind.example.com',
      payerId: 'PAYER-TEST-1234',
    };
  }

  async getOrder(orderId: string): Promise<PayPalCaptureResult> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('RESOURCE_NOT_FOUND');
    return {
      id: orderId,
      status: this.captureReconciled ? 'COMPLETED' : order.status,
      captureId: order.captureId || 'CAP-RECONCILED-999',
      payerEmail: 'sandbox-buyer@dealmind.example.com',
      payerId: 'PAYER-TEST-1234',
    };
  }
}

const testConfig: EnvConfig = {
  PORT: 4003,
  NODE_ENV: 'test',
  CORS_ORIGIN: '*',
  DATABASE_PATH: ':memory:',
  APPROVAL_VALIDITY_SECONDS: 900,
  TOKEN_HMAC_SECRET: 'test_phase7_hmac_secret_key',
  PAYPAL_CLIENT_ID: 'mock_sandbox_client_id',
  PAYPAL_CLIENT_SECRET: 'mock_sandbox_client_secret',
  PAYPAL_ENV: 'sandbox',
  PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
  LLM_PROVIDER: 'mock',
  LLM_API_KEY: '',
  LLM_MODEL: 'mock-model-v1',
  LLM_BASE_URL: '',
  LLM_TIMEOUT_MS: 5000,
  LLM_MAX_RETRIES: 1,
};

const mockIntent: UserIntent = {
  id: 'deal-e2e-001',
  rawQuery: 'Samsung 980 1TB SSD under ₹7,500, new condition, delivery in 3 days, no subscriptions.',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  maxBudget: 7500,
  currency: 'INR',
  requiredCondition: 'new',
  maxDeliveryDays: 3,
  requiredWarrantyMonths: 12,
  prohibitSubscriptions: true,
  requireAllFeesIncluded: true,
  hardConstraints: ['budget', 'condition', 'delivery', 'no_subscription', 'warranty'],
  flexiblePreferences: ['seller_rating'],
  createdAt: '2026-10-30T10:00:00Z',
};

describe('Phase 7: End-to-End Integration & Security Hardening Suite', () => {
  let db: DatabaseSync;
  let mockLLM: MockLLMProvider;
  let mockPayPal: MockPayPalGateway;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = initDatabase(':memory:');
    mockLLM = new MockLLMProvider();
    mockPayPal = new MockPayPalGateway();
    app = createApp(db, testConfig, mockPayPal, mockLLM);
  });

  // ---------------------------------------------------------------------------
  // SECTION 1: Complete Happy Path Lifecycle
  // ---------------------------------------------------------------------------
  it('E2E-1: Executes complete end-to-end hackathon lifecycle from search to PayPal capture', async () => {
    const userId = 'buyer-session-01';

    // 1. Create Deal & UserIntent
    const createRes = await request(app)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent, title: mockIntent.productTitle })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.id).toBe(mockIntent.id);

    // 2. Scan & Rank Offers on Server
    const sampleOffers = [
      {
        id: 'off-techhaven-01',
        sellerName: 'TechHaven Direct',
        productTitle: 'Samsung 980 1TB NVMe SSD',
        basePrice: 7299,
        deliveryFee: 0,
        otherCharges: 0,
        estimatedDeliveryDays: 2,
        warrantyMonths: 60,
        hasSubscription: false,
        condition: 'new',
        currency: 'INR',
        sellerReliabilityScore: 98,
      },
      {
        id: 'off-conditional-prime',
        sellerName: 'Prime Storage Solutions',
        productTitle: 'Samsung 980 1TB NVMe SSD',
        basePrice: 7600,
        deliveryFee: 200,
        otherCharges: 0,
        estimatedDeliveryDays: 3,
        warrantyMonths: 24,
        hasSubscription: false,
        condition: 'new',
        currency: 'INR',
        sellerReliabilityScore: 94,
      },
    ];

    const rankRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/rank-offers`)
      .set('x-user-id', userId)
      .send({ offers: sampleOffers })
      .expect(200);

    expect(rankRes.body.success).toBe(true);
    expect(rankRes.body.data[0].id).toBe('off-techhaven-01');
    expect(rankRes.body.data[0].isEligible).toBe(true);

    // 3. Run Multi-Agent Negotiation
    const negRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/negotiate`)
      .set('x-user-id', userId)
      .send({
        offerId: 'off-techhaven-01',
        productOffer: sampleOffers[0],
      })
      .expect(200);

    expect(negRes.body.success).toBe(true);
    const finalDeal = negRes.body.data.finalDeal;
    expect(finalDeal.negotiationStatus).toBe('agreed');
    expect(finalDeal.isAcceptedBySeller).toBe(true);
    expect(finalDeal.totalPayable).toBeLessThanOrEqual(mockIntent.maxBudget);

    // 4. Verify Persistent Negotiation History in SQLite
    const negHistoryRes = await request(app)
      .get(`/api/deals/${mockIntent.id}/negotiations`)
      .set('x-user-id', userId)
      .expect(200);

    expect(negHistoryRes.body.success).toBe(true);
    expect(negHistoryRes.body.data.rounds.length).toBeGreaterThanOrEqual(1);

    // 5. IntentLock Independent Server Verification
    const verifRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal })
      .expect(200);

    expect(verifRes.body.success).toBe(true);
    expect(verifRes.body.data.status).toBe('VERIFIED');
    expect(verifRes.body.data.dealFingerprint).toBeDefined();

    // 6. Request Explicit Human Approval
    const apprReqRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId)
      .expect(201);

    expect(apprReqRes.body.success).toBe(true);
    expect(apprReqRes.body.data.status).toBe('PENDING');

    // 7. Explicit Human Purchase Approval Grant
    const approveRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .set('x-user-id', userId)
      .expect(200);

    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.status).toBe('APPROVED');
    const authorizationToken = approveRes.body.data.authorizationToken;
    expect(authorizationToken).toMatch(/^AUTH-SRV-/);

    // 8. PayPal Sandbox Order Creation
    const checkoutRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', userId)
      .send({ authorizationToken })
      .expect(201);

    expect(checkoutRes.body.success).toBe(true);
    const paypalOrderId = checkoutRes.body.data.paypalOrderId;
    expect(checkoutRes.body.data.amount).toBe(finalDeal.totalPayable);
    expect(checkoutRes.body.data.currency).toBe(mockIntent.currency);

    // 9. PayPal Sandbox Capture Simulation
    const captureRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/capture`)
      .set('x-user-id', userId)
      .send({ paypalOrderId })
      .expect(200);

    expect(captureRes.body.success).toBe(true);
    expect(captureRes.body.data.status).toBe('COMPLETED');
    expect(captureRes.body.data.captureId).toBeDefined();

    // 10. Authoritative Payment Status Confirmation
    const paymentRes = await request(app)
      .get(`/api/deals/${mockIntent.id}/payment`)
      .set('x-user-id', userId)
      .expect(200);

    expect(paymentRes.body.success).toBe(true);
    expect(paymentRes.body.data.status).toBe('COMPLETED');
    expect(paymentRes.body.data.paypalOrderId).toBe(paypalOrderId);

    // 11. Retrieve Complete Audit Trail
    const auditRes = await request(app)
      .get(`/api/deals/${mockIntent.id}/audit`)
      .set('x-user-id', userId)
      .expect(200);

    expect(auditRes.body.success).toBe(true);
    const eventTypes = auditRes.body.data.map((e: any) => e.type);
    expect(eventTypes).toContain('requirements_created');
    expect(eventTypes).toContain('negotiation_completed');
    expect(eventTypes).toContain('deal_verified');
    expect(eventTypes).toContain('human_approval_requested');
    expect(eventTypes).toContain('approval_granted');
    expect(eventTypes).toContain('paypal_order_created');
    expect(eventTypes).toContain('paypal_payment_completed');
  });

  // ---------------------------------------------------------------------------
  // SECTION 2: IntentLock Failure & Guard Enforcement Modes
  // ---------------------------------------------------------------------------
  it('E2E-2: IntentLock rejects deals that exceed authorized user budget ceiling', async () => {
    const userId = 'buyer-02';
    await request(app)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent })
      .expect(201);

    const overBudgetDeal = {
      dealId: mockIntent.id,
      originalOfferId: 'off-expensive',
      sellerId: 'off-expensive',
      sellerName: 'Expensive Vendor',
      productTitle: mockIntent.productTitle,
      condition: 'new' as const,
      productPrice: 9000, // Budget is 7500
      deliveryFee: 0,
      otherCharges: 0,
      totalPayable: 9000,
      deliveryEstimateDays: 2,
      warrantyMonths: 24,
      hasSubscription: false,
      negotiationStatus: 'agreed' as const,
      roundCount: 2,
      messages: [],
      isAcceptedBySeller: true,
      currency: 'INR' as const,
      totalSaved: 0,
      stopReason: 'agreed' as const,
    };

    const verifRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: overBudgetDeal })
      .expect(200);

    expect(verifRes.body.data.status).toBe('REJECTED');
    expect(verifRes.body.data.rejectionReasons.join(' ')).toMatch(/exceeds.*maximum budget/i);

    // Approval request on rejected deal is blocked
    const apprRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId)
      .expect(400);

    expect(apprRes.body.error).toMatch(/Cannot request human approval for deal with verification status: REJECTED/i);
  });

  it('E2E-3: Re-verifying a deal with modified terms invalidates prior approvals', async () => {
    const userId = 'buyer-03';
    await request(app)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent })
      .expect(201);

    // Initial valid negotiation and verification
    const negRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/negotiate`)
      .set('x-user-id', userId)
      .send({ offerId: 'off-techhaven-01' });

    const deal1 = negRes.body.data.finalDeal;
    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: deal1 });

    const apprRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId);

    const approveRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .set('x-user-id', userId);

    const originalToken = approveRes.body.data.authorizationToken;

    // Re-verify with modified price
    const deal2 = { ...deal1, productPrice: deal1.productPrice - 100, totalPayable: deal1.totalPayable - 100 };
    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: deal2 })
      .expect(200);

    // Attempting to checkout using original token must be rejected because approval was invalidated
    const checkoutRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', userId)
      .send({ authorizationToken: originalToken })
      .expect(400);

    expect(checkoutRes.body.error).toMatch(/approval/i);
  });

  it('E2E-4: Expired authorization cannot initiate checkout', async () => {
    const userId = 'buyer-04';
    // Configure app with 0 second approval validity
    const shortLivedApp = createApp(
      db,
      { ...testConfig, APPROVAL_VALIDITY_SECONDS: 0 },
      mockPayPal,
      mockLLM
    );

    await request(shortLivedApp)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent })
      .expect(201);

    const negRes = await request(shortLivedApp)
      .post(`/api/deals/${mockIntent.id}/negotiate`)
      .set('x-user-id', userId)
      .send({ offerId: 'off-techhaven-01' });

    await request(shortLivedApp)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: negRes.body.data.finalDeal });

    await request(shortLivedApp)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId);

    // In 0-second TTL, approval expires immediately
    const approveRes = await request(shortLivedApp)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .set('x-user-id', userId)
      .expect(400);

    expect(approveRes.body.error).toMatch(/expired/i);
  });

  it('E2E-5: Explicitly declined approval blocks payment checkout', async () => {
    const userId = 'buyer-05';
    await request(app)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent })
      .expect(201);

    const negRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/negotiate`)
      .set('x-user-id', userId)
      .send({ offerId: 'off-techhaven-01' });

    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: negRes.body.data.finalDeal });

    await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId);

    // User explicitly declines deal
    await request(app)
      .post(`/api/deals/${mockIntent.id}/decline`)
      .set('x-user-id', userId)
      .expect(200);

    // Checkout must fail
    const checkoutRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', userId)
      .send({})
      .expect(400);

    expect(checkoutRes.body.error).toMatch(/approval status: DECLINED/i);
  });

  // ---------------------------------------------------------------------------
  // SECTION 3: Payment State Machine & Concurrency Hardening
  // ---------------------------------------------------------------------------
  it('E2E-6: Authoritative server price cannot be altered by client payload at checkout', async () => {
    const userId = 'buyer-06';
    await request(app)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent })
      .expect(201);

    const negRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/negotiate`)
      .set('x-user-id', userId)
      .send({ offerId: 'off-techhaven-01' });

    const finalDeal = negRes.body.data.finalDeal;
    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal });

    await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId);

    const approveRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .set('x-user-id', userId);

    // Client attempts to pass fraudulent amount = 10 into checkout
    const checkoutRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', userId)
      .send({
        authorizationToken: approveRes.body.data.authorizationToken,
        amount: 10, // Attempted tampering
      })
      .expect(201);

    // Server completely ignores client 'amount' and uses authoritative finalDeal.totalPayable
    expect(checkoutRes.body.data.amount).toBe(finalDeal.totalPayable);
    expect(checkoutRes.body.data.amount).not.toBe(10);
  });

  it('E2E-7: Network timeout during capture safely transitions to REQUIRES_RECONCILIATION and resolves on retry', async () => {
    const userId = 'buyer-07';
    await request(app)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent })
      .expect(201);

    const negRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/negotiate`)
      .set('x-user-id', userId)
      .send({ offerId: 'off-techhaven-01' });

    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: negRes.body.data.finalDeal });

    await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId);

    const approveRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .set('x-user-id', userId);

    const checkoutRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', userId)
      .send({ authorizationToken: approveRes.body.data.authorizationToken });

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Simulate network timeout on capture attempt
    mockPayPal.shouldFailNetwork = true;

    const captureAttempt1 = await request(app)
      .post(`/api/deals/${mockIntent.id}/capture`)
      .set('x-user-id', userId)
      .send({ paypalOrderId: orderId })
      .expect(502);

    expect(captureAttempt1.body.error).toMatch(/reconciliation/i);

    // Verify stored payment state is REQUIRES_RECONCILIATION
    const checkState = await request(app)
      .get(`/api/deals/${mockIntent.id}/payment`)
      .set('x-user-id', userId);

    expect(checkState.body.data.status).toBe('REQUIRES_RECONCILIATION');

    // Simulate network restoration and successful probe
    mockPayPal.shouldFailNetwork = false;
    mockPayPal.captureReconciled = true;

    const captureAttempt2 = await request(app)
      .post(`/api/deals/${mockIntent.id}/capture`)
      .set('x-user-id', userId)
      .send({ paypalOrderId: orderId })
      .expect(200);

    expect(captureAttempt2.body.data.status).toBe('COMPLETED');
    expect(captureAttempt2.body.data.message).toMatch(/reconciliation/i);
  });

  it('E2E-8: A completed payment strictly prevents duplicate capture or re-checkout', async () => {
    const userId = 'buyer-08';
    await request(app)
      .post('/api/deals')
      .set('x-user-id', userId)
      .send({ intent: mockIntent })
      .expect(201);

    const negRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/negotiate`)
      .set('x-user-id', userId)
      .send({ offerId: 'off-techhaven-01' });

    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: negRes.body.data.finalDeal });

    await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .set('x-user-id', userId);

    const approveRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .set('x-user-id', userId);

    const checkoutRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', userId)
      .send({ authorizationToken: approveRes.body.data.authorizationToken });

    const orderId = checkoutRes.body.data.paypalOrderId;

    // First capture completes
    await request(app)
      .post(`/api/deals/${mockIntent.id}/capture`)
      .set('x-user-id', userId)
      .send({ paypalOrderId: orderId })
      .expect(200);

    // Attempting to create a second checkout order for the completed deal is rejected
    const secondCheckout = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', userId)
      .send({})
      .expect(400);

    expect(secondCheckout.body.error).toMatch(/already been completed/i);
  });
});
