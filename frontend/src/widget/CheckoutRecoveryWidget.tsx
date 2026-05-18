import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, ShoppingBag, ChevronDown, ArrowRight, HeadphonesIcon } from 'lucide-react';
import { ChatBubble, TypingIndicator } from './ChatBubble';
import { QuickReplies } from './QuickReplies';
import { ChatMessage, WidgetState, SuggestedAction, FrictionType } from '../types';

// ─── FAILURE HANDLING #5: Session persistence key ───────────────────────────
const STORAGE_KEY = 'cartsave_session';
const SUPPRESS_KEY = 'cartsave_suppressed';
const SUPPRESS_DURATION = 24 * 60 * 60 * 1000; // 24h

interface CheckoutRecoveryWidgetProps {
  sessionId: string | null;
  frictionType: FrictionType | null;
  onOutcome?: (outcome: 'recovered' | 'abandoned' | 'escalated') => void;
  onAction?: (action: SuggestedAction) => void;
}

// Quick reply sets per friction type
const QUICK_REPLIES: Record<string, string[]> = {
  price:    ['Is there a discount?', 'Tell me more', "I'll think about it"],
  shipping: ['Yes, when will it arrive?', 'What are my options?', 'No thanks'],
  coupon:   ['I have a coupon', 'Do you have a promo?', 'No coupon'],
  size:     ['Help me with sizing', 'See the size guide', "I'm unsure"],
  trust:    ["What's your return policy?", 'Tell me more', "I'll pass"],
  payment:  ['I have a payment question', 'Show installments', "It's fine"],
  general:  ['Yes, I need help', "No, I'm good", 'Tell me more'],
};

