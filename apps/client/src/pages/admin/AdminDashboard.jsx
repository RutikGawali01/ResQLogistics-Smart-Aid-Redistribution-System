import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { donationsService } from '../../services/donationsService.js';
import { sheltersService } from '../../services/sheltersService.js';
import { ridersService } from '../../services/ridersService.js';
import { assignmentsService } from '../../services/assignmentsService.js';
import { analyticsService } from '../../services/analyticsService.js';
import { MetricCard } from '../../components/ui/Card.jsx';
import { StatusBadge, UrgencyBadge, CategoryBadge } from '../../components/ui/Badge.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFilter } from '../../components/ui/Table.jsx';
import { Button } from '../../components/ui/FormElements.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { MapPreview } from '../../components/MapPreview.jsx';
import { AssignmentStateMachineVisualizer } from '../../components/AssignmentStateMachineVisualizer.jsx';
import { ASSIGNMENT_STATUS } from '@aidflow/shared';
import {
  Package,
  Building2,
  Bike,
  Activity,
  GitBranch,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  MapPin,
  RefreshCw
} from 'lucide-react';

export function AdminDashboard() {
  const { forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [telemetry, setTelemetry] = useState(null);
  const [donations, setDonations] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [riders, setRiders] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [telRes, donRes, shlRes, rdrRes, asgRes] = await Promise.all([
        analyticsService.getTelemetry({ forceMock }),
        donationsService.getDonations({ forceMock }),
        sheltersService.getShelters({ forceMock }),
        ridersService.getRiders({ forceMock }),
        assignmentsService.getAssignments({ forceMock })
      ]);

      setTelemetry(telRes.data || null);
      setDonations(donRes.data || []);
      setShelters(shlRes.data || []);
      setRiders(rdrRes.data || []);
      setAssignments(asgRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch operational telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [forceMock]);

  const handleStateTransition = async (assignmentId, targetStatus) => {
    const res = await assignmentsService.transitionState(assignmentId, targetStatus, { forceMock });
    if (res.success && res.data) {
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? res.data : a))
      );
    }
    return res;
  };

  if (loading) {
    return <LoadingState message="Fetching system telemetry & dispatch pipeline..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  const filteredAssignments = assignments.filter((a) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      a.id.toLowerCase().includes(q) ||
      (a.donationTitle && a.donationTitle.toLowerCase().includes(q)) ||
      (a.shelterName && a.shelterName.toLowerCase().includes(q)) ||
      (a.riderName && a.riderName.toLowerCase().includes(q)) ||
      a.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Central Logistics Command
          </h2>
          <p className="text-xs text-slate-400">
            Real-time monitoring of food surplus, relief shelter intake, and courier dispatches.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          icon={RefreshCw}
          className="self-start sm:self-auto"
        >
          Refresh Feed
        </Button>
      </div>

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Surplus Food Rescued"
          value={`${(telemetry?.totalSurplusKg || 12450).toLocaleString()} kg`}
          subtext="+14% this week"
          trend="+14%"
          color="emerald"
          icon={Package}
        />
        <MetricCard
          title="Shelters Supported"
          value={shelters.length.toString()}
          subtext="4 high urgency"
          color="amber"
          icon={Building2}
        />
        <MetricCard
          title="Couriers On Dispatch"
          value={riders.filter((r) => r.status === 'ON_DISPATCH').length.toString()}
          subtext={`${riders.filter((r) => r.status === 'AVAILABLE').length} available`}
          color="blue"
          icon={Bike}
        />
        <MetricCard
          title="Avg Dispatch SLA"
          value={`${telemetry?.avgDispatchSlaMinutes || 19.4} min`}
          subtext="Target < 25 min"
          trend="-2.1 min"
          color="purple"
          icon={TrendingUp}
        />
      </section>

      {/* Real-time Map & State Machine Visualizer */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Live Redistribution Geospatial Map
            </h3>
            <span className="text-[11px] text-slate-400">San Francisco Bay Area Cluster</span>
          </div>
          <div className="h-80 rounded-xl overflow-hidden border border-slate-800">
            <MapPreview
              donations={donations}
              shelters={shelters}
              riders={riders}
              assignments={assignments}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            Dispatch Lifecycle Engine
          </h3>
          <AssignmentStateMachineVisualizer
            assignments={assignments}
            onTransition={handleStateTransition}
          />
        </div>
      </section>

      {/* Active Assignments Management Table */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Active Delivery Assignments</h3>
            <p className="text-xs text-slate-400">
              Live status transitions from donation pickup to shelter intake
            </p>
          </div>
          <TableFilter
            value={filterQuery}
            onChange={setFilterQuery}
            placeholder="Filter by ID, aid title, shelter, or courier..."
            className="w-full sm:w-72"
          />
        </div>

        {filteredAssignments.length === 0 ? (
          <EmptyState
            title="No matching assignments"
            description="No active deliveries match your current search query."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Assignment ID</TableHead>
                <TableHead>Aid Package</TableHead>
                <TableHead>Destination Shelter</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.map((asg) => (
                <TableRow key={asg.id}>
                  <TableCell className="font-mono text-xs text-emerald-400 font-medium">
                    {asg.id}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-200">
                      {asg.donationTitle || 'Surplus Aid Goods'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">
                      {asg.pickupLocation?.address}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-200">{asg.shelterName || asg.shelterId}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">
                      {asg.deliveryLocation?.address}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-300 font-medium">
                      {asg.riderName || asg.riderId || 'Unassigned'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={asg.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    {asg.status === ASSIGNMENT_STATUS.PENDING_ACCEPTANCE && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStateTransition(asg.id, ASSIGNMENT_STATUS.ACCEPTED)}
                      >
                        Accept
                      </Button>
                    )}
                    {asg.status === ASSIGNMENT_STATUS.ACCEPTED && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStateTransition(asg.id, ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS)}
                      >
                        Start Route
                      </Button>
                    )}
                    {asg.status === ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleStateTransition(asg.id, ASSIGNMENT_STATUS.PICKED_UP)}
                      >
                        Pickup
                      </Button>
                    )}
                    {asg.status === ASSIGNMENT_STATUS.PICKED_UP && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleStateTransition(asg.id, ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS)}
                      >
                        Deliver
                      </Button>
                    )}
                    {asg.status === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleStateTransition(asg.id, ASSIGNMENT_STATUS.DELIVERED)}
                      >
                        Complete
                      </Button>
                    )}
                    {asg.status === ASSIGNMENT_STATUS.DELIVERED && (
                      <span className="text-xs text-emerald-400 font-medium">Archived</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
