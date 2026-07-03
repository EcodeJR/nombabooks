const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const NombaSettings = require('../models/NombaSettings');

let tokenCache = null;
let tokenExpiryTime = null;

const isSandboxEnvironment = () => (process.env.NOMBA_ENV || 'sandbox') === 'sandbox';

const getBaseUrl = () => {
  return isSandboxEnvironment()
    ? 'https://sandbox.nomba.com'
    : process.env.NOMBA_BASE_URL || 'https://api.nomba.com';
};

const getNombaCredentials = async () => {
  const envClientId = process.env.NOMBA_CLIENT_ID || '';
  const envClientSecret = process.env.NOMBA_CLIENT_SECRET || '';
  const envAccountId = process.env.NOMBA_ACCOUNT_ID || '';

  if (envClientId && envClientSecret && envAccountId) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      accountId: envAccountId
    };
  }

  const savedSettings = await NombaSettings.findOne();

  if (!savedSettings) {
    throw new Error('Nomba settings are not configured. Save them in the dashboard first.');
  }

  return {
    clientId: savedSettings.clientId,
    clientSecret: savedSettings.clientSecret,
    accountId: savedSettings.accountId
  };
};

const getAuthHeaders = async () => {

  const token = await getNombaToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

const getNombaToken = async () => {

  const now = Date.now();
  if (tokenCache && tokenExpiryTime && now < tokenExpiryTime) {
    console.log('[Nomba] Using cached token');
    return tokenCache;
  }

  try {
    const baseUrl = getBaseUrl();
    const credentials = await getNombaCredentials();

    const response = await axios.post(
      `${baseUrl}/v1/auth/token/issue`,
      {
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        accountId: credentials.accountId
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const responseData = response.data?.data || response.data;
    const token = responseData?.token || responseData?.access_token;
    const expiresIn = responseData?.expiresIn || responseData?.expires_in || 3600;

    if (!token) {
      throw new Error('No token received from Nomba');
    }

    tokenCache = token;
    tokenExpiryTime = now + (Number(expiresIn) * 1000) - 60000;

    console.log('[Nomba] Token obtained and cached');
    return token;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.description || error.message;
    console.error(`[Nomba] Token fetch failed: ${message}`);
    throw new Error(`Failed to get Nomba token: ${message}`);
  }
};

const createCheckoutOrder = async ({ amount, customerEmail, invoiceId, callbackUrl }) => {
  try {
    if (!amount || !customerEmail || !invoiceId || !callbackUrl) {
      throw new Error('Missing required parameters: amount, customerEmail, invoiceId, callbackUrl');
    }

    const baseUrl = getBaseUrl();
    const orderReference = uuidv4();
    const headers = await getAuthHeaders();

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
        headers
      }
    );

    const checkoutData = response.data?.data || response.data;

    if (!checkoutData?.checkoutLink) {
      throw new Error('No checkout link received from Nomba');
    }

    console.log(`[Nomba] Checkout order created: ${orderReference}`);

    return {
      checkoutLink: checkoutData.checkoutLink,
      orderReference
    };
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.description || error.message;
    console.error(`[Nomba] Create checkout failed: ${message}`);
    throw new Error(`Failed to create Nomba checkout: ${message}`);
  }
};

const verifyTransaction = async merchantTxRef => {
  try {
    if (!merchantTxRef) {
      throw new Error('merchantTxRef is required');
    }

    const baseUrl = getBaseUrl();
    const headers = await getAuthHeaders();

    const response = await axios.get(
      `${baseUrl}/v1/transactions/accounts?merchantTxRef=${encodeURIComponent(merchantTxRef)}`,
      {
        timeout: 10000,
        headers
      }
    );

    console.log(`[Nomba] Transaction verified: ${merchantTxRef}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.description || error.message;
    console.error(`[Nomba] Verify transaction failed: ${message}`);
    throw new Error(`Failed to verify Nomba transaction: ${message}`);
  }
};

const initiateRefund = async ({ transactionId, amount, reason }) => {
  try {
    if (!transactionId || !amount) {
      throw new Error('Missing required parameters: transactionId, amount');
    }

    const baseUrl = getBaseUrl();
    const headers = await getAuthHeaders();

    const response = await axios.post(
      `${baseUrl}/v1/refunds/initiate`,
      {
        transactionId,
        amount: String(amount),
        reason: reason || 'Customer refund request'
      },
      {
        timeout: 10000,
        headers
      }
    );

    console.log(`[Nomba] Refund initiated for transaction: ${transactionId}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.description || error.message;
    console.error(`[Nomba] Initiate refund failed: ${message}`);
    throw new Error(`Failed to initiate Nomba refund: ${message}`);
  }
};

const transferToBank = async ({ amount, accountNumber, bankCode, accountName, narration }) => {
  try {
    if (!amount || !accountNumber || !bankCode) {
      throw new Error('Missing required parameters: amount, accountNumber, bankCode');
    }

    const baseUrl = getBaseUrl();
    const headers = await getAuthHeaders();

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
        headers
      }
    );

    console.log(`[Nomba] Transfer initiated to ${accountNumber}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.description || error.message;
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
