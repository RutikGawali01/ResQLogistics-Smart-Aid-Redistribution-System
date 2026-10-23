import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from 'lucide-react';

export function Alert({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
  action
}) {
  const variantStyles = {
    info: {
      container: 'bg-sky-950/40 border-sky-800/80 text-sky-200',
      icon: Info,
      iconColor: 'text-sky-400'
    },
    success: {
      container: 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400'
    },
    warning: {
      container: 'bg-amber-950/40 border-amber-800/80 text-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-400'
    },
    error: {
      container: 'bg-rose-950/40 border-rose-800/80 text-rose-200',
      icon: AlertOctagon,
      iconColor: 'text-rose-400'
    }
  };

  const style = variantStyles[variant] || variantStyles.info;
  const Icon = style.icon;

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm text-sm ${style.container} ${className}`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold text-slate-100">{title}</h5>}
        {children && <div className="text-xs leading-relaxed opacity-90">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-white transition-colors"
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
