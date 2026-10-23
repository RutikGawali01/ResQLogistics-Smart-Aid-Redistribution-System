import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { sheltersService } from '../../services/sheltersService.js';
import { assignmentsService } from '../../services/assignmentsService.js';
import { donationsService } from '../../services/donationsService.js';
import { MetricCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx';
import { StatusBadge, UrgencyBadge, CategoryBadge, Badge } from '../../components/ui/Badge.jsx';
import { Button, Input, Select, FormField } from '../../components/ui/FormElements.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { ASSIGNMENT_STATUS, SOCKET_EVENTS } from '@aidflow/shared';
import { connectSocket, subscribeToEvent } from '../../services/socket.js';
import {
  Building2,
  Users,
  Utensils,
  AlertTriangle,
  Inbox,
  CheckCircle2,
  Clock,
  Package,
  PlusCircle,
  Truck,
  DoorOpen,
  DoorClosed,
  Refrigerator,
  ChefHat,
  Send,
  Sparkles,
  Layers,
  RefreshCw,
  X,
  PackageCheck
} from 'lucide-react';

export function ShelterDashboard() {
  const { user, forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [shelter, setShelter] = useState(null);
  const [incomingDeliveries, setIncomingDeliveries] = useState([]);
  const [availableAid, setAvailableAid] = useState([]);
  const [actionNotice, setActionNotice] = useState(null);

  // Aid claiming & reservation modal states
  const [requestingAidId, setRequestingAidId] = useState(null);
  const [claimModalDonation, setClaimModalDonation] = useState(null);
  const [claimQuantity, setClaimQuantity] = useState('');
  const [claimError, setClaimError] = useState(null);
  const [catalogNotice, setCatalogNotice] = useState(null);

  // Shelter Open/Close status
  const [isOpen, setIsOpen] = useState(true);

  // Form states for capacity and resource availability
  const [currentOccupancy, setCurrentOccupancy] = useState(88);
  const [maxCapacity, setMaxCapacity] = useState(100);
  const [mealsNeeded, setMealsNeeded] = useState(150);
  const [urgencyLevel, setUrgencyLevel] = useState('HIGH');
  const [refrigerationAvailable, setRefrigerationAvailable] = useState(true);
  const [staffAvailable, setStaffAvailable] = useState(true);
  const [dockAccessible, setDockAccessible] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Food & Aid Demand publication state
  const [publishedDemands, setPublishedDemands] = useState([]);
  const [newDemandCategory, setNewDemandCategory] = useState('PREPARED_MEALS');
  const [newDemandQuantity, setNewDemandQuantity] = useState('');
  const [newDemandUnit, setNewDemandUnit] = useState('servings');
  const [newDemandUrgency, setNewDemandUrgency] = useState('HIGH');
  const [newDemandDesc, setNewDemandDesc] = useState('');
  const [isPublishingDemand, setIsPublishingDemand] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [shlRes, asgRes, donRes] = await Promise.all([
        sheltersService.getShelters(),
        assignmentsService.getAssignments(),
        donationsService.getDonations({ status: 'AVAILABLE' })
      ]);

      const myShelter =
        shlRes.data?.find((s) => s.managerId === user?.id || s.managerId === user?._id) ||
        shlRes.data?.[0] ||
        null;
      setShelter(myShelter);
      if (myShelter) {
        setCurrentOccupancy(myShelter.capacity?.currentOccupancy ?? 88);
        setMaxCapacity(myShelter.capacity?.maxCapacity ?? 100);
        setMealsNeeded(myShelter.capacity?.mealsNeededPerDay ?? 150);
        setUrgencyLevel(myShelter.urgencyLevel || 'HIGH');
        setIsOpen(myShelter.isOpen !== false && myShelter.active !== false);
      }

      setIncomingDeliveries(
        asgRes.data?.filter((a) => a.status !== ASSIGNMENT_STATUS.DELIVERED) || []
      );
      setAvailableAid(donRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load shelter dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Socket.IO real-time event listeners for live incoming dispatches and capacity
    connectSocket();

    const unsubAsgState = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, (data) => {
      const asgId = data?.assignmentId || data?.id;
      if (asgId) {
        setIncomingDeliveries((prev) => {
          const exists = prev.some((a) => a.id === asgId);
          if (exists) {
            if (data.newStatus === ASSIGNMENT_STATUS.DELIVERED) {
              return prev.filter((a) => a.id !== asgId);
            }
            return prev.map((a) =>
              a.id === asgId ? { ...a, status: data.newStatus || data.status || a.status } : a
            );
          }
          if (data.newStatus !== ASSIGNMENT_STATUS.DELIVERED && data.shelterId === shelter?.id) {
            return [data, ...prev];
          }
          return prev;
        });
      }
    });

    const unsubDonCreated = subscribeToEvent(SOCKET_EVENTS.DONATION_CREATED, (newDonation) => {
      if (newDonation) {
        setAvailableAid((prev) => [newDonation, ...prev.filter((d) => d.id !== (newDonation.id || newDonation._id))]);
      }
    });

    const unsubDonReserved = subscribeToEvent(SOCKET_EVENTS.DONATION_RESERVED, (data) => {
      const updated = data?.donation || data;
      if (updated?.id || updated?._id) {
        const id = updated.id || updated._id;
        setAvailableAid((prev) =>
          prev
            .map((d) => (d.id === id || d._id === id ? { ...d, ...updated } : d))
            .filter((d) => (d.availableQuantity !== undefined ? d.availableQuantity > 0 : d.status === 'AVAILABLE'))
        );
      }
    });

    const unsubShelterCapacity = subscribeToEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, (updatedShelter) => {
      if (updatedShelter && (updatedShelter.id === shelter?.id || updatedShelter._id === shelter?.id)) {
        setShelter((prev) => ({ ...prev, ...updatedShelter }));
        if (updatedShelter.capacity) {
          setCurrentOccupancy(updatedShelter.capacity.currentOccupancy);
          setMaxCapacity(updatedShelter.capacity.maxCapacity);
        }
      }
    });

    return () => {
      if (unsubAsgState) unsubAsgState();
      if (unsubDonCreated) unsubDonCreated();
      if (unsubDonReserved) unsubDonReserved();
      if (unsubShelterCapacity) unsubShelterCapacity();
    };
  }, [forceMock, shelter?.id]);

  // Toggle Shelter Open/Close Status via Real Express API
  const handleToggleOpenClose = async () => {
    if (!shelter) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    setError(null);

    const res = await sheltersService.updateStatus(
      shelter.id,
      { isOpen: nextState, urgencyLevel },
      { forceMock }
    );

    if (res.success) {
      const statusMsg = nextState
        ? 'Shelter marked as OPEN for community relief and aid deliveries.'
        : 'Shelter marked as TEMPORARILY CLOSED. Dispatch paused.';
      setActionNotice(statusMsg);
      loadData();
    } else {
      setIsOpen(!nextState); // revert on failure
      setError(res.error || 'Failed to update shelter intake status on server');
      loadData();
    }
  };

  // Update Receiving Capacity & Resource Availability via Real Express API
  const handleUpdateCapacity = async (e) => {
    e.preventDefault();
    if (!shelter) return;
    setIsUpdating(true);
    setActionNotice(null);
    setError(null);

    const shelterId = shelter.id || shelter._id;

    try {
      const res = await sheltersService.updateDemand(
        shelterId,
        {
          mealsNeededPerDay: Number(mealsNeeded),
          currentDemand: Number(mealsNeeded),
          receivingCapacity: Number(maxCapacity)
        },
        { forceMock }
      );

      const urgRes = await sheltersService.updateStatus(shelterId, { urgencyLevel }, { forceMock });

      if (res.success && urgRes.success) {
        setActionNotice('Receiving capacity, resource availability, and urgency levels successfully updated on server.');
        loadData();
      } else {
        const errorMsg = res.error || urgRes.error || 'Failed to update capacity on server';
        setError(errorMsg);
        loadData();
      }
    } catch (err) {
      setError(err.message || 'Capacity update error');
      loadData();
    } finally {
      setIsUpdating(false);
    }
  };

  // Publish Food or Aid Demand
  const handlePublishDemand = (e) => {
    e.preventDefault();
    if (!newDemandQuantity) return;
    setIsPublishingDemand(true);

    const createdDemand = {
      id: `dmd_${Date.now()}`,
      category: newDemandCategory,
      quantity: Number(newDemandQuantity),
      unit: newDemandUnit,
      urgency: newDemandUrgency,
      description: newDemandDesc || 'Immediate shelter food supply request',
      createdAt: new Date().toISOString(),
      status: 'ACTIVE_DEMAND'
    };

    setPublishedDemands((prev) => [createdDemand, ...prev]);
    setActionNotice(`Published demand for ${newDemandQuantity} ${newDemandUnit} of ${newDemandCategory.replace(/_/g, ' ')} to the donor network.`);
    setNewDemandQuantity('');
    setNewDemandDesc('');
    setIsPublishingDemand(false);
  };

  // Confirm Received Deliveries with sequential transition validation
  const handleConfirmReceipt = async (target) => {
    setActionNotice(null);
    setError(null);
    const asg = typeof target === 'object' ? target : incomingDeliveries.find((a) => (a.id || a._id) === target);
    const assignmentId = asg ? (asg.id || asg._id) : target;
    if (!assignmentId) return;

    const currentStatus = asg?.status;
    const fullChain = [
      ASSIGNMENT_STATUS.UNASSIGNED,
      ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
      ASSIGNMENT_STATUS.ACCEPTED,
      ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS,
      ASSIGNMENT_STATUS.PICKED_UP,
      ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS,
      ASSIGNMENT_STATUS.DELIVERED
    ];

    const currentIndex = currentStatus ? fullChain.indexOf(currentStatus) : -1;
    if (currentIndex >= 0 && currentIndex < fullChain.length - 1) {
      // Step sequentially to DELIVERED to strictly conform to state machine
      for (let i = currentIndex + 1; i < fullChain.length; i++) {
        const nextState = fullChain[i];
        const res = await assignmentsService.transitionState(assignmentId, nextState, {
          reason: 'Intake processed by Shelter Supervisor',
          forceMock
        });
        if (!res.success) {
          setError(res.error || `Failed transition to ${nextState}`);
          loadData();
          return;
        }
      }
      setIncomingDeliveries((prev) => prev.filter((a) => (a.id || a._id) !== assignmentId));
      setActionNotice(`Shipment confirmed received into kitchen pantry.`);
      loadData();
    } else {
      const res = await assignmentsService.transitionState(
        assignmentId,
        ASSIGNMENT_STATUS.DELIVERED,
        { reason: 'Confirmed intake by Shelter Supervisor', forceMock }
      );
      if (res.success) {
        setIncomingDeliveries((prev) => prev.filter((a) => (a.id || a._id) !== assignmentId));
        setActionNotice(`Shipment confirmed received into kitchen pantry.`);
        loadData();
      } else {
        setError(res.error || 'Failed to confirm intake on server');
        loadData();
      }
    }
  };

  const handleOpenClaimModal = (donation) => {
    setClaimModalDonation(donation);
    const avail = donation.availableQuantity !== undefined ? donation.availableQuantity : donation.quantity;
    setClaimQuantity(String(avail || ''));
    setClaimError(null);
  };

  const handleConfirmClaim = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!claimModalDonation) return;

    const qty = Number(claimQuantity);
    const maxAvail =
      claimModalDonation.availableQuantity !== undefined
        ? claimModalDonation.availableQuantity
        : claimModalDonation.quantity;

    if (!qty || qty <= 0) {
      setClaimError('Please enter a valid positive quantity to claim.');
      return;
    }

    if (qty > maxAvail) {
      setClaimError(
        `Cannot claim ${qty} ${claimModalDonation.unit}. Only ${maxAvail} ${claimModalDonation.unit} currently available.`
      );
      return;
    }

    const donationId = claimModalDonation.id || claimModalDonation._id;
    setRequestingAidId(donationId);
    setClaimError(null);

    try {
      const res = await donationsService.reserveDonation(
        donationId,
        {
          shelterId: shelter?.id || shelter?._id,
          requestedQuantity: qty,
          title: claimModalDonation.title
        },
        { forceMock }
      );

      if (res.success) {
        const remaining = Math.max(0, maxAvail - qty);
        setAvailableAid((prev) =>
          prev
            .map((d) => {
              const dId = d.id || d._id;
              if (dId === donationId) {
                return {
                  ...d,
                  availableQuantity: remaining,
                  status: remaining === 0 ? 'RESERVED' : d.status
                };
              }
              return d;
            })
            .filter((d) => (d.availableQuantity !== undefined ? d.availableQuantity > 0 : d.status === 'AVAILABLE'))
        );

        setCatalogNotice({
          type: 'success',
          message: `Successfully claimed ${qty} ${claimModalDonation.unit} of "${claimModalDonation.title}" for ${shelter?.name || 'this shelter'}. Dispatch reservation confirmed for 3 hours.`
        });
        setClaimModalDonation(null);
        setTimeout(() => setCatalogNotice(null), 8000);
        loadData();
      } else {
        if (res.status === 404) {
          setClaimError('This aid package was already claimed or the catalog refreshed. Refreshing available aid...');
          loadData();
          setTimeout(() => {
            setClaimModalDonation(null);
            setClaimError(null);
          }, 2000);
        } else {
          setClaimError(res.error || 'Failed to claim aid package on server');
        }
      }
    } catch (err) {
      setClaimError(err.message || 'An unexpected error occurred while claiming aid.');
    } finally {
      setRequestingAidId(null);
    }
  };

  if (loading) return <LoadingState message="Loading shelter operations hub..." />;
  if (error && !shelter) return <ErrorState message={error} onRetry={loadData} />;

  const occupancyRate = Math.round((currentOccupancy / (maxCapacity || 100)) * 100);

  return (
    <div className="space-y-6">
      {/* Top Shelter Profile Banner with Open/Close Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="w-3.5 h-3.5" />
              Relief Shelter Operations
            </span>
            <UrgencyBadge urgency={urgencyLevel} size="sm" />
            <Badge variant={isOpen ? 'emerald' : 'rose'} size="sm">
              {isOpen ? 'OPEN FOR INTAKE' : 'TEMPORARILY CLOSED'}
            </Badge>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {shelter?.name || 'Downtown Hope Refuge'}
          </h2>
          <p className="text-xs text-slate-300">
            {shelter?.address || '100 Mission St, San Francisco, CA'} • Manager: {user?.name || 'Elena Rostova'}
          </p>
        </div>

        {/* Shelter Open / Close Action */}
        <div className="flex items-center gap-3">
          <Button
            variant={isOpen ? 'outline' : 'primary'}
            size="md"
            icon={isOpen ? DoorClosed : DoorOpen}
            onClick={handleToggleOpenClose}
            className={!isOpen ? 'bg-emerald-600 hover:bg-emerald-500' : 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'}
          >
            {isOpen ? 'Close Shelter' : 'Open Shelter'}
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Current Bed Occupancy"
          value={`${currentOccupancy} / ${maxCapacity}`}
          subtext={`${occupancyRate}% capacity`}
          trend={`${occupancyRate}%`}
          color={occupancyRate >= 85 ? 'rose' : 'amber'}
          icon={Users}
        />
        <MetricCard
          title="Daily Meals Needed"
          value={`${mealsNeeded} meals`}
          subtext="Nutritional requirements"
          color="blue"
          icon={Utensils}
        />
        <MetricCard
          title="Inbound Shipments"
          value={incomingDeliveries.length.toString()}
          subtext="En route or arriving"
          color="purple"
          icon={Truck}
        />
        <MetricCard
          title="Facility Status"
          value={isOpen ? 'Operational' : 'Closed'}
          subtext="Intake availability"
          color={isOpen ? 'emerald' : 'rose'}
          icon={isOpen ? DoorOpen : DoorClosed}
        />
      </section>

      {/* Two-Column Operations: Receiving Capacity/Resources & Inbound Deliveries */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Capacity & Resource Availability Form */}
        <div className="glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              Receiving Capacity & Resources
            </h3>
            <p className="text-xs text-slate-400">
              Update capacity metrics and resource readiness for incoming food shipments.
            </p>
          </div>

          <form onSubmit={handleUpdateCapacity} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Beds Occupied">
                <Input
                  type="number"
                  min="0"
                  value={currentOccupancy}
                  onChange={(e) => setCurrentOccupancy(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Total Bed Capacity">
                <Input
                  type="number"
                  min="1"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  required
                />
              </FormField>
            </div>

            <FormField label="Daily Meals Needed">
              <Input
                type="number"
                min="0"
                value={mealsNeeded}
                onChange={(e) => setMealsNeeded(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Redistribution Urgency">
              <Select
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(e.target.value)}
              >
                <option value="LOW">Low Urgency (Pantry stocked)</option>
                <option value="MEDIUM">Medium Urgency (Standard intake)</option>
                <option value="HIGH">High Urgency (Understocked pantry)</option>
                <option value="CRITICAL">Critical Emergency (Immediate need)</option>
              </Select>
            </FormField>

            {/* Resource Availability Toggles */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Resource Availability
              </span>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refrigerationAvailable}
                  onChange={(e) => setRefrigerationAvailable(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500/20 bg-slate-900"
                />
                <span className="text-slate-300">Commercial Cold Storage / Fridge Ready</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={staffAvailable}
                  onChange={(e) => setStaffAvailable(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500/20 bg-slate-900"
                />
                <span className="text-slate-300">Kitchen Staff on Duty to Receive Food</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dockAccessible}
                  onChange={(e) => setDockAccessible(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500/20 bg-slate-900"
                />
                <span className="text-slate-300">Courier Loading Ramp / Dock Accessible</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isUpdating}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white"
            >
              Update Capacity & Availability
            </Button>
          </form>
        </div>

        {/* Right: Inbound Aid Deliveries with Confirm Delivery Action */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-400" />
                Inbound Aid Deliveries & Intake Confirmation
              </h3>
              <p className="text-xs text-slate-400">
                Verify arriving shipments and confirm delivery receipt to complete courier missions.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {incomingDeliveries.length} active shipments
            </span>
          </div>

          {incomingDeliveries.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No incoming deliveries en route"
              description="When a donor package is dispatched to this shelter, you will be able to confirm receipt here."
            />
          ) : (
            <div className="space-y-3">
              {incomingDeliveries.map((asg) => (
                <div
                  key={asg.id}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100">
                        {asg.donationTitle || 'Emergency Food Relief'}
                      </span>
                      <StatusBadge status={asg.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-400">
                      Courier: <span className="text-slate-200">{asg.riderName || 'Carlos Ruiz'}</span> •
                      Origin: {asg.pickupLocation?.address}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {asg.status === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConfirmReceipt(asg)}
                        icon={CheckCircle2}
                        className="self-start sm:self-center bg-emerald-600 hover:bg-emerald-500 font-semibold"
                      >
                        Confirm Delivery Intake
                      </Button>
                    ) : asg.status === ASSIGNMENT_STATUS.PICKED_UP ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConfirmReceipt(asg)}
                        icon={CheckCircle2}
                        className="self-start sm:self-center bg-indigo-600 hover:bg-indigo-500 text-xs"
                      >
                        Receive Cargo (In Transit)
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleConfirmReceipt(asg)}
                        icon={CheckCircle2}
                        className="self-start sm:self-center text-xs text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                        title="Courier is preparing or en route to donor. Click to fast-track intake."
                      >
                        Fast-Track Intake
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Publish Food or Aid Demand Section */}
      <section className="glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-400" />
            Publish Food or Aid Demand
          </h3>
          <p className="text-xs text-slate-400">
            Broadcast urgent nourishment and aid supply needs to commercial donors and the AidFlow automated redistribution engine.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Demand Broadcast Form */}
          <form onSubmit={handlePublishDemand} className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
            <FormField label="Supply Category Needed">
              <Select value={newDemandCategory} onChange={(e) => setNewDemandCategory(e.target.value)}>
                <option value="PREPARED_MEALS">Prepared Hot Meals</option>
                <option value="PRODUCE">Fresh Produce & Greens</option>
                <option value="BAKERY">Bread & Bakery Goods</option>
                <option value="DAIRY">Dairy & Milk</option>
                <option value="NON_PERISHABLE">Canned & Non-Perishable</option>
                <option value="HYGIENE">Hygiene & Essentials</option>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Quantity Needed">
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={newDemandQuantity}
                  onChange={(e) => setNewDemandQuantity(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Unit">
                <Input
                  placeholder="e.g. servings, kg, boxes"
                  value={newDemandUnit}
                  onChange={(e) => setNewDemandUnit(e.target.value)}
                  required
                />
              </FormField>
            </div>

            <FormField label="Urgency">
              <Select value={newDemandUrgency} onChange={(e) => setNewDemandUrgency(e.target.value)}>
                <option value="LOW">Low (Within 48h)</option>
                <option value="MEDIUM">Medium (Within 24h)</option>
                <option value="HIGH">High (Immediate Need)</option>
                <option value="CRITICAL">Critical Emergency</option>
              </Select>
            </FormField>

            <FormField label="Dietary / Specific Requirements">
              <Input
                placeholder="e.g. Vegetarian preferred, shelf-stable packaging"
                value={newDemandDesc}
                onChange={(e) => setNewDemandDesc(e.target.value)}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Send}
              isLoading={isPublishingDemand}
              className="w-full bg-sky-600 hover:bg-sky-500"
            >
              Broadcast Demand
            </Button>
          </form>

          {/* Active Published Demands List */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Active Published Demands ({publishedDemands.length})
            </h4>

            <div className="space-y-2.5">
              {publishedDemands.map((demand) => (
                <div
                  key={demand.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={demand.category} size="sm" />
                      <span className="font-semibold text-sm text-slate-100">
                        {demand.quantity} {demand.unit}
                      </span>
                      <UrgencyBadge urgency={demand.urgency} size="xs" />
                    </div>
                    <p className="text-xs text-slate-400">{demand.description}</p>
                  </div>

                  <Badge variant={demand.status === 'MATCHED' ? 'blue' : 'emerald'} size="sm">
                    {demand.status === 'MATCHED' ? 'Donor Matched' : 'Broadcasting'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Available Surplus Aid Marketplace Preview */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              Available Surplus Aid Catalog
            </h3>
            <p className="text-xs text-slate-400">
              Directly claim available aid packages from regional commercial donors into your shelter intake.
            </p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60 self-start">
            {availableAid.length} Packages Available
          </span>
        </div>

        {/* Catalog Notification Banner */}
        {catalogNotice && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in shadow-lg ${
              catalogNotice.type === 'error'
                ? 'bg-rose-950/60 border border-rose-800 text-rose-200'
                : 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {catalogNotice.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              )}
              <span className="font-medium">{catalogNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setCatalogNotice(null)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {availableAid.length === 0 ? (
          <EmptyState
            title="All available aid is currently reserved"
            description="Check back shortly as new commercial donations are registered."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableAid.map((item) => {
              const donationId = item.id || item._id;
              const currentAvailable =
                item.availableQuantity !== undefined ? item.availableQuantity : item.quantity;
              const isClaiming = requestingAidId === donationId;

              return (
                <Card key={donationId} hover className="flex flex-col justify-between border-slate-800/90 bg-slate-900/60">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <CategoryBadge category={item.category || item.aidType} size="sm" />
                      <span className="text-xs font-semibold text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                        {currentAvailable} {item.unit}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {item.description || 'Verified commercial surplus aid.'}
                    </p>
                  </div>
                  <div className="pt-4 mt-3 border-t border-slate-800/90 flex items-center justify-between text-xs">
                    <span className="text-slate-400 truncate max-w-[130px] font-medium">
                      {item.pickupLocation?.contactName || 'Donor Facility'}
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Package}
                      isLoading={isClaiming}
                      onClick={() => handleOpenClaimModal(item)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950/40"
                    >
                      Request Aid
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Interactive Aid Claim & Reservation Modal Dialog */}
      {claimModalDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card border border-slate-700/80 bg-slate-900/95 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 relative">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={claimModalDonation.category || claimModalDonation.aidType} size="sm" />
                  <span className="text-xs text-emerald-400 font-mono font-medium">
                    Available: {claimModalDonation.availableQuantity ?? claimModalDonation.quantity} {claimModalDonation.unit}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Request Aid: {claimModalDonation.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClaimModalDonation(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Donation Summary & Storage Fit Details */}
            <div className="space-y-2 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Donor Facility:</span>
                <span className="font-medium text-slate-200">
                  {claimModalDonation.pickupLocation?.contactName || 'Verified Regional Donor'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Pickup Address:</span>
                <span className="font-medium text-slate-200 truncate max-w-[240px]">
                  {claimModalDonation.pickupLocation?.address || 'San Francisco Distribution Center'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Receiving Shelter:</span>
                <span className="font-semibold text-amber-400">
                  {shelter?.name || 'Downtown Hope Refuge'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Handling Requirements:</span>
                <span className="font-medium text-slate-200">
                  {claimModalDonation.handlingRequirements || claimModalDonation.storageRequirement || 'ROOM_TEMPERATURE'}
                </span>
              </div>
            </div>

            {claimError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{claimError}</span>
              </div>
            )}

            {/* Claim Form */}
            <form onSubmit={handleConfirmClaim} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex justify-between">
                  <span>Quantity to Request ({claimModalDonation.unit})</span>
                  <span className="text-slate-500">
                    Max: {claimModalDonation.availableQuantity ?? claimModalDonation.quantity} {claimModalDonation.unit}
                  </span>
                </label>
                <Input
                  type="number"
                  min="1"
                  max={claimModalDonation.availableQuantity ?? claimModalDonation.quantity}
                  value={claimQuantity}
                  onChange={(e) => setClaimQuantity(e.target.value)}
                  placeholder="Enter quantity to claim..."
                  required
                  autoFocus
                />
              </div>

              {/* Quick Fill Buttons */}
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setClaimQuantity(
                      String(
                        Math.max(
                          1,
                          Math.round(
                            (claimModalDonation.availableQuantity ?? claimModalDonation.quantity) * 0.5
                          )
                        )
                      )
                    )
                  }
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors"
                >
                  Claim 50%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setClaimQuantity(
                      String(claimModalDonation.availableQuantity ?? claimModalDonation.quantity)
                    )
                  }
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] border border-slate-700 font-medium transition-colors"
                >
                  Claim Full Package ({claimModalDonation.availableQuantity ?? claimModalDonation.quantity} {claimModalDonation.unit})
                </button>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setClaimModalDonation(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={PackageCheck}
                  isLoading={requestingAidId === (claimModalDonation.id || claimModalDonation._id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950/40"
                >
                  Confirm Aid Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
