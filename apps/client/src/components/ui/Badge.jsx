import React from 'react';
import { ASSIGNMENT_STATUS, ROLES } from '@aidflow/shared';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Truck,
  PackageCheck,
  Shield,
  HeartHandshake,
  Bike,
  Building2
} from 'lucide-react';

export function Badge({ children, variant = 'default', size = 'md', className = '', ...props }) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  const variantClasses = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    blue: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    slate: 'bg-slate-800/80 text-slate-400 border-slate-700/80'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantClasses[variant] || variantClasses.default} ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, size = 'md' }) {
  const configs = {
    [ASSIGNMENT_STATUS.UNASSIGNED]: {
      label: 'Unassigned',
      variant: 'slate',
      icon: Clock,
      pulse: false
    },
    [ASSIGNMENT_STATUS.PENDING_ACCEPTANCE]: {
      label: 'Pending Acceptance',
      variant: 'amber',
      icon: Clock,
      pulse: true
    },
    [ASSIGNMENT_STATUS.ACCEPTED]: {
      label: 'Accepted',
      variant: 'blue',
      icon: CheckCircle2,
      pulse: false
    },
    [ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS]: {
      label: 'En Route to Pickup',
      variant: 'purple',
      icon: Truck,
      pulse: true
    },
    [ASSIGNMENT_STATUS.PICKED_UP]: {
      label: 'Picked Up',
      variant: 'purple',
      icon: PackageCheck,
      pulse: false
    },
    [ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS]: {
      label: 'En Route to Delivery',
      variant: 'blue',
      icon: Truck,
      pulse: true
    },
    [ASSIGNMENT_STATUS.DELIVERED]: {
      label: 'Delivered',
      variant: 'emerald',
      icon: CheckCircle2,
      pulse: false
    },
    [ASSIGNMENT_STATUS.CANCELLED]: {
      label: 'Cancelled',
      variant: 'rose',
      icon: XCircle,
      pulse: false
    },
    [ASSIGNMENT_STATUS.FAILED]: {
      label: 'Failed',
      variant: 'rose',
      icon: AlertTriangle,
      pulse: false
    }
  };

  const cfg = configs[status] || {
    label: status || 'Unknown',
    variant: 'slate',
    icon: Clock,
    pulse: false
  };

  const IconComponent = cfg.icon;

  return (
    <Badge variant={cfg.variant} size={size}>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {!cfg.pulse && <IconComponent className="w-3.5 h-3.5" />}
      <span>{cfg.label}</span>
    </Badge>
  );
}

export function UrgencyBadge({ urgency, size = 'md' }) {
  const configs = {
    LOW: { label: 'Low Urgency', variant: 'blue' },
    MEDIUM: { label: 'Medium Urgency', variant: 'amber' },
    HIGH: { label: 'High Urgency', variant: 'rose' },
    CRITICAL: { label: 'CRITICAL', variant: 'rose', pulse: true }
  };

  const cfg = configs[urgency] || { label: urgency || 'Standard', variant: 'slate' };

  return (
    <Badge variant={cfg.variant} size={size}>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
      )}
      {cfg.label}
    </Badge>
  );
}

export function CategoryBadge({ category, size = 'md' }) {
  const categoryVariantMap = {
    PERISHABLE: 'rose',
    PRODUCE: 'emerald',
    BAKERY: 'amber',
    PREPARED_MEALS: 'blue',
    DAIRY: 'blue',
    HYGIENE: 'purple',
    CLOTHING: 'slate',
    MEDICAL: 'rose'
  };

  const variant = categoryVariantMap[category] || 'default';
  const label = (category || '').replace(/_/g, ' ');

  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}

export function RoleBadge({ role, size = 'md' }) {
  const configs = {
    [ROLES.ADMIN]: { label: 'Admin', variant: 'purple', icon: Shield },
    [ROLES.DONOR]: { label: 'Donor', variant: 'emerald', icon: HeartHandshake },
    [ROLES.RIDER]: { label: 'Courier', variant: 'blue', icon: Bike },
    [ROLES.SHELTER_MANAGER]: { label: 'Shelter Hub', variant: 'amber', icon: Building2 }
  };

  const cfg = configs[role] || { label: role || 'Guest', variant: 'slate', icon: Shield };
  const IconComponent = cfg.icon;

  return (
    <Badge variant={cfg.variant} size={size}>
      <IconComponent className="w-3.5 h-3.5" />
      <span>{cfg.label}</span>
    </Badge>
  );
}
