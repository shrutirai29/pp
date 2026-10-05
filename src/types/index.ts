export type AgentRole = 'orchestrator' | 'worker' | 'evaluator';

export type AgentSpecialty = 
  | 'Orchestrator'
  | 'Data Harvester'
  | 'Security Auditor'
  | 'Code & Security Auditor'
  | 'Technical Writer'
  | 'Synthesis & Writer'
  | 'Market Quant'
  | 'SEO & Market Quant';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  specialty: AgentSpecialty;
  avatar: string;
  avatarSvg?: string;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    border: string;
  };
  payoutEmail: string;
  ratePerTask: number; // in USD
  rating: number; // e.g. 4.8
  tasks: number;
  completedTasks: number;
  inProgressTasks: number;
  status: 'standby' | 'idle' | 'bidding' | 'working' | 'under_qa' | 'qa_eval' | 'settled' | 'paid' | 'disputed';
  currentTaskId?: string;
}

export type TaskStatus = 
  | 'pending'
  | 'bidding'
  | 'escrow_authorized'
  | 'in_progress'
  | 'evaluating'
  | 'under_qa'
  | 'verified'
  | 'settled'
  | 'paid'
  | 'disputed'
  | 'failed'
  | 'refunded';

export interface Deliverable {
  summary: string;
  content: string;
  artifacts?: string[];
  executionTimeMs: number;
  qualityScore?: number; // 0 - 100
  evaluatorFeedback?: string;
  verifiedAt?: string;
  criteriaResults?: {
    name: string;
    passed: boolean;
    evidence: string;
  }[];
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

export type MissionPhase = 
  | 'idea_received'
  | 'decomposing_tasks'
  | 'agents_bidding'
  | 'working'
  | 'under_qa'
  | 'settled_paid';

export interface Mission {
  id: string;
  goal: string;
  title: string;
  category: string;
  totalBudget: number;
  guardrailLimit: number;
  currentPhase: MissionPhase;
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
  source: 'ORCHESTRATOR' | 'PAYPAL_ESCROW' | 'AGENT_NODE' | 'JUDGELEX_QA' | 'PAYPAL_PAYOUT' | 'GUARDRAIL' | 'SYSTEM' | string;
  message: string;
  category?: string;
  type?: 'info' | 'agent_action' | 'escrow' | 'payout' | 'verification' | 'guardrail' | string;
  data?: Record<string, unknown>;
}
