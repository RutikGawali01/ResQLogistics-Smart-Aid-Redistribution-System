import React from 'react';
import { ALL_ROLES, ROLE_DEFINITIONS } from '@aidflow/shared';
import { HeartHandshake, ShieldCheck, Radio, Wifi, WifiOff, Database } from 'lucide-react';

export function Navbar({
  currentRole,
  onRoleChange,
  isLiveBackend,
  socketStatus,
  forceMock,
  onToggleForceMock
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0B0F19]/90 backdrop-blur-md px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <HeartHandshake className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">AidFlow</h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Foundation v0.1
              </span>
            </div>
            <p className="text-xs text-slate-400">Real-Time Surplus Food & Aid Coordination</p>
          </div>
        </div>

        {/* Center: Role Switcher */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <span className="text-xs font-medium text-slate-400 pl-2 pr-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Role:
          </span>
          <div className="flex gap-1">
            {ALL_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => onRoleChange(role)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  currentRole === role
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={ROLE_DEFINITIONS[role]?.description}
              >
                {role.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Telemetry & Mock Mode Controls */}
        <div className="flex items-center gap-3">
          {/* Mock vs Live Toggle */}
          <button
            onClick={onToggleForceMock}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              forceMock
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle between live backend and decoupled frontend mock adapter"
          >
            <Database className="w-3.5 h-3.5" />
            {forceMock ? 'Mock Adapter (Decoupled)' : 'Live API Auto-Detect'}
          </button>

          {/* Backend Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveBackend ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300 font-mono text-[11px]">
              {isLiveBackend ? 'API Live (5000)' : 'API Fallback'}
            </span>
          </div>

          {/* Socket.IO Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {socketStatus === 'connected' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-mono text-[11px]">WS Synced</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 font-mono text-[11px]">WS Standby</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
