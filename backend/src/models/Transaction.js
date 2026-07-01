const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    nombaOrderReference: {
      type: String,
      required: true,
      unique: true
    },
    zohoInvoiceId: {
      type: String,
      required: true
    },
    zohoInvoiceNumber: String,
    customerEmail: String,
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'NGN'
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    nombaTransactionId: String,
    refundId: String,
    webhookEvents: [
      {
        event: String,
        receivedAt: { type: Date, default: Date.now },
        payload: mongoose.Schema.Types.Mixed
      }
    ],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
