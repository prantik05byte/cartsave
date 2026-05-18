const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { createSession, getSession, updateSession } = require('../models/Session');
const { fetchCart, getMockCart, getMockShippingRates, getMockPolicies } = require('../services/shopifyService');

/**
 * POST /api/session/start
 * Body: { shopDomain, cartToken, pageUrl, userAgent }
 * Returns: { sessionId }
 */
router.post('/start', async (req, res) => {
  try {
    const { shopDomain, cartToken, pageUrl, userAgent } = req.body;
    if (!shopDomain) return res.status(400).json({ error: 'shopDomain is required' });

    const sessionId = uuidv4();

    // Pre-fetch cart data and cache it (FAILURE HANDLING #2: Shopify down scenario)
    let cartData = null;
    try {
      cartData = cartToken ? await fetchCart(cartToken) : getMockCart();
    } catch {
      cartData = getMockCart();
    }

    createSession({ id: sessionId, shopDomain, cartToken, pageUrl, userAgent });

    // Cache cart data in session for Shopify-down scenarios
    updateSession(sessionId, { cart_data: JSON.stringify(cartData) });

    res.json({
      sessionId,
      cartSummary: {
        itemCount: cartData?.items?.length || 0,
        total: cartData?.total || 0,
      },
    });
  } catch (err) {
    console.error('[session/start]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/session/outcome
 * Body: { sessionId, outcome: "recovered" | "abandoned" | "escalated" }
 * Returns: { logged: true }
 */
router.post('/outcome', (req, res) => {
  const { sessionId, outcome } = req.body;
  const validOutcomes = ['recovered', 'abandoned', 'escalated'];

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  if (!validOutcomes.includes(outcome)) return res.status(400).json({ error: 'Invalid outcome value' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  updateSession(sessionId, { outcome });
  res.json({ logged: true, sessionId, outcome });
});

/**
 * GET /api/session/:id
 * Returns session details including cached cart data.
 */
router.get('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const cartData = session.cart_data ? JSON.parse(session.cart_data) : null;
  res.json({ ...session, cartData });
});

module.exports = router;
