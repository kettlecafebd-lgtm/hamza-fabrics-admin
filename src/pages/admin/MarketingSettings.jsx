import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import API_BASE_URL from '../../config/api';

export default function MarketingSettings() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [config, setConfig] = useState({
    pixel_id: '',
    access_token: '',
    gtm_id: '',
    ga4_measurement_id: '',
    ga4_api_secret: '',
    openai_api_key: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('adminToken'); 
      const res = await fetch(`${API_BASE_URL}/api/marketing/settings`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      
      if (data.success && data.data) {
        setConfig({
          pixel_id: data.data.pixel_id || '',
          access_token: data.data.access_token || '',
          gtm_id: data.data.gtm_id || '',
          ga4_measurement_id: data.data.ga4_measurement_id || '',
          ga4_api_secret: data.data.ga4_api_secret || '',
          openai_api_key: data.data.openai_api_key || ''
        });
      } else {
        toast.error(data.message || 'Failed to load settings!');
      }
    } catch (error) {
      toast.error('Network Error! Please check server connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/marketing/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Tracking Settings Updated Successfully! 🚀');
      } else {
        toast.error(data.message || 'Failed to update settings.');
      }
    } catch (error) {
      toast.error('Server error while saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center font-bold text-t-muted">Loading Tracking Data...</div>;
  }

  // 🟢 স্ট্যাটাস চেক করার লজিক
  const isMetaActive = config.pixel_id && config.access_token;
  const isGA4Active = config.ga4_measurement_id && config.ga4_api_secret;
  const isGTMActive = config.gtm_id;
  const isOpenAIActive = config.openai_api_key;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans text-t-main">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-t-primary uppercase tracking-widest">Marketing & Tracking</h1>
        <p className="text-sm text-t-muted mt-2 font-semibold">Manage your Server-Side Tracking, GA4, and AI configurations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* 🔴 বাম পাশ: ফর্ম সেকশন */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Meta CAPI */}
            <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-t-main border-b border-t-border pb-3 mb-5 flex items-center gap-2 uppercase tracking-widest">
                <span className="text-blue-500 text-lg">♾️</span> Meta Server-Side API
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-bold text-t-muted mb-2 uppercase tracking-wider">Pixel ID</label>
                  <input type="text" name="pixel_id" value={config.pixel_id} onChange={handleInputChange} placeholder="e.g. 1029384756" className="w-full bg-transparent border border-t-border text-t-main placeholder-t-muted/50 rounded-xl p-3 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-mono text-sm transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-t-muted mb-2 uppercase tracking-wider">Access Token</label>
                  <input type="password" name="access_token" value={config.access_token} onChange={handleInputChange} placeholder="EAABw..." className="w-full bg-transparent border border-t-border text-t-main placeholder-t-muted/50 rounded-xl p-3 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-mono text-sm transition-all" />
                </div>
              </div>
            </div>

            {/* Google Analytics 4 */}
            <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-t-main border-b border-t-border pb-3 mb-5 flex items-center gap-2 uppercase tracking-widest">
                <span className="text-orange-500 text-lg">📊</span> Google Analytics 4 (MP)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-bold text-t-muted mb-2 uppercase tracking-wider">Measurement ID</label>
                  <input type="text" name="ga4_measurement_id" value={config.ga4_measurement_id} onChange={handleInputChange} placeholder="G-XXXXXXXXXX" className="w-full bg-transparent border border-t-border text-t-main placeholder-t-muted/50 rounded-xl p-3 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-mono text-sm transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-t-muted mb-2 uppercase tracking-wider">API Secret</label>
                  <input type="password" name="ga4_api_secret" value={config.ga4_api_secret} onChange={handleInputChange} placeholder="Enter API Secret" className="w-full bg-transparent border border-t-border text-t-main placeholder-t-muted/50 rounded-xl p-3 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-mono text-sm transition-all" />
                </div>
              </div>
            </div>

            {/* GTM & OpenAI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-black text-t-main border-b border-t-border pb-3 mb-5 flex items-center gap-2 uppercase tracking-widest">
                  <span className="text-yellow-500 text-lg">🏷️</span> Google Tag Manager
                </h2>
                <div>
                  <label className="block text-[11px] font-bold text-t-muted mb-2 uppercase tracking-wider">Container ID</label>
                  <input type="text" name="gtm_id" value={config.gtm_id} onChange={handleInputChange} placeholder="GTM-XXXXXXX" className="w-full bg-transparent border border-t-border text-t-main placeholder-t-muted/50 rounded-xl p-3 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-mono text-sm transition-all" />
                </div>
              </div>

              <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-black text-t-main border-b border-t-border pb-3 mb-5 flex items-center gap-2 uppercase tracking-widest">
                  <span className="text-emerald-500 text-lg">🤖</span> AI Ad Generator
                </h2>
                <div>
                  <label className="block text-[11px] font-bold text-t-muted mb-2 uppercase tracking-wider">OpenAI Key</label>
                  <input type="password" name="openai_api_key" value={config.openai_api_key} onChange={handleInputChange} placeholder="sk-..." className="w-full bg-transparent border border-t-border text-t-main placeholder-t-muted/50 rounded-xl p-3 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-mono text-sm transition-all" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={isSaving}
                className={`px-8 py-4 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-lg transition-all ${
                  isSaving 
                    ? 'bg-t-muted/50 text-white/50 cursor-not-allowed' 
                    : 'bg-t-primary hover:bg-t-primary/90 hover:-translate-y-1 shadow-t-primary/20'
                }`}
              >
                {isSaving ? 'Syncing to Server...' : 'Save & Sync Settings'}
              </button>
            </div>
            
          </form>
        </div>

        {/* 🔴 ডান পাশ: Live Status Panel */}
        <div className="lg:col-span-4">
          <div className="bg-t-surface border border-t-border p-6 sm:p-8 rounded-2xl shadow-lg sticky top-28">
            <h2 className="text-sm font-black text-t-main border-b border-t-border pb-4 mb-6 uppercase tracking-widest">
              Live Integration Status
            </h2>
            
            <div className="space-y-5">
              
              {/* Meta Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 border border-t-border">
                <div className="flex items-center gap-3">
                  <span className="text-xl">♾️</span>
                  <span className="text-xs font-bold text-t-main uppercase tracking-wider">Meta CAPI</span>
                </div>
                {isMetaActive ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active</span>
                ) : (
                  <span className="text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded uppercase tracking-widest">Inactive</span>
                )}
              </div>

              {/* GA4 Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 border border-t-border">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <span className="text-xs font-bold text-t-main uppercase tracking-wider">GA4 Server</span>
                </div>
                {isGA4Active ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active</span>
                ) : (
                  <span className="text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded uppercase tracking-widest">Inactive</span>
                )}
              </div>

              {/* GTM Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 border border-t-border">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏷️</span>
                  <span className="text-xs font-bold text-t-main uppercase tracking-wider">Google Tag</span>
                </div>
                {isGTMActive ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active</span>
                ) : (
                  <span className="text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded uppercase tracking-widest">Inactive</span>
                )}
              </div>

              {/* OpenAI Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 border border-t-border">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🤖</span>
                  <span className="text-xs font-bold text-t-main uppercase tracking-wider">AI Engine</span>
                </div>
                {isOpenAIActive ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active</span>
                ) : (
                  <span className="text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded uppercase tracking-widest">Inactive</span>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}