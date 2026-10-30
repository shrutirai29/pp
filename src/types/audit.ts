export type AuditActor = 
  | 'user' 
  | 'dealmind_agent' 
  | 'seller_agent' 
  | 'intentlock_engine' 
  | 'checkout_gateway';

export type AuditEventType = 
  | 'requirements_created' 
  | 'offers_compared' 
  | 'negotiation_started' 
  | 'counteroffer_received' 
  | 'negotiation_concluded' 
  | 'verification_started' 
  | 'verification_completed' 
  | 'deal_verified' 
  | 'deal_rejected' 
  | 'checkout_attempted';

export interface AuditEvent {
  id: string;
  dealId: string;
  timestamp: string;
  type: AuditEventType;
  title: string;
  description: string;
  actor: AuditActor;
  metadata?: Record<string, unknown>;
  isDemo: boolean;
}
