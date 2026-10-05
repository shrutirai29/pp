'use client';

import React from 'react';
import { Star, Plus, Maximize2 } from 'lucide-react';
import { Agent } from '@/types';

interface AgentSwarmGridProps {
  agents: Agent[];
  onOpenTopology: () => void;
  onSelectAgent: (agent: Agent) => void;
}

export const AgentSwarmGrid: React.FC<AgentSwarmGridProps> = ({
  agents,
  onOpenTopology,
  onSelectAgent,
}) => {
  return (
    <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-bold text-[#101936]">Agent Swarm</h3>
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>4 agents online</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenTopology}
            className="flex items-center space-x-1 text-xs text-[#8055F7] hover:text-[#4361F7] font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>View Topology</span>
          </button>
          <button
            onClick={onOpenTopology}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Agent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-white hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-start space-x-3">
              {/* 3D-styled robot pedestal icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border text-xl group-hover:scale-105 transition-transform"
                style={{
                  backgroundColor: agent.colorScheme.secondary,
                  borderColor: agent.colorScheme.border,
                }}
              >
                <span>{agent.avatar}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#101936] truncate">{agent.name}</h4>
                  <div className="flex items-center space-x-0.5 text-[10px] font-bold text-amber-500">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{agent.rating}</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#65708D] font-medium">{agent.specialty}</p>
              </div>
            </div>

            {/* Task metrics row */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>
                <strong className="text-slate-700">{agent.tasks}</strong> tasks
              </span>
              <span>
                <strong className="text-emerald-600">{agent.completedTasks}</strong> completed
              </span>
              <span>
                <strong className="text-blue-600">{agent.inProgressTasks}</strong> in progress
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
