import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { ThemeContext } from '../context/ThemeContext';
import API_BASE_URL from '../config/api';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(null);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  
  const { cartCount, setIsCartOpen } = useContext(CartContext);
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  
  const navigate = useNavigate();

  const handleNavSearch = (e) => {
    e.preventDefault();
    const q = navSearch.trim();
    if (q) navigate(`/shop?search=${encodeURIComponent(q)}`);
    else navigate('/shop');
  };

  const [customer, setCustomer] = useState(() => {
    const data = localStorage.getItem('customerData');
    return data ? JSON.parse(data) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerData');
    setCustomer(null);
    setCustomerDropdownOpen(false);
    navigate('/shop');
  };

  useEffect(() => {
    const handleStorage = () => {
      const data = localStorage.getItem('customerData');
      setCustomer(data ? JSON.parse(data) : null);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const [siteSettings, setSiteSettings] = useState({
    storeName: 'Hamza Fabrics',
    logoUrl: '',
    logoSize: 40,
    navigationMenus: []
  });

  // 🟢 Favicon আপডেট করার ফাংশন
  const updateFavicon = (url) => {
    if (!url) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = url;
  };

  useEffect(() => {
    const fetchSettings = async () => {
      // 1. Prothome localStorage theke load korbe (Jate fast load hoy)
      const savedSettings = localStorage.getItem('siteSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSiteSettings({
          storeName: parsed.storeName || 'Hamza Fabrics',
          logoUrl: parsed.logoUrl || '',
          logoSize: parsed.logoSize || 40,
          navigationMenus: parsed.navigationMenus || []
        });
        // লোকাল স্টোরেজ থেকে ফেভিকন সেট করা
        if (parsed.logoUrl) updateFavicon(parsed.logoUrl);
      }

      // 2. Erpor backend theke latest data anbe (Kono user notun dhukleo pabe)
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/system`); 
        const data = await response.json();

        if (data.success && data.data) {
          const apiSettings = data.data;
          const newLogoUrl = apiSettings.logo_url || '';
          
          setSiteSettings({
            storeName: apiSettings.brand_first_name ? `${apiSettings.brand_first_name} ${apiSettings.brand_last_name}` : (apiSettings.storeName || 'Hamza Fabrics'),
            logoUrl: newLogoUrl,
            logoSize: apiSettings.logo_size || 40,
            navigationMenus: apiSettings.navigation_menus ? (typeof apiSettings.navigation_menus === 'string' ? JSON.parse(apiSettings.navigation_menus) : apiSettings.navigation_menus) : []
          });
          
          // API থেকে প্রাপ্ত লোগো দিয়ে ফেভিকন আপডেট করা
          if (newLogoUrl) updateFavicon(newLogoUrl);

          // Update localstorage silently
          const currentLocal = JSON.parse(localStorage.getItem('siteSettings') || '{}');
          localStorage.setItem('siteSettings', JSON.stringify({...currentLocal, ...apiSettings}));
        }
      } catch (error) {
        console.error("Failed to fetch settings from API:", error);
      }
    };
    
    fetchSettings();
    window.addEventListener('storage', fetchSettings);
    return () => window.removeEventListener('storage', fetchSettings);
  }, []);

  const handleCategoryClick = (categoryValue) => {
    setIsMobileMenuOpen(false);
    navigate(`/shop?category=${categoryValue}`);
  };

  return (
    // 🔴 Main Navbar-এ shopTheme এবং থিমের কাস্টম ক্লাস (bg-t-surface, border-t-border) যোগ করা হলো
    <nav role="navigation" aria-label="Store navigation" className={`fixed w-full z-[80] top-0 transition-all duration-300 bg-t-surface/90 backdrop-blur-xl border-b border-t-border shadow-sm ${shopTheme}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          
          {/* Left: Logo / Store Name Fix */}
          <div className="flex-shrink-0 flex items-center cursor-pointer">
            <Link to="/shop" className="flex items-center gap-3">
              {siteSettings.logoUrl && (
                <img 
                  src={siteSettings.logoUrl} 
                  alt={siteSettings.storeName} 
                  style={{ height: `${siteSettings.logoSize || 40}px` }} 
                  className="w-auto object-contain transition-all duration-300" 
                />
              )}
              <h1 className="text-xl sm:text-2xl font-black font-serif tracking-widest uppercase text-t-main">
                {siteSettings.storeName}
              </h1>
            </Link>
          </div>

          {/* Center: Desktop Menu with Dropdowns */}
          <div className="hidden md:flex items-center justify-center space-x-8 flex-1 px-8">
            {siteSettings.navigationMenus.map((menu) => {
              const hasSubMenus = menu.subMenus && menu.subMenus.trim() !== '';
              const subMenuList = hasSubMenus ? menu.subMenus.split(',').map(s => s.trim()) : [];

              return (
                <div key={menu.id} className="relative group" aria-haspopup={hasSubMenus ? 'true' : undefined}>
                  <button 
                    onClick={() => handleCategoryClick(menu.value)}
                    className="text-xs font-bold uppercase tracking-widest text-t-muted hover:text-t-primary transition-colors flex items-center gap-1 py-4"
                  >
                    {menu.name}
                    {hasSubMenus && (
                      <svg className="w-3 h-3 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    )}
                  </button>

                  {hasSubMenus && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 bg-t-surface border border-t-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 overflow-hidden transform origin-top scale-95 group-hover:scale-100">
                      <div className="py-2">
                        {subMenuList.map((sub, idx) => (
                          <button 
                            key={idx}
                            onClick={() => handleCategoryClick(sub)}
                            className="block w-full text-left px-5 py-2.5 text-xs font-bold text-t-muted hover:bg-t-base hover:text-t-primary transition-colors uppercase tracking-wider"
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            <Link to="/contact" className="text-xs font-bold uppercase tracking-widest text-t-muted hover:text-t-primary transition-colors">Contact</Link>
            <Link to="/resolution-center" className="text-xs font-bold uppercase tracking-widest text-t-muted hover:text-t-primary transition-colors">Resolution</Link>
          </div>

          {/* Right: Action Icons */}
          <div className="flex items-center gap-4 sm:gap-6">
            <form onSubmit={handleNavSearch} className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-t-muted/60" />
              <input type="text" value={navSearch} onChange={e => setNavSearch(e.target.value)}
                className="w-40 lg:w-56 bg-t-base border border-t-border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-t-primary text-t-main transition-all placeholder:text-t-muted/40"
                placeholder="Search products..." />
              {navSearch && (
                <button type="button" onClick={() => setNavSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-t-muted/50 hover:text-t-muted">
                  <X size={14} />
                </button>
              )}
            </form>

            {customer ? (
              <div className="relative">
                <button
                  onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                  aria-label="Customer menu"
                  aria-expanded={customerDropdownOpen}
                  className="w-9 h-9 rounded-full bg-t-primary text-white flex items-center justify-center text-sm font-bold uppercase hover:opacity-90 transition-opacity overflow-hidden"
                >
                  {customer.avatar_url ? <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" /> : (customer.name ? customer.name.charAt(0) : 'U')}
                </button>

                {customerDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCustomerDropdownOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-t-surface border border-t-border rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="px-5 py-4 border-b border-t-border/50">
                        <p className="font-bold text-t-main text-sm truncate">{customer.name || 'Customer'}</p>
                        <p className="text-xs text-t-muted truncate">{customer.email || ''}</p>
                      </div>
                      <div className="py-2">
                        <Link to="/account/profile" onClick={() => setCustomerDropdownOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-semibold text-t-muted hover:bg-t-base hover:text-t-primary transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          My Profile
                        </Link>
                        <Link to="/account/orders" onClick={() => setCustomerDropdownOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-semibold text-t-muted hover:bg-t-base hover:text-t-primary transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                          My Orders
                        </Link>
                      </div>
                      <div className="border-t border-t-border/50 py-2">
                        <button onClick={handleLogout} className="flex items-center gap-3 px-5 py-2.5 text-sm font-semibold text-red-500 hover:bg-t-base transition-colors w-full text-left">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/customer/login" className="hidden sm:inline-flex text-xs font-bold uppercase tracking-widest text-t-muted hover:text-t-primary transition-colors">
                Sign In
              </Link>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              aria-label="Open shopping cart"
              className="relative text-t-muted hover:text-t-primary transition-colors flex items-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              {cartCount > 0 && (
                <span aria-hidden="true" className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
                  {cartCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
              aria-expanded={isMobileMenuOpen}
              className="md:hidden text-t-muted hover:text-t-primary p-1 focus:outline-none"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel - 🔴 shopTheme ক্লাস এবং থিম ভ্যারিয়েবল যোগ করা হয়েছে */}
      <div className={`md:hidden absolute top-full left-0 w-full bg-t-surface shadow-xl border-b border-t-border transition-all duration-300 origin-top overflow-hidden ${isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'} ${shopTheme}`}>
        <div className="px-4 py-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {!customer ? (
            <div className="flex gap-3 pb-4 border-b border-t-border/50">
              <Link to="/customer/login" onClick={() => setIsMobileMenuOpen(false)} className="flex-1 text-center text-sm font-black uppercase tracking-widest bg-t-primary text-white py-3 rounded-xl hover:opacity-90 transition-opacity">
                Sign In
              </Link>
              <Link to="/customer/register" onClick={() => setIsMobileMenuOpen(false)} className="flex-1 text-center text-sm font-black uppercase tracking-widest border border-t-border text-t-main py-3 rounded-xl hover:bg-t-base transition-colors">
                Register
              </Link>
            </div>
          ) : (
            <div className="pb-4 border-b border-t-border/50 space-y-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-t-primary text-white flex items-center justify-center text-sm font-bold uppercase overflow-hidden">{customer.avatar_url ? <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" /> : (customer.name ? customer.name.charAt(0) : 'U')}</div>
                <div>
                  <p className="font-bold text-t-main text-sm">{customer.name || 'Customer'}</p>
                  <p className="text-xs text-t-muted">{customer.email || ''}</p>
                </div>
              </div>
              <Link to="/account/profile" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm font-bold text-t-muted hover:text-t-primary transition-colors py-2">
                My Profile
              </Link>
              <Link to="/account/orders" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm font-bold text-t-muted hover:text-t-primary transition-colors py-2">
                My Orders
              </Link>
              <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="block text-sm font-bold text-red-500 hover:text-red-600 transition-colors py-2">
                Sign Out
              </button>
            </div>
          )}

          {siteSettings.navigationMenus.map((menu) => {
            const hasSubMenus = menu.subMenus && menu.subMenus.trim() !== '';
            const subMenuList = hasSubMenus ? menu.subMenus.split(',').map(s => s.trim()) : [];
            const isDropdownOpen = mobileDropdownOpen === menu.id;

            return (
              <div key={menu.id} className="border-b border-t-border/50">
                <div className="flex justify-between items-center py-2">
                  <button 
                    onClick={() => handleCategoryClick(menu.value)}
                    className="text-sm font-black uppercase tracking-widest text-t-main text-left flex-1 hover:text-t-primary transition-colors"
                  >
                    {menu.name}
                  </button>
                  {hasSubMenus && (
                    <button 
                      onClick={() => setMobileDropdownOpen(isDropdownOpen ? null : menu.id)}
                      className="p-2 bg-t-base rounded-lg text-t-muted hover:text-t-primary"
                    >
                      <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                  )}
                </div>

                {hasSubMenus && isDropdownOpen && (
                  <div className="pl-4 py-2 space-y-3 bg-t-base/50 rounded-lg mb-2">
                    {subMenuList.map((sub, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleCategoryClick(sub)}
                        className="block w-full text-left text-xs font-bold text-t-muted hover:text-t-primary uppercase tracking-widest transition-colors"
                      >
                        - {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <Link to="/contact" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left text-sm font-black uppercase tracking-widest text-t-main py-2 hover:text-t-primary transition-colors">
            Contact Us
          </Link>
          <Link to="/resolution-center" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left text-sm font-black uppercase tracking-widest text-t-main py-2 hover:text-t-primary transition-colors">
            Resolution
          </Link>
        </div>
      </div>
    </nav>
  );
}