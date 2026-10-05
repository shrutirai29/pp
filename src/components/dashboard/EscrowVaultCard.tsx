'use client';

import React from 'react';
import { Lock, CheckCircle2, TrendingUp } from 'lucide-react';
import { TaskContract } from '@/types';

interface EscrowVaultCardProps {
  tasks: TaskContract[];
}

export const EscrowVaultCard: React.FC<EscrowVaultCardProps> = ({ tasks }) => {
  const authorized = 342.00;
  const locked = 120.00;
  const settled = 247.50;
  const total = 12;
  const completed = 9;
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black">
            P
          </div>
          <h3 className="text-sm font-bold text-[#101936]">Escrow Vault</h3>
          <span className="flex items-center space-x-1 text-[11px] text-slate-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Live</span>
          </span>
        </div>
      </div>

      {/* Main Vault Visual & Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-4">
        {/* Left: Big Authorized balance + 3D Padlock Artwork */}
        <div className="sm:col-span-6 flex flex-col items-center sm:items-start space-y-2">
          <div className="text-3xl font-extrabold text-[#101936] font-sans tracking-tight">
            ${authorized.toFixed(2)}
          </div>
          <p className="text-xs text-[#65708D] font-medium">Total Authorized Escrow</p>

          {/* 3D Glowing Padlock SVG Artwork on stacked blue pedestals */}
          <div className="pt-2 flex justify-center w-full">
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Stacked Pedestal Base */}
              <div className="absolute bottom-1 w-24 h-6 bg-blue-100 rounded-[100%] border border-blue-200" />
              <div className="absolute bottom-3 w-20 h-6 bg-blue-200 rounded-[100%] border border-blue-300" />
              <div className="absolute bottom-5 w-16 h-6 bg-blue-400 rounded-[100%] shadow-md" />

              {/* Glowing 3D Glass Padlock */}
              <div className="relative z-10 w-14 h-16 bg-gradient-to-tr from-[#003087] via-[#0070BA] to-[#00CFDE] rounded-xl p-0.5 shadow-lg shadow-blue-500/30 flex flex-col items-center justify-center transform hover:scale-105 transition-transform">
                {/* Shackle */}
                <div className="absolute -top-4 w-7 h-6 border-4 border-cyan-300 rounded-t-full bg-transparent" />
                {/* Keyhole */}
                <div className="w-2.5 h-2.5 rounded-full bg-white/90 shadow-sm mt-1" />
                <div className="w-1.5 h-3 bg-white/90 rounded-b-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Escrow Breakdown Metrics */}
        <div className="sm:col-span-6 space-y-3">
          <div className="flex items-center space-x-3 p-2 rounded-xl bg-blue-50/60 border border-blue-100">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-[#4361F7]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">${locked.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500">Locked in Active Escrow</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">${settled.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500">Payouts Settled</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-2 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">{percentage}%</div>
              <div className="text-[10px] text-slate-500">Milestone Completion ({completed} / {total})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
