import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  type = 'button',
  className = '',
  icon: Icon,
  ...props
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  };

  const variantClasses = {
    primary:
      'bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950/40 hover:shadow-emerald-900/60 active:scale-[0.98]',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80 active:scale-[0.98]',
    outline:
      'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-[0.98]',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-md shadow-rose-950/40 active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white active:scale-[0.98]'
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function Input({ error, className = '', ...props }) {
  return (
    <input
      className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-lg text-sm text-slate-100 placeholder-slate-500 transition-colors focus:outline-none focus:ring-1 ${
        error
          ? 'border-rose-500/80 focus:ring-rose-500 focus:border-rose-500'
          : 'border-slate-700 focus:ring-emerald-500 focus:border-emerald-500'
      } ${className}`}
      {...props}
    />
  );
}

export function Select({ children, error, className = '', ...props }) {
  return (
    <div className="relative">
      <select
        className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-lg text-sm text-slate-100 appearance-none focus:outline-none focus:ring-1 ${
          error
            ? 'border-rose-500/80 focus:ring-rose-500 focus:border-rose-500'
            : 'border-slate-700 focus:ring-emerald-500 focus:border-emerald-500'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
}

export function Textarea({ error, className = '', rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-lg text-sm text-slate-100 placeholder-slate-500 transition-colors focus:outline-none focus:ring-1 ${
        error
          ? 'border-rose-500/80 focus:ring-rose-500 focus:border-rose-500'
          : 'border-slate-700 focus:ring-emerald-500 focus:border-emerald-500'
      } ${className}`}
      {...props}
    />
  );
}

export function Checkbox({ label, id, error, className = '', ...props }) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <input
        type="checkbox"
        id={id}
        className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
        {...props}
      />
      {label && (
        <label htmlFor={id} className="text-xs text-slate-300 select-none cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
}

export function FormField({ label, required = false, hint, error, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {label} {required && <span className="text-rose-400">*</span>}
          </label>
          {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
        </div>
      )}
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
