import React from 'react';
import { 
  ShieldCheck, 
  Search, 
  LayoutDashboard, 
  MessageSquareCode, 
  History, 
  Layers,
  ChevronDown,
  X
} from 'lucide-react';
import { NavView } from './Navbar';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  activeDealTitle?: string;
  isDealActive?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  activeDealTitle = '1TB NVMe SSD',
  isDealActive = true,
  isOpen = false,
  onClose,
}) => {
  const navItems: { id: NavView; label: string; icon: React.ComponentType<{ className?: string }>; requiresDeal?: boolean }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'find-deal',
      label: 'Find a Deal',
      icon: Search,
    },
    {
      id: 'workspace',
      label: 'Deal Workspace',
      icon: Layers,
      requiresDeal: true,
    },
    {
      id: 'negotiation',
      label: 'Negotiation Agent',
      icon: MessageSquareCode,
      requiresDeal: true,
    },
    {
      id: 'intentlock',
      label: 'IntentLock™',
      icon: ShieldCheck,
      requiresDeal: true,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: History,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-[#24203D] bg-[#15152B] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Branding + Navigation */}
        <div className="flex flex-col">
          {/* Header & Logo */}
          <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-[#24203D]/60">
            <div 
              onClick={() => {
                onNavigate('dashboard');
                onClose?.();
              }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6955C9] to-[#24203D] border border-[#6955C9]/40 shadow-sm shadow-[#6955C9]/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tracking-tight text-white">DealMind</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E9E8F8]/10 text-[#8F86D8] border border-[#8F86D8]/30">
                    IntentLock™
                  </span>
                </div>
                <span className="text-[11px] text-[#68657A] font-medium tracking-tight">
                  Verified Autonomous Commerce Agent
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button 
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-[#68657A] hover:text-white hover:bg-[#24203D] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-1.5 px-4 py-5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isDisabled = item.requiresDeal && !isDealActive;

              return (
                <button
                  key={item.id}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onNavigate(item.id);
                      onClose?.();
                    }
                  }}
                  className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#24203D] text-white shadow-sm border border-[#6955C9]/30'
                      : isDisabled
                      ? 'text-[#68657A]/40 cursor-not-allowed'
                      : 'text-[#68657A] hover:text-white hover:bg-[#24203D]/50'
                  }`}
                >
                  {/* Active Indicator Accent Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#6955C9]" />
                  )}

                  <Icon 
                    className={`h-4 w-4 transition-colors ${
                      isActive 
                        ? 'text-[#8F86D8]' 
                        : isDisabled 
                        ? 'text-[#68657A]/40' 
                        : 'text-[#68657A] group-hover:text-white'
                    }`} 
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Active Deal Card & User Profile */}
        <div className="flex flex-col gap-3 p-4 border-t border-[#24203D]/60 bg-[#15152B]">
          {/* Active Deal Card */}
          <div className="rounded-xl border border-[#24203D] bg-[#24203D]/40 p-3.5 transition-all">
            <div className="flex items-center justify-between text-xs text-[#68657A] mb-1">
              <span className="font-medium uppercase tracking-wider text-[10px]">Active Deal</span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#4FAF91]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4FAF91] animate-pulse" />
                Active
              </span>
            </div>
            <p className="text-sm font-semibold text-white truncate">
              {activeDealTitle}
            </p>
          </div>

          {/* User Profile */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-[#24203D]/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#6955C9] to-[#F5B69E] text-white font-semibold text-xs shadow-sm">
                SR
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white leading-tight">Shruti Rai</span>
                <span className="text-[11px] text-[#68657A]">Security Administrator</span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-[#68657A]" />
          </div>
        </div>
      </aside>
    </>
  );
};

