'use client';

import React from 'react';
import { Agent } from '@/types';
import { ShieldCheck, CheckCircle2, RefreshCw, Zap, Award } from 'lucide-react';

interface SwarmVisualizerProps {
  agents: Agent[];
}

export const SwarmVisualizer: React.FC<SwarmVisualizerProps> = ({ agents }) => {
  const orchestrator = agents.find(a => a.role === 'orchestrator');
  const evaluator = agents.find(a => a.role === 'evaluator');
  const workers = agents.filter(a => a.role === 'worker');

  const getStatusBadge = (status: Agent['status']) => {
    switch (status) {
      case 'working':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-medium animate-pulse">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Working</span>
          </span>
        );
      case 'qa_eval':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-medium animate-pulse">
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>Under QA</span>
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Settled / Paid</span>
          </span>
        );
      case 'bidding':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-medium">
            <Zap className="w-2.5 h-2.5" />
            <span>Bidding</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-medium">
            <span>Standby</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Active Agent Swarm Network</span>
          </h3>
          <p className="text-xs text-slate-400">Autonomous workers connected via PayPal Payouts & Evaluator QA</p>
        </div>
        <span className="text-xs font-mono text-slate-400 px-2 py-1 rounded bg-slate-950 border border-slate-800">
          Swarm: {agents.length} Nodes Active
        </span>
      </div>

      {/* Grid of Agent Nodes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Orchestrator Card */}
        {orchestrator && (
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-blue-500/30 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-2xl">{orchestrator.avatar}</span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span>{orchestrator.name}</span>
                    <span className="text-[10px] text-blue-400 font-mono">Master</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{orchestrator.specialty}</div>
                </div>
              </div>
              {getStatusBadge(orchestrator.status)}
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Goal Decomposition</span>
              <span className="text-blue-400">Escrow Allocator</span>
            </div>
          </div>
        )}

        {/* Worker Cards */}
        {workers.map((worker) => (
          <div
            key={worker.id}
            className={`p-3.5 rounded-xl bg-slate-950/70 border transition-all ${
              worker.status === 'working'
                ? 'border-blue-500/60 shadow-lg shadow-blue-500/10'
                : worker.status === 'paid'
                ? 'border-emerald-500/40 bg-emerald-950/10'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-2xl">{worker.avatar}</span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span>{worker.name}</span>
                    <span className="text-[10px] text-slate-400 flex items-center">
                      ★ {worker.rating}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{worker.specialty}</div>
                </div>
              </div>
              {getStatusBadge(worker.status)}
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="text-slate-500">Rate: ${worker.ratePerTask.toFixed(2)}/task</span>
              <span className="text-cyan-400 truncate max-w-[130px]" title={worker.payoutEmail}>
                {worker.payoutEmail}
              </span>
            </div>
          </div>
        ))}

        {/* Evaluator Card */}
        {evaluator && (
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-purple-500/30 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-2xl">{evaluator.avatar}</span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span>{evaluator.name}</span>
                    <span className="text-[10px] text-purple-400 font-mono">Auditor</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Escrow QA Verification</div>
                </div>
              </div>
              {getStatusBadge(evaluator.status)}
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Approval Rule: &gt;= 80/100</span>
              <span className="text-purple-400">Release Auth</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
