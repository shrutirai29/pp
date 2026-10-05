'use client';

import React from 'react';
import {
  Home,
  PlusCircle,
  Cpu,
  Table,
  Lock,
  Zap,
  Sparkles,
  Settings,
  BookOpen,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLiveSandbox: boolean;
  onToggleSandbox: (live: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isLiveSandbox,
  onToggleSandbox,
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'new_mission', label: 'New Mission', icon: PlusCircle },
    { id: 'agent_swarm', label: 'Agent Swarm', icon: Cpu },
    { id: 'audit_ledger', label: 'Audit Ledger', icon: Table },
    { id: 'escrow_vault', label: 'Escrow Vault', icon: Lock },
    { id: 'activity_stream', label: 'Activity Stream', icon: Zap },
    { id: 'mission_presets', label: 'Mission Presets', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'docs_guide', label: 'Docs & Guide', icon: BookOpen },
  ];

  return (
    <aside className="w-60 bg-white border-r border-[#E3E8F5] flex flex-col justify-between h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-100 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4361F7] via-[#8055F7] to-[#44C8F5] p-0.5 flex items-center justify-center shadow-md shadow-blue-500/20">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#4361F7]" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#101936] tracking-tight leading-none">
              PayAgent
            </h2>
            <p className="text-[10px] text-[#65708D] font-medium mt-1 leading-tight">
              AI Agents. Real Work. Real Payments.
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#4361F7] shadow-sm'
                    : 'text-[#65708D] hover:text-[#101936] hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-[#4361F7]' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer with 3D Cubes & PayPal Status */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        {/* Isometric 3D glowing cubes graphic */}
        <div className="h-14 rounded-2xl bg-gradient-to-tr from-blue-50 via-indigo-50 to-purple-50 border border-blue-100/60 p-2 flex items-center justify-center relative overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#003087] to-[#00CFDE] flex items-center justify-center text-white font-bold text-xs shadow-md">
            P
          </div>
          <span className="ml-2 text-[10px] text-[#4361F7] font-bold">PayPal Sandbox</span>
        </div>

        {/* Powered by PayPal label */}
        <div className="text-[10px] text-slate-400 leading-tight">
          <span className="font-semibold text-slate-600 block">Powered by &gt; PayPal</span>
          <span>Secure Payments Global Possibilities</span>
        </div>

        {/* Environment toggle switch */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-bold text-slate-700">Sandbox</span>
          <button
            onClick={() => onToggleSandbox(!isLiveSandbox)}
            className={`w-10 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
              isLiveSandbox ? 'bg-[#4361F7]' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                isLiveSandbox ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-[11px] font-bold text-slate-700">Live</span>
        </div>
      </div>
    </aside>
  );
};
