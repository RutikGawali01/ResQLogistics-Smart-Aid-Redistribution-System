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
import { subscribeToEvent } from '../../services/socket.js';
import { ASSIGNMENT_STATUS, SOCKET_EVENTS } from '@aidflow/shared';
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
  RefreshCw
} from 'lucide-react';

export function ShelterDashboard() {
  const { user, forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [shelter, setShelter] = useState(null);
  const [incomingDeliveries, setIncomingDeliveries] = useState([]);
  const [availableAid, setAvailableAid] = useState([]);
  const [actionNotice, setActionNotice] = useState(null);

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
  const [publishedDemands, setPublishedDemands] = useState([
    {
      id: 'dmd_01',
      category: 'PREPARED_MEALS',
      quantity: 80,
      unit: 'servings',
      urgency: 'HIGH',
      description: 'Hot nutritious dinners for evening intake',
      createdAt: new Date().toISOString(),
      status: 'ACTIVE_DEMAND'
    },
    {
      id: 'dmd_02',
      category: 'PRODUCE',
      quantity: 30,
      unit: 'kg',
      urgency: 'MEDIUM',
      description: 'Fresh vegetables & fruit for community kitchen salad bar',
      createdAt: new Date().toISOString(),
      status: 'MATCHED'
    }
  ]);
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
        sheltersService.getShelters({ forceMock }),
        assignmentsService.getAssignments({ forceMock }),
        donationsService.getDonations({ forceMock, status: 'AVAILABLE' })
      ]);

      const myShelter = shlRes.data?.[0] || null;
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

    // Subscribe to live events (Task 5)
    const unsubCapacity = subscribeToEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, (updatedShelter) => {
      if (updatedShelter && (updatedShelter.id === shelter?.id || updatedShelter._id === shelter?.id)) {
        setShelter(updatedShelter);
        if (updatedShelter.capacity) {
          setCurrentOccupancy(updatedShelter.capacity.currentOccupancy);
          setMaxCapacity(updatedShelter.capacity.maxCapacity);
        }
      }
    });

    const unsubAsgState = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, (asg) => {
      setIncomingDeliveries((prev) => {
        const id = asg.assignmentId || asg.id;
        const exists = prev.some((a) => a.id === id);
        if (exists) {
          return prev.map((a) => (a.id === id ? { ...a, ...asg, status: asg.newStatus || asg.status } : a));
        }
        return [asg, ...prev];
      });
    });

    return () => {
      unsubCapacity();
      unsubAsgState();
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
    } else {
      setIsOpen(!nextState); // revert on failure
      setError(res.error || 'Failed to update shelter intake status on server');
    }
  };

  // Update Receiving Capacity & Resource Availability via Real Express API
  const handleUpdateCapacity = async (e) => {
    e.preventDefault();
    if (!shelter) return;
    setIsUpdating(true);
    setActionNotice(null);
    setError(null);

    try {
      const res = await sheltersService.updateCapacity(
        shelter.id,
        {
          currentOccupancy: Number(currentOccupancy),
          maxCapacity: Number(maxCapacity),
          mealsNeededPerDay: Number(mealsNeeded)
        },
        { forceMock }
      );

      const urgRes = await sheltersService.updateUrgency(shelter.id, urgencyLevel, { forceMock });

      if (res.success && urgRes.success) {
        setActionNotice('Receiving capacity, resource availability, and urgency levels successfully updated on server.');
        setShelter((prev) => ({
          ...prev,
          capacity: {
            ...prev?.capacity,
            currentOccupancy: Number(currentOccupancy),
            maxCapacity: Number(maxCapacity),
            mealsNeededPerDay: Number(mealsNeeded)
          },
          urgencyLevel
        }));
      } else {
        const errorMsg = res.error || urgRes.error || 'Failed to update capacity on server';
        setError(errorMsg);
      }
    } catch (err) {
      setError(err.message || 'Capacity update error');
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

  // Confirm Received Deliveries
  const handleConfirmReceipt = async (assignmentId) => {
    setActionNotice(null);
    const res = await assignmentsService.transitionState(
      assignmentId,
      ASSIGNMENT_STATUS.DELIVERED,
      { reason: 'Confirmed intake by Shelter Supervisor', forceMock }
    );
    if (res.success) {
      setIncomingDeliveries((prev) => prev.filter((a) => a.id !== assignmentId));
      setActionNotice(`Shipment #${assignmentId} confirmed received into kitchen pantry.`);
    } else {
      setError(res.error || 'Failed to confirm intake on server');
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

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleConfirmReceipt(asg.id)}
                    icon={CheckCircle2}
                    className="self-start sm:self-center bg-emerald-600 hover:bg-emerald-500"
                  >
                    Confirm Delivery Receipt
                  </Button>
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
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-100">Available Surplus Aid Catalog</h3>
        <p className="text-xs text-slate-400">
          Directly claim available aid packages from regional commercial donors.
        </p>

        {availableAid.length === 0 ? (
          <EmptyState
            title="All available aid is currently reserved"
            description="Check back shortly as new commercial donations are registered."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableAid.slice(0, 3).map((item) => (
              <Card key={item.id} hover className="flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CategoryBadge category={item.category} size="sm" />
                    <span className="text-xs font-semibold text-emerald-400 font-mono">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {item.description || 'Verified commercial surplus aid.'}
                  </p>
                </div>
                <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate max-w-[140px]">
                    {item.pickupLocation?.contactName || 'Donor Facility'}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setActionNotice(`Aid package "${item.title}" reserved for ${shelter?.name || 'this shelter'}.`)
                    }
                  >
                    Request Aid
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
