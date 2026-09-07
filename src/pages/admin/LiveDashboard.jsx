import React, { useState, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { BarChart3, Activity, DollarSign, ShoppingCart, MousePointerClick, Eye, X } from 'lucide-react';

export default function LiveDashboard() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  // ডামি ডেটা (ডিটেইলস ভিউ চেক করার জন্য)
  const [logs] = useState([
    { id: 1, event: 'Purchase', platform: 'Meta CAPI', status: 'SUCCESS', value: '450.00', time: '13:20:20', details: 'Order HF-10023 placed. User: 017XXXXXX' },
    { id: 2, event: 'InitiateCheckout', platform: 'GA4', status: 'SUCCESS', value: '0.00', time: '13:15:05', details: 'User entered checkout page. Total cart value: 850' },
    { id: 3, event: 'AddToCart', platform: 'Meta CAPI', status: 'SUCCESS', value: '0.00', time: '13:10:00', details: 'Added Dubai Silk A47 to cart.' },
    { id: 4, event: 'Purchase', platform: 'GA4', status: 'SUCCESS', value: '150.00', time: '12:50:45', details: 'Order HF-10022 placed. User: 018XXXXXX' },
  ]);

  const [selectedLog, setSelectedLog] = useState(null);

  // চার্টের গ্রাফিকাল ডেটা সিমুলেশন (৭ দিনের ট্রেন্ড)
  const chartData = [40, 65, 45, 80, 55, 90, 75];

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-transparent font-sans text-t-main transition-colors duration-300 max-w-7xl mx-auto">
      
      {/* Header - Uses Primary Accent Color dynamically for the icon and highlight */}
      <div className="mb-8 border-b border-t-border pb-4">
        <h1 className="text-2xl sm:text-3xl font-black tracking-widest uppercase flex items-center gap-3 text-t-main">
          <Activity className="text-t-primary" size={32} />
          Marketing <span className="text-t-primary">Tracking</span>
        </h1>
        <p className="text-t-muted text-sm mt-2 font-semibold">Real-time pixel and conversion tracking</p>
      </div>

      {/* KPI Summary Cards - Fully responsive and adaptive to theme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card title="Net Profit Tracked" value="৳ 600" icon={<DollarSign size={20} />} highlight />
        <Card title="Total Purchases" value="12" icon={<ShoppingCart size={20} />} />
        <Card title="Checkouts Initiated" value="45" icon={<MousePointerClick size={20} />} />
        <Card title="API Success Rate" value="98.5%" icon={<BarChart3 size={20} />} />
      </div>

      {/* Graphical Presentation Area */}
      <div className="bg-t-surface border border-t-border rounded-2xl p-6 mb-8 shadow-lg">
        <h2 className="text-sm font-black text-t-muted uppercase tracking-widest mb-6">Traffic & Conversion Flow (Last 7 Days)</h2>
        
        {/* CSS Component-based Chart */}
        <div className="h-48 flex items-end justify-between gap-2 border-b border-t-border pb-2">
          {chartData.map((height, i) => (
            <div key={i} className="w-full relative group">
              <div 
                className="bg-t-primary rounded-t-md w-full opacity-70 hover:opacity-100 transition-all cursor-pointer shadow-sm"
                style={{ height: `${height}%` }}
              ></div>
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-t-surface border border-t-border text-t-main text-xs py-1.5 px-3 rounded-lg font-black transition-opacity shadow-xl z-20 whitespace-nowrap">
                {height * 10} Events
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-black text-t-muted mt-3 uppercase tracking-widest">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
      </div>

      {/* Simplified Recent Events */}
      <div className="bg-t-surface border border-t-border rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-t-border flex justify-between items-center bg-black/10">
          <h2 className="text-sm font-black text-t-main uppercase tracking-widest">Recent Event Logs</h2>
          <button className="text-[10px] font-black uppercase bg-transparent border border-t-border text-t-main hover:bg-t-primary hover:border-t-primary hover:text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-lg">
            View All History
          </button>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-black/20 text-t-muted text-[10px] uppercase tracking-widest font-black border-b border-t-border">
              <tr>
                <th className="p-4">Event</th>
                <th className="p-4">Platform</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-black/10 transition-colors group">
                  <td className="p-4 font-bold">
                    <span className={log.event === 'Purchase' ? 'text-t-primary' : 'text-t-main'}>
                      {log.event}
                    </span>
                    <div className="text-[10px] text-t-muted font-bold mt-1 tracking-wider">{log.time}</div>
                  </td>
                  <td className="p-4 font-bold text-t-muted">{log.platform}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded border border-emerald-500/20">
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-transparent border border-t-border text-t-main text-xs font-bold rounded-lg transition-all hover:bg-t-primary hover:border-t-primary hover:text-white shadow-sm"
                    >
                      <Eye size={14} /> Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Detail View Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-t-surface border border-t-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-t-border flex justify-between items-center bg-black/10">
              <h3 className="font-black text-t-primary uppercase tracking-widest text-sm">Event Data Payload</h3>
              <button onClick={() => setSelectedLog(null)} className="text-t-muted hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-500/10">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex justify-between border-b border-t-border/50 pb-3">
                <span className="text-xs font-bold text-t-muted uppercase tracking-wider">Event Name</span>
                <span className="text-sm font-black text-t-main">{selectedLog.event}</span>
              </div>
              <div className="flex justify-between border-b border-t-border/50 pb-3">
                <span className="text-xs font-bold text-t-muted uppercase tracking-wider">Platform</span>
                <span className="text-sm font-bold text-t-main">{selectedLog.platform}</span>
              </div>
              <div className="flex justify-between border-b border-t-border/50 pb-3">
                <span className="text-xs font-bold text-t-muted uppercase tracking-wider">Value / Profit</span>
                <span className="text-sm font-black text-t-primary">৳ {selectedLog.value}</span>
              </div>
              <div className="pt-2">
                <span className="block text-xs font-bold text-t-muted uppercase tracking-wider mb-3">Raw JSON / Log Details</span>
                <div className="bg-black/20 p-4 rounded-xl border border-t-border text-xs font-mono text-t-muted whitespace-pre-wrap leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Reusable Multi-Theme Card Component
const Card = ({ title, value, icon, highlight }) => (
  <div 
    className={`p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg ${
      highlight 
        ? 'bg-t-primary/5 border-t-primary/30 text-t-main' 
        : 'bg-t-surface border-t-border text-t-main'
    }`}
  >
    <div className="flex justify-between items-start mb-4">
      <p className="text-[10px] font-black text-t-muted uppercase tracking-widest">{title}</p>
      <div className={highlight ? 'text-t-primary' : 'text-t-muted'}>{icon}</div>
    </div>
    <h2 className={`text-3xl font-black ${highlight ? 'text-t-primary' : 'text-t-main'}`}>{value}</h2>
  </div>
);