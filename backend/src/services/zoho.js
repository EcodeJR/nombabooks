const axios = require('axios');
const ZohoToken = require('../models/ZohoToken');

/**
 * Zoho Books service - all Zoho API interactions
 * Handles OAuth token refresh, invoice creation/retrieval, payment recording, and credit notes
 */

/**
 * Get valid access token, refreshing if necessary
 * Auto-refreshes if token expires within 5 minutes
 */
const getValidAccessToken = async () => {
  try {
    const tokenDoc = await ZohoToken.findOne();

    if (!tokenDoc) {
      console.error('[Zoho] No token document found');
      throw new Error(
        'Zoho not connected. Complete OAuth setup first.'
      );
    }

    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    // Check if token needs refresh
    if (tokenDoc.expiresAt <= expiryThreshold) {
      console.log('[Zoho] Token expiring soon, refreshing...');

      const response = await axios.post(
        'https://accounts.zoho.com/oauth/v2/token',
        {
          grant_type: 'refresh_token',
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          refresh_token: tokenDoc.refreshToken
        },
        {
          timeout: 10000
        }
      );

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('No access token in refresh response');
      }

      // Update token document
      tokenDoc.accessToken = access_token;
      tokenDoc.expiresAt = new Date(now.getTime() + expires_in * 1000);
      await tokenDoc.save();

      console.log('[Zoho] Token refreshed successfully');
      return access_token;
    }

    return tokenDoc.accessToken;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Zoho] Get valid token failed: ${message}`);
    throw new Error(`Failed to get Zoho access token: ${message}`);
  }
};

/**
 * Get invoice from Zoho Books
 */
const getInvoice = async (invoiceId) => {
  try {
    if (!invoiceId) {
      throw new Error('invoiceId is required');
    }

    const token = await getValidAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID;

    const response = await axios.get(
      `https://books.zoho.com/api/v3/invoices/${invoiceId}?organization_id=${orgId}`,
      {
        timeout: 10000,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[Zoho] Invoice retrieved: ${invoiceId}`);
    return response.data.invoice;
  } catch (error) {
    const statusCode = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (statusCode === 404) {
      console.error(`[Zoho] Invoice not found: ${invoiceId}`);
      throw {
        status: 404,
        message: 'Zoho invoice not found'
      };
    }

    console.error(`[Zoho] Get invoice failed: ${message}`);
    throw new Error(`Failed to get Zoho invoice: ${message}`);
  }
};

/**
 * Create invoice in Zoho Books
 */
const createInvoice = async ({
  customerEmail,
  customerName,
  amount,
  description
}) => {
  try {
    if (!customerEmail || !customerName || !amount) {
      throw new Error('Missing required parameters: customerEmail, customerName, amount');
    }

    const token = await getValidAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID;

    // First, try to get or create contact
    let contact = await getOrCreateContact({
      email: customerEmail,
      name: customerName
    });

    const response = await axios.post(
      `https://books.zoho.com/api/v3/invoices?organization_id=${orgId}`,
      {
        customer_id: contact.contact_id,
        line_items: [
          {
            item_name: description || 'Payment',
            quantity: 1,
            rate: String(amount)
          }
        ],
        notes: description || 'Invoice'
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const invoice = response.data.invoice;
    console.log(`[Zoho] Invoice created: ${invoice.invoice_id}`);

    return invoice;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Zoho] Create invoice failed: ${message}`);
    throw new Error(`Failed to create Zoho invoice: ${message}`);
  }
};

/**
 * Get or create a contact
 */
const getOrCreateContact = async ({ email, name }) => {
  try {
    const token = await getValidAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID;

    // Try to find existing contact
    const searchResponse = await axios.get(
      `https://books.zoho.com/api/v3/contacts?organization_id=${orgId}&email=${encodeURIComponent(
        email
      )}`,
      {
        timeout: 10000,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (
      searchResponse.data.contacts &&
      searchResponse.data.contacts.length > 0
    ) {
      console.log(`[Zoho] Contact found: ${email}`);
      return searchResponse.data.contacts[0];
    }

    // Create new contact
    const createResponse = await axios.post(
      `https://books.zoho.com/api/v3/contacts?organization_id=${orgId}`,
      {
        contact_name: name,
        email
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[Zoho] Contact created: ${email}`);
    return createResponse.data.contact;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Zoho] Get or create contact failed: ${message}`);
    throw new Error(`Failed to manage Zoho contact: ${message}`);
  }
};

/**
 * Mark invoice as paid
 */
const markInvoicePaid = async ({
  invoiceId,
  amount,
  paymentDate,
  paymentMode,
  transactionId
}) => {
  try {
    if (!invoiceId || !amount || !transactionId) {
      throw new Error('Missing required parameters: invoiceId, amount, transactionId');
    }

    const token = await getValidAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID;

    const response = await axios.post(
      `https://books.zoho.com/api/v3/customerpayments?organization_id=${orgId}`,
      {
        customer_id: '', // Will be populated by Zoho from invoice
        invoice_id: invoiceId,
        amount: String(amount),
        payment_mode: paymentMode || 'bank_transfer',
        reference_number: transactionId,
        payment_date: paymentDate || new Date().toISOString().split('T')[0]
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      `[Zoho] Invoice marked paid: ${invoiceId}`
    );
    return response.data.payment;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Zoho] Mark invoice paid failed: ${message}`);
    throw new Error(`Failed to mark Zoho invoice paid: ${message}`);
  }
};

/**
 * Create credit note (for refunds)
 */
const createCreditNote = async ({ invoiceId, amount, reason }) => {
  try {
    if (!invoiceId || !amount) {
      throw new Error('Missing required parameters: invoiceId, amount');
    }

    const token = await getValidAccessToken();
    const orgId = process.env.ZOHO_ORGANIZATION_ID;

    const response = await axios.post(
      `https://books.zoho.com/api/v3/creditnotes?organization_id=${orgId}`,
      {
        invoice_id: invoiceId,
        line_items: [
          {
            item_name: reason || 'Refund',
            quantity: 1,
            rate: String(amount)
          }
        ],
        notes: reason || 'Refund'
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      `[Zoho] Credit note created: ${response.data.creditnote?.creditnote_id}`
    );
    return response.data.creditnote;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Zoho] Create credit note failed: ${message}`);
    throw new Error(`Failed to create Zoho credit note: ${message}`);
  }
};

module.exports = {
  getValidAccessToken,
  getInvoice,
  createInvoice,
  getOrCreateContact,
  markInvoicePaid,
  createCreditNote
};
