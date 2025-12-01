/**
 * Admin Authorization Middleware
 * Requires user to have admin role
 * Must be used after requireAuth middleware
 */

const requireAdmin = (req, res, next) => {
  // Check if user is authenticated (should be set by requireAuth)
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Admin access required',
      code: 'FORBIDDEN'
    });
  }

  next();
};

module.exports = {
  requireAdmin
};

