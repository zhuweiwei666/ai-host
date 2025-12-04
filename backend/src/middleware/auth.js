/**
 * Authentication Middleware
 * Verifies JWT token and injects userId into req.user.id
 */

const jwt = require('jsonwebtoken');
const { errors } = require('../utils/errorHandler');

/**
 * Require authentication middleware
 * Verifies JWT token from Authorization header
 * Injects userId into req.user.id
 */
const requireAuth = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Allow mock header in development or if ENABLE_MOCK_AUTH is set
      const allowMockAuth = process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_AUTH === 'true';
      
      if (allowMockAuth && req.headers['x-mock-user-id']) {
        req.user = {
          id: req.headers['x-mock-user-id'],
          role: req.headers['x-mock-user-role'] || 'user'
        };
        return next();
      }
      
      return errors.unauthorized(res);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, secret);
    
    // Inject user info into request
    req.user = {
      id: decoded.userId || decoded.id,
      role: decoded.role || 'user'
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errors.invalidToken(res);
    }
    
    if (error.name === 'TokenExpiredError') {
      return errors.tokenExpired(res);
    }
    
    console.error('Auth middleware error:', error);
    return errors.internalError(res, 'Authentication error', { error: error.message });
  }
};

/**
 * Optional auth middleware
 * Tries to authenticate but doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const decoded = jwt.verify(token, secret);
      
      req.user = {
        id: decoded.userId || decoded.id,
        role: decoded.role || 'user'
      };
    } else {
      // Allow mock header in development or if ENABLE_MOCK_AUTH is set
      const allowMockAuth = process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_AUTH === 'true';
      if (allowMockAuth && req.headers['x-mock-user-id']) {
        req.user = {
          id: req.headers['x-mock-user-id'],
          role: req.headers['x-mock-user-role'] || 'user'
        };
      }
    }
    
    next();
  } catch (error) {
    // Ignore auth errors in optional auth
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth
};

