import React, { useState, useEffect } from 'react';
import client from '../api/client';
import ConnectZoho from '../components/ConnectZoho';

const Settings = () => {
  const [nombaConfig, setNombaConfig] = useState({
    clientId: '',
    clientSecret: '',
    accountId: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const loadSettings = async () => {
    try {
      const response = await client.get('/api/settings/nomba');

      setNombaConfig({
        clientId: response.data.clientId || '',
        clientSecret: '',
        accountId: response.data.accountId || ''
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || error.message
      });
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNombaConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);

      if (!nombaConfig.clientId.trim() || !nombaConfig.accountId.trim()) {
        throw new Error('Client ID and Account ID are required');
      }

      await client.post('/api/settings/nomba', {
        clientId: nombaConfig.clientId,
        clientSecret: nombaConfig.clientSecret,
        accountId: nombaConfig.accountId
      });

      setMessage({
        type: 'success',
        text: 'Nomba settings saved successfully.'
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Zoho Connection */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Zoho Books</h2>
            <ConnectZoho />
          </div>

          {/* Nomba Configuration */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Nomba Configuration</h2>

            {message && (
              <div
                className={`px-4 py-3 rounded mb-4 ${
                  message.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client ID
                </label>
                <input
                  type="password"
                  name="clientId"
                  value={nombaConfig.clientId}
                  onChange={handleChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client Secret
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={nombaConfig.clientSecret}
                  onChange={handleChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank to keep existing secret"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Account ID
                </label>
                <input
                  type="text"
                  name="accountId"
                  value={nombaConfig.accountId}
                  onChange={handleChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your Nomba account ID"
                />
              </div>

              <p className="text-sm text-gray-600">
                ℹ️ These settings are saved in MongoDB and used by the backend
                when environment variables are not present.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
