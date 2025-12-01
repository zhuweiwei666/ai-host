/**
 * Authentication Middleware
 * Verifies JWT token and injects userId into req.user.id
 */

const jwt = require('jsonwebtoken');

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
      // For development: allow mock token or skip auth
      // In production, this should return 401
      if (process.env.NODE_ENV === 'development' && req.headers['x-mock-user-id']) {
        req.user = {
          id: req.headers['x-mock-user-id'],
          role: req.headers['x-mock-user-role'] || 'user'
        };
        return next();
      }
      
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
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
      return res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
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
    } else if (process.env.NODE_ENV === 'development' && req.headers['x-mock-user-id']) {
      req.user = {
        id: req.headers['x-mock-user-id'],
        role: req.headers['x-mock-user-role'] || 'user'
      };
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

