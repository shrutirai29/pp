'use client';

import React, { useState } from 'react';
import { X, Sparkles, Sliders, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface NewMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchMission: (title: string, goal: string, category: string, budget: number, guardrail: number) => void;
}

export const NewMissionModal: React.FC<NewMissionModalProps> = ({
  isOpen,
  onClose,
  onLaunchMission,
}) => {
  const [title, setTitle] = useState('Payment Gateway Security Audit');
  const [goal, setGoal] = useState('Audit the payment gateway API, identify security weaknesses, and produce a CVE remediation playbook.');
  const [category, setCategory] = useState('Security Audit');
  const [budget, setBudget] = useState(18.00);
  const [guardrail, setGuardrail] = useState(15.00);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    onLaunchMission(title, goal, category, budget, guardrail);
    onClose();
  };

  const categories = [
    'Security Audit',
    'Market Intelligence',
    'Pricing Analysis',
    'Technical Documentation',
    'AI Agent Commerce',
    'Custom Mission',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-[#E3E8F5] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#8055F7] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#101936]">Create New Agent Mission</h3>
              <p className="text-[10px] text-slate-400">Decompose goal into contracts & PayPal escrow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Mission Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-[#4361F7]"
              placeholder="e.g. Payment Gateway Security Audit"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Mission Objective / Prompt</label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-[#4361F7] resize-none"
              placeholder="Describe what the agent swarm should accomplish..."
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Mission Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-1.5 px-2 rounded-xl border text-center font-semibold text-[10px] transition ${
                    category === cat
                      ? 'bg-[#EEF2FF] border-[#4361F7] text-[#4361F7]'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Total Budget</span>
                <span className="font-bold text-[#4361F7] font-mono">${budget.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="0.5"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value))}
                className="w-full accent-[#4361F7]"
              />
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Guardrail Cap</span>
                <span className="font-bold text-amber-600 font-mono">${guardrail.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                step="1"
                value={guardrail}
                onChange={(e) => setGuardrail(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#4361F7] to-[#8055F7] text-white font-bold shadow-md shadow-blue-500/20 hover:opacity-95 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Deploy Swarm & Authorize</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
