export const initFbq = (pixelId) => {
  if (!pixelId || window.fbqInitialized) return;
  window.fbqInitialized = true;

  const n = window.fbq = function() {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = !0;
  n.version = '2.0';
  n.queue = [];

  const t = document.createElement('script');
  t.async = !0;
  t.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(t);

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
};

export const fbqEvent = (event, params = {}) => {
  if (!window.fbq) return;
  const deviceUuid = localStorage.getItem('hamzabi_device_uuid') || '';
  window.fbq('track', event, { ...params, device_uuid: deviceUuid });
};
