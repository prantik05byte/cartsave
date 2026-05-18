const express = require('express');
const router = express.Router();
const { analyzeSignals } = require('../services/frictionEngine');
const { getSession, updateSession } = require('../models/Session');

/**
 * POST /api/friction/detect
 * Body: { sessionId, signals: [{ type, timestamp, metadata }] }
 * Returns: { frictionType, shouldTrigger, confidence }
 */
router.post('/detect', (req, res) => {
  const { sessionId, signals } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  if (!Array.isArray(signals)) return res.status(400).json({ error: 'signals must be an array' });

  // FAILURE HANDLING #4: No friction detected → widget stays hidden
  const result = analyzeSignals(signals);

  if (result.frictionType && result.shouldTrigger) {
    // Persist the detected friction type to the session
    const session = getSession(sessionId);
    if (session) {
      updateSession(sessionId, { friction_type: result.frictionType });
    }
  }

  res.json(result);
});

module.exports = router;
