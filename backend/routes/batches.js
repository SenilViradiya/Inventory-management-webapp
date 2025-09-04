const express = require('express');
const router = express.Router();
const ProductBatch = require('../models/ProductBatch');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Create a new batch
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const payload = req.body;
    const batch = new ProductBatch(payload);
    await batch.save();
    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ message: 'Error creating batch', error: err.message });
  }
});

// Get batches for a product
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const batches = await ProductBatch.find({ productId }).sort({ expiryDate: 1 });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching batches', error: err.message });
  }
});

// Update a batch
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const updated = await ProductBatch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating batch', error: err.message });
  }
});

// Delete a batch
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await ProductBatch.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting batch', error: err.message });
  }
});

module.exports = router;

// Admin endpoints to trigger expiry job and check status
const { executeExpiryJob, getStatus } = require('../services/expiryRunner');

router.post('/_run-expiry', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await executeExpiryJob();
    res.json({ success: true, status: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/_expiry-status', authenticateToken, requireRole('admin'), async (req, res) => {
  res.json(getStatus());
});
