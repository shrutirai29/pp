export type AgentRole = 'orchestrator' | 'worker' | 'evaluator';

export type AgentSpecialty = 
  | 'Orchestrator'
  | 'Data Harvester'
  | 'Code & Security Auditor'
  | 'Synthesis & Writer'
  | 'SEO & Market Quant';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  specialty: AgentSpecialty;
  avatar: string;
  payoutEmail: string;
  ratePerTask: number; // in USD
  rating: number; // e.g. 4.9
  tasksCompleted: number;
  status: 'idle' | 'bidding' | 'working' | 'qa_eval' | 'paid';
  currentTaskId?: string;
}

export type TaskStatus = 
  | 'pending'
  | 'bidding'
  | 'escrow_authorized'
  | 'in_progress'
  | 'evaluating'
  | 'verified'
  | 'paid'
  | 'disputed'
  | 'refunded';

export interface Deliverable {
  summary: string;
  content: string;
  artifacts?: string[];
  executionTimeMs: number;
  qualityScore?: number; // 0 - 100
  evaluatorFeedback?: string;
  verifiedAt?: string;
}

export interface TaskContract {
  id: string;
  missionId: string;
  title: string;
  description: string;
  assignedAgentId: string;
  assignedAgentName: string;
  assignedAgentEmail: string;
  budget: number;
  status: TaskStatus;
  acceptanceCriteria: string[];
  deliverable?: Deliverable;
  // PayPal specific fields
  paypalOrderId?: string;
  paypalAuthorizationId?: string;
  paypalPayoutBatchId?: string;
  paypalPayoutItemId?: string;
  paypalPayoutStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNCLAIMED';
  createdAt: string;
  completedAt?: string;
  paidAt?: string;
}

export interface Mission {
  id: string;
  goal: string;
  totalBudget: number;
  guardrailLimit: number; // Single task max before requiring human approval
  status: 'idle' | 'planning' | 'running' | 'completed' | 'paused';
  createdAt: string;
  tasks: TaskContract[];
  escrowAuthorizedTotal: number;
  escrowPaidTotal: number;
  escrowRefundedTotal: number;
}

export interface PayPalConfig {
  mode: 'simulation' | 'live_sandbox';
  clientId: string;
  clientSecret: string;
  currency: string;
  webhookId?: string;
}

export interface SwarmEventLog {
  id: string;
  timestamp: string;
  source: string;
  type: 'info' | 'agent_action' | 'escrow' | 'payout' | 'verification' | 'guardrail';
  message: string;
  data?: Record<string, unknown>;
}
