import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import { ASSIGNMENT_STATUS } from '@aidflow/shared';
import {
  Navigation,
  MapPin,
  Building2,
  Bike,
  Package,
  Layers,
  Info,
  Clock,
  ShieldCheck,
  Radio,
  Eye,
  AlertTriangle,
  Compass,
  Maximize2
} from 'lucide-react';
import { calculateHaversineDistanceKm, isValidCoord } from '../../utils/geo.js';
export { calculateHaversineDistanceKm, isValidCoord };

/**
 * Custom SVG divIcon generator avoiding standard Leaflet asset path issues.
 */
const createMapIcon = ({ bgColor, borderColor = '#ffffff', pulse = false, iconSvg, label = '' }) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${pulse ? `<div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background: ${bgColor}; opacity: 0.35; animation: marker-pulse 2s infinite;"></div>` : ''}
        <div style="
          background: ${bgColor};
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          border: 2px solid ${borderColor};
          color: white;
          position: relative;
          z-index: 2;
        ">
          ${iconSvg}
        </div>
        ${label ? `<span style="position: absolute; bottom: -18px; font-size: 10px; font-weight: 700; color: #f3f4f6; text-shadow: 0 1px 3px rgba(0,0,0,0.9); white-space: nowrap;">${label}</span>` : ''}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20]
  });
};

/**
 * Waypoint icon for route origin (A) and destination (B)
 */
const createWaypointIcon = (letter, color) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background: ${color};
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        border: 2px solid #ffffff;
        color: white;
        font-size: 11px;
        font-weight: 800;
        font-family: monospace;
      ">
        ${letter}
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14]
  });
};

/**
 * Controller hook allowing programmatic camera movement to focused coordinates
 */
