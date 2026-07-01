const express = require('express');
const { createCheckoutOrder } = require('../services/nomba');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * POST /api/checkout/create
 * Creates a Nomba checkout order for a Zoho invoice
 */
router.post('/api/checkout/create', async (req, res, next) => {
  try {
    const { zohoInvoiceId, customerEmail, amount, callbackUrl } = req.body;

    // Validate required fields
    if (!zohoInvoiceId || !customerEmail || !amount || !callbackUrl) {
      throw {
        status: 400,
        message: 'Missing required fields: zohoInvoiceId, customerEmail, amount, callbackUrl'
      };
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw {
        status: 400,
        message: 'amount must be a positive number'
      };
    }

    console.log(
      `[Checkout] Creating checkout for invoice: ${zohoInvoiceId}`
    );

    // Create Nomba checkout order
    const { checkoutLink, orderReference } = await createCheckoutOrder({
      amount,
      customerEmail,
      invoiceId: zohoInvoiceId,
      callbackUrl
    });

    // Save transaction record
    const transaction = new Transaction({
      nombaOrderReference: orderReference,
      zohoInvoiceId,
      customerEmail,
      amount,
      status: 'pending'
    });
    await transaction.save();

    console.log(
      `[Checkout] Checkout created successfully: ${orderReference}`
    );

    res.json({
      checkoutLink,
      orderReference
    });
  } catch (error) {
    // Handle specific Nomba errors
    if (error.message && error.message.includes('Nomba')) {
      return next({
        status: 502,
        message: error.message
      });
    }
    next(error);
  }
});

module.exports = router;
