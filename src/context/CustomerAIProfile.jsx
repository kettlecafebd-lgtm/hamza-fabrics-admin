import React, { createContext, useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';

/**
 * CustomerAIProfile — Module 6 Integration
 *
 * Provides customer affinity tags and AI scoring data to the frontend.
 * Used by the Shop page to personalize product recommendations
 * and auto-select preferred variants.
 *
 * Data sources:
 * - customer_scores table (tags, score)
 * - customer_analytics table (fraud_metrics, success_score)
 * - Past order history (inferred preferences)
 */
export const CustomerAIProfileContext = createContext();

export const CustomerAIProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState({
    phone: null,
    score: 0,
    tags: [],          // e.g. ['Trusted', 'High Risk', 'Repeat Buyer']
    affinityTags: [],   // e.g. ['Black Cotton', 'Unstitched', 'Premium']
    preferredColors: [],
    preferredCategories: [],
    totalOrders: 0,
    successRate: 100,
    isLoading: false,
  });

  const loadProfile = async (phone) => {
    if (!phone) return;
    setProfile(prev => ({ ...prev, isLoading: true, phone }));

    try {
      // Fetch customer score (Module 6)
      const scoreRes = await fetch(`${API_BASE_URL}/api/auto-learning/customer-score/${phone}`, {
        credentials: 'include',
      });
      const scoreData = await scoreRes.json();

      // Fetch customer analytics for fraud metrics
      const analyticsRes = await fetch(`${API_BASE_URL}/api/customers/${phone}/metrics`, {
        credentials: 'include',
      });
      const analyticsData = await analyticsRes.json();

      // Fetch THIS customer's order history to infer preferences.
      // Previously this hit /api/customers/orders with no filter — every order in
      // the system, for one shopper's colour affinity (and an IDOR: `phone` came
      // from the caller). Scoped + capped now.
      const orderParams = new URLSearchParams({
        phone,
        limit: '50',
        fields: 'affinity',   // name/sku/category only — no billing, no metrics, no blobs
      });
      const ordersRes = await fetch(`${API_BASE_URL}/api/customers/orders?${orderParams}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('customerToken') || ''}` },
        credentials: 'include',
      });
      const ordersData = await ordersRes.json();

      // Infer affinity tags from order history
      const affinityTags = [];
      const preferredColors = [];
      const preferredCategories = [];
      const orderProducts = [];

      if (ordersData.success && ordersData.data) {
        for (const order of ordersData.data) {
          try {
            const items = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
            for (const item of items) {
              const name = (item.productName || item.name || '').toLowerCase();
              const cat = (item.category || '').toLowerCase();

              // Infer color preferences
              const colors = ['black', 'white', 'red', 'blue', 'green', 'navy', 'maroon', 'beige', 'grey', 'pink'];
              for (const c of colors) {
                if (name.includes(c) && !preferredColors.includes(c)) {
                  preferredColors.push(c);
                }
              }

              // Infer fabric preferences
              const fabrics = ['cotton', 'silk', 'linen', 'chiffon', 'georgette', 'muslin', 'jamdani'];
              for (const f of fabrics) {
                if (name.includes(f) && !affinityTags.includes(f)) {
                  affinityTags.push(f);
                }
              }

              // Infer style preferences
              if (name.includes('unstitched')) affinityTags.push('Unstitched');
              if (name.includes('stitched')) affinityTags.push('Stitched');
              if (name.includes('set')) affinityTags.push('Set');
              if (name.includes('saree') || name.includes('sari')) affinityTags.push('Saree');
              if (cat && !preferredCategories.includes(cat)) preferredCategories.push(cat);

              orderProducts.push(name);
            }
          } catch (_) {}
        }
      }

      setProfile({
        phone,
        score: scoreData.data?.score || 0,
        tags: scoreData.data?.tags || [],
        affinityTags,
        preferredColors: preferredColors.slice(0, 5),
        preferredCategories: preferredCategories.slice(0, 3),
        // Prefer the server's true count — the history above is capped at 50.
        totalOrders: analyticsData.data?.total_orders ?? ordersData.total ?? ordersData.data?.length ?? 0,
        successRate: analyticsData.data?.success_rate || 100,
        isLoading: false,
      });
    } catch (err) {
      console.error('[CustomerAIProfile] Load error:', err.message);
      setProfile(prev => ({ ...prev, isLoading: false }));
    }
  };

  /**
   * Check if a product matches the customer's AI profile
   * Returns: { isRecommended: boolean, matchScore: number, matchReasons: string[] }
   */
  const getProductMatch = (product) => {
    if (!product || profile.affinityTags.length === 0) {
      return { isRecommended: false, matchScore: 0, matchReasons: [] };
    }

    const name = (product.name || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    let matchScore = 0;
    const matchReasons = [];

    // Check affinity tag matches
    for (const tag of profile.affinityTags) {
      if (name.includes(tag.toLowerCase())) {
        matchScore += 30;
        matchReasons.push(tag);
      }
    }

    // Check color preference matches
    for (const color of profile.preferredColors) {
      if (name.includes(color)) {
        matchScore += 20;
        matchReasons.push(color);
      }
    }

    // Check category matches
    for (const cat of profile.preferredCategories) {
      if (category.includes(cat.toLowerCase())) {
        matchScore += 15;
        matchReasons.push(cat);
      }
    }

    return {
      isRecommended: matchScore >= 30,
      matchScore: Math.min(100, matchScore),
      matchReasons: [...new Set(matchReasons)].slice(0, 3),
    };
  };

  /**
   * Get the best default variant for a product based on customer preferences
   */
  const getDefaultVariant = (variants) => {
    if (!variants || variants.length === 0 || profile.preferredColors.length === 0) {
      return variants?.[0] || null;
    }

    // Try to find a variant matching preferred color
    for (const preferredColor of profile.preferredColors) {
      const match = variants.find(v =>
        (v.color || '').toLowerCase().includes(preferredColor)
      );
      if (match) return match;
    }

    return variants[0];
  };

  return (
    <CustomerAIProfileContext.Provider value={{ profile, loadProfile, getProductMatch, getDefaultVariant }}>
      {children}
    </CustomerAIProfileContext.Provider>
  );
};
