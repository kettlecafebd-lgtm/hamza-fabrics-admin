import React, { useState, useEffect, useContext } from 'react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';
import { getToken } from '../utils/auth';

export default function AIMarketing() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [activeTab, setActiveTab] = useState('Metrics');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    meta_pixel_id: '', meta_access_token: '', ga4_measurement_id: '', ga4_api_secret: '', openai_api_key: ''
  });

  // AI Generator state
  const [selectedProduct, setSelectedProduct] = useState('');
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };

  useEffect(() => {
    // কনফিগ ও প্রোডাক্ট লোড করা
    fetch(`${API_BASE_URL}/api/marketing/settings`, { headers })
      .then(res => res.json())
      .then(res => { if(res.success) setConfig(res.data); });

    fetch(`${API_BASE_URL}/api/products`)
      .then(res => res.json())
      .then(res => { if(res.success) setProducts(res.data); });
  }, []);

  const handleConfigSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketing/settings`, {
        method: 'PUT', headers, body: JSON.stringify(config)
      });
      const data = await res.json();
      if(data.success) toast.success('Tracking configurations updated globally!');
    } catch (err) { toast.error('Failed to update config.'); }
    finally { setLoading(false); }
  };

  const handleGenerateAd = async () => {
    if(!selectedProduct) return toast.error('Please select a base product first!');
    const prod = products.find(p => p.id === parseInt(selectedProduct));
    
    setAiLoading(true);
    setGeneratedCopy('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketing/generate-ad`, {
        method: 'POST', headers, body: JSON.stringify({ productName: prod.name, price: prod.price, category: prod.category })
      });
      const data = await res.json();
      if(data.success) setGeneratedCopy(data.adCopy);
      else toast.error(data.message);
    } catch (err) { toast.error('AI Generation error.'); }
    finally { setAiLoading(false); }
  };

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen text-t-main font-sans">
      <div className="mb-8 border-b border-t-border pb-6">
        <h1 className="text-3xl font-black tracking-tight">AI Marketing & Automated Tracking</h1>
        <p className="text-sm text-t-muted mt-1 font-medium">Manage server-side metrics pipeline, conversion tracking tokens, and launch instant AI campaigns.</p>
      </div>

      {/* Tabs Layout */}
      <div className="flex space-x-6 border-b border-t-border mb-8 text-sm font-bold">
        {['Metrics', 'AI Copy Factory', 'SaaS Configuration'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 uppercase tracking-widest ${activeTab === tab ? 'border-b-2 border-t-primary text-t-primary' : 'text-t-muted hover:text-t-main'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Live Analytics Mock View */}
      {activeTab === 'Metrics' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-t-surface border border-t-border p-6 rounded-2xl"><p className="text-xs font-bold text-t-muted uppercase tracking-wider">ROAS (Avg)</p><p className="text-3xl font-black text-green-500 mt-2">4.82x</p></div>
            <div className="bg-t-surface border border-t-border p-6 rounded-2xl"><p className="text-xs font-bold text-t-muted uppercase tracking-wider">Cost Per Purchase</p><p className="text-3xl font-black text-t-primary mt-2">৳ 142.30</p></div>
            <div className="bg-t-surface border border-t-border p-6 rounded-2xl"><p className="text-xs font-bold text-t-muted uppercase tracking-wider">CAPI Match Quality</p><p className="text-3xl font-black text-teal-500 mt-2">94% Excellent</p></div>
          </div>
          <div className="p-16 text-center text-t-muted bg-t-surface border border-dashed border-t-border rounded-2xl">
             📊 Real-time dynamic ad tracking matrix charts will load here synchronously.
          </div>
        </div>
      )}

      {/* Tab 2: AI Copy Generator */}
      {activeTab === 'AI Copy Factory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          <div className="lg:col-span-5 bg-t-surface border border-t-border p-6 rounded-2xl h-fit">
            <h3 className="text-sm font-black uppercase tracking-wider mb-4">Select Target Inventory Item</h3>
            <div className="space-y-4">
              <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm font-semibold outline-none focus:border-t-primary">
                <option value="">-- Choose Product --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (৳{p.price})</option>)}
              </select>
              <button onClick={handleGenerateAd} disabled={aiLoading} className="w-full bg-t-primary text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md">
                {aiLoading ? '✨ Machine Learning in Progress...' : '✨ Generate AI Copy'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-t-surface border border-t-border p-6 rounded-2xl min-h-[300px] flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-wider border-b border-t-border pb-3 mb-4">Generated High-Converting Ad Copy</h3>
            {aiLoading && <div className="flex-1 flex items-center justify-center text-t-primary font-bold animate-pulse text-xs tracking-widest">CREATING ACCENT DESIGN TEXT COPIES...</div>}
            {!aiLoading && generatedCopy && (
              <div className="flex-1 flex flex-col justify-between">
                <pre className="text-sm font-medium whitespace-pre-wrap font-sans text-t-main leading-relaxed bg-t-base p-5 rounded-xl border border-t-border custom-scrollbar">{generatedCopy}</pre>
                <button onClick={() => { navigator.clipboard.writeText(generatedCopy); toast.success('Copied to clipboard!'); }} className="mt-4 bg-t-main text-white py-2 px-6 rounded-xl font-bold text-xs uppercase tracking-wider self-end shadow-sm">
                  📋 Copy Text
                </button>
              </div>
            )}
            {!aiLoading && !generatedCopy && <div className="flex-1 flex items-center justify-center text-t-muted text-xs font-semibold">Select a product and fire up the AI agent factory to view ad mockups.</div>}
          </div>
        </div>
      )}

      {/* Tab 3: SaaS / Reusable Token Config Form */}
      {activeTab === 'SaaS Configuration' && (
        <form onSubmit={handleConfigSave} className="bg-t-surface border border-t-border p-8 rounded-2xl max-w-3xl animate-fade-in space-y-6">
          <h3 className="text-lg font-black border-b border-t-border pb-3 text-t-main">Dynamic Integration Token Hub</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-xs font-bold text-t-muted uppercase mb-2">Meta Pixel ID</label><input type="text" value={config.meta_pixel_id || ''} onChange={e => setConfig({...config, meta_pixel_id: e.target.value})} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm focus:border-t-primary outline-none font-mono" /></div>
            <div><label className="block text-xs font-bold text-t-muted uppercase mb-2">GA4 Measurement ID</label><input type="text" value={config.ga4_measurement_id || ''} onChange={e => setConfig({...config, ga4_measurement_id: e.target.value})} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm focus:border-t-primary outline-none font-mono" placeholder="G-XXXXXX" /></div>
          </div>

          <div><label className="block text-xs font-bold text-t-muted uppercase mb-2">Meta Conversions API Access Token</label><textarea value={config.meta_access_token || ''} onChange={e => setConfig({...config, meta_access_token: e.target.value})} rows="3" className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-xs focus:border-t-primary outline-none font-mono custom-scrollbar" /></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-xs font-bold text-t-muted uppercase mb-2">GA4 Measurement API Secret</label><input type="password" value={config.ga4_api_secret || ''} onChange={e => setConfig({...config, ga4_api_secret: e.target.value})} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm focus:border-t-primary outline-none font-mono" /></div>
            <div><label className="block text-xs font-bold text-t-muted uppercase mb-2">OpenAI Premium API Key</label><input type="password" value={config.openai_api_key || ''} onChange={e => setConfig({...config, openai_api_key: e.target.value})} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm focus:border-t-primary outline-none font-mono" /></div>
          </div>

          <button type="submit" disabled={loading} className="bg-t-primary text-white font-bold text-xs uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-lg transition-transform active:scale-95">
            {loading ? 'Publishing Keys...' : '💾 Save Configurations'}
          </button>
        </form>
      )}
    </div>
  );
}