const express = require('express');
const NombaSettings = require('../models/NombaSettings');

const router = express.Router();

const maskValue = value => {
  if (!value) {
    return '';
  }

  if (value.length <= 4) {
    return '****';
  }

  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
};

router.get('/api/settings/nomba', async (req, res, next) => {
  try {
    const settings = await NombaSettings.findOne();

    res.json({
      connected: !!settings,
      clientId: settings?.clientId || '',
      accountId: settings?.accountId || '',
      hasClientSecret: !!settings?.clientSecret,
      maskedClientId: maskValue(settings?.clientId || ''),
      maskedAccountId: maskValue(settings?.accountId || '')
    });
  } catch (error) {
    next(error);
  }
});

router.post('/api/settings/nomba', async (req, res, next) => {
  try {
    const { clientId, clientSecret, accountId } = req.body;

    if (!clientId || !accountId) {
      return next({
        status: 400,
        message: 'clientId and accountId are required'
      });
    }

    const existing = await NombaSettings.findOne();

    const updatedSettings = await NombaSettings.findOneAndUpdate(
      {},
      {
        clientId: clientId.trim(),
        clientSecret: clientSecret ? clientSecret.trim() : existing?.clientSecret || '',
        accountId: accountId.trim()
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    console.log('[Settings] Nomba settings saved');

    res.json({
      success: true,
      connected: true,
      clientId: updatedSettings.clientId,
      accountId: updatedSettings.accountId,
      hasClientSecret: !!updatedSettings.clientSecret
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
