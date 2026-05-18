const express = require('express');
const router = express.Router();
const { getAnalyticsSummary } = require('../models/Session');

/**
 * GET /api/analytics/summary
 * Returns: { totalSessions, recoveryRate, topFrictions, avgConversationLength }
 */
router.get('/summary', (req, res) => {
  try {
    const summary = getAnalyticsSummary();
    res.json(summary);
  } catch (err) {
    console.error('[analytics]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
