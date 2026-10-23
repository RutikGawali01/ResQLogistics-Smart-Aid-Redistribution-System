import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`glass-card rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md transition-all duration-200 ${
        hover ? 'hover:border-slate-700 hover:shadow-emerald-950/20 hover:-translate-y-0.5' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`flex flex-col space-y-1.5 pb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`text-base font-semibold text-slate-100 tracking-tight ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }) {
  return <p className={`text-xs text-slate-400 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }) {
  return <div className={`pt-1 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`flex items-center pt-4 border-t border-slate-800/60 ${className}`}>{children}</div>;
}

export function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendDirection = 'up',
  color = 'emerald',
  className = ''
}) {
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  };

  const iconStyle = colorMap[color] || colorMap.emerald;

  return (
    <Card className={`relative overflow-hidden group ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg border ${iconStyle} transition-transform group-hover:scale-105`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subtext || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                trendDirection === 'up'
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-rose-400 bg-rose-500/10'
              }`}
            >
              {trendDirection === 'up' ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {trend}
            </span>
          )}
          {subtext && <span className="text-slate-400">{subtext}</span>}
        </div>
      )}
    </Card>
  );
}
