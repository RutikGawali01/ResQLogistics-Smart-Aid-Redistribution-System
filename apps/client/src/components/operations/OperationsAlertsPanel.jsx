import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Building2,
  Package,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  ShieldAlert,
  BellRing
} from 'lucide-react';

export function OperationsAlertsPanel({
  alerts = [],
  onDismissAlert,
  onFocusEntity,
  className = ''
}) {
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Group counts
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter((a) => a.severity === 'WARNING').length;

  const filteredAlerts = alerts.filter((a) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'CRITICAL') return a.severity === 'CRITICAL';
    if (selectedFilter === 'EXPIRING') return a.type === 'EXPIRING_DONATION';
    if (selectedFilter === 'RESERVATIONS') return a.type === 'EXPIRED_RESERVATION';
    if (selectedFilter === 'SHELTERS') return a.type === 'CLOSED_SHELTER';
    if (selectedFilter === 'UNASSIGNED') return a.type === 'UNASSIGNED_AID';
    return true;
  });

  const getAlertIcon = (type) => {
    switch (type) {
      case 'EXPIRING_DONATION':
        return <Clock className="w-4 h-4 text-rose-400" />;
      case 'EXPIRED_RESERVATION':
        return <Package className="w-4 h-4 text-amber-400" />;
      case 'CLOSED_SHELTER':
        return <Building2 className="w-4 h-4 text-rose-400" />;
      case 'UNASSIGNED_AID':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          cardBg: 'bg-rose-950/20 border-rose-800/60',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          indicator: 'bg-rose-500'
        };
      case 'WARNING':
        return {
          cardBg: 'bg-amber-950/20 border-amber-800/60',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          indicator: 'bg-amber-500'
        };
      default:
        return {
          cardBg: 'bg-slate-900/60 border-slate-800',
          badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
          indicator: 'bg-indigo-500'
        };
    }
  };

  return (
    <div
      className={`glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-950/60 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <BellRing className="w-4 h-4 text-rose-400 animate-pulse" />
            </div>
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Live Operational Dispatch Alerts</h3>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                  {criticalCount} Critical
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Monitoring perishable deadlines, holds, closed shelters, and surplus backlogs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expand Alerts' : 'Collapse Alerts'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 bg-slate-950/30 border-b border-slate-800/60 text-xs">
            <span className="text-slate-500 text-[11px] mr-1">Filter:</span>
            {[
              { id: 'ALL', label: `All (${alerts.length})` },
              { id: 'CRITICAL', label: `Critical (${criticalCount})` },
              { id: 'EXPIRING', label: 'Expiring Aid' },
              { id: 'RESERVATIONS', label: 'Expired Holds' },
              { id: 'SHELTERS', label: 'Shelter Hubs' },
              { id: 'UNASSIGNED', label: 'Unassigned' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedFilter === f.id
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Alerts List */}
          <div className="p-4 space-y-2.5 max-h-80 overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mb-2" />
                <h4 className="text-xs font-semibold text-slate-200">
                  All Clear in Filtered Category
                </h4>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  No unresolved alerts detected for expiring donations, unassigned missions, or closed shelters.
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const styles = getSeverityStyle(alert.severity);

                return (
                  <div
                    key={alert.id}
                    className={`rounded-xl p-3 border ${styles.cardBg} transition-all duration-150 relative group flex items-start justify-between gap-3`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        {getAlertIcon(alert.type)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${styles.badge}`}
                          >
                            {alert.severity}
                          </span>
                          <h4 className="text-xs font-semibold text-white tracking-tight">
                            {alert.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {alert.timestamp}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {alert.description}
                        </p>

                        {/* Interactive focus action */}
                        {onFocusEntity && alert.entityId && (
                          <button
                            onClick={() => onFocusEntity(alert.entityType, alert.entityId)}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium mt-1 transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            Highlight on Live Map
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dismiss Button */}
                    {onDismissAlert && (
                      <button
                        onClick={() => onDismissAlert(alert.id)}
                        title="Dismiss Alert"
                        className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-800/60 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
