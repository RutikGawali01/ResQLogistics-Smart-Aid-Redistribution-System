import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService.js';
import { MOCK_USERS } from '../services/mockData.js';
import { ROLES } from '@aidflow/shared';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize with persisted session or default mock admin for immediate previewability
  const [user, setUser] = useState(() => {
    const existing = authService.getCurrentUser();
    if (existing) return existing;
    // Default to mock admin so first-time load immediately works out-of-the-box
    const defaultUser = { ...MOCK_USERS.ADMIN, isMock: true };
    try {
      localStorage.setItem('aidflow_user', JSON.stringify(defaultUser));
      localStorage.setItem('aidflow_token', 'mock_jwt_token_ADMIN_default');
      localStorage.setItem('aidflow_is_mock_auth', 'true');
    } catch {
      // localStorage may fail in restricted sandboxes
    }
    return defaultUser;
  });

  const [token, setToken] = useState(() => authService.getToken() || 'mock_jwt_token_ADMIN_default');
  const [isMockAuth, setIsMockAuth] = useState(() => {
    const existing = authService.getCurrentUser();
    return existing ? authService.isMockAuth() : true;
  });

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
   * Fast-switch helper for developers/evaluators to immediately experience different role views
   */
  const switchRole = useCallback((newRole) => {
    if (!MOCK_USERS[newRole]) return;
    const mockUser = { ...MOCK_USERS[newRole], isMock: true };
    setUser(mockUser);
    setIsMockAuth(true);
    localStorage.setItem('aidflow_user', JSON.stringify(mockUser));
    localStorage.setItem('aidflow_is_mock_auth', 'true');
  }, []);

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
