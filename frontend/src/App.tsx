import React, { useState, useEffect } from 'react';
import { ShoppingBag, Shield, Truck, RotateCcw, CreditCard, Star, Zap } from 'lucide-react';
import { CheckoutRecoveryWidget } from './widget/CheckoutRecoveryWidget';
import { useRecoverySession } from './hooks/useRecoverySession';
import { useShopifyCart } from './hooks/useShopifyCart';
import { SuggestedAction, AnalyticsSummary } from './types';

const CART_ITEMS = [
  { id: 1, name: 'Wireless Noise-Cancelling Headphones Pro', variant: 'Midnight Black', price: 89.99, qty: 1, emoji: '🎧' },
  { id: 2, name: 'Premium Cable Knit Sweater', variant: 'Navy Blue / M', price: 49.99, qty: 2, emoji: '🧥' },
];

export default function App() {
  const { sessionId, frictionType, signals, injectSignal, logOutcome } = useRecoverySession('demo-store.myshopify.com');
  const { cart } = useShopifyCart();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'checkout' | 'analytics'>('checkout');
  const [highlightShipping, setHighlightShipping] = useState(false);
  const [showReturnPolicy, setShowReturnPolicy] = useState(false);
  const [showInstallments, setShowInstallments] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const subtotal = CART_ITEMS.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = 5.99;
  const total = subtotal + shipping;

  // Poll analytics
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/analytics/summary');
        if (res.ok) setAnalytics(await res.json());
      } catch {}
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAction = (action: SuggestedAction) => {
    switch (action.type) {
      case 'HIGHLIGHT_SHIPPING_OPTION': setHighlightShipping(true); showNotif('📦 Shipping options highlighted!'); break;
      case 'SHOW_RETURN_POLICY': setShowReturnPolicy(true); showNotif('📋 Return policy expanded'); break;
      case 'OFFER_INSTALLMENTS': setShowInstallments(true); showNotif('💳 Installment options shown'); break;
      case 'HIGHLIGHT_COUPON_FIELD': showNotif('🏷️ Try code SAVE10 for 10% off!'); break;
      case 'ESCALATE_TO_SUPPORT': showNotif('🎧 Connecting you to support...'); break;
      default: break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── Top Nav ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
              <ShoppingBag size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">NovaBuy</span>
            <span className="ml-2 text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">CartSave Demo</span>
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('checkout')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'checkout' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Checkout</button>
            <button onClick={() => setActiveTab('analytics')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Analytics</button>
          </div>
        </div>
      </nav>

      {/* ── Notification Toast ── */}
      {notification && (
        <div className="fixed top-16 right-4 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium animate-slide-up">
          {notification}
        </div>
      )}

      {activeTab === 'checkout' ? (
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Demo Controls */}
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <Zap size={14} /> Demo Controls — Trigger friction signals manually:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '⏱ Time Hesitation', signal: 'time_hesitation' },
                { label: '🚪 Back Button Hover', signal: 'back_button_hover' },
                { label: '🚚 Shipping Confusion', signal: 'shipping_field_stall' },
                { label: '💰 Price Hesitation', signal: 'price_scroll_repeat' },
                { label: '🏷 Coupon Frustration', signal: 'coupon_field_abandoned' },
                { label: '💳 Payment Confusion', signal: 'payment_section_revisit' },
              ].map(({ label, signal }) => (
                <button
                  key={signal}
                  id={`demo-trigger-${signal}`}
                  onClick={() => injectSignal(signal as any)}
                  className="px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-100 transition-all active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
            {signals.length > 0 && (
              <p className="text-xs text-amber-600 mt-2">
                Active signals: {signals.map(s => s.type).join(', ')} {frictionType && `→ Friction: ${frictionType}`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
            {/* ── Left: Checkout Form ── */}
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>

              {/* Contact */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-900 mb-4">Contact</h2>
                <input id="checkout-email" type="email" placeholder="Email address" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all" />
              </section>

              {/* Shipping */}
              <section className={`bg-white rounded-2xl p-6 shadow-sm border transition-all ${highlightShipping ? 'border-brand-400 ring-2 ring-brand-100' : 'border-gray-100'}`} data-shipping>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck size={16} className="text-brand-500" /> Shipping
                  {highlightShipping && <span className="text-xs bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full">Recommended ✓</span>}
                </h2>
                <div className="space-y-3">
                  {[
                    { id: 'ship-std', label: 'Standard Shipping', sub: '5–7 business days', price: '$5.99', recommended: highlightShipping },
                    { id: 'ship-exp', label: 'Express Shipping', sub: '2–3 business days', price: '$14.99' },
                    { id: 'ship-over', label: 'Overnight', sub: 'Next business day', price: '$29.99' },
                  ].map(opt => (
                    <label key={opt.id} htmlFor={opt.id} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${opt.recommended ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <input id={opt.id} type="radio" name="shipping" defaultChecked={opt.recommended} className="accent-brand-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.sub}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{opt.price}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <input id="checkout-address" type="text" placeholder="Street address" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 col-span-2" data-shipping />
                  <input id="checkout-zip" type="text" name="zip" placeholder="ZIP / Postal code" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400" data-shipping />
                  <input id="checkout-city" type="text" placeholder="City" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
                </div>
              </section>

              {/* Coupon */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-900 mb-4">Discount Code</h2>
                <div className="flex gap-2">
                  <input id="coupon-input" type="text" name="coupon" placeholder="Enter promo code" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400" data-coupon />
                  <button id="coupon-apply-btn" className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">Apply</button>
                </div>
              </section>

              {/* Payment */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100" id="payment-section" data-payment>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard size={16} className="text-brand-500" /> Payment
                </h2>
                <div className="space-y-3">
                  <input id="checkout-card" type="text" placeholder="Card number" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400" />
                  <div className="grid grid-cols-2 gap-3">
                    <input id="checkout-expiry" type="text" placeholder="MM / YY" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400" />
                    <input id="checkout-cvv" type="text" placeholder="CVV" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400" />
                  </div>
                </div>

                {/* Installments (shown by AI action) */}
                {showInstallments && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl animate-slide-up">
                    <p className="text-sm font-semibold text-green-800">💳 Pay in installments</p>
                    <p className="text-xs text-green-700 mt-1">4 payments of ${(total / 4).toFixed(2)} with Shop Pay — 0% interest</p>
                  </div>
                )}

                {/* Trust badges */}
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500" data-trust>
                  <span className="flex items-center gap-1"><Shield size={12} className="text-green-500" /> 256-bit SSL</span>
                  <span className="flex items-center gap-1"><Star size={12} className="text-amber-400" /> 4.9/5 (2,847 reviews)</span>
                  <span className="flex items-center gap-1"><RotateCcw size={12} className="text-brand-500" /> 30-day returns</span>
                </div>
              </section>

              {/* Return Policy (shown by AI action) */}
              {showReturnPolicy && (
                <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 animate-slide-up">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><RotateCcw size={14} /> Return Policy</h3>
                  <p className="text-sm text-blue-800">30-day hassle-free returns on all items. Free return shipping on defective products. Refund processed within 3–5 business days.</p>
                </section>
              )}

              <button id="complete-purchase-btn" className="w-full py-4 bg-gradient-to-r from-brand-500 to-brand-700 text-white rounded-2xl font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all">
                Complete Purchase → ${total.toFixed(2)}
              </button>
            </div>

            {/* ── Right: Order Summary ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-20">
                <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-4">
                  {CART_ITEMS.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{item.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.variant} · Qty {item.qty}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">${(item.price * item.qty).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Shipping</span><span>${shipping.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100 mt-1">
                    <span>Total</span><span>${total.toFixed(2)}</span>
                  </div>
                </div>
                <div id="total-price" data-price className="mt-3 text-center text-xs text-gray-400">Prices in USD</div>
              </div>

              {/* Session Debug Info */}
              <div className="bg-gray-900 rounded-2xl p-4 text-xs font-mono">
                <p className="text-gray-400 mb-2">CartSave Session</p>
                <p className="text-green-400">Session: {sessionId ? `${sessionId.substring(0, 8)}…` : 'Starting…'}</p>
                <p className="text-yellow-400">Signals: {signals.length} detected</p>
                <p className="text-brand-400">Friction: {frictionType || 'none'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Analytics Tab ── */
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Recovery Analytics</h1>
          {analytics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Sessions', value: analytics.totalSessions, color: 'bg-blue-50 text-blue-700 border-blue-100' },
                  { label: 'Recovery Rate', value: analytics.recoveryRate, color: 'bg-green-50 text-green-700 border-green-100' },
                  { label: 'Recovered', value: analytics.recovered, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                  { label: 'Avg Messages', value: analytics.avgConversationLength, color: 'bg-purple-50 text-purple-700 border-purple-100' },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-2xl p-5 border ${stat.color}`}>
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <p className="text-sm mt-1 opacity-80">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Top Friction Types</h3>
                {analytics.topFrictions.length === 0 ? (
                  <p className="text-gray-400 text-sm">No friction data yet. Trigger some signals on the Checkout tab!</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topFrictions.map(f => (
                      <div key={f.friction_type} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 w-24 capitalize">{f.friction_type}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${Math.min((f.count / analytics.totalSessions) * 100, 100)}%` }} />
                        </div>
                        <span className="text-sm text-gray-500 w-8 text-right">{f.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Abandoned', value: analytics.abandoned, color: 'text-red-600 bg-red-50 border-red-100' },
                  { label: 'Escalated', value: analytics.escalated, color: 'text-orange-600 bg-orange-50 border-orange-100' },
                  { label: 'Pending', value: analytics.pending, color: 'text-gray-600 bg-gray-50 border-gray-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl p-5 border ${s.color}`}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-sm mt-1 opacity-70">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
              Loading analytics…
            </div>
          )}
        </div>
      )}

      {/* ── CartSave Widget ── */}
      <CheckoutRecoveryWidget
        sessionId={sessionId}
        frictionType={frictionType}
        onOutcome={logOutcome}
        onAction={handleAction}
      />
    </div>
  );
}
