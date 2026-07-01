const express = require('express');
const Transaction = require('../models/Transaction');
const { initiateRefund } = require('../services/nomba');
const { createCreditNote } = require('../services/zoho');

const router = express.Router();

/**
 * POST /api/refunds/initiate
 * Initiates a refund for a paid transaction
 */
router.post('/api/refunds/initiate', async (req, res, next) => {
  try {
    const { transactionId, reason } = req.body;

    if (!transactionId) {
      throw {
        status: 400,
        message: 'transactionId is required'
      };
    }

    console.log(
      `[Refund] Processing refund request for: ${transactionId}`
    );

    // Find transaction
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      throw {
        status: 404,
        message: 'Transaction not found'
      };
    }

    // Verify transaction is in paid status
    if (transaction.status !== 'paid') {
      throw {
        status: 400,
        message: 'Only paid transactions can be refunded'
      };
    }

    // Call Nomba refund (must succeed before Zoho update)
    console.log(
      `[Refund] Initiating Nomba refund for: ${transaction.nombaTransactionId}`
    );

    let refundResult;
    try {
      refundResult = await initiateRefund({
        transactionId: transaction.nombaTransactionId,
        amount: transaction.amount,
        reason: reason || 'Customer refund request'
      });
    } catch (nombaError) {
      console.error(`[Refund] Nomba refund failed: ${nombaError.message}`);
      throw {
        status: 502,
        message: `Nomba refund failed: ${nombaError.message}`
      };
    }

    // Create credit note in Zoho
    console.log(
      `[Refund] Creating credit note in Zoho for: ${transaction.zohoInvoiceId}`
    );

    try {
      await createCreditNote({
        invoiceId: transaction.zohoInvoiceId,
        amount: transaction.amount,
        reason: reason || 'Refund'
      });
    } catch (zohoError) {
      console.error(`[Refund] Zoho credit note failed: ${zohoError.message}`);
      // Continue - credit note is secondary
    }

    // Update transaction record
    transaction.status = 'refunded';
    transaction.refundId =
      refundResult?.refundId || refundResult?.id || 'pending';
    transaction.updatedAt = new Date();

    await transaction.save();

    console.log(
      `[Refund] Refund processed successfully: ${transactionId}`
    );

    res.json({
      success: true,
      transactionId,
      refundId: transaction.refundId,
      amount: transaction.amount
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
