'use client';

import React from 'react';
import { ShieldCheck, Cpu, Key, HelpCircle, ExternalLink, ShieldAlert } from 'lucide-react';
import { PayPalConfig } from '@/types';

interface HeaderProps {
  paypalConfig: PayPalConfig;
  onOpenSettings: () => void;
  onOpenDocs: () => void;
  guardrailLimit: number;
}

export const Header: React.FC<HeaderProps> = ({
  paypalConfig,
  onOpenSettings,
  onOpenDocs,
  guardrailLimit,
}) => {
  const isLive = paypalConfig.mode === 'live_sandbox';

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white tracking-tight">PayAgent</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                Protocol v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Agent-to-Agent Commerce with PayPal</p>
          </div>
        </div>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center space-x-3">
          {/* Safety Guardrail Pill */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Guardrail Cap: <strong className="font-mono">${guardrailLimit.toFixed(2)}</strong></span>
          </div>

          {/* PayPal Sandbox Status Badge */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isLive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLive ? 'bg-emerald-400' : 'bg-blue-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isLive ? 'bg-emerald-500' : 'bg-blue-500'
              }`} />
            </span>
            <span>{isLive ? 'PayPal Live Sandbox' : 'Sandbox Simulation'}</span>
            <Key className="w-3.5 h-3.5 opacity-60 ml-1" />
          </button>

          {/* Quick Guide / Pitch Button */}
          <button
            onClick={onOpenDocs}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title="How PayAgent Works"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
