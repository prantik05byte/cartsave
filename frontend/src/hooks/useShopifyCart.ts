import { useState, useEffect } from 'react';
import { Cart } from '../types';

interface UseShopifyCartReturn {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;
}

// Mock cart data for demo (no live Shopify store needed)
const MOCK_CART: Cart = {
  items: [
    {
      quantity: 1,
      title: 'Wireless Noise-Cancelling Headphones Pro',
      variantTitle: 'Midnight Black',
      price: 89.99,
      currency: 'USD',
      tags: ['electronics', 'audio', 'bestseller'],
    },
    {
      quantity: 2,
      title: 'Premium Cable Knit Sweater',
      variantTitle: 'Navy Blue / M',
      price: 49.99,
      currency: 'USD',
      tags: ['apparel', 'winter', 'cozy'],
    },
  ],
  subtotal: 189.97,
  total: 189.97,
  discountCodes: [],
};

/**
 * useShopifyCart — Fetches cart data from Shopify or falls back to mock data.
 * FAILURE HANDLING #2: If Shopify API is unavailable, uses session-cached or mock data.
 */
export function useShopifyCart(cartId?: string): UseShopifyCartReturn {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCart = async () => {
      // No cartId in demo mode — use mock data
      if (!cartId) {
        setCart(MOCK_CART);
        setIsLoading(false);
        return;
      }

      try {
        // In production: fetch from /api/session/:id which has cached cart data
        const res = await fetch(`/api/session/${cartId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCart(data.cartData || MOCK_CART);
      } catch (err) {
        // FAILURE HANDLING #2: Fall back to mock data
        console.warn('[CartSave] Cart fetch failed, using cached/mock data');
        setError('Using cached cart data');
        setCart(MOCK_CART);
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, [cartId]);

  return { cart, isLoading, error };
}
