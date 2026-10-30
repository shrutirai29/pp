import { UserIntent } from '../../types/deal';
import { FinalDeal } from '../../types/negotiation';
import { VerificationReport, UserApprovalRecord } from '../../types/verification';
import { AuditEvent } from '../../types/audit';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function getSessionUserId(): string {
  try {
    let uid = localStorage.getItem('dealmind_user_id');
    if (!uid) {
      uid = `usr_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('dealmind_user_id', uid);
    }
    return uid;
  } catch {
    return 'usr_anonymous_default';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const userId = getSessionUserId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export interface ServerHealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export const dealmindApi = {
  /**
   * Check backend server connectivity and health
   */
  async checkHealth(): Promise<ServerHealthResponse> {
    return request<ServerHealthResponse>('/health');
  },

  /**
   * Register or persist a deal with intent and optional finalDeal on the server
   */
  async createDeal(intent: UserIntent, finalDeal?: FinalDeal, title?: string): Promise<{ success: boolean; deal: any }> {
    return request<{ success: boolean; deal: any }>('/api/deals', {
      method: 'POST',
      body: JSON.stringify({
        intent,
        finalDeal,
        title,
      }),
    });
  },

  /**
   * Retrieve deal from server
   */
  async getDeal(dealId: string): Promise<{ success: boolean; deal: any }> {
    return request<{ success: boolean; deal: any }>(`/api/deals/${encodeURIComponent(dealId)}`);
  },

  /**
   * Request server-enforced independent verification of a deal
   */
  async verifyDeal(
    dealId: string,
    finalDeal?: FinalDeal
  ): Promise<{ success: boolean; report: VerificationReport }> {
    return request<{ success: boolean; report: VerificationReport }>(
      `/api/deals/${encodeURIComponent(dealId)}/verify`,
      {
        method: 'POST',
        body: JSON.stringify({ finalDeal }),
      }
    );
  },

  /**
   * Create an approval request on the server for a verified deal
   */
  async createApprovalRequest(
    dealId: string,
    reportId?: string
  ): Promise<{ success: boolean; approval: UserApprovalRecord }> {
    return request<{ success: boolean; approval: UserApprovalRecord }>(
      `/api/deals/${encodeURIComponent(dealId)}/approval-request`,
      {
        method: 'POST',
        body: JSON.stringify({ reportId }),
      }
    );
  },

  /**
   * User explicitly approves deal on the server.
   * Backend validates the fingerprint against finalDeal and issues a cryptographically-signed authorization token.
   */
  async approveDeal(
    dealId: string,
    approvalId: string,
    finalDeal: FinalDeal
  ): Promise<{ success: boolean; authorizationToken: string; approval: UserApprovalRecord }> {
    return request<{ success: boolean; authorizationToken: string; approval: UserApprovalRecord }>(
      `/api/deals/${encodeURIComponent(dealId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          approvalId,
          finalDeal,
        }),
      }
    );
  },

  /**
   * User explicitly declines deal on the server.
   */
  async declineDeal(
    dealId: string,
    approvalId: string
  ): Promise<{ success: boolean; approval: UserApprovalRecord }> {
    return request<{ success: boolean; approval: UserApprovalRecord }>(
      `/api/deals/${encodeURIComponent(dealId)}/decline`,
      {
        method: 'POST',
        body: JSON.stringify({ approvalId }),
      }
    );
  },

  /**
   * Consume authorization token (single-use transaction execution)
   */
  async consumeAuthorization(
    dealId: string,
    authorizationToken: string
  ): Promise<{ success: boolean; status: string }> {
    return request<{ success: boolean; status: string }>(
      `/api/deals/${encodeURIComponent(dealId)}/consume-authorization`,
      {
        method: 'POST',
        body: JSON.stringify({ authorizationToken }),
      }
    );
  },

  /**
   * Fetch immutable server audit trail
   */
  async getAuditTrail(dealId: string): Promise<{ success: boolean; events: AuditEvent[] }> {
    return request<{ success: boolean; events: AuditEvent[] }>(
      `/api/deals/${encodeURIComponent(dealId)}/audit`
    );
  },
};
