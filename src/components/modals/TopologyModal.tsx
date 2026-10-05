'use client';

import React from 'react';
import { X, Cpu, Network, Zap } from 'lucide-react';
import { Agent } from '@/types';

interface TopologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
}

export const TopologyModal: React.FC<TopologyModalProps> = ({ isOpen, onClose, agents }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-[#E3E8F5] rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#8055F7] flex items-center justify-center font-bold">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#101936]">Autonomous Swarm Topology</h3>
              <p className="text-[10px] text-slate-400">Multi-agent peer mesh & PayPal settlement links</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Swarm Architecture Diagram */}
          <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#003087] via-[#0070BA] to-[#00CFDE] text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-500/20 mb-3">
              P
            </div>
            <h4 className="font-bold text-[#101936] text-sm">PayPal Escrow & Settlement Hub</h4>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Connects autonomous Orchestrator and specialized worker agents through Orders v2 Authorize and Payouts API.
            </p>
          </div>

          {/* Node Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {agents.map((agent) => (
              <div key={agent.id} className="p-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm flex items-start space-x-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: agent.colorScheme.secondary }}
                >
                  {agent.avatar}
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-[#101936]">{agent.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({agent.specialty})</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">{agent.payoutEmail}</p>
                  <div className="flex items-center space-x-3 mt-2 text-[10px] font-semibold text-slate-600">
                    <span>Rate: ${agent.ratePerTask.toFixed(2)}/task</span>
                    <span>Rating: ★ {agent.rating}</span>
                    <span className="text-emerald-600 font-bold capitalize">• {agent.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
          >
            Close Topology
          </button>
        </div>
      </div>
    </div>
  );
};
