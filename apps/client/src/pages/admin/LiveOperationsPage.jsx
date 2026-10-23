import React, { useState } from 'react';
import { useLiveOperations } from '../../hooks/useLiveOperations.js';
import { LiveOperationsMap } from '../../components/operations/LiveOperationsMap.jsx';
import { DispatchOverview } from '../../components/operations/DispatchOverview.jsx';
import { OperationsAlertsPanel } from '../../components/operations/OperationsAlertsPanel.jsx';
import { MetricCard } from '../../components/ui/Card.jsx';
import { LoadingState, ErrorState } from '../../components/ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ASSIGNMENT_STATUS } from '@aidflow/shared';
import {
  Radio,
  RefreshCw,
  GitBranch,
  Package,
  Building2,
  Bike,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

export function LiveOperationsPage() {
  const { forceMock } = useAuth();
  const {
    loading,
    refreshing,
    error,
    donations,
    shelters,
    riders,
    assignments,
    telemetry,
    alerts,
    dismissAlert,
    socketStatus,
    isPolling,
    setIsPolling,
    lastSyncTime,
    refresh,
    transitionAssignmentState
  } = useLiveOperations();

  const [focusedAssignmentId, setFocusedAssignmentId] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'MAP' | 'DISPATCH' | 'ALERTS'

  // Focus entity on map
  const handleFocusEntity = (entityType, entityId) => {
    if (entityType === 'ASSIGNMENT' || entityType === 'ASSIGNMENT_POOL') {
      setFocusedAssignmentId(entityId);
    } else {
      // Find matching assignment if any
      const matchedAsg = assignments.find(
        (a) =>
          a.donationId === entityId ||
          a.shelterId === entityId ||
          a.riderId === entityId
      );
      if (matchedAsg) {
        setFocusedAssignmentId(matchedAsg.id);
      }
    }
  };

  if (loading) {
    return <LoadingState message="Synchronizing live geospatial dispatch grid..." />;
  }

  if (error && donations.length === 0 && shelters.length === 0) {
    return (
      <ErrorState
        title="Operations Hub Connection Failure"
        message={error}
        onRetry={refresh}
      />
    );
  }

  // Metric computations
  const activeAssignmentsCount = assignments.filter(
    (a) =>
      a.status !== ASSIGNMENT_STATUS.DELIVERED &&
      a.status !== ASSIGNMENT_STATUS.CANCELLED &&
      a.status !== ASSIGNMENT_STATUS.FAILED
  ).length;

  const availableAidCount = donations.filter((d) => d.status === 'AVAILABLE').length;
  const activeCouriersCount = riders.filter(
    (r) => r.status === 'ON_DISPATCH' || r.status === 'IN_TRANSIT' || Boolean(r.activeAssignmentId)
  ).length;
  const criticalAlertsCount = alerts.filter((a) => a.severity === 'CRITICAL').length;

  return (
    <div className="space-y-6">
      {/* Top Operations Telemetry Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Live Operations Command Hub
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  LIVE GRID
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time Socket.IO dispatch telemetry, Leaflet geospatial routing, and perishable aid alerts
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Connection Status & Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Socket.IO Connection Pill (Task 5 & 6) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {socketStatus === 'connected' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-semibold font-mono">Socket: Connected</span>
              </>
            ) : socketStatus === 'reconnecting' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span className="text-sky-300 font-semibold font-mono">Socket: Reconnecting</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-300 font-semibold font-mono">
                  Socket: Offline (Polling Fallback)
                </span>
              </>
            )}
          </div>

          {/* Polling fallback toggle (Task 7) */}
          <button
            onClick={() => setIsPolling((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              isPolling
                ? 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
            title="Toggle background periodic REST polling fallback"
          >
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Polling: {isPolling ? 'Active (25s)' : 'Paused'}</span>
          </button>

          {/* Manual Refresh Button (Task 7) */}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="Force immediate sync across all API endpoints"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Hub'}</span>
          </button>

          {/* Last sync time */}
          {lastSyncTime && (
            <span className="text-[10px] text-slate-500 font-mono hidden xl:inline">
              Updated: {lastSyncTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* KPI Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Missions"
          value={activeAssignmentsCount}
          subtitle="In-transit or assigned"
          icon={GitBranch}
          trend={activeAssignmentsCount > 0 ? '+12% dispatch vol' : 'Nominal'}
          trendUp={true}
        />
        <MetricCard
          title="Available Aid Surplus"
          value={availableAidCount}
          subtitle="Lots awaiting allocation"
          icon={Package}
          trend={`${donations.length} total lots in pool`}
          trendUp={true}
        />
        <MetricCard
          title="Couriers in Field"
          value={activeCouriersCount}
          subtitle={`${riders.length} active fleet units`}
          icon={Bike}
          trend={`${riders.filter((r) => r.isAvailable).length} couriers ready`}
          trendUp={true}
        />
        <MetricCard
          title="Operational Bottlenecks"
          value={alerts.length}
          subtitle={`${criticalAlertsCount} critical alerts`}
          icon={ShieldAlert}
          trend={alerts.length > 0 ? 'Action required' : 'Zero delays'}
          trendUp={alerts.length === 0}
        />
      </section>

      {/* Main Operations Grid: Geospatial Map + Operational Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map takes 2 columns on desktop */}
        <div className="lg:col-span-2 flex flex-col gap-2">
          <LiveOperationsMap
            donations={donations}
            shelters={shelters}
            riders={riders}
            assignments={assignments}
            focusedAssignmentId={focusedAssignmentId}
            onSelectAssignment={setFocusedAssignmentId}
            height="580px"
            isMockData={forceMock}
          />
        </div>

        {/* Operational Alerts Panel takes 1 column */}
        <div className="flex flex-col gap-2">
          <OperationsAlertsPanel
            alerts={alerts}
            onDismissAlert={dismissAlert}
            onFocusEntity={handleFocusEntity}
            className="h-full"
          />
        </div>
      </section>

      {/* Dispatch Overview: Missions, Quantities, Deadlines, and Arrivals (Task 3) */}
      <section className="space-y-2">
        <DispatchOverview
          assignments={assignments}
          focusedAssignmentId={focusedAssignmentId}
          onFocusAssignment={setFocusedAssignmentId}
          onTransitionState={transitionAssignmentState}
        />
      </section>
    </div>
  );
}
