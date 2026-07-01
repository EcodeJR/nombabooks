import React, { useState } from 'react';
import client from '../api/client';

const RefundModal = ({ transactionId, amount, isOpen, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await client.post('/api/refunds/initiate', {
        transactionId,
        reason
      });

      setSuccess(true);
      setReason('');
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Refund Transaction</h3>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            ✓ Refund processed successfully!
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount
              </label>
              <input
                type="text"
                disabled
                value={`NGN ${amount.toLocaleString()}`}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter refund reason"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="4"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RefundModal;
