export type AuditActor = 
  | 'user' 
  | 'dealmind_agent' 
  | 'seller_agent' 
  | 'intentlock_engine' 
  | 'checkout_gateway'
  | 'paypal_gateway';

export type AuditEventType = 
  | 'requirements_created' 
  | 'offers_compared' 
  | 'negotiation_started' 
  | 'counteroffer_received' 
  | 'negotiation_concluded' 
  | 'verification_started' 
  | 'verification_completed' 
  | 'fingerprint_generated'
  | 'deal_verified' 
  | 'deal_rejected' 
  | 'review_required'
  | 'human_approval_requested'
  | 'approval_granted'
  | 'approval_declined'
  | 'approval_expired'
  | 'approval_invalidated'
  | 'checkout_attempted'
  | 'paypal_order_created'
  | 'paypal_payment_completed'
  | 'paypal_payment_failed'
  | 'paypal_payment_cancelled';

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
