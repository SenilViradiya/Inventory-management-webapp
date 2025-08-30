const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Shop = require('../models/Shop');

// Middleware to authenticate JWT tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Get user info from database with role populated
    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('role', 'name permissions')
      .populate('shop', 'name owner');
      
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    // Update last login
    await User.findByIdAndUpdate(decoded.id, { lastLogin: new Date() });

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
const requireRole = (roleName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.user.role || req.user.role.name !== roleName) {
      return res.status(403).json({ 
        message: `Access denied. ${roleName} role required.`,
        userRole: req.user.role?.name || 'no role',
        requiredRole: roleName
      });
    }

    next();
  };
};

// Middleware to require specific permission
const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // SuperAdmin has all permissions
    if (req.user.role && req.user.role.name === 'superadmin') {
      return next();
    }

    // Check role permissions
    const hasRolePermission = req.user.role && req.user.role.permissions.includes(permission);
    
    // Check user-specific permissions (for staff with custom permissions)
    const hasUserPermission = req.user.permissions && req.user.permissions.includes(permission);

    // Check shop staff permissions
    let hasShopPermission = false;
    if (req.user.shop) {
      const shop = await Shop.findById(req.user.shop._id);
      if (shop) {
        const staffMember = shop.staff.find(s => s.user.toString() === req.user.id);
        if (staffMember && staffMember.permissions.includes(permission)) {
          hasShopPermission = true;
        }
      }
    }

    if (!hasRolePermission && !hasUserPermission && !hasShopPermission) {
      return res.status(403).json({ 
        message: `Access denied. ${permission} permission required.`,
        userRole: req.user.role?.name || 'no role',
        requiredPermission: permission
      });
    }

    next();
  };
};

// Middleware to require admin or staff role (legacy support)
const requireStaffOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user.role || !['admin', 'staff', 'superadmin'].includes(req.user.role.name)) {
    return res.status(403).json({ 
      message: 'Access denied. Staff or Admin role required.',
      userRole: req.user.role?.name || 'no role'
    });
  }

  next();
};

// Middleware to check shop access
const requireShopAccess = (req, res, next) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const shopId = req.params.shopId || req.body.shopId || req.query.shopId;
    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // SuperAdmin has access to all shops
    if (req.user.role && req.user.role.name === 'superadmin') {
      return next();
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check if user is shop owner
    if (shop.owner.toString() === req.user.id) {
      req.userShopRole = 'owner';
      return next();
    }

    // Check if user is staff member
    const staffMember = shop.staff.find(s => s.user.toString() === req.user.id);
    if (staffMember) {
      req.userShopRole = 'staff';
      req.userShopPermissions = staffMember.permissions;
      return next();
    }

    return res.status(403).json({ message: 'Access denied to this shop' });
  };
};

// Middleware to check subscription limits
const checkSubscriptionLimits = (feature) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // SuperAdmin bypasses all limits
    if (req.user.role && req.user.role.name === 'superadmin') {
      return next();
    }

    const shopId = req.params.shopId || req.body.shopId || req.query.shopId || req.user.shop?._id;
    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    const shop = await Shop.findById(shopId).populate('subscription.plan');
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check subscription status
    if (!shop.isSubscriptionActive) {
      return res.status(403).json({ 
        message: 'Subscription expired or inactive',
        subscriptionStatus: shop.subscription.status
      });
    }

    // Feature-specific checks
    switch (feature) {
      case 'advanced_analytics':
        if (!shop.subscription.plan?.features?.advancedAnalytics) {
          return res.status(403).json({ 
            message: 'Advanced analytics requires a premium subscription' 
          });
        }
        break;
      
      case 'export_reports':
        if (!shop.subscription.plan?.features?.exportReports) {
          return res.status(403).json({ 
            message: 'Report exports require a premium subscription' 
          });
        }
        break;
      
      case 'api_access':
        if (!shop.subscription.plan?.features?.apiAccess) {
          return res.status(403).json({ 
            message: 'API access requires a premium subscription' 
          });
        }
        break;
    }

    next();
  };
};

// Middleware to require developer access (superadmin role)
const requireDeveloper = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user has superadmin role
    const roleName = req.user.role?.name || req.user.role;
    if (roleName !== 'superadmin') {
      return res.status(403).json({ 
        message: 'Developer access required. This endpoint is only accessible by system developers.' 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking developer access', error: error.message });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireStaffOrAdmin,
  requireShopAccess,
  checkSubscriptionLimits,
  requireDeveloper
};
