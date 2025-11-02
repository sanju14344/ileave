import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [recentApplications, setRecentApplications] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/leave/applications');
      const applications = response.data;
      
      // Calculate stats based on user role
      let userStats = {};
      
      if (user.role === 'student') {
        userStats = {
          total: applications.length,
          pending: applications.filter(app => app.status === 'pending').length,
          approved: applications.filter(app => app.status.includes('approved')).length,
          rejected: applications.filter(app => app.status.includes('rejected')).length
        };
      } else if (user.role === 'advisor') {
        userStats = {
          pending: applications.filter(app => app.status === 'pending').length,
          approved: applications.filter(app => app.status === 'approved_advisor').length
        };
      } else if (user.role === 'hod') {
        userStats = {
          pending: applications.filter(app => app.status === 'approved_advisor').length,
          approved: applications.filter(app => app.status === 'approved_hod').length
        };
      }
      
      setStats(userStats);
      setRecentApplications(applications.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': 'badge-warning',
      'approved_advisor': 'badge-info',
      'approved_hod': 'badge-success',
      'rejected_advisor': 'badge-danger',
      'rejected_hod': 'badge-danger'
    };
    
    const statusText = {
      'pending': 'Pending with Advisor',
      'approved_advisor': 'Approved by Advisor',
      'approved_hod': 'Approved',
      'rejected_advisor': 'Rejected by Advisor',
      'rejected_hod': 'Rejected by HOD'
    };
    
    return <span className={`badge ${statusMap[status]}`}>{statusText[status]}</span>;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {user.name}!</h1>
        <p>Role: {user.role.toUpperCase()}</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        {user.role === 'student' && (
          <>
            <div className="stat-card">
              <h3>Total Applications</h3>
              <p className="stat-number">{stats.total || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Pending</h3>
              <p className="stat-number">{stats.pending || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Approved</h3>
              <p className="stat-number">{stats.approved || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Rejected</h3>
              <p className="stat-number">{stats.rejected || 0}</p>
            </div>
          </>
        )}
        
        {user.role === 'advisor' && (
          <>
            <div className="stat-card">
              <h3>Pending Review</h3>
              <p className="stat-number">{stats.pending || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Approved</h3>
              <p className="stat-number">{stats.approved || 0}</p>
            </div>
          </>
        )}
        
        {user.role === 'hod' && (
          <>
            <div className="stat-card">
              <h3>Pending Review</h3>
              <p className="stat-number">{stats.pending || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Final Approved</h3>
              <p className="stat-number">{stats.approved || 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Recent Applications */}
      <div className="recent-applications">
        <h2>Recent Leave Applications</h2>
        <div className="applications-list">
          {recentApplications.length === 0 ? (
            <p>No leave applications found.</p>
          ) : (
            recentApplications.map(application => (
              <div key={application.id} className="application-item">
                <div className="application-info">
                  <h4>{application.student_name}</h4>
                  <p>Type: {application.leave_type} | From: {application.start_date} to {application.end_date}</p>
                  <p>Reason: {application.reason}</p>
                </div>
                <div className="application-status">
                  {getStatusBadge(application.status)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;