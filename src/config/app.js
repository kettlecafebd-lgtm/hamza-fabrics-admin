const env = import.meta.env;

export const appConfig = {
  apiUrl: env.VITE_API_URL || 'http://localhost:5000',
  gtmId: env.VITE_GTM_CONTAINER_ID || '',
  siteName: env.VITE_SITE_NAME || 'Hamza Fabrics',
  siteDescription: env.VITE_SITE_DESCRIPTION || 'Premium Unstitched Fabrics',
  contactEmail: env.VITE_CONTACT_EMAIL || 'contact@hamzafabrics.com',
  contactPhone: env.VITE_CONTACT_PHONE || '+8801700000000',
  address: env.VITE_ADDRESS || 'Dhaka, Bangladesh',
  currency: env.VITE_CURRENCY || 'BDT',
  deliveryInside: Number(env.VITE_DELIVERY_INSIDE) || 80,
  deliveryOutside: Number(env.VITE_DELIVERY_OUTSIDE) || 150,
  freeDeliveryMin: Number(env.VITE_FREE_DELIVERY_MIN) || 3,
};

export default appConfig;
