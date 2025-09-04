const express = require('express');
const router = express.Router();
const DeveloperMetric = require('../models/DeveloperMetric');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Ingest metric (public endpoint optionally or authenticated)
router.post('/ingest', async (req, res) => {
  try {
    const { app, instanceId, metricType, value = 1, details } = req.body;
    if (!app || !metricType) return res.status(400).json({ message: 'app and metricType required' });

    const m = new DeveloperMetric({ app, instanceId, metricType, value, details });
    await m.save();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error ingesting metric', error: err.message });
  }
});

// Query aggregated metrics for an app
router.get('/app/:app/summary', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { app } = req.params;
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    const agg = await DeveloperMetric.aggregate([
      { $match: { app, timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$metricType', count: { $sum: '$value' }, last: { $max: '$timestamp' } } }
    ]);

    res.json({ app, summary: agg });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching developer metrics', error: err.message });
  }
});

module.exports = router;
