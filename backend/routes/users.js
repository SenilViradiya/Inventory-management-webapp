const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// POST /api/users/signup - Public user registration (for initial setup)
router.post('/signup', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, fullName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists with this email or username' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if this is the first user (make them admin)
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'staff';

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      fullName,
      role
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role,
        shopId: user.shop,
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// POST /api/users - Create a new user (requires authentication and admin/superadmin role)
router.post('/', authenticateToken, (req, res, next) => {
  // Allow admin or superadmin roles
  if (!req.user || !req.user.role || (req.user.role.name !== 'admin' && req.user.role.name !== 'superadmin')) {
    return res.status(403).json({ 
      message: 'Access denied. Admin or SuperAdmin role required.',
      userRole: req.user?.role?.name || 'no role',
      requiredRole: ['admin', 'superadmin']
    });
  }
  next();
}, [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('role').optional().isIn(['admin', 'staff', 'superadmin', 'developer', 'tester', 'marketer', 'designer', 'manager']).withMessage('Invalid role'),
  body('organization').optional().isMongoId().withMessage('Invalid organization ID'),
  body('organizationRole').optional().trim(),
  body('phone').optional().trim(),
  body('department').optional().trim(),
  body('jobTitle').optional().trim(),
  body('dateOfJoining').optional().isISO8601().withMessage('Invalid date format'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      role = 'staff',
      organization,
      organizationRole,
      phone,
      department,
      jobTitle,
      dateOfJoining,
      emergencyContact,
      isActive = true
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email or username'
      });
    }

    // Find the role document
    const Role = require('../models/Role');
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(400).json({
        message: `Role '${role}' not found. Available roles: superadmin, admin, staff`
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Prepare user data
    const userData = {
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: roleDoc._id,
      organization,
      phone,
      department,
      jobTitle,
      dateOfJoining,
      emergencyContact,
      isActive
    };

    // Only set organizationRole if it's provided and valid
    if (organizationRole && organizationRole.trim() !== '') {
      userData.organizationRole = organizationRole;
    }

    // Create user
    const user = new User(userData);

    await user.save();

    // Log the activity (commented out for now - CREATE_USER not in ActivityLog enum)
    // await ActivityLog.create({
    //   userId: req.user.id,
    //   action: 'CREATE_USER',
    //   details: `Created user: ${username} (${email})`,
    //   ipAddress: req.ip,
    //   userAgent: req.get('User-Agent')
    // });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: user.organization,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// POST /api/users/register - Admin user registration
router.post('/register', authenticateToken, requireRole('admin'), [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('role').optional().isIn(['admin', 'staff']).withMessage('Role must be admin or staff')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, role = 'staff' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists with this email or username' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// POST /api/users/login - User login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role?.name || user.role,
        shopId: user.shop,
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Log the login activity
    await new ActivityLog({
      userId: user._id,
      action: 'LOGIN',
      details: 'User logged in',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }).save();

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role?.name || user.role,
        shopId: user.shop,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
});

// POST /api/users/logout - User logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log the logout activity
    await new ActivityLog({
      userId: req.user._id,
      action: 'LOGOUT',
      details: 'User logged out',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }).save();

    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ message: 'Error during logout', error: error.message });
  }
});

// GET /api/users/profile - Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      lastLogin: req.user.lastLogin,
      createdAt: req.user.createdAt
    }
  });
});

// PUT /api/users/profile - Update current user profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, username } = req.body;
    const updateData = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: req.user._id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateData.username = username;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// PUT /api/users/change-password - Change user password
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: error.message });
  }
});

// GET /api/users - Get all users (Admin, SuperAdmin, or Developer only)
router.get('/', authenticateToken, (req, res, next) => {
  // Allow admin, superadmin, or developer roles
  if (!req.user || !req.user.role || !['admin', 'superadmin', 'developer'].includes(req.user.role.name)) {
    return res.status(403).json({
      message: 'Access denied. Admin, SuperAdmin, or Developer role required.',
      userRole: req.user?.role?.name || 'no role',
      requiredRoles: ['admin', 'superadmin', 'developer']
    });
  }
  next();
}, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query;

    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// PUT /api/users/:id/toggle-status - Toggle user active status (Admin only)
router.put('/:id/toggle-status', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user status', error: error.message });
  }
});

// POST /api/users/:id/extend-trial - Extend user trial period (Developer only)
router.post('/:id/extend-trial', authenticateToken, requireRole('superadmin'), [
  body('days').isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { days } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate new trial end date
    const currentDate = new Date();
    const currentTrialEnd = user.trialEndDate || currentDate;
    const newTrialEnd = new Date(Math.max(currentTrialEnd.getTime(), currentDate.getTime()) + (days * 24 * 60 * 60 * 1000));

    // Update user trial
    user.trialEndDate = newTrialEnd;
    user.isTrialActive = true;
    await user.save();

    // Log the activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'extend_trial',
      details: {
        targetUserId: id,
        targetUserEmail: user.email,
        daysExtended: days,
        newTrialEndDate: newTrialEnd
      },
      timestamp: new Date()
    });

    res.json({
      message: `Trial extended by ${days} days successfully`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        trialEndDate: user.trialEndDate,
        isTrialActive: user.isTrialActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error extending trial', error: error.message });
  }
});

module.exports = router;
