'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, Shield, DollarSign, Cpu, CheckCircle } from 'lucide-react';
import { SwarmEventLog } from '@/types';

interface EventStreamProps {
  logs: SwarmEventLog[];
}

export const EventStream: React.FC<EventStreamProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogIcon = (type: SwarmEventLog['type']) => {
    switch (type) {
      case 'escrow':
      case 'payout':
        return <DollarSign className="w-3 h-3 text-emerald-400" />;
      case 'verification':
        return <CheckCircle className="w-3 h-3 text-purple-400" />;
      case 'guardrail':
        return <Shield className="w-3 h-3 text-amber-400" />;
      default:
        return <Cpu className="w-3 h-3 text-cyan-400" />;
    }
  };

  const getLogColor = (type: SwarmEventLog['type']) => {
    switch (type) {
      case 'escrow':
        return 'text-blue-300';
      case 'payout':
        return 'text-emerald-300';
      case 'verification':
        return 'text-purple-300';
      case 'guardrail':
        return 'text-amber-300';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col h-64">
      {/* Terminal Title */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300 font-mono">
            PayAgent Protocol Event Bus
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          {logs.length} events logged
        </span>
      </div>

      {/* Log Body */}
      <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-4 text-center">
            Awaiting mission deployment...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
              <span className="text-slate-600 flex-shrink-0 text-[10px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type)}</span>
              <span className="text-slate-500 font-semibold flex-shrink-0">
                [{log.source.toUpperCase()}]
              </span>
              <span className={getLogColor(log.type)}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
