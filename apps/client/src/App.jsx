import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { DashboardLayout } from './layouts/DashboardLayout.jsx';
import { ProtectedRoute } from './layouts/ProtectedRoute.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.jsx';
import { AdminDonationsPage } from './pages/admin/AdminDonationsPage.jsx';
import { AdminSheltersPage } from './pages/admin/AdminSheltersPage.jsx';
import { AdminRidersPage } from './pages/admin/AdminRidersPage.jsx';
import { AdminContractsPage } from './pages/admin/AdminContractsPage.jsx';
import { LiveOperationsPage } from './pages/admin/LiveOperationsPage.jsx';
import { DonorDashboard } from './pages/donor/DonorDashboard.jsx';
import { DonorCreateDonationPage } from './pages/donor/DonorCreateDonationPage.jsx';
import { RiderDashboard } from './pages/rider/RiderDashboard.jsx';
import { ShelterDashboard } from './pages/shelter/ShelterDashboard.jsx';
import { Dashboard as OverviewDashboard } from './pages/Dashboard.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { ROLES } from '@aidflow/shared';

function RootRedirect() {
  const { role } = useAuth();
  if (role === ROLES.DONOR) return <Navigate to="/donor" replace />;
  if (role === ROLES.RIDER) return <Navigate to="/rider" replace />;
  if (role === ROLES.SHELTER_MANAGER) return <Navigate to="/shelter" replace />;
  return <Navigate to="/admin" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Dashboard Shell with Sidebar & Header */}
          <Route element={<DashboardLayout />}>
            {/* Root index redirect based on user role */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/overview" element={<OverviewDashboard />} />

            {/* ADMIN Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/operations"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <LiveOperationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/donations"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminDonationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/shelters"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminSheltersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/riders"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminRidersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/assignments"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contracts"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminContractsPage />
                </ProtectedRoute>
              }
            />

            {/* DONOR Routes */}
            <Route
              path="/donor"
              element={
                <ProtectedRoute allowedRoles={[ROLES.DONOR, ROLES.ADMIN]}>
                  <DonorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/donor/create"
              element={
                <ProtectedRoute allowedRoles={[ROLES.DONOR, ROLES.ADMIN]}>
                  <DonorCreateDonationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/donor/donations"
              element={
                <ProtectedRoute allowedRoles={[ROLES.DONOR, ROLES.ADMIN]}>
                  <DonorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/donor/history"
              element={
                <ProtectedRoute allowedRoles={[ROLES.DONOR, ROLES.ADMIN]}>
                  <DonorDashboard />
                </ProtectedRoute>
              }
            />

            {/* RIDER Routes */}
            <Route
              path="/rider"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RIDER, ROLES.ADMIN]}>
                  <RiderDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/active"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RIDER, ROLES.ADMIN]}>
                  <RiderDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/history"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RIDER, ROLES.ADMIN]}>
                  <RiderDashboard />
                </ProtectedRoute>
              }
            />

            {/* SHELTER_MANAGER Routes */}
            <Route
              path="/shelter"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SHELTER_MANAGER, ROLES.ADMIN]}>
                  <ShelterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shelter/incoming"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SHELTER_MANAGER, ROLES.ADMIN]}>
                  <ShelterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shelter/capacity"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SHELTER_MANAGER, ROLES.ADMIN]}>
                  <ShelterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shelter/catalog"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SHELTER_MANAGER, ROLES.ADMIN]}>
                  <ShelterDashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
