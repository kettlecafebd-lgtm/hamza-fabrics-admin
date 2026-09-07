import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext'; 
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('General');
  const [envKeys, setEnvKeys] = useState([]);
  const [envLoading, setEnvLoading] = useState(false);
  
  const { adminTheme, shopTheme, changeAdminTheme, changeShopTheme } = useContext(ThemeContext); 

  const [settings, setSettings] = useState({
    brandFirstName: 'Hamza',
    brandLastName: 'Fabrics',
    tagline: 'Intelligent Commerce',
    orderPrefix: 'HF-',
    orderSequence: '100000',
    storeName: 'Hamza Fabrics',
    logoUrl: '',
    logoSize: 40,
    faviconUrl: '',
    deliveryChargeInside: 80,
    deliveryChargeOutside: 150,
    heroSubtitle: 'The Festive Edit',
    heroTitle: 'Elegance Woven Into Every Thread.',
    heroButtonText: 'Explore',
    heroImages: ['https://images.unsplash.com/photo-1583391733958-d20ed31e1141?q=80&w=2000'],
    heroMobileImages: ['https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=1000'], // 🔴 Mobile specific images
    footerImages: ['https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?q=80&w=1000'],
    footerTitle: 'Crafted for the modern woman.',
    footerDescription: 'Experience the finest quality fabrics, intricate embroideries, and breathtaking designs that make you stand out on every occasion.',
    footerCopyright: '© 2026 HAMZA FABRICS. ALL RIGHTS RESERVED.',
    socialLinks: { facebook: '#', instagram: '#', tiktok: '#' },
    navigationMenus: [{ id: 1, name: 'All Collections', value: 'All', subMenus: '' }],
    contactInfo: {
      address: "Mohammadpur\nDhaka, Bangladesh\n(By Appointment Only)",
      phone: "+880 1711-000000",
      email: "support@hamzafabrics.com",
      hours: "Saturday - Thursday\n10:00 AM - 8:00 PM (BDT)",
      mapEmbed: '',
      contactImages: []
    },
    isPromoEnabled: true,
    promoCodes: [],
    gridLayout: { pcCols: 4, mobileCols: 2, itemsPerPage: 12 },
    deliveryPartners: []
  });

  const themeOptions = [
    { id: 'light', name: 'Light Mode', type: 'Light', desc: 'Clean light baseline', icon: '☀️', colors: ['#F8FAFC', '#FFFFFF', '#6D28D9', '#2563EB', '#0F172A', '#64748B', '#E2E8F0'] },
    { id: 'theme-light-premium', name: 'Mint Corporate', type: 'Light', desc: 'Professional teal & navy', icon: '✦', colors: ['#F4F8F7', '#FFFFFF', '#0F766E', '#0369A1', '#102A2A', '#5C6B6B', '#D7E4E1'] },
    { id: 'theme-nordic-frost', name: 'Nordic Frost', type: 'Light', desc: 'Cool Scandinavian blue', icon: '❄️', colors: ['#F5F8FA', '#FFFFFF', '#1D5F8A', '#0E7490', '#17212B', '#627485', '#D9E2E8'] },
    { id: 'theme-rose-quartz', name: 'Rose Quartz', type: 'Light', desc: 'Soft muted rose', icon: '🌸', colors: ['#FFF7F8', '#FFFFFF', '#BE123C', '#D9467A', '#24131A', '#7C626C', '#F3D7DF'] },
    { id: 'theme-glassmorphism', name: 'Glassmorphism', type: 'Light', desc: 'Frosted glass effect', icon: '❄️', colors: ['#EEF2FF', '#FFFFFFB8', '#5B21B6', '#BE185D', '#1E1B4B', '#5B5A88', '#C7D2FEC7'] },
    { id: 'theme-sand-night', name: 'Sand & Night', type: 'Light', desc: 'Warm sand, deep ink', icon: '🏜️', colors: ['#F7F2EA', '#FFFCF7', '#173F3A', '#B7793C', '#1E293B', '#6B625A', '#E5D8C7'] },
    { id: 'theme-pop-yellow', name: 'Solar Editorial', type: 'Light', desc: 'Warm amber editorial', icon: '🌟', colors: ['#FFFBEA', '#FFFFFF', '#A16207', '#C2410C', '#1C1917', '#78716C', '#F1E3B7'] },
    { id: 'dark', name: 'Dark Mode', type: 'Dark', desc: 'Clean dark baseline', icon: '🌙', colors: ['#0F172A', '#1E293B', '#7C3AED', '#38BDF8', '#F8FAFC', '#A8B5C8', '#334155'] },
    { id: 'theme-dark-midnight', name: 'Onyx & Cyber Mint', type: 'Dark', desc: 'Deep charcoal, cool teal', icon: '🌙', colors: ['#0B0D10', '#15191F', '#0F766E', '#6366F1', '#F8FAFC', '#A1A1AA', '#2B3038'] },
    { id: 'theme-ocean-depth', name: 'Ocean Depth', type: 'Dark', desc: 'Deep blue serenity', icon: '🌊', colors: ['#0B1626', '#13233A', '#0F766E', '#3B82F6', '#E6EEF8', '#9EB0C8', '#294363'] },
    { id: 'theme-evergreen', name: 'Evergreen', type: 'Dark', desc: 'Natural forest calm', icon: '🌲', colors: ['#0D1712', '#14251C', '#15803D', '#0F766E', '#F0FDF4', '#A7CBB0', '#284933'] },
    { id: 'theme-midnight-sapphire', name: 'Midnight Sapphire', type: 'Dark', desc: 'Navy blue premium', icon: '💎', colors: ['#0B1020', '#141E36', '#2563EB', '#7C3AED', '#E8EEFF', '#AABCEB', '#2A3C64'] },
    { id: 'theme-forest-purple', name: 'Forest & Purple', type: 'Dark', desc: 'Deep green & violet', icon: '🌴', colors: ['#121A17', '#1B2A23', '#7C3AED', '#16A34A', '#F7FAF8', '#AEC5B5', '#314A3B'] },
    { id: 'theme-silver-slate', name: 'Silver Slate', type: 'Dark', desc: 'Metallic charcoal', icon: '⚙️', colors: ['#17191D', '#232830', '#A16207', '#94A3B8', '#F3F4F6', '#B1B7C1', '#3B424D'] },
    { id: 'theme-dark-orange', name: 'Dark Orange', type: 'Dark', desc: 'Bold industrial amber', icon: '🔥', colors: ['#181818', '#242424', '#C2410C', '#D97706', '#FAFAFA', '#A3A3A3', '#3F3F46'] },
  ];

  useEffect(() => {
    const savedSettings = localStorage.getItem('siteSettings');
    if(savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ 
        ...prev, 
        ...parsed, 
        promoCodes: parsed.promoCodes || [], 
        heroMobileImages: parsed.heroMobileImages || parsed.hero_mobile_images || prev.heroMobileImages,
        footerImages: parsed.footerImages || (parsed.footerImage ? [parsed.footerImage] : prev.footerImages), 
        isPromoEnabled: parsed.isPromoEnabled ?? true,
        logoSize: parsed.logoSize || prev.logoSize,
        gridLayout: parsed.gridLayout || prev.gridLayout,
        deliveryPartners: parsed.deliveryPartners || prev.deliveryPartners
      }));
    }

    fetch(`${API_BASE_URL}/api/settings/system`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
    .then(res => res.json())
    .then(data => {
      if(data.success && data.data) {
        setSettings(prev => ({
          ...prev,
          brandFirstName: data.data.brand_first_name || prev.brandFirstName,
          brandLastName: data.data.brand_last_name || prev.brandLastName,
          tagline: data.data.tagline || prev.tagline,
          orderPrefix: data.data.order_prefix || prev.orderPrefix,
          orderSequence: data.data.order_sequence || prev.orderSequence,
          logoUrl: data.data.logo_url || prev.logoUrl,
          logoSize: data.data.logo_size || prev.logoSize,
          faviconUrl: data.data.favicon_url || prev.faviconUrl,
          deliveryChargeInside: data.data.delivery_charge_inside || prev.deliveryChargeInside,
          deliveryChargeOutside: data.data.delivery_charge_outside || prev.deliveryChargeOutside,
          heroTitle: data.data.hero_title || prev.heroTitle,
          heroSubtitle: data.data.hero_subtitle || prev.heroSubtitle,
          heroButtonText: data.data.hero_button_text || prev.heroButtonText,
          heroImages: data.data.hero_images || prev.heroImages,
          heroMobileImages: data.data.hero_mobile_images || prev.heroMobileImages,
          footerTitle: data.data.footer_title || prev.footerTitle,
          footerDescription: data.data.footer_description || prev.footerDescription,
          footerCopyright: data.data.footer_copyright || prev.footerCopyright,
          socialLinks: data.data.social_links || prev.socialLinks,
          contactInfo: data.data.contact_info || prev.contactInfo,
          promoCodes: data.data.promo_codes || prev.promoCodes,
          navigationMenus: data.data.navigation_menus || prev.navigationMenus,
          footerImages: data.data.footer_images || prev.footerImages,
          isPromoEnabled: data.data.is_promo_enabled !== undefined ? !!data.data.is_promo_enabled : prev.isPromoEnabled,
          gridLayout: data.data.grid_layout || prev.gridLayout,
          deliveryPartners: data.data.delivery_partners || prev.deliveryPartners
        }));
      }
    })
    .catch(err => console.error("Failed to fetch system settings:", err));

    fetch(`${API_BASE_URL}/api/settings/env`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) setEnvKeys(data.keys || []);
    })
    .catch(err => console.error("Failed to fetch env settings:", err));
  }, []);

  const handleImageUpload = async (file, fieldName, index = null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-image`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: formData
      });
      const data = await response.json();
      if(data.success) {
        updateField(fieldName, data.url, index);
      } else {
        toast.error('Upload failed: ' + data.message);
      }
    } catch (err) { 
      toast.error('Upload failed! Server connection issue.'); 
    }
  };

  const updateField = (name, value, index = null) => {
    if (name === 'heroImages' && index !== null) {
      const newArr = [...settings.heroImages];
      newArr[index] = value;
      setSettings({...settings, heroImages: newArr});
    } else if (name === 'heroMobileImages' && index !== null) {
      const newArr = [...(settings.heroMobileImages || [])];
      newArr[index] = value;
      setSettings({...settings, heroMobileImages: newArr});
    } else if (name === 'footerImages' && index !== null) { 
      const newArr = [...settings.footerImages];
      newArr[index] = value;
      setSettings({...settings, footerImages: newArr});
    } else if (name === 'contactImages' && index !== null) {
      const arr = [...(settings.contactInfo.contactImages || [])];
      arr[index] = value;
      setSettings({...settings, contactInfo: {...settings.contactInfo, contactImages: arr}});
    } else {
      setSettings({...settings, [name]: value});
    }
  };

  const ImageInput = ({ label, value, name, index = null }) => (
    <div className="mb-6 border border-dashed border-t-border p-5 rounded-xl bg-t-base hover:border-t-primary transition-colors">
      <label className="block text-xs font-bold text-t-muted mb-3 uppercase tracking-widest">{label}</label>
      <div className="flex flex-col sm:flex-row gap-4">
        <input 
          type="text" value={value || ''} 
          onChange={(e) => updateField(name, e.target.value, index)}
          placeholder="Paste Image URL here..."
          className="flex-1 p-3 border border-t-border rounded-xl bg-t-surface text-t-main text-sm outline-none focus:border-t-primary"
        />
        <div className="relative">
          <input 
            type="file" accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files[0], name, index)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="bg-t-primary/10 text-t-primary px-6 py-3 rounded-xl font-bold text-sm text-center border border-t-primary/20 hover:bg-t-primary hover:text-white transition-all">
            📁 Upload File
          </div>
        </div>
      </div>
      {value && <img src={value} alt="preview" className="mt-4 h-24 object-contain rounded-lg shadow-sm border border-t-border bg-t-surface p-1" />}
    </div>
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    if(name.startsWith('social_')) {
      const network = name.split('_')[1];
      setSettings(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [network]: value } }));
    } else setSettings({ ...settings, [name]: value });
  };

  const handleContactChange = (e) => setSettings({...settings, contactInfo: {...settings.contactInfo, [e.target.name]: e.target.value}});
  
  const addHeroImage = () => setSettings({...settings, heroImages: [...settings.heroImages, ''], heroMobileImages: [...(settings.heroMobileImages || []), '']});
  const removeHeroImage = (index) => {
    const newImgs = [...settings.heroImages];
    newImgs.splice(index, 1);
    const newMobileImgs = [...(settings.heroMobileImages || [])];
    newMobileImgs.splice(index, 1);
    setSettings({...settings, heroImages: newImgs, heroMobileImages: newMobileImgs});
  };

  const addFooterImage = () => setSettings({...settings, footerImages: [...settings.footerImages, '']});
  const removeFooterImage = (index) => {
    const newImgs = [...settings.footerImages];
    newImgs.splice(index, 1);
    setSettings({...settings, footerImages: newImgs});
  };

  const addMenu = () => setSettings({ ...settings, navigationMenus: [...settings.navigationMenus, { id: Date.now(), name: 'New Category', value: 'new_category', subMenus: '' }] });
  const updateMenu = (id, field, value) => setSettings({ ...settings, navigationMenus: settings.navigationMenus.map(menu => menu.id === id ? { ...menu, [field]: value } : menu) });
  const removeMenu = (id) => setSettings({ ...settings, navigationMenus: settings.navigationMenus.filter(m => m.id !== id) });

  const addPromo = () => setSettings({ ...settings, promoCodes: [...settings.promoCodes, { id: Date.now(), code: '', discount: '' }] });
  const updatePromo = (id, field, value) => setSettings({ ...settings, promoCodes: settings.promoCodes.map(p => p.id === id ? { ...p, [field]: value } : p) });
  const removePromo = (id) => setSettings({ ...settings, promoCodes: settings.promoCodes.filter(p => p.id !== id) });

  const addDeliveryPartner = () => setSettings({ ...settings, deliveryPartners: [...settings.deliveryPartners, { id: Date.now(), name: '', logoUrl: '' }] });
  const updateDeliveryPartner = (id, field, value) => setSettings({ ...settings, deliveryPartners: settings.deliveryPartners.map(dp => dp.id === id ? { ...dp, [field]: value } : dp) });
  const removeDeliveryPartner = (id) => setSettings({ ...settings, deliveryPartners: settings.deliveryPartners.filter(dp => dp.id !== id) });

  const handleSave = async () => {
    setLoading(true);
    try {
      localStorage.setItem('siteSettings', JSON.stringify(settings));

      const response = await fetch(`${API_BASE_URL}/api/settings/system`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}` 
        },
       body: JSON.stringify({
          brand_first_name: settings.brandFirstName,
          brand_last_name: settings.brandLastName,
          tagline: settings.tagline,
          order_prefix: settings.orderPrefix,
          order_sequence: settings.orderSequence,
          favicon_url: settings.faviconUrl,
          footer_images: settings.footerImages,
          is_promo_enabled: settings.isPromoEnabled,
          navigation_menus: settings.navigationMenus,
          admin_theme: adminTheme,
          shop_theme: shopTheme,
          logo_url: settings.logoUrl,
          logo_size: settings.logoSize,
          delivery_charge_inside: settings.deliveryChargeInside,
          delivery_charge_outside: settings.deliveryChargeOutside,
          hero_title: settings.heroTitle,
          hero_subtitle: settings.heroSubtitle,
          hero_button_text: settings.heroButtonText,
          hero_images: settings.heroImages,
          hero_mobile_images: settings.heroMobileImages,
          footer_title: settings.footerTitle,
          footer_description: settings.footerDescription,
          footer_copyright: settings.footerCopyright,
          social_links: settings.socialLinks,
          contact_info: settings.contactInfo,
          promo_codes: settings.promoCodes,
          grid_layout: settings.gridLayout,
          delivery_partners: settings.deliveryPartners
        })
      });

      const result = await response.json();
      if(result.success) {
        toast.success('System Settings successfully published!');
      } else {
        toast.error('Failed to save backend settings: ' + result.message);
      }
    } catch (err) {
      toast.error('Connection error!');
    } finally {
      setLoading(false);
    }
  };

  const handleEnvSave = async () => {
    setEnvLoading(true);
    try {
      const payload = {};
      envKeys.forEach(k => { payload[k.key] = k.value; });
      const res = await fetch(`${API_BASE_URL}/api/settings/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: JSON.stringify({ keys: payload })
      });
      const data = await res.json();
      if (data.success) toast.success('Environment variables saved!');
      else toast.error('Failed: ' + data.message);
    } catch (err) {
      toast.error('Connection error!');
    } finally {
      setEnvLoading(false);
    }
  };

  const tabs = ['General', 'Appearance', 'Hero Slider', 'Promo Codes', 'Navigation Menu', 'Footer & Social', 'Contact Info', 'Environment'];

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-all duration-300">
      
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-t-border pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">System Configuration</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Global control center for your intelligence platform and storefront.</p>
        </div>
        <button onClick={handleSave} className="bg-t-primary hover:opacity-90 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 whitespace-nowrap">
          {loading ? 'Processing...' : '🚀 Publish Changes'}
        </button>
      </div>

      <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border overflow-hidden flex flex-col md:flex-row min-h-[650px]">
        
        <div className="w-full md:w-72 bg-t-base border-r border-t-border p-5 space-y-2">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === tab ? 'bg-t-primary text-white shadow-md' : 'text-t-muted hover:bg-t-surface hover:text-t-main'}`}>{tab}</button>
          ))}
        </div>

        <div className="flex-1 p-8 sm:p-10 overflow-y-auto custom-scrollbar">
          
          {/* General Tab */}
          {activeTab === 'General' && (
            <div className="space-y-8 animate-fade-in">
              <h2 className="text-2xl font-black tracking-tight border-b border-t-border pb-4">Brand & System Rules</h2>
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-t-primary uppercase tracking-widest">Brand Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">First Name</label>
                    <input type="text" name="brandFirstName" value={settings.brandFirstName} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" placeholder="Hamza"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Last Name</label>
                    <input type="text" name="brandLastName" value={settings.brandLastName} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" placeholder="Fabrics"/>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Tagline</label>
                    <input type="text" name="tagline" value={settings.tagline} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" placeholder="Intelligent Commerce"/>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-t-border">
                <h3 className="text-sm font-bold text-t-primary uppercase tracking-widest">Invoice & Order Config</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Order Prefix</label>
                    <input type="text" name="orderPrefix" value={settings.orderPrefix} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" placeholder="HF-"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Starting Order Number</label>
                    <input type="number" name="orderSequence" value={settings.orderSequence} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" placeholder="100000"/>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-t-border">
                 <h3 className="text-sm font-bold text-t-primary uppercase tracking-widest">Branding & Delivery</h3>
                 <ImageInput label="Store Logo" value={settings.logoUrl} name="logoUrl" />
                 
                 <div className="mb-6">
                    <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Logo Height Size (px)</label>
                    <input type="number" value={settings.logoSize} onChange={(e) => setSettings({...settings, logoSize: Number(e.target.value)})} className="w-full max-w-xs border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" />
                 </div>

                 <ImageInput label="Website Favicon (16x16 or 32x32)" value={settings.faviconUrl} name="faviconUrl" />
                 
                 <div className="grid grid-cols-2 gap-6 mt-4">
                   <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Inside Dhaka (৳)</label><input type="number" name="deliveryChargeInside" value={settings.deliveryChargeInside} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                   <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Outside Dhaka (৳)</label><input type="number" name="deliveryChargeOutside" value={settings.deliveryChargeOutside} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                 </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'Appearance' && (
            <div className="space-y-10 animate-fade-in">

              {/* Admin Panel Theme Section */}
              <div>
                <div className="border-b border-t-border pb-4 mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <span className="w-8 h-8 bg-t-primary/10 rounded-lg flex items-center justify-center text-t-primary text-sm">⚙️</span>
                    Admin Panel Theme
                  </h2>
                    <span className="text-[10px] text-t-muted font-medium">{themeOptions.filter(t => t.id === adminTheme)[0]?.name || 'Select'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                  {themeOptions.map((opt) => {
                    const isActive = adminTheme === opt.id;
                    return (
                      <button key={`admin-${opt.id}`} onClick={() => changeAdminTheme(opt.id)}
                        className={`relative p-4 rounded-2xl border-2 transition-all duration-300 text-left group ${isActive ? 'border-t-primary shadow-lg shadow-t-primary/10 scale-[1.02]' : 'border-t-border hover:border-t-muted/40 hover:shadow-md'}`}
                        style={{ backgroundColor: opt.colors[0] }}
                      >
                        {isActive && <span className="absolute -top-2 -right-2 w-6 h-6 bg-t-primary text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg z-10">✓</span>}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: isActive ? 'var(--color-primary)' : opt.colors[4] }}>{opt.icon} {opt.name}</span>
                          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ backgroundColor: opt.colors[2] + '20', color: opt.colors[2] }}>{opt.type}</span>
                        </div>
                        <div className="flex gap-1 mb-3">
                          {opt.colors.map((c, ci) => (
                            <div key={ci} className="h-5 flex-1 rounded-sm first:rounded-l-md last:rounded-r-md border border-white/10" style={{ background: c }} title={c}></div>
                          ))}
                        </div>
                        <p className="text-[10px] font-medium leading-tight" style={{ color: opt.colors[5] }}>{opt.desc}</p>
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/10">
                          {['bg', 'surface', 'primary', 'accent', 'text', 'muted', 'border'].map((label, li) => (
                            <span key={label} className="text-[6px] font-bold uppercase tracking-wider opacity-60" style={{ color: opt.colors[5] }}>{label}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Storefront Theme Section */}
              <div>
                <div className="border-b border-t-border pb-4 mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <span className="w-8 h-8 bg-t-primary/10 rounded-lg flex items-center justify-center text-t-primary text-sm">🏪</span>
                    Live Storefront Theme
                  </h2>
                  <span className="text-[10px] text-t-muted font-medium">{themeOptions.filter(t => t.id === shopTheme)[0]?.name || 'Select'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                  {themeOptions.map((opt) => {
                    const isActive = shopTheme === opt.id;
                    return (
                      <button key={`shop-${opt.id}`} onClick={() => changeShopTheme(opt.id)}
                        className={`relative p-4 rounded-2xl border-2 transition-all duration-300 text-left group ${isActive ? 'border-t-primary shadow-lg shadow-t-primary/10 scale-[1.02]' : 'border-t-border hover:border-t-muted/40 hover:shadow-md'}`}
                        style={{ backgroundColor: opt.colors[0] }}
                      >
                        {isActive && <span className="absolute -top-2 -right-2 w-6 h-6 bg-t-primary text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg z-10">✓</span>}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: opt.colors[4] }}>{opt.icon} {opt.name}</span>
                          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ backgroundColor: opt.colors[2] + '20', color: opt.colors[2] }}>{opt.type}</span>
                        </div>
                        <div className="flex gap-1 mb-3">
                          {opt.colors.map((c, ci) => (
                            <div key={ci} className="h-5 flex-1 rounded-sm first:rounded-l-md last:rounded-r-md border border-white/10" style={{ background: c }} title={c}></div>
                          ))}
                        </div>
                        <p className="text-[10px] font-medium leading-tight" style={{ color: opt.colors[5] }}>{opt.desc}</p>
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/10">
                          {['bg', 'surface', 'primary', 'accent', 'text', 'muted', 'border'].map((label, li) => (
                            <span key={label} className="text-[6px] font-bold uppercase tracking-wider opacity-60" style={{ color: opt.colors[5] }}>{label}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shop Layout Section */}
              <div className="pt-4 border-t border-t-border">
                <div className="border-b border-t-border pb-4 mb-6">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <span className="w-8 h-8 bg-t-primary/10 rounded-lg flex items-center justify-center text-t-primary text-sm">📱</span>
                    Shop Page Layout (PC & Mobile)
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-t-surface p-5 rounded-xl border border-t-border">
                    <label className="block text-xs font-bold text-t-muted mb-3 uppercase tracking-widest">PC View Columns</label>
                    <select value={settings.gridLayout.pcCols} onChange={(e) => setSettings({...settings, gridLayout: {...settings.gridLayout, pcCols: Number(e.target.value)}})} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary">
                      <option value="3">3 Columns</option>
                      <option value="4">4 Columns</option>
                      <option value="5">5 Columns</option>
                    </select>
                    <p className="text-[10px] text-t-muted mt-2 font-medium">Controls product grid on desktop screens</p>
                  </div>
                  <div className="bg-t-surface p-5 rounded-xl border border-t-border">
                    <label className="block text-xs font-bold text-t-muted mb-3 uppercase tracking-widest">Mobile View Columns</label>
                    <select value={settings.gridLayout.mobileCols} onChange={(e) => setSettings({...settings, gridLayout: {...settings.gridLayout, mobileCols: Number(e.target.value)}})} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary">
                      <option value="1">1 Column (Large)</option>
                      <option value="2">2 Columns (Grid)</option>
                    </select>
                    <p className="text-[10px] text-t-muted mt-2 font-medium">Controls product grid on mobile screens</p>
                  </div>
                  <div className="bg-t-surface p-5 rounded-xl border border-t-border">
                    <label className="block text-xs font-bold text-t-muted mb-3 uppercase tracking-widest">Products Per Page</label>
                    <input type="number" value={settings.gridLayout.itemsPerPage} onChange={(e) => setSettings({...settings, gridLayout: {...settings.gridLayout, itemsPerPage: Number(e.target.value)}})} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" />
                    <p className="text-[10px] text-t-muted mt-2 font-medium">Number of products shown per page</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hero Slider Tab */}
          {activeTab === 'Hero Slider' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-t-border pb-4 flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight">Hero Slider & Welcome</h2>
                <button onClick={addHeroImage} className="bg-t-primary/10 text-t-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-t-primary hover:text-white transition-colors">+ Add Slide</button>
              </div>

              {/* Aspect Ratio Reference Table */}
              <div className="bg-t-base rounded-xl border border-t-border p-5">
                <h3 className="text-xs font-bold text-t-muted uppercase tracking-widest mb-4">Recommended Image Specifications</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-t-border">
                        <th className="pb-3 pr-4 font-bold text-t-main">Banner Type</th>
                        <th className="pb-3 pr-4 font-bold text-t-main">Aspect Ratio</th>
                        <th className="pb-3 pr-4 font-bold text-t-main">Best Resolution</th>
                        <th className="pb-3 font-bold text-t-main">Safe Zone</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-t-border/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            <span className="font-bold text-t-main">PC Desktop</span>
                            <span className="text-t-muted font-medium">(Landscape)</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono font-bold text-t-main">16:9</td>
                        <td className="py-3 pr-4 font-mono font-bold text-t-main">1920 × 1080 px</td>
                        <td className="py-3 font-mono font-medium text-t-muted">1920 × 800 px</td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                            <span className="font-bold text-t-main">Mobile</span>
                            <span className="text-t-muted font-medium">(Portrait)</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono font-bold text-t-main">4:5</td>
                        <td className="py-3 pr-4 font-mono font-bold text-t-main">1080 × 1350 px</td>
                        <td className="py-3 font-mono font-medium text-t-muted">1080 × 1920 px</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2"><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Main Big Title</label><input type="text" name="heroTitle" value={settings.heroTitle} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Small Subtitle</label><input type="text" name="heroSubtitle" value={settings.heroSubtitle} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Button Text</label><input type="text" name="heroButtonText" value={settings.heroButtonText} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
              </div>

              <div className="space-y-6 pt-4">
                {settings.heroImages.map((img, index) => (
                  <div key={`hero-slide-${index}`} className="relative bg-t-surface p-5 rounded-xl border border-t-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 bg-t-primary/10 text-t-primary rounded-lg flex items-center justify-center text-xs font-black">{index + 1}</span>
                        <h3 className="text-sm font-bold text-t-main">Slide {index + 1}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {settings.heroImages.length > 1 && (
                          <button onClick={() => removeHeroImage(index)} className="bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            Remove
                          </button>
                        )}
                        <span className="text-[10px] text-t-muted font-medium">{index + 1} of {settings.heroImages.length}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded text-[9px] font-bold uppercase tracking-wider">Desktop</span>
                          <span className="text-[10px] text-t-muted">16:9 · 1920×1080</span>
                        </div>
                        <ImageInput label="PC Desktop Banner (Landscape)" value={settings.heroImages[index]} name="heroImages" index={index} />
                      </div>
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-bold uppercase tracking-wider">Mobile</span>
                          <span className="text-[10px] text-t-muted">4:5 · 1080×1350</span>
                        </div>
                        <ImageInput label="Mobile Banner (Portrait)" value={settings.heroMobileImages ? settings.heroMobileImages[index] : ''} name="heroMobileImages" index={index} />
                      </div>
                    </div>
                  </div>
                ))}
                {settings.heroImages.length === 0 && (
                  <div className="text-center py-12 border border-dashed border-t-border rounded-xl">
                    <svg className="w-10 h-10 mx-auto text-t-muted/40 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21"/></svg>
                    <p className="text-sm font-bold text-t-muted">No slides yet</p>
                    <p className="text-xs text-t-muted/60 mt-1">Click "Add Slide" to create your first hero banner.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Promo Codes Tab */}
          {activeTab === 'Promo Codes' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between bg-t-surface p-5 rounded-xl border border-t-border shadow-sm mb-6">
                <div>
                  <h3 className="text-sm font-bold text-t-main uppercase tracking-widest">Enable Promo Codes</h3>
                  <p className="text-xs text-t-muted mt-1 font-medium">Allow customers to use discount codes at checkout.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settings.isPromoEnabled} onChange={(e) => setSettings({...settings, isPromoEnabled: e.target.checked})} className="sr-only peer" />
                  <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-t-primary"></div>
                </label>
              </div>

              <div className="border-b border-t-border pb-4 flex justify-between items-center mt-8">
                <h2 className="text-2xl font-black tracking-tight">Active Promo Codes</h2>
                <button onClick={addPromo} className="bg-orange-500/10 text-orange-500 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-colors">+ Add Promo</button>
              </div>
              <div className="space-y-4">
                {settings.promoCodes.map((promo) => (
                  <div key={promo.id} className="flex gap-4 items-center bg-t-base p-4 rounded-xl border border-t-border">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-t-muted block mb-1">Coupon Code</label>
                      <input type="text" value={promo.code} onChange={(e) => updatePromo(promo.id, 'code', e.target.value.toUpperCase())} placeholder="e.g. EID100" className="w-full border border-t-border rounded-lg px-4 py-2.5 bg-t-surface text-t-main outline-none focus:border-t-primary text-sm font-black tracking-widest uppercase" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-t-muted block mb-1">Discount Amount (৳)</label>
                      <input type="number" value={promo.discount} onChange={(e) => updatePromo(promo.id, 'discount', e.target.value)} placeholder="e.g. 150" className="w-full border border-t-border rounded-lg px-4 py-2.5 bg-t-surface text-t-main outline-none focus:border-t-primary text-sm font-bold" />
                    </div>
                    <button onClick={() => removePromo(promo.id)} className="mt-5 w-10 h-10 bg-red-500/10 text-red-500 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-colors flex-shrink-0">✕</button>
                  </div>
                ))}
                {settings.promoCodes.length === 0 && <p className="text-center text-t-muted text-sm font-bold p-8 border border-dashed border-t-border rounded-xl">No active promo codes. Click add to create one.</p>}
              </div>
            </div>
          )}

          {/* Navigation Menu Tab */}
          {activeTab === 'Navigation Menu' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-t-border pb-4 flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight">Navigation Categories</h2>
                <button onClick={addMenu} className="bg-t-primary/10 text-t-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-t-primary hover:text-white transition-colors">+ Add Menu</button>
              </div>
              <div className="space-y-4">
                {settings.navigationMenus.map((menu, index) => (
                  <div key={menu.id} className="flex gap-4 items-center bg-t-base p-4 rounded-xl border border-t-border flex-wrap">
                    <input type="text" value={menu.name} onChange={(e) => updateMenu(menu.id, 'name', e.target.value)} placeholder="Display Name" className="flex-1 min-w-[150px] border border-t-border rounded-lg px-4 py-2.5 bg-t-surface text-t-main outline-none focus:border-t-primary text-sm" />
                    <input type="text" value={menu.value} onChange={(e) => updateMenu(menu.id, 'value', e.target.value)} placeholder="Database Value" className="flex-1 min-w-[150px] border border-t-border rounded-lg px-4 py-2.5 bg-t-surface text-t-main outline-none focus:border-t-primary text-sm font-mono" />
                    
                    <input type="text" value={menu.subMenus || ''} onChange={(e) => updateMenu(menu.id, 'subMenus', e.target.value)} placeholder="Sub-menus (comma separated)" className="flex-2 min-w-[200px] border border-t-border rounded-lg px-4 py-2.5 bg-t-surface text-t-main outline-none focus:border-t-primary text-sm" />
                    
                    {index !== 0 && <button onClick={() => removeMenu(menu.id)} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-colors">✕</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer & Social Tab */}
          {activeTab === 'Footer & Social' && (
            <div className="space-y-8 animate-fade-in">
              <h2 className="text-2xl font-black tracking-tight border-b border-t-border pb-4">Footer Branding & Social</h2>
              <div className="space-y-6">
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Banner Title</label><input type="text" name="footerTitle" value={settings.footerTitle} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Banner Description</label><textarea name="footerDescription" value={settings.footerDescription} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary custom-scrollbar" rows="3"></textarea></div>
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Copyright Text</label><input type="text" name="footerCopyright" value={settings.footerCopyright} onChange={handleChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                
                <div className="border-t border-t-border pt-6 mt-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-t-main uppercase tracking-widest">Footer Gallery Images</h3>
                    <button onClick={addFooterImage} className="bg-t-primary/10 text-t-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-t-primary hover:text-white transition-colors">+ Add Image</button>
                  </div>
                  <div className="space-y-6">
                    {settings.footerImages.map((img, index) => (
                      <div key={`footer-img-${index}`} className="relative">
                        <ImageInput label={`Footer Image ${index + 1}`} value={img} name="footerImages" index={index} />
                        {settings.footerImages.length > 1 && (
                          <button onClick={() => removeFooterImage(index)} className="absolute top-4 right-4 bg-red-500/10 text-red-500 w-8 h-8 flex items-center justify-center rounded-lg font-bold hover:bg-red-500 hover:text-white transition-colors shadow-sm">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-t-border pt-6 mt-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-t-main uppercase tracking-widest">Delivery Partners</h3>
                    <button onClick={addDeliveryPartner} className="bg-t-primary/10 text-t-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-t-primary hover:text-white transition-colors">+ Add Partner</button>
                  </div>
                  <div className="space-y-4">
                    {settings.deliveryPartners.map((dp) => (
                      <div key={dp.id} className="flex gap-4 items-center bg-t-base p-4 rounded-xl border border-t-border">
                        <input type="text" value={dp.name} onChange={(e) => updateDeliveryPartner(dp.id, 'name', e.target.value)} placeholder="Partner Name (e.g. RedX)" className="flex-1 border border-t-border rounded-lg px-4 py-2.5 bg-t-surface text-t-main text-sm outline-none" />
                        <input type="text" value={dp.logoUrl} onChange={(e) => updateDeliveryPartner(dp.id, 'logoUrl', e.target.value)} placeholder="Logo Image URL" className="flex-1 border border-t-border rounded-lg px-4 py-2.5 bg-t-surface text-t-main text-sm outline-none" />
                        <button onClick={() => removeDeliveryPartner(dp.id)} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-colors">✕</button>
                      </div>
                    ))}
                    {settings.deliveryPartners.length === 0 && <p className="text-xs text-t-muted italic">No custom partners added. Default Pathao & Steadfast will show.</p>}
                  </div>
                </div>
                
                <h3 className="text-xs font-bold text-t-main pt-4 border-t border-t-border uppercase tracking-widest">Social Links</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-bold text-blue-500 mb-2">Facebook</label><input type="text" name="social_facebook" value={settings.socialLinks.facebook} onChange={handleChange} className="w-full border border-t-border rounded-lg px-3 py-2 bg-t-base text-t-main outline-none focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-bold text-pink-500 mb-2">Instagram</label><input type="text" name="social_instagram" value={settings.socialLinks.instagram} onChange={handleChange} className="w-full border border-t-border rounded-lg px-3 py-2 bg-t-base text-t-main outline-none focus:border-pink-500" /></div>
                  <div><label className="block text-xs font-bold text-t-main mb-2">TikTok</label><input type="text" name="social_tiktok" value={settings.socialLinks.tiktok} onChange={handleChange} className="w-full border border-t-border rounded-lg px-3 py-2 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                </div>
              </div>
            </div>
          )}

          {/* Contact Info Tab */}
          {activeTab === 'Contact Info' && (
            <div className="space-y-8 animate-fade-in">
              <h2 className="text-2xl font-black tracking-tight border-b border-t-border pb-4">Contact Page Details</h2>
              <div className="space-y-6">
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Flagship Studio Address</label><textarea name="address" value={settings.contactInfo.address} onChange={handleContactChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary custom-scrollbar" rows="4"></textarea></div>
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Phone / WhatsApp</label><input type="text" name="phone" value={settings.contactInfo.phone} onChange={handleContactChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                  <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Email Address</label><input type="email" name="email" value={settings.contactInfo.email} onChange={handleContactChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary" /></div>
                </div>
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Business Hours</label><textarea name="hours" value={settings.contactInfo.hours} onChange={handleContactChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary custom-scrollbar" rows="2"></textarea></div>
                <div><label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Maps Embed Link</label><textarea name="mapEmbed" value={settings.contactInfo.mapEmbed} onChange={handleContactChange} className="w-full border border-t-border rounded-xl px-4 py-3 bg-t-base text-t-main outline-none focus:border-t-primary custom-scrollbar font-mono text-xs" rows="3" placeholder='<iframe src="https://www.google.com/maps/embed?pb=..."></iframe>'></textarea></div>

                <div>
                  <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Gallery Images</label>
                  <p className="text-[10px] text-t-muted mb-3">These images appear beside the map on the contact page.</p>
                  {settings.contactInfo.contactImages?.map((img, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 bg-t-primary/10 text-t-primary rounded-lg flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                        <span className="text-xs font-bold text-t-muted">Image {i + 1}</span>
                        <button onClick={() => {
                          const arr = settings.contactInfo.contactImages.filter((_, idx) => idx !== i);
                          setSettings({...settings, contactInfo: {...settings.contactInfo, contactImages: arr}});
                        }} className="ml-auto text-red-400 hover:text-red-500 text-[10px] font-bold px-2">✕ Remove</button>
                      </div>
                      <ImageInput label="" value={img} name="contactImages" index={i} />
                    </div>
                  ))}
                  {(!settings.contactInfo.contactImages || settings.contactInfo.contactImages.length === 0) && (
                    <div className="text-center py-8 border border-dashed border-t-border rounded-xl mb-3">
                      <p className="text-xs font-bold text-t-muted">No gallery images yet</p>
                    </div>
                  )}
                  <button onClick={() => setSettings({...settings, contactInfo: {...settings.contactInfo, contactImages: [...(settings.contactInfo.contactImages || []), '']}})}
                    className="text-xs font-bold text-t-primary hover:underline">+ Add Image</button>
                </div>
              </div>
            </div>
          )}

          {/* Environment Tab */}
          {activeTab === 'Environment' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between border-b border-t-border pb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Environment Variables</h2>
                  <p className="text-sm text-t-muted mt-1 font-medium">Edit .env configuration values. Changes require a server restart to take full effect.</p>
                </div>
                <button onClick={handleEnvSave} className="bg-t-primary hover:opacity-90 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 whitespace-nowrap text-sm">
                  {envLoading ? 'Saving...' : 'Save Env'}
                </button>
              </div>

              {['Server', 'Database', 'Admin Login', 'Pathao Courier', 'Steadfast Courier', 'Security'].map(group => {
                const groupKeys = envKeys.filter(k => k.group === group);
                if (groupKeys.length === 0) return null;
                return (
                  <div key={group} className="space-y-4">
                    <h3 className="text-sm font-bold text-t-primary uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-t-primary" />
                      {group}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {groupKeys.map((k) => (
                        <div key={k.key} className="bg-t-base p-4 rounded-xl border border-t-border">
                          <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">{k.label}</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type={k.sensitive ? 'password' : 'text'}
                              value={k.value}
                              onChange={(e) => setEnvKeys(prev => prev.map(x => x.key === k.key ? { ...x, value: e.target.value } : x))}
                              className="flex-1 border border-t-border rounded-lg px-3 py-2.5 bg-t-surface text-t-main text-sm outline-none focus:border-t-primary font-mono"
                              placeholder={k.sensitive ? '********' : ''}
                            />
                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-1 rounded bg-t-surface border border-t-border text-t-muted shrink-0">{k.sensitive ? 'Sec' : k.key}</span>
                          </div>
                          <p className="text-[10px] text-t-muted mt-1.5 font-mono">{k.key}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}