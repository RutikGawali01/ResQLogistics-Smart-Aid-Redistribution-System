import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { sheltersService } from '../../services/sheltersService.js';
import { assignmentsService } from '../../services/assignmentsService.js';
import { donationsService } from '../../services/donationsService.js';
import { MetricCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx';
import { StatusBadge, UrgencyBadge, CategoryBadge } from '../../components/ui/Badge.jsx';
import { Button, Input, Select, FormField } from '../../components/ui/FormElements.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { ASSIGNMENT_STATUS } from '@aidflow/shared';
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
  Truck
} from 'lucide-react';

export function ShelterDashboard() {
  const { user, forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [shelter, setShelter] = useState(null);
  const [incomingDeliveries, setIncomingDeliveries] = useState([]);
  const [availableAid, setAvailableAid] = useState([]);
  const [actionNotice, setActionNotice] = useState(null);

  // Form states for capacity and urgency
  const [currentOccupancy, setCurrentOccupancy] = useState(88);
  const [maxCapacity, setMaxCapacity] = useState(100);
  const [mealsNeeded, setMealsNeeded] = useState(150);
  const [urgencyLevel, setUrgencyLevel] = useState('HIGH');
  const [isUpdating, setIsUpdating] = useState(false);

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
        setCurrentOccupancy(myShelter.capacity?.currentOccupancy || 88);
        setMaxCapacity(myShelter.capacity?.maxCapacity || 100);
        setMealsNeeded(myShelter.capacity?.mealsNeededPerDay || 150);
        setUrgencyLevel(myShelter.urgencyLevel || 'HIGH');
      }

      setIncomingDeliveries(
        asgRes.data?.filter((a) => a.status !== ASSIGNMENT_STATUS.DELIVERED) || []
      );
      setAvailableAid(donRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [forceMock]);

  const handleUpdateCapacity = async (e) => {
    e.preventDefault();
    if (!shelter) return;
    setIsUpdating(true);
    setActionNotice(null);
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
        setActionNotice('Shelter occupancy and demand levels updated successfully.');
        setShelter((prev) => ({
          ...prev,
          capacity: {
            ...prev.capacity,
            currentOccupancy: Number(currentOccupancy),
            maxCapacity: Number(maxCapacity),
            mealsNeededPerDay: Number(mealsNeeded)
          },
          urgencyLevel
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

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
    }
  };

  if (loading) return <LoadingState message="Loading shelter intake console..." />;
  if (error && !shelter) return <ErrorState message={error} onRetry={loadData} />;

  const occupancyRate = Math.round((currentOccupancy / (maxCapacity || 100)) * 100);

  return (
    <div className="space-y-6">
      {/* Top Shelter Profile Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="w-3.5 h-3.5" />
              Shelter Operations Hub
            </span>
            <UrgencyBadge urgency={urgencyLevel} size="sm" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {shelter?.name || 'Downtown Hope Refuge'}
          </h2>
          <p className="text-xs text-slate-300">
            {shelter?.address || '100 Mission St, San Francisco, CA'} • Manager: {user?.name || 'Elena Rostova'}
          </p>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Capacity & Meals Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Current Occupancy"
          value={`${currentOccupancy} / ${maxCapacity}`}
          subtext={`${occupancyRate}% bed occupancy`}
          trend={`${occupancyRate}%`}
          color={occupancyRate >= 85 ? 'rose' : 'amber'}
          icon={Users}
        />
        <MetricCard
          title="Meals Needed / Day"
          value={`${mealsNeeded} meals`}
          subtext="Breakfast, lunch & dinner"
          color="blue"
          icon={Utensils}
        />
        <MetricCard
          title="Inbound Shipments"
          value={incomingDeliveries.length.toString()}
          subtext="En route or pending"
          color="purple"
          icon={Truck}
        />
        <MetricCard
          title="Urgency Escalation"
          value={urgencyLevel}
          subtext="Redistribution priority"
          color={urgencyLevel === 'CRITICAL' ? 'rose' : 'amber'}
          icon={AlertTriangle}
        />
      </section>

      {/* Main Shelter Controls: Capacity Modifier + Incoming Shipments */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Capacity & Urgency Adjuster */}
        <div className="glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              Adjust Capacity & Urgency
            </h3>
            <p className="text-xs text-slate-400">
              Update capacity metrics to alert the AidFlow automated dispatch engine.
            </p>
          </div>

          <form onSubmit={handleUpdateCapacity} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Current Beds Occupied">
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

            <FormField label="Redistribution Urgency Level">
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

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isUpdating}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white"
            >
              Save Capacity & Alert Dispatch
            </Button>
          </form>
        </div>

        {/* Right: Incoming Shipments with Confirm Intake action */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-400" />
                Inbound Aid Deliveries
              </h3>
              <p className="text-xs text-slate-400">
                Track incoming shipments and confirm receipt upon arrival.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              {incomingDeliveries.length} active
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
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                    className="self-start sm:self-center"
                  >
                    Confirm Receipt
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Available Surplus Aid Marketplace Preview */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-100">Available Surplus Aid Catalog</h3>
        <p className="text-xs text-slate-400">
          Directly claim available aid packages from regional donors before standard automated dispatch.
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
                    {item.pickupLocation?.contactName || 'Donor'}
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
