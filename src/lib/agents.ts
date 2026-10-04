import { Agent, TaskContract, Deliverable } from '@/types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent_orchestrator',
    name: 'PayOrchestrator',
    role: 'orchestrator',
    specialty: 'Orchestrator',
    avatar: '👑',
    payoutEmail: 'orchestrator@payagent.network',
    ratePerTask: 0,
    rating: 5.0,
    tasksCompleted: 428,
    status: 'idle',
  },
  {
    id: 'agent_nova',
    name: 'Agent Nova',
    role: 'worker',
    specialty: 'Data Harvester',
    avatar: '🛰️',
    payoutEmail: 'nova.data@payagent.sandbox',
    ratePerTask: 3.50,
    rating: 4.95,
    tasksCompleted: 142,
    status: 'idle',
  },
  {
    id: 'agent_cipher',
    name: 'Agent Cipher',
    role: 'worker',
    specialty: 'Code & Security Auditor',
    avatar: '🛡️',
    payoutEmail: 'cipher.sec@payagent.sandbox',
    ratePerTask: 6.00,
    rating: 4.98,
    tasksCompleted: 89,
    status: 'idle',
  },
  {
    id: 'agent_synthex',
    name: 'Agent Synthex',
    role: 'worker',
    specialty: 'Synthesis & Writer',
    avatar: '⚡',
    payoutEmail: 'synthex.write@payagent.sandbox',
    ratePerTask: 4.50,
    rating: 4.92,
    tasksCompleted: 215,
    status: 'idle',
  },
  {
    id: 'agent_metric',
    name: 'Agent Metric',
    role: 'worker',
    specialty: 'SEO & Market Quant',
    avatar: '📈',
    payoutEmail: 'metric.quant@payagent.sandbox',
    ratePerTask: 4.00,
    rating: 4.88,
    tasksCompleted: 112,
    status: 'idle',
  },
  {
    id: 'agent_judge',
    name: 'JudgeLex QA',
    role: 'evaluator',
    specialty: 'Orchestrator',
    avatar: '⚖️',
    payoutEmail: 'judgelex.qa@payagent.sandbox',
    ratePerTask: 1.50,
    rating: 5.0,
    tasksCompleted: 610,
    status: 'idle',
  },
];

export const PRESET_MISSIONS = [
  {
    title: 'Autonomous Security & Risk Audit for Payment Gateway API',
    goal: 'Perform static vulnerability scan, rate-limiting stress test simulation, and create an enterprise remediation playbook for payment endpoints.',
    budget: 18.00,
  },
  {
    title: 'Competitor Pricing Arbitrage & Market Intelligence Dossier',
    goal: 'Scrape cross-platform SaaS tier pricing, compute elasticity indices, and generate an executive go-to-market pricing proposal.',
    budget: 15.00,
  },
  {
    title: 'AI Agent-to-Agent Micro-Payment Commerce Whitepaper',
    goal: 'Research cryptographic escrow patterns, benchmark PayPal Payouts settlement latency, and synthesize a multi-agent economic specification.',
    budget: 16.50,
  },
];

/**
 * Decomposes a user goal into discrete worker agent contracts
 */
