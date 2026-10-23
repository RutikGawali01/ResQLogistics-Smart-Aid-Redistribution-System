import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/FormElements.jsx';
import { AlertTriangle, Home, LogIn } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#0A0E17] flex flex-col items-center justify-center p-6 text-center">
      <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-amber-400 mb-4">
        <AlertTriangle className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">404 - Page Not Found</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        The route you requested does not exist or has been moved in the AidFlow portal.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/admin">
          <Button variant="primary" icon={Home}>
            Go to Admin Dashboard
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" icon={LogIn}>
            Back to Login
          </Button>
        </Link>
      </div>
    </div>
  );
}
