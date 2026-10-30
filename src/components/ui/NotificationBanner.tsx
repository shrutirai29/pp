import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface NotificationBannerProps {
  type?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  type = 'info',
  title,
  children,
  className = '',
}) => {
  const configs = {
    info: {
      bg: 'bg-navy-900/90 border-navy-700/80 text-slate-300',
      icon: <Info className="h-5 w-5 text-electric-400 shrink-0 mt-0.5" />,
      titleColor: 'text-white',
    },
    warning: {
      bg: 'bg-amber-950/30 border-amber-800/40 text-amber-200/90',
      icon: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />,
      titleColor: 'text-amber-300',
    },
    danger: {
      bg: 'bg-rose-950/30 border-rose-800/40 text-rose-200/90',
      icon: <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />,
      titleColor: 'text-rose-300',
    },
    success: {
      bg: 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200/90',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />,
      titleColor: 'text-emerald-300',
    },
  };

  const config = configs[type];

  return (
    <div className={`flex gap-3 rounded-xl border p-4 text-sm ${config.bg} ${className}`}>
      {config.icon}
      <div className="flex-1 space-y-1">
        {title && <h5 className={`font-semibold text-sm ${config.titleColor}`}>{title}</h5>}
        <div className="text-xs sm:text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
};
