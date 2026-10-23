import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { donationsService } from '../../services/donationsService.js';
import { MetricCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';
import { CategoryBadge, Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/FormElements.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
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
  Clock
} from 'lucide-react';

export function DonorDashboard() {
  const { user, forceMock } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [donations, setDonations] = useState([]);

  useEffect(() => {
    async function fetchDonations() {
      setLoading(true);
      try {
        const res = await donationsService.getDonations({ forceMock });
        // Filter to donor's donations or all mock donations
        setDonations(res.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDonations();
  }, [forceMock]);

  if (loading) return <LoadingState message="Loading your donor impact dashboard..." />;
  if (error) return <ErrorState message={error} />;

  const activeDonations = donations.filter((d) => d.status !== 'DELIVERED');
  const deliveredDonations = donations.filter((d) => d.status === 'DELIVERED');
  const totalKg = donations.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

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
            {user?.organization || 'Fresh Market Grocers'} • Thank you for keeping high-quality surplus food out of landfills and fueling community relief.
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

      {/* Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Surplus Donated"
          value={`${totalKg} items/kg`}
          subtext="Lifetime contributions"
          color="emerald"
          icon={Package}
        />
        <MetricCard
          title="Active Listings"
          value={activeDonations.length.toString()}
          subtext="Ready or in-transit"
          color="blue"
          icon={Clock}
        />
        <MetricCard
          title="CO2 Offset"
          value={`${Math.round(totalKg * 1.8)} kg`}
          subtext="Landfill emissions saved"
          trend="+18%"
          color="emerald"
          icon={Leaf}
        />
        <MetricCard
          title="Shelters Reached"
          value="6 Hubs"
          subtext="Direct community impact"
          color="purple"
          icon={HeartHandshake}
        />
      </section>

      {/* Active Listings Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">My Surplus Food & Aid Listings</h3>
            <p className="text-xs text-slate-400">
              Manage your active donations and review logistics dispatch status
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
                <TableHead>Storage Temp</TableHead>
                <TableHead>Pickup Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-semibold text-slate-100">{d.title}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-sm">
                      {d.description || 'Verified surplus food package.'}
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
                      <span className="truncate max-w-xs">{d.pickupLocation?.address}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        d.status === 'AVAILABLE'
                          ? 'emerald'
                          : d.status === 'IN_TRANSIT'
                          ? 'blue'
                          : 'purple'
                      }
                      size="sm"
                    >
                      {d.status}
                    </Badge>
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
