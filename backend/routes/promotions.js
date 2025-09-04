const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Create promotion
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const promo = new Promotion(req.body);
    await promo.save();
    res.status(201).json(promo);
  } catch (err) {
    res.status(500).json({ message: 'Error creating promotion', error: err.message });
  }
});

// List active promotions
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const promos = await Promotion.find({ active: true, startDate: { $lte: now }, endDate: { $gte: now } });
    res.json(promos);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching promotions', error: err.message });
  }
});

// Update promotion
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const updated = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating promotion', error: err.message });
  }
});

// Delete promotion
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await Promotion.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting promotion', error: err.message });
  }
});

module.exports = router;
