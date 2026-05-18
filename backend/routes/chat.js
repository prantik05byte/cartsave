const express = require('express');
const router = express.Router();
const { getAIResponse } = require('../services/claudeService');
const { getSession, updateSession } = require('../models/Session');
const { saveMessage, getMessages } = require('../models/Message');
const { getMockShippingRates, getMockPolicies } = require('../services/shopifyService');

// Simple in-memory queue per session (FAILURE HANDLING #7: Rate limiting)
const messageQueues = {};
const processingSet = new Set();

async function processQueue(sessionId) {
  if (processingSet.has(sessionId)) return; // Already processing
  processingSet.add(sessionId);
  while (messageQueues[sessionId] && messageQueues[sessionId].length > 0) {
    const { resolve, reject, payload } = messageQueues[sessionId].shift();
    try {
      const result = await executeChat(payload);
      resolve(result);
    } catch (e) {
      reject(e);
    }
  }
  processingSet.delete(sessionId);
}

async function executeChat({ sessionId, message, conversationHistory, session }) {
  // Retrieve cart data — use cached version if Shopify was down (FAILURE HANDLING #2)
  let cartData = null;
  if (session?.cart_data) {
    try { cartData = JSON.parse(session.cart_data); } catch {}
  }

  const context = {
    frictionType: session?.friction_type || 'general',
    cartItems: cartData?.items || [],
    policies: getMockPolicies(),
    shippingRates: getMockShippingRates(),
    discounts: cartData?.discountCodes || [],
    storeName: session?.shop_domain || 'Our Store',
  };

  // Save user message to DB
  if (message) {
    saveMessage({ sessionId, role: 'user', content: message });
  }

  const result = await getAIResponse({
    sessionId,
    message,
    conversationHistory: conversationHistory || [],
    context,
  });

  // Save assistant reply
  saveMessage({ sessionId, role: 'assistant', content: result.reply });

  return result;
}

/**
 * POST /api/chat/message
 * Body: { sessionId, message, conversationHistory }
 * Returns: { reply, suggestedActions, confidence }
 */
router.post('/message', async (req, res) => {
  const { sessionId, message, conversationHistory } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    // Queue message for this session (FAILURE HANDLING #7)
    const result = await new Promise((resolve, reject) => {
      if (!messageQueues[sessionId]) messageQueues[sessionId] = [];
      messageQueues[sessionId].push({
        resolve, reject,
        payload: { sessionId, message, conversationHistory, session },
      });
      processQueue(sessionId).catch(reject);
    });

    res.json(result);
  } catch (err) {
    console.error('[chat/message]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/chat/history/:sessionId
 * Returns full conversation history for a session.
 * FAILURE HANDLING #5: Used to restore session on page reload.
 */
router.get('/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const messages = getMessages(sessionId);
  res.json({ sessionId, messages });
});

module.exports = router;
