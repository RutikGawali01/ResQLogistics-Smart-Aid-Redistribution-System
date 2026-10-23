import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Building2, Store } from 'lucide-react';

// Custom clean SVG markers to bypass standard Leaflet PNG bundler asset path quirks
const createCustomIcon = (bgColor, iconHtml) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background: ${bgColor};
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        border: 2px solid #ffffff;
        color: white;
      ">
        ${iconHtml}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32]
  });
};

export function MapPreview({ donations = [], shelters = [], riders = [] }) {
  // Center coordinates: San Francisco demo centroid
  const center = [37.7749, -122.4194];

  const donorIcon = useMemo(
    () => createCustomIcon('#10b981', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>'),
    []
  );

  const shelterIcon = useMemo(
    () => createCustomIcon('#6366f1', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>'),
    []
  );

  const riderIcon = useMemo(
    () => createCustomIcon('#f59e0b', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>'),
    []
  );

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col h-[520px]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-2 border-b border-slate-800/80 mb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-400" />
            Live Geospatial Dispatch Grid
          </h2>
          <p className="text-xs text-slate-400">
            OpenStreetMap + Leaflet integration tracking active donors, shelters, and couriers
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Donors ({donations.length})
          </span>
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Shelters ({shelters.length})
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Couriers ({riders.length})
          </span>
        </div>
      </div>

      <div className="flex-1 w-full rounded-xl overflow-hidden relative shadow-inner">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Donation pickup markers */}
          {donations.map((d) => (
            <Marker
              key={d.id}
              position={[d.pickupLocation.latitude, d.pickupLocation.longitude]}
              icon={donorIcon}
            >
              <Popup>
                <div className="p-1">
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    Surplus Donation
                  </div>
                  <div className="font-semibold text-sm text-white">{d.title}</div>
                  <div className="text-xs text-slate-300 mt-1">
                    Qty: <span className="font-bold">{d.quantity} {d.unit}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{d.pickupLocation.address}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Shelter destination markers */}
          {shelters.map((s) => (
            <Marker
              key={s.id}
              position={[s.location.latitude, s.location.longitude]}
              icon={shelterIcon}
            >
              <Popup>
                <div className="p-1">
                  <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                    Relief Shelter
                  </div>
                  <div className="font-semibold text-sm text-white">{s.name}</div>
                  <div className="text-xs text-slate-300 mt-1">
                    Occupancy: <span className="font-bold">{s.capacity.currentOccupancy}/{s.capacity.maxCapacity}</span>
                  </div>
                  <div className="text-xs text-amber-400">Urgency: {s.urgencyLevel}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{s.address}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Courier rider markers */}
          {riders.map((r) => (
            <Marker
              key={r.id}
              position={[r.currentLocation.latitude, r.currentLocation.longitude]}
              icon={riderIcon}
            >
              <Popup>
                <div className="p-1">
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                    Courier Rider
                  </div>
                  <div className="font-semibold text-sm text-white">{r.name}</div>
                  <div className="text-xs text-slate-300 mt-1">
                    Vehicle: <span className="font-bold">{r.vehicleType}</span>
                  </div>
                  <div className="text-xs text-emerald-400">Status: {r.status}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
