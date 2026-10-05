'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Sparkles,
  Check,
  CheckCheck,
  X,
  CreditCard,
  ShieldCheck,
  Lock,
  ShieldAlert,
  User,
  LogOut,
  ExternalLink,
} from 'lucide-react';

interface TopBarProps {
  onSubmitMission: (prompt: string) => void;
  isLiveSandbox: boolean;
  onToggleSandbox: (live: boolean) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'payout' | 'qa' | 'escrow' | 'guardrail';
}

export const TopBar: React.FC<TopBarProps> = ({
  onSubmitMission,
  isLiveSandbox,
  onToggleSandbox,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'PayPal Payout Settled',
      message: 'Disbursed $15.00 to cipher.sec@payagent.sandbox (Batch PO-BATCH-9A2F3B).',
      time: '2m ago',
      unread: true,
      type: 'payout',
    },
    {
      id: 'notif-2',
      title: 'JudgeLex QA Approved',
      message: 'Contract SEC-014 scored 92/100 and satisfied all OWASP criteria.',
      time: '5m ago',
      unread: true,
      type: 'qa',
    },
    {
      id: 'notif-3',
      title: 'Escrow Order Authorized',
      message: 'Order ORD-7HJ8K2 authorized $15.00 hold in Escrow Vault.',
      time: '8m ago',
      unread: true,
      type: 'escrow',
    },
    {
      id: 'notif-4',
      title: 'Safety Guardrail Policy',
      message: 'Autonomous spending check passed (all subcontracts ≤ $15.00 limit).',
      time: '14m ago',
      unread: false,
      type: 'guardrail',
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const chips = [
    { label: 'Audit payment gateway API >', fullPrompt: 'Audit the payment gateway API, identify security weaknesses, and produce a CVE remediation playbook.' },
    { label: 'Competitor pricing analysis >', fullPrompt: 'Perform cross-platform competitor pricing analysis, compute margin elasticity, and draft GTM tiers.' },
    { label: 'Security risk assessment', fullPrompt: 'Execute threat modeling and security risk assessment on multi-party payout transactions.' },
    { label: 'Market intelligence', fullPrompt: 'Collect market intelligence and produce an AI agent micro-commerce whitepaper.' },
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

  const getNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'payout':
        return <CreditCard className="w-3.5 h-3.5 text-emerald-500" />;
      case 'qa':
        return <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />;
      case 'escrow':
        return <Lock className="w-3.5 h-3.5 text-[#4361F7]" />;
      case 'guardrail':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-[#E3E8F5] sticky top-0 z-20 px-6 py-3">
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
          {/* Environment Selector */}
          <div className="relative">
            <button
              onClick={() => onToggleSandbox(!isLiveSandbox)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[#4361F7] text-xs font-semibold cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#4361F7] animate-pulse" />
              <span>{isLiveSandbox ? 'Live Sandbox' : 'Sandbox Mode'}</span>
              <ChevronDown className="w-3 h-3 text-[#4361F7]" />
            </button>
          </div>

          {/* Notifications Button & Dropdown */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-slate-600 hover:text-slate-900 transition cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E3E8F5] rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Panel Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-bold text-[#101936]">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-semibold text-[#4361F7] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all as read</span>
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 text-xs">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-medium">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 transition flex items-start space-x-3 hover:bg-slate-50 ${
                          n.unread ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-slate-800 text-[11px] truncate">
                              {n.title}
                            </h5>
                            <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {n.message}
                          </p>
                        </div>
                        <button
                          onClick={() => removeNotification(n.id)}
                          className="text-slate-300 hover:text-slate-500 transition p-1"
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Panel Footer */}
                <div className="p-2.5 bg-[#F8FAFC] border-t border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 font-medium">
                    PayPal Sandbox Event Bus Connected
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Chip & Dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-2 pl-2 border-l border-slate-200 cursor-pointer"
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

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E3E8F5] rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800 block">Shruti</span>
                  <span className="text-[10px] text-slate-400">Team Builder • Admin</span>
                </div>
                <div className="py-1">
                  <a
                    href="https://developer.paypal.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-2 px-3.5 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#4361F7] transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>PayPal Developer Portal</span>
                  </a>
                  <button
                    onClick={() => {
                      onToggleSandbox(!isLiveSandbox);
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left flex items-center space-x-2 px-3.5 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#4361F7] transition"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Switch to {isLiveSandbox ? 'Simulation' : 'Live Sandbox'}</span>
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
