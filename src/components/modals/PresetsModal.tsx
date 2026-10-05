'use client';

import React from 'react';
import { X, Sparkles, ArrowRight, ShieldCheck, DollarSign, Cpu, FileText } from 'lucide-react';

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetIndex: number) => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
}) => {
  if (!isOpen) return null;

  const presets = [
    {
      title: 'Autonomous Security & Risk Audit',
      category: 'Security Audit',
      description: 'Audit the payment gateway API for OWASP vulnerabilities, rate limiting thresholds, and produce a CVE remediation playbook.',
      budget: 15.00,
      guardrail: 15.00,
      agents: ['Cipher', 'Nova', 'Synthex'],
      icon: ShieldCheck,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      title: 'Competitor Pricing Arbitrage Dossier',
      category: 'Market Intelligence',
      description: 'Scrape cross-platform SaaS tier pricing across 6 competitors, compute elasticity indices, and generate GTM pricing models.',
      budget: 20.00,
      guardrail: 15.00,
      agents: ['Metric', 'Nova', 'Synthex'],
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'AI Agent Commerce Protocol Whitepaper',
      category: 'AI Agent Commerce',
      description: 'Research cryptographic escrow patterns, benchmark PayPal Payouts batch settlement latency, and synthesize economic RFC specs.',
      budget: 16.50,
      guardrail: 15.00,
      agents: ['Nova', 'Cipher', 'Synthex'],
      icon: Cpu,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
      title: 'API Surface & Schema Mapping',
      category: 'Technical Documentation',
      description: 'Map REST & GraphQL attack surfaces, extract schema entropy, flag deprecated headers, and build JSON fixtures.',
      budget: 12.00,
      guardrail: 15.00,
      agents: ['Nova', 'Synthex'],
      icon: FileText,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-[#E3E8F5] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#8055F7] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#101936]">Mission Presets</h3>
              <p className="text-[11px] text-slate-400">
                Launch pre-configured autonomous swarm workflows with verified PayPal budgets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets List */}
        <div className="p-6 overflow-y-auto space-y-3.5 text-xs">
          {presets.map((preset, idx) => {
            const Icon = preset.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-[#E2E8F0] hover:border-[#4361F7]/50 bg-[#F8FAFC] hover:bg-white hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${preset.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-[#101936] group-hover:text-[#4361F7] transition">
                        {preset.title}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#65708D] mt-1 leading-snug">
                      {preset.description}
                    </p>
                    <div className="flex items-center space-x-3 mt-2 text-[10px] text-slate-500 font-medium">
                      <span>
                        Budget: <strong className="text-slate-800">${preset.budget.toFixed(2)} USD</strong>
                      </span>
                      <span>
                        Swarm: <strong className="text-[#4361F7]">{preset.agents.join(', ')}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectPreset(idx);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-white group-hover:bg-[#4361F7] border border-[#E2E8F0] group-hover:border-[#4361F7] text-slate-700 group-hover:text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition shadow-sm cursor-pointer self-end sm:self-center flex-shrink-0"
                >
                  <span>Launch Preset</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-slate-600 hover:text-slate-900 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
