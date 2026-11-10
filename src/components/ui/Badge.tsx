import React from 'react';

export type BadgeVariant = 
  | 'default' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info' 
  | 'purple'
  | 'peach'
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
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-medium';

  const variantClasses: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    default: {
      bg: 'bg-[#24203D]',
      text: 'text-[#68657A]',
      border: 'border-[#24203D]',
      dotColor: 'bg-[#68657A]',
    },
    success: {
      bg: 'bg-[#4FAF91]/10',
      text: 'text-[#4FAF91]',
      border: 'border-[#4FAF91]/25',
      dotColor: 'bg-[#4FAF91]',
    },
    warning: {
      bg: 'bg-[#F5B69E]/10',
      text: 'text-[#F5B69E]',
      border: 'border-[#F5B69E]/25',
      dotColor: 'bg-[#F5B69E]',
    },
    danger: {
      bg: 'bg-[#D97D68]/10',
      text: 'text-[#D97D68]',
      border: 'border-[#D97D68]/25',
      dotColor: 'bg-[#D97D68]',
    },
    info: {
      bg: 'bg-[#8F86D8]/10',
      text: 'text-[#8F86D8]',
      border: 'border-[#8F86D8]/25',
      dotColor: 'bg-[#8F86D8]',
    },
    purple: {
      bg: 'bg-[#6955C9]/15',
      text: 'text-[#E9E8F8]',
      border: 'border-[#6955C9]/35',
      dotColor: 'bg-[#8F86D8]',
    },
    peach: {
      bg: 'bg-[#F5B69E]/15',
      text: 'text-[#F5B69E]',
      border: 'border-[#F5B69E]/30',
      dotColor: 'bg-[#F5B69E]',
    },
    outline: {
      bg: 'bg-transparent',
      text: 'text-[#68657A]',
      border: 'border-[#24203D]',
      dotColor: 'bg-[#68657A]',
    },
  };

  const style = variantClasses[variant] || variantClasses.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${style.dotColor}`} />}
      {children}
    </span>
  );
};
