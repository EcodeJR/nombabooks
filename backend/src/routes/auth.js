const express = require('express');
const ZohoToken = require('../models/ZohoToken');
const axios = require('axios');

const router = express.Router();

/**
 * GET /zoho/auth
 * Initiates Zoho OAuth flow by redirecting to Zoho's authorization URL
 */
router.get('/zoho/auth', (req, res, next) => {
  try {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const redirectUri = process.env.ZOHO_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw {
        status: 500,
        message: 'Zoho OAuth configuration missing'
      };
    }

    const scope = encodeURIComponent('ZohoBooks.fullaccess.all');
    const authUrl =
      `https://accounts.zoho.com/oauth/v2/auth?` +
      `scope=${scope}` +
      `&client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&access_type=offline`;

    console.log('[Auth] Redirecting to Zoho OAuth');
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /zoho/callback
 * Handles Zoho OAuth callback, exchanges code for tokens
 */
router.get('/zoho/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;

    if (error) {
      throw {
        status: 400,
        message: `Zoho OAuth error: ${error}`
      };
    }

    if (!code) {
      throw {
        status: 400,
        message: 'No authorization code received from Zoho'
      };
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: process.env.ZOHO_REDIRECT_URI,
      code: String(code)
    });

    // Exchange code for tokens using Zoho's required form-encoded payload
    const response = await axios.post(
      'https://accounts.zoho.com/oauth/v2/token',
      tokenBody,
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json'
        }
      }
    );
    console.log('Zoho token response status:', response.status);
    console.log('Zoho token response body:', response.data);

    const { access_token, refresh_token, expires_in } = response.data;

    if (!access_token || !refresh_token) {
      throw {
        status: 500,
        message: 'Invalid token response from Zoho'
      };
    }

    // Store tokens in database (upsert)
    await ZohoToken.deleteMany({}); // Remove any existing tokens
    const tokenDoc = new ZohoToken({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
      organizationId: process.env.ZOHO_ORGANIZATION_ID
    });
    await tokenDoc.save();

    console.log('[Auth] Zoho tokens stored successfully');

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}?zoho_connected=true`);
  } catch (error) {
    const zohoMessage =
      error.response?.data?.error_description ||
      error.response?.data?.error ||
      error.message;

    console.error(`[Auth] Zoho callback failed: ${zohoMessage}`);
    
    next({
      status: error.response?.status || 500,
      message: `Zoho OAuth callback failed: ${zohoMessage}`
    });
  }
});

/**
 * GET /api/auth/zoho/status
 * Check if Zoho is connected
 */
router.get('/api/auth/zoho/status', async (req, res, next) => {
  try {
    const tokenDoc = await ZohoToken.findOne();
    const connected = !!tokenDoc;

    console.log(`[Auth] Zoho connection status: ${connected}`);
    res.json({ connected });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
