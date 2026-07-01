const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Nomba service - all Nomba API interactions
 * Handles token caching, checkout creation, transaction verification, refunds, and transfers
 */

let tokenCache = null;
let tokenExpiryTime = null;

/**
 * Determine the base URL based on NOMBA_ENV
 */
const getBaseUrl = () => {
  const env = process.env.NOMBA_ENV || 'sandbox';
  return env === 'sandbox' 
    ? 'https://sandbox.nomba.com' 
    : process.env.NOMBA_BASE_URL || 'https://api.nomba.com';
};

/**
 * Get or refresh Nomba auth token
 * Caches token and only re-fetches when expired
 */
const getNombaToken = async () => {
  const now = Date.now();

  // Return cached token if still valid
  if (tokenCache && tokenExpiryTime && now < tokenExpiryTime) {
    console.log('[Nomba] Using cached token');
    return tokenCache;
  }

  try {
    const baseUrl = getBaseUrl();
    const response = await axios.post(
      `${baseUrl}/v1/auth/token/issue`,
      {
        client_id: process.env.NOMBA_CLIENT_ID,
        client_secret: process.env.NOMBA_CLIENT_SECRET
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const { token, expiresIn } = response.data;

    if (!token) {
      throw new Error('No token received from Nomba');
    }

    // Cache token (expiry in milliseconds, reduced by 1 minute buffer)
    tokenCache = token;
    tokenExpiryTime = now + (expiresIn * 1000) - 60000;

    console.log('[Nomba] Token obtained and cached');
    return token;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Nomba] Token fetch failed: ${message}`);
    throw new Error(`Failed to get Nomba token: ${message}`);
  }
};

/**
 * Create a checkout order on Nomba
 */
const createCheckoutOrder = async ({
  amount,
  customerEmail,
  invoiceId,
  callbackUrl
}) => {
  try {
    if (!amount || !customerEmail || !invoiceId || !callbackUrl) {
      throw new Error('Missing required parameters: amount, customerEmail, invoiceId, callbackUrl');
    }

    const token = await getNombaToken();
    const baseUrl = getBaseUrl();
    const orderReference = uuidv4();

    const response = await axios.post(
      `${baseUrl}/v1/checkout/order`,
      {
        order: {
          orderReference,
          callbackUrl,
          customerEmail,
          amount: String(amount),
          currency: 'NGN'
        }
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const checkoutData = response.data;

    if (!checkoutData.checkoutLink) {
      throw new Error('No checkout link received from Nomba');
    }

    console.log(
      `[Nomba] Checkout order created: ${orderReference}`
    );

    return {
      checkoutLink: checkoutData.checkoutLink,
      orderReference
    };
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Nomba] Create checkout failed: ${message}`);
    throw new Error(`Failed to create Nomba checkout: ${message}`);
  }
};

/**
 * Verify transaction status
 */
const verifyTransaction = async (merchantTxRef) => {
  try {
    if (!merchantTxRef) {
      throw new Error('merchantTxRef is required');
    }

    const token = await getNombaToken();
    const baseUrl = getBaseUrl();

    const response = await axios.get(
      `${baseUrl}/v1/transactions/accounts?merchantTxRef=${encodeURIComponent(
        merchantTxRef
      )}`,
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      `[Nomba] Transaction verified: ${merchantTxRef}`
    );

    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Nomba] Verify transaction failed: ${message}`);
    throw new Error(`Failed to verify Nomba transaction: ${message}`);
  }
};

/**
 * Initiate a refund
 */
const initiateRefund = async ({ transactionId, amount, reason }) => {
  try {
    if (!transactionId || !amount) {
      throw new Error('Missing required parameters: transactionId, amount');
    }

    const token = await getNombaToken();
    const baseUrl = getBaseUrl();

    const response = await axios.post(
      `${baseUrl}/v1/refunds/initiate`,
      {
        transactionId,
        amount: String(amount),
        reason: reason || 'Customer refund request'
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      `[Nomba] Refund initiated for transaction: ${transactionId}`
    );

    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Nomba] Initiate refund failed: ${message}`);
    throw new Error(`Failed to initiate Nomba refund: ${message}`);
  }
};

/**
 * Transfer funds to a bank account
 */
const transferToBank = async ({
  amount,
  accountNumber,
  bankCode,
  accountName,
  narration
}) => {
  try {
    if (!amount || !accountNumber || !bankCode) {
      throw new Error('Missing required parameters: amount, accountNumber, bankCode');
    }

    const token = await getNombaToken();
    const baseUrl = getBaseUrl();

    const response = await axios.post(
      `${baseUrl}/v1/transfers/bank`,
      {
        amount: String(amount),
        accountNumber,
        bankCode,
        accountName,
        narration: narration || 'Transfer'
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      `[Nomba] Transfer initiated to ${accountNumber}`
    );

    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error(`[Nomba] Transfer to bank failed: ${message}`);
    throw new Error(`Failed to transfer to bank: ${message}`);
  }
};

module.exports = {
  getNombaToken,
  createCheckoutOrder,
  verifyTransaction,
  initiateRefund,
  transferToBank
};
