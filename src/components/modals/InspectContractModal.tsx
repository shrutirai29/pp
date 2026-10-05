'use client';

import React, { useState } from 'react';
import { X, FileText, ShieldCheck, DollarSign, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { TaskContract } from '@/types';

interface InspectContractModalProps {
  task: TaskContract | null;
  onClose: () => void;
}

export const InspectContractModal: React.FC<InspectContractModalProps> = ({ task, onClose }) => {
  const [activeTab, setActiveTab] = useState<'deliverable' | 'qa' | 'receipt'>('deliverable');

  if (!task) return null;

  const deliverable = task.deliverable;
  const isSettled = task.status === 'settled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-[#E3E8F5] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#4361F7] flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-[#4361F7]">{task.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700">
                  {task.assignedAgentName}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#101936] mt-0.5">{task.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-4 px-6 border-b border-slate-100 text-xs">
          <button
            onClick={() => setActiveTab('deliverable')}
            className={`py-3 font-bold border-b-2 transition ${
              activeTab === 'deliverable'
                ? 'border-[#4361F7] text-[#4361F7]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Deliverable & Code
          </button>
          <button
            onClick={() => setActiveTab('qa')}
            className={`py-3 font-bold border-b-2 transition ${
              activeTab === 'qa'
                ? 'border-[#4361F7] text-[#4361F7]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            JudgeLex QA Report
          </button>
          <button
            onClick={() => setActiveTab('receipt')}
            className={`py-3 font-bold border-b-2 transition ${
              activeTab === 'receipt'
                ? 'border-[#4361F7] text-[#4361F7]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            PayPal Receipt & Escrow
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'deliverable' && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">Agent Deliverable Output</h4>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {deliverable?.content || 'No deliverable submitted yet.'}
              </div>
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-purple-900">JudgeLex QA Verification</h4>
                  <p className="text-[11px] text-purple-700">Threshold requirement: &gt;= 80/100 to release escrow</p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-purple-200 text-purple-900 font-mono font-bold text-sm">
                  {deliverable?.qualityScore || 0} / 100
                </div>
              </div>

              {deliverable?.evaluatorFeedback && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  <span className="font-bold block mb-1">Evaluator Feedback:</span>
                  <p>{deliverable.evaluatorFeedback}</p>
                </div>
              )}

              {deliverable?.criteriaResults && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 block">Acceptance Criteria Checklist:</span>
                  {deliverable.criteriaResults.map((crit, idx) => (
                    <div key={idx} className="flex items-start space-x-2 p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      {crit.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold text-slate-800">{crit.name}</span>
                        <p className="text-[11px] text-slate-500">{crit.evidence}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'receipt' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-blue-900">PayPal Developer Platform Transaction</h4>
                  <p className="text-[11px] text-blue-700">
                    Status: {isSettled ? 'Disbursed via PayPal Payouts' : 'Authorized in Escrow Pool'}
                  </p>
                </div>
                <span className="font-mono text-base font-extrabold text-blue-900">
                  ${task.budget.toFixed(2)} USD
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-slate-400 block text-[10px]">PayPal Order ID:</span>
                  <span className="font-mono font-bold text-slate-800">{task.paypalOrderId || 'ORD-SIMULATED'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-slate-400 block text-[10px]">PayPal Authorization ID:</span>
                  <span className="font-mono font-bold text-slate-800">{task.paypalAuthorizationId || 'AUTH-SIMULATED'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-slate-400 block text-[10px]">Payout Batch ID:</span>
                  <span className="font-mono font-bold text-emerald-600">{task.paypalPayoutBatchId || 'Pending QA Approval'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-slate-400 block text-[10px]">Recipient Email:</span>
                  <span className="font-mono font-bold text-slate-800">{task.assignedAgentEmail}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
