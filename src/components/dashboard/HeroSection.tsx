'use client';

import React from 'react';
import { Plus, Compass, Sparkles } from 'lucide-react';
import { AgentIsometricNetwork } from './AgentIsometricNetwork';
import { MissionProgressCard } from './MissionProgressCard';
import { Agent, MissionPhase } from '@/types';

interface HeroSectionProps {
  agents: Agent[];
  currentPhase: MissionPhase;
  onCreateMission: () => void;
  onExplorePresets: () => void;
  onSelectAgent: (agent: Agent) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  agents,
  currentPhase,
  onCreateMission,
  onExplorePresets,
  onSelectAgent,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-md border border-[#E3E8F5] rounded-3xl p-6 lg:p-8 shadow-sm relative overflow-hidden">
      {/* Delicate background ambient lights */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-100/50 via-purple-100/40 to-transparent rounded-full blur-3xl pointer-events-none -ml-20 -mt-20" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-100/40 via-blue-100/30 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Headlines & Call to Actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#E0E7FF] text-[11px] font-bold text-[#4361F7] tracking-wider uppercase">
            <Sparkles className="w-3 h-3 text-[#4361F7]" />
            <span>WELCOME TO PAYAGENT</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#101936] tracking-tight leading-[1.15]">
            Turn Ideas into{' '}
            <span className="bg-gradient-to-r from-[#4361F7] via-[#8055F7] to-[#44C8F5] bg-clip-text text-transparent">
              Real Work
            </span>{' '}
            With AI Agents
          </h1>

          <p className="text-sm text-[#65708D] leading-relaxed max-w-md">
            Create a mission, let specialized agents collaborate, get verified results, and pay instantly with PayPal.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onCreateMission}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4361F7] to-[#8055F7] text-white font-semibold text-xs flex items-center space-x-1.5 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:opacity-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Mission</span>
            </button>

            <button
              onClick={onExplorePresets}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#E3E8F5] text-[#8055F7] font-semibold text-xs flex items-center space-x-1.5 hover:bg-slate-50 transition shadow-sm cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Presets</span>
            </button>
          </div>
        </div>

        {/* Center: 3D Robot Isometric Swarm Network */}
        <div className="lg:col-span-5 flex justify-center">
          <AgentIsometricNetwork agents={agents} onSelectAgent={onSelectAgent} />
        </div>

        {/* Right: Mission Progress Stepper */}
        <div className="lg:col-span-2 flex justify-end">
          <MissionProgressCard currentPhase={currentPhase} />
        </div>
      </div>
    </div>
  );
};
