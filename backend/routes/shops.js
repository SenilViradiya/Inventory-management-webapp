const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const User = require('../models/User');
const { authenticateToken, requireDeveloper } = require('../middleware/auth');

// Middleware to check if user is developer/superadmin
const isDeveloper = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('role');
    if (!user) {
      return res.status(403).json({ message: 'User not found.' });
    }

    // Allow superadmin, developer, and admin users
    const allowedRoles = ['superadmin', 'developer', 'admin'];
    const hasPermission = allowedRoles.includes(user.role.name) ||
      (user.permissions && user.permissions.includes('system:admin'));

    if (!hasPermission) {
      return res.status(403).json({
        message: 'Access denied. Developer/Admin privileges required.',
        userRole: user.role.name,
        userPermissions: user.permissions || []
      });
    }
    next();
  } catch (error) {
    console.error('isDeveloper middleware error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all shops (Developer only) - replaces GET /businesses
router.get('/', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const shops = await Shop.find()
      .populate('createdBy', 'username email firstName lastName')
      .populate('users', 'username email firstName lastName role isActive')
      .populate('owner.userId', 'username email firstName lastName')
      .sort({ createdAt: -1 });

    const shopStats = {
      total: shops.length,
      active: shops.filter(s => s.status === 'active').length,
      trial: shops.filter(s => s.subscription.plan === 'trial').length,
      expired: shops.filter(s => new Date() > (s.subscription.endDate || s.subscription.expiryDate)).length
    };

    res.json({
      shops,
      businesses: shops, // For backward compatibility
      stats: shopStats
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new shop - replaces POST /businesses
router.post('/', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const {
      name,
      owner,
      address,
      organizationType,
      description,
      website,
      industry,
      availableRoles,
      subscription,
      settings
    } = req.body;

    // Support both old format (ownerName, ownerEmail, ownerPhone) and new format (owner object)
    const ownerData = owner || {
      name: req.body.ownerName,
      email: req.body.ownerEmail,
      phone: req.body.ownerPhone
    };

    // Validate required fields
    if (!name || !ownerData.name || !ownerData.email) {
      return res.status(400).json({
        message: 'Shop name, owner name, and owner email are required'
      });
    }

    // Check if shop with this email already exists
    const existingShop = await Shop.findOne({ 'owner.email': ownerData.email });
    if (existingShop) {
      return res.status(400).json({ message: 'Shop with this email already exists' });
    }

    // Find or create user for the owner
    let ownerUser = await User.findOne({ email: ownerData.email });
    if (!ownerUser) {
      // Create a basic user record for the owner
      ownerUser = new User({
        username: ownerData.email,
        email: ownerData.email,
        firstName: ownerData.name.split(' ')[0],
        lastName: ownerData.name.split(' ').slice(1).join(' ') || '',
        phone: ownerData.phone,
        isActive: true
      });
      await ownerUser.save();
    }

    // Set default subscription end date (30 days from now)
    const subscriptionEndDate = subscription?.endDate ?
      new Date(subscription.endDate) :
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const shop = new Shop({
      name,
      owner: {
        name: ownerData.name,
        email: ownerData.email,
        phone: ownerData.phone,
        userId: ownerUser._id
      },
      address: address || {},
      organizationType: organizationType || 'client-organization',
      description,
      website,
      industry,
      availableRoles: availableRoles || ['staff', 'admin'],
      subscription: {
        plan: subscription?.plan || 'trial',
        status: subscription?.status || 'active',
        startDate: subscription?.startDate || new Date(),
        endDate: subscriptionEndDate,
        expiryDate: subscriptionEndDate,
        isActive: subscription?.isActive !== false,
        trialExtensions: subscription?.trialExtensions || 0,
        paymentId: subscription?.paymentId,
        customerId: subscription?.customerId
      },
      settings: {
        maxUsers: settings?.maxUsers || 5,
        maxProducts: settings?.maxProducts || 100,
        features: settings?.features || ['inventory_management'],
        lowStockThreshold: settings?.lowStockThreshold || 10,
        currency: settings?.currency || 'USD',
        timezone: settings?.timezone || 'UTC',
        notifications: settings?.notifications || {
          lowStock: true,
          expiredProducts: true,
          newOrders: true
        }
      },
      users: [ownerUser._id],
      createdBy: req.user.id
    });

    await shop.save();

    // Populate the response
    await shop.populate('createdBy', 'username email firstName lastName');
    await shop.populate('users', 'username email firstName lastName role isActive');
    await shop.populate('owner.userId', 'username email firstName lastName');

    res.status(201).json({
      message: 'Shop created successfully',
      shop,
      business: shop // For backward compatibility
    });
  } catch (error) {
    console.error('Error creating shop:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get shop by ID - replaces GET /businesses/:id
router.get('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate('createdBy', 'username email firstName lastName')
      .populate('users', 'username email firstName lastName role isActive')
      .populate('owner.userId', 'username email firstName lastName');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({
      shop,
      business: shop // For backward compatibility
    });
  } catch (error) {
    console.error('Error fetching shop:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update shop - replaces PUT /businesses/:id
router.put('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const shopId = req.params.id;
    const updates = req.body;

    // Handle owner updates
    if (updates.owner) {
      const ownerData = updates.owner;
      let ownerUser = await User.findOne({ email: ownerData.email });
      
      if (!ownerUser && ownerData.email) {
        ownerUser = new User({
          username: ownerData.email,
          email: ownerData.email,
          firstName: ownerData.name?.split(' ')[0] || '',
          lastName: ownerData.name?.split(' ').slice(1).join(' ') || '',
          phone: ownerData.phone,
          isActive: true
        });
        await ownerUser.save();
      }

      if (ownerUser) {
        updates.owner.userId = ownerUser._id;
      }
    }

    const shop = await Shop.findByIdAndUpdate(
      shopId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'username email firstName lastName')
      .populate('users', 'username email firstName lastName role isActive')
      .populate('owner.userId', 'username email firstName lastName');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({
      message: 'Shop updated successfully',
      shop,
      business: shop // For backward compatibility
    });
  } catch (error) {
    console.error('Error updating shop:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete shop - replaces DELETE /businesses/:id
router.delete('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const shop = await Shop.findByIdAndDelete(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({ message: 'Shop deleted successfully' });
  } catch (error) {
    console.error('Error deleting shop:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get shop statistics - replaces GET /businesses/stats
router.get('/stats/overview', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const totalShops = await Shop.countDocuments();
    const activeShops = await Shop.countDocuments({ status: 'active' });
    const trialShops = await Shop.countDocuments({ 'subscription.plan': 'trial' });
    const expiredShops = await Shop.countDocuments({
      $or: [
        { 'subscription.endDate': { $lt: new Date() } },
        { 'subscription.expiryDate': { $lt: new Date() } }
      ]
    });

    // Get shops by organization type
    const myOrganizations = await Shop.countDocuments({ organizationType: 'my-organization' });
    const clientOrganizations = await Shop.countDocuments({ organizationType: 'client-organization' });

    // Get shops by subscription plan
    const planStats = await Shop.aggregate([
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      total: totalShops,
      active: activeShops,
      trial: trialShops,
      expired: expiredShops,
      organizationTypes: {
        myOrganizations,
        clientOrganizations
      },
      planDistribution: planStats
    });
  } catch (error) {
    console.error('Error fetching shop statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
