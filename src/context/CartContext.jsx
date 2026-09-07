import React, { createContext, useState } from 'react';
import API_BASE_URL from '../config/api';
import { trackAddToCart as gtmAddToCart, trackRemoveFromCart as gtmRemoveFromCart } from '../lib/gtm';
import { fbqEvent } from '../lib/fbq';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // 🔴 Updated addToCart logic with Marketing Tracking
  const addToCart = (product) => {
    const size = product.selectedSize || null; // Extract size from product object

    setCart((prev) => {
      // Match strictly by ID and Size
      const existingItem = prev.find(item => item.id === product.id && item.selectedSize === size);
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id && item.selectedSize === size
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    
    setIsCartOpen(true); 

    // 🟢 Layer 1: The Senses — GTM dataLayer push
    gtmAddToCart(product, 1);
    fbqEvent('AddToCart', {
      content_ids: [String(product.id || product.sku || '')],
      content_type: 'product',
      value: parseFloat(product.price) || 0,
      currency: 'BDT'
    });

    // 🟢 Layer 2: The Gatekeeper — Server-side tracking (backup for ad-blockers)
    try {
      fetch(`${API_BASE_URL}/api/marketing/track-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'AddToCart',
          eventData: {
            value: parseFloat(product.price),
            url: window.location.href,
            items: [{ 
              item_id: product.id?.toString(), 
              item_name: product.name, 
              price: parseFloat(product.price), 
              quantity: 1,
              size: size
            }]
          }
        })
      }).catch(err => console.error("AddToCart tracking failed (Network):", err));
    } catch (err) {
      console.error("AddToCart tracking error:", err);
    }
  };

  const updateQuantity = (id, size, delta) => {
    setCart(prev => prev.map(item => {
      // Match by ID and Size here as well
      if (item.id === id && item.selectedSize === size) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  // 🔴 Updated removeFromCart logic with Marketing Tracking
  const removeFromCart = (id, size) => {
    // ফাইন্ড প্রোডাক্ট বিফোর রিমুভিং (ট্র্যাকিং এর জন্য ডেটা দরকার)
    const itemToRemove = cart.find(item => item.id === id && item.selectedSize === size);

    setCart(prev => prev.filter(item => !(item.id === id && item.selectedSize === size)));

    // 🟢 Layer 1: The Senses — GTM dataLayer push
    if (itemToRemove) gtmRemoveFromCart(itemToRemove);

    // 🟢 Layer 2: The Gatekeeper — Server-side tracking
    if (itemToRemove) {
      try {
        fetch(`${API_BASE_URL}/api/marketing/track-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName: 'RemoveFromCart',
            eventData: {
              value: parseFloat(itemToRemove.price) * itemToRemove.quantity,
              url: window.location.href,
              items: [{ 
                item_id: itemToRemove.id?.toString(), 
                item_name: itemToRemove.name, 
                price: parseFloat(itemToRemove.price), 
                quantity: itemToRemove.quantity,
                size: itemToRemove.selectedSize
              }]
            }
          })
        }).catch(err => console.error("RemoveFromCart tracking failed (Network):", err));
      } catch (err) {
        console.error("RemoveFromCart tracking error:", err);
      }
    }
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, cartCount, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
};