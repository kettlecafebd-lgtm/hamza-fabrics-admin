import React, { useContext, useEffect, Suspense, lazy, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import CommandMenu from './components/ui/CommandMenu';
import RouteErrorBoundary from './components/ui/RouteErrorBoundary';

import { CartProvider } from './context/CartContext';
import { ThemeProvider, ThemeContext } from './context/ThemeContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { DeviceProvider } from './context/DeviceContext';
import { CustomerAIProfileProvider } from './context/CustomerAIProfile';
import ErrorBoundary from './components/ErrorBoundary';

// ── Layer 1: The Senses (GTM Frontend Tracking) ──
import API_BASE_URL from './config/api';
import { initGTM, pushEvent } from './lib/gtm';
import { initFbq, fbqEvent } from './lib/fbq';
import { appConfig } from './config/app';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Sidebar from './components/Sidebar';
import AdminHeader from './components/AdminHeader';
import CustomerLayout from './components/CustomerLayout';

// ── V2.0: Consolidated Pages (Tab-Based SPAs) ──
const DashboardHub = lazy(() => import('./pages/DashboardHub'));       // Overview | Live | AI | Districts
const FinancialDashboard = lazy(() => import('./pages/FinancialDashboard'));  // P&L | Expenses | Audit
const MarketingAutomation = lazy(() => import('./pages/MarketingAutomation')); // AI Ads | Cart Recovery | Auto-Call
const RMACenter = lazy(() => import('./pages/RMACenter'));              // Returns | Resolutions

// ── Core Pages ──
const Products = lazy(() => import('./pages/Products'));
const Orders = lazy(() => import('./pages/Orders'));
const Shop = lazy(() => import('./pages/Shop'));
const Contact = lazy(() => import('./pages/Contact'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Login = lazy(() => import('./pages/Login'));
const CourierManagement = lazy(() => import('./pages/CourierManagement'));
const CategoriesBrands = lazy(() => import('./pages/CategoriesBrands'));
const CustomerList = lazy(() => import('./pages/CustomerList'));
const BulkProductUpload = lazy(() => import('./pages/BulkProductUpload'));
const Settings = lazy(() => import('./pages/Settings'));
const OrderReport = lazy(() => import('./pages/OrderReport'));
const EmployeeReport = lazy(() => import('./pages/EmployeeReport'));
const MarketingSettings = lazy(() => import('./pages/admin/MarketingSettings'));
const CRMLeads = lazy(() => import('./pages/admin/CRMLeads'));
const FraudChecker = lazy(() => import('./pages/FraudChecker'));
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const CreateOrder = lazy(() => import('./pages/admin/CreateOrder'));
const SmartRestock = lazy(() => import('./pages/SmartRestock'));
const InventoryDashboard = lazy(() => import('./pages/InventoryDashboard'));
const CustomerLogin = lazy(() => import('./pages/CustomerLogin'));
const CustomerRegister = lazy(() => import('./pages/CustomerRegister'));
const Verify2FA = lazy(() => import('./pages/Verify2FA'));
const Profile = lazy(() => import('./pages/Profile'));
const CustomerOrders = lazy(() => import('./pages/CustomerOrders'));
const CustomerTrackOrder = lazy(() => import('./pages/CustomerTrackOrder'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const UnifiedInbox = lazy(() => import('./pages/UnifiedInbox'));
const ComboBuilder = lazy(() => import('./pages/ComboBuilder'));
const SharedPoolVisualizer = lazy(() => import('./pages/SharedPoolVisualizer'));
const ResolutionCenter = lazy(() => import('./pages/ResolutionCenter'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen bg-t-base">
    <div className="w-8 h-8 border-4 border-t-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const CustomerProtectedRoute = () => {
  const token = localStorage.getItem('customerToken');
  if (!token) return <Navigate to="/customer/login" replace />;
  return <Outlet />;
};

const AdminLayout = () => {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);

  useEffect(() => {
    document.documentElement.className = adminTheme;
  }, [adminTheme]);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen font-sans bg-t-base text-t-main transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <AdminHeader />
          <div className="flex-1 overflow-y-auto">
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

// ── Layer 1: The Senses — Page View Tracker (GTM + Facebook Pixel) ──
function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView();
  }, []);

  useEffect(() => {
    pushEvent('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: location.pathname,
    });
    fbqEvent('PageView');
  }, [location]);

  return null;
}

function trackPageView() {
  const envGtm = appConfig.gtmId;
  if (envGtm && envGtm !== 'GTM-XXXXXXX') {
    initGTM(envGtm);
  }
  fetch(`${API_BASE_URL}/api/marketing/settings`)
    .then(r => r.json())
    .then(data => {
      if (!data.success) return;
      if (data.data?.gtm_id && (!envGtm || envGtm === 'GTM-XXXXXXX')) {
        initGTM(data.data.gtm_id);
      }
      if (data.data?.pixel_id) {
        initFbq(data.data.pixel_id);
      }
    })
    .catch(() => {});
}

// ── Global Command Menu Trigger (Ctrl+K / Cmd+K) ──
function CommandMenuTrigger() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return <CommandMenu open={open} onClose={() => setOpen(false)} />;
}

const PORTAL_HOSTNAME = 'portal.hamzafabrics.com';

function isPortalHost() {
  const hostname = window.location.hostname.toLowerCase();
  
  // ১. প্রোডাকশন ডোমেইন অথবা লোকালহোস্টের পোর্টাল সাবডোমেইন চেক
  if (hostname === PORTAL_HOSTNAME || hostname === 'portal.localhost') {
    return true;
  }
  
  // ২. লোকালহোস্টে কাজ করার সুবিধার্থে পাথ চেক 
  // (যাতে localhost:5173/login বা /admin দিলে অ্যাডমিন প্যানেল লোড হয়)
  const pathname = window.location.pathname.toLowerCase();
  if (
    hostname === 'localhost' && 
    (pathname.startsWith('/admin') || pathname === '/login' || pathname === '/verify-2fa')
  ) {
    return true;
  }

  return false;
}

function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/shop" replace />} />
      <Route path="/customer/login" element={<CustomerLogin />} />
      <Route path="/customer/register" element={<CustomerRegister />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<CustomerLayout />}>
        <Route path="/shop" element={<Shop />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/resolution-center" element={<ResolutionCenter />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route element={<PrivacyPolicy />} path="/privacy-policy" />
        <Route element={<TermsOfService />} path="/terms-of-service" />
        <Route element={<CustomerProtectedRoute />}>
          <Route path="/account/profile" element={<Profile />} />
          <Route path="/account/orders" element={<CustomerOrders />} />
        </Route>
        <Route path="/account/track" element={<CustomerTrackOrder />} />
      </Route>

      {/* ── Catch-all Route: কোনো ভুল লিংকে গেলে শপ পেজে পাঠাবে ── */}
      <Route path="*" element={<Navigate to="/shop" replace />} />
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/verify-2fa" element={<Verify2FA />} />
      <Route path="/" element={<Navigate to="/admin/command-center" replace />} />

      <Route element={<AdminLayout />}>
        <Route path="/admin/command-center" element={<DashboardHub />} />
        <Route path="/admin/inbox" element={<UnifiedInbox />} />
        <Route path="/admin/financial" element={<FinancialDashboard />} />
        <Route path="/admin/marketing-automation" element={<MarketingAutomation />} />
        <Route path="/admin/rma" element={<RMACenter />} />
        <Route path="/products" element={<Products />} />
        <Route path="/combo-builder" element={<ComboBuilder />} />
        <Route path="/stock-network" element={<SharedPoolVisualizer />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/admin/orders/create" element={<CreateOrder />} />
        <Route path="/couriers" element={<CourierManagement />} />
        <Route path="/categories" element={<CategoriesBrands />} />
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/admin/crm" element={<CRMLeads />} />
        <Route path="/admin/cart-recovery" element={<Navigate to="/admin/marketing-automation" replace />} />
        <Route path="/bulk-product-upload" element={<BulkProductUpload />} />
        <Route path="/admin/marketing" element={<MarketingSettings />} />
        <Route path="/fraud-checker" element={<FraudChecker />} />
        <Route path="/smart-restock" element={<SmartRestock />} />
        <Route path="/inventory" element={<InventoryDashboard />} />
        <Route path="/order-report" element={<OrderReport />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/employee-report" element={<EmployeeReport />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pos" element={<Navigate to="/admin/orders/create" replace />} />
        <Route path="/verify-email/:token" element={<Navigate to="/login" replace />} />
        <Route path="/bulk-upload" element={<Navigate to="/bulk-product-upload" replace />} />
        <Route path="/district-map" element={<Navigate to="/admin/command-center" replace />} />
        <Route path="/admin/live-dashboard" element={<Navigate to="/admin/command-center" replace />} />
        <Route path="/admin/brain" element={<Navigate to="/admin/command-center" replace />} />
        <Route path="/admin/profit" element={<Navigate to="/admin/financial" replace />} />
        <Route path="/admin/financial-audit" element={<Navigate to="/admin/financial" replace />} />
        <Route path="/profit-sales" element={<Navigate to="/admin/financial" replace />} />
        <Route path="/expense-tracker" element={<Navigate to="/admin/financial" replace />} />
        <Route path="/admin/marketing-dashboard" element={<Navigate to="/admin/marketing-automation" replace />} />
        <Route path="/auto-call-center" element={<Navigate to="/admin/marketing-automation" replace />} />
        <Route path="/admin/returns" element={<Navigate to="/admin/rma" replace />} />
        <Route path="/resolution-center" element={<Navigate to="/admin/rma" replace />} />
      </Route>

      {/* ── Catch-all Route: কোনো ভুল লিংকে গেলে ড্যাশবোর্ডে পাঠাবে ── */}
      <Route path="*" element={<Navigate to="/admin/command-center" replace />} />
    </Routes>
  );
}

function DomainRoutes() {
  return isPortalHost() ? <AdminRoutes /> : <CustomerRoutes />;
}

function App() {
  useEffect(() => {
    const savedSettings = localStorage.getItem('siteSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed.faviconUrl || parsed.logoUrl) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = parsed.faviconUrl || parsed.logoUrl;
      }
      if (parsed.storeName) {
        document.title = parsed.storeName;
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DeviceProvider>
          <CustomerAIProfileProvider>
          <CartProvider>
            <WebSocketProvider>
          <Toaster 
            position="top-right" 
            reverseOrder={false}
            toastOptions={{
              duration: 3000,
              style: {
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '14px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
              },
            }}
          />
          
          <Router>
            <PageViewTracker />
            <CommandMenuTrigger />
            <RouteErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <DomainRoutes />
            </Suspense>
            </RouteErrorBoundary>
          </Router>
            </WebSocketProvider>
          </CartProvider>
          </CustomerAIProfileProvider>
        </DeviceProvider>
        </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
