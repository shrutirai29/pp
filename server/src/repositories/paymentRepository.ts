import { DatabaseSync } from '../db/sqliteAdapter.js';

export type PaymentStatus =
  | 'NOT_STARTED'
  | 'ORDER_CREATED'
  | 'BUYER_APPROVED'
  | 'CAPTURE_PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REQUIRES_RECONCILIATION';

export interface StoredPayment {
  id: string;
  dealId: string;
  userId: string;
  approvalId: string;
  paypalOrderId: string;
  paypalCaptureId: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  idempotencyKey: string | null;
  payerEmail: string | null;
  payerId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export class PaymentRepository {
  constructor(private db: DatabaseSync) {}

  public createPayment(params: {
    id: string;
    dealId: string;
    userId: string;
    approvalId: string;
    paypalOrderId: string;
    amount: number;
    currency: string;
    idempotencyKey?: string;
  }): StoredPayment {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO payments (
        id, deal_id, user_id, approval_id, paypal_order_id, paypal_capture_id,
        status, amount, currency, idempotency_key, payer_email, payer_id,
        error_message, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, NULL, 'ORDER_CREATED', ?, ?, ?, NULL, NULL, NULL, ?, ?)
    `);

    stmt.run(
      params.id,
      params.dealId,
      params.userId,
      params.approvalId,
      params.paypalOrderId,
      params.amount,
      params.currency,
      params.idempotencyKey || null,
      now,
      now
    );

    return {
      id: params.id,
      dealId: params.dealId,
      userId: params.userId,
      approvalId: params.approvalId,
      paypalOrderId: params.paypalOrderId,
      paypalCaptureId: null,
      status: 'ORDER_CREATED',
      amount: params.amount,
      currency: params.currency,
      idempotencyKey: params.idempotencyKey || null,
      payerEmail: null,
      payerId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  public getPaymentByDealId(dealId: string): StoredPayment | null {
    const stmt = this.db.prepare(`
      SELECT * FROM payments WHERE deal_id = ? ORDER BY created_at DESC LIMIT 1
    `);
    const row = stmt.get(dealId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public getPaymentByOrderId(orderId: string): StoredPayment | null {
    const stmt = this.db.prepare(`
      SELECT * FROM payments WHERE paypal_order_id = ?
    `);
    const row = stmt.get(orderId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public getPaymentById(id: string): StoredPayment | null {
    const stmt = this.db.prepare(`
      SELECT * FROM payments WHERE id = ?
    `);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public updateStatus(
    id: string,
    status: PaymentStatus,
    options?: {
      captureId?: string;
      errorMessage?: string;
      payerEmail?: string;
      payerId?: string;
    }
  ): boolean {
    const now = new Date().toISOString();
    const current = this.getPaymentById(id);
    if (!current) return false;

    const captureId = options?.captureId !== undefined ? options.captureId : current.paypalCaptureId;
    const errorMessage = options?.errorMessage !== undefined ? options.errorMessage : current.errorMessage;
    const payerEmail = options?.payerEmail !== undefined ? options.payerEmail : current.payerEmail;
    const payerId = options?.payerId !== undefined ? options.payerId : current.payerId;

    const stmt = this.db.prepare(`
      UPDATE payments
      SET status = ?, paypal_capture_id = ?, error_message = ?, payer_email = ?, payer_id = ?, updated_at = ?
      WHERE id = ?
    `);

    const info = stmt.run(status, captureId, errorMessage, payerEmail, payerId, now, id);
    return Number(info.changes) > 0;
  }

  /**
   * Atomic transition: updates status only if current status equals expectedCurrentStatus.
   * Prevents race conditions during simultaneous capture requests.
   */
  public atomicTransitionStatus(
    id: string,
    expectedCurrentStatus: PaymentStatus,
    newStatus: PaymentStatus,
    options?: {
      captureId?: string;
      errorMessage?: string;
      payerEmail?: string;
      payerId?: string;
    }
  ): boolean {
    const now = new Date().toISOString();
    const current = this.getPaymentById(id);
    if (!current) return false;

    const captureId = options?.captureId !== undefined ? options.captureId : current.paypalCaptureId;
    const errorMessage = options?.errorMessage !== undefined ? options.errorMessage : current.errorMessage;
    const payerEmail = options?.payerEmail !== undefined ? options.payerEmail : current.payerEmail;
    const payerId = options?.payerId !== undefined ? options.payerId : current.payerId;

    const stmt = this.db.prepare(`
      UPDATE payments
      SET status = ?, paypal_capture_id = ?, error_message = ?, payer_email = ?, payer_id = ?, updated_at = ?
      WHERE id = ? AND status = ?
    `);

    const info = stmt.run(newStatus, captureId, errorMessage, payerEmail, payerId, now, id, expectedCurrentStatus);
    return Number(info.changes) > 0;
  }

  private mapRow(row: Record<string, unknown>): StoredPayment {
    return {
      id: String(row.id),
      dealId: String(row.deal_id),
      userId: String(row.user_id),
      approvalId: String(row.approval_id),
      paypalOrderId: String(row.paypal_order_id),
      paypalCaptureId: row.paypal_capture_id ? String(row.paypal_capture_id) : null,
      status: row.status as PaymentStatus,
      amount: Number(row.amount),
      currency: String(row.currency),
      idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
      payerEmail: row.payer_email ? String(row.payer_email) : null,
      payerId: row.payer_id ? String(row.payer_id) : null,
      errorMessage: row.error_message ? String(row.error_message) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}
