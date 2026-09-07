const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const fallbackApiUrl = import.meta.env.DEV
  ? 'http://localhost:5000'
  : globalThis.location?.origin || '';
const apiUrl = configuredApiUrl || fallbackApiUrl;

console.info(
  `[app-config] API URL: ${apiUrl || '(empty)'} (${configuredApiUrl ? 'VITE_API_URL' : 'fallback'})`,
);

export const appConfig = {
  apiUrl,
  gtmId: import.meta.env.VITE_GTM_CONTAINER_ID || '',
  siteName: import.meta.env.VITE_SITE_NAME || 'Hamza Fabrics',
  siteDescription: import.meta.env.VITE_SITE_DESCRIPTION || 'Premium Unstitched Fabrics',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'contact@hamzafabrics.com',
  contactPhone: import.meta.env.VITE_CONTACT_PHONE || '+8801700000000',
  address: import.meta.env.VITE_ADDRESS || 'Dhaka, Bangladesh',
  currency: import.meta.env.VITE_CURRENCY || 'BDT',
  deliveryInside: Number(import.meta.env.VITE_DELIVERY_INSIDE) || 80,
  deliveryOutside: Number(import.meta.env.VITE_DELIVERY_OUTSIDE) || 150,
  freeDeliveryMin: Number(import.meta.env.VITE_FREE_DELIVERY_MIN) || 3,
};

export default appConfig;
