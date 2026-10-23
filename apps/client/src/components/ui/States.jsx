import React from 'react';
import { Loader2, Inbox, AlertTriangle, CheckCircle2, RotateCw } from 'lucide-react';
import { Button } from './FormElements.jsx';
export { Alert } from './Alert.jsx';

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-slate-800/80 rounded-lg ${className}`}
    />
  );
}

export function LoadingState({
  message = 'Loading live data...',
  description = 'Connecting to AidFlow synchronization engine',
  skeletonCount = 3,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center space-y-4 ${className}`}>
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
        <Loader2 className="w-5 h-5 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-slate-200">{message}</h4>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>

      {skeletonCount > 0 && (
        <div className="w-full max-w-md pt-4 space-y-2.5">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no active entries matching your criteria right now.',
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-10 text-center rounded-xl border border-dashed border-slate-800/90 bg-slate-900/30 ${className}`}>
      <div className="p-3.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-400 mb-3">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
      <p className="mt-1 text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Failed to load data',
  message = 'A network error or service timeout occurred.',
  onRetry,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-900/50 bg-rose-950/20 ${className}`}>
      <div className="p-3.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-3">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h4 className="text-sm font-semibold text-rose-200">{title}</h4>
      <p className="mt-1 text-xs text-rose-300/80 max-w-md leading-relaxed">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={RotateCw}
            className="border-rose-800/60 text-rose-300 hover:bg-rose-900/30"
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
}

export function SuccessState({
  title = 'Operation completed',
  description = 'Your changes have been saved and propagated.',
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-emerald-900/50 bg-emerald-950/20 ${className}`}>
      <div className="p-3.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3">
        <CheckCircle2 className="w-7 h-7" />
      </div>
      <h4 className="text-sm font-semibold text-emerald-200">{title}</h4>
      <p className="mt-1 text-xs text-emerald-300/80 max-w-md leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
