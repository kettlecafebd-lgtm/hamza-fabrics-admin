import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Monitor, BarChart3, Settings, Globe } from 'lucide-react';
import API_BASE_URL from '../config/api';

/**
 * Sidebar V2.0 — Restructured for HamzaBI V2.0
 * Sections: Command Center | Orders | Products | Customers | Intelligence | Reports | Settings
 */
const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [brand, setBrand] = useState({ firstName: 'Hamza', lastName: 'Fabrics', tagline: 'Intelligent Commerce' });

  // ── Active section detection (for auto-expand on route) ──
  const isCommandCenter = location.pathname === '/admin/command-center' || location.pathname === '/admin/inbox' || location.pathname === '/admin/financial' || location.pathname === '/admin/marketing-automation';
  const isOrders = location.pathname.startsWith('/orders') || location.pathname.startsWith('/admin/orders') || location.pathname.startsWith('/couriers') || location.pathname.startsWith('/admin/rma');
  const isProducts = location.pathname.startsWith('/products') || location.pathname.startsWith('/categories') || location.pathname.startsWith('/inventory') || location.pathname.startsWith('/smart-restock') || location.pathname.startsWith('/bulk-product-upload') || location.pathname.startsWith('/combo-builder') || location.pathname.startsWith('/stock-network');
  const isCustomers = location.pathname.startsWith('/customers') || location.pathname.startsWith('/admin/crm');
  const isIntelligence = location.pathname.startsWith('/fraud-checker');
  const isReports = location.pathname.startsWith('/order-report') || location.pathname.startsWith('/employee-report');
  const isSettings = location.pathname === '/settings' || location.pathname === '/admin/marketing';

  // ── Toggle state for each section ──
  const [openSections, setOpenSections] = useState({});
  const toggle = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const isSectionOpen = (key, activeOnRoute) => openSections[key] !== undefined ? openSections[key] : activeOnRoute;

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/settings/system`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setBrand({ firstName: data.data.brand_first_name || 'Hamza', lastName: data.data.brand_last_name || 'Fabrics', tagline: data.data.tagline || 'Intelligent Commerce' });
        }
      }).catch(() => {});
  }, []);

  const linkClass = (path) => {
    const isActive = location.pathname === path;
    return `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all duration-200 font-semibold text-sm ${isActive ? 'bg-t-primary text-white shadow-md shadow-t-primary/20' : 'text-t-muted hover:bg-t-primary/10 hover:text-t-primary'}`;
  };

  const subLinkClass = (path) => {
    const isActive = location.pathname === path;
    return `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-medium ${isActive ? 'bg-t-primary/10 text-t-primary' : 'text-t-muted hover:text-t-primary hover:bg-t-primary/5'}`;
  };

  const dropdownBtnClass = (isOpenState) =>
    `w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-all duration-200 font-semibold text-sm ${isOpenState ? 'bg-t-primary/5 text-t-primary' : 'text-t-muted hover:bg-t-primary/10 hover:text-t-primary'}`;

  const Section = ({ open, toggle, color, icon: Icon, label, children, active }) => (
    <div>
      <button onClick={toggle} aria-expanded={open} className={dropdownBtnClass(open)}>
        <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
          <span className="flex items-center justify-center shrink-0" style={{ color }}><Icon className="w-5 h-5" strokeWidth={1.5} /></span>
          {!isCollapsed && <span className="text-[13px]">{label}</span>}
        </div>
        {!isCollapsed && <span className="text-[10px] transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>}
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
        <div className="ml-4 pl-4 border-l-2 border-t-border space-y-0.5">{children}</div>
      </div>
    </div>
  );

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} aria-label="Open sidebar menu" className="md:hidden fixed top-4 left-4 z-40 p-2 bg-t-surface text-t-primary rounded-lg shadow-md border border-t-border hover:bg-t-primary/10 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300" onClick={() => setIsOpen(false)} />}

      <div className={`fixed md:sticky top-0 left-0 z-50 ${isCollapsed ? 'w-20' : 'w-max min-w-[11rem] max-w-[14rem]'} bg-t-surface text-t-main border-r border-t-border flex flex-col h-screen transition-all duration-300 ease-in-out relative ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Brand */}
        <div className="p-3 md:p-4 border-b border-t-border flex items-center justify-between gap-2">
          {isCollapsed ? (
            <div className="flex-1 flex flex-col items-center overflow-hidden">
              <h1 className="text-lg font-aeonik-bold tracking-wider text-t-primary whitespace-nowrap">{brand.firstName.charAt(0)}{brand.lastName.charAt(0)}</h1>
              <div className="w-full overflow-hidden mt-1"><p className="text-[7px] text-t-muted uppercase tracking-widest font-semibold whitespace-nowrap animate-marquee">{brand.tagline}</p></div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-aeonik-bold tracking-wider text-t-primary truncate">{brand.firstName}<span className="text-t-main">{brand.lastName}</span></h1>
              </div>
              <p className="text-[10px] text-t-muted mt-0.5 uppercase tracking-widest font-medium truncate">{brand.tagline}</p>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setIsOpen(false)} aria-label="Close sidebar menu" className="md:hidden text-t-muted hover:text-red-500 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <nav role="navigation" aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">

          {/* 1. Command Center */}
          <Section open={isSectionOpen('cmd', isCommandCenter)} toggle={() => toggle('cmd')} color="#3B82F6" icon={LayoutDashboard} label="Command Center" active={isCommandCenter}>
            <Link to="/admin/command-center" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/command-center')}><span className="text-[10px] text-[#3B82F6] mr-[-4px]">●</span><span className="text-xs">Command Center</span></Link>
            <Link to="/admin/inbox" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/inbox')}><span className="text-[10px] text-[#3B82F6] mr-[-4px]">●</span><span className="text-xs">Unified Inbox</span></Link>
            <Link to="/admin/financial" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/financial')}><span className="text-[10px] text-[#3B82F6] mr-[-4px]">●</span><span className="text-xs">Financial Dashboard</span></Link>
            <Link to="/admin/marketing-automation" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/marketing-automation')}><span className="text-[10px] text-[#3B82F6] mr-[-4px]">●</span><span className="text-xs">Marketing Automation</span></Link>
          </Section>

          {/* 2. Orders & Fulfillment */}
          <Section open={isSectionOpen('orders', isOrders)} toggle={() => toggle('orders')} color="#F59E0B" icon={ShoppingCart} label="Orders & Fulfillment" active={isOrders}>
            <Link to="/orders" onClick={() => setIsOpen(false)} className={subLinkClass('/orders')}><span className="text-[10px] text-[#F59E0B] mr-[-4px]">●</span><span className="text-xs">All Orders</span></Link>
            <Link to="/admin/orders/create" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/orders/create')}><span className="text-[10px] text-[#F59E0B] mr-[-4px]">●</span><span className="text-xs">+ New Order</span></Link>
            <Link to="/couriers" onClick={() => setIsOpen(false)} className={subLinkClass('/couriers')}><span className="text-[10px] text-[#F59E0B] mr-[-4px]">●</span><span className="text-xs">Courier Management</span></Link>
            <Link to="/admin/rma" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/rma')}><span className="text-[10px] text-[#F59E0B] mr-[-4px]">●</span><span className="text-xs">RMA Center</span></Link>
          </Section>

          {/* 3. Products & Inventory */}
          <Section open={isSectionOpen('products', isProducts)} toggle={() => toggle('products')} color="#8B5CF6" icon={Package} label="Products & Inventory" active={isProducts}>
            <Link to="/products" onClick={() => setIsOpen(false)} className={subLinkClass('/products')}><span className="text-[10px] text-[#8B5CF6] mr-[-4px]">●</span><span className="text-xs">All Products</span></Link>
            <Link to="/categories" onClick={() => setIsOpen(false)} className={subLinkClass('/categories')}><span className="text-[10px] text-[#8B5CF6] mr-[-4px]">●</span><span className="text-xs">Categories</span></Link>
            <Link to="/inventory" onClick={() => setIsOpen(false)} className={subLinkClass('/inventory')}><span className="text-[10px] text-[#8B5CF6] mr-[-4px]">●</span><span className="text-xs">Inventory Dashboard</span></Link>
            <Link to="/smart-restock" onClick={() => setIsOpen(false)} className={subLinkClass('/smart-restock')}><span className="text-[10px] text-[#8B5CF6] mr-[-4px]">●</span><span className="text-xs">Smart Restock</span></Link>
            <Link to="/bulk-product-upload" onClick={() => setIsOpen(false)} className={subLinkClass('/bulk-product-upload')}><span className="text-[10px] text-[#8B5CF6] mr-[-4px]">●</span><span className="text-xs">Bulk Product Upload</span></Link>
            <Link to="/combo-builder" onClick={() => setIsOpen(false)} className={subLinkClass('/combo-builder')}><span className="text-[10px] text-[#8B5CF6] mr-[-4px]">●</span><span className="text-xs">🎯 Combo Builder</span></Link>
            <Link to="/stock-network" onClick={() => setIsOpen(false)} className={subLinkClass('/stock-network')}><span className="text-[10px] text-[#8B5CF6] mr-[-4px]">●</span><span className="text-xs">🕸️ Stock Network</span></Link>
          </Section>

          {/* 4. Customers & CRM */}
          <Section open={isSectionOpen('customers', isCustomers)} toggle={() => toggle('customers')} color="#10B981" icon={Users} label="Customers & CRM" active={isCustomers}>
            <Link to="/customers" onClick={() => setIsOpen(false)} className={subLinkClass('/customers')}><span className="text-[10px] text-[#10B981] mr-[-4px]">●</span><span className="text-xs">Customer List</span></Link>
            <Link to="/admin/crm" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/crm')}><span className="text-[10px] text-[#10B981] mr-[-4px]">●</span><span className="text-xs">Abandoned Carts</span></Link>
          </Section>

          {/* 5. Intelligence */}
          <Section open={isSectionOpen('intel', isIntelligence)} toggle={() => toggle('intel')} color="#3B82F6" icon={Monitor} label="Intelligence" active={isIntelligence}>
            <Link to="/fraud-checker" onClick={() => setIsOpen(false)} className={subLinkClass('/fraud-checker')}><span className="text-[10px] text-[#3B82F6] mr-[-4px]">●</span><span className="text-xs">Fraud Checker</span></Link>
          </Section>

          {/* 6. Reports */}
          <Section open={isSectionOpen('reports', isReports)} toggle={() => toggle('reports')} color="#F59E0B" icon={BarChart3} label="Reports" active={isReports}>
            <Link to="/analytics" onClick={() => setIsOpen(false)} className={subLinkClass('/analytics')}><span className="text-[10px] text-[#F59E0B] mr-[-4px]">●</span><span className="text-xs">📊 Analytics Dashboard</span></Link>
            <Link to="/order-report" onClick={() => setIsOpen(false)} className={subLinkClass('/order-report')}><span className="text-[10px] text-[#F59E0B] mr-[-4px]">●</span><span className="text-xs">Order Report</span></Link>
            <Link to="/employee-report" onClick={() => setIsOpen(false)} className={subLinkClass('/employee-report')}><span className="text-[10px] text-[#F59E0B] mr-[-4px]">●</span><span className="text-xs">Employee Report</span></Link>
          </Section>

          {/* 7. Settings */}
          <Section open={isSectionOpen('settings', isSettings)} toggle={() => toggle('settings')} color="#64748B" icon={Settings} label="Settings" active={isSettings}>
            <Link to="/settings" onClick={() => setIsOpen(false)} className={subLinkClass('/settings')}><span className="text-[10px] text-[#64748B] mr-[-4px]">●</span><span className="text-xs">System Configuration</span></Link>
            <Link to="/admin/marketing" onClick={() => setIsOpen(false)} className={subLinkClass('/admin/marketing')}><span className="text-[10px] text-[#64748B] mr-[-4px]">●</span><span className="text-xs">Marketing Tracking</span></Link>
          </Section>

          {/* Live Storefront */}
          <div className="pt-3 mt-3 border-t border-t-border pb-4">
            <Link to="/shop" target="_blank" onClick={() => setIsOpen(false)} className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-t-muted hover:bg-t-primary/10 hover:text-t-primary transition-colors font-semibold text-sm`}>
              <span className="flex items-center justify-center shrink-0" style={{ color: '#8B5CF6' }}><Globe className="w-5 h-5" strokeWidth={1.5} /></span>
              {!isCollapsed && <span className="text-[13px]">Live Storefront</span>}
            </Link>
          </div>

          {/* Collapse Toggle */}
          <button onClick={() => setIsCollapsed(!isCollapsed)} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden md:flex absolute top-4 z-50 items-center justify-center w-5 h-5 bg-t-surface text-t-muted hover:text-t-primary border border-t-border rounded-full shadow-sm hover:bg-t-primary/10 transition-all duration-300" style={{ right: '-10px' }}>
            <svg className={`w-2.5 h-2.5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={isCollapsed ? 'M13 17l5-5m0 0l-5-5m5 5H6' : 'M11 17l-5-5m0 0l5-5m-5 5h12'} /></svg>
          </button>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
