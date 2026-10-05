'use client';

import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, ChevronRight, Key, Sparkles, RefreshCw, FileText } from 'lucide-react';

interface BottomFeatureGridProps {
  onSelectPreset: (presetIndex: number) => void;
  onVerifyPayPal: () => void;
  isVerifyingPayPal: boolean;
  verifyMessage?: string;
  isLiveSandbox: boolean;
  onToggleSandbox: (live: boolean) => void;
}

export const BottomFeatureGrid: React.FC<BottomFeatureGridProps> = ({
  onSelectPreset,
  onVerifyPayPal,
  isVerifyingPayPal,
  verifyMessage,
  isLiveSandbox,
  onToggleSandbox,
}) => {
  const [activeTab, setActiveTab] = useState<'deliverable' | 'qa' | 'receipt'>('deliverable');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. JudgeLex QA Verification */}
      <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 pb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#4361F7] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#101936]">JudgeLex QA Verification</h4>
              <p className="text-[10px] text-slate-400">AI-powered objective evaluation</p>
            </div>
          </div>

          {/* Radial circular score progress gauge */}
          <div className="flex items-center space-x-4 my-3">
            <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="#E2E8F0" strokeWidth="6" fill="transparent" />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="#10B981"
                  strokeWidth="6"
                  strokeDasharray="201"
                  strokeDashoffset="16" // 92%
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-lg font-black text-slate-800 leading-none">92</span>
                <span className="text-[9px] text-slate-400 font-bold">/100</span>
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-1.5 text-[11px] text-slate-600 font-medium">
              <div className="flex items-center space-x-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
                <span>OWASP Compliance</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
                <span>Schema Validity</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
                <span>Code Diff Check</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
                <span>Report Quality</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Deliverable Inspector */}
      <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 pb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#8055F7] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#101936]">Deliverable Inspector</h4>
              <p className="text-[10px] text-slate-400">View actual work, QA report and payment proof</p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center space-x-1 border-b border-slate-100 pb-1.5 my-2 text-[11px]">
            <button
              onClick={() => setActiveTab('deliverable')}
              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                activeTab === 'deliverable'
                  ? 'bg-blue-50 text-[#4361F7]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Deliverable
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                activeTab === 'qa'
                  ? 'bg-blue-50 text-[#4361F7]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              QA Report
            </button>
            <button
              onClick={() => setActiveTab('receipt')}
              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                activeTab === 'receipt'
                  ? 'bg-blue-50 text-[#4361F7]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              PayPal Receipt
            </button>
          </div>

          {/* Content Area */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 font-mono text-[10px] text-slate-700 leading-relaxed overflow-x-auto h-[105px]">
            {activeTab === 'deliverable' && (
              <div>
                <p className="text-slate-400">1 <span className="text-blue-600 font-bold"># Payment Gateway Security Audit</span></p>
                <p className="text-slate-400">2 <span className="text-purple-600 font-bold">## Executive Summary</span></p>
                <p className="text-slate-400">3 We analyzed the API surface and identified</p>
                <p className="text-slate-400">4 3 high severity vulnerabilities...</p>
              </div>
            )}
            {activeTab === 'qa' && (
              <div>
                <p className="text-emerald-600 font-bold">JudgeLex QA: Approved (92/100)</p>
                <p className="text-slate-600 mt-1">Acceptance criteria 1, 2, 3 validated.</p>
                <p className="text-slate-500">Hash: sha256:e8b23c91a0f88219</p>
              </div>
            )}
            {activeTab === 'receipt' && (
              <div>
                <p className="text-slate-700 font-bold">PayPal Batch: PO-BATCH-9A2F3B</p>
                <p className="text-emerald-600 font-bold">Disbursed: $15.00 USD</p>
                <p className="text-slate-500">To: cipher.sec@payagent.sandbox</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Mission Presets */}
      <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 pb-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-[#44C8F5] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#101936]">Mission Presets</h4>
              <p className="text-[10px] text-slate-400">Get started with one click</p>
            </div>
          </div>

          <div className="space-y-1.5 mt-2">
            {[
              'Security & Risk Audit',
              'Competitor Pricing Analysis',
              'AI Agent Commerce Whitepaper',
              'Market Intelligence Dossier',
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPreset(idx)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#EEF2FF] border border-[#E2E8F0] hover:border-[#C7D2FE] text-left text-[11px] font-semibold text-slate-700 hover:text-[#4361F7] transition flex items-center justify-between group cursor-pointer"
              >
                <span className="truncate">{preset}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#4361F7] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Settings & Integration */}
      <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 pb-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#8055F7] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#101936]">Settings & Integration</h4>
              <p className="text-[10px] text-slate-400">Configure PayPal, limits and environment</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 my-2">
            <button
              onClick={() => onToggleSandbox(false)}
              className={`py-1 rounded-lg text-[10px] font-bold text-center transition ${
                !isLiveSandbox
                  ? 'bg-[#EEF2FF] text-[#4361F7] border border-[#C7D2FE]'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              Simulation Mode
            </button>
            <button
              onClick={() => onToggleSandbox(true)}
              className={`py-1 rounded-lg text-[10px] font-bold text-center transition ${
                isLiveSandbox
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              Live Sandbox
            </button>
          </div>

          {/* Dummy/Secret Inputs */}
          <div className="space-y-1.5 text-[10px]">
            <input
              type="text"
              readOnly
              value="Client ID: ••••••••••••••••"
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1 text-slate-500 font-mono text-[9px]"
            />
            <input
              type="password"
              readOnly
              value="Client Secret: ••••••••••••••••"
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1 text-slate-500 font-mono text-[9px]"
            />
          </div>

          {/* Verify Button */}
          <button
            onClick={onVerifyPayPal}
            disabled={isVerifyingPayPal}
            className="w-full mt-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#4361F7] to-[#8055F7] text-white text-[10px] font-bold shadow-md shadow-blue-500/20 hover:opacity-95 transition flex items-center justify-center space-x-1 cursor-pointer"
          >
            {isVerifyingPayPal ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>Verify & Test OAuth2 Handshake</span>
          </button>
          {verifyMessage && (
            <p className="text-[9px] text-emerald-600 font-medium text-center mt-1 truncate">
              {verifyMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
