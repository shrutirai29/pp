'use client';

import React, { useState } from 'react';
import { ArrowRight, Bell, ChevronDown, Sparkles } from 'lucide-react';

interface TopBarProps {
  onSubmitMission: (prompt: string) => void;
  isLiveSandbox: boolean;
  onToggleSandbox: (live: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onSubmitMission,
  isLiveSandbox,
  onToggleSandbox,
}) => {
  const [prompt, setPrompt] = useState('');

  const chips = [
    { label: 'Audit payment gateway API >', fullPrompt: 'Audit the payment gateway API, identify security weaknesses, and produce a CVE remediation playbook.' },
    { label: 'Competitor pricing analysis >', fullPrompt: 'Perform cross-platform competitor pricing analysis, compute margin elasticity, and draft GTM tiers.' },
    { label: 'Security risk assessment', fullPrompt: 'Execute threat modeling and security risk assessment on multi-party payout transactions.' },
    { label: 'Market intelligence', fullPrompt: 'Collect market intelligence and produce an AI agent micro-commerce whitepaper.' },
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && prompt.trim()) {
      onSubmitMission(prompt);
      setPrompt('');
    }
  };

  const handleChipClick = (fullPrompt: string) => {
    setPrompt(fullPrompt);
    onSubmitMission(fullPrompt);
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-[#E3E8F5] sticky top-0 z-20 px-6 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Natural Language Prompt Search Bar & Chips */}
        <div className="flex-1 max-w-2xl">
          <div className="relative flex items-center">
            <Sparkles className="w-4 h-4 text-[#8055F7] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Describe your mission in natural language..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl pl-10 pr-10 py-2.5 text-xs text-[#101936] placeholder-[#65708D] focus:outline-none focus:border-[#4361F7] focus:bg-white transition shadow-sm font-sans"
            />
            <button
              onClick={() => {
                if (prompt.trim()) {
                  onSubmitMission(prompt);
                  setPrompt('');
                }
              }}
              className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#4361F7] to-[#8055F7] text-white flex items-center justify-center absolute right-2 hover:opacity-90 transition cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Prompt Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pt-2 scrollbar-none">
            {chips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(chip.fullPrompt)}
                className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-[#F1F5F9] hover:bg-[#EEF2FF] text-slate-600 hover:text-[#4361F7] transition whitespace-nowrap cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls: Mode Selector, Notifications & User */}
        <div className="flex items-center space-x-3 self-end lg:self-center">
          {/* Environment Selector */}
          <div className="relative">
            <button
              onClick={() => onToggleSandbox(!isLiveSandbox)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[#4361F7] text-xs font-semibold cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#4361F7] animate-pulse" />
              <span>{isLiveSandbox ? 'Live Sandbox' : 'Sandbox Mode'}</span>
              <ChevronDown className="w-3 h-3 text-[#4361F7]" />
            </button>
          </div>

          {/* Notifications */}
          <div className="relative p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-slate-600 hover:text-slate-900 cursor-pointer">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              3
            </span>
          </div>

          {/* User Profile Chip */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              S
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-[#101936] leading-none flex items-center space-x-1">
                <span>Shruti</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <span className="text-[10px] text-[#65708D] font-medium">Team Builder</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
