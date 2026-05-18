const fetch = require('node-fetch');

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;

const CART_QUERY = `
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      lines(first: 10) {
        nodes {
          quantity
          merchandise {
            ... on ProductVariant {
              title
              price { amount currencyCode }
              product { title description tags }
            }
          }
        }
      }
      cost {
        subtotalAmount { amount }
        totalAmount { amount }
      }
      discountCodes { code applicable }
    }
  }
`;

/**
 * Fetch cart data from Shopify Storefront API.
 * FAILURE HANDLING #2: If Shopify is down, returns null — caller should use cached data.
 */
async function fetchCart(cartId) {
  if (!SHOPIFY_DOMAIN || !STOREFRONT_TOKEN) {
    console.warn('[Shopify] No credentials configured, using mock data');
    return getMockCart();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: CART_QUERY, variables: { cartId } }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
    const json = await res.json();

    if (json.errors) throw new Error(json.errors[0].message);

    return normalizeCart(json.data?.cart);

  } catch (err) {
    // FAILURE HANDLING #2: Shopify API down — return null so session uses cached data
    console.error('[Shopify] fetchCart failed:', err.message);
    return null;
  }
}

function normalizeCart(rawCart) {
  if (!rawCart) return null;
  return {
    items: rawCart.lines?.nodes?.map(line => ({
      quantity: line.quantity,
      title: line.merchandise?.product?.title,
      variantTitle: line.merchandise?.title,
      price: parseFloat(line.merchandise?.price?.amount || 0),
      currency: line.merchandise?.price?.currencyCode,
      description: line.merchandise?.product?.description,
      tags: line.merchandise?.product?.tags || [],
    })) || [],
    subtotal: parseFloat(rawCart.cost?.subtotalAmount?.amount || 0),
    total: parseFloat(rawCart.cost?.totalAmount?.amount || 0),
    discountCodes: rawCart.discountCodes || [],
  };
}

/**
 * Apply a discount code via Storefront API.
 * FAILURE HANDLING #6: Invalid discount code detection.
 */
async function applyDiscountCode(cartId, code) {
  if (!SHOPIFY_DOMAIN || !STOREFRONT_TOKEN) {
    return { success: false, reason: 'No Shopify credentials configured' };
  }
  try {
    const mutation = `
      mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
        cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
          cart { discountCodes { code applicable } }
          userErrors { field message }
        }
      }
    `;
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables: { cartId, discountCodes: [code] } }),
    });
    const json = await res.json();
    const updated = json.data?.cartDiscountCodesUpdate;
    const applicable = updated?.cart?.discountCodes?.find(d => d.code === code)?.applicable;

    if (!applicable) {
      // FAILURE HANDLING #6: Code invalid, report back to AI to suggest alternative
      return { success: false, reason: 'Discount code not applicable', code };
    }
    return { success: true, code };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// ─── Mock data for demo / no-credentials mode ─────────────────────────────────
function getMockCart() {
  return {
    items: [
      { quantity: 1, title: 'Wireless Noise-Cancelling Headphones', variantTitle: 'Midnight Black', price: 89.99, currency: 'USD', tags: ['electronics', 'audio'] },
      { quantity: 2, title: 'Premium Cable Knit Sweater', variantTitle: 'Navy Blue / M', price: 49.99, currency: 'USD', tags: ['apparel', 'winter'] },
    ],
    subtotal: 189.97,
    total: 189.97,
    discountCodes: [],
  };
}

function getMockShippingRates() {
  return [
    { id: 'standard', title: 'Standard Shipping', price: 5.99, estimatedDays: '5-7 business days' },
    { id: 'express', title: 'Express Shipping', price: 14.99, estimatedDays: '2-3 business days' },
    { id: 'overnight', title: 'Overnight', price: 29.99, estimatedDays: 'Next business day' },
  ];
}

function getMockPolicies() {
  return `Return Policy: 30-day hassle-free returns on all items. Free return shipping on defective products.
Shipping Policy: Standard 5-7 business days, Express 2-3 days. Free standard shipping on orders over $75.
Privacy Policy: We never share your data with third parties.`;
}

module.exports = { fetchCart, applyDiscountCode, getMockCart, getMockShippingRates, getMockPolicies };
