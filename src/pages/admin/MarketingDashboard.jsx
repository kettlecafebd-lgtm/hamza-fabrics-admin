import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { Activity, DollarSign, MousePointerClick, ShoppingBag, Eye, X } from 'lucide-react';

export default function MarketingDashboard() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);

  // ডামি ডেটা (পরে API দিয়ে রিপ্লেস করবেন)
  useEffect(() => {
    setStats([
      { platform: 'Meta CAPI', status: 'Success', count: 1240, total_value: 45000 },
      { platform: 'GA4', status: 'Success', count: 1100, total_value: 42000 },
      { platform: 'Meta CAPI', status: 'Failed', count: 12, total_value: 0 }
    ]);
    
    setLogs([
      { id: 1, event_name: 'Purchase', platform: 'Meta CAPI', status: 'Success', value: 850, created_at: '2026-07-08T10:30:00Z', details: 'Customer: 017XXXXXX\nItem: Dubai Silk A47' },
      { id: 2, event_name: 'InitiateCheckout', platform: 'GA4', status: 'Success', value: 0, created_at: '2026-07-08T10:25:00Z', details: 'Dropped at address field' },
      { id: 3, event_name: 'AddToCart', platform: 'Meta CAPI', status: 'Success', value: 0, created_at: '2026-07-08T10:15:00Z', details: 'Item: Premium Cotton' },
    ]);
  }, []);

  const totalEvents = stats.reduce((sum, s) => sum + s.count, 0);
  const totalProfitPushed = stats.filter(s => s.status === 'Success').reduce((sum, s) => sum + parseFloat(s.total_value), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Activity className="text-t-primary" /> Live Tracking Engine
        </h1>
        <p className="text-sm text-t-muted mt-1 uppercase tracking-widest font-bold">Monitor Meta CAPI & GA4 Server Events</p>
      </div>

      {/* KPI Graphics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1">Total Server Events</p>
            <h2 className="text-3xl font-black text-t-main">{totalEvents.toLocaleString()}</h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-t-primary/10 flex items-center justify-center text-t-primary">
            <MousePointerClick size={24} />
          </div>
        </div>

        <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1">Net Profit Pushed (Meta)</p>
            <h2 className="text-3xl font-black text-green-500">৳ {totalProfitPushed.toLocaleString()}</h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1">Event Success Rate</p>
            <h2 className="text-3xl font-black text-t-primary">
              {Math.round((stats.filter(s => s.status === 'Success').reduce((sum, s) => sum + s.count, 0) / totalEvents) * 100) || 0}%
            </h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-t-primary/10 flex items-center justify-center text-t-primary">
            <ShoppingBag size={24} />
          </div>
        </div>
      </div>

      {/* Modern Compact Table */}
      <div className="bg-t-surface border border-t-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-t-border bg-t-base/50">
          <h3 className="font-bold text-sm uppercase tracking-widest text-t-main">Recent Event Stream</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-t-surface border-b border-t-border text-[10px] font-bold text-t-muted uppercase tracking-widest">
              <tr>
                <th className="p-4">Time</th>
                <th className="p-4">Event Type</th>
                <th className="p-4">Platform</th>
                <th className="p-4">Value</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-t-base/50 transition-colors">
                  <td className="p-4 text-xs font-semibold text-t-muted">
                    {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="p-4 font-bold text-t-main">{log.event_name}</td>
                  <td className="p-4 text-xs font-bold text-t-muted">{log.platform}</td>
                  <td className="p-4 font-bold text-t-primary">
                    {log.value > 0 ? `৳${log.value}` : '-'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${log.status === 'Success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="p-2 bg-t-base hover:bg-t-primary/10 text-t-muted hover:text-t-primary rounded-lg transition-colors inline-flex items-center justify-center"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-t-surface border border-t-border rounded-2xl shadow-2xl w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedLog(null)} className="absolute top-4 right-4 text-t-muted hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
            <h2 className="text-lg font-black text-t-main mb-1 uppercase tracking-widest">Event Details</h2>
            <p className="text-xs font-bold text-t-primary mb-6">{selectedLog.event_name} via {selectedLog.platform}</p>
            
            <div className="space-y-4">
              <div className="bg-t-base border border-t-border p-4 rounded-xl">
                <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1">Timestamp</p>
                <p className="text-sm font-semibold text-t-main">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
              <div className="bg-t-base border border-t-border p-4 rounded-xl">
                <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1">Passed Value (Profit/Amount)</p>
                <p className="text-sm font-black text-green-500">৳ {selectedLog.value}</p>
              </div>
              <div className="bg-t-base border border-t-border p-4 rounded-xl">
                <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1">Raw Payload Details</p>
                <pre className="text-xs font-mono text-t-main whitespace-pre-wrap">{selectedLog.details}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}