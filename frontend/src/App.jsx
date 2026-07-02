import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [connected, setConnected] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  return (
    <div>
      {/* Navigation */}
      <nav className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`px-3 py-2 rounded ${
                  currentPage === 'dashboard'
                    ? 'bg-gray-900'
                    : 'hover:bg-gray-700'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentPage('settings')}
                className={`px-3 py-2 rounded ${
                  currentPage === 'settings'
                    ? 'bg-gray-900'
                    : 'hover:bg-gray-700'
                }`}
              >
                Settings
              </button>
            </div>
            <div className="text-sm text-gray-400">
              Backend: {apiBaseUrl}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div>
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'settings' && <Settings />}
      </div>
    </div>
  );
}

export default App;
