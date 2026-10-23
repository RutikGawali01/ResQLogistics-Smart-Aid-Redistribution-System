import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, ROLE_DEFINITIONS } from '@aidflow/shared';
import { Button, Input, Select, FormField } from '../../components/ui/FormElements.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Activity, Shield } from 'lucide-react';

export function RegisterPage() {
  const { register, loading, authError, setAuthError } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: ROLES.DONOR,
    organization: '',
    password: '',
    confirmPassword: ''
  });

  const [formValidation, setFormValidation] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formValidation) setFormValidation(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setFormValidation(null);

    if (formData.password !== formData.confirmPassword) {
      setFormValidation('Passwords do not match.');
      return;
    }

    if (formData.password.length < 8) {
      setFormValidation('Password must be at least 8 characters long.');
      return;
    }

    const result = await register({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      organization: formData.organization || undefined,
      password: formData.password
    });

    if (result.success) {
      const roleRoutes = {
        [ROLES.ADMIN]: '/admin',
        [ROLES.DONOR]: '/donor',
        [ROLES.RIDER]: '/rider',
        [ROLES.SHELTER_MANAGER]: '/shelter'
      };
      navigate(roleRoutes[result.user.role] || '/admin', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-700 shadow-xl shadow-emerald-950/60 mb-2">
            <Activity className="w-6 h-6 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Join the AidFlow Network</h1>
          <p className="text-xs text-slate-400">
            Create an account to coordinate food rescue and emergency aid logistics
          </p>
        </div>

        {authError && (
          <Alert variant="error" onClose={() => setAuthError(null)}>
            {authError}
          </Alert>
        )}

        {formValidation && (
          <Alert variant="warning" onClose={() => setFormValidation(null)}>
            {formValidation}
          </Alert>
        )}

        <div className="glass-card rounded-2xl border border-slate-800/90 bg-slate-900/70 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Full Name" required>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Jordan Lee"
                  required
                />
              </FormField>

              <FormField label="Phone Number" required>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </FormField>
            </div>

            <FormField label="Email Address" required>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="jordan@aidflow.org"
                required
              />
            </FormField>

            <FormField label="Platform Role" required hint={ROLE_DEFINITIONS[formData.role]?.label}>
              <Select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
              >
                <option value={ROLES.DONOR}>Donor (Donating surplus food / supplies)</option>
                <option value={ROLES.RIDER}>Rider (Volunteer or courier driver)</option>
                <option value={ROLES.SHELTER_MANAGER}>Shelter Manager (Intake & relief hub)</option>
                <option value={ROLES.ADMIN}>Platform Administrator</option>
              </Select>
            </FormField>

            <FormField label="Organization / Business Name" hint="Optional">
              <Input
                value={formData.organization}
                onChange={(e) => handleChange('organization', e.target.value)}
                placeholder="e.g. Bay Harvest Pantry"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Password" required hint="Min 8 chars">
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </FormField>

              <FormField label="Confirm Password" required>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </FormField>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full mt-3"
            >
              Create {ROLE_DEFINITIONS[formData.role]?.label || formData.role} Account
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
            Already registered on AidFlow?{' '}
            <Link
              to="/login"
              className="font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
            >
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
