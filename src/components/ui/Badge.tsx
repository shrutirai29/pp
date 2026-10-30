import React from 'react';

export type BadgeVariant = 
  | 'default' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info' 
  | 'purple'
  | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  const variantClasses: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    default: {
      bg: 'bg-navy-800/80',
      text: 'text-slate-300',
      border: 'border-navy-700',
      dotColor: 'bg-slate-400',
    },
    success: {
      bg: 'bg-emerald-950/40',
      text: 'text-emerald-400',
      border: 'border-emerald-700/50',
      dotColor: 'bg-emerald-400',
    },
    warning: {
      bg: 'bg-amber-950/40',
      text: 'text-amber-400',
      border: 'border-amber-700/50',
      dotColor: 'bg-amber-400',
    },
    danger: {
      bg: 'bg-rose-950/40',
      text: 'text-rose-400',
      border: 'border-rose-700/50',
      dotColor: 'bg-rose-400',
    },
    info: {
      bg: 'bg-sky-950/40',
      text: 'text-sky-400',
      border: 'border-sky-700/50',
      dotColor: 'bg-sky-400',
    },
    purple: {
      bg: 'bg-violet-950/40',
      text: 'text-violet-400',
      border: 'border-violet-700/50',
      dotColor: 'bg-violet-400',
    },
    outline: {
      bg: 'bg-transparent',
      text: 'text-slate-400',
      border: 'border-navy-700',
      dotColor: 'bg-slate-500',
    },
  };

  const style = variantClasses[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${style.dotColor}`} />}
      {children}
    </span>
  );
};
