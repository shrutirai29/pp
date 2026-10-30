import { DatabaseSync } from '../db/sqliteAdapter.js';
import { UserIntent, FinalDeal } from '../schemas/dealSchemas.js';

export interface DealRecord {
  id: string;
  userId: string;
  title: string;
  status: string;
  intent: UserIntent;
  finalDeal: FinalDeal | null;
  createdAt: string;
  updatedAt: string;
}

export class DealRepository {
  constructor(private db: DatabaseSync) {}

  public createDeal(userId: string, intent: UserIntent, finalDeal?: FinalDeal, title?: string): DealRecord {
    const id = intent.id;
    const now = new Date().toISOString();
    const dealTitle = title || intent.productTitle;
    const status = finalDeal ? (finalDeal.isAcceptedBySeller ? 'negotiating' : 'draft') : 'draft';

    const stmt = this.db.prepare(`
      INSERT INTO deals (id, user_id, title, status, intent_json, final_deal_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      dealTitle,
      status,
      JSON.stringify(intent),
      finalDeal ? JSON.stringify(finalDeal) : null,
      now,
      now
    );

    return {
      id,
      userId,
      title: dealTitle,
      status,
      intent,
      finalDeal: finalDeal || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  public getDeal(id: string): DealRecord | null {
    const stmt = this.db.prepare(`SELECT * FROM deals WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title),
      status: String(row.status),
      intent: JSON.parse(String(row.intent_json)),
      finalDeal: row.final_deal_json ? JSON.parse(String(row.final_deal_json)) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  public listDealsForUser(userId: string): DealRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM deals WHERE user_id = ? ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title),
      status: String(row.status),
      intent: JSON.parse(String(row.intent_json)),
      finalDeal: row.final_deal_json ? JSON.parse(String(row.final_deal_json)) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  public updateFinalDeal(id: string, finalDeal: FinalDeal): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE deals
      SET final_deal_json = ?, updated_at = ?
      WHERE id = ?
    `);
    const info = stmt.run(JSON.stringify(finalDeal), now, id);
    return Number(info.changes) > 0;
  }

  public updateDealStatus(id: string, status: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE deals
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);
    const info = stmt.run(status, now, id);
    return Number(info.changes) > 0;
  }
}
