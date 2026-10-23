import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { RoleBadge } from '../ui/Badge.jsx';
import {
  Menu,
  Bell,
  Wifi,
  WifiOff,
  Database,
  Sparkles,
  ChevronDown,
  LogOut,
  User,
  ShieldAlert
} from 'lucide-react';

export function Header({ onOpenSidebar, socketStatus = 'offline', isLiveBackend = false }) {
  const { user, role, isMockAuth, forceMock, toggleForceMock, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Derive human-readable breadcrumb / page title from pathname
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/admin/donations')) return 'Surplus Aid Pool';
    if (path.startsWith('/admin/shelters')) return 'Shelters & Relief Hubs';
    if (path.startsWith('/admin/riders')) return 'Courier Fleet Telemetry';
    if (path.startsWith('/admin/assignments')) return 'Assignment State Pipeline';
    if (path.startsWith('/admin/contracts')) return 'Contracts & Schema Explorer';
    if (path.startsWith('/admin')) return 'Central Command Dashboard';

    if (path.startsWith('/donor/create')) return 'Register Surplus Aid';
    if (path.startsWith('/donor/donations')) return 'My Aid Listings';
    if (path.startsWith('/donor/history')) return 'Rescue Impact & History';
    if (path.startsWith('/donor')) return 'Donor Command Console';

    if (path.startsWith('/rider/active')) return 'Active Delivery Navigation';
    if (path.startsWith('/rider/history')) return 'Completed Courier Runs';
    if (path.startsWith('/rider')) return 'Courier Cockpit';

    if (path.startsWith('/shelter/incoming')) return 'Incoming Aid Deliveries';
    if (path.startsWith('/shelter/capacity')) return 'Shelter Bed & Meal Capacity';
    if (path.startsWith('/shelter/catalog')) return 'Request Surplus Aid';
    if (path.startsWith('/shelter')) return 'Relief Hub Management';

    return 'AidFlow Dashboard';
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-[#0B0F19]/90 border-b border-slate-800/80 backdrop-blur-md">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm sm:text-base font-semibold text-slate-100 tracking-tight">
            {getPageTitle()}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>AidFlow</span>
            <span>/</span>
            <span className="capitalize">{role?.toLowerCase() || 'Overview'}</span>
          </div>
        </div>
      </div>

      {/* Right Actions: Telemetry status, Role badge, Notifications, User menu */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Backend & Mock Status indicator pill */}
        <div className="flex items-center gap-2">
          {forceMock ? (
            <button
              onClick={toggleForceMock}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
              title="Click to toggle live API mode"
            >
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
              <span className="hidden md:inline">Mock Mode Active</span>
              <span className="md:hidden">Mock</span>
            </button>
          ) : isLiveBackend ? (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              title="Connected to live AidFlow backend"
            >
              <Database className="w-3 h-3" />
              <span className="hidden md:inline">Live API Online</span>
              <span className="md:hidden">Live</span>
            </div>
          ) : (
            <button
              onClick={toggleForceMock}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors"
              title="Backend decoupled. Click to toggle mock mode"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="hidden md:inline">Decoupled Adapter</span>
              <span className="md:hidden">Decoupled</span>
            </button>
          )}

          {/* Socket Dot */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-slate-900 border border-slate-800 text-slate-400"
            title={`WebSocket: ${socketStatus}`}
          >
            {socketStatus === 'connected' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="hidden lg:inline text-[10px]">Realtime</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span className="hidden lg:inline text-[10px]">Sync</span>
              </>
            )}
          </div>
        </div>

        {/* Current Role Badge */}
        <div className="hidden sm:block">
          <RoleBadge role={role} size="sm" />
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-3 space-y-2 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-200">System Notifications</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Live Stream
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 hover:bg-slate-800/70">
                  <p className="font-medium text-slate-200">New Surplus Donation Posted</p>
                  <p className="text-[11px] text-slate-400">45 loaves of artisan bread available at Market St.</p>
                  <span className="text-[10px] text-slate-500">2 min ago</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 hover:bg-slate-800/70">
                  <p className="font-medium text-slate-200">Shelter Request Escalated</p>
                  <p className="text-[11px] text-slate-400">Harbor Light Shelter marked CRITICAL urgency.</p>
                  <span className="text-[10px] text-slate-500">14 min ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu((prev) => !prev);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/70 text-slate-200 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {user?.name ? user.name[0] : 'U'}
            </div>
            <span className="hidden md:inline text-xs font-medium max-w-[120px] truncate">
              {user?.name || 'Account'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <p className="font-semibold text-slate-100 truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                {isMockAuth && (
                  <span className="inline-block mt-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Simulated Session
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/admin/contracts');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
              >
                <Database className="w-3.5 h-3.5" />
                Data Contracts & Schemas
              </button>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                  navigate('/login');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 mt-1 border-t border-slate-800/60 pt-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
