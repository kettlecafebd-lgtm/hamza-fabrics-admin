import { appConfig } from '../config/app';

const FALLBACK_ID = appConfig.gtmId;

export const initGTM = (gtmId) => {
  const id = gtmId || FALLBACK_ID;
  if (!id || id === 'GTM-XXXXXXX' || window.gtmInitialized) return;
  window.gtmInitialized = true;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  const gtmScript = document.createElement('script');
  gtmScript.async = true;
  gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(gtmScript);
};

export const pushEvent = (event, data = {}) => {
  if (!window.dataLayer) window.dataLayer = [];
  const deviceUuid = localStorage.getItem('hamzabi_device_uuid') || '';
  window.dataLayer.push({ event, device_uuid: deviceUuid, ...data });
};

export const trackViewItem = (product) => {
  pushEvent('view_item', {
    ecommerce: {
      currency: 'BDT',
      value: parseFloat(product.price) || 0,
      items: [{
        item_id: String(product.id || product.sku || ''),
        item_name: product.name,
        price: parseFloat(product.price) || 0,
        item_category: product.category || '',
        item_variant: product.selectedSize || '',
        quantity: 1,
      }]
    }
  });
};

export const trackViewItemList = (items, listName = 'Shop Page') => {
  pushEvent('view_item_list', {
    ecommerce: {
      items: (items || []).map(item => ({
        item_id: String(item.id || item.sku || ''),
        item_name: item.name,
        price: parseFloat(item.price) || 0,
        item_category: item.category || '',
        index: item.index || 0,
      })),
      item_list_name: listName,
    }
  });
};

export const trackAddToCart = (product, quantity = 1) => {
  pushEvent('add_to_cart', {
    ecommerce: {
      currency: 'BDT',
      value: (parseFloat(product.price) || 0) * quantity,
      items: [{
        item_id: String(product.id || product.sku || ''),
        item_name: product.name,
        price: parseFloat(product.price) || 0,
        item_category: product.category || '',
        item_variant: product.selectedSize || '',
        quantity,
      }]
    }
  });
};

export const trackRemoveFromCart = (product) => {
  pushEvent('remove_from_cart', {
    ecommerce: {
      currency: 'BDT',
      value: parseFloat(product.price) || 0,
      items: [{
        item_id: String(product.id || product.sku || ''),
        item_name: product.name,
        price: parseFloat(product.price) || 0,
        item_category: product.category || '',
        item_variant: product.selectedSize || '',
        quantity: product.quantity || 1,
      }]
    }
  });
};

export const trackBeginCheckout = (cartItems, total) => {
  pushEvent('begin_checkout', {
    ecommerce: {
      currency: 'BDT',
      value: parseFloat(total) || 0,
      items: (cartItems || []).map(item => ({
        item_id: String(item.id || item.sku || ''),
        item_name: item.name,
        price: parseFloat(item.price) || 0,
        item_category: item.category || '',
        item_variant: item.selectedSize || '',
        quantity: item.quantity || 1,
      }))
    }
  });
};

export const trackPurchase = (orderData) => {
  const { order, items } = orderData;
  pushEvent('purchase', {
    ecommerce: {
      transaction_id: order.order_code || String(order.id || ''),
      value: parseFloat(order.total_amount || order.total || 0),
      tax: 0,
      shipping: parseFloat(order.delivery_charge || 0),
      currency: 'BDT',
      coupon: order.promo_code || '',
      items: (items || []).map(item => ({
        item_id: String(item.product_id || item.id || ''),
        item_name: item.name || item.product_name || '',
        price: parseFloat(item.price || item.price_at_purchase || 0),
        quantity: item.quantity || 1,
      }))
    }
  });
};

export const trackSearch = (searchTerm, resultsCount) => {
  pushEvent('search', {
    search_term: searchTerm,
    results_count: resultsCount || 0,
  });
};


