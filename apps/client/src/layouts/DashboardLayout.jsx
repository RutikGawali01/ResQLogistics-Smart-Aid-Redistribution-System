import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar.jsx';
import { Header } from '../components/navigation/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { Sparkles } from 'lucide-react';

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [socketStatus, setSocketStatus] = useState('offline');
  const { forceMock, isMockAuth } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function probeBackend() {
      const res = await api.checkHealth(forceMock);
      if (isMounted) {
        setIsLiveBackend(!res.isMock);
      }
    }

    probeBackend();

    const socket = connectSocket((status) => {
      if (isMounted) setSocketStatus(status);
    });

    return () => {
      isMounted = false;
      disconnectSocket();
    };
  }, [forceMock]);

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col antialiased">
      {/* Sidebar navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area (offset by sidebar width on desktop) */}
      <div className="flex-1 flex flex-col lg:pl-72 transition-all duration-300">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          socketStatus={socketStatus}
          isLiveBackend={isLiveBackend}
        />

        {/* Global Banner when in simulated / mock mode */}
        {(forceMock || isMockAuth) && (
          <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-transparent border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Decoupled Demo Mode:</strong> Visualizing AidFlow with isolated client mock data. Presentation components are ready for real backend contracts.
              </span>
            </div>
            <span className="hidden sm:inline font-mono text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
              Mock Adapter Active
            </span>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
