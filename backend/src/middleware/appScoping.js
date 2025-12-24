const { errors } = require('../utils/errorHandler');
const Application = require('../models/Application');

/**
 * Middleware to validate X-App-Id and X-App-Secret
 */
const validateApp = async (req, res, next) => {
  const appId = req.headers['x-app-id'];
  const appSecret = req.headers['x-app-secret'];

  if (!appId) {
    return errors.badRequest(res, 'X-App-Id header is required');
  }

  try {
    const app = await Application.findOne({ appId, status: 'active' });
    if (!app) {
      return errors.forbidden(res, 'Invalid or inactive application');
    }

    // Optional: Secret validation for non-user-facing APIs
    if (appSecret && app.secretKey !== appSecret) {
      return errors.forbidden(res, 'Invalid app secret');
    }

    req.appContext = app;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { validateApp };
