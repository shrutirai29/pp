import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from '../src/db/sqliteAdapter.js';
import { initDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { EnvConfig, EnvSchema } from '../src/config/env.js';
import { UserIntent, FinalDeal } from '../src/schemas/dealSchemas.js';
import { PayPalClient, PayPalOrderParams, HttpPayPalClient } from '../src/services/paypalClient.js';
import { createSessionToken } from '../src/services/authService.js';

class MockPayPalClient implements PayPalClient {
  public isMock = true;
  public gatewayMode = 'mock_sandbox' as const;
  public orders = new Map<string, any>();
  public shouldFailNetwork = false;
  public simulateFailureStatus: string | null = null;
  public lastCreatedOrderParams: PayPalOrderParams | null = null;
  public captureReconciled = false;
  public overrideCaptureAmount?: number;
  public overrideCaptureCurrency?: string;

  async createOrder(params: PayPalOrderParams) {
    this.lastCreatedOrderParams = params;
    const orderId = `ORDER-MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
      amount: this.overrideCaptureAmount !== undefined ? this.overrideCaptureAmount : order.amount,
      currency: this.overrideCaptureCurrency !== undefined ? this.overrideCaptureCurrency : order.currency,
      payerEmail: 'sandbox-buyer@dealmind.example.com',
      payerId: 'PAYER-TEST-9988',
    };
  }

  async getOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('RESOURCE_NOT_FOUND');
    return {
      id: orderId,
      status: this.captureReconciled ? 'COMPLETED' : order.status,
      captureId: order.captureId || 'CAP-RECONCILED-123',
      amount: order.amount,
      currency: order.currency,
      payerEmail: 'sandbox-buyer@dealmind.example.com',
      payerId: 'PAYER-TEST-9988',
    };
  }
}

const testConfig: EnvConfig = {
  PORT: 4001,
  NODE_ENV: 'test',
  CORS_ORIGIN: '*',
  DATABASE_PATH: ':memory:',
  APPROVAL_VALIDITY_SECONDS: 900,
  TOKEN_HMAC_SECRET: 'test_hmac_secret_456',
  PAYPAL_CLIENT_ID: 'test_client_id_paypal_sandbox_123',
  PAYPAL_CLIENT_SECRET: 'super_secret_sandbox_key_shhh',
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
  id: 'deal-pp-001',
  rawQuery: 'Samsung 980 1TB SSD under $85, new condition, delivery in 3 days, no subscriptions.',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  maxBudget: 85,
  currency: 'USD',
  requiredCondition: 'new',
  maxDeliveryDays: 3,
  requiredWarrantyMonths: 12,
  prohibitSubscriptions: true,
  requireAllFeesIncluded: true,
  hardConstraints: ['budget', 'condition', 'delivery', 'no_subscription', 'warranty', 'all_fees_included'],
  flexiblePreferences: ['faster_shipping'],
  createdAt: '2026-10-30T10:00:00Z',
};

const mockValidFinalDeal: FinalDeal = {
  dealId: 'deal-pp-001',
  originalOfferId: 'off-techhaven-01',
  sellerId: 'off-techhaven-01',
  sellerName: 'PrimeTech Retail',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  condition: 'new',
  productPrice: 75,
  deliveryFee: 0,
  otherCharges: 0,
  totalPayable: 75,
  deliveryEstimateDays: 2,
  warrantyMonths: 12,
  hasSubscription: false,
  negotiationStatus: 'agreed',
  roundCount: 2,
  messages: [],
  isAcceptedBySeller: true,
  currency: 'USD',
  totalSaved: 10,
  stopReason: 'agreed',
};

describe('Phase 5: PayPal Sandbox Integration & IntentLock-Enforced Checkout', () => {
  let db: DatabaseSync;
  let mockPayPal: MockPayPalClient;
  let app: any;

  beforeEach(() => {
    db = initDatabase(':memory:');
    mockPayPal = new MockPayPalClient();
    app = createApp(db, testConfig, mockPayPal);
  });

  // Helper to setup a deal in human APPROVED state
  async function setupApprovedDeal(dealId: string = mockIntent.id, userId: string = 'user-alice') {
    // 1. Create deal
    await request(app)
      .post('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken(userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ intent: { ...mockIntent, id: dealId }, finalDeal: mockValidFinalDeal })
      .expect(201);

    // 2. Verify deal
    const verifRes = await request(app)
      .post(`/api/deals/${dealId}/verify`)
      .set('Authorization', 'Bearer ' + createSessionToken(userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ finalDeal: mockValidFinalDeal })
      .expect(200);

    // 3. Request approval
    const apprReqRes = await request(app)
      .post(`/api/deals/${dealId}/approval-request`)
      .set('Authorization', 'Bearer ' + createSessionToken(userId, testConfig.TOKEN_HMAC_SECRET))
      .expect(201);

    // 4. Human approves
    const apprRes = await request(app)
      .post(`/api/deals/${dealId}/approve`)
      .set('Authorization', 'Bearer ' + createSessionToken(userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ approvalId: apprReqRes.body.data.id, finalDeal: mockValidFinalDeal })
      .expect(200);

    return {
      dealId,
      userId,
      report: verifRes.body.data,
      approval: apprRes.body.data,
      authorizationToken: apprRes.body.data.authorizationToken,
    };
  }

  // 1. Checkout rejected for an unverified deal
  it('1. Checkout is rejected with 400 for an unverified deal', async () => {
    await request(app)
      .post('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
      .expect(201);

    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/IntentLock server verification/i);
  });

  // 2. Checkout rejected for a rejected deal
  it('2. Checkout is rejected with 400 for a deal rejected by IntentLock', async () => {
    const invalidFinalDeal: FinalDeal = {
      ...mockValidFinalDeal,
      totalPayable: 9999, // Exceeds budget 8000
      productPrice: 9999,
    };

    await request(app)
      .post('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({ intent: mockIntent, finalDeal: invalidFinalDeal })
      .expect(201);

    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({ finalDeal: invalidFinalDeal })
      .expect(200);

    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/IntentLock rejected/i);
  });

  // 3. Checkout rejected without human approval
  it('3. Checkout is rejected with 400 when human approval is missing', async () => {
    await request(app)
      .post('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
      .expect(201);

    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({ finalDeal: mockValidFinalDeal })
      .expect(200);

    // No approval request or approval granted
    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Explicit human approval is required/i);
  });

  // 4. Checkout rejected after approval expires
  it('4. Checkout is rejected with 400 after the human approval expires', async () => {
    const setup = await setupApprovedDeal();

    // Fast-forward expiration in DB
    db.prepare(`
      UPDATE approvals
      SET expires_at = '2020-01-01T00:00:00Z'
      WHERE deal_id = ?
    `).run(setup.dealId);

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Human approval has expired/i);
  });

  // 5. Checkout rejected after approved deal is modified (post-approval tampering)
  it('5. Checkout is rejected with 400 if deal terms are modified after approval', async () => {
    const setup = await setupApprovedDeal();

    // Attacker modifies price in the database
    const tamperedDeal: FinalDeal = {
      ...mockValidFinalDeal,
      totalPayable: 80, // modified price under budget
      productPrice: 80,
    };

    db.prepare(`
      UPDATE deals
      SET final_deal_json = ?
      WHERE id = ?
    `).run(JSON.stringify(tamperedDeal), setup.dealId);

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/terms were (modified|altered)/i);
  });

  // 6. Checkout rejected for another user's deal
  it("6. Checkout is rejected with 403 Forbidden when accessing another user's deal", async () => {
    const setup = await setupApprovedDeal(mockIntent.id, 'user-alice');

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-mallory', testConfig.TOKEN_HMAC_SECRET)) // Mallory tries to checkout Alice's deal
      .send({})
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Unauthorized: Deal belongs to another user/i);
  });

  // 7. Checkout rejected when the backend authorization token is invalid
  it('7. Checkout is rejected with 400 when an invalid authorization token is supplied', async () => {
    const setup = await setupApprovedDeal();

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: 'INVALID-FORGED-TOKEN-XYZ' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid authorization token/i);
  });

  // 8. Public PayPal configuration endpoint returns safe client config
  it('8. GET /api/config/paypal returns public sandbox client config without secrets', async () => {
    const res = await request(app).get('/api/config/paypal').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.clientId).toBe(testConfig.PAYPAL_CLIENT_ID);
    expect(res.body.data.env).toBe('sandbox');
    expect(res.body.data.clientSecret).toBeUndefined();
    expect(res.body.data.tokenHmacSecret).toBeUndefined();
  });

  // 9. Correct authoritative amount and currency sent to PayPal
  it('9. Sends authoritative server-persisted amount and currency to PayPal (ignoring client amount)', async () => {
    const setup = await setupApprovedDeal();

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.paypalOrderId).toBeDefined();
    expect(res.body.data.amount).toBe(mockValidFinalDeal.totalPayable);
    expect(res.body.data.currency).toBe(mockIntent.currency);

    // Verify PayPal client received authoritative values
    expect(mockPayPal.lastCreatedOrderParams).toBeDefined();
    expect(mockPayPal.lastCreatedOrderParams?.amount).toBe(mockValidFinalDeal.totalPayable);
  });

  // 10. PayPal order ID is persisted against the deal in SQLite
  it('10. Persists PayPal order ID and payment record in SQLite database', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Check payment record in SQLite
    const row = db.prepare('SELECT * FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
    expect(row).toBeDefined();
    expect(row.paypal_order_id).toBe(orderId);
    expect(row.status).toBe('ORDER_CREATED');
    expect(row.amount).toBe(mockValidFinalDeal.totalPayable);
  });

  // 11. Capture rejected for an unrelated order ID
  it('11. Capture is rejected with 403/404 for an unrelated order ID', async () => {
    const setup = await setupApprovedDeal();

    await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: 'UNRELATED-ORDER-99999' })
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  // 12. Capture rejected for another user's deal
  it("12. Capture is rejected with 403 Forbidden for another user's deal", async () => {
    const setup = await setupApprovedDeal(mockIntent.id, 'user-alice');

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-mallory', testConfig.TOKEN_HMAC_SECRET)) // Mallory tries to capture Alice's order
      .send({ paypalOrderId: orderId })
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  // 13. Capture rejected when authorization requirements are not met (declined approval)
  it('13. Capture is rejected if the approval status was declined', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Approval gets transitioned to DECLINED in DB
    db.prepare(`UPDATE approvals SET status = 'DECLINED' WHERE deal_id = ?`).run(setup.dealId);

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Approval status is DECLINED/i);
  });

  // 14. Successful Sandbox capture records confirmed status and consumes authorization
  it('14. Successful capture records COMPLETED status and atomically consumes authorization', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    const captureRes = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    expect(captureRes.body.success).toBe(true);
    expect(captureRes.body.data.status).toBe('COMPLETED');
    expect(captureRes.body.data.captureId).toBeDefined();

    // Verify approval token was atomically CONSUMED
    const approvalRow = db.prepare('SELECT * FROM approvals WHERE deal_id = ?').get(setup.dealId) as any;
    expect(approvalRow.status).toBe('CONSUMED');
    expect(approvalRow.consumed_at).toBeDefined();

    // Verify payment in SQLite is COMPLETED
    const paymentRow = db.prepare('SELECT * FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
    expect(paymentRow.status).toBe('COMPLETED');
    expect(paymentRow.paypal_capture_id).toBe(captureRes.body.data.captureId);

    // Verify deal status is payment_completed
    const dealRow = db.prepare('SELECT * FROM deals WHERE id = ?').get(setup.dealId) as any;
    expect(dealRow.status).toBe('payment_completed');
  });

  // 15. GET /api/deals/:id/payment returns accurate persisted payment state
  it('15. GET /api/deals/:id/payment returns persisted payment state for owner', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const res = await request(app)
      .get(`/api/deals/${setup.dealId}/payment`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.paypalOrderId).toBe(checkoutRes.body.data.paypalOrderId);
    expect(res.body.data.status).toBe('ORDER_CREATED');
  });

  // 16. Repeated capture requests do not create duplicate successful payments (idempotency)
  it('16. Repeated capture requests return existing COMPLETED status without re-capturing', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Capture 1
    const cap1 = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    const captureId1 = cap1.body.data.captureId;

    // Capture 2 (immediate repeat / network retry)
    const cap2 = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    expect(cap2.body.data.status).toBe('COMPLETED');
    expect(cap2.body.data.captureId).toBe(captureId1);
  });

  // 17. Network timeout during capture triggers safe reconciliation
  it('17. Network failure during capture marks REQUIRES_RECONCILIATION and reconciles against PayPal', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Simulate network timeout on capture, but order succeeds on PayPal side
    mockPayPal.shouldFailNetwork = true;
    mockPayPal.captureReconciled = true;

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  // 18. Failed or cancelled checkout records the correct state
  it('18. Cancelled checkout records CANCELLED state via POST /api/deals/:id/cancel-payment', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    await request(app)
      .post(`/api/deals/${setup.dealId}/cancel-payment`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    const paymentRow = db.prepare('SELECT * FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
    expect(paymentRow.status).toBe('CANCELLED');
  });

  // 19. Audit events are persisted for the payment lifecycle
  it('19. Audit events are persisted in SQLite for order creation and capture', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    const auditRes = await request(app)
      .get(`/api/deals/${setup.dealId}/audit`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .expect(200);

    const types = auditRes.body.data.map((e: any) => e.type);
    expect(types).toContain('paypal_order_created');
    expect(types).toContain('paypal_payment_completed');
  });

  // 20. A completed payment cannot be checked out again
  it('20. A completed payment cannot create another checkout order for the same deal', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Complete the payment
    await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    // Try to checkout again
    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Payment for this deal has already been completed/i);
  });

  // 21. User isolation applies to all payment operations
  it("21. User cannot view another user's payment records", async () => {
    const setup = await setupApprovedDeal(mockIntent.id, 'user-alice');

    await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const res = await request(app)
      .get(`/api/deals/${setup.dealId}/payment`)
      .set('Authorization', 'Bearer ' + createSessionToken('user-mallory', testConfig.TOKEN_HMAC_SECRET))
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  // 22. Missing or malformed PayPal configuration produces a safe error
  it('22. Missing or malformed PayPal configuration produces a safe error without secret leakage', async () => {
    const unconfiguredClient = new HttpPayPalClient('', '', 'https://api-m.sandbox.paypal.com');

    await expect(
      unconfiguredClient.createOrder({
        dealId: 'd1',
        referenceId: 'r1',
        description: 'desc',
        amount: 100,
        currency: 'USD',
      })
    ).rejects.toThrow(/PayPal credentials missing/);
  });

  // 23. PayPal API errors do not leak secrets
  it('23. HttpPayPalClient sanitizes client secrets from any error messages', () => {
    const client = new HttpPayPalClient(
      'CLIENT_ID_XYZ',
      'SUPER_SECRET_KEY_123',
      'https://invalid.domain.that.does.not.exist'
    );

    // Call private sanitize method through reflection / prototype test
    const sanitized = (client as any).sanitizeError(
      'Error occurred: secret was SUPER_SECRET_KEY_123 and id was CLIENT_ID_XYZ with Bearer abc.123.def'
    );

    expect(sanitized).not.toContain('SUPER_SECRET_KEY_123');
    expect(sanitized).toContain('***REDACTED_SECRET***');
    expect(sanitized).not.toContain('CLIENT_ID_XYZ');
    expect(sanitized).toContain('***REDACTED_CLIENT_ID***');
  });

  // 24. A deal whose price or currency changes after approval requires new verification and approval
  it('24. Changing price after approval strictly invalidates approval and blocks checkout', async () => {
    const setup = await setupApprovedDeal();

    // Mutate the price of the deal
    const priceChangedDeal: FinalDeal = {
      ...mockValidFinalDeal,
      totalPayable: 70, // price concession after approval
      productPrice: 70,
    };

    db.prepare('UPDATE deals SET final_deal_json = ? WHERE id = ?').run(
      JSON.stringify(priceChangedDeal),
      setup.dealId
    );

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/terms were (modified|altered)/i);
  });

  // 25. GET /api/deals lists only deals belonging to the authenticated user
  it("25. GET /api/deals returns only deals owned by the requesting session", async () => {
    // Alice creates 2 deals
    await request(app)
      .post('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({ intent: { ...mockIntent, id: 'deal-alice-1' } })
      .expect(201);

    await request(app)
      .post('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .send({ intent: { ...mockIntent, id: 'deal-alice-2' } })
      .expect(201);

    // Bob creates 1 deal
    await request(app)
      .post('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-bob', testConfig.TOKEN_HMAC_SECRET))
      .send({ intent: { ...mockIntent, id: 'deal-bob-1' } })
      .expect(201);

    // Alice requests her deals
    const aliceRes = await request(app)
      .get('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET))
      .expect(200);

    expect(aliceRes.body.success).toBe(true);
    expect(aliceRes.body.data).toHaveLength(2);
    expect(aliceRes.body.data.every((d: any) => d.userId === 'user-alice')).toBe(true);

    // Bob requests his deals
    const bobRes = await request(app)
      .get('/api/deals')
      .set('Authorization', 'Bearer ' + createSessionToken('user-bob', testConfig.TOKEN_HMAC_SECRET))
      .expect(200);

    expect(bobRes.body.success).toBe(true);
    expect(bobRes.body.data).toHaveLength(1);
    expect(bobRes.body.data[0].id).toBe('deal-bob-1');
  });

  // 26. Re-verifying a deal with modified terms invalidates prior approvals
  it('26. Re-verifying a deal with modified terms invalidates prior approvals', async () => {
    const setup = await setupApprovedDeal();

    // Re-verify with a modified final deal (lower price)
    const modifiedDeal: FinalDeal = {
      ...mockValidFinalDeal,
      productPrice: 6500,
      totalPayable: 6500,
      totalSaved: 1499,
    };

    await request(app)
      .post(`/api/deals/${setup.dealId}/verify`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ finalDeal: modifiedDeal })
      .expect(200);

    // Check approval status in SQLite: should be INVALIDATED
    const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(setup.approval.approvalId) as any;
    expect(row.status).toBe('INVALIDATED');
    expect(row.invalidation_reason).toMatch(/modified and re-verified/i);
  });

  // 27. Checkout rejects mathematically inconsistent totalPayable
  it('27. Checkout rejects mathematically inconsistent totalPayable', async () => {
    const setup = await setupApprovedDeal();

    // Corrupt math in final deal
    const corruptMathDeal: FinalDeal = {
      ...mockValidFinalDeal,
      productPrice: 5000,
      deliveryFee: 500,
      totalPayable: 7499, // 5000 + 500 != 7499
    };

    db.prepare('UPDATE deals SET final_deal_json = ? WHERE id = ?').run(
      JSON.stringify(corruptMathDeal),
      setup.dealId
    );

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/mathematically inconsistent/i);
  });

  // 28. Retrying capture on REQUIRES_RECONCILIATION status reconciles against PayPal
  it('28. Retrying capture on REQUIRES_RECONCILIATION queries PayPal and completes payment', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Simulate payment entering REQUIRES_RECONCILIATION state
    db.prepare(`
      UPDATE payments
      SET status = 'REQUIRES_RECONCILIATION'
      WHERE paypal_order_id = ?
    `).run(orderId);

    // Mock PayPal reports completed order
    mockPayPal.captureReconciled = true;

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');

    const paymentRow = db.prepare('SELECT * FROM payments WHERE paypal_order_id = ?').get(orderId) as any;
    expect(paymentRow.status).toBe('COMPLETED');
  });

  // 29. Rejects production startup if TOKEN_HMAC_SECRET is default demo secret
  it('29. Rejects configuration if TOKEN_HMAC_SECRET is default in production', () => {
    const result = EnvSchema.safeParse({
      NODE_ENV: 'production',
      TOKEN_HMAC_SECRET: 'dev_insecure_hmac_secret_for_demo_only',
    });

    expect(result.success).toBe(false);
  });

  // 30. Rejects checkout if deal currency is unsupported by PayPal (e.g., INR) and creates zero orders
  it('30. Rejects checkout if deal currency is unsupported by PayPal allowlist', async () => {
    const inrIntent: UserIntent = { ...mockIntent, id: 'deal-inr-fail', currency: 'INR', maxBudget: 8000 };
    const inrDeal: FinalDeal = { ...mockValidFinalDeal, dealId: 'deal-inr-fail', currency: 'INR', totalPayable: 7500, productPrice: 7500 };

    await request(app).post('/api/deals').set('Authorization', 'Bearer ' + createSessionToken('u1', testConfig.TOKEN_HMAC_SECRET)).send({ intent: inrIntent, finalDeal: inrDeal });
    await request(app).post(`/api/deals/${inrIntent.id}/verify`).set('Authorization', 'Bearer ' + createSessionToken('u1', testConfig.TOKEN_HMAC_SECRET)).expect(200);
    await request(app).post(`/api/deals/${inrIntent.id}/approval-request`).set('Authorization', 'Bearer ' + createSessionToken('u1', testConfig.TOKEN_HMAC_SECRET)).expect(201);

    const appRes = await request(app).post(`/api/deals/${inrIntent.id}/approve`).set('Authorization', 'Bearer ' + createSessionToken('u1', testConfig.TOKEN_HMAC_SECRET)).expect(200);
    const authToken = appRes.body.data.authorizationToken;

    const initialOrderCount = mockPayPal.orders.size;

    const res = await request(app)
      .post(`/api/deals/${inrIntent.id}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken('u1', testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: authToken })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Currency 'INR' is not supported by PayPal/i);

    // Verify PayPal client was NEVER invoked and zero orders created
    expect(mockPayPal.orders.size).toBe(initialOrderCount);
  });

  // 31. HttpPayPalClient throws on unsupported currency without silent USD substitution
  it('31. HttpPayPalClient rejects unsupported currency without silent fallback to USD', async () => {
    const client = new HttpPayPalClient('fake_client_id', 'fake_secret', 'https://api-m.sandbox.paypal.com');

    await expect(
      client.createOrder({
        dealId: 'd-test',
        referenceId: 'ref-test',
        description: 'Test order',
        amount: 5000,
        currency: 'INR',
      })
    ).rejects.toThrow(/PayPal currency safety error: 'INR' is not supported by PayPal REST API/i);
  });

  // 32. Reconciliation rejects when PayPal returns a mismatched currency or amount
  it('32. Reconciliation strictly rejects when PayPal reports mismatched currency or amount', async () => {
    const setup = await setupApprovedDeal();
    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Put payment in REQUIRES_RECONCILIATION
    db.prepare(`UPDATE payments SET status = 'REQUIRES_RECONCILIATION' WHERE paypal_order_id = ?`).run(orderId);

    // Corrupt currency in PayPal mock to EUR while deal is USD
    mockPayPal.orders.set(orderId, {
      ...mockPayPal.orders.get(orderId),
      status: 'COMPLETED',
      currency: 'EUR',
      amount: 75,
    });
    mockPayPal.captureReconciled = true;

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Reconciliation security failure: PayPal order currency 'EUR' does not match/i);
  });

  // 33. Prohibits production PayPal endpoints in demo configuration and HttpPayPalClient
  it('33. Prohibits production PayPal base URL at configuration and client initialization', () => {
    // EnvSchema rejects live PayPal endpoint
    const envRes = EnvSchema.safeParse({
      PAYPAL_BASE_URL: 'https://api-m.paypal.com',
    });
    expect(envRes.success).toBe(false);

    // HttpPayPalClient rejects live PayPal endpoint
    expect(
      () => new HttpPayPalClient('client_id', 'client_secret', 'https://api-m.paypal.com')
    ).toThrow(/Production PayPal base URL is strictly prohibited/i);
  });

  // 34. capturePayment rejects if deal is tampered post-checkout initiation
  it('34. capturePayment strictly rejects if deal terms are tampered after checkout initiation', async () => {
    const setup = await setupApprovedDeal();
    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Tamper with the deal productPrice directly in the database
    const tamperedFinalDeal = {
      ...mockValidFinalDeal,
      productPrice: 999,
      totalPayable: 999,
    };
    db.prepare(`UPDATE deals SET final_deal_json = ? WHERE id = ?`).run(
      JSON.stringify(tamperedFinalDeal),
      setup.dealId
    );

    const captureRes = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(400);

    expect(captureRes.body.success).toBe(false);
    expect(captureRes.body.error).toMatch(
      /exceeds authorized user budget ceiling|modified after verification|altered after approval|Payment record mismatch/i
    );
  });

  // 35. capturePayment rejects if PayPal returns an amount or currency differing from approved deal
  it('35. capturePayment rejects if PayPal capture returns mismatched currency or amount', async () => {
    const setup = await setupApprovedDeal();
    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Override mock capture to return EUR instead of USD
    mockPayPal.overrideCaptureCurrency = 'EUR';

    const captureRes = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: orderId })
      .expect(400);

    expect(captureRes.body.success).toBe(false);
    expect(captureRes.body.error).toMatch(/Capture security failure: PayPal captured currency 'EUR'/i);

    // Verify payment record entered REQUIRES_RECONCILIATION and preserved the capture ID (never orphaned)
    const paymentInDb = db.prepare('SELECT * FROM payments WHERE paypal_order_id = ?').get(orderId) as any;
    expect(paymentInDb.status).toBe('REQUIRES_RECONCILIATION');
    expect(paymentInDb.paypal_capture_id).toBeDefined();
    expect(paymentInDb.paypal_capture_id).toMatch(/^CAP-/);

    // Verify deal was NOT marked completed
    const dealInDb = db.prepare('SELECT * FROM deals WHERE id = ?').get(setup.dealId) as any;
    expect(dealInDb.status).not.toBe('payment_completed');

    // Reset override
    mockPayPal.overrideCaptureCurrency = undefined;
  });

  // 35b. Minor unit precision enforces exact match without arbitrary tolerance drift
  it('35b. Precision comparison rejects 1-cent drift and respects zero-decimal minor units', async () => {
    const { isAmountEqual } = await import('../src/config/currencies.js');

    // USD (2 decimal places)
    expect(isAmountEqual(68.00, 68.00, 'USD')).toBe(true);
    expect(isAmountEqual(68.00, 68.01, 'USD')).toBe(false); // 1 cent difference rejected!
    expect(isAmountEqual(68.00, 67.99, 'USD')).toBe(false);

    // JPY (0 decimal places)
    expect(isAmountEqual(5000, 5000, 'JPY')).toBe(true);
    expect(isAmountEqual(5000, 5001, 'JPY')).toBe(false); // 1 yen difference rejected!
  });

  // 36. Checkout and capture identify mock mode and label simulation in response and audit trail
  it('36. Mock checkout and capture explicitly flag simulation mode in payload and audit trail', async () => {
    const setup = await setupApprovedDeal();
    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    expect(checkoutRes.body.data.isSimulated).toBe(true);
    expect(checkoutRes.body.data.gatewayMode).toBe('mock_sandbox');

    const captureRes = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .send({ paypalOrderId: checkoutRes.body.data.paypalOrderId })
      .expect(200);

    expect(captureRes.body.data.isSimulated).toBe(true);
    expect(captureRes.body.data.gatewayMode).toBe('mock_sandbox');

    // Verify audit logs contain simulated mock labels
    const auditRes = await request(app)
      .get(`/api/deals/${setup.dealId}/audit`)
      .set('Authorization', 'Bearer ' + createSessionToken(setup.userId, testConfig.TOKEN_HMAC_SECRET))
      .expect(200);

    const orderEvent = auditRes.body.data.find((e: any) => e.type === 'paypal_order_created');
    expect(orderEvent).toBeDefined();
    expect(orderEvent.title).toContain('[SIMULATED MOCK]');

    const captureEvent = auditRes.body.data.find((e: any) => e.type === 'paypal_payment_completed');
    expect(captureEvent).toBeDefined();
    expect(captureEvent.title).toContain('[SIMULATED MOCK]');
  });

  // 37. Production mode strictly rejects mock client fallback when credentials are empty
  it('37. Production mode strictly rejects mock PayPal client when credentials are not configured', () => {
    const prodConfig: EnvConfig = {
      ...testConfig,
      NODE_ENV: 'production',
      PAYPAL_CLIENT_ID: '',
      PAYPAL_CLIENT_SECRET: '',
    };

    expect(() => createApp(db, prodConfig)).toThrow(
      /Production configuration error: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required in production/i
    );
  });
});
