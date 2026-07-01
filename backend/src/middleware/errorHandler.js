/**
 * Global error handler middleware
 * Must be registered as the last middleware in the Express app
 */
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  console.error(
    `[${new Date().toISOString()}] ${status} - ${message}`
  );

  if (err.stack) {
    console.error(`[${new Date().toISOString()}] Stack: ${err.stack}`);
  }

  res.status(status).json({
    error: message,
    status
  });
};

module.exports = errorHandler;
