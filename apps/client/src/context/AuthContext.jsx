import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService.js';
import { ROLES } from '@aidflow/shared';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize with persisted session if authentic, otherwise null
  const [user, setUser] = useState(() => {
    try {
      const isMock = localStorage.getItem('aidflow_is_mock_auth') === 'true';
      const token = localStorage.getItem('aidflow_token');
      if (isMock || (token && token.startsWith('mock_jwt_token_'))) {
        authService.logout();
        return null;
      }
    } catch {
      // Ignore storage errors
    }
    const existing = authService.getCurrentUser();
    return existing && !existing.isMock ? existing : null;
  });

  const [token, setToken] = useState(() => {
    try {
      const stored = authService.getToken();
      return stored && !stored.startsWith('mock_jwt_token_') ? stored : null;
    } catch {
      return null;
    }
  });

  const [isMockAuth, setIsMockAuth] = useState(false);

  // Global toggle for mock data fallback across all dashboards
  const [forceMock, setForceMock] = useState(() => {
    try {
      const saved = localStorage.getItem('aidflow_force_mock');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const handleUnauthorized = () => {
      const isMock = localStorage.getItem('aidflow_is_mock_auth') === 'true';
      if (!isMock) {
        logout();
        setAuthError('Session expired. Please sign in again.');
      }
    };

    window.addEventListener('aidflow:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('aidflow:unauthorized', handleUnauthorized);
  }, []);

  const login = async ({ email, password, role = ROLES.ADMIN, forceMock: reqMock }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const useMock = reqMock !== undefined ? reqMock : forceMock;
      const result = await authService.login({ email, password, role, forceMock: useMock });

      if (result.success) {
        setUser(result.data.user);
        setToken(result.data.token);
        setIsMockAuth(result.isMock);
        return { success: true, user: result.data.user, isMock: result.isMock };
      } else {
        setAuthError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const msg = err.message || 'Login failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData, { forceMock: reqMock } = {}) => {
    setLoading(true);
    setAuthError(null);
    try {
      const useMock = reqMock !== undefined ? reqMock : forceMock;
      const result = await authService.register(formData, { forceMock: useMock });

      if (result.success) {
        setUser(result.data.user);
        setToken(result.data.token);
        setIsMockAuth(result.isMock);
        return { success: true, user: result.data.user, isMock: result.isMock };
      } else {
        setAuthError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const msg = err.message || 'Registration failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setToken(null);
    setIsMockAuth(false);
    setAuthError(null);
  }, []);

  /**
   * Fast-switch helper: Authenticates against the real MongoDB account for that role
   */
  const switchRole = useCallback(
    async (newRole) => {
      const roleAccounts = {
        ADMIN: { email: 'admin@aidflow.org', password: 'AidFlowAdmin!2026', role: 'ADMIN' },
        DONOR: { email: 'sarah@freshmarket.com', password: 'Password123!', role: 'DONOR' },
        RIDER: { email: 'carlos.rider@aidflow.org', password: 'Password123!', role: 'RIDER' },
        SHELTER_MANAGER: { email: 'elena@downtownhope.org', password: 'Password123!', role: 'SHELTER_MANAGER' }
      };
      const creds = roleAccounts[newRole];
      if (creds) {
        return await login(creds);
      }
    },
    [login]
  );

  const toggleForceMock = useCallback(() => {
    setForceMock((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aidflow_force_mock', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    isMockAuth,
    forceMock,
    loading,
    authError,
    setAuthError,
    login,
    register,
    logout,
    switchRole,
    toggleForceMock
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
