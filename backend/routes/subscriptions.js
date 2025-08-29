const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { SubscriptionPlan, Subscription } = require('../models/Subscription');
const Shop = require('../models/Shop');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/subscriptions/plans - List available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1, price: 1 });
    
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subscription plans', error: error.message });
  }
});

// POST /api/subscriptions/subscribe - User subscribes to a plan
router.post('/subscribe', authenticateToken, [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('billingCycle').isIn(['monthly', 'yearly']).withMessage('Billing cycle must be monthly or yearly'),
  body('shopId').isMongoId().withMessage('Valid shop ID is required'),
  body('paymentMethodId').optional().notEmpty().withMessage('Payment method ID is required for paid plans'),
  body('couponCode').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { planId, billingCycle, shopId, paymentMethodId, couponCode } = req.body;

    // Verify plan exists
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // Verify user owns the shop
    const shop = await Shop.findById(shopId);
    if (!shop || shop.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only subscribe for your own shop' });
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      shop: shopId,
      status: { $in: ['active', 'trialing'] }
    });

    if (existingSubscription) {
      return res.status(400).json({ message: 'Shop already has an active subscription' });
    }

    // Calculate pricing
    const basePrice = plan.price[billingCycle];
    let finalPrice = basePrice;
    let appliedCoupon = null;

    // Apply coupon if provided
    if (couponCode) {
      // TODO: Implement coupon validation logic
      // For now, just a placeholder
      appliedCoupon = {
        code: couponCode,
        discountPercent: 10 // Example 10% discount
      };
      finalPrice = basePrice * (1 - appliedCoupon.discountPercent / 100);
    }

    // Calculate subscription dates
    const startDate = new Date();
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    
    if (billingCycle === 'monthly') {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    } else {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    }

    // For free plans, no payment processing needed
    if (plan.name === 'free') {
      const subscription = new Subscription({
        user: req.user.id,
        shop: shopId,
        plan: planId,
        status: 'active',
        billingCycle,
        startDate,
        currentPeriodStart,
        currentPeriodEnd,
        payment: {
          paymentMethod: 'manual',
          amount: 0,
          currency: 'USD'
        },
        coupon: appliedCoupon
      });

      await subscription.save();

      // Update shop subscription
      await Shop.findByIdAndUpdate(shopId, {
        'subscription.plan': plan.name,
        'subscription.status': 'active',
        'subscription.expiryDate': currentPeriodEnd
      });

      // Log activity
      await new ActivityLog({
        userId: req.user.id,
        action: 'SUBSCRIBE',
        details: `Subscribed to ${plan.displayName} plan`
      }).save();

      res.status(201).json({
        message: 'Successfully subscribed to free plan',
        subscription
      });
    } else {
      // For paid plans, integrate with payment processor (Stripe)
      // TODO: Implement Stripe integration
      res.status(501).json({ 
        message: 'Paid subscription processing not yet implemented',
        requiredPayment: {
          amount: finalPrice,
          currency: 'USD',
          planName: plan.displayName,
          billingCycle
        }
      });
    }

  } catch (error) {
    res.status(500).json({ message: 'Error creating subscription', error: error.message });
  }
});

// GET /api/subscriptions/status - Check subscription status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Verify user has access to shop
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check if user is owner or staff
    const isOwner = shop.owner.toString() === req.user.id;
    const isStaff = shop.staff.some(s => s.user.toString() === req.user.id);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subscription = await Subscription.findOne({
      shop: shopId,
      status: { $in: ['active', 'trialing', 'past_due'] }
    }).populate('plan');

    if (!subscription) {
      return res.json({
        hasSubscription: false,
        plan: 'free',
        status: 'no_subscription'
      });
    }

    res.json({
      hasSubscription: true,
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        daysRemaining: subscription.daysRemaining,
        isActive: subscription.isActive,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        amount: subscription.payment.amount,
        currency: subscription.payment.currency,
        billingCycle: subscription.billingCycle
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching subscription status', error: error.message });
  }
});

// PUT /api/subscriptions/renew - Renew subscription
router.put('/renew', authenticateToken, [
  body('subscriptionId').isMongoId().withMessage('Valid subscription ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subscriptionId } = req.body;

    const subscription = await Subscription.findById(subscriptionId)
      .populate('plan')
      .populate('shop');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Verify user owns the shop
    if (subscription.shop.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Calculate new period dates
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = new Date(newPeriodStart);

    if (subscription.billingCycle === 'monthly') {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    } else {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    }

    // Update subscription
    await Subscription.findByIdAndUpdate(subscriptionId, {
      status: 'active',
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      cancelAtPeriodEnd: false,
      'payment.lastPaymentDate': new Date(),
      'payment.nextPaymentDate': newPeriodEnd
    });

    // Update shop
    await Shop.findByIdAndUpdate(subscription.shop._id, {
      'subscription.status': 'active',
      'subscription.expiryDate': newPeriodEnd
    });

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'RENEW_SUBSCRIPTION',
      details: `Renewed subscription for ${subscription.plan.displayName}`
    }).save();

    res.json({ message: 'Subscription renewed successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Error renewing subscription', error: error.message });
  }
});

// DELETE /api/subscriptions/cancel - Cancel subscription
router.delete('/cancel', authenticateToken, [
  body('subscriptionId').isMongoId().withMessage('Valid subscription ID is required'),
  body('cancelAtPeriodEnd').optional().isBoolean().withMessage('Cancel at period end must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subscriptionId, cancelAtPeriodEnd = true } = req.body;

    const subscription = await Subscription.findById(subscriptionId)
      .populate('shop');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Verify user owns the shop
    if (subscription.shop.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updateData = {
      cancelAtPeriodEnd
    };

    if (!cancelAtPeriodEnd) {
      // Cancel immediately
      updateData.status = 'cancelled';
      updateData.cancelledAt = new Date();
      updateData.endedAt = new Date();

      // Update shop to free plan
      await Shop.findByIdAndUpdate(subscription.shop._id, {
        'subscription.plan': 'free',
        'subscription.status': 'cancelled'
      });
    }

    await Subscription.findByIdAndUpdate(subscriptionId, updateData);

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CANCEL_SUBSCRIPTION',
      details: `Cancelled subscription ${cancelAtPeriodEnd ? 'at period end' : 'immediately'}`
    }).save();

    res.json({ 
      message: cancelAtPeriodEnd 
        ? 'Subscription will be cancelled at the end of current period'
        : 'Subscription cancelled immediately'
    });

  } catch (error) {
    res.status(500).json({ message: 'Error cancelling subscription', error: error.message });
  }
});

// GET /api/subscriptions/expiring - Get expiring subscriptions (SuperAdmin)
router.get('/expiring', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));

    const expiringSubscriptions = await Subscription.find({
      status: 'active',
      currentPeriodEnd: { $lte: expiryDate },
      cancelAtPeriodEnd: false
    })
    .populate('user', 'email fullName')
    .populate('shop', 'name email')
    .populate('plan', 'displayName')
    .sort({ currentPeriodEnd: 1 });

    res.json(expiringSubscriptions);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching expiring subscriptions', error: error.message });
  }
});

module.exports = router;
