const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { Subscription, SubscriptionPlan } = require('../models/Subscription');
const Inquiry = require('../models/Inquiry');
const Order = require('../models/Order');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/superadmin/dashboard - SuperAdmin dashboard overview
router.get('/dashboard', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { period = 30 } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // User statistics
    const userStats = await User.aggregate([
      {
        $lookup: {
          from: 'roles',
          localField: 'role',
          foreignField: '_id',
          as: 'roleInfo'
        }
      },
      {
        $group: {
          _id: '$roleInfo.name',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    // Shop statistics
    const shopStats = await Shop.aggregate([
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    // Revenue statistics
    const revenueStats = await Subscription.aggregate([
      {
        $match: {
          status: 'active',
          currentPeriodStart: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            plan: '$plan',
            billingCycle: '$billingCycle'
          },
          totalRevenue: { $sum: '$payment.amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'subscriptionplans',
          localField: '_id.plan',
          foreignField: '_id',
          as: 'planInfo'
        }
      }
    ]);

    // Recent activity
    const recentActivity = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('userId', 'username fullName email');

    // Growth metrics
    const growthMetrics = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          newUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Inquiry statistics
    const inquiryStats = await Inquiry.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      userStats,
      shopStats,
      revenueStats,
      recentActivity,
      growthMetrics,
      inquiryStats,
      period: parseInt(period)
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
});

// GET /api/superadmin/users - Get all users with pagination
router.get('/users', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('role', 'name description')
      .populate('shop', 'name');

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

// GET /api/superadmin/revenue - Revenue analytics
router.get('/revenue', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { period = 90, groupBy = 'month' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    let dateFormat = '%Y-%m'; // month
    if (groupBy === 'day') dateFormat = '%Y-%m-%d';
    if (groupBy === 'year') dateFormat = '%Y';

    const revenueData = await Subscription.aggregate([
      {
        $match: {
          'payment.lastPaymentDate': { $gte: startDate },
          status: { $in: ['active', 'past_due'] }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: dateFormat, date: '$payment.lastPaymentDate' }
            },
            plan: '$plan'
          },
          revenue: { $sum: '$payment.amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'subscriptionplans',
          localField: '_id.plan',
          foreignField: '_id',
          as: 'planInfo'
        }
      },
      {
        $group: {
          _id: '$_id.date',
          totalRevenue: { $sum: '$revenue' },
          totalSubscriptions: { $sum: '$count' },
          breakdown: {
            $push: {
              plan: { $arrayElemAt: ['$planInfo.displayName', 0] },
              revenue: '$revenue',
              count: '$count'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Calculate MRR and ARR
    const activeSubscriptions = await Subscription.aggregate([
      {
        $match: {
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$billingCycle',
          totalRevenue: { $sum: '$payment.amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    let mrr = 0;
    let arr = 0;

    activeSubscriptions.forEach(sub => {
      if (sub._id === 'monthly') {
        mrr += sub.totalRevenue;
      } else if (sub._id === 'yearly') {
        mrr += sub.totalRevenue / 12;
      }
    });

    arr = mrr * 12;

    // Churn rate calculation (simplified)
    const totalActive = await Subscription.countDocuments({ status: 'active' });
    const recentlyCancelled = await Subscription.countDocuments({
      status: 'cancelled',
      cancelledAt: { $gte: startDate }
    });
    
    const churnRate = totalActive > 0 ? (recentlyCancelled / totalActive) * 100 : 0;

    res.json({
      revenueData,
      metrics: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        totalActiveSubscriptions: totalActive
      },
      period: parseInt(period),
      groupBy
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching revenue data', error: error.message });
  }
});

// GET /api/superadmin/expiring-subs - Get expiring subscriptions
router.get('/expiring-subs', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));

    const expiringSubscriptions = await Subscription.find({
      status: 'active',
      currentPeriodEnd: { $lte: expiryDate },
      cancelAtPeriodEnd: false
    })
    .populate('user', 'username email fullName')
    .populate('shop', 'name email phone')
    .populate('plan', 'displayName')
    .sort({ currentPeriodEnd: 1 });

    // Group by days until expiry
    const grouped = expiringSubscriptions.reduce((acc, sub) => {
      const daysUntilExpiry = Math.ceil((sub.currentPeriodEnd - new Date()) / (1000 * 60 * 60 * 24));
      const key = daysUntilExpiry <= 0 ? 'expired' : 
                  daysUntilExpiry <= 1 ? 'tomorrow' :
                  daysUntilExpiry <= 3 ? 'within_3_days' :
                  'within_week';
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(sub);
      return acc;
    }, {});

    res.json({
      subscriptions: expiringSubscriptions,
      grouped,
      total: expiringSubscriptions.length,
      daysThreshold: parseInt(days)
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching expiring subscriptions', error: error.message });
  }
});

// POST /api/superadmin/send-email - Send bulk email
router.post('/send-email', authenticateToken, requireRole('superadmin'), [
  body('recipients').isArray({ min: 1 }).withMessage('At least one recipient is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').isIn(['marketing', 'announcement', 'support', 'reminder']).withMessage('Valid email type required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipients, subject, message, type, template } = req.body;

    // In a real application, you would integrate with an email service like SendGrid, Mailgun, etc.
    // For now, we'll just log the email sending attempt

    const emailData = {
      recipients: recipients.length,
      subject,
      type,
      sentBy: req.user.id,
      sentAt: new Date()
    };

    // Log the email activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'SEND_BULK_EMAIL',
      details: `Sent ${type} email to ${recipients.length} recipients: ${subject}`
    }).save();

    // Simulate email sending
    console.log(`Sending email to ${recipients.length} recipients:`);
    console.log(`Subject: ${subject}`);
    console.log(`Type: ${type}`);
    console.log(`Message preview: ${message.substring(0, 100)}...`);

    res.json({
      message: 'Email sent successfully',
      emailsSent: recipients.length,
      sentAt: new Date()
    });

  } catch (error) {
    res.status(500).json({ message: 'Error sending email', error: error.message });
  }
});

// GET /api/superadmin/system-health - System health check
router.get('/system-health', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    // Database connection status
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Count various entities
    const counts = await Promise.all([
      User.countDocuments(),
      Shop.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Inquiry.countDocuments({ status: 'new' }),
      Order.countDocuments(),
    ]);

    // Recent errors from activity log
    const recentErrors = await ActivityLog.find({
      action: { $regex: 'ERROR', $options: 'i' },
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // last 24 hours
    }).limit(10);

    // System metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    };

    res.json({
      status: 'healthy',
      timestamp: new Date(),
      database: {
        status: dbStatus,
        collections: {
          users: counts[0],
          shops: counts[1],
          activeSubscriptions: counts[2],
          pendingInquiries: counts[3],
          totalOrders: counts[4]
        }
      },
      system: systemMetrics,
      recentErrors,
      checks: {
        database: dbStatus === 'connected',
        highMemoryUsage: systemMetrics.memory.heapUsed < 500 * 1024 * 1024, // 500MB
        errors: recentErrors.length < 10
      }
    });

  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      message: 'Error checking system health', 
      error: error.message 
    });
  }
});

// PUT /api/superadmin/user/:id/status - Update user status
router.put('/user/:id/status', authenticateToken, requireRole('superadmin'), [
  body('isActive').isBoolean().withMessage('isActive must be boolean'),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { isActive, reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).populate('role', 'name');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      details: `${isActive ? 'Activated' : 'Deactivated'} user ${user.username}${reason ? `: ${reason}` : ''}`
    }).save();

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });

  } catch (error) {
    res.status(500).json({ message: 'Error updating user status', error: error.message });
  }
});

module.exports = router;
