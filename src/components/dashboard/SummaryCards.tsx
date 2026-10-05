'use client';

import React from 'react';
import { FileText, CheckCircle2, Clock, ShieldAlert, DollarSign } from 'lucide-react';
import { TaskContract } from '@/types';

interface SummaryCardsProps {
  tasks: TaskContract[];
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ tasks }) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'settled').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'escrow_authorized').length;
  const underQa = tasks.filter((t) => t.status === 'under_qa').length;
  const totalPayouts = tasks
    .filter((t) => t.status === 'settled')
    .reduce((sum, t) => sum + t.budget, 0);

  const stats = [
    {
      label: 'Total Contracts',
      value: total,
      icon: FileText,
      color: 'text-[#8055F7]',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
    },
    {
      label: 'Completed',
      value: completed,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      label: 'In Progress',
      value: inProgress,
      icon: Clock,
      color: 'text-[#4361F7]',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      label: 'Under QA',
      value: underQa,
      icon: ShieldAlert,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      label: 'Total Payouts',
      value: `$${totalPayouts.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-pink-500',
      bg: 'bg-pink-50',
      border: 'border-pink-100',
      isCurrency: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-white border border-[#E3E8F5] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center space-x-3.5"
          >
            <div
              className={`w-11 h-11 rounded-xl ${stat.bg} ${stat.border} border flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-[#101936] tracking-tight font-sans">
                {stat.value}
              </div>
              <div className="text-xs text-[#65708D] font-medium">{stat.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
