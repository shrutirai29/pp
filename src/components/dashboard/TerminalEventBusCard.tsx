'use client';

import React, { useState } from 'react';
import { Terminal, ChevronDown, Trash2 } from 'lucide-react';
import { SwarmEventLog } from '@/types';

interface TerminalEventBusCardProps {
  logs: SwarmEventLog[];
  onClear: () => void;
}

export const TerminalEventBusCard: React.FC<TerminalEventBusCardProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.source === filter;
  });

  const getSourceBadge = (source: SwarmEventLog['source']) => {
    switch (source) {
      case 'ORCHESTRATOR':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PAYPAL_ESCROW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AGENT_NODE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'JUDGELEX_QA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PAYPAL_PAYOUT':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'GUARDRAIL':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm flex flex-col h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-bold text-[#101936]">Terminal Event Bus</h3>
          <span className="flex items-center space-x-1 text-[11px] text-slate-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="appearance-none bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1 pr-6 text-[11px] font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Events</option>
              <option value="PAYPAL_ESCROW">PayPal Escrow</option>
              <option value="PAYPAL_PAYOUT">PayPal Payout</option>
              <option value="JUDGELEX_QA">JudgeLex QA</option>
              <option value="AGENT_NODE">Agent Node</option>
              <option value="GUARDRAIL">Guardrail</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={onClear}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition"
            title="Clear event logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Body */}
      <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] pr-1">
        {filteredLogs.map((log) => (
          <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
            <span className="text-slate-400 flex-shrink-0 text-[10px] mt-0.5 font-sans">
              {log.timestamp}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex-shrink-0 ${getSourceBadge(
                log.source
              )}`}
            >
              [{log.source}]
            </span>
            <span className="text-slate-700">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
