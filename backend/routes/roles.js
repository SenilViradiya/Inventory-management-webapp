const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Role = require('../models/Role');
const User = require('../models/User');
const Shop = require('../models/Shop');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/roles - Get all roles
router.get('/', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true })
      .populate('createdBy', 'username fullName')
      .sort({ name: 1 });
    
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching roles', error: error.message });
  }
});

// POST /api/roles/create - Create new role (SuperAdmin only)
router.post('/create', authenticateToken, requireRole('superadmin'), [
  body('name').trim().notEmpty().withMessage('Role name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('permissions').isArray().withMessage('Permissions must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, permissions } = req.body;

    // Check if role already exists
    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return res.status(400).json({ message: 'Role already exists' });
    }

    const role = new Role({
      name: name.toLowerCase(),
      description,
      permissions,
      createdBy: req.user.id
    });

    await role.save();

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_ROLE',
      details: `Created role: ${name}`
    }).save();

    await role.populate('createdBy', 'username fullName');
    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ message: 'Error creating role', error: error.message });
  }
});

// POST /api/roles/assign - Assign role to user
router.post('/assign', authenticateToken, [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('roleId').isMongoId().withMessage('Valid role ID is required'),
  body('shopId').optional().isMongoId().withMessage('Valid shop ID is required for non-superadmin roles')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, roleId, shopId } = req.body;

    // Check permissions
    const user = await User.findById(req.user.id).populate('role');
    const targetUser = await User.findById(userId);
    const role = await Role.findById(roleId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Permission check based on current user role
    if (user.role.name === 'superadmin') {
      // SuperAdmin can assign any role
    } else if (user.role.name === 'admin') {
      // Admin can only assign staff roles and only to their shop
      if (role.name !== 'staff') {
        return res.status(403).json({ message: 'Admins can only assign staff roles' });
      }
      if (!shopId) {
        return res.status(400).json({ message: 'Shop ID is required' });
      }
      
      const shop = await Shop.findById(shopId);
      if (!shop || shop.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only assign roles in your own shop' });
      }
    } else {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Update user role
    await User.findByIdAndUpdate(userId, { role: roleId });

    // If assigning to shop, add to shop staff
    if (shopId && role.name === 'staff') {
      await Shop.findByIdAndUpdate(shopId, {
        $addToSet: {
          staff: {
            user: userId,
            role: roleId,
            permissions: role.permissions
          }
        }
      });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'ASSIGN_ROLE',
      details: `Assigned role ${role.name} to user ${targetUser.username}`
    }).save();

    res.json({ message: 'Role assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error assigning role', error: error.message });
  }
});

// PUT /api/roles/permissions/update - Update permissions for a role
router.put('/permissions/update', authenticateToken, requireRole('superadmin'), [
  body('roleId').isMongoId().withMessage('Valid role ID is required'),
  body('permissions').isArray().withMessage('Permissions must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roleId, permissions } = req.body;

    const role = await Role.findByIdAndUpdate(
      roleId,
      { permissions },
      { new: true }
    );

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_ROLE_PERMISSIONS',
      details: `Updated permissions for role: ${role.name}`
    }).save();

    res.json(role);
  } catch (error) {
    res.status(500).json({ message: 'Error updating permissions', error: error.message });
  }
});

// POST /api/roles/staff/add - Admin adds staff to their shop
router.post('/staff/add', authenticateToken, requireRole('admin'), [
  body('email').isEmail().withMessage('Valid email is required'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('permissions').isArray().withMessage('Permissions must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, fullName, permissions } = req.body;

    // Get admin's shop
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (!user) {
      // Create new user with temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const staffRole = await Role.findOne({ name: 'staff' });
      
      user = new User({
        username: email.split('@')[0],
        email,
        fullName,
        password: tempPassword, // This should be hashed in the User model
        role: staffRole._id,
        isEmailVerified: false
      });
      
      await user.save();
      
      // TODO: Send email with login credentials
    }

    // Add to shop staff
    await Shop.findByIdAndUpdate(shop._id, {
      $addToSet: {
        staff: {
          user: user._id,
          role: await Role.findOne({ name: 'staff' }),
          permissions
        }
      }
    });

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'ADD_STAFF',
      details: `Added staff member: ${fullName} to shop`
    }).save();

    res.status(201).json({ 
      message: 'Staff member added successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding staff', error: error.message });
  }
});

// DELETE /api/roles/staff/remove - Admin removes staff
router.delete('/staff/remove/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Get admin's shop
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Remove from shop staff
    await Shop.findByIdAndUpdate(shop._id, {
      $pull: {
        staff: { user: userId }
      }
    });

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'REMOVE_STAFF',
      details: `Removed staff member from shop`
    }).save();

    res.json({ message: 'Staff member removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing staff', error: error.message });
  }
});

// GET /api/roles/permissions/available - Get all available permissions
router.get('/permissions/available', authenticateToken, async (req, res) => {
  try {
    const permissions = [
      { key: 'view_inventory', name: 'View Inventory', description: 'Can view products and stock levels' },
      { key: 'edit_inventory', name: 'Edit Inventory', description: 'Can add, edit, and update products' },
      { key: 'delete_inventory', name: 'Delete Inventory', description: 'Can delete products' },
      { key: 'view_reports', name: 'View Reports', description: 'Can view analytics and reports' },
      { key: 'generate_reports', name: 'Generate Reports', description: 'Can generate and export reports' },
      { key: 'manage_staff', name: 'Manage Staff', description: 'Can add/remove staff members' },
      { key: 'view_analytics', name: 'View Analytics', description: 'Can access analytics dashboard' },
      { key: 'manage_orders', name: 'Manage Orders', description: 'Can create and manage orders' },
      { key: 'manage_suppliers', name: 'Manage Suppliers', description: 'Can manage supplier information' },
      { key: 'manage_categories', name: 'Manage Categories', description: 'Can create and edit product categories' }
    ];

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching permissions', error: error.message });
  }
});

module.exports = router;
