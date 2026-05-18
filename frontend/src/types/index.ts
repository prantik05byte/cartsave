// ─── Friction Signal Types ───────────────────────────────────────────────────
export type SignalType =
  | 'time_hesitation'
  | 'back_button_hover'
  | 'shipping_field_stall'
  | 'price_scroll_repeat'
  | 'coupon_field_abandoned'
  | 'payment_section_revisit'
  | 'size_selector_open'
  | 'trust_badge_hover'
  | 'review_section_scroll';

export type FrictionType =
  | 'price'
  | 'shipping'
  | 'coupon'
  | 'size'
  | 'trust'
  | 'payment'
  | 'general';

export interface Signal {
  type: SignalType;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ─── Widget States ────────────────────────────────────────────────────────────
export type WidgetState =
  | 'IDLE'
  | 'TRIGGERED'
  | 'CONVERSING'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'ABANDONED';

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type SuggestedAction =
  | { type: 'HIGHLIGHT_COUPON_FIELD' }
  | { type: 'HIGHLIGHT_SHIPPING_OPTION'; optionId?: string }
  | { type: 'SHOW_RETURN_POLICY' }
  | { type: 'SHOW_SIZE_GUIDE'; productId?: string }
  | { type: 'OFFER_INSTALLMENTS' }
  | { type: 'ESCALATE_TO_SUPPORT' };

// ─── Session ──────────────────────────────────────────────────────────────────
export interface RecoverySession {
  sessionId: string;
  shopDomain: string;
  frictionType: FrictionType | null;
  widgetState: WidgetState;
  messages: ChatMessage[];
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export interface CartItem {
  quantity: number;
  title: string;
  variantTitle: string;
  price: number;
  currency: string;
  tags: string[];
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  total: number;
  discountCodes: { code: string; applicable: boolean }[];
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface FrictionDetectResponse {
  frictionType: FrictionType | null;
  shouldTrigger: boolean;
  confidence: number;
  allScores: Record<string, number>;
}

export interface ChatResponse {
  reply: string;
  suggestedActions: SuggestedAction[];
  confidence: number;
  isFallback?: boolean;
}

export interface AnalyticsSummary {
  totalSessions: number;
  recoveryRate: string;
  recovered: number;
  abandoned: number;
  escalated: number;
  pending: number;
  topFrictions: { friction_type: string; count: number }[];
  avgConversationLength: number;
}
