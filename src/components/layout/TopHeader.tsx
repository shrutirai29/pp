import React from 'react';
import { Bell, Plus, Menu } from 'lucide-react';

interface TopHeaderProps {
  onNewDeal: () => void;
  onToggleSidebar?: () => void;
  isServerOnline?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onNewDeal,
  onToggleSidebar,
  isServerOnline = false,
}) => {
  // Compute contextual greeting based on local hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning, Shruti';
    if (hour < 17) return 'Good afternoon, Shruti';
    return 'Good evening, Shruti';
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-[#24203D] bg-[#15152B]/90 px-6 sm:px-8 backdrop-blur-md">
      {/* Left: Mobile Menu Toggle + Greeting */}
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl border border-[#24203D] text-[#68657A] hover:text-white hover:bg-[#24203D] transition-colors"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex flex-col">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {getGreeting()}
          </h1>
          <p className="text-xs sm:text-sm text-[#68657A]">
            Here's what's happening with your autonomous deals.
          </p>
        </div>
      </div>

      {/* Right: Server Status Indicator + Notifications + Create New Request Action */}
      <div className="flex items-center gap-3.5">
        {/* Gateway Enforcement Status Pill */}
        {isServerOnline ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-[#4FAF91]/10 text-[#4FAF91] border border-[#4FAF91]/25">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4FAF91] animate-pulse" />
            SERVER ENFORCED
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-[#24203D] text-[#68657A] border border-[#24203D]">
            CLIENT ENGINE
          </span>
        )}

        {/* Notifications Icon Button */}
        <button 
          className="relative p-2.5 rounded-xl border border-[#24203D] bg-[#24203D]/30 text-[#68657A] hover:text-white hover:border-[#6955C9]/40 hover:bg-[#24203D] transition-all"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#F5B69E] ring-2 ring-[#15152B]" />
        </button>

        {/* Create New Request Button - Warm Peach Accent */}
        <button
          onClick={onNewDeal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F5B69E] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#15152B] hover:bg-[#F8D0BE] active:scale-[0.98] transition-all shadow-sm shadow-[#F5B69E]/20"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Request</span>
        </button>
      </div>
    </header>
  );
};

