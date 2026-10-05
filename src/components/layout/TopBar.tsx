'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Sparkles,
  CheckCheck,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  X,
  User,
  Shield,
  Key,
} from 'lucide-react';

interface TopBarProps {
  onSubmitMission: (prompt: string) => void;
  isLiveSandbox: boolean;
  onToggleSandbox: (live: boolean) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'success' | 'qa' | 'warning';
  read: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onSubmitMission,
  isLiveSandbox,
  onToggleSandbox,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'PayPal Payout Succeeded',
      desc: 'Batch PO-BATCH-9A2F3B confirmed. $15.00 disbursed to cipher.sec@payagent.sandbox',
      time: '2m ago',
      type: 'success',
      read: false,
    },
    {
      id: 'notif-2',
      title: 'JudgeLex QA Verification Approved',
      desc: 'Contract SEC-014 scored 92/100 and passed OWASP compliance tests.',
      time: '5m ago',
      type: 'qa',
      read: false,
    },
    {
      id: 'notif-3',
      title: 'Spending Guardrail Flag',
      desc: 'Task MKT-027 ($20.00) triggered financial review under $15.00 cap.',
      time: '12m ago',
      type: 'warning',
      read: false,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const chips = [
    {
      label: 'Audit payment gateway API >',
      fullPrompt:
        'Audit the payment gateway API, identify security weaknesses, and produce a CVE remediation playbook.',
    },
    {
      label: 'Competitor pricing analysis >',
      fullPrompt:
        'Perform cross-platform competitor pricing analysis, compute margin elasticity, and draft GTM tiers.',
    },
    {
      label: 'Security risk assessment',
      fullPrompt:
        'Execute threat modeling and security risk assessment on multi-party payout transactions.',
    },
    {
      label: 'Market intelligence',
      fullPrompt:
        'Collect market intelligence and produce an AI agent micro-commerce whitepaper.',
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && prompt.trim()) {
      onSubmitMission(prompt);
      setPrompt('');
    }
  };

  const handleChipClick = (fullPrompt: string) => {
    setPrompt(fullPrompt);
    onSubmitMission(fullPrompt);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleNotifItem = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-[#E3E8F5] sticky top-0 z-40 px-6 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Natural Language Prompt Search Bar & Chips */}
        <div className="flex-1 max-w-2xl">
          <div className="relative flex items-center">
            <Sparkles className="w-4 h-4 text-[#8055F7] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Describe your mission in natural language..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl pl-10 pr-10 py-2.5 text-xs text-[#101936] placeholder-[#65708D] focus:outline-none focus:border-[#4361F7] focus:bg-white transition shadow-sm font-sans"
            />
            <button
              onClick={() => {
                if (prompt.trim()) {
                  onSubmitMission(prompt);
                  setPrompt('');
                }
              }}
              className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#4361F7] to-[#8055F7] text-white flex items-center justify-center absolute right-2 hover:opacity-90 transition cursor-pointer"
              title="Launch Mission"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Prompt Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pt-2 scrollbar-none">
            {chips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(chip.fullPrompt)}
                className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-[#F1F5F9] hover:bg-[#EEF2FF] text-slate-600 hover:text-[#4361F7] transition whitespace-nowrap cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls: Mode Selector, Notifications & User */}
        <div className="flex items-center space-x-3 self-end lg:self-center">
          {/* Environment Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => onToggleSandbox(!isLiveSandbox)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[#4361F7] text-xs font-semibold cursor-pointer hover:bg-blue-100 transition"
              title="Toggle Sandbox Mode"
            >
              <span className="w-2 h-2 rounded-full bg-[#4361F7] animate-pulse" />
              <span>{isLiveSandbox ? 'Live Sandbox' : 'Sandbox Mode'}</span>
              <ChevronDown className="w-3 h-3 text-[#4361F7]" />
            </button>
          </div>

          {/* Notifications Button & Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`relative p-2 rounded-xl border transition cursor-pointer ${
                isNotificationsOpen
                  ? 'bg-blue-50 border-blue-200 text-[#4361F7]'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E3E8F5] rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-bold text-[#101936]">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#4361F7] font-semibold border border-blue-100">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-semibold text-[#4361F7] hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                    <button
                      onClick={() => setIsNotificationsOpen(false)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No notifications at this time
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => toggleNotifItem(notif.id)}
                        className={`py-3 px-2 rounded-xl transition cursor-pointer flex items-start space-x-2.5 hover:bg-slate-50 ${
                          !notif.read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        {/* Icon based on type */}
                        <div className="mt-0.5 flex-shrink-0">
                          {notif.type === 'success' && (
                            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.type === 'qa' && (
                            <div className="w-6 h-6 rounded-lg bg-purple-50 text-[#8055F7] flex items-center justify-center border border-purple-100">
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.type === 'warning' && (
                            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[11px] font-bold text-[#101936] truncate">
                              {notif.title}
                            </h5>
                            <span className="text-[10px] text-slate-400 font-medium ml-2">
                              {notif.time}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                            {notif.desc}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-[#4361F7] mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Chip & Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 pl-2 border-l border-slate-200 cursor-pointer hover:opacity-90 transition"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                S
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-[#101936] leading-none flex items-center space-x-1">
                  <span>Shruti</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <span className="text-[10px] text-[#65708D] font-medium">Team Builder</span>
              </div>
            </button>

            {/* User Details Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E3E8F5] rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md">
                    S
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#101936]">Shruti</h4>
                    <p className="text-[10px] text-slate-500">shruti@payagent.network</p>
                    <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-600 border border-purple-100 font-bold">
                      Team Builder (Admin)
                    </span>
                  </div>
                </div>

                <div className="py-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-slate-700 text-[11px]">
                    <span className="flex items-center space-x-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#4361F7]" />
                      <span>Role</span>
                    </span>
                    <span className="font-bold">Project Lead</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-slate-700 text-[11px]">
                    <span className="flex items-center space-x-1.5">
                      <Key className="w-3.5 h-3.5 text-emerald-600" />
                      <span>PayPal Sandbox</span>
                    </span>
                    <span className="font-bold text-emerald-600">Active</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    Close Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
