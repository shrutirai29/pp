import React from 'react';
import { ShieldCheck, Lock, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-navy-800/80 bg-navy-950 py-8 text-xs text-slate-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="h-4 w-4 text-electric-400" />
              <span className="font-semibold text-slate-300">DealMind + IntentLock</span>
            </div>
            <span className="text-navy-700">•</span>
            <div className="flex items-center gap-1 text-slate-400">
              <Lock className="h-3.5 w-3.5 text-violet-400" />
              <span>Independent Verification Layer</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <span className="flex items-center gap-1">
              <span>Phase 3 Security Gateway</span>
              <span className="h-1.5 w-1.5 rounded-full bg-electric-400" />
              <span className="text-slate-500">Cryptographic Fingerprints & Human Approval Gate</span>
            </span>
            <span className="hidden sm:inline text-navy-700">|</span>
            <span className="text-slate-500">
              PayPal Sandbox Integration scheduled for Phase 4
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-navy-900 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-600 gap-2">
          <p>
            Demonstration application developed for AI Commerce & Security Hackathon. No live transaction execution or real retailer negotiation occurs.
          </p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer flex items-center gap-1">
              IntentLock Specs <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
