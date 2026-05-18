/**
 * FrictionEngine — Server-side signal analysis and friction classification.
 *
 * Receives behavioral signals from the frontend FrictionDetector and returns
 * a friction type + confidence score + whether to trigger the widget.
 */

const FRICTION_TYPES = {
  PRICE_HESITATION: 'price',
  SHIPPING_CONFUSION: 'shipping',
  COUPON_FRUSTRATION: 'coupon',
  SIZE_UNCERTAINTY: 'size',
  TRUST_GAP: 'trust',
  PAYMENT_CONFUSION: 'payment',
  GENERAL_HESITATION: 'general',
};

// Signal → friction type mapping with weights
const SIGNAL_MAP = {
  time_hesitation:         { type: FRICTION_TYPES.GENERAL_HESITATION, weight: 1 },
  back_button_hover:       { type: FRICTION_TYPES.GENERAL_HESITATION, weight: 2 },
  shipping_field_stall:    { type: FRICTION_TYPES.SHIPPING_CONFUSION, weight: 3 },
  price_scroll_repeat:     { type: FRICTION_TYPES.PRICE_HESITATION,   weight: 3 },
  coupon_field_abandoned:  { type: FRICTION_TYPES.COUPON_FRUSTRATION, weight: 3 },
  payment_section_revisit: { type: FRICTION_TYPES.PAYMENT_CONFUSION,  weight: 2 },
  size_selector_open:      { type: FRICTION_TYPES.SIZE_UNCERTAINTY,   weight: 2 },
  trust_badge_hover:       { type: FRICTION_TYPES.TRUST_GAP,          weight: 2 },
  review_section_scroll:   { type: FRICTION_TYPES.TRUST_GAP,          weight: 1 },
};

/**
 * Analyze an array of behavioral signals and return friction type + confidence.
 *
 * @param {Array<{type: string, timestamp: number, metadata?: object}>} signals
 * @returns {{ frictionType: string, shouldTrigger: boolean, confidence: number, allScores: object }}
 */
function analyzeSignals(signals) {
  if (!signals || signals.length === 0) {
    // FAILURE HANDLING #4: No friction detected — widget stays hidden
    return { frictionType: null, shouldTrigger: false, confidence: 0, allScores: {} };
  }

  // Tally weighted scores per friction type
  const scores = {};
  let totalWeight = 0;

  for (const signal of signals) {
    const mapping = SIGNAL_MAP[signal.type];
    if (!mapping) continue;
    scores[mapping.type] = (scores[mapping.type] || 0) + mapping.weight;
    totalWeight += mapping.weight;
  }

  if (totalWeight === 0) {
    return { frictionType: null, shouldTrigger: false, confidence: 0, allScores: scores };
  }

  // Find the dominant friction type
  const dominant = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  const frictionType = dominant[0];
  const confidence = Math.min(dominant[1] / totalWeight, 1);

  // Trigger only when confidence exceeds threshold
  const shouldTrigger = confidence >= 0.25 || totalWeight >= 3;

  return { frictionType, shouldTrigger, confidence: parseFloat(confidence.toFixed(2)), allScores: scores };
}

/**
 * Quick single-signal check (used for real-time streaming signals).
 */
function classifySignal(signalType) {
  return SIGNAL_MAP[signalType] || null;
}

module.exports = { analyzeSignals, classifySignal, FRICTION_TYPES };
