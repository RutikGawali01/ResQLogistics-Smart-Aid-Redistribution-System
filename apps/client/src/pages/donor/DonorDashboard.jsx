import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { donationsService } from '../../services/donationsService.js';
import { assignmentsService } from '../../services/assignmentsService.js';
import { MetricCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';
import { CategoryBadge, Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/FormElements.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { connectSocket, disconnectSocket, subscribeToEvent } from '../../services/socket.js';
import { SOCKET_EVENTS } from '@aidflow/shared';
import {
  HeartHandshake,
  PlusCircle,
  Package,
  Sparkles,
  Calendar,
  MapPin,
  TrendingUp,
  Leaf,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  ShieldCheck,
  Eye,
  X,
  RefreshCw
} from 'lucide-react';
import { connectSocket, subscribeToEvent } from '../../services/socket.js';
import { SOCKET_EVENTS } from '@aidflow/shared';

export function DonorDashboard() {
  const { user, forceMock } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [donations, setDonations] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedDonation, setSelectedDonation] = useState(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [donRes, asgRes] = await Promise.all([
        donationsService.getDonations({ forceMock }),
        assignmentsService.getAssignments({ forceMock })
      ]);
      setDonations(donRes.data || []);
      setAssignments(asgRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load donations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Socket.IO real-time event listeners for live donor impact tracking
    connectSocket();

    const unsubCreated = subscribeToEvent(SOCKET_EVENTS.DONATION_CREATED, (newDonation) => {
      if (newDonation) {
        setDonations((prev) => [newDonation, ...prev.filter((d) => d.id !== (newDonation.id || newDonation._id))]);
      }
    });

    const unsubReserved = subscribeToEvent(SOCKET_EVENTS.DONATION_RESERVED, (data) => {
      const updated = data?.donation || data;
      if (updated?.id || updated?._id) {
        const id = updated.id || updated._id;
        setDonations((prev) =>
          prev.map((d) => (d.id === id || d._id === id ? { ...d, ...updated } : d))
        );
      }
    });

    const unsubAsgState = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, (data) => {
      const asgId = data?.assignmentId || data?.id;
      if (asgId) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === asgId ? { ...a, status: data.newStatus || data.status || a.status } : a))
        );
      }
      if (data?.newStatus === 'DELIVERED') {
        fetchData(true);
      }
    });

    return () => {
      if (unsubCreated) unsubCreated();
      if (unsubReserved) unsubReserved();
      if (unsubAsgState) unsubAsgState();
    };
  }, [forceMock]);

  if (loading) return <LoadingState message="Loading your donor impact dashboard..." />;
  if (error) return <ErrorState message={error} />;

  // Calculate required quantities: Available, Reserved, and Completed from real MongoDB data
  const activeDonations = donations.filter((d) => d.status !== 'CANCELLED' && d.status !== 'EXPIRED');

  const availableQuantity = activeDonations.reduce((acc, d) => {
    if (d.status === 'DELIVERED') return acc;
    const avail = d.availableQuantity !== undefined
      ? Number(d.availableQuantity)
      : (d.status === 'AVAILABLE' ? Number(d.quantity) : 0);
    return acc + (avail || 0);
  }, 0);

  const reservedQuantity = activeDonations.reduce((acc, d) => {
    if (d.status === 'DELIVERED') return acc;
    const total = Number(d.quantity) || 0;
    const avail = d.availableQuantity !== undefined
      ? Number(d.availableQuantity)
      : (d.status === 'AVAILABLE' ? total : 0);
    const reserved = Math.max(0, total - avail);
    return acc + (reserved || 0);
  }, 0);

  const completedQuantity = donations
    .filter((d) => d.status === 'DELIVERED')
    .reduce((acc, d) => acc + (Number(d.quantity) || 0), 0);

  const totalQuantity = donations.reduce((acc, d) => acc + (Number(d.quantity) || 0), 0);

  const availableDonations = donations.filter(
    (d) => d.status === 'AVAILABLE' || (d.availableQuantity !== undefined && d.availableQuantity > 0)
  );
  const reservedDonations = donations.filter((d) =>
    ['RESERVED', 'ASSIGNED', 'IN_TRANSIT'].includes(d.status) ||
    (d.availableQuantity !== undefined && d.availableQuantity < d.quantity && d.status !== 'DELIVERED')
  );
  const completedDonations = donations.filter((d) => d.status === 'DELIVERED');

  // Helper to match donation with its assignment for pickup & delivery tracking
  const getDeliveryInfo = (donationId) => {
    const asg = assignments.find((a) => a.donationId === donationId || a.donationId?._id === donationId);
    if (!asg) {
      return { statusText: 'Awaiting shelter reservation', rider: null, shelter: null };
    }
    return {
      statusText: (asg.status || 'ASSIGNED').replace(/_/g, ' '),
      rider: asg.riderName || asg.riderId?.name || 'Courier Assigned',
      shelter: asg.shelterName || asg.shelterId?.name || 'Regional Relief Hub',
      assignment: asg
    };
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Create Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HeartHandshake className="w-3.5 h-3.5" />
            Verified Aid Donor
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Welcome back, {user?.name || 'Aid Donor'}
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            {user?.organization || 'Fresh Market Surplus Hub'} • Keeping quality surplus food out of landfills and routing immediate nourishment to frontline shelters.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/donor/create')}
          icon={PlusCircle}
          className="self-start sm:self-center shadow-lg shadow-emerald-900/40"
        >
          Post Surplus Aid
        </Button>
      </div>

      {/* Available, Reserved, and Completed Quantities Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Available Quantity"
          value={`${availableQuantity.toLocaleString()} units`}
          subtext={`${availableDonations.length} listings ready for pickup`}
          color="emerald"
          icon={Package}
        />
        <MetricCard
          title="Reserved Quantity"
          value={`${reservedQuantity.toLocaleString()} units`}
          subtext={`${reservedDonations.length} in route / assigned`}
          color="blue"
          icon={Clock}
        />
        <MetricCard
          title="Completed Deliveries"
          value={`${completedQuantity.toLocaleString()} units`}
          subtext={`${completedDonations.length} successfully received`}
          color="purple"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Total Lifetime Aid"
          value={`${totalQuantity.toLocaleString()} units`}
          subtext="Total food rescued"
          trend="+22% this mo"
          color="amber"
          icon={Leaf}
        />
      </section>

      {/* Active Listings Table with Real-time Pickup and Delivery Tracking */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Surplus Aid Listings & Dispatch Tracking</h3>
            <p className="text-xs text-slate-400">
              Real-time monitoring of available, reserved, and delivered aid shipments
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/donor/create')}
            icon={PlusCircle}
          >
            New Donation
          </Button>
        </div>

        {donations.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No donations posted yet"
            description="Register your surplus prepared food, bakery goods, or produce to connect with local shelters."
            actionLabel="Register Surplus Food"
            onAction={() => navigate('/donor/create')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Listing Details</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Pickup Location</TableHead>
                <TableHead>Logistics & Delivery Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((d) => {
                const delivery = getDeliveryInfo(d.id);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-100">{d.title}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">
                        {d.description || 'Verified food package.'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={d.category} size="sm" />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-200">
                      {d.quantity} {d.unit}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-400">
                      {d.storageRequirement}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate max-w-[180px]">{d.pickupLocation?.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant={
                            d.status === 'AVAILABLE'
                              ? 'emerald'
                              : d.status === 'DELIVERED'
                              ? 'purple'
                              : 'blue'
                          }
                          size="sm"
                        >
                          {d.status}
                        </Badge>
                        {delivery.shelter && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Truck className="w-3 h-3 text-sky-400" />
                            <span>Destination: {delivery.shelter}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={Eye}
                        onClick={() => setSelectedDonation(d)}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Donation Detail Inspection Modal */}
      {selectedDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-emerald-400">Shipment Details</span>
                <h3 className="text-base font-bold text-white">{selectedDonation.title}</h3>
              </div>
              <button
                onClick={() => setSelectedDonation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <span className="text-slate-500">Category:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{selectedDonation.category}</p>
                </div>
                <div>
                  <span className="text-slate-500">Quantity:</span>
                  <p className="font-semibold text-emerald-400 mt-0.5">
                    {selectedDonation.quantity} {selectedDonation.unit}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Storage Temp:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{selectedDonation.storageRequirement}</p>
                </div>
                <div>
                  <span className="text-slate-500">Logistics Status:</span>
                  <div className="mt-0.5">
                    <Badge variant={selectedDonation.status === 'AVAILABLE' ? 'emerald' : 'blue'}>
                      {selectedDonation.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Pickup Point
                </div>
                <p className="text-slate-300">{selectedDonation.pickupLocation?.address}</p>
                {selectedDonation.pickupLocation?.contactName && (
                  <p className="text-slate-400">
                    Contact: {selectedDonation.pickupLocation.contactName} ({selectedDonation.pickupLocation.contactPhone})
                  </p>
                )}
              </div>

              {selectedDonation.allergens?.length > 0 && (
                <div>
                  <span className="text-slate-500">Allergen Declarations:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedDonation.allergens.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedDonation(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
