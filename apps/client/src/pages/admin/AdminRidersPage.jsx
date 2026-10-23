import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ridersService } from '../../services/ridersService.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFilter } from '../../components/ui/Table.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { Bike, Navigation, Star, CheckCircle2 } from 'lucide-react';

export function AdminRidersPage() {
  const { forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [riders, setRiders] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchRiders() {
      setLoading(true);
      try {
        const res = await ridersService.getRiders({ forceMock });
        setRiders(res.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRiders();
  }, [forceMock]);

  if (loading) return <LoadingState message="Loading courier fleet..." />;
  if (error) return <ErrorState message={error} />;

  const filtered = riders.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.vehicleType.toLowerCase().includes(search.toLowerCase()) ||
      r.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bike className="w-5 h-5 text-emerald-400" />
            Volunteer & Courier Fleet
          </h2>
          <p className="text-xs text-slate-400">
            Active couriers, live telemetry coordinates, capacity limits, and dispatch statuses.
          </p>
        </div>
      </div>

      <TableFilter
        value={search}
        onChange={setSearch}
        placeholder="Search courier by name, vehicle..."
        className="w-full sm:w-80"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="No couriers found"
          description="No active couriers match your search terms."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Courier Name</TableHead>
              <TableHead>Vehicle Type</TableHead>
              <TableHead>Max Capacity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating / Deliveries</TableHead>
              <TableHead>Live GPS Telemetry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-semibold text-slate-100">{r.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{r.phone}</div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    {r.vehicleType}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-slate-300 font-medium">
                  {r.maxCapacityKg} kg
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === 'AVAILABLE'
                        ? 'emerald'
                        : r.status === 'ON_DISPATCH'
                        ? 'blue'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {r.rating || 4.9}
                    </span>
                    <span className="text-slate-400">
                      {r.completedDeliveries || 40}+ runs
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {r.currentLocation ? (
                    <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Navigation className="w-3 h-3 text-emerald-400" />
                      <span>
                        {r.currentLocation.latitude?.toFixed(4)}, {r.currentLocation.longitude?.toFixed(4)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Offline</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
