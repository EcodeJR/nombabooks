const express = require('express');
const Transaction = require('../models/Transaction');
const { markInvoicePaid } = require('../services/zoho');
const retryQueue = require('../queues/retryQueue');
const validateWebhookSignature = require('../middleware/validateWebhook');

const router = express.Router();

/**
 * POST /api/webhooks/nomba
 * Receives Nomba webhook events with strict signature validation and idempotency
 *
 * Critical requirements:
 * 1. Validate signature before processing
 * 2. Check idempotency (don't process same event twice)
 * 3. Always return 200 within 10 seconds
 * 4. Push slow operations to retry queue
 */
router.post(
  '/',
  validateWebhookSignature,
  async (req, res, next) => {
    try {
      const payload = req.body;
      const { event, data } = payload;

      console.log(`[Webhook] Received event: ${event}`);
      console.log(`[Webhook] Payload: ${JSON.stringify(payload)}`);

      // Extract merchantTxRef (orderReference) from payload
      const merchantTxRef =
        data?.orderReference || data?.merchantTxRef || null;

      if (!merchantTxRef) {
        console.warn('[Webhook] No merchantTxRef in payload');
        return res.status(200).json({ received: true });
      }

      // Find transaction
      let transaction = await Transaction.findOne({
        nombaOrderReference: merchantTxRef
      });

      if (!transaction) {
        console.warn(
          `[Webhook] No transaction found for ref: ${merchantTxRef}`
        );
        return res.status(200).json({ received: true });
      }

      // ===== IDEMPOTENCY CHECK =====
      // Check if this exact event has already been processed
      const isDuplicate = transaction.webhookEvents.some(
        evt =>
          evt.event === event &&
          Math.abs(
            new Date(evt.receivedAt) - new Date()
          ) < 5000 // Within 5 seconds
      );

      if (isDuplicate) {
        console.log(`[Webhook] Duplicate event detected: ${event}. Ignoring.`);
        return res.status(200).json({ received: true });
      }

      // ===== HANDLE EVENTS =====
      if (
        event === 'checkout.completed' ||
        event === 'payment.success'
      ) {
        console.log(
          `[Webhook] Payment successful for: ${merchantTxRef}`
        );

        // Record webhook event immediately
        transaction.webhookEvents.push({
          event,
          receivedAt: new Date(),
          payload: data
        });

        // Update transaction status
        transaction.status = 'paid';
        transaction.nombaTransactionId =
          data?.transactionId || null;
        transaction.updatedAt = new Date();

        await transaction.save();

        // Queue Zoho update to avoid blocking webhook response
        retryQueue.add(async () => {
          await markInvoicePaid({
            invoiceId: transaction.zohoInvoiceId,
            amount: transaction.amount,
            paymentDate: new Date()
              .toISOString()
              .split('T')[0],
            paymentMode: 'bank_transfer',
            transactionId: transaction.nombaTransactionId
          });
        });

        console.log(
          `[Webhook] Transaction updated, Zoho update queued: ${merchantTxRef}`
        );
        return res.status(200).json({ received: true });
      } else if (
        event === 'checkout.failed' ||
        event === 'payment.failed'
      ) {
        console.log(
          `[Webhook] Payment failed for: ${merchantTxRef}`
        );

        transaction.webhookEvents.push({
          event,
          receivedAt: new Date(),
          payload: data
        });

        transaction.status = 'failed';
        transaction.updatedAt = new Date();

        await transaction.save();

        console.log(
          `[Webhook] Transaction marked failed: ${merchantTxRef}`
        );
        return res.status(200).json({ received: true });
      } else {
        // Unknown event type - log but don't error
        console.log(
          `[Webhook] Unknown event type, logging and returning 200: ${event}`
        );

        transaction.webhookEvents.push({
          event,
          receivedAt: new Date(),
          payload: data
        });

        await transaction.save();

        return res.status(200).json({ received: true });
      }
    } catch (error) {
      // Log the error but ALWAYS return 200 to Nomba
      console.error(`[Webhook] Processing error: ${error.message}`);
      console.error(error.stack);

      // Return 200 anyway - webhook is not the place for 5xx errors
      res.status(200).json({
        received: true,
        error: 'Processing error logged for investigation'
      });
    }
  }
);

module.exports = router;
