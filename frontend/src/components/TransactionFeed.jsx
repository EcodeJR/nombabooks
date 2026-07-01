import React, { useState, useEffect } from 'react';
import client from '../api/client';

const TransactionFeed = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get('/api/transactions', {
        params: { page, limit: 20 }
      });
      setTransactions(response.data.transactions);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 10000);
    return () => clearInterval(interval);
  }, [page]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Transaction Feed</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {loading && !transactions.length ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No transactions yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-2 font-semibold">
                  Reference
                </th>
                <th className="text-left px-4 py-2 font-semibold">
                  Email
                </th>
                <th className="text-left px-4 py-2 font-semibold">
                  Amount (NGN)
                </th>
                <th className="text-left px-4 py-2 font-semibold">
                  Status
                </th>
                <th className="text-left px-4 py-2 font-semibold">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx._id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">
                    {tx.nombaOrderReference.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">{tx.customerEmail}</td>
                  <td className="px-4 py-3">{tx.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                        tx.status
                      )}`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(tx.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransactionFeed;
