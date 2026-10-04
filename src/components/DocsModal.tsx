'use client';

import React from 'react';
import { X, BookOpen, Cpu, ShieldCheck, ArrowRight, DollarSign, Award } from 'lucide-react';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">About PayAgent Protocol</h3>
              <p className="text-[11px] text-slate-400">PayPal + AI Hackathon 2026 Architectural Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-4">
            <h4 className="font-semibold text-blue-300 mb-1 flex items-center space-x-1.5">
              <Cpu className="w-4 h-4" />
              <span>The Autonomous Commerce Challenge</span>
            </h4>
            <p className="text-blue-200/80">
              Autonomous AI agents can write code, audit smart contracts, and scrape data, but they lack economic agency: they cannot safely procure specialized services or settle payments with other agents without exposing credit cards or risking fraud.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">How PayAgent Solves This with PayPal</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <span className="font-mono text-cyan-400 font-bold block mb-1">1. Smart Escrow Vault</span>
                <p className="text-slate-400 text-[11px]">
                  Uses <strong>PayPal Orders v2 API</strong> with <code className="text-slate-300">intent: 'AUTHORIZE'</code>. Client funds are reserved up-front so worker agents have guaranteed solvency before starting work.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <span className="font-mono text-emerald-400 font-bold block mb-1">2. Instant Batch Payouts</span>
                <p className="text-slate-400 text-[11px]">
                  Uses <strong>PayPal Payouts API</strong> (<code className="text-slate-300">/v1/payments/payouts</code>). When work passes quality review, funds disburse in sub-seconds directly to worker agent PayPal wallets.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <span className="font-mono text-purple-400 font-bold block mb-1">3. Autonomous Evaluator (QA)</span>
                <p className="text-slate-400 text-[11px]">
                  An objective <strong>JudgeLex QA Agent</strong> inspects code diffs and acceptance criteria. Escrow is only unlocked if the quality score meets threshold (&gt;= 80).
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <span className="font-mono text-amber-400 font-bold block mb-1">4. Human-in-the-Loop Guardrail</span>
                <p className="text-slate-400 text-[11px]">
                  Configurable spending limits stop rogue agents from exceeding micro-budgets without human confirmation.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h4 className="font-semibold text-white mb-2 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>Target Hackathon Prizes</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
              <li><strong>Grand Prize ($12,000)</strong>: Complete end-to-end integration of PayPal Developer Platform with multi-agent orchestration.</li>
              <li><strong>Best Use of Agentic Commerce ($5,000)</strong>: True autonomous machine-to-machine payment protocol with milestone escrow.</li>
              <li><strong>Best Use of AG Grid ($5,000)</strong>: Enterprise audit cockpit showing real-time transaction statuses, sorting, filtering, and CSV export.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
