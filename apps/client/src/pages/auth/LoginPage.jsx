import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, ROLE_DEFINITIONS } from '@aidflow/shared';
import { Button, Input, FormField, Checkbox } from '../../components/ui/FormElements.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Activity, Shield, HeartHandshake, Bike, Building2, Sparkles, Server } from 'lucide-react';

export function LoginPage() {
  const { login, loading, authError, setAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('admin@aidflow.org');
  const [password, setPassword] = useState('AidFlowAdmin!2026');
  const [selectedRole, setSelectedRole] = useState(ROLES.ADMIN);
  const [isMockMode, setIsMockMode] = useState(true);

  const demoAccounts = [
    { role: ROLES.ADMIN, email: 'admin@aidflow.org', label: 'Admin', icon: Shield },
    { role: ROLES.DONOR, email: 'sarah@freshmarket.com', label: 'Donor', icon: HeartHandshake },
    { role: ROLES.RIDER, email: 'carlos.rider@aidflow.org', label: 'Courier', icon: Bike },
    { role: ROLES.SHELTER_MANAGER, email: 'elena@downtownhope.org', label: 'Shelter Hub', icon: Building2 }
  ];

  const handleQuickFill = (acc) => {
    setEmail(acc.email);
    setPassword('Pass123!Secure');
    setSelectedRole(acc.role);
    setAuthError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);

    const result = await login({
      email,
      password,
      role: selectedRole,
      forceMock: isMockMode
    });

    if (result.success) {
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        // Navigate to default dashboard by role
        const roleRoutes = {
          [ROLES.ADMIN]: '/admin',
          [ROLES.DONOR]: '/donor',
          [ROLES.RIDER]: '/rider',
          [ROLES.SHELTER_MANAGER]: '/shelter'
        };
        navigate(roleRoutes[result.user.role] || '/admin', { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-700 shadow-xl shadow-emerald-950/60 mb-2">
            <Activity className="w-6 h-6 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign in to AidFlow</h1>
          <p className="text-xs text-slate-400">
            Smart Aid Redistribution & Logistics Platform
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <Alert variant="error" onClose={() => setAuthError(null)}>
            {authError}
          </Alert>
        )}

        {/* Login Form Container */}
        <div className="glass-card rounded-2xl border border-slate-800/90 bg-slate-900/70 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Mode Switcher Pill */}
          <div className="mb-6 p-1 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center text-xs">
            <button
              type="button"
              onClick={() => setIsMockMode(true)}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                isMockMode
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Demo / Mock Auth</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMockMode(false)}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                !isMockMode
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Live Backend API</span>
            </button>
          </div>

          {/* Quick-fill Role Selector (for testing all 4 roles) */}
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                1-Click Demo Profiles
              </span>
              <span className="text-[10px] text-amber-400">Decoupled preview</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => {
                const Icon = acc.icon;
                const isSelected = selectedRole === acc.role;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleQuickFill(acc)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium truncate">{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Email Address" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                required
              />
            </FormField>

            <FormField label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </FormField>

            <div className="flex items-center justify-between text-xs pt-1">
              <Checkbox id="remember-me" label="Remember this device" />
              <span className="text-slate-500 text-[11px]">
                {isMockMode ? 'Mock Mode Enabled' : 'Connecting to ' + (import.meta.env.VITE_API_BASE_URL || '/api')}
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full mt-2"
            >
              {isMockMode ? `Sign In as ${selectedRole}` : 'Sign In via Axios'}
            </Button>
          </form>

          {/* Register Link */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
            Don't have an AidFlow account?{' '}
            <Link
              to="/register"
              className="font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
            >
              Register here
            </Link>
          </div>
        </div>

        {/* Clear Notice per requirements */}
        <p className="text-[11px] text-center text-slate-500 max-w-sm mx-auto leading-relaxed">
          AidFlow UI is isolated from backend dependencies. In Mock Mode, role credentials simulate client state without faking server validation.
        </p>
      </div>
    </div>
  );
}
