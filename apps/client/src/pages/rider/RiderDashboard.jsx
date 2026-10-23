import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { assignmentsService } from '../../services/assignmentsService.js';
import { ridersService } from '../../services/ridersService.js';
import { MetricCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx';
import { StatusBadge, Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/FormElements.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { MapPreview } from '../../components/MapPreview.jsx';
import { ASSIGNMENT_STATUS, SOCKET_EVENTS } from '@aidflow/shared';
import { subscribeToEvent } from '../../services/socket.js';
import {
  Bike,
  Navigation,
  CheckCircle2,
  MapPin,
  Clock,
  ArrowRight,
  Phone,
  AlertCircle,
  Truck,
  Package,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export function RiderDashboard() {
  const { user, forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [riderInfo, setRiderInfo] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [asgRes, rdrRes] = await Promise.all([
        assignmentsService.getAssignments({ forceMock }),
        ridersService.getRiderById(user?.id || 'usr_rider_01', { forceMock })
      ]);
      setAssignments(asgRes.data || []);
      setRiderInfo(rdrRes.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load dispatch data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to live events for couriers
    const unsubOffered = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_OFFERED, (asg) => {
      if (asg) {
        setAssignments((prev) => {
          const id = asg.assignmentId || asg.id;
          if (prev.some((a) => a.id === id)) return prev;
          return [asg, ...prev];
        });
        setActionSuccess('New delivery assignment offered to your queue!');
      }
    });

    const unsubState = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, (asg) => {
      if (asg) {
        const id = asg.assignmentId || asg.id;
        setAssignments((prev) => {
          const exists = prev.some((a) => a.id === id);
          if (exists) {
            return prev.map((a) =>
              a.id === id ? { ...a, ...asg, status: asg.newStatus || asg.status } : a
            );
          }
          return [asg, ...prev];
        });
      }
    });

    const unsubRider = subscribeToEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, (data) => {
      if (data && (data.riderId === user?.id || data.riderId === riderInfo?.id)) {
        setRiderInfo((prev) => ({
          ...prev,
          status: data.status || prev?.status,
          isAvailable: data.isAvailable !== undefined ? data.isAvailable : prev?.isAvailable
        }));
      }
    });

    return () => {
      unsubOffered();
      unsubState();
      unsubRider();
    };
  }, [forceMock, user?.id, riderInfo?.id]);

  // Current active assignment for this rider
  const activeAssignment = assignments.find(
    (a) =>
      a.status !== ASSIGNMENT_STATUS.DELIVERED &&
      a.status !== ASSIGNMENT_STATUS.CANCELLED &&
      a.status !== ASSIGNMENT_STATUS.FAILED
  ) || assignments[0];

  const completedAssignments = assignments.filter(
    (a) => a.status === ASSIGNMENT_STATUS.DELIVERED
  );

  const handleTransition = async (targetStatus) => {
    if (!activeAssignment) return;
    setActionSuccess(null);
    setError(null);
    try {
      const res = await assignmentsService.transitionState(activeAssignment.id, targetStatus, { forceMock });
      if (res.success && res.data) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === activeAssignment.id ? res.data : a))
        );
        setActionSuccess(`Status transitioned to ${targetStatus}`);
      } else {
        const errMsg = res.details?.reason || res.error || 'State transition failed';
        setError(errMsg);
      }
    } catch (err) {
      setError(err.message || 'State transition failed');
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = riderInfo?.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    setError(null);
    try {
      const res = await ridersService.updateStatus(user?.id || 'usr_rider_01', nextStatus, { forceMock });
      if (res.success) {
        setRiderInfo((prev) => ({ ...prev, status: nextStatus }));
        setActionSuccess(`Status updated to ${nextStatus}`);
      } else {
        setError(res.error || 'Failed to update courier status');
      }
    } catch (err) {
      setError(err.message || 'Failed to update courier status');
    }
  };

  if (loading) return <LoadingState message="Connecting to Courier Dispatch Cockpit..." />;
  if (error && !assignments.length) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {/* Rider Status & Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                {user?.name || 'Courier Rider'}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-sky-500/20">
                {riderInfo?.vehicleType || 'E_BIKE'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Active Courier • ID: {user?.id || 'rdr_mock_01'} • 4.95 Rating
            </p>
          </div>
        </div>

        {/* Status Toggle Button */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Dispatch Status:</span>
          <Button
            size="sm"
            variant={riderInfo?.status === 'AVAILABLE' ? 'primary' : 'outline'}
            onClick={handleToggleStatus}
          >
            <span
              className={`w-2 h-2 rounded-full mr-1.5 ${
                riderInfo?.status === 'AVAILABLE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {riderInfo?.status === 'AVAILABLE' ? 'Ready for Jobs (Online)' : 'Standby / Offline'}
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Active Assignment Section */}
      {activeAssignment ? (
        <section className="glass-card rounded-2xl border border-sky-500/30 p-6 space-y-6 bg-slate-900/80 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" />
                  Active Dispatch Mission
                </span>
                <span className="font-mono text-xs text-slate-400">#{activeAssignment.id}</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                {activeAssignment.donationTitle || 'Emergency Surplus Aid Package'}
              </h3>
            </div>
            <StatusBadge status={activeAssignment.status} size="lg" />
          </div>

          {/* Pickup and Delivery Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Pickup */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Package className="w-4 h-4" />
                  1. Pickup Location
                </span>
                <span>Donor Contact</span>
              </div>
              <p className="text-sm font-medium text-slate-100">
                {activeAssignment.pickupLocation?.contactName || 'Donor Facility'}
              </p>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                {activeAssignment.pickupLocation?.address}
              </p>
              {activeAssignment.pickupLocation?.contactPhone && (
                <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {activeAssignment.pickupLocation.contactPhone}
                </p>
              )}
            </div>

            {/* Step 2: Dropoff */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <MapPin className="w-4 h-4" />
                  2. Destination Shelter
                </span>
                <span>Intake Dock</span>
              </div>
              <p className="text-sm font-medium text-slate-100">
                {activeAssignment.shelterName || (typeof activeAssignment.shelterId === 'object' ? activeAssignment.shelterId?.name : activeAssignment.shelterId) || 'Downtown Hope Refuge'}
              </p>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                {activeAssignment.deliveryLocation?.address || (typeof activeAssignment.shelterId === 'object' ? (activeAssignment.shelterId?.address || activeAssignment.shelterId?.location?.address) : '') || 'Intake Dock'}
              </p>
              {activeAssignment.notes && (
                <p className="text-xs text-amber-300/90 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                  Note: {activeAssignment.notes}
                </p>
              )}
            </div>
          </div>

          {/* Interactive State Transition Step Bar */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Trip Lifecycle Progression Action
            </h4>

            <div className="flex flex-wrap items-center gap-3">
              {activeAssignment.status === ASSIGNMENT_STATUS.PENDING_ACCEPTANCE && (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => handleTransition(ASSIGNMENT_STATUS.ACCEPTED)}
                    className="flex-1 sm:flex-none"
                  >
                    Accept Dispatch Mission
                  </Button>
                  <Button
                    variant="danger"
                    size="lg"
                    onClick={() => handleTransition(ASSIGNMENT_STATUS.CANCELLED)}
                  >
                    Decline Job
                  </Button>
                </>
              )}

              {activeAssignment.status === ASSIGNMENT_STATUS.ACCEPTED && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleTransition(ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS)}
                  icon={Truck}
                >
                  Start Route to Pickup Location
                </Button>
              )}

              {activeAssignment.status === ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleTransition(ASSIGNMENT_STATUS.PICKED_UP)}
                  icon={CheckCircle2}
                >
                  Arrived & Collected Supplies (Confirm Picked Up)
                </Button>
              )}

              {activeAssignment.status === ASSIGNMENT_STATUS.PICKED_UP && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleTransition(ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS)}
                  icon={Navigation}
                >
                  Depart for Shelter (En Route to Delivery)
                </Button>
              )}

              {activeAssignment.status === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleTransition(ASSIGNMENT_STATUS.DELIVERED)}
                  icon={CheckCircle2}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Complete Delivery & Sign Off Receipt
                </Button>
              )}

              {activeAssignment.status === ASSIGNMENT_STATUS.DELIVERED && (
                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Mission Completed Successfully!
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Bike}
          title="No active dispatch assignment"
          description="You are currently idle and ready. When an emergency aid pickup is matched, you will receive an alert here."
        />
      )}

      {/* Completed Deliveries Table */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-100">My Completed Relief Deliveries</h3>
        {completedAssignments.length === 0 ? (
          <EmptyState
            title="No past deliveries yet"
            description="Completed trips will be archived here with proof of receipt."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Assignment ID</TableHead>
                <TableHead>Aid Package</TableHead>
                <TableHead>Dropoff Shelter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedAssignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs text-slate-400">{a.id}</TableCell>
                  <TableCell className="font-medium text-slate-200">
                    {a.donationTitle || (typeof a.donationId === 'object' ? (a.donationId?.title || a.donationId?.aidType) : a.donationId) || 'Surplus Aid Goods'}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {a.shelterName || (typeof a.shelterId === 'object' ? a.shelterId?.name : a.shelterId) || 'Relief Shelter'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {a.timeline?.deliveredAt
                      ? new Date(a.timeline.deliveredAt).toLocaleTimeString()
                      : 'Earlier today'}
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
