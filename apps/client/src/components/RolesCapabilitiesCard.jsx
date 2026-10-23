import React from 'react';
import { ROLE_DEFINITIONS } from '@aidflow/shared';
import { ShieldCheck, CheckCircle2, UserCheck } from 'lucide-react';

export function RolesCapabilitiesCard({ role }) {
  const def = ROLE_DEFINITIONS[role] || {};

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Active Role: {def.label || role}
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            {role}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          {def.description}
        </p>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Authorized Capabilities:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {def.capabilities?.map((cap) => (
              <div
                key={cap}
                className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span>{cap}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
        Roles & permissions are strictly validated across Express routes and JWT payload claims.
      </div>
    </div>
  );
}
