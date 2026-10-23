import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { sheltersService } from '../../services/sheltersService.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFilter } from '../../components/ui/Table.jsx';
import { UrgencyBadge, CategoryBadge } from '../../components/ui/Badge.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { Building2, Phone, Users, Utensils } from 'lucide-react';

export function AdminSheltersPage() {
  const { forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchShelters() {
      setLoading(true);
      try {
        const res = await sheltersService.getShelters({ forceMock });
        setShelters(res.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchShelters();
  }, [forceMock]);

  if (loading) return <LoadingState message="Loading shelter registry..." />;
  if (error) return <ErrorState message={error} />;

  const filtered = shelters.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Relief Shelters & Community Hubs
          </h2>
          <p className="text-xs text-slate-400">
            Registered intake locations, real-time bed occupancy, meal demand, and urgency levels.
          </p>
        </div>
      </div>

      <TableFilter
        value={search}
        onChange={setSearch}
        placeholder="Search shelters by name, address..."
        className="w-full sm:w-80"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No shelters found"
          description="No shelters matched your search criteria."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Shelter Facility</TableHead>
              <TableHead>Occupancy / Capacity</TableHead>
              <TableHead>Meals Needed</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Accepted Categories</TableHead>
              <TableHead>Contact Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const current = s.capacity?.currentOccupancy || 0;
              const max = s.capacity?.maxCapacity || 100;
              const pct = Math.min(Math.round((current / max) * 100), 100);

              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-semibold text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-400">{s.address}</div>
                  </TableCell>
                  <TableCell>
                    <div className="w-36 space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>{current} / {max} beds</span>
                        <span className="font-medium text-slate-400">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 90
                              ? 'bg-rose-500'
                              : pct >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                      <Utensils className="w-3.5 h-3.5 text-amber-400" />
                      <span>{s.capacity?.mealsNeededPerDay || 0} / day</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <UrgencyBadge urgency={s.urgencyLevel} size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {s.acceptedCategories?.slice(0, 3).map((cat) => (
                        <CategoryBadge key={cat} category={cat} size="sm" />
                      ))}
                      {s.acceptedCategories?.length > 3 && (
                        <span className="text-[10px] text-slate-500 self-center">
                          +{s.acceptedCategories.length - 3} more
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">
                    {s.contactPhone}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
