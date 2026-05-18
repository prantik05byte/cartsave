import { Signal, SignalType } from '../types';

type SignalCallback = (signals: Signal[]) => void;

/**
 * FrictionDetector — Client-side behavioral signal detection.
 *
 * Attaches DOM event listeners to the checkout page and emits signals
 * when hesitation behaviors are detected. Designed to be instantiated once
 * per checkout session.
 */
export class FrictionDetector {
  private signals: Signal[] = [];
  private callback: SignalCallback;
  private listeners: Array<{ el: EventTarget; event: string; fn: EventListener }> = [];
  private timers: ReturnType<typeof setTimeout>[] = [];

  // Tracking state
  private pageStartTime = Date.now();
  private shippingFocusStart: number | null = null;
  private priceScrollCount = 0;
  private paymentVisitCount = 0;
  private couponClicked = false;

  constructor(callback: SignalCallback) {
    this.callback = callback;
  }

  /** Attach all event listeners to the checkout DOM */
  start() {
    this.detectTimeHesitation();
    this.detectBackButtonHover();
    this.detectShippingFieldStall();
    this.detectPriceScrollRepeat();
    this.detectCouponFrustration();
    this.detectPaymentRevisit();
  }

  /** Remove all event listeners and clear timers */
  stop() {
    this.listeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn));
    this.timers.forEach(clearTimeout);
    this.listeners = [];
    this.timers = [];
  }

  // ─── Detection Methods ──────────────────────────────────────────────────────

  /** time_on_page > 90s with no form progress → hesitation */
  private detectTimeHesitation() {
    const timer = setTimeout(() => {
      this.emit('time_hesitation');
    }, 90_000);
    this.timers.push(timer);
  }

  /** Cursor hovering over back button / top of viewport → intent to leave */
  private detectBackButtonHover() {
    let hoverStart: number | null = null;
    const fn = (e: Event) => {
      const me = e as MouseEvent;
      if (me.clientY < 30) {
        if (!hoverStart) hoverStart = Date.now();
        if (Date.now() - (hoverStart || 0) > 800) {
          this.emit('back_button_hover');
          hoverStart = null;
        }
      } else {
        hoverStart = null;
      }
    };
    this.addListener(document, 'mousemove', fn);
  }

  /** Shipping field focused > 30s without completion → confusion */
  private detectShippingFieldStall() {
    // Listen for focus/blur on inputs with shipping-related names
    const focusFn = (e: Event) => {
      const target = e.target as HTMLElement;
      const name = (target as HTMLInputElement).name?.toLowerCase() || '';
      const id = target.id?.toLowerCase() || '';
      if (name.includes('zip') || name.includes('postal') || name.includes('ship') ||
          id.includes('zip') || id.includes('postal') || id.includes('ship') ||
          target.closest?.('[data-shipping]')) {
        this.shippingFocusStart = Date.now();
      }
    };
    const blurFn = (e: Event) => {
      const target = e.target as HTMLElement;
      const name = (target as HTMLInputElement).name?.toLowerCase() || '';
      const id = target.id?.toLowerCase() || '';
      if ((name.includes('zip') || name.includes('postal') || name.includes('ship') ||
           id.includes('zip') || id.includes('postal') || id.includes('ship')) &&
          this.shippingFocusStart) {
        const elapsed = Date.now() - this.shippingFocusStart;
        if (elapsed > 30_000) this.emit('shipping_field_stall', { durationMs: elapsed });
        this.shippingFocusStart = null;
      }
    };
    this.addListener(document, 'focusin', focusFn);
    this.addListener(document, 'focusout', blurFn);
  }

  /** Price/total area scrolled past multiple times → price hesitation */
  private detectPriceScrollRepeat() {
    let lastScrollY = 0;
    const fn = () => {
      const currentY = window.scrollY;
      // Detect direction change near price elements
      const priceEl = document.querySelector('[data-price], .order-total, #total-price, .cart-total');
      if (priceEl) {
        const rect = priceEl.getBoundingClientRect();
        if (rect.top > 0 && rect.top < window.innerHeight) {
          if (Math.sign(currentY - lastScrollY) !== Math.sign(lastScrollY)) {
            this.priceScrollCount++;
            if (this.priceScrollCount >= 2) {
              this.emit('price_scroll_repeat', { count: this.priceScrollCount });
            }
          }
        }
      }
      lastScrollY = currentY;
    };
    this.addListener(window, 'scroll', fn);
  }

  /** Coupon field clicked but left empty → frustration */
  private detectCouponFrustration() {
    const focusFn = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const name = target.name?.toLowerCase() || '';
      const id = target.id?.toLowerCase() || '';
      if (name.includes('coupon') || name.includes('discount') || name.includes('promo') ||
          id.includes('coupon') || id.includes('discount') || id.includes('promo') ||
          target.closest?.('[data-coupon]')) {
        this.couponClicked = true;
      }
    };
    const blurFn = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const name = target.name?.toLowerCase() || '';
      const id = target.id?.toLowerCase() || '';
      if ((name.includes('coupon') || name.includes('discount') || name.includes('promo') ||
           id.includes('coupon') || id.includes('discount') || id.includes('promo')) &&
          this.couponClicked && !target.value?.trim()) {
        this.emit('coupon_field_abandoned');
        this.couponClicked = false;
      }
    };
    this.addListener(document, 'focusin', focusFn);
    this.addListener(document, 'focusout', blurFn);
  }

  /** Payment section visited > 2 times → confusion */
  private detectPaymentRevisit() {
    const fn = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('[data-payment], #payment-section, .payment-method')) {
        this.paymentVisitCount++;
        if (this.paymentVisitCount > 2) {
          this.emit('payment_section_revisit', { count: this.paymentVisitCount });
        }
      }
    };
    this.addListener(document, 'click', fn);
  }

  // ─── Programmatic signal injection (for demo/testing) ───────────────────────
  injectSignal(type: SignalType, metadata?: Record<string, unknown>) {
    this.emit(type, metadata);
  }

  // ─── Internals ──────────────────────────────────────────────────────────────
  private emit(type: SignalType, metadata?: Record<string, unknown>) {
    // Deduplicate: skip if same signal emitted in last 10s
    const recent = this.signals.find(
      s => s.type === type && Date.now() - s.timestamp < 10_000
    );
    if (recent) return;

    const signal: Signal = { type, timestamp: Date.now(), metadata };
    this.signals.push(signal);
    this.callback([...this.signals]);
  }

  private addListener(el: EventTarget, event: string, fn: EventListenerOrEventListenerObject) {
    el.addEventListener(event, fn as EventListener);
    this.listeners.push({ el, event, fn: fn as EventListener });
  }

  getSignals(): Signal[] {
    return [...this.signals];
  }
}
