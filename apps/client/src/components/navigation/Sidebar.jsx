import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, ROLE_DEFINITIONS } from '@aidflow/shared';
import {
  LayoutDashboard,
  Package,
  Building2,
  Bike,
  GitBranch,
  FileCode2,
  PlusCircle,
  History,
  Navigation,
  Inbox,
  Activity,
  Sliders,
  Shield,
  HeartHandshake,
  LogOut,
  X,
  Layers,
  Sparkles
} from 'lucide-react';

export function Sidebar({ isOpen = false, onClose }) {
  const { user, role, switchRole, forceMock, toggleForceMock, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    switchRole(newRole);
    // Navigate to default page for that role
    if (newRole === ROLES.ADMIN) navigate('/admin');
    else if (newRole === ROLES.DONOR) navigate('/donor');
    else if (newRole === ROLES.RIDER) navigate('/rider');
    else if (newRole === ROLES.SHELTER_MANAGER) navigate('/shelter');
    if (onClose) onClose();
  };

  const getNavLinks = () => {
    switch (role) {
      case ROLES.ADMIN:
        return [
          { to: '/admin', label: 'Command Dashboard', icon: LayoutDashboard, end: true },
          { to: '/admin/donations', label: 'Surplus Aid Pool', icon: Package },
          { to: '/admin/shelters', label: 'Shelters & Relief Hubs', icon: Building2 },
          { to: '/admin/riders', label: 'Courier Fleet', icon: Bike },
          { to: '/admin/assignments', label: 'Assignment Pipeline', icon: GitBranch },
          { to: '/admin/contracts', label: 'Contracts Explorer', icon: FileCode2 }
        ];

      case ROLES.DONOR:
        return [
          { to: '/donor', label: 'Donor Command', icon: LayoutDashboard, end: true },
          { to: '/donor/create', label: 'Register New Aid', icon: PlusCircle },
          { to: '/donor/donations', label: 'My Aid Listings', icon: Package },
          { to: '/donor/history', label: 'Impact & Deliveries', icon: History }
        ];

      case ROLES.RIDER:
        return [
          { to: '/rider', label: 'Courier Cockpit', icon: LayoutDashboard, end: true },
          { to: '/rider/active', label: 'Active Delivery Route', icon: Navigation },
          { to: '/rider/history', label: 'Completed Runs', icon: History }
        ];

      case ROLES.SHELTER_MANAGER:
        return [
          { to: '/shelter', label: 'Shelter Hub Overview', icon: LayoutDashboard, end: true },
          { to: '/shelter/incoming', label: 'Incoming Deliveries', icon: Inbox },
          { to: '/shelter/capacity', label: 'Bed & Meal Capacity', icon: Sliders },
          { to: '/shelter/catalog', label: 'Request Aid Catalog', icon: Package }
        ];

      default:
        return [{ to: '/', label: 'Overview', icon: LayoutDashboard, end: true }];
    }
  };

  const links = getNavLinks();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 flex flex-col bg-[#0B0F19] border-r border-slate-800/80 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-950/50">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">AidFlow</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Smart Aid Redistribution</p>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Quick Switcher Pill */}
        <div className="p-3.5 mx-3 mt-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              Active Role Switcher
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {role}
            </span>
          </div>
          <select
            value={role || ROLES.ADMIN}
            onChange={handleRoleChange}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value={ROLES.ADMIN}>Admin (Platform Control)</option>
            <option value={ROLES.DONOR}>Donor (Surplus Provider)</option>
            <option value={ROLES.RIDER}>Rider (Courier / Transit)</option>
            <option value={ROLES.SHELTER_MANAGER}>Shelter Manager (Hub Intake)</option>
          </select>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Navigation Menu
          </div>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{link.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Settings & Status Panel */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-3">
          {/* Mock Mode Decoupled Toggle */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <p className="text-[11px] font-medium text-slate-300">Mock Data Mode</p>
                <p className="text-[9px] text-slate-500">Decoupled from backend</p>
              </div>
            </div>
            <button
              onClick={toggleForceMock}
              type="button"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                forceMock ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  forceMock ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* User profile row */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {user?.name ? user.name[0] : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{user?.name || 'Guest'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.organization || user?.email}</p>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
