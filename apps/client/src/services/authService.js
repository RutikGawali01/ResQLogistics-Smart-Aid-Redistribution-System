import { apiClient } from './apiClient.js';
import { MOCK_USERS } from './mockData.js';
import { ROLES } from '@aidflow/shared';

const TOKEN_KEY = 'aidflow_token';
const USER_KEY = 'aidflow_user';
const MOCK_AUTH_KEY = 'aidflow_is_mock_auth';

export const authService = {
  /**
   * Attempts authentication.
   * If forceMock is true, returns mock demo credentials clearly flagged with isMock: true.
   * If forceMock is false, calls the real API endpoint POST /auth/login.
   */
  async login({ email, password, role = ROLES.ADMIN, forceMock = false }) {
    if (forceMock) {
      // Find matching mock user by role or email
      const matchedUser =
        Object.values(MOCK_USERS).find((u) => u.email.toLowerCase() === email.toLowerCase()) ||
        MOCK_USERS[role] ||
        MOCK_USERS.ADMIN;

      const mockSession = {
        token: `mock_jwt_token_${matchedUser.role}_${Date.now()}`,
        user: { ...matchedUser, isMock: true }
      };

      localStorage.setItem(USER_KEY, JSON.stringify(mockSession.user));
      localStorage.setItem(TOKEN_KEY, mockSession.token);
      localStorage.setItem(MOCK_AUTH_KEY, 'true');

      return {
        success: true,
        data: mockSession,
        isMock: true,
        message: 'Signed in with local mock demo account'
      };
    }

    // Real API call via Axios
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user } = response.data?.data || response.data;

      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify({ ...user, isMock: false }));
      }
      localStorage.setItem(MOCK_AUTH_KEY, 'false');

      return {
        success: true,
        data: { token, user: { ...user, isMock: false } },
        isMock: false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Authentication failed on server',
        code: error.code || 'UNAUTHORIZED',
        status: error.status || 401,
        details: error.details || null,
        isMock: false
      };
    }
  },

  /**
   * Register a new user.
   */
  async register(registrationData, { forceMock = false } = {}) {
    if (forceMock) {
      const newUser = {
        id: `usr_mock_${Date.now()}`,
        name: registrationData.name,
        email: registrationData.email,
        role: registrationData.role || ROLES.DONOR,
        phone: registrationData.phone,
        organization: registrationData.organization || 'Independent',
        isMock: true
      };

      const mockSession = {
        token: `mock_jwt_token_${newUser.role}_${Date.now()}`,
        user: newUser
      };

      localStorage.setItem(USER_KEY, JSON.stringify(mockSession.user));
      localStorage.setItem(TOKEN_KEY, mockSession.token);
      localStorage.setItem(MOCK_AUTH_KEY, 'true');

      return {
        success: true,
        data: mockSession,
        isMock: true,
        message: 'Simulated registration completed successfully'
      };
    }

    try {
      const response = await apiClient.post('/auth/register', registrationData);
      const { token, user } = response.data?.data || response.data;

      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify({ ...user, isMock: false }));
      }
      localStorage.setItem(MOCK_AUTH_KEY, 'false');

      return {
        success: true,
        data: { token, user: { ...user, isMock: false } },
        isMock: false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Registration failed on server',
        code: error.code || 'VALIDATION_ERROR',
        status: error.status || 422,
        details: error.details || null,
        isMock: false
      };
    }
  },

  logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MOCK_AUTH_KEY);
    } catch {
      // Ignore
    }
  },

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem(USER_KEY);
      const isMock = localStorage.getItem(MOCK_AUTH_KEY) === 'true';
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return { ...user, isMock };
    } catch {
      return null;
    }
  },

  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  isMockAuth() {
    try {
      return localStorage.getItem(MOCK_AUTH_KEY) === 'true';
    } catch {
      return true;
    }
  }
};
