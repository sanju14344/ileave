import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LeaveApplication.css';

const LeaveApplication = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    leave_type: 'sick',
    start_date: '',
    end_date: '',
    reason: '',
    document_path: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await axios.post('http://localhost:5000/api/leave/applications', formData);
      setMessage('Leave application submitted successfully!');
      setFormData({
        leave_type: 'sick',
        start_date: '',
        end_date: '',
        reason: '',
        document_path: ''
      });
      
      setTimeout(() => {
        navigate('/leave-history');
      }, 2000);
    } catch (error) {
      setMessage('Error submitting application: ' + (error.response?.data?.error || 'Server error'));
    }
    
    setLoading(false);
  };

  return (
    <div className="leave-application">
      <div className="application-header">
        <h1>Apply for Leave</h1>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="application-form">
        <div className="form-group">
          <label>Leave Type:</label>
          <select 
            name="leave_type" 
            value={formData.leave_type} 
            onChange={handleChange}
            required
          >
            <option value="sick">Sick Leave</option>
            <option value="casual">Casual Leave</option>
            <option value="emergency">Emergency Leave</option>
            <option value="personal">Personal Leave</option>
          </select>
        </div>

        <div className="form-group">
          <label>Start Date:</label>
          <input
            type="date"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>End Date:</label>
          <input
            type="date"
            name="end_date"
            value={formData.end_date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Reason:</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            required
            rows="4"
            placeholder="Please provide a detailed reason for your leave..."
          />
        </div>

        <div className="form-group">
          <label>Supporting Document (Optional):</label>
          <input
            type="text"
            name="document_path"
            value={formData.document_path}
            onChange={handleChange}
            placeholder="Path to supporting document"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

export default LeaveApplication;