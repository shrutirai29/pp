'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { HeroSection } from '@/components/dashboard/HeroSection';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { AgentSwarmGrid } from '@/components/dashboard/AgentSwarmGrid';
import { LedgerGrid } from '@/components/LedgerGrid';
import { EscrowVaultCard } from '@/components/dashboard/EscrowVaultCard';
import { TerminalEventBusCard } from '@/components/dashboard/TerminalEventBusCard';
import { BottomFeatureGrid } from '@/components/dashboard/BottomFeatureGrid';
import { NewMissionModal } from '@/components/modals/NewMissionModal';
import { InspectContractModal } from '@/components/modals/InspectContractModal';
import { TopologyModal } from '@/components/modals/TopologyModal';
import { DocsModal } from '@/components/DocsModal';
import { PayPalSettingsModal } from '@/components/PayPalSettingsModal';

import { SEED_AGENTS, SEED_CONTRACTS, SEED_EVENTS } from '@/lib/agents';
import { Agent, TaskContract, SwarmEventLog, MissionPhase, PayPalConfig } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [isLiveSandbox, setIsLiveSandbox] = useState(false);
  const [agents, setAgents] = useState<Agent[]>(SEED_AGENTS);
  const [tasks, setTasks] = useState<TaskContract[]>(SEED_CONTRACTS);
  const [logs, setLogs] = useState<SwarmEventLog[]>(SEED_EVENTS);
  const [currentPhase, setCurrentPhase] = useState<MissionPhase>('agents_bidding');

  // Modal visibility states
  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false);
  const [isTopologyOpen, setIsTopologyOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectedTask, setInspectedTask] = useState<TaskContract | null>(null);

  // PayPal verification status
  const [isVerifyingPayPal, setIsVerifyingPayPal] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');

  const [paypalConfig, setPayPalConfig] = useState<PayPalConfig>({
    mode: 'simulation',
    clientId: '',
    clientSecret: '',
    currency: 'USD',
  });

  const handleLaunchMission = (
    title: string,
    goal: string,
    category: string,
    budget: number,
    guardrail: number
  ) => {
    // Transition through realistic phases
    setCurrentPhase('idea_received');
    const newTaskId = `TSK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newContract: TaskContract = {
      id: newTaskId,
      missionId: `MSN-${Date.now().toString(36).toUpperCase()}`,
      title,
      description: goal,
      assignedAgentId: 'agent_cipher',
      assignedAgentName: 'Cipher',
      assignedAgentEmail: 'cipher.sec@payagent.sandbox',
      budget,
      status: 'in_progress',
      acceptanceCriteria: ['Pass security validation', 'Code diff generated'],
      paypalOrderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
      paypalAuthorizationId: `AUTH-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [newContract, ...prev]);

    // Add log
    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [
      {
        id: `LOG-${Date.now()}`,
        timestamp: now,
        source: 'ORCHESTRATOR',
        category: 'planning',
        message: `Goal ingested: "${title}" ($${budget.toFixed(2)})`,
      },
      {
        id: `LOG-${Date.now()}-2`,
        timestamp: now,
        source: 'PAYPAL_ESCROW',
        category: 'escrow',
        message: `Order authorized $${budget.toFixed(2)} in Escrow (${newContract.paypalOrderId})`,
      },
      ...prev,
    ]);

    setTimeout(() => setCurrentPhase('decomposing_tasks'), 1000);
    setTimeout(() => setCurrentPhase('agents_bidding'), 2000);
    setTimeout(() => setCurrentPhase('working'), 3500);
  };

  const handleVerifyOAuth = async () => {
    setIsVerifyingPayPal(true);
    setVerifyMessage('');
    try {
      const res = await fetch('/api/paypal/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isLiveSandbox ? 'live_sandbox' : 'simulation',
          clientId: paypalConfig.clientId,
          clientSecret: paypalConfig.clientSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyMessage('✔ Handshake verified! Connected to PayPal API.');
      } else {
        setVerifyMessage(`Error: ${data.error || 'Connection failed'}`);
      }
    } catch {
      setVerifyMessage('Network error checking PayPal handshake');
    } finally {
      setIsVerifyingPayPal(false);
    }
  };

  const handleSelectPreset = (idx: number) => {
    const presets = [
      { title: 'Security & Risk Audit', goal: 'Audit the payment gateway API for CVEs and vulnerability patterns.', budget: 15.0 },
      { title: 'Competitor Pricing Analysis', goal: 'Scrape cross-platform SaaS tier pricing and evaluate margin opportunities.', budget: 20.0 },
      { title: 'AI Agent Commerce Whitepaper', goal: 'Research multi-agent settlement patterns using PayPal Payouts.', budget: 16.5 },
      { title: 'Market Intelligence Dossier', goal: 'Collect market intelligence on agentic procurement workflows.', budget: 14.0 },
    ];
    const p = presets[idx] || presets[0];
    handleLaunchMission(p.title, p.goal, 'Security Audit', p.budget, 15.0);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FF] text-[#101936] flex font-sans selection:bg-[#EEF2FF] selection:text-[#4361F7]">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'new_mission') setIsNewMissionOpen(true);
          if (tab === 'agent_swarm') setIsTopologyOpen(true);
          if (tab === 'settings') setIsSettingsOpen(true);
          if (tab === 'docs_guide') setIsDocsOpen(true);
        }}
        isLiveSandbox={isLiveSandbox}
        onToggleSandbox={(live) => setIsLiveSandbox(live)}
      />

      {/* 2. Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Command Bar */}
        <TopBar
          onSubmitMission={(prompt) => {
            handleLaunchMission('Natural Language Mission', prompt, 'Custom Mission', 15.0, 15.0);
          }}
          isLiveSandbox={isLiveSandbox}
          onToggleSandbox={(live) => setIsLiveSandbox(live)}
        />

        {/* Dashboard Canvas Area */}
        <main className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* Hero Section with 3D Agent Network & Progress Stepper */}
          <HeroSection
            agents={agents}
            currentPhase={currentPhase}
            onCreateMission={() => setIsNewMissionOpen(true)}
            onExplorePresets={() => handleSelectPreset(0)}
            onSelectAgent={() => setIsTopologyOpen(true)}
          />

          {/* 5 KPI Summary Cards Row */}
          <SummaryCards tasks={tasks} />

          {/* Main 2-Column Grid Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (Approx 65% width) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Agent Swarm Row */}
              <AgentSwarmGrid
                agents={agents}
                onOpenTopology={() => setIsTopologyOpen(true)}
                onSelectAgent={() => setIsTopologyOpen(true)}
              />

              {/* AG Grid Live Contract Ledger */}
              <LedgerGrid
                tasks={tasks}
                onViewDeliverable={(task) => setInspectedTask(task)}
              />
            </div>

            {/* Right Column (Approx 35% width) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Escrow Vault Card with 3D Padlock Artwork */}
              <EscrowVaultCard tasks={tasks} />

              {/* Terminal Event Bus Card */}
              <TerminalEventBusCard
                logs={logs}
                onClear={() => setLogs([])}
              />
            </div>
          </div>

          {/* Bottom 4 Feature Cards */}
          <BottomFeatureGrid
            onSelectPreset={handleSelectPreset}
            onVerifyPayPal={handleVerifyOAuth}
            isVerifyingPayPal={isVerifyingPayPal}
            verifyMessage={verifyMessage}
            isLiveSandbox={isLiveSandbox}
            onToggleSandbox={(live) => setIsLiveSandbox(live)}
          />
        </main>
      </div>

      {/* Modals */}
      <NewMissionModal
        isOpen={isNewMissionOpen}
        onClose={() => setIsNewMissionOpen(false)}
        onLaunchMission={handleLaunchMission}
      />

      <InspectContractModal
        task={inspectedTask}
        onClose={() => setInspectedTask(null)}
      />

      <TopologyModal
        isOpen={isTopologyOpen}
        onClose={() => setIsTopologyOpen(false)}
        agents={agents}
      />

      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />

      <PayPalSettingsModal
        config={paypalConfig}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(cfg) => setPayPalConfig(cfg)}
      />
    </div>
  );
}
