import { DatabaseSync } from '../db/sqliteAdapter.js';
import crypto from 'node:crypto';

export interface NegotiationRecord {
  id: string;
  dealId: string;
  userId: string;
  offerId: string;
  sellerId: string;
  sellerName: string;
  initialPrice: number;
  currentPrice: number;
  finalPrice: number | null;
  totalSaved: number;
  status: 'active' | 'agreed' | 'rejected';
  stopReason: string;
  roundCount: number;
  summary: string;
  createdAt: string;
  updatedAt: string;
  rounds?: NegotiationRoundRecord[];
}

export interface NegotiationRoundRecord {
  id: string;
  negotiationId: string;
  roundNumber: number;
  sender: 'buyer_agent' | 'seller_agent' | 'system';
  senderName: string;
  action: string;
  itemPrice: number;
  deliveryFee: number;
  otherCharges: number;
  totalPayable: number;
  currency: string;
  messageType: string;
  rationale: string | null;
  messageText: string;
  termsHighlights: string[];
  createdAt: string;
}

export class NegotiationRepository {
  constructor(private db: DatabaseSync) {}

  public createNegotiation(
    dealId: string,
    userId: string,
    offerId: string,
    sellerId: string,
    sellerName: string,
    initialPrice: number
  ): NegotiationRecord {
    const id = `neg-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO negotiations (
        id, deal_id, user_id, offer_id, seller_id, seller_name,
        initial_price, current_price, final_price, total_saved,
        status, stop_reason, round_count, summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 'active', 'in_progress', 0, 'Negotiation started', ?, ?)
    `);

    stmt.run(id, dealId, userId, offerId, sellerId, sellerName, initialPrice, initialPrice, now, now);

    return {
      id,
      dealId,
      userId,
      offerId,
      sellerId,
      sellerName,
      initialPrice,
      currentPrice: initialPrice,
      finalPrice: null,
      totalSaved: 0,
      status: 'active',
      stopReason: 'in_progress',
      roundCount: 0,
      summary: 'Negotiation started',
      createdAt: now,
      updatedAt: now,
      rounds: [],
    };
  }

  public recordRound(
    negotiationId: string,
    roundNumber: number,
    sender: 'buyer_agent' | 'seller_agent' | 'system',
    senderName: string,
    action: string,
    itemPrice: number,
    deliveryFee: number,
    otherCharges: number,
    totalPayable: number,
    currency: string,
    messageType: string,
    rationale: string | null,
    messageText: string,
    termsHighlights: string[] = []
  ): NegotiationRoundRecord {
    const id = `rnd-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO negotiation_rounds (
        id, negotiation_id, round_number, sender, sender_name, action,
        item_price, delivery_fee, other_charges, total_payable, currency,
        message_type, rationale, message_text, terms_highlights_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      negotiationId,
      roundNumber,
      sender,
      senderName,
      action,
      itemPrice,
      deliveryFee,
      otherCharges,
      totalPayable,
      currency,
      messageType,
      rationale,
      messageText,
      JSON.stringify(termsHighlights),
      now
    );

    return {
      id,
      negotiationId,
      roundNumber,
      sender,
      senderName,
      action,
      itemPrice,
      deliveryFee,
      otherCharges,
      totalPayable,
      currency,
      messageType,
      rationale,
      messageText,
      termsHighlights,
      createdAt: now,
    };
  }

  public updateOutcome(
    negotiationId: string,
    finalPrice: number | null,
    currentPrice: number,
    totalSaved: number,
    status: 'active' | 'agreed' | 'rejected',
    stopReason: string,
    roundCount: number,
    summary: string
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE negotiations
      SET final_price = ?, current_price = ?, total_saved = ?,
          status = ?, stop_reason = ?, round_count = ?, summary = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      finalPrice,
      currentPrice,
      totalSaved,
      status,
      stopReason,
      roundCount,
      summary,
      now,
      negotiationId
    );
  }

  public getNegotiation(negotiationId: string): NegotiationRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM negotiations WHERE id = ?
    `);
    const row = stmt.get(negotiationId) as any;
    if (!row) return null;

    const rounds = this.getRoundsForNegotiation(negotiationId);
    return this.mapRowToRecord(row, rounds);
  }

  public getLatestNegotiationForDeal(dealId: string): NegotiationRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM negotiations WHERE deal_id = ? ORDER BY created_at DESC LIMIT 1
    `);
    const row = stmt.get(dealId) as any;
    if (!row) return null;

    const rounds = this.getRoundsForNegotiation(row.id);
    return this.mapRowToRecord(row, rounds);
  }

  public listNegotiationsForUser(userId: string): NegotiationRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM negotiations WHERE user_id = ? ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapRowToRecord(row));
  }

  public getRoundsForNegotiation(negotiationId: string): NegotiationRoundRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM negotiation_rounds WHERE negotiation_id = ? ORDER BY round_number ASC, created_at ASC
    `);
    const rows = stmt.all(negotiationId) as any[];

    return rows.map((r) => ({
      id: r.id,
      negotiationId: r.negotiation_id,
      roundNumber: r.round_number,
      sender: r.sender,
      senderName: r.sender_name,
      action: r.action,
      itemPrice: Number(r.item_price),
      deliveryFee: Number(r.delivery_fee),
      otherCharges: Number(r.other_charges),
      totalPayable: Number(r.total_payable),
      currency: r.currency,
      messageType: r.message_type,
      rationale: r.rationale,
      messageText: r.message_text,
      termsHighlights: r.terms_highlights_json ? JSON.parse(r.terms_highlights_json) : [],
      createdAt: r.created_at,
    }));
  }

  private mapRowToRecord(row: any, rounds: NegotiationRoundRecord[] = []): NegotiationRecord {
    return {
      id: row.id,
      dealId: row.deal_id,
      userId: row.user_id,
      offerId: row.offer_id,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      initialPrice: Number(row.initial_price),
      currentPrice: Number(row.current_price),
      finalPrice: row.final_price !== null ? Number(row.final_price) : null,
      totalSaved: Number(row.total_saved),
      status: row.status,
      stopReason: row.stop_reason,
      roundCount: Number(row.round_count),
      summary: row.summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rounds,
    };
  }
}