export const CheckoutRecoveryWidget: React.FC<CheckoutRecoveryWidgetProps> = ({
  sessionId,
  frictionType,
  onOutcome,
  onAction,
}) => {
  const [widgetState, setWidgetState] = useState<WidgetState>('IDLE');
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isSuppressed, setIsSuppressed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Check suppression (FAILURE HANDLING: dismissed for 24h) ────────────────
  useEffect(() => {
    const suppressed = localStorage.getItem(SUPPRESS_KEY);
    if (suppressed && Date.now() - parseInt(suppressed) < SUPPRESS_DURATION) {
      setIsSuppressed(true);
    }
  }, []);

  // ─── FAILURE HANDLING #5: Restore session from localStorage ─────────────────
  useEffect(() => {
    if (!sessionId) return;
    const saved = localStorage.getItem(`${STORAGE_KEY}_${sessionId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.messages?.length > 0) {
          setMessages(parsed.messages);
          setWidgetState('CONVERSING');
          setIsOpen(true);
        }
      } catch {}
    }
  }, [sessionId]);

  // ─── Persist conversation to localStorage ────────────────────────────────────
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    localStorage.setItem(`${STORAGE_KEY}_${sessionId}`, JSON.stringify({ messages }));
  }, [messages, sessionId]);

  // ─── Trigger widget when friction detected ───────────────────────────────────
  useEffect(() => {
    if (!frictionType || isSuppressed || widgetState !== 'IDLE') return;
    setWidgetState('TRIGGERED');
    // Small delay for natural feel
    setTimeout(() => {
      setIsOpen(true);
      sendOpeningMessage(frictionType);
    }, 800);
  }, [frictionType, isSuppressed]);

  // ─── Auto-scroll to latest message ───────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ─── Focus input when opened ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && widgetState === 'CONVERSING') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, widgetState]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  const sendOpeningMessage = async (friction: FrictionType) => {
    if (!sessionId) return;
    setIsTyping(true);
    setWidgetState('CONVERSING');

    const openingMap: Record<FrictionType, string> = {
      shipping: "Looks like you might have a question about shipping. Want me to help figure out delivery?",
      price:    "I noticed you've been looking at the total. Can I check if there's a discount available for you?",
      coupon:   "It looks like you might have a promo code in mind. I can help find one that works!",
      size:     "Not sure about sizing? I can pull up the size guide for you right now.",
      trust:    "Want to know more about our return policy before completing your purchase?",
      payment:  "Have a question about payment options? We have several flexible ways to pay.",
      general:  "It looks like you might need a hand. Can I help with anything about your order?",
    };

    // Simulate brief typing delay
    await new Promise(r => setTimeout(r, 1200));
    setIsTyping(false);

    const openingMsg = openingMap[friction] || openingMap.general;
    addMessage('assistant', openingMsg);

    const replies = QUICK_REPLIES[friction] || QUICK_REPLIES.general;
    setQuickReplies(replies);
    setShowQuickReplies(true);
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !sessionId) return;

    setShowQuickReplies(false);
    addMessage('user', content);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: content,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setIsTyping(false);
      addMessage('assistant', data.reply);

      // Execute suggested actions
      if (data.suggestedActions?.length > 0) {
        data.suggestedActions.forEach((action: SuggestedAction) => onAction?.(action));

        // Check for escalation
        if (data.suggestedActions.some((a: SuggestedAction) => a.type === 'ESCALATE_TO_SUPPORT')) {
          setWidgetState('ESCALATED');
          onOutcome?.('escalated');
          await logOutcome('escalated');
        }
      }

      // Show follow-up quick replies
      setTimeout(() => {
        setQuickReplies(['Yes, complete my purchase!', 'Tell me more', 'I need help']);
        setShowQuickReplies(true);
      }, 500);

    } catch (err) {
      setIsTyping(false);
      addMessage('assistant', "I'm having a moment — give me a second and try again!");
    }
  }, [sessionId, messages, onAction, onOutcome]);

  const handleResolve = async () => {
    setWidgetState('RESOLVED');
    onOutcome?.('recovered');
    await logOutcome('recovered');
  };

  const handleDismiss = async () => {
    setIsOpen(false);
    setWidgetState('ABANDONED');
    // Suppress for 24h
    localStorage.setItem(SUPPRESS_KEY, Date.now().toString());
    onOutcome?.('abandoned');
    await logOutcome('abandoned');
  };

  const logOutcome = async (outcome: string) => {
    if (!sessionId) return;
    try {
      await fetch('/api/session/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, outcome }),
      });
    } catch {}
  };

  const handleQuickReply = (reply: string) => {
    setShowQuickReplies(false);
    if (reply.toLowerCase().includes('complete') || reply.toLowerCase().includes('purchase')) {
      addMessage('user', reply);
      setTimeout(() => {
        addMessage('assistant', "Wonderful! Your items are secured. Click 'Complete My Purchase' below to finish — we're right here if you need anything. 🎉");
        setWidgetState('RESOLVED');
      }, 600);
    } else {
      sendMessage(reply);
    }
  };

  // ─── Render: Suppressed or no trigger → nothing ───────────────────────────
  if (isSuppressed && widgetState === 'IDLE') return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
      {/* ── Chat Panel ── */}
      <div className={`widget-panel ${isOpen ? 'open' : 'closed'}`}>
        <div
          id="cartsave-widget-panel"
          className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          style={{ height: '420px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-sm">
                S
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Sarah</p>
                <p className="text-white/70 text-xs">Checkout Assistant · Online</p>
              </div>
            </div>
            <button
              id="cartsave-close-btn"
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors p-1 rounded"
              title="Minimize"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-3 bg-gray-50/50">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">
                <ShoppingBag className="mx-auto mb-2 opacity-40" size={28} />
                <p>Sarah is here to help.</p>
              </div>
            )}
            {messages.map(msg => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            {isTyping && <TypingIndicator />}

            {/* Quick replies */}
            {showQuickReplies && !isTyping && (
              <QuickReplies
                options={quickReplies}
                onSelect={handleQuickReply}
                disabled={isTyping}
              />
            )}

            {/* Resolved CTA */}
            {widgetState === 'RESOLVED' && (
              <button
                id="cartsave-complete-purchase-btn"
                onClick={handleResolve}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all animate-slide-up"
              >
                Complete My Purchase <ArrowRight size={16} />
              </button>
            )}

            {/* Escalated CTA */}
            {widgetState === 'ESCALATED' && (
              <a
                href="mailto:support@store.com"
                id="cartsave-support-link"
                className="w-full mt-2 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors animate-slide-up"
              >
                <HeadphonesIcon size={15} /> Contact Support
              </a>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 bg-white flex items-center gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              id="cartsave-chat-input"
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(inputValue)}
              placeholder="Type a message..."
              disabled={isTyping || widgetState === 'ABANDONED'}
              className="flex-1 text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all placeholder-gray-400 disabled:opacity-50"
            />
            <button
              id="cartsave-send-btn"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isTyping}
              className="w-9 h-9 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>

          {/* Dismiss footer */}
          <div className="px-4 pb-2 bg-white flex justify-between items-center">
            <span className="text-xs text-gray-400">Powered by CartSave</span>
            <button
              id="cartsave-dismiss-btn"
              onClick={handleDismiss}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              <X size={11} /> Dismiss for 24h
            </button>
          </div>
        </div>
      </div>

      {/* ── Floating Trigger Button ── */}
      {widgetState !== 'ABANDONED' && (
        <button
          id="cartsave-trigger-btn"
          onClick={() => setIsOpen(prev => !prev)}
          className="relative w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
          title={isOpen ? 'Minimize' : 'Need help?'}
        >
          {/* Pulse ring — only shown when friction just triggered */}
          {widgetState === 'TRIGGERED' && (
            <span className="pulse-ring bg-brand-400/30" />
          )}
          <ShoppingBag size={22} />

          {/* Unread badge */}
          {!isOpen && messages.filter(m => m.role === 'assistant').length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
              {messages.filter(m => m.role === 'assistant').length}
            </span>
          )}
        </button>
      )}

      {/* ── IDLE tooltip ── */}
      {!isOpen && widgetState === 'IDLE' && !isSuppressed && (
        <div className="absolute bottom-16 right-0 bg-white shadow-lg rounded-xl px-3 py-2 text-sm text-gray-700 font-medium whitespace-nowrap border border-gray-100 animate-fade-in pointer-events-none">
          💬 Need help checking out?
        </div>
      )}
    </div>
  );
};
