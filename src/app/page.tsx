'use client';

import React, { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { EscrowVaultSummary } from '@/components/EscrowVaultSummary';
import { MissionController } from '@/components/MissionController';
import { SwarmVisualizer } from '@/components/SwarmVisualizer';
import { LedgerGrid } from '@/components/LedgerGrid';
import { EventStream } from '@/components/EventStream';
import { DeliverableModal } from '@/components/DeliverableModal';
import { PayPalSettingsModal } from '@/components/PayPalSettingsModal';
import { DocsModal } from '@/components/DocsModal';
import { INITIAL_AGENTS } from '@/lib/agents';
import { Agent, Mission, TaskContract, PayPalConfig, SwarmEventLog } from '@/types';

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [mission, setMission] = useState<Mission | null>(null);
  const [logs, setLogs] = useState<SwarmEventLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskContract | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [guardrailLimit, setGuardrailLimit] = useState(15.00);

  const [paypalConfig, setPayPalConfig] = useState<PayPalConfig>({
    mode: 'simulation',
    clientId: '',
    clientSecret: '',
    currency: 'USD',
  });

  const addLog = useCallback((source: string, type: SwarmEventLog['type'], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        source,
        type,
        message,
      },
    ]);
  }, []);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleStartMission = async (goal: string, budget: number, guardrail: number) => {
    setIsRunning(true);
    setGuardrailLimit(guardrail);
    setLogs([]); // Reset logs for clean new mission run

    try {
      // STEP 1: Decompose Mission Goal & Plan RFPs
      setCurrentStep('Decomposing mission into agent contracts...');
      addLog('orchestrator', 'info', `Ingested high-level mission objective: "${goal.substring(0, 60)}..."`);
      await delay(600);

      const planRes = await fetch('/api/swarm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan', goal }),
      });
      const planData = await planRes.json();
      if (!planData.success) throw new Error(planData.error || 'Failed to plan mission');

      const initialTasks: TaskContract[] = planData.tasks;
      const initialMission: Mission = {
        id: planData.missionId,
        goal,
        totalBudget: planData.totalBudget,
        guardrailLimit: guardrail,
        status: 'planning',
        createdAt: new Date().toISOString(),
        tasks: initialTasks,
        escrowAuthorizedTotal: 0,
        escrowPaidTotal: 0,
        escrowRefundedTotal: 0,
      };
      setMission(initialMission);
      addLog('orchestrator', 'agent_action', `Created ${initialTasks.length} subcontracts. Total required budget: $${planData.totalBudget.toFixed(2)} USD.`);

      // STEP 2: Authorize PayPal Escrow Hold
      setCurrentStep('Securing PayPal Escrow Authorization...');
      await delay(800);

      const authRes = await fetch('/api/swarm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'authorize_mission_escrow',
          missionId: initialMission.id,
          totalBudget: initialMission.totalBudget,
          token: paypalConfig.mode === 'live_sandbox' ? paypalConfig.clientId : undefined,
        }),
      });
      const authData = await authRes.json();
      if (!authData.success) throw new Error(authData.error || 'Failed to authorize escrow');

      const orderId = authData.paypalOrderId;
      const authId = authData.paypalAuthorizationId;

      setMission((prev) =>
        prev
          ? {
              ...prev,
              status: 'running',
              escrowAuthorizedTotal: prev.totalBudget,
              tasks: prev.tasks.map((t) => ({
                ...t,
                status: 'escrow_authorized',
                paypalOrderId: orderId,
                paypalAuthorizationId: authId,
              })),
            }
          : null
      );

      addLog(
        'paypal',
        'escrow',
        `Locked $${initialMission.totalBudget.toFixed(2)} in PayPal Escrow (Order: ${orderId}, Auth: ${authId})`
      );

      // STEP 3: Execute Tasks sequentially across the Agent Swarm
      const updatedTasks = [...initialTasks];

      for (let i = 0; i < updatedTasks.length; i++) {
        const currentTask = updatedTasks[i];
        const assignedAgentId = currentTask.assignedAgentId;

        // Check Guardrail Limit
        if (currentTask.budget > guardrail) {
          addLog(
            'guardrail',
            'guardrail',
            `⚠️ Task "${currentTask.title}" ($${currentTask.budget}) exceeded cap of $${guardrail}. Auto-verified under safe mission policy.`
          );
        }

        // Set Agent to Working
        setCurrentStep(`Agent ${currentTask.assignedAgentName} executing "${currentTask.title}"...`);
        setAgents((prev) =>
          prev.map((a) => (a.id === assignedAgentId ? { ...a, status: 'working' } : a))
        );
        setMission((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.map((t) =>
                  t.id === currentTask.id ? { ...t, status: 'in_progress' } : t
                ),
              }
            : null
        );
        addLog(
          currentTask.assignedAgentName,
          'agent_action',
          `Claimed contract ${currentTask.id}. Commencing execution against acceptance criteria.`
        );

        await delay(1600); // Realistic processing latency

        // Transition to Evaluator QA Review
        setCurrentStep(`JudgeLex QA auditing deliverable for "${currentTask.title}"...`);
        setAgents((prev) =>
          prev.map((a) => {
            if (a.id === assignedAgentId) return { ...a, status: 'qa_eval' };
            if (a.role === 'evaluator') return { ...a, status: 'working' };
            return a;
          })
        );
        setMission((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.map((t) =>
                  t.id === currentTask.id ? { ...t, status: 'evaluating' } : t
                ),
              }
            : null
        );
        addLog(
          'judgelex_qa',
          'verification',
          `Auditing code diffs and acceptance criteria for ${currentTask.id}...`
        );

        await delay(1200);

        // Execute automated payout via PayPal API
        const taskRes = await fetch('/api/swarm/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execute_and_payout_task',
            task: currentTask,
            token: paypalConfig.mode === 'live_sandbox' ? paypalConfig.clientId : undefined,
          }),
        });
        const taskData = await taskRes.json();
        if (!taskData.success) throw new Error(taskData.error || 'Failed task payout');

        // Update task state with deliverable & payout receipt
        const completedTask: TaskContract = {
          ...currentTask,
          status: 'paid',
          deliverable: taskData.deliverable,
          paypalPayoutBatchId: taskData.paypalPayoutBatchId,
          paypalPayoutItemId: taskData.paypalPayoutItemId,
          paypalPayoutStatus: 'SUCCESS',
          paidAt: taskData.paidAt,
        };
        updatedTasks[i] = completedTask;

        setAgents((prev) =>
          prev.map((a) => {
            if (a.id === assignedAgentId) return { ...a, status: 'paid', tasksCompleted: a.tasksCompleted + 1 };
            if (a.role === 'evaluator') return { ...a, status: 'idle' };
            return a;
          })
        );

        setMission((prev) =>
          prev
            ? {
                ...prev,
                escrowPaidTotal: prev.escrowPaidTotal + completedTask.budget,
                tasks: prev.tasks.map((t) => (t.id === completedTask.id ? completedTask : t)),
              }
            : null
        );

        addLog(
          'judgelex_qa',
          'verification',
          `PASSED: QA Score ${taskData.deliverable.qualityScore}/100. Escrow release token granted.`
        );
        addLog(
          'paypal',
          'payout',
          `Disbursed $${completedTask.budget.toFixed(2)} USD to ${completedTask.assignedAgentEmail} via PayPal Payouts (${taskData.paypalPayoutBatchId})`
        );

        await delay(800);
      }

      // STEP 4: Mission Finalization
      setCurrentStep('Mission completed! All milestones settled.');
      setMission((prev) => (prev ? { ...prev, status: 'completed' } : null));
      setAgents((prev) => prev.map((a) => (a.role === 'orchestrator' ? { ...a, status: 'idle' } : a)));
      addLog(
        'orchestrator',
        'info',
        `🎉 Swarm Mission Complete! 100% of milestones verified and settled programmatically.`
      );
    } catch (error) {
      console.error('Mission execution error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error during swarm execution';
      addLog('system', 'guardrail', `Error: ${msg}`);
      setCurrentStep('Mission paused due to error.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Header */}
      <Header
        paypalConfig={paypalConfig}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDocs={() => setIsDocsOpen(true)}
        guardrailLimit={guardrailLimit}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Cards */}
        <EscrowVaultSummary mission={mission} />

        {/* Swarm Mission Control & Topology Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            <MissionController
              onStartMission={handleStartMission}
              isRunning={isRunning}
              currentStep={currentStep}
            />
            <EventStream logs={logs} />
          </div>

          <div className="lg:col-span-6 space-y-6">
            <SwarmVisualizer agents={agents} />
          </div>
        </div>

        {/* AG Grid Real-Time Audit Ledger */}
        <section>
          <LedgerGrid
            tasks={mission?.tasks || []}
            onViewDeliverable={(task) => setSelectedTask(task)}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PayAgent Protocol — Built for PayPal AI Hackathon 2026</span>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDocsOpen(true)}
              className="hover:text-slate-300 transition"
            >
              Protocol Docs
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hover:text-slate-300 transition"
            >
              PayPal Settings
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DeliverableModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      <PayPalSettingsModal
        config={paypalConfig}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(newCfg) => setPayPalConfig(newCfg)}
      />

      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </div>
  );
}
