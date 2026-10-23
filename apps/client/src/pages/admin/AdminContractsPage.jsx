import React from 'react';
import { ContractsExplorer } from '../../components/ContractsExplorer.jsx';
import { RolesCapabilitiesCard } from '../../components/RolesCapabilitiesCard.jsx';
import { FileCode2, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '@aidflow/shared';

export function AdminContractsPage() {
  const { role } = useAuth();

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-800">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <FileCode2 className="w-5 h-5 text-emerald-400" />
          System Schemas & Shared Contracts
        </h2>
        <p className="text-xs text-slate-400">
          AidFlow shared Zod data contracts, API route specifications, and role-based permissions matrix.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ContractsExplorer />
        </div>
        <div>
          <RolesCapabilitiesCard currentRole={role || ROLES.ADMIN} />
        </div>
      </div>
    </div>
  );
}
