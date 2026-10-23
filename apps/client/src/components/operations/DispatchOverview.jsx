import React, { useState, useMemo } from 'react';
import { ASSIGNMENT_STATUS } from '@aidflow/shared';
import {
  GitBranch,
  Package,
  Building2,
  Bike,
  Clock,
  Navigation,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Check,
  ChevronRight
} from 'lucide-react';
import { StatusBadge } from '../ui/Badge.jsx';

/**
 * Calculates estimated arrival minutes and formatted ETA string based on status and distance.
 */
function computeEstimatedArrival(asg) {
  // If explicitly delivered
  if (asg.status === ASSIGNMENT_STATUS.DELIVERED) {
    return { label: 'Delivered', minutes: 0, color: 'text-emerald-400' };
  }
  if (asg.status === ASSIGNMENT_STATUS.CANCELLED || asg.status === ASSIGNMENT_STATUS.FAILED) {
    return { label: 'Terminated', minutes: 0, color: 'text-rose-400' };
  }

  // If unassigned or offered
  if (asg.status === ASSIGNMENT_STATUS.UNASSIGNED || asg.status === ASSIGNMENT_STATUS.OFFERED) {
    return { label: 'Pending Courier Accept', minutes: null, color: 'text-amber-400' };
  }

  // Estimated minutes based on stored timeline or fallback distance calculation
  const mins = asg.estimatedMinutes || (asg.status === ASSIGNMENT_STATUS.PICKED_UP ? 14 : 22);
  return {
    label: `~${mins} mins (${new Date(Date.now() + mins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
    minutes: mins,
    color: 'text-indigo-300'
  };
}

/**
 * Calculates deadline urgency countdown.
 */
function computeDeadlineCountdown(deadlineDate) {
  if (!deadlineDate) return { text: 'No SLA set', isUrgent: false, isOverdue: false };

  const diffMs = new Date(deadlineDate).getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return {
      text: `${Math.abs(Math.round(diffHours))}h OVERDUE`,
      isUrgent: true,
      isOverdue: true,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    };
  }

  if (diffHours <= 2) {
    return {
      text: `${Math.round(diffHours * 60)} mins left`,
      isUrgent: true,
      isOverdue: false,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    };
  }

  if (diffHours <= 6) {
    return {
      text: `${Math.round(diffHours)}h remaining`,
      isUrgent: false,
      isOverdue: false,
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    };
  }

  return {
    text: `${Math.round(diffHours)}h safe SLA`,
    isUrgent: false,
    isOverdue: false,
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  };
}

export function DispatchOverview({
  assignments = [],
  focusedAssignmentId = null,
  onFocusAssignment,
  onTransitionState,
  className = ''
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Status categories
  const filteredAssignments = useMemo(() => {
    return assignments.filter((asg) => {
      // Status filter
      if (statusFilter === 'ACTIVE') {
        if (
          asg.status === ASSIGNMENT_STATUS.DELIVERED ||
          asg.status === ASSIGNMENT_STATUS.CANCELLED ||
          asg.status === ASSIGNMENT_STATUS.FAILED
        ) {
          return false;
        }
      } else if (statusFilter === 'UNASSIGNED') {
        if (
          asg.status !== ASSIGNMENT_STATUS.UNASSIGNED &&
          asg.status !== ASSIGNMENT_STATUS.OFFERED
        ) {
          return false;
        }
      } else if (statusFilter === 'IN_TRANSIT') {
        if (
          asg.status !== ASSIGNMENT_STATUS.ACCEPTED &&
          asg.status !== ASSIGNMENT_STATUS.EN_ROUTE_PICKUP &&
          asg.status !== ASSIGNMENT_STATUS.PICKED_UP &&
          asg.status !== ASSIGNMENT_STATUS.EN_ROUTE_DROPOFF &&
          asg.status !== ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS
        ) {
          return false;
        }
      } else if (statusFilter === 'DELIVERED') {
        if (asg.status !== ASSIGNMENT_STATUS.DELIVERED) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (asg.donationTitle || '').toLowerCase().includes(q);
        const matchShelter = (asg.shelterName || asg.shelterId || '').toLowerCase().includes(q);
        const matchRider = (asg.riderName || asg.riderId || '').toLowerCase().includes(q);
        const matchId = (asg.id || '').toLowerCase().includes(q);
        if (!matchTitle && !matchShelter && !matchRider && !matchId) return false;
      }

      return true;
    });
  }, [assignments, statusFilter, searchQuery]);

  // Aggregated status summary counts
  const counts = useMemo(() => {
    let active = 0;
    let unassigned = 0;
    let inTransit = 0;
    let delivered = 0;

    assignments.forEach((a) => {
      if (
        a.status === ASSIGNMENT_STATUS.UNASSIGNED ||
        a.status === ASSIGNMENT_STATUS.OFFERED
      ) {
        unassigned++;
        active++;
      } else if (
        a.status === ASSIGNMENT_STATUS.ACCEPTED ||
        a.status === ASSIGNMENT_STATUS.EN_ROUTE_PICKUP ||
        a.status === ASSIGNMENT_STATUS.PICKED_UP ||
        a.status === ASSIGNMENT_STATUS.EN_ROUTE_DROPOFF ||
        a.status === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS
      ) {
        inTransit++;
        active++;
      } else if (a.status === ASSIGNMENT_STATUS.DELIVERED) {
        delivered++;
      }
    });

    return { total: assignments.length, active, unassigned, inTransit, delivered };
  }, [assignments]);

  return (
    <div
      className={`glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col ${className}`}
    >
      {/* Header Bar */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            Dispatch Operations Overview
          </h3>
          <p className="text-xs text-slate-400">
            Monitor real-time mission status, allocated aid quantities, SLA deadlines, and courier arrivals
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search missions, couriers, hubs..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Filter Tabs & KPI Counts */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/60 gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'ALL', label: `All (${counts.total})` },
            { id: 'ACTIVE', label: `Active (${counts.active})` },
            { id: 'UNASSIGNED', label: `Unassigned (${counts.unassigned})` },
            { id: 'IN_TRANSIT', label: `In-Transit (${counts.inTransit})` },
            { id: 'DELIVERED', label: `Delivered (${counts.delivered})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignments Card Grid */}
      <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
        {filteredAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="w-10 h-10 text-slate-600 mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">No Assignments Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              No delivery assignments match your current status filter or search query.
            </p>
          </div>
        ) : (
          filteredAssignments.map((asg) => {
            const isFocused = focusedAssignmentId === asg.id;
            const eta = computeEstimatedArrival(asg);
            const deadline = computeDeadlineCountdown(asg.deadline);

            return (
              <div
                key={asg.id}
                className={`rounded-xl p-3.5 border transition-all duration-200 ${
                  isFocused
                    ? 'bg-slate-900/90 border-emerald-500/80 shadow-lg ring-1 ring-emerald-500/40'
                    : 'bg-slate-900/50 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                {/* Mission Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {asg.donationTitle || asg.id}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      #{asg.id.slice(-8)}
                    </span>
                    <StatusBadge status={asg.status} />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* SLA Deadline badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono border ${deadline.badgeClass}`}
                    >
                      SLA: {deadline.text}
                    </span>

                    {/* Focus on map action */}
                    {onFocusAssignment && (
                      <button
                        onClick={() => onFocusAssignment(asg.id)}
                        className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                          isFocused
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                        }`}
                        title="Highlight route on Live Map"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Track</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Mission Route & Cargo Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2.5 text-xs">
                  {/* Origin & Destination */}
                  <div className="space-y-1.5 md:col-span-1">
                    <div className="flex items-start gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Pickup</span>
                        <p className="text-slate-300 truncate">
                          {asg.pickupLocation?.address || 'Pickup Point'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Dropoff</span>
                        <p className="text-slate-300 truncate">
                          {asg.shelterName || asg.deliveryLocation?.address || 'Shelter Intake'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Courier Info */}
                  <div className="space-y-1 md:col-span-1 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-3 pt-2 md:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Allocated Quantity:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {asg.allocatedQuantity ?? '—'} units
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Assigned Courier:</span>
                      <span className="font-medium text-slate-200">
                        {asg.riderName || (asg.riderId ? `#${asg.riderId.slice(-6)}` : 'Unassigned')}
                      </span>
                    </div>

                    {asg.notes && (
                      <div className="text-[11px] text-slate-400 italic truncate">
                        "{asg.notes}"
                      </div>
                    )}
                  </div>

                  {/* ETA & Transit Timing */}
                  <div className="space-y-1 md:col-span-1 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-3 pt-2 md:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Estimated Arrival:</span>
                      <span className={`font-semibold font-mono ${eta.color}`}>
                        {eta.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Created:</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {asg.timeline?.assignedAt
                          ? new Date(asg.timeline.assignedAt).toLocaleTimeString()
                          : asg.createdAt
                          ? new Date(asg.createdAt).toLocaleTimeString()
                          : 'Recent'}
                      </span>
                    </div>

                    {asg.timeline?.pickedUpAt && (
                      <div className="flex items-center justify-between text-[11px] text-indigo-300">
                        <span>Picked Up:</span>
                        <span>{new Date(asg.timeline.pickedUpAt).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* State Transition Actions (if provided) */}
                {onTransitionState &&
                  asg.status !== ASSIGNMENT_STATUS.DELIVERED &&
                  asg.status !== ASSIGNMENT_STATUS.CANCELLED && (
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Next Lifecycle Transition:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {asg.status === ASSIGNMENT_STATUS.OFFERED && (
                          <button
                            onClick={() => onTransitionState(asg.id, ASSIGNMENT_STATUS.ACCEPTED)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
                          >
                            Accept Mission
                          </button>
                        )}
                        {asg.status === ASSIGNMENT_STATUS.ACCEPTED && (
                          <button
                            onClick={() => onTransitionState(asg.id, ASSIGNMENT_STATUS.EN_ROUTE_PICKUP)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors"
                          >
                            Depart for Pickup
                          </button>
                        )}
                        {asg.status === ASSIGNMENT_STATUS.EN_ROUTE_PICKUP && (
                          <button
                            onClick={() => onTransitionState(asg.id, ASSIGNMENT_STATUS.PICKED_UP)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                          >
                            Confirm Pickup
                          </button>
                        )}
                        {(asg.status === ASSIGNMENT_STATUS.PICKED_UP ||
                          asg.status === ASSIGNMENT_STATUS.EN_ROUTE_DROPOFF ||
                          asg.status === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS) && (
                          <button
                            onClick={() => onTransitionState(asg.id, ASSIGNMENT_STATUS.DELIVERED)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                          >
                            Confirm Intake at Shelter
                          </button>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
