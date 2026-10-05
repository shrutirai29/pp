'use client';

import React from 'react';
import { X, CheckCircle, ShieldCheck, DollarSign, ExternalLink, Clock, FileText } from 'lucide-react';
import { TaskContract } from '@/types';

interface DeliverableModalProps {
  task: TaskContract | null;
  onClose: () => void;
}

export const DeliverableModal: React.FC<DeliverableModalProps> = ({ task, onClose }) => {
  if (!task) return null;

  const deliverable = task.deliverable;
  const isPaid = task.status === 'paid' || task.status === 'settled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-cyan-400 font-bold">{task.id}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {task.assignedAgentName}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mt-0.5">{task.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Deliverable Summary */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Agent Deliverable & Execution
            </h4>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {deliverable?.content || 'No deliverable generated yet.'}
            </div>
          </div>

          {/* Evaluator QA Audit */}
          <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-purple-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>JudgeLex QA Verification Audit</span>
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Score: {deliverable?.qualityScore || 0}/100
              </span>
            </div>
            <p className="text-xs text-purple-200/80 leading-normal">
              {deliverable?.evaluatorFeedback || 'Evaluating against acceptance criteria...'}
            </p>
          </div>

          {/* PayPal Settlement Proof */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>PayPal Escrow & Payout Receipt</span>
              </span>
              {isPaid ? (
                <span className="flex items-center space-x-1 text-xs text-emerald-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Settled via PayPal Payouts</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-xs text-amber-400 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Held in PayPal Escrow</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800/80">
                <span className="text-slate-500 block text-[11px]">Payout Batch ID:</span>
                <span className="font-mono text-slate-200 font-semibold truncate block mt-0.5">
                  {task.paypalPayoutBatchId || 'Pending release'}
                </span>
              </div>
              <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800/80">
                <span className="text-slate-500 block text-[11px]">Recipient Wallet:</span>
                <span className="font-mono text-cyan-400 truncate block mt-0.5">
                  {task.assignedAgentEmail}
                </span>
              </div>
              <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800/80">
                <span className="text-slate-500 block text-[11px]">Settlement Amount:</span>
                <span className="font-mono text-emerald-400 font-bold block mt-0.5">
                  ${task.budget.toFixed(2)} USD
                </span>
              </div>
              <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800/80">
                <span className="text-slate-500 block text-[11px]">Settlement Timestamp:</span>
                <span className="font-mono text-slate-400 block mt-0.5">
                  {task.paidAt ? new Date(task.paidAt).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
