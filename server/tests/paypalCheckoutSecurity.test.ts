import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from '../src/db/sqliteAdapter.js';
import { initDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { EnvConfig } from '../src/config/env.js';
import { UserIntent, FinalDeal } from '../src/schemas/dealSchemas.js';
import { PayPalClient, PayPalOrderParams, HttpPayPalClient } from '../src/services/paypalClient.js';

class MockPayPalClient implements PayPalClient {
  public orders = new Map<string, any>();
  public shouldFailNetwork = false;
  public simulateFailureStatus: string | null = null;
  public lastCreatedOrderParams: PayPalOrderParams | null = null;
  public captureReconciled = false;

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
};

const mockIntent: UserIntent = {
  id: 'deal-pp-001',
  rawQuery: 'Samsung 980 1TB SSD under ₹8,000, new condition, delivery in 3 days, no subscriptions.',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  maxBudget: 8000,
  currency: 'INR',
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
  productPrice: 7499,
  deliveryFee: 0,
  otherCharges: 0,
  totalPayable: 7499,
  deliveryEstimateDays: 2,
  warrantyMonths: 12,
  hasSubscription: false,
  negotiationStatus: 'agreed',
  roundCount: 2,
  messages: [],
  isAcceptedBySeller: true,
  currency: 'INR',
  totalSaved: 500,
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
      .set('x-user-id', userId)
      .send({ intent: { ...mockIntent, id: dealId }, finalDeal: mockValidFinalDeal })
      .expect(201);

    // 2. Verify deal
    const verifRes = await request(app)
      .post(`/api/deals/${dealId}/verify`)
      .set('x-user-id', userId)
      .send({ finalDeal: mockValidFinalDeal })
      .expect(200);

    // 3. Request approval
    const apprReqRes = await request(app)
      .post(`/api/deals/${dealId}/approval-request`)
      .set('x-user-id', userId)
      .expect(201);

    // 4. Human approves
    const apprRes = await request(app)
      .post(`/api/deals/${dealId}/approve`)
      .set('x-user-id', userId)
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
      .set('x-user-id', 'user-alice')
      .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
      .expect(201);

    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', 'user-alice')
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
      .set('x-user-id', 'user-alice')
      .send({ intent: mockIntent, finalDeal: invalidFinalDeal })
      .expect(201);

    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', 'user-alice')
      .send({ finalDeal: invalidFinalDeal })
      .expect(200);

    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', 'user-alice')
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/IntentLock rejected/i);
  });

  // 3. Checkout rejected without human approval
  it('3. Checkout is rejected with 400 when human approval is missing', async () => {
    await request(app)
      .post('/api/deals')
      .set('x-user-id', 'user-alice')
      .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
      .expect(201);

    await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set('x-user-id', 'user-alice')
      .send({ finalDeal: mockValidFinalDeal })
      .expect(200);

    // No approval request or approval granted
    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/checkout`)
      .set('x-user-id', 'user-alice')
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
      .set('x-user-id', setup.userId)
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
      totalPayable: 7999, // modified price
      productPrice: 7999,
    };

    db.prepare(`
      UPDATE deals
      SET final_deal_json = ?
      WHERE id = ?
    `).run(JSON.stringify(tamperedDeal), setup.dealId);

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', 'user-mallory') // Mallory tries to checkout Alice's deal
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
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
      .send({ paypalOrderId: 'UNRELATED-ORDER-99999' })
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  // 12. Capture rejected for another user's deal
  it("12. Capture is rejected with 403 Forbidden for another user's deal", async () => {
    const setup = await setupApprovedDeal(mockIntent.id, 'user-alice');

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', 'user-mallory') // Mallory tries to capture Alice's order
      .send({ paypalOrderId: orderId })
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  // 13. Capture rejected when authorization requirements are not met (declined approval)
  it('13. Capture is rejected if the approval status was declined', async () => {
    const setup = await setupApprovedDeal();

    const checkoutRes = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Approval gets transitioned to DECLINED in DB
    db.prepare(`UPDATE approvals SET status = 'DECLINED' WHERE deal_id = ?`).run(setup.dealId);

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    const captureRes = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const res = await request(app)
      .get(`/api/deals/${setup.dealId}/payment`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Capture 1
    const cap1 = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
      .send({ paypalOrderId: orderId })
      .expect(200);

    const captureId1 = cap1.body.data.captureId;

    // Capture 2 (immediate repeat / network retry)
    const cap2 = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Simulate network timeout on capture, but order succeeds on PayPal side
    mockPayPal.shouldFailNetwork = true;
    mockPayPal.captureReconciled = true;

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    await request(app)
      .post(`/api/deals/${setup.dealId}/cancel-payment`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
      .send({ paypalOrderId: orderId })
      .expect(200);

    const auditRes = await request(app)
      .get(`/api/deals/${setup.dealId}/audit`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const orderId = checkoutRes.body.data.paypalOrderId;

    // Complete the payment
    await request(app)
      .post(`/api/deals/${setup.dealId}/capture`)
      .set('x-user-id', setup.userId)
      .send({ paypalOrderId: orderId })
      .expect(200);

    // Try to checkout again
    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('x-user-id', setup.userId)
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
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(201);

    const res = await request(app)
      .get(`/api/deals/${setup.dealId}/payment`)
      .set('x-user-id', 'user-mallory')
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
      totalPayable: 6999, // price concession after approval
      productPrice: 6999,
    };

    db.prepare('UPDATE deals SET final_deal_json = ? WHERE id = ?').run(
      JSON.stringify(priceChangedDeal),
      setup.dealId
    );

    const res = await request(app)
      .post(`/api/deals/${setup.dealId}/checkout`)
      .set('x-user-id', setup.userId)
      .send({ authorizationToken: setup.authorizationToken })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/terms were (modified|altered)/i);
  });
});
