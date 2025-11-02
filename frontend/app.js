import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import LeaveApplication from './components/LeaveApplication';
import LeaveHistory from './components/LeaveHistory';
import ManageApplications from './components/ManageApplications';
import UserManagement from './components/UserManagement';
import Navbar from './components/Navbar';
import './App.css';

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Navbar />
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Navbar />
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/apply-leave" element={
              <ProtectedRoute allowedRoles={['student']}>
                <Navbar />
                <LeaveApplication />
              </ProtectedRoute>
            } />
            <Route path="/leave-history" element={
              <ProtectedRoute allowedRoles={['student']}>
                <Navbar />
                <LeaveHistory />
              </ProtectedRoute>
            } />
            <Route path="/manage-applications" element={
              <ProtectedRoute allowedRoles={['advisor', 'hod']}>
                <Navbar />
                <ManageApplications />
              </ProtectedRoute>
            } />
            <Route path="/user-management" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navbar />
                <UserManagement />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;