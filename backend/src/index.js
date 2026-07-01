require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const ZohoToken = require('./models/ZohoToken');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const validateWebhook = require('./middleware/validateWebhook');

// Import routes
const authRoutes = require('./routes/auth');
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhooks');
const refundRoutes = require('./routes/refunds');
const transactionRoutes = require('./routes/transactions');

const app = express();

/**
 * STARTUP VALIDATION
 */
const validateEnvVars = () => {
  const required = [
    'NOMBA_CLIENT_ID',
    'NOMBA_CLIENT_SECRET',
    'NOMBA_ACCOUNT_ID',
    'MONGODB_URI',
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET',
    'ZOHO_REDIRECT_URI'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `[Startup] ⚠️  Missing environment variables: ${missing.join(
        ', '
      )}`
    );
    console.warn(
      '[Startup] ⚠️  Some features may not work until configuration is complete.'
    );
  }

  console.log('[Startup] Environment variables validated');
};

/**
 * MIDDLEWARE REGISTRATION
 * Order is critical: raw parser for webhooks, json for everything else, then routes
 */

// Health check (before any body parser)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Raw body parser for webhook signature validation
// Must be BEFORE json parser for the specific webhook route
app.post(
  '/api/webhooks/nomba',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

// JSON parser for all other routes
app.use(express.json());

// CORS - allow frontend URL only
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  })
);

// API Routes
app.use(authRoutes);
app.use(checkoutRoutes);
app.use(refundRoutes);
app.use(transactionRoutes);

// 404 handler for unmatched routes
app.use((req, res, next) => {
  next({
    status: 404,
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// Global error handler (MUST be last)
app.use(errorHandler);

/**
 * START SERVER
 */
const startServer = async () => {
  try {
    validateEnvVars();

    // Connect to MongoDB
    await connectDB();

    // Check Zoho connection status
    const zohoConnected = await ZohoToken.findOne();
    if (!zohoConnected) {
      console.log(
        '[Startup] ⚠️  Zoho not connected. Visit /zoho/auth to complete setup.'
      );
    } else {
      console.log('[Startup] ✓ Zoho token found');
    }

    // Log active environment
    const nombaEnv = process.env.NOMBA_ENV || 'sandbox';
    console.log(`[Startup] ✓ Nomba environment: ${nombaEnv}`);

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`✓ NombaBooks Backend Server Ready`);
      console.log(`  Port: ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV}`);
      console.log(`  Nomba: ${nombaEnv}`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error(`[Startup] Failed to start server: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
};

startServer();

module.exports = app;
