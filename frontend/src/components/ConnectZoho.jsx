import React, { useEffect, useState } from 'react';
import client from '../api/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ConnectZoho = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkZohoStatus = async () => {
    try {
      setLoading(true);
      const response = await client.get('/api/auth/zoho/status');
      setIsConnected(response.data.connected);
    } catch (err) {
      setError(err.message);
      console.error('Failed to check Zoho status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkZohoStatus();
    const interval = setInterval(checkZohoStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = () => {
    window.location.href = `${API_BASE_URL}/zoho/auth`;
  };

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded">
        Loading Zoho connection status...
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2">
        <span className="text-lg">✓</span>
        <span>Zoho Books connected</span>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
      <p className="text-yellow-800 mb-3">
        Zoho Books is not connected. Click below to authorize:
      </p>
      <button
        onClick={handleConnect}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Connect Zoho Books
      </button>
      {error && (
        <p className="text-red-600 text-sm mt-2">Error: {error}</p>
      )}
    </div>
  );
};

export default ConnectZoho;
