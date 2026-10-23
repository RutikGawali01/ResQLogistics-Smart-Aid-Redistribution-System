import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '@aidflow/shared';
import {
  Activity,
  Shield,
  HeartHandshake,
  Bike,
  Building2,
  ArrowRight,
  Zap,
  CheckCircle2,
  Radio,
  Clock,
  Sparkles
} from 'lucide-react';

export function LandingPage() {
  const { user, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    switch (role) {
      case ROLES.ADMIN:
        return '/admin';
      case ROLES.DONOR:
        return '/donor';
      case ROLES.RIDER:
        return '/rider';
      case ROLES.SHELTER_MANAGER:
        return '/shelter';
      default:
        return '/admin';
    }
  };

  const handleAuthAction = () => {
    if (isAuthenticated) {
      navigate(getDashboardPath());
    } else {
      navigate('/login');
    }
  };

  const features = [
    {
      icon: HeartHandshake,
      title: 'Surplus Donors',
      description: 'Bakeries, grocers, and community kitchens list perishable aid with automated safety countdowns.',
      color: 'from-emerald-500/20 to-teal-500/10',
      badge: 'Zero Food Waste'
    },
    {
      icon: Building2,
      title: 'Relief Shelters',
      description: 'Real-time bed occupancy, meal demand publication, and intake verification dock coordination.',
      color: 'from-indigo-500/20 to-blue-500/10',
      badge: 'Capacity Balanced'
    },
    {
      icon: Bike,
      title: 'Rapid Fleet',
      description: 'Eco-couriers with volumetric payload matching, GPS tracking, and instant delivery verification.',
      color: 'from-amber-500/20 to-orange-500/10',
      badge: 'Optimized Routing'
    },
    {
      icon: Shield,
      title: 'Automated Dispatch',
      description: 'Concurrency-safe atomic reservation claims and background failure recovery algorithms.',
      color: 'from-purple-500/20 to-pink-500/10',
      badge: 'High Reliability'
    }
  ];

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-emerald-500/15 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Bar with Prominent Login Button */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Platform Name */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                AidFlow
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ResQLogistics
              </span>
            </div>
          </Link>

          {/* Top Navigation Links & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400 mr-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live MongoDB Cluster
              </span>
            </div>

            {isAuthenticated ? (
              <button
                onClick={handleAuthAction}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/register"
                  className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800"
                >
                  Register
                </Link>
                <Link
                  to="/login"
                  id="top-login-button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition-all shadow-lg shadow-emerald-950/40 hover:shadow-emerald-500/25"
                >
                  <span>Sign In / Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10 flex flex-col justify-center max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          {/* Tagline Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300 shadow-sm backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Autonomous Surplus Aid Redistribution Engine</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Bridging Food Surplus to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400">
              Emergency Relief
            </span>
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
            AidFlow synchronizes surplus donors, relief shelters, and rapid courier fleets with
            concurrency-safe dispatch algorithms, food-safety SLA timers, and zero Redis dependencies.
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={handleAuthAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/35 active:scale-[0.98]"
            >
              <span>{isAuthenticated ? 'Enter Mission Cockpit' : 'Launch Command Center'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/overview"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Public Live Overview</span>
            </Link>
          </div>

          {/* Key Metric Badges */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl mx-auto">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <p className="text-xl font-bold text-emerald-400 font-mono">100%</p>
              <p className="text-[11px] text-slate-400">Atomic Allocation</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <p className="text-xl font-bold text-sky-400 font-mono">0 sec</p>
              <p className="text-[11px] text-slate-400">Race-Free Locking</p>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <p className="text-xl font-bold text-purple-400 font-mono">24/7</p>
              <p className="text-[11px] text-slate-400">Worker Heartbeat</p>
            </div>
          </div>
        </div>

        {/* 4 Multi-Role Architecture Cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-sm hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center border border-slate-700/60 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Simple Clean Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 relative z-10 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">AidFlow ResQLogistics</span>
            <span>• Concurrency-Safe Smart Aid Platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link to="/login" className="hover:text-emerald-400 transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="hover:text-emerald-400 transition-colors">
              Register
            </Link>
            <Link to="/overview" className="hover:text-emerald-400 transition-colors">
              System Telemetry
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default LandingPage;
