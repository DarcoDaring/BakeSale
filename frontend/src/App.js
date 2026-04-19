import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Sale from './pages/Sale';
import Purchase from './pages/Purchase';
import Reports from './pages/Reports';
import Stock from './pages/Stock';
import AdminPanel from './pages/AdminPanel';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/sale" replace />;
  return children;
}

// Wraps routes that need permission-gating
function PermissionedRoute({ children, permKey }) {
  const { isAdmin, can } = usePermissions();
  if (isAdmin || can(permKey)) return children;
  return <Navigate to="/sale" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/sale" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/sale" replace />} />
        <Route path="sale"     element={<PermissionedRoute permKey="can_access_sale"><Sale /></PermissionedRoute>} />
        <Route path="purchase" element={<PermissionedRoute permKey="can_access_purchase"><Purchase /></PermissionedRoute>} />
        <Route path="reports"  element={<PermissionedRoute permKey="can_access_reports"><Reports /></PermissionedRoute>} />
        <Route path="stock"    element={<PermissionedRoute permKey="can_access_stock"><Stock /></PermissionedRoute>} />
        <Route path="admin"    element={<AdminRoute><AdminPanel /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/sale" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{
            style: { background: '#1e1e2e', color: '#e8e8f0', border: '1px solid #2e2e42', fontFamily: 'Syne, sans-serif' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }} />
        </BrowserRouter>
      </PermissionProvider>
    </AuthProvider>
  );
}