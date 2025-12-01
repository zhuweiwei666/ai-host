function errorHandler(err, _req, res, _next) {
  console.error('[AI Wallet] Unhandled error:', err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({
    code: 500,
    msg: err.message || 'Server error'
  });
}

module.exports = errorHandler;