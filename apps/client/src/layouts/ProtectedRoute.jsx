import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '@aidflow/shared';
import { Alert } from '../components/ui/Alert.jsx';
import { Button } from '../components/ui/FormElements.jsx';

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, isAuthenticated, switchRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-12">
        <Alert
          variant="warning"
          title="Role Restricted Area"
          action={
            <div className="mt-3 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => switchRole(allowedRoles[0])}
              >
                Switch to {allowedRoles[0]} Role
              </Button>
            </div>
          }
        >
          Your current active role (<span className="font-semibold text-white">{user.role}</span>)
          does not have permission to view this route. Allowed roles: {allowedRoles.join(', ')}.
        </Alert>
      </div>
    );
  }

  return children;
}
