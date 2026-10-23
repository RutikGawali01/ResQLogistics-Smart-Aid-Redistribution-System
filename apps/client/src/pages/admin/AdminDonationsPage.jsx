import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { donationsService } from '../../services/donationsService.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFilter } from '../../components/ui/Table.jsx';
import { CategoryBadge, Badge } from '../../components/ui/Badge.jsx';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import { Package, Calendar, MapPin, AlertCircle } from 'lucide-react';

export function AdminDonationsPage() {
  const { forceMock } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [donations, setDonations] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    async function fetchDonations() {
      setLoading(true);
      try {
        const res = await donationsService.getDonations({ forceMock });
        setDonations(res.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDonations();
  }, [forceMock]);

  if (loading) return <LoadingState message="Loading surplus aid pool..." />;
  if (error) return <ErrorState message={error} />;

  const filtered = donations.filter((d) => {
    const title = (d.title || d.aidType || 'Aid Package').toLowerCase();
    const address = (d.pickupLocation?.address || '').toLowerCase();
    const id = (d.id || d._id || '').toString().toLowerCase();
    const cat = d.category || d.aidType;
    const q = search.toLowerCase();

    const matchesSearch = title.includes(q) || address.includes(q) || id.includes(q);
    const matchesCategory = categoryFilter === 'ALL' || cat === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            Surplus Aid & Food Listings
          </h2>
          <p className="text-xs text-slate-400">
            All registered aid inventory across corporate donors, restaurants, and grocery partners.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <TableFilter
          value={search}
          onChange={setSearch}
          placeholder="Search by title, location, ID..."
          className="w-full sm:w-80"
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Categories</option>
            <option value="PRODUCE">Produce</option>
            <option value="BAKERY">Bakery</option>
            <option value="PREPARED_MEALS">Prepared Meals</option>
            <option value="DAIRY">Dairy</option>
            <option value="HYGIENE">Hygiene</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No donations found"
          description="Try adjusting your filter or search terms."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Donation</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Pickup Location</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id || d._id}>
                <TableCell>
                  <div className="font-medium text-slate-100">{d.title || d.aidType || 'Aid Package'}</div>
                  <div className="text-[11px] font-mono text-slate-500">{d.id || d._id}</div>
                </TableCell>
                <TableCell>
                  <CategoryBadge category={d.category || d.aidType} size="sm" />
                </TableCell>
                <TableCell className="font-semibold text-slate-200">
                  {d.quantity} <span className="text-xs text-slate-400 font-normal">{d.unit}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-400 font-mono">
                    {d.storageRequirement || d.handlingRequirements || 'ROOM_TEMPERATURE'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="truncate max-w-xs">{d.pickupLocation?.address || 'Pickup point'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {d.expirationDate || d.safeUseDeadline
                    ? new Date(d.expirationDate || d.safeUseDeadline).toLocaleDateString()
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge variant={d.status === 'AVAILABLE' ? 'emerald' : 'blue'} size="sm">
                    {d.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
