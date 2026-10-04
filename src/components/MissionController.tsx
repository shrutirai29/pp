'use client';

import React, { useState } from 'react';
import { Play, Sparkles, Sliders, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { PRESET_MISSIONS } from '@/lib/agents';

interface MissionControllerProps {
  onStartMission: (goal: string, budget: number, guardrail: number) => Promise<void>;
  isRunning: boolean;
  currentStep: string;
}

export const MissionController: React.FC<MissionControllerProps> = ({
  onStartMission,
  isRunning,
  currentStep,
}) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [goal, setGoal] = useState(PRESET_MISSIONS[0].goal);
  const [budget, setBudget] = useState(PRESET_MISSIONS[0].budget);
  const [guardrail, setGuardrail] = useState(15.00);

  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    setGoal(PRESET_MISSIONS[index].goal);
    setBudget(PRESET_MISSIONS[index].budget);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isRunning) return;
    onStartMission(goal, budget, guardrail);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Mission Control & Swarm Objectives</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Orchestrator automatically breaks goals into discrete deliverables, requests agent bids, holds PayPal escrow, and settles payouts.
          </p>
        </div>

        {/* Preset Selector Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_MISSIONS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isRunning}
              onClick={() => handleSelectPreset(idx)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                selectedPresetIndex === idx
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 font-medium'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              } disabled:opacity-50`}
            >
              Preset {idx + 1}: {preset.title.split(' ')[1] || 'Mission'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Goal text input */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Objective / Prompt for Autonomous Swarm
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isRunning}
            rows={2}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition font-sans resize-none"
            placeholder="Describe the objective for the agents to collaborate and execute..."
          />
        </div>

        {/* Parameters row: Budget & Guardrail */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Max Mission Budget (PayPal Authorization)</span>
              </span>
              <span className="font-mono text-blue-400 font-semibold">${budget.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="0.5"
              value={budget}
              disabled={isRunning}
              onChange={(e) => setBudget(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer disabled:opacity-50"
            />
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Human-in-the-Loop Cap per Task</span>
              </span>
              <span className="font-mono text-amber-400 font-semibold">${guardrail.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={guardrail}
              disabled={isRunning}
              onChange={(e) => setGuardrail(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer disabled:opacity-50"
            />
          </div>
        </div>

        {/* Execution trigger & status */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400 flex items-center space-x-2">
            {isRunning ? (
              <span className="flex items-center space-x-2 text-cyan-400 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{currentStep || 'Swarm executing protocol steps...'}</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-slate-500">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Escrow locked on start. Funds released only after QA passes.</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isRunning || !goal.trim()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Swarm & PayPal...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Deploy Swarm & Authorize Escrow (${budget.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
