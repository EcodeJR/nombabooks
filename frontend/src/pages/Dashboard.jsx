import React, { useState } from 'react';
import TransactionFeed from '../components/TransactionFeed';
import WebhookLog from '../components/WebhookLog';
import ConnectZoho from '../components/ConnectZoho';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">NombaBooks</h1>
          <p className="text-gray-600 text-sm mt-1">
            Nomba Payment + Zoho Books Integration
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <ConnectZoho />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TransactionFeed />
          <WebhookLog />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
