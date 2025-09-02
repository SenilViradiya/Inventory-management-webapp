const express = require('express');
const router = express.Router();
const Business = require('../models/Business');
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

// Get all businesses (Developer only)
router.get('/', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const businesses = await Business.find()
      .populate('createdBy', 'username email firstName lastName')
      .populate('users', 'username email firstName lastName role isActive')
      .sort({ createdAt: -1 });

    const businessStats = {
      total: businesses.length,
      active: businesses.filter(b => b.status === 'active').length,
      trial: businesses.filter(b => b.subscription.plan === 'trial').length,
      expired: businesses.filter(b => new Date() > b.subscription.endDate).length
    };

    res.json({
      businesses,
      stats: businessStats
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new business
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
        message: 'Business name, owner name, and owner email are required'
      });
    }

    // Check if business with this email already exists
    const existingBusiness = await Business.findOne({ 'owner.email': ownerData.email });
    if (existingBusiness) {
      return res.status(400).json({ message: 'Business with this email already exists' });
    }

    // Set default subscription end date (30 days from now)
    const subscriptionEndDate = subscription?.endDate ?
      new Date(subscription.endDate) :
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const business = new Business({
      name,
      owner: {
        name: ownerData.name,
        email: ownerData.email,
        phone: ownerData.phone || ''
      },
      address: address || {},
      organizationType: organizationType || 'client-organization',
      description: description || '',
      website: website || '',
      industry: industry || '',
      availableRoles: availableRoles || (organizationType === 'my-organization'
        ? ['developer', 'tester', 'marketer', 'designer', 'manager', 'admin', 'superadmin']
        : ['staff', 'admin']),
      subscription: {
        plan: subscription?.plan || 'trial',
        startDate: subscription?.startDate || new Date(),
        endDate: subscriptionEndDate,
        isActive: true,
        trialExtensions: 0
      },
      settings: {
        maxUsers: settings?.maxUsers || 5,
        maxProducts: settings?.maxProducts || 100,
        features: settings?.features || ['inventory_management', 'qr_scanning']
      },
      status: 'active',
      createdBy: req.user.id
    });

    await business.save();

    const populatedBusiness = await Business.findById(business._id)
      .populate('createdBy', 'username email firstName lastName')
      .populate('users', 'username email firstName lastName role isActive');

    res.status(201).json({
      message: 'Business created successfully',
      business: populatedBusiness
    });
  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single business by ID
router.get('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;

    const business = await Business.findById(id)
      .populate('createdBy', 'username email firstName lastName')
      .populate('users', 'username email firstName lastName role organizationRole isActive lastLogin');

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json({
      business
    });
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update business
router.put('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdAt;
    delete updates.createdBy;

    // Update timestamp
    updates.updatedAt = new Date();

    const business = await Business.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'username email firstName lastName')
      .populate('users', 'username email firstName lastName role organizationRole isActive');

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json({
      message: 'Business updated successfully',
      business
    });
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Extend trial period
router.post('/:id/extend-trial', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (!days || days < 1 || days > 365) {
      return res.status(400).json({ message: 'Invalid extension period. Must be between 1-365 days.' });
    }

    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // Extend the end date
    const currentEndDate = new Date(business.subscription.endDate);
    const newEndDate = new Date(currentEndDate.getTime() + (days * 24 * 60 * 60 * 1000));

    business.subscription.endDate = newEndDate;
    business.subscription.trialExtensions += 1;

    await business.save();

    res.json({
      message: `Trial extended by ${days} days`,
      business,
      newEndDate
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete business
router.delete('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;
    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    await Business.findByIdAndDelete(id);
    res.json({ message: 'Business deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete business
router.delete('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;

    const business = await Business.findByIdAndDelete(id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json({ message: 'Business deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard stats for developer
router.get('/stats/dashboard', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const [
      totalBusinesses,
      activeBusinesses,
      trialBusinesses,
      expiredBusinesses,
      recentBusinesses
    ] = await Promise.all([
      Business.countDocuments(),
      Business.countDocuments({ status: 'active' }),
      Business.countDocuments({ 'subscription.plan': 'trial' }),
      Business.countDocuments({ 'subscription.endDate': { $lt: now } }),
      Business.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
    ]);

    const totalUsers = await User.countDocuments();

    res.json({
      businesses: {
        total: totalBusinesses,
        active: activeBusinesses,
        trial: trialBusinesses,
        expired: expiredBusinesses,
        recentlyAdded: recentBusinesses
      },
      users: {
        total: totalUsers
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create user within a specific organization
router.post('/:id/users', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, firstName, lastName, organizationRole } = req.body;

    // Find the business/organization
    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Validate role against available roles for this organization
    if (!business.availableRoles.includes(organizationRole)) {
      return res.status(400).json({
        message: `Role '${organizationRole}' not available for this organization type`,
        availableRoles: business.availableRoles
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email or username already exists'
      });
    }

    // Create the user
    const bcrypt = require('bcryptjs');
    const Role = require('../models/Role');

    const hashedPassword = await bcrypt.hash(password, 10);

    // Find appropriate system role
    let systemRole = await Role.findOne({ name: 'staff' }); // Default
    if (organizationRole === 'admin' || organizationRole === 'manager') {
      systemRole = await Role.findOne({ name: 'admin' });
    } else if (organizationRole === 'superadmin') {
      systemRole = await Role.findOne({ name: 'superadmin' });
    }

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: systemRole._id,
      organization: business._id,
      organizationRole,
      isEmailVerified: true,
      isActive: true
    });

    await newUser.save();

    // Add user to business users array
    business.users.push(newUser._id);
    await business.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        organizationRole: newUser.organizationRole,
        organization: business.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Get users for a specific organization
router.get('/:id/users', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;

    const business = await Business.findById(id);
    if (!business) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const users = await User.find({ organization: id })
      .populate('role', 'name')
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      organization: {
        id: business._id,
        name: business.name,
        type: business.organizationType,
        availableRoles: business.availableRoles
      },
      users
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update business/organization
router.put('/:id', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const business = await Business.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json({
      message: 'Business updated successfully',
      business
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating business', error: error.message });
  }
});

module.exports = router;
