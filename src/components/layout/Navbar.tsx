import React from 'react';
import { 
  ShieldCheck, 
  Search, 
  LayoutDashboard, 
  MessageSquareCode, 
  History, 
  Layers
} from 'lucide-react';

export type NavView = 'dashboard' | 'find-deal' | 'workspace' | 'negotiation' | 'intentlock' | 'audit';

interface NavbarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  activeDealTitle?: string;
  isDealActive?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  activeDealTitle,
  isDealActive = true,
}) => {
  const navItems: { id: NavView; label: string; icon: React.ReactNode; requiresDeal?: boolean }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'find-deal',
      label: 'Find a Deal',
      icon: <Search className="h-4 w-4" />,
    },
    {
      id: 'workspace',
      label: 'Deal Workspace',
      icon: <Layers className="h-4 w-4" />,
      requiresDeal: true,
    },
    {
      id: 'negotiation',
      label: 'Negotiation Agent',
      icon: <MessageSquareCode className="h-4 w-4" />,
      requiresDeal: true,
    },
    {
      id: 'intentlock',
      label: 'IntentLock™',
      icon: <ShieldCheck className="h-4 w-4" />,
      requiresDeal: true,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: <History className="h-4 w-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-navy-800 bg-navy-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div 
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500 to-violet-600 shadow-md shadow-electric-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">DealMind</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-400 border border-violet-800/40">
                IntentLock
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Verified Autonomous Commerce Agent
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-navy-900/60 p-1 rounded-xl border border-navy-800">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            const isDisabled = item.requiresDeal && !isDealActive;

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && onNavigate(item.id)}
                disabled={isDisabled}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-navy-800 text-electric-400 shadow-sm border border-navy-700/80'
                    : isDisabled
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-850/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Info Badge */}
        <div className="flex items-center gap-3">
          {activeDealTitle && (
            <div className="hidden xl:flex items-center gap-2 text-xs bg-navy-900 px-3 py-1.5 rounded-lg border border-navy-800 max-w-xs truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-slate-400">Active:</span>
              <span className="text-slate-200 font-medium truncate">{activeDealTitle}</span>
            </div>
          )}
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-navy-900 text-slate-400 border border-navy-800">
            DEMO MODE
          </span>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 bg-navy-900/90 border-t border-navy-850 scrollbar-none gap-1">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const isDisabled = item.requiresDeal && !isDealActive;
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              disabled={isDisabled}
              className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs rounded-md ${
                isActive
                  ? 'bg-electric-500/20 text-electric-400 font-semibold border border-electric-500/30'
                  : isDisabled
                  ? 'text-slate-600 opacity-40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
