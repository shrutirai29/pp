import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'peach';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#15152B] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-[#6955C9] hover:bg-[#5442A8] text-white shadow-sm shadow-[#6955C9]/20 focus:ring-[#8F86D8] border border-[#6955C9]/40',
    secondary:
      'bg-[#24203D] hover:bg-[#322C54] text-white border border-[#24203D] focus:ring-[#6955C9]',
    outline:
      'bg-transparent hover:bg-[#24203D] text-[#E9E8F8] border border-[#24203D] hover:border-[#6955C9]/40 focus:ring-[#6955C9]',
    danger:
      'bg-[#D97D68] hover:bg-[#C26B57] text-white shadow-sm shadow-[#D97D68]/20 focus:ring-[#D97D68] border border-[#D97D68]/40',
    ghost:
      'bg-transparent hover:bg-[#24203D]/60 text-[#68657A] hover:text-white border border-transparent focus:ring-[#24203D]',
    peach:
      'bg-[#F5B69E] hover:bg-[#F8D0BE] text-[#15152B] font-semibold shadow-sm shadow-[#F5B69E]/20 focus:ring-[#F5B69E] border border-[#F5B69E]/30',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
