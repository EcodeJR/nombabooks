import React, { useState, useEffect } from 'react';
import client from '../api/client';

const WebhookLog = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWebhookEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get('/api/transactions', {
        params: { limit: 100 }
      });

      // Extract all webhook events from all transactions
      const allEvents = [];
      response.data.transactions.forEach(tx => {
        if (tx.webhookEvents && Array.isArray(tx.webhookEvents)) {
          tx.webhookEvents.forEach(evt => {
            allEvents.push({
              ...evt,
              transactionRef: tx.nombaOrderReference,
              transactionId: tx._id
            });
          });
        }
      });

      // Sort by most recent first
      allEvents.sort(
        (a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)
      );

      setEvents(allEvents);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch webhook events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhookEvents();
    const interval = setInterval(fetchWebhookEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  const getEventColor = (event) => {
    if (event.includes('completed') || event.includes('success')) {
      return 'bg-green-100 text-green-800';
    } else if (event.includes('failed')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Webhook Log</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {loading && !events.length ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No webhook events yet
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.map((evt, idx) => (
            <div
              key={idx}
              className="border rounded p-3 bg-gray-50 hover:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${getEventColor(
                    evt.event
                  )}`}
                >
                  {evt.event}
                </span>
                <span className="font-mono text-xs text-gray-600">
                  {evt.transactionRef.slice(0, 12)}...
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(evt.receivedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhookLog;
