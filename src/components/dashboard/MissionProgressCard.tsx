'use client';

import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { MissionPhase } from '@/types';

interface MissionProgressCardProps {
  currentPhase: MissionPhase;
}

const STEPS: { phase: MissionPhase; label: string }[] = [
  { phase: 'idea_received', label: 'Idea Received' },
  { phase: 'decomposing_tasks', label: 'Decomposing Tasks' },
  { phase: 'agents_bidding', label: 'Agents Bidding' },
  { phase: 'working', label: 'Working' },
  { phase: 'under_qa', label: 'Under QA (JudgeLex)' },
  { phase: 'settled_paid', label: 'Settled / Paid' },
];

export const MissionProgressCard: React.FC<MissionProgressCardProps> = ({ currentPhase }) => {
  const currentIndex = STEPS.findIndex((s) => s.phase === currentPhase);

  return (
    <div className="bg-white/90 backdrop-blur-md border border-[#E3E8F5] rounded-2xl p-4 shadow-sm w-full max-w-[220px]">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <h4 className="text-xs font-bold text-[#101936] tracking-tight">Mission Progress</h4>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex || currentPhase === 'settled_paid';
          const isActive = idx === currentIndex && currentPhase !== 'settled_paid';

          return (
            <div key={step.phase} className="flex items-center space-x-2.5 text-xs">
              {isDone ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
                </div>
              ) : isActive ? (
                <div className="w-4 h-4 rounded-full bg-blue-500/10 text-[#4361F7] flex items-center justify-center flex-shrink-0 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-[#4361F7]" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
              )}

              <span
                className={`truncate font-medium ${
                  isDone
                    ? 'text-slate-700'
                    : isActive
                    ? 'text-[#4361F7] font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
