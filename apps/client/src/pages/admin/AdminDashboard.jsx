import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { donationsService } from '../../services/donationsService.js';
import { sheltersService } from '../../services/sheltersService.js';
import { ridersService } from '../../services/ridersService.js';
import { assignmentsService } from '../../services/assignmentsService.js';
import { analyticsService } from '../../services/analyticsService.js';
import { MetricCard } from '../../components/ui/Card.jsx';
import { StatusBadge, UrgencyBadge, CategoryBadge, Badge } from '../../components/ui/Badge.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFilter } from '../../components/ui/Table.jsx';
import { Button } from '../../components/ui/FormElements.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { MapPreview } from '../../components/MapPreview.jsx';
import { AssignmentStateMachineVisualizer } from '../../components/AssignmentStateMachineVisualizer.jsx';
import { ASSIGNMENT_STATUS, SOCKET_EVENTS } from '@aidflow/shared';
import { subscribeToEvent } from '../../services/socket.js';
import { Alert } from '../../components/ui/Alert.jsx';
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
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BellRing,
  History,
  Radio
} from 'lucide-react';

export function AdminDashboard() {
  const { forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const [telemetry, setTelemetry] = useState(null);
  const [donations, setDonations] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [riders, setRiders] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');

  // Unresolved Operational Alerts State
  const [alerts, setAlerts] = useState([
    {
      id: 'alt_01',
      title: 'High Urgency Shelter Surge: Downtown Hope Refuge',
      description: 'Shelter reached 88% bed occupancy and reported understocked meal pantry (150 meals needed).',
      severity: 'CRITICAL',
      source: 'SHELTER_CAPACITY',
      timestamp: '12 mins ago',
      resolved: false
    },
    {
      id: 'alt_02',
      title: 'Perishable Aid Expiration Warning: Organic Produce Crate',
      description: 'Donation #don_mock_02 is perishable and expires in under 36 hours. Prioritizing expedited routing.',
      severity: 'WARNING',
      source: 'DONATION_DISPATCH',
      timestamp: '28 mins ago',
      resolved: false
    },
    {
      id: 'alt_03',
      title: 'Unassigned Mission Pending Acceptance: Mission #asg_seed_01',
      description: 'Courier dispatch offer awaiting acceptance for over 15 minutes.',
      severity: 'WARNING',
      source: 'COURIER_FLEET',
      timestamp: '45 mins ago',
      resolved: false
    }
  ]);

  // Recent Platform Events Stream
  const [recentEvents, setRecentEvents] = useState([
    {
      id: 'evt_01',
      type: 'ASSIGNMENT_STATE_CHANGED',
      entity: 'Assignment #asg_seed_01',
      description: 'Courier Carlos Ruiz marked shipment as ACCEPTED',
      actor: 'Carlos Ruiz (RIDER)',
      timestamp: 'Just now'
    },
    {
      id: 'evt_02',
      type: 'DONATION_CREATED',
      entity: 'Donation #don_mock_01',
      description: 'Sarah Jenkins registered 45 loaves of artisan bread',
      actor: 'Sarah Jenkins (DONOR)',
      timestamp: '14 mins ago'
    },
    {
      id: 'evt_03',
      type: 'SHELTER_CAPACITY_UPDATED',
      entity: 'Downtown Hope Refuge',
      description: 'Bed occupancy updated to 88/100, Urgency level HIGH',
      actor: 'Elena Rostova (SHELTER_MANAGER)',
      timestamp: '32 mins ago'
    },
    {
      id: 'evt_04',
      type: 'DELIVERY_COMPLETED',
      entity: 'Assignment #asg_seed_02',
      description: 'Intake dock receipt confirmed into relief kitchen pantry',
      actor: 'Elena Rostova (SHELTER_MANAGER)',
      timestamp: '1 hour ago'
    }
  ]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to live operational events
    const unsubDonation = subscribeToEvent(SOCKET_EVENTS.DONATION_CREATED, (d) => {
      if (d) {
        setDonations((prev) => [d, ...prev]);
        setRecentEvents((prev) => [
          {
            id: 'evt_' + Date.now(),
            type: 'DONATION_CREATED',
            entity: `Donation #${d.id || d._id}`,
            description: `New aid: ${d.quantity} ${d.unit} of ${d.title || d.aidType || 'Supplies'}`,
            actor: d.pickupLocation?.contactName || 'Donor',
            timestamp: 'Just now'
          },
          ...prev.slice(0, 19)
        ]);
      }
    });

    const unsubShelter = subscribeToEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, (s) => {
      if (s) {
        const id = s.id || s._id;
        setShelters((prev) => prev.map((item) => ((item.id === id || item._id === id) ? { ...item, ...s } : item)));
        setRecentEvents((prev) => [
          {
            id: 'evt_' + Date.now(),
            type: 'SHELTER_CAPACITY_UPDATED',
            entity: s.name || `Shelter #${id}`,
            description: `Occupancy: ${s.capacity?.currentOccupancy || s.currentDemand}/${s.capacity?.maxCapacity || s.receivingCapacity}`,
            actor: 'Shelter Manager',
            timestamp: 'Just now'
          },
          ...prev.slice(0, 19)
        ]);
      }
    });

    const unsubRider = subscribeToEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, (r) => {
      if (r) {
        setRiders((prev) =>
          prev.map((item) => (item.id === r.riderId ? { ...item, status: r.status, isAvailable: r.isAvailable } : item))
        );
      }
    });

    const unsubAsgState = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, (asg) => {
      if (asg) {
        const id = asg.assignmentId || asg.id;
        setAssignments((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...asg, status: asg.newStatus || asg.status } : item))
        );
        setRecentEvents((prev) => [
          {
            id: 'evt_' + Date.now(),
            type: 'ASSIGNMENT_STATE_CHANGED',
            entity: `Assignment #${id}`,
            description: `Mission transitioned to ${asg.newStatus || asg.status}`,
            actor: 'Dispatch System',
            timestamp: 'Just now'
          },
          ...prev.slice(0, 19)
        ]);
      }
    });

    const unsubAsgOffer = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_OFFERED, (asg) => {
      if (asg) {
        const id = asg.assignmentId || asg.id;
        setAssignments((prev) => {
          if (prev.some((item) => item.id === id)) return prev;
          return [asg, ...prev];
        });
      }
    });

    return () => {
      unsubDonation();
      unsubShelter();
      unsubRider();
      unsubAsgState();
      unsubAsgOffer();
    };
  }, [forceMock]);

  const handleStateTransition = async (assignmentId, targetStatus) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await assignmentsService.transitionState(assignmentId, targetStatus, { forceMock });
      if (res.success && res.data) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignmentId ? res.data : a))
        );
        setActionSuccess(`Mission #${assignmentId} transitioned to ${targetStatus}`);
        return res;
      } else {
        const errMsg = res.details?.reason || res.error || 'State transition failed';
        setActionError(errMsg);
        return res;
      }
    } catch (err) {
      setActionError(err.message || 'State transition failed');
      return { success: false, error: err.message };
    }
  };

  const handleAcknowledgeAlert = (alertId) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
  };

  if (loading) {
    return <LoadingState message="Fetching system telemetry & dispatch pipeline..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  const unresolvedAlerts = alerts.filter((a) => !a.resolved);

  const filteredAssignments = assignments.filter((a) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    const id = (a.id || a._id || '').toString().toLowerCase();
    const donation = (a.donationTitle || (typeof a.donationId === 'object' ? a.donationId?.title : a.donationId) || '').toLowerCase();
    const shelter = (a.shelterName || (typeof a.shelterId === 'object' ? a.shelterId?.name : a.shelterId) || '').toLowerCase();
    const rider = (a.riderName || (typeof a.riderId === 'object' ? a.riderId?.name : a.riderId) || '').toLowerCase();
    const status = (a.status || '').toLowerCase();
    return (
      id.includes(q) ||
      donation.includes(q) ||
      shelter.includes(q) ||
      rider.includes(q) ||
      status.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {actionError && (
        <Alert variant="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {actionSuccess && (
        <Alert variant="success" onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}
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

      {/* KPI Summaries Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Surplus Rescued"
          value={`${(telemetry?.totalSurplusKg || 12450).toLocaleString()} kg`}
          subtext={`${donations.length} total aid batches`}
          trend="+14%"
          color="emerald"
          icon={Package}
        />
        <MetricCard
          title="Relief Shelters"
          value={shelters.length.toString()}
          subtext="Active emergency hubs"
          color="amber"
          icon={Building2}
        />
        <MetricCard
          title="Courier Fleet"
          value={riders.length.toString()}
          subtext={`${riders.filter((r) => r.status === 'AVAILABLE').length} ready for dispatch`}
          color="blue"
          icon={Bike}
        />
        <MetricCard
          title="Active Missions"
          value={assignments.filter((a) => a.status !== 'DELIVERED').length.toString()}
          subtext={`${assignments.filter((a) => a.status === 'DELIVERED').length} delivered`}
          color="purple"
          icon={TrendingUp}
        />
      </section>

      {/* Unresolved Alerts & Recent Events Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unresolved Operational Alerts */}
        <div className="glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Unresolved Operational Alerts
              </h3>
              <p className="text-xs text-slate-400">
                Actionable system alerts requiring immediate operational intervention
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {unresolvedAlerts.length} Active
            </span>
          </div>

          {unresolvedAlerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span>All platform operational alerts resolved. Redistribution pipeline normal.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {unresolvedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={alert.severity === 'CRITICAL' ? 'rose' : 'amber'}
                        size="xs"
                      >
                        {alert.severity}
                      </Badge>
                      <span className="font-semibold text-xs text-slate-100">{alert.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-md">{alert.description}</p>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {alert.timestamp} • Source: {alert.source}
                    </span>
                  </div>

                  <Button
                    size="xs"
                    variant="secondary"
                    icon={CheckCircle2}
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="self-start sm:self-center"
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Events Live Feed */}
        <div className="glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                Recent Platform Events & Audit Stream
              </h3>
              <p className="text-xs text-slate-400">
                Immutable event stream of donor registrations, dispatches, and shelter intakes
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Live</span>
            </div>
          </div>

          <div className="space-y-3">
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3 rounded-xl bg-slate-950/50 border border-slate-850 flex items-start gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {evt.entity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                      {evt.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{evt.description}</p>
                  <span className="text-[11px] text-slate-500 font-mono">By: {evt.actor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real-time Map & State Machine Visualizer */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Live Redistribution Geospatial Map
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">San Francisco Bay Area Cluster</span>
              <Link
                to="/admin/operations"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors"
              >
                <span>Full Command Grid</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="h-96 rounded-xl overflow-hidden border border-slate-800">
            <MapPreview
              donations={donations}
              shelters={shelters}
              riders={riders}
              assignments={assignments}
              height="100%"
              isMockData={forceMock}
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
                    <div className="font-medium text-slate-200">
                      {asg.shelterName || (typeof asg.shelterId === 'object' ? asg.shelterId?.name : asg.shelterId) || 'Relief Shelter'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">
                      {asg.deliveryLocation?.address}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-300 font-medium">
                      {asg.riderName || (typeof asg.riderId === 'object' ? asg.riderId?.name : asg.riderId) || 'Unassigned'}
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
