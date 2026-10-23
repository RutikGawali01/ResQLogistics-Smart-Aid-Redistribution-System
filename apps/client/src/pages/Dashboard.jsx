import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { Navbar } from '../components/Navbar.jsx';
import { MapPreview } from '../components/MapPreview.jsx';
import { AssignmentStateMachineVisualizer } from '../components/AssignmentStateMachineVisualizer.jsx';
import { ContractsExplorer } from '../components/ContractsExplorer.jsx';
import { RolesCapabilitiesCard } from '../components/RolesCapabilitiesCard.jsx';
import { ROLES, SOCKET_EVENTS } from '@aidflow/shared';
import { Package, Building2, Bike, ArrowUpRight, Activity } from 'lucide-react';

export function Dashboard() {
  const [currentRole, setCurrentRole] = useState(ROLES.ADMIN);
  const [forceMock, setForceMock] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [socketStatus, setSocketStatus] = useState('offline');

  const [donations, setDonations] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [riders, setRiders] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Telemetry poll & Socket init
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const healthRes = await api.checkHealth(forceMock);
      if (isMounted) {
        setIsLiveBackend(!healthRes.isMock);
      }

      const [donRes, shlRes, rdrRes, asgRes] = await Promise.all([
        api.getDonations(forceMock),
        api.getShelters(forceMock),
        api.getRiders(forceMock),
        api.getAssignments(forceMock)
      ]);

      if (isMounted) {
        setDonations(donRes.data || []);
        setShelters(shlRes.data || []);
        setRiders(rdrRes.data || []);
        setAssignments(asgRes.data || []);
      }
    }

    loadData();

    // Connect Socket.IO
    const socket = connectSocket((status) => {
      if (isMounted) setSocketStatus(status);
    });

    socket.on(SOCKET_EVENTS.DONATION_CREATED, (newDonation) => {
      setDonations((prev) => [newDonation, ...prev]);
    });

    socket.on(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, (updatedAsg) => {
      setAssignments((prev) =>
        prev.map((a) => (a.id === updatedAsg.assignmentId ? { ...a, status: updatedAsg.newStatus } : a))
      );
    });

    return () => {
      isMounted = false;
      disconnectSocket();
    };
  }, [forceMock]);

  const handleAssignmentTransition = async (assignmentId, targetStatus) => {
    const res = await api.transitionAssignmentState(assignmentId, targetStatus, forceMock);
    if (res.success && res.data) {
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? res.data : a))
      );
    }
    return res;
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col">
      {/* Navigation & Telemetry */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        isLiveBackend={isLiveBackend}
        socketStatus={socketStatus}
        forceMock={forceMock}
        onToggleForceMock={() => setForceMock((prev) => !prev)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI / Health Telemetry Metrics */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Surplus Food Available
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {donations.reduce((sum, d) => sum + (d.quantity || 0), 0)} <span className="text-xs font-normal text-slate-400">units</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> {donations.length} Active Posts
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Registered Shelters
              </div>
              <div className="text-2xl font-bold text-white mt-1">{shelters.length}</div>
              <div className="text-[11px] text-indigo-400 mt-0.5">
                {shelters.filter((s) => s.urgencyLevel === 'HIGH' || s.urgencyLevel === 'CRITICAL').length} High Urgency
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Couriers Available
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {riders.filter((r) => r.status === 'AVAILABLE').length}
              </div>
              <div className="text-[11px] text-amber-400 mt-0.5">{riders.length} Registered Fleet</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bike className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Dispatch Pipeline
              </div>
              <div className="text-2xl font-bold text-white mt-1">{assignments.length}</div>
              <div className="text-[11px] text-teal-400 mt-0.5 flex items-center gap-1">
                <Activity className="w-3 h-3" /> State Engine Active
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Primary Row: Map Grid + Assignment State Machine */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MapPreview
            donations={donations}
            shelters={shelters}
            riders={riders}
            assignments={assignments}
            isMockData={forceMock}
          />
          <AssignmentStateMachineVisualizer
            onTransition={handleAssignmentTransition}
            isLiveBackend={isLiveBackend}
          />
        </div>

        {/* Secondary Row: Role Capabilities Card + Contracts Explorer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <RolesCapabilitiesCard role={currentRole} />
          </div>
          <div className="lg:col-span-2">
            <ContractsExplorer forceMock={forceMock} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0B0F19] py-4 px-6 text-center text-xs text-slate-500">
        AidFlow Engineering Foundation • Decoupled React + Node.js + Worker Architecture • Zero Redis Dependency
      </footer>
    </div>
  );
}
