const crypto = require('crypto');

/**
 * Middleware to validate Nomba webhook signature
 * Expects raw body for HMAC computation
 */
const validateWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-nomba-signature'];
  const secret = process.env.NOMBA_WEBHOOK_SECRET;

  if (!signature || !secret) {
    console.error('[ValidateWebhook] Missing signature or secret');
    return next({
      status: 401,
      message: 'Invalid webhook signature'
    });
  }

  try {
    // Compute HMAC SHA-256 of raw body using secret
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || '');

    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error(
        `[ValidateWebhook] Signature mismatch. Expected: ${signature}, Got: ${hash}`
      );
      return next({
        status: 401,
        message: 'Invalid webhook signature'
      });
    }

    // Parse the body for the route handler
    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      console.error('[ValidateWebhook] Failed to parse JSON body');
      return next({
        status: 400,
        message: 'Invalid JSON body'
      });
    }

    next();
  } catch (error) {
    console.error(`[ValidateWebhook] Error: ${error.message}`);
    next({
      status: 500,
      message: 'Webhook validation error'
    });
  }
};

module.exports = validateWebhookSignature;
