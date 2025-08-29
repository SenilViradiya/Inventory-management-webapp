const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// POST /api/inquiries/submit - Submit inquiry (public endpoint)
router.post('/submit', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
  body('type').optional().isIn(['general', 'support', 'sales', 'technical', 'billing', 'feature_request'])
    .withMessage('Invalid inquiry type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      email,
      phone,
      company,
      subject,
      message,
      type = 'general'
    } = req.body;

    // Check if user exists (for authenticated inquiries)
    let user = null;
    if (req.user) {
      user = req.user.id;
    } else {
      // Check if email belongs to existing user
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        user = existingUser._id;
      }
    }

    // Capture metadata from request
    const metadata = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      referrer: req.get('Referrer')
    };

    const inquiry = new Inquiry({
      name,
      email,
      phone,
      company,
      subject,
      message,
      type,
      user,
      metadata,
      source: 'website'
    });

    await inquiry.save();

    // Send notification to SuperAdmin (in a real app, you'd use email/webhook)
    console.log(`New inquiry received from ${name} (${email}): ${subject}`);

    res.status(201).json({
      message: 'Inquiry submitted successfully',
      inquiryId: inquiry._id
    });

  } catch (error) {
    res.status(500).json({ message: 'Error submitting inquiry', error: error.message });
  }
});

// GET /api/inquiries/list - List inquiries (SuperAdmin only)
router.get('/list', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      priority,
      assignedTo,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const inquiries = await Inquiry.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username fullName email')
      .populate('assignedTo', 'username fullName')
      .populate('responses.respondedBy', 'username fullName');

    const total = await Inquiry.countDocuments(filter);

    // Get summary statistics
    const summary = await Inquiry.aggregate([
      {
        $group: {
          _id: null,
          totalInquiries: { $sum: 1 },
          newInquiries: {
            $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] }
          },
          inProgressInquiries: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          resolvedInquiries: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$firstResponseTime' },
          avgResolutionTime: { $avg: '$resolutionTime' }
        }
      }
    ]);

    res.json({
      inquiries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      summary: summary[0] || {
        totalInquiries: 0,
        newInquiries: 0,
        inProgressInquiries: 0,
        resolvedInquiries: 0,
        avgResponseTime: 0,
        avgResolutionTime: 0
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching inquiries', error: error.message });
  }
});

// GET /api/inquiries/:id - Get inquiry details
router.get('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .populate('user', 'username fullName email')
      .populate('assignedTo', 'username fullName')
      .populate('responses.respondedBy', 'username fullName')
      .populate('resolvedBy', 'username fullName');

    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    res.json(inquiry);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching inquiry', error: error.message });
  }
});

// POST /api/inquiries/:id/respond - Respond to inquiry
router.post('/:id/respond', authenticateToken, requireRole('superadmin'), [
  body('message').trim().notEmpty().withMessage('Response message is required'),
  body('isInternal').optional().isBoolean().withMessage('isInternal must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, isInternal = false } = req.body;
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    // Add response
    const response = {
      message,
      respondedBy: req.user.id,
      respondedAt: new Date(),
      isInternal
    };

    const updateData = {
      $push: { responses: response }
    };

    // Update status if this is the first response
    if (inquiry.status === 'new') {
      updateData.status = 'in_progress';
      updateData.assignedTo = req.user.id;
    }

    const updatedInquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('responses.respondedBy', 'username fullName');

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'RESPOND_INQUIRY',
      details: `Responded to inquiry from ${inquiry.name}: ${inquiry.subject}`
    }).save();

    // In a real app, send email to customer if not internal
    if (!isInternal) {
      console.log(`Email would be sent to ${inquiry.email} with response: ${message}`);
    }

    res.json(updatedInquiry);

  } catch (error) {
    res.status(500).json({ message: 'Error responding to inquiry', error: error.message });
  }
});

// PUT /api/inquiries/:id/status - Update inquiry status
router.put('/:id/status', authenticateToken, requireRole('superadmin'), [
  body('status').isIn(['new', 'in_progress', 'resolved', 'closed']).withMessage('Valid status required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Valid priority required'),
  body('assignedTo').optional().isMongoId().withMessage('Valid user ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, priority, assignedTo } = req.body;
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo) updateData.assignedTo = assignedTo;

    // Set resolved timestamp
    if (status === 'resolved' && inquiry.status !== 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.user.id;
    }

    const updatedInquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('assignedTo', 'username fullName');

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_INQUIRY',
      details: `Updated inquiry ${inquiry._id} status to ${status}`
    }).save();

    res.json(updatedInquiry);

  } catch (error) {
    res.status(500).json({ message: 'Error updating inquiry', error: error.message });
  }
});

// POST /api/inquiries/:id/satisfaction - Submit satisfaction rating
router.post('/:id/satisfaction', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating, feedback } = req.body;
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    if (inquiry.status !== 'resolved') {
      return res.status(400).json({ message: 'Can only rate resolved inquiries' });
    }

    await Inquiry.findByIdAndUpdate(req.params.id, {
      satisfaction: {
        rating,
        feedback,
        submittedAt: new Date()
      }
    });

    res.json({ message: 'Thank you for your feedback!' });

  } catch (error) {
    res.status(500).json({ message: 'Error submitting satisfaction rating', error: error.message });
  }
});

// GET /api/inquiries/analytics/summary - Get inquiry analytics
router.get('/analytics/summary', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { period = 30 } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const analytics = await Inquiry.aggregate([
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
                closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } }
              }
            }
          ],
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 }
              }
            }
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 }
              }
            }
          ],
          recentTrend: [
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
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    res.json(analytics[0]);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching inquiry analytics', error: error.message });
  }
});

module.exports = router;
