import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from '../src/db/sqliteAdapter.js';
import { initDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { EnvConfig } from '../src/config/env.js';
import { UserIntent, FinalDeal } from '../src/schemas/dealSchemas.js';
import { PayPalClient, PayPalOrderParams, PayPalCaptureResult } from '../src/services/paypalClient.js';
import { createSessionToken } from '../src/services/authService.js';

class MockCapturePayPalClient implements PayPalClient {
  public isMock = true;
  public gatewayMode = 'mock_sandbox' as const;
  public orders = new Map<string, any>();
  public captureResultOverride?: Partial<PayPalCaptureResult>;

  async createOrder(params: PayPalOrderParams) {
    const orderId = `ORDER-AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.orders.set(orderId, {
      id: orderId,
      amount: params.amount,
      currency: params.currency,
      status: 'APPROVED',
    });
    return {
      id: orderId,
      status: 'CREATED',
      links: [{ rel: 'approve', href: 'https://sandbox.paypal.com/mock' }],
    };
  }

  async captureOrder(orderId: string): Promise<PayPalCaptureResult> {
    const order = this.orders.get(orderId);
    if (this.captureResultOverride) {
      return {
        id: orderId,
        status: 'COMPLETED',
        captureId: 'CAP-AUDIT-DEFAULT',
        amount: order?.amount ?? 74,
        currency: order?.currency ?? 'USD',
        ...this.captureResultOverride,
      };
    }
    return {
      id: orderId,
      status: 'COMPLETED',
      captureId: `CAP-AUDIT-${Date.now()}`,
      amount: order?.amount ?? 74,
      currency: order?.currency ?? 'USD',
      payerEmail: 'audit-buyer@dealmind.example.com',
    };
  }

  async getOrder(orderId: string): Promise<PayPalCaptureResult> {
    return this.captureOrder(orderId);
  }
}

const testConfig: EnvConfig = {
  PORT: 4005,
  NODE_ENV: 'test',
  CORS_ORIGIN: '*',
  DATABASE_PATH: ':memory:',
  APPROVAL_VALIDITY_SECONDS: 900,
  TOKEN_HMAC_SECRET: 'audit_test_hmac_secret_key_789',
  PAYPAL_CLIENT_ID: 'mock_client_id',
  PAYPAL_CLIENT_SECRET: 'mock_client_secret',
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
  id: 'deal-audit-001',
  rawQuery: 'Samsung 980 1TB SSD under $85, new, 3 days delivery.',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  maxBudget: 85,
  currency: 'USD',
  requiredCondition: 'new',
  maxDeliveryDays: 3,
  requiredWarrantyMonths: 12,
  prohibitSubscriptions: true,
  requireAllFeesIncluded: true,
  hardConstraints: ['budget', 'condition', 'delivery', 'no_subscription', 'warranty'],
  flexiblePreferences: ['seller_rating'],
  createdAt: '2026-10-30T10:00:00Z',
};

const mockValidFinalDeal: FinalDeal = {
  dealId: 'deal-audit-001',
  originalOfferId: 'off-audit-01',
  sellerId: 'sel-audit-01',
  sellerName: 'Apex Memory Official',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  condition: 'new',
  productPrice: 70,
  deliveryFee: 4,
  otherCharges: 0,
  totalPayable: 74,
  deliveryEstimateDays: 2,
  warrantyMonths: 60,
  hasSubscription: false,
  negotiationStatus: 'agreed',
  roundCount: 2,
  messages: [],
  isAcceptedBySeller: true,
  currency: 'USD',
  totalSaved: 11,
  stopReason: 'agreed',
};

describe('Targeted Security-Hardening Audit Verification Suite', () => {
  let db: DatabaseSync;
  let mockPayPal: MockCapturePayPalClient;
  let app: ReturnType<typeof createApp>;

  const authHeader = (userId: string, secret = testConfig.TOKEN_HMAC_SECRET) => ({
    Authorization: `Bearer ${createSessionToken(userId, secret)}`,
  });

  beforeEach(() => {
    db = initDatabase(':memory:');
    mockPayPal = new MockCapturePayPalClient();
    app = createApp(db, testConfig, mockPayPal);
  });

  async function setupApprovedDeal(dealId: string = mockIntent.id, userId: string = 'user-alice') {
    await request(app)
      .post('/api/deals')
      .set(authHeader(userId))
      .send({ intent: { ...mockIntent, id: dealId }, finalDeal: mockValidFinalDeal })
      .expect(201);

    await request(app)
      .post(`/api/deals/${dealId}/verify`)
      .set(authHeader(userId))
      .send({ finalDeal: mockValidFinalDeal })
      .expect(200);

    const apprReq = await request(app)
      .post(`/api/deals/${dealId}/approval-request`)
      .set(authHeader(userId))
      .expect(201);

    const approveRes = await request(app)
      .post(`/api/deals/${dealId}/approve`)
      .set(authHeader(userId))
      .send({ approvalId: apprReq.body.data.id, finalDeal: mockValidFinalDeal })
      .expect(200);

    return {
      dealId,
      userId,
      authorizationToken: approveRes.body.data.authorizationToken as string,
    };
  }

  // ===========================================================================
  // Priority 1: Fix identity authentication
  // ===========================================================================
  describe('Priority 1: Identity Authentication Hardening', () => {
    it('1. Rejects arbitrary client-supplied identity header (x-user-id) when no valid signed token is provided', async () => {
      const res = await request(app)
        .post('/api/deals')
        .set('x-user-id', 'attacker-alice')
        .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/arbitrary client identity headers.*untrusted/i);
    });

    it('2. Rejects request when x-user-id contradicts verified token payload', async () => {
      const legitToken = createSessionToken('legit-user', testConfig.TOKEN_HMAC_SECRET);
      const res = await request(app)
        .post('/api/deals')
        .set('Authorization', `Bearer ${legitToken}`)
        .set('x-user-id', 'impersonated-user')
        .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
        .expect(401);

      expect(res.body.error).toMatch(/identity header mismatch/i);
    });

    it('3. Rejects session token with forged or invalid signature', async () => {
      const forgedToken = createSessionToken('user-alice', 'wrong_fake_secret_key');
      const res = await request(app)
        .post('/api/deals')
        .set('Authorization', `Bearer ${forgedToken}`)
        .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
        .expect(401);

      expect(res.body.error).toMatch(/invalid.*signature/i);
    });

    it('4. Rejects session token that has expired', async () => {
      const expiredToken = createSessionToken('user-alice', testConfig.TOKEN_HMAC_SECRET, -60);
      const res = await request(app)
        .post('/api/deals')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
        .expect(401);

      expect(res.body.error).toMatch(/expired/i);
    });

    it('5. In production mode, rejects unauthenticated requests on protected endpoints', async () => {
      const prodConfig: EnvConfig = { ...testConfig, NODE_ENV: 'production' };
      const prodApp = createApp(db, prodConfig, mockPayPal);

      const res = await request(prodApp)
        .post('/api/deals')
        .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
        .expect(401);

      expect(res.body.error).toMatch(/unauthorized.*authentication token/i);
    });

    it('6. Cross-user isolation: User Bob cannot access or modify User Alice’s deal', async () => {
      await request(app)
        .post('/api/deals')
        .set(authHeader('user-alice'))
        .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
        .expect(201);

      // Bob attempts to verify Alice's deal
      const res = await request(app)
        .post(`/api/deals/${mockIntent.id}/verify`)
        .set(authHeader('user-bob'))
        .send({ finalDeal: mockValidFinalDeal })
        .expect(403);

      expect(res.body.error).toMatch(/unauthorized access/i);
    });
  });

  // ===========================================================================
  // Priority 2: Remove payment completion bypass
  // ===========================================================================
  describe('Priority 2: Payment Completion Bypass Elimination', () => {
    it('7. Calling POST /api/deals/:id/consume-authorization returns 403 Forbidden', async () => {
      const setup = await setupApprovedDeal();
      const res = await request(app)
        .post(`/api/deals/${setup.dealId}/consume-authorization`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(403);

      expect(res.body.error).toMatch(/bypass is permanently disabled/i);
    });

    it('8. Calling consume-authorization CANNOT update deal status to payment_completed', async () => {
      const setup = await setupApprovedDeal();

      await request(app)
        .post(`/api/deals/${setup.dealId}/consume-authorization`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(403);

      // Verify database deal status was NOT altered
      const dealRecord = db.prepare('SELECT status FROM deals WHERE id = ?').get(setup.dealId) as any;
      expect(dealRecord.status).not.toBe('payment_completed');

      // Verify no payments table entries were generated
      const payments = db.prepare('SELECT * FROM payments WHERE deal_id = ?').all(setup.dealId);
      expect(payments.length).toBe(0);
    });
  });

  // ===========================================================================
  // Priority 3: Require authorization token
  // ===========================================================================
  describe('Priority 3: Mandatory Cryptographic Authorization Token', () => {
    it('9. Checkout initiation strictly rejects when authorizationToken is omitted', async () => {
      const setup = await setupApprovedDeal();

      const res = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({})
        .expect(400);

      expect(res.body.error).toMatch(/authorization token is mandatory/i);
    });

    it('10. Checkout initiation strictly rejects invalid or mismatched authorization token hash', async () => {
      const setup = await setupApprovedDeal();

      const res = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: 'INVALID-TAMPERED-TOKEN-XYZ' })
        .expect(400);

      expect(res.body.error).toMatch(/invalid authorization token/i);
    });

    it('11. Checkout initiation rejects authorization token belonging to a different user', async () => {
      const setup = await setupApprovedDeal();

      const res = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader('attacker-mallory'))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(403);

      expect(res.body.error).toMatch(/belongs to another user/i);
    });

    it('12. Checkout initiation rejects if human approval is expired', async () => {
      const setup = await setupApprovedDeal();

      // Backdate approval expiration in SQLite
      db.prepare("UPDATE approvals SET expires_at = '2020-01-01T00:00:00Z' WHERE deal_id = ?").run(setup.dealId);

      const res = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(400);

      expect(res.body.error).toMatch(/expired/i);
    });

    it('13. Checkout initiation rejects reused / already consumed approval tokens with 409', async () => {
      const setup = await setupApprovedDeal();

      // Mark approval as CONSUMED in database
      db.prepare("UPDATE approvals SET status = 'CONSUMED' WHERE deal_id = ?").run(setup.dealId);

      const res = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(409);

      expect(res.body.error).toMatch(/already been consumed/i);
    });

    it('14. Checkout initiation rejects if deal terms are modified after human approval', async () => {
      const setup = await setupApprovedDeal();

      // Tamper deal in database (mathematically consistent, but altering agreed price from 74 to 84)
      db.prepare("UPDATE deals SET final_deal_json = ? WHERE id = ?").run(
        JSON.stringify({ ...mockValidFinalDeal, productPrice: 80, totalPayable: 84 }),
        setup.dealId
      );

      const res = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(400);

      expect(res.body.error).toMatch(/terms were (altered|modified) after/i);
    });
  });

  // ===========================================================================
  // Priority 4: Strengthen PayPal capture validation
  // ===========================================================================
  describe('Priority 4: Strict PayPal Capture Response Validation', () => {
    it('15. Capture fails and transitions to REQUIRES_RECONCILIATION if PayPal response is missing captureId', async () => {
      const setup = await setupApprovedDeal();
      const checkoutRes = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(201);

      mockPayPal.captureResultOverride = { captureId: '' }; // Missing capture ID

      const captureRes = await request(app)
        .post(`/api/deals/${setup.dealId}/capture`)
        .set(authHeader(setup.userId))
        .send({ paypalOrderId: checkoutRes.body.data.paypalOrderId })
        .expect(400);

      expect(captureRes.body.error).toMatch(/missing a valid capture ID/i);

      // Verify payment was quarantined in REQUIRES_RECONCILIATION
      const payment = db.prepare('SELECT status, error_message FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
      expect(payment.status).toBe('REQUIRES_RECONCILIATION');
      expect(payment.error_message).toMatch(/missing a valid capture ID/i);
    });

    it('16. Capture fails and transitions to REQUIRES_RECONCILIATION if PayPal response is missing amount', async () => {
      const setup = await setupApprovedDeal();
      const checkoutRes = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(201);

      mockPayPal.captureResultOverride = { amount: undefined };

      const captureRes = await request(app)
        .post(`/api/deals/${setup.dealId}/capture`)
        .set(authHeader(setup.userId))
        .send({ paypalOrderId: checkoutRes.body.data.paypalOrderId })
        .expect(400);

      expect(captureRes.body.error).toMatch(/missing an explicit captured amount/i);

      const payment = db.prepare('SELECT status FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
      expect(payment.status).toBe('REQUIRES_RECONCILIATION');
    });

    it('17. Capture fails and transitions to REQUIRES_RECONCILIATION if PayPal response is missing currency', async () => {
      const setup = await setupApprovedDeal();
      const checkoutRes = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(201);

      mockPayPal.captureResultOverride = { currency: '' };

      const captureRes = await request(app)
        .post(`/api/deals/${setup.dealId}/capture`)
        .set(authHeader(setup.userId))
        .send({ paypalOrderId: checkoutRes.body.data.paypalOrderId })
        .expect(400);

      expect(captureRes.body.error).toMatch(/missing an explicit captured currency/i);

      const payment = db.prepare('SELECT status FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
      expect(payment.status).toBe('REQUIRES_RECONCILIATION');
    });

    it('18. Capture fails and transitions to REQUIRES_RECONCILIATION if captured amount mismatches authorized terms', async () => {
      const setup = await setupApprovedDeal();
      const checkoutRes = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(201);

      mockPayPal.captureResultOverride = { amount: 99.0 }; // Mismatch (expected 74)

      const captureRes = await request(app)
        .post(`/api/deals/${setup.dealId}/capture`)
        .set(authHeader(setup.userId))
        .send({ paypalOrderId: checkoutRes.body.data.paypalOrderId })
        .expect(400);

      expect(captureRes.body.error).toMatch(/PayPal captured amount '99' does not match/i);

      const payment = db.prepare('SELECT status FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
      expect(payment.status).toBe('REQUIRES_RECONCILIATION');
    });

    it('19. Capture fails and transitions to REQUIRES_RECONCILIATION if captured currency mismatches authorized terms', async () => {
      const setup = await setupApprovedDeal();
      const checkoutRes = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(201);

      mockPayPal.captureResultOverride = { currency: 'EUR' }; // Mismatch (expected USD)

      const captureRes = await request(app)
        .post(`/api/deals/${setup.dealId}/capture`)
        .set(authHeader(setup.userId))
        .send({ paypalOrderId: checkoutRes.body.data.paypalOrderId })
        .expect(400);

      expect(captureRes.body.error).toMatch(/PayPal captured currency 'EUR' does not match/i);

      const payment = db.prepare('SELECT status FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
      expect(payment.status).toBe('REQUIRES_RECONCILIATION');
    });

    it('20. Capture fails and transitions to REQUIRES_RECONCILIATION if PayPal status is non-completed (e.g. PENDING)', async () => {
      const setup = await setupApprovedDeal();
      const checkoutRes = await request(app)
        .post(`/api/deals/${setup.dealId}/checkout`)
        .set(authHeader(setup.userId))
        .send({ authorizationToken: setup.authorizationToken })
        .expect(201);

      mockPayPal.captureResultOverride = { status: 'PENDING' };

      const captureRes = await request(app)
        .post(`/api/deals/${setup.dealId}/capture`)
        .set(authHeader(setup.userId))
        .send({ paypalOrderId: checkoutRes.body.data.paypalOrderId })
        .expect(400);

      expect(captureRes.body.error).toMatch(/PayPal capture status is 'PENDING'/i);

      const payment = db.prepare('SELECT status FROM payments WHERE deal_id = ?').get(setup.dealId) as any;
      expect(payment.status).toBe('REQUIRES_RECONCILIATION');
    });
  });
});