export function planMissionTasks(missionId: string, goal: string): TaskContract[] {
  const isSecurity = goal.toLowerCase().includes('security') || goal.toLowerCase().includes('audit') || goal.toLowerCase().includes('gateway');
  const isPricing = goal.toLowerCase().includes('pricing') || goal.toLowerCase().includes('market') || goal.toLowerCase().includes('competitor');

  if (isSecurity) {
    return [
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Endpoint Vulnerability & Surface Discovery',
        description: 'Map REST & GraphQL attack surfaces, headers, and rate-limiting thresholds.',
        assignedAgentId: 'agent_nova',
        assignedAgentName: 'Agent Nova',
        assignedAgentEmail: 'nova.data@payagent.sandbox',
        budget: 3.50,
        status: 'pending',
        acceptanceCriteria: [
          'Identify top 5 API endpoint vulnerabilities (OWASP API Top 10)',
          'Extract schema entropy and signature vectors',
          'Output structured JSON endpoint matrix',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Cryptographic Auth & Token Expiry Audit',
        description: 'Deep audit of OAuth2 token exchange, webhook signatures, and replay attack protection.',
        assignedAgentId: 'agent_cipher',
        assignedAgentName: 'Agent Cipher',
        assignedAgentEmail: 'cipher.sec@payagent.sandbox',
        budget: 6.00,
        status: 'pending',
        acceptanceCriteria: [
          'Verify HMAC-SHA256 signature verification code',
          'Audit token TTL and refresh token rotation logic',
          'Demonstrate zero-trust mitigation for MITM vectors',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Executive Remediation Playbook & Settlement Dossier',
        description: 'Synthesize findings into executive risk scores, CVE classifications, and PR-ready code diffs.',
        assignedAgentId: 'agent_synthex',
        assignedAgentName: 'Agent Synthex',
        assignedAgentEmail: 'synthex.write@payagent.sandbox',
        budget: 4.50,
        status: 'pending',
        acceptanceCriteria: [
          'Complete executive summary with CVSS v3.1 scoring',
          'Actionable TypeScript / Python code patches',
          'Complies with ISO 27001 & PCI-DSS 4.0 guidelines',
        ],
        createdAt: new Date().toISOString(),
      },
    ];
  } else if (isPricing) {
    return [
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Multi-Tenant Competitor Data Scraping',
        description: 'Extract pricing tiers, API limits, and add-on structures across 6 industry competitors.',
        assignedAgentId: 'agent_nova',
        assignedAgentName: 'Agent Nova',
        assignedAgentEmail: 'nova.data@payagent.sandbox',
        budget: 3.50,
        status: 'pending',
        acceptanceCriteria: [
          'Scrape minimum 6 competitor pricing matrices',
          'Normalize per-seat, usage-based, and flat pricing',
          'Export validated JSON dataset',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Price Elasticity & Margins Quant Modeling',
        description: 'Calculate churn sensitivity curves and identify margin arbitrage opportunities.',
        assignedAgentId: 'agent_metric',
        assignedAgentName: 'Agent Metric',
        assignedAgentEmail: 'metric.quant@payagent.sandbox',
        budget: 4.00,
        status: 'pending',
        acceptanceCriteria: [
          'Generate revenue elasticity curve model',
          'Identify underserved price point sweet spots',
          'Provide expected ARR impact projections',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Strategic GTM Pricing Architecture Dossier',
        description: 'Draft the commercial strategy document and product packaging recommendations.',
        assignedAgentId: 'agent_synthex',
        assignedAgentName: 'Agent Synthex',
        assignedAgentEmail: 'synthex.write@payagent.sandbox',
        budget: 4.50,
        status: 'pending',
        acceptanceCriteria: [
          'Provide 3-tier recommended packaging breakdown',
          'Include customer persona willingness-to-pay analysis',
          'Ready-to-present executive deck markdown',
        ],
        createdAt: new Date().toISOString(),
      },
    ];
  } else {
    // Default Agent-to-Agent Commerce Mission
    return [
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Agentic Protocol & Escrow Flow Research',
        description: 'Benchmark state machine patterns for two-party autonomous transaction settlement.',
        assignedAgentId: 'agent_nova',
        assignedAgentName: 'Agent Nova',
        assignedAgentEmail: 'nova.data@payagent.sandbox',
        budget: 3.50,
        status: 'pending',
        acceptanceCriteria: [
          'Analyze decentralized escrow state machines',
          'Benchmark PayPal Payouts batching throughput',
          'Document gas vs fiat latency trade-offs',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'Autonomous Settlement Smart Contract & Gateway Verification',
        description: 'Verify conditional payment triggers and programmatic escrow unlock safety.',
        assignedAgentId: 'agent_cipher',
        assignedAgentName: 'Agent Cipher',
        assignedAgentEmail: 'cipher.sec@payagent.sandbox',
        budget: 6.00,
        status: 'pending',
        acceptanceCriteria: [
          'Audit automated escrow release signatures',
          'Test rejection on failed acceptance criteria',
          'Verify human-in-the-loop spending caps',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        missionId,
        title: 'PayAgent Protocol Specification & Whitepaper',
        description: 'Complete technical specification document for autonomous agent commerce.',
        assignedAgentId: 'agent_synthex',
        assignedAgentName: 'Agent Synthex',
        assignedAgentEmail: 'synthex.write@payagent.sandbox',
        budget: 4.50,
        status: 'pending',
        acceptanceCriteria: [
          'Full RFC-style protocol specification',
          'Sequence diagrams and API payload schemas',
          'Production security & compliance review',
        ],
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

/**
 * Generate synthetic high-quality agent deliverable
 */
export function generateSyntheticDeliverable(task: TaskContract): Deliverable {
  const isSecurity = task.title.toLowerCase().includes('vulnerability') || task.title.toLowerCase().includes('cryptographic') || task.title.toLowerCase().includes('audit');
  
  if (isSecurity) {
    return {
      summary: `Completed thorough inspection for "${task.title}". Identified 3 core vectors and supplied verified patch diffs.`,
      content: `### 🛡️ Audit Report: ${task.title}\n\n` +
        `**Status**: PASSED ACCEPTANCE CRITERIA\n\n` +
        `#### Key Findings:\n` +
        `1. **OWASP API3:2023 Broken Object Property Level Authorization**: Authorization checks were missing on secondary query projections.\n` +
        `2. **PayPal Webhook Verification**: Webhooks lacked check for 'PAYPAL-AUTH-ALGO' replay windows.\n` +
        `3. **Rate Limiting**: Added sliding-window limiter on checkout initialization.\n\n` +
        `\`\`\`typescript\n` +
        `// Remediation Patch Applied:\n` +
        `export function verifyPayPalWebhookSignature(req: Request, webhookId: string) {\n` +
        `  const certUrl = req.headers.get('paypal-cert-url');\n` +
        `  if (!certUrl?.startsWith('https://api.paypal.com/')) throw new Error('Untrusted Cert Source');\n` +
        `  // Escrow authorization safely verified\n` +
        `  return true;\n` +
        `}\n` +
        `\`\`\`\n\n` +
        `*Artifact Hash: sha256:${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}*`,
      executionTimeMs: 1420,
      qualityScore: 97,
      evaluatorFeedback: 'JudgeLex QA: All 3 acceptance criteria met with full cryptographic verification. Release of PayPal Escrow approved.',
      verifiedAt: new Date().toISOString(),
    };
  } else {
    return {
      summary: `Completed data synthesis and analysis for "${task.title}". All acceptance criteria verified by JudgeLex.`,
      content: `### 📊 Analytical Deliverable: ${task.title}\n\n` +
        `**Deliverable Specification**: Complete dataset and strategic breakdown generated.\n\n` +
        `| Metric | Industry Benchmark | PayAgent Observed | Delta |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| Settlement Latency | 48-72 hrs (Wire/ACH) | < 1.2s (PayPal Payouts) | -99.9% |\n` +
        `| Escrow Hold Fee | 2.5% - 5.0% | 0.0% (Native Auth) | -100% |\n` +
        `| Agent Trust Score | N/A | 98.4 / 100 | +Verified |\n\n` +
        `#### Strategic Recommendation:\n` +
        `Automated micro-settlement via PayPal Payouts unlocks instantaneous agent-to-agent procurement with zero credit risk, secured by upstream authorization holds.`,
      executionTimeMs: 1850,
      qualityScore: 95,
      evaluatorFeedback: 'JudgeLex QA: Deliverable validated against specifications. Code and data structures intact. Payment authorized.',
      verifiedAt: new Date().toISOString(),
    };
  }
}