function MapCameraController({ focusCoords, autoFitBounds, activeEntities }) {
  const map = useMap();

  useEffect(() => {
    if (focusCoords && isValidCoord(focusCoords[0], focusCoords[1])) {
      map.flyTo(focusCoords, 15, { duration: 1.2 });
    }
  }, [focusCoords, map]);

  useEffect(() => {
    if (autoFitBounds && activeEntities && activeEntities.length > 0) {
      const validPoints = activeEntities
        .map((e) => e.coords)
        .filter((c) => c && isValidCoord(c[0], c[1]));

      if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [autoFitBounds, activeEntities, map]);

  return null;
}

export function LiveOperationsMap({
  donations = [],
  shelters = [],
  riders = [],
  assignments = [],
  focusedAssignmentId = null,
  onSelectAssignment,
  height = '560px',
  isMockData = false
}) {
  // Layer visibility toggles
  const [showDonors, setShowDonors] = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  const [showRiders, setShowRiders] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [filterUrgentOnly, setFilterUrgentOnly] = useState(false);
  const [focusCoords, setFocusCoords] = useState(null);

  // Default SF Centroid
  const defaultCenter = [37.7749, -122.4194];

  // Icons definition
  const icons = useMemo(() => {
    return {
      donor: createMapIcon({
        bgColor: '#10b981',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>'
      }),
      donorUrgent: createMapIcon({
        bgColor: '#ef4444',
        pulse: true,
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>'
      }),
      shelterOpen: createMapIcon({
        bgColor: '#6366f1',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/></svg>'
      }),
      shelterClosed: createMapIcon({
        bgColor: '#64748b',
        borderColor: '#ef4444',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="2" y1="2" x2="22" y2="22"/></svg>'
      }),
      shelterCritical: createMapIcon({
        bgColor: '#dc2626',
        pulse: true,
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M12 7v3"/><path d="M12 14h.01"/></svg>'
      }),
      riderAvailable: createMapIcon({
        bgColor: '#10b981',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>'
      }),
      riderInTransit: createMapIcon({
        bgColor: '#f59e0b',
        pulse: true,
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>'
      }),
      riderOffline: createMapIcon({
        bgColor: '#475569',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>'
      }),
      originWaypoint: createWaypointIcon('A', '#10b981'),
      destWaypoint: createWaypointIcon('B', '#6366f1')
    };
  }, []);

  // Filter valid donation markers
  const validDonations = useMemo(() => {
    return donations
      .map((d) => {
        const lat = d.pickupLocation?.latitude ?? d.pickupLocation?.lat;
        const lng = d.pickupLocation?.longitude ?? d.pickupLocation?.lng;
        const deadlineStr = d.safeUseDeadline || d.expirationDate;
        let isUrgent = false;
        if (deadlineStr) {
          const hours = (new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60);
          isUrgent = hours <= 24 && hours > 0;
        }
        return {
          ...d,
          lat,
          lng,
          isValid: isValidCoord(lat, lng),
          isUrgent
        };
      })
      .filter((d) => d.isValid && (!filterUrgentOnly || d.isUrgent));
  }, [donations, filterUrgentOnly]);

  // Filter valid shelter markers
  const validShelters = useMemo(() => {
    return shelters
      .map((s) => {
        const lat = s.location?.latitude ?? s.location?.lat;
        const lng = s.location?.longitude ?? s.location?.lng;
        const isClosed = s.isOpen === false || s.active === false;
        const isCritical =
          s.urgencyLevel === 'CRITICAL' ||
          (s.capacity && s.capacity.currentOccupancy >= s.capacity.maxCapacity);

        return {
          ...s,
          lat,
          lng,
          isValid: isValidCoord(lat, lng),
          isClosed,
          isCritical
        };
      })
      .filter((s) => s.isValid && (!filterUrgentOnly || s.isCritical || s.isClosed));
  }, [shelters, filterUrgentOnly]);

  // Filter valid rider markers
  const validRiders = useMemo(() => {
    return riders
      .map((r) => {
        const lat = r.currentLocation?.latitude ?? r.currentLocation?.lat;
        const lng = r.currentLocation?.longitude ?? r.currentLocation?.lng;
        const inTransit =
          r.status === 'ON_DISPATCH' ||
          r.status === 'IN_TRANSIT' ||
          Boolean(r.activeAssignmentId);
        const isOffline = r.status === 'OFFLINE' || r.isAvailable === false;

        return {
          ...r,
          lat,
          lng,
          isValid: isValidCoord(lat, lng),
          inTransit,
          isOffline
        };
      })
      .filter((r) => r.isValid);
  }, [riders]);

  // Filter valid assignment routes with coordinates (Task 2)
  const validRoutes = useMemo(() => {
    return assignments
      .map((asg) => {
        // Pickup location coords (either on asg directly or via referenced donation)
        const pLat = asg.pickupLocation?.latitude ?? asg.pickupLocation?.lat;
        const pLng = asg.pickupLocation?.longitude ?? asg.pickupLocation?.lng;

        // Delivery location coords (either on asg directly or via referenced shelter)
        const dLat = asg.deliveryLocation?.latitude ?? asg.deliveryLocation?.lat;
        const dLng = asg.deliveryLocation?.longitude ?? asg.deliveryLocation?.lng;

        const hasValidEndpoints = isValidCoord(pLat, pLng) && isValidCoord(dLat, dLng);
        if (!hasValidEndpoints) return null;

        // Haversine distance in km
        const distanceKm = calculateHaversineDistanceKm(pLat, pLng, dLat, dLng);

        // Find assigned rider location if in progress
        const asgRdrId = typeof asg.riderId === 'object' && asg.riderId !== null
          ? (asg.riderId.id || asg.riderId._id)
          : asg.riderId;
        const assignedRider = validRiders.find(
          (r) => r.id === asgRdrId || r.userId === asgRdrId
        );
        const riderCoord =
          assignedRider && isValidCoord(assignedRider.lat, assignedRider.lng)
            ? [assignedRider.lat, assignedRider.lng]
            : null;

        // Route status color
        let routeColor = '#f59e0b'; // amber default
        let isDashed = false;

        if (
          asg.status === ASSIGNMENT_STATUS.UNASSIGNED ||
          asg.status === ASSIGNMENT_STATUS.OFFERED
        ) {
          routeColor = '#eab308';
          isDashed = true;
        } else if (
          asg.status === ASSIGNMENT_STATUS.ACCEPTED ||
          asg.status === ASSIGNMENT_STATUS.EN_ROUTE_PICKUP
        ) {
          routeColor = '#f59e0b';
          isDashed = false;
        } else if (
          asg.status === ASSIGNMENT_STATUS.PICKED_UP ||
          asg.status === ASSIGNMENT_STATUS.EN_ROUTE_DROPOFF ||
          asg.status === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS
        ) {
          routeColor = '#8b5cf6'; // Indigo/violet in transit
          isDashed = false;
        } else if (asg.status === ASSIGNMENT_STATUS.DELIVERED) {
          routeColor = '#10b981'; // Emerald complete
          isDashed = false;
        }

        const isFocused = focusedAssignmentId === asg.id;

        return {
          asg,
          pickupCoords: [pLat, pLng],
          deliveryCoords: [dLat, dLng],
          riderCoords: riderCoord,
          distanceKm,
          routeColor,
          isDashed,
          isFocused
        };
      })
      .filter(Boolean);
  }, [assignments, validRiders, focusedAssignmentId]);

  // Center camera when focusedAssignmentId changes
  useEffect(() => {
    if (focusedAssignmentId) {
      const match = validRoutes.find((r) => r.asg.id === focusedAssignmentId);
      if (match) {
        setFocusCoords(match.pickupCoords);
      }
    }
  }, [focusedAssignmentId, validRoutes]);

  // All active valid map entities for bounds calculation
  const allActiveEntities = useMemo(() => {
    const list = [];
    if (showDonors) validDonations.forEach((d) => list.push({ coords: [d.lat, d.lng] }));
    if (showShelters) validShelters.forEach((s) => list.push({ coords: [s.lat, s.lng] }));
    if (showRiders) validRiders.forEach((r) => list.push({ coords: [r.lat, r.lng] }));
    return list;
  }, [showDonors, showShelters, showRiders, validDonations, validShelters, validRiders]);

  // Empty state check (Task 8)
  const isCompletelyEmpty =
    validDonations.length === 0 &&
    validShelters.length === 0 &&
    validRiders.length === 0 &&
    validRoutes.length === 0;

  return (
    <div
      className="glass-panel rounded-2xl border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden"
      style={{ height }}
    >
      {/* Top Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-950/70 gap-2 z-20">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            Live Geospatial Grid
          </h2>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Leaflet / OpenStreetMap
          </span>
        </div>

        {/* Telemetry Provenance Notice (Task 9: Never display fabricated GPS as real) */}
        <div className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80">
          <ShieldCheck className="w-3 h-3 text-indigo-400 flex-shrink-0" />
          <span className="text-slate-400">Telemetry:</span>
          <span className="font-semibold text-indigo-300">
            {isMockData ? 'Demo Seeded Centroids (Simulation)' : 'Verified Geospatial Registry'}
          </span>
        </div>

        {/* Layer Visibility Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowDonors((prev) => !prev)}
            title="Toggle Donors"
            className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-all ${
              showDonors
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Donors ({validDonations.length})
          </button>

          <button
            onClick={() => setShowShelters((prev) => !prev)}
            title="Toggle Shelters"
            className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-all ${
              showShelters
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Shelters ({validShelters.length})
          </button>

          <button
            onClick={() => setShowRiders((prev) => !prev)}
            title="Toggle Couriers"
            className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-all ${
              showRiders
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Couriers ({validRiders.length})
          </button>

          <button
            onClick={() => setShowRoutes((prev) => !prev)}
            title="Toggle Routes"
            className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-all ${
              showRoutes
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            <Navigation className="w-2.5 h-2.5 text-purple-400" />
            Routes ({validRoutes.length})
          </button>

          <button
            onClick={() => setFilterUrgentOnly((prev) => !prev)}
            title="Filter Urgent / High Risk Only"
            className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-all ${
              filterUrgentOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
            Urgent Only
          </button>
        </div>
      </div>

      {/* Map Body Canvas */}
      <div className="flex-1 w-full relative">
        {isCompletelyEmpty ? (
          /* Empty State Handling (Task 8) */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center p-6 z-10">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
              <MapPin className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No Geospatial Coordinates Available</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Active donations, shelters, or courier fleets currently lack latitude/longitude metadata or
              the "Urgent Only" filter returned no matches.
            </p>
            {filterUrgentOnly && (
              <button
                onClick={() => setFilterUrgentOnly(false)}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Clear Urgent Filter
              </button>
            )}
          </div>
        ) : null}

        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapCameraController
            focusCoords={focusCoords}
            autoFitBounds={!focusedAssignmentId}
            activeEntities={allActiveEntities}
          />

          {/* 1. Assignment Routes & Destination Polylines (Task 2) */}
          {showRoutes &&
            validRoutes.map((r) => {
              const { asg, pickupCoords, deliveryCoords, riderCoords, distanceKm, routeColor, isDashed, isFocused } = r;

              return (
                <React.Fragment key={`route_${asg.id}`}>
                  {/* Direct Pickup -> Destination Polyline */}
                  <Polyline
                    positions={[pickupCoords, deliveryCoords]}
                    pathOptions={{
                      color: routeColor,
                      weight: isFocused ? 5 : 3.5,
                      dashArray: isDashed ? '8, 8' : undefined,
                      opacity: isFocused ? 0.95 : 0.75
                    }}
                  >
                    <Tooltip sticky>
                      <div className="text-xs font-semibold">
                        Mission: {asg.donationTitle || asg.id} ({distanceKm} km)
                      </div>
                      <div className="text-[10px] text-slate-400">Status: {asg.status}</div>
                    </Tooltip>
                  </Polyline>

                  {/* Courier In-Transit Trajectory Leg (if rider assigned) */}
                  {riderCoords && (
                    <Polyline
                      positions={[riderCoords, asg.status.includes('DROPOFF') ? deliveryCoords : pickupCoords]}
                      pathOptions={{
                        color: '#f59e0b',
                        weight: 2.5,
                        dashArray: '4, 6',
                        opacity: 0.8
                      }}
                    />
                  )}

                  {/* Waypoint A (Pickup) */}
                  <Marker position={pickupCoords} icon={icons.originWaypoint}>
                    <Popup>
                      <div className="p-1 text-xs">
                        <div className="font-bold text-emerald-400">Waypoint [A]: Pickup Depot</div>
                        <div className="text-white mt-0.5">{asg.pickupLocation?.address}</div>
                        <div className="text-slate-400 mt-1">Allocated: {asg.allocatedQuantity} units</div>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Waypoint B (Delivery) */}
                  <Marker position={deliveryCoords} icon={icons.destWaypoint}>
                    <Popup>
                      <div className="p-1 text-xs">
                        <div className="font-bold text-indigo-400">Waypoint [B]: Shelter Destination</div>
                        <div className="text-white mt-0.5">{asg.deliveryLocation?.address}</div>
                        <div className="text-slate-400 mt-1">
                          Shelter: {asg.shelterName || (typeof asg.shelterId === 'object' ? asg.shelterId?.name : asg.shelterId) || 'Shelter Intake'}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

          {/* 2. Donation Pickup Locations (Task 1) */}
          {showDonors &&
            validDonations.map((d) => (
              <Marker
                key={`don_${d.id}`}
                position={[d.lat, d.lng]}
                icon={d.isUrgent ? icons.donorUrgent : icons.donor}
              >
                <Popup>
                  <div className="p-1.5 min-w-[210px]">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-700/80">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        Surplus Aid Pickup
                      </span>
                      {d.isUrgent && (
                        <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20">
                          Expiring Soon
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-sm text-white">{d.title}</div>
                    <div className="text-xs text-slate-300 mt-1 flex items-center justify-between">
                      <span>Available Quantity:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {d.availableQuantity ?? d.quantity} {d.unit}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 mt-0.5 flex items-center justify-between">
                      <span>Category:</span>
                      <span className="text-slate-200">{d.category}</span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                      <span>{d.pickupLocation?.address}</span>
                    </div>

                    {(d.safeUseDeadline || d.expirationDate) && (
                      <div className="text-[10px] text-amber-400/90 mt-1 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Safe use deadline: {new Date(d.safeUseDeadline || d.expirationDate).toLocaleDateString()}
                      </div>
                    )}

                    <div className="mt-2 pt-1 border-t border-slate-800 text-[9px] text-slate-500 font-mono">
                      Source: {isMockData ? 'Demo Seed Location' : 'Verified Partner Depot'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* 3. Shelter Locations (Task 1) */}
          {showShelters &&
            validShelters.map((s) => {
              let shelterIcon = icons.shelterOpen;
              if (s.isClosed) shelterIcon = icons.shelterClosed;
              else if (s.isCritical) shelterIcon = icons.shelterCritical;

              return (
                <Marker key={`shl_${s.id}`} position={[s.lat, s.lng]} icon={shelterIcon}>
                  <Popup>
                    <div className="p-1.5 min-w-[220px]">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-700/80">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                          Relief Shelter Hub
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1 py-0.5 rounded border ${
                            s.isClosed
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {s.isClosed ? 'Intake Closed' : 'Open 24/7'}
                        </span>
                      </div>

                      <div className="font-semibold text-sm text-white">{s.name}</div>

                      {s.capacity && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>Bed Occupancy:</span>
                            <span className="font-bold text-white font-mono">
                              {s.capacity.currentOccupancy}/{s.capacity.maxCapacity}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.capacity.currentOccupancy >= s.capacity.maxCapacity
                                  ? 'bg-rose-500'
                                  : 'bg-indigo-500'
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    (s.capacity.currentOccupancy / (s.capacity.maxCapacity || 1)) * 100
                                  )
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {s.capacity?.mealsNeededPerDay && (
                        <div className="text-xs text-amber-400 mt-1 flex justify-between">
                          <span>Meals Needed Daily:</span>
                          <span className="font-bold font-mono">{s.capacity.mealsNeededPerDay}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                        <span>{s.address}</span>
                      </div>

                      <div className="mt-2 pt-1 border-t border-slate-800 text-[9px] text-slate-500 font-mono">
                        Source: {isMockData ? 'Demo Seed Location' : 'Official Relief Registry'}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* 4. Couriers & Rider Locations (Task 1) */}
          {showRiders &&
            validRiders.map((r) => {
              let riderIcon = icons.riderAvailable;
              if (r.isOffline) riderIcon = icons.riderOffline;
              else if (r.inTransit) riderIcon = icons.riderInTransit;

              return (
                <Marker key={`rdr_${r.id}`} position={[r.lat, r.lng]} icon={riderIcon}>
                  <Popup>
                    <div className="p-1.5 min-w-[210px]">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-700/80">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                          Courier Unit
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1 py-0.5 rounded border ${
                            r.inTransit
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : r.isOffline
                              ? 'bg-slate-700/50 text-slate-400 border-slate-600'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {r.status || 'AVAILABLE'}
                        </span>
                      </div>

                      <div className="font-semibold text-sm text-white">{r.name}</div>

                      <div className="text-xs text-slate-300 mt-1 flex justify-between">
                        <span>Vehicle Class:</span>
                        <span className="font-medium text-slate-200 uppercase font-mono">
                          {r.vehicleType || 'E_BIKE'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 mt-0.5 flex justify-between">
                        <span>Cargo Capacity:</span>
                        <span className="font-mono text-emerald-400">
                          {r.maxCapacityKg ? `${r.maxCapacityKg} kg` : 'Standard'}
                        </span>
                      </div>

                      {/* Explicit Telemetry Source distinction (Task 9) */}
                      <div className="mt-2 pt-1 border-t border-slate-800 space-y-0.5 text-[9px] text-slate-400">
                        <div className="flex items-center justify-between font-mono">
                          <span>Telematics:</span>
                          <span className="text-indigo-300">
                            {r.telemetrySource === 'LIVE_DEVICE_GPS'
                              ? 'Live Device GPS Fix'
                              : 'Demo Seeded Centroid'}
                          </span>
                        </div>
                        {r.currentLocation?.updatedAt && (
                          <div className="text-slate-500 text-[8px]">
                            Updated: {new Date(r.currentLocation.updatedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>
      </div>

      {/* Bottom Map Legend Bar */}
      <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Donation Pickup [A]
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            Shelter Intake [B]
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Courier (Transit / Available)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-purple-500" />
            Active Delivery Leg
          </span>
        </div>

        <div className="text-[10px] text-slate-500 font-mono">
          Interactive Zoom &bull; Click marker for details &bull; Polyline connects pickup to hub
        </div>
      </div>
    </div>
  );
}
