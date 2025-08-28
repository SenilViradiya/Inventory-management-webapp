const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Get user info from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Authentication error', error: error.message });
  }
};

// Middleware to require specific role
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        message: `Access denied. ${role} role required.`,
        userRole: req.user.role,
        requiredRole: role
      });
    }

    next();
  };
};

// Middleware to require admin or staff role
const requireStaffOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Access denied. Staff or Admin role required.',
      userRole: req.user.role
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireStaffOrAdmin
};
