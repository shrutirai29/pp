'use client';

import React from 'react';
import { Lock, ArrowUpRight, CheckCircle2, ShieldCheck, DollarSign } from 'lucide-react';
import { Mission } from '@/types';

interface EscrowVaultSummaryProps {
  mission: Mission | null;
}

export const EscrowVaultSummary: React.FC<EscrowVaultSummaryProps> = ({ mission }) => {
  const authorized = mission?.escrowAuthorizedTotal || 0;
  const paid = mission?.escrowPaidTotal || 0;
  const locked = Math.max(0, authorized - paid);
  const totalTasks = mission?.tasks.length || 0;
  const completedTasks = mission?.tasks.filter(t => t.status === 'paid').length || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Authorized Pool */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Authorized Escrow</span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            ${authorized.toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
            <span>PayPal Intent:</span>
            <span className="text-blue-400 font-mono">AUTHORIZE</span>
          </p>
        </div>
      </div>

      {/* 2. Locked in Escrow */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Locked in Active Escrow</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
            ${locked.toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Awaiting Evaluator QA verification
          </p>
        </div>
      </div>

      {/* 3. Disbursed via PayPal Payouts */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Autonomous Payouts Settled</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            ${paid.toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
            <span>PayPal Payouts:</span>
            <span className="text-emerald-400 font-mono">INSTANT_BATCH</span>
          </p>
        </div>
      </div>

      {/* 4. Swarm Milestone Velocity */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Milestone Completion</span>
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold font-mono text-purple-300 tracking-tight">
            {completedTasks} / {totalTasks}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}% verified & paid` : 'Swarm ready to execute'}
          </p>
        </div>
      </div>
    </div>
  );
};
