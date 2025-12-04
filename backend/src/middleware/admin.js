/**
 * Admin Authorization Middleware
 * Requires user to have admin role
 * Must be used after requireAuth middleware
 */

const { errors } = require('../utils/errorHandler');

const requireAdmin = (req, res, next) => {
  // Check if user is authenticated (should be set by requireAuth)
  if (!req.user) {
    return errors.unauthorized(res);
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return errors.adminRequired(res);
  }

  next();
};

module.exports = {
  requireAdmin
};

