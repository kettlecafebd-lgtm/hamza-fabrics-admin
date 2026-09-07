import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import API_BASE_URL from '../config/api';
import { ShoppingCart, MessageSquare, DollarSign, RefreshCw, Send, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';

const statusConfig = {
  abandoned: { label: 'Abandoned', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: <AlertTriangle className="w-3 h-3" /> },
  message_sent: { label: 'Recovery Sent', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: <Send className="w-3 h-3" /> },
  recovered: { label: 'Recovered', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle2 className="w-3 h-3" /> },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: <Clock className="w-3 h-3" /> },
};

export default function CartRecoveryDashboard() {
  const { isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  const [stats, setStats] = useState(null);
  const [carts, setCarts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [sending, setSending] = useState(false);
  const pageSize = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({ limit: pageSize, offset: page * pageSize });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const [statsRes, cartsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/cart-recovery/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/cart-recovery/carts?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const s = await statsRes.json();
      const c = await cartsRes.json();
      if (s.success) setStats(s.stats);
      if (c.success) { setCarts(c.carts); setTotal(c.total); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [statusFilter, page]);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/cart-recovery/detect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Detected ${data.detected} abandoned carts`);
        fetchData();
      }
    } catch (e) { console.error(e); }
    setDetecting(false);
  };

  const handleSendRecovery = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/cart-recovery/send-recovery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Sent ${data.sent} recovery messages`);
        fetchData();
      }
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider">Cart Recovery</h1>
            <p className="text-xs text-t-muted">WhatsApp abandoned cart auto-recovery</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDetect} disabled={detecting}
            className="flex items-center gap-2 px-4 py-2 border border-t-border rounded-lg hover:bg-t-primary/10 transition-all text-sm font-bold disabled:opacity-50">
            <AlertTriangle className={`w-4 h-4 ${detecting ? 'animate-pulse' : ''}`} /> Detect
          </button>
          <button onClick={handleSendRecovery} disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-t-primary text-white rounded-lg hover:bg-t-primary/90 transition-all text-sm font-bold disabled:opacity-50">
            <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} /> Send Recovery
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-t-primary/10 transition-colors text-t-muted hover:text-t-primary">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Abandoned', value: stats.abandoned_count || 0, color: 'text-orange-500', icon: <AlertTriangle className="w-4 h-4" /> },
            { label: 'Messages Sent', value: stats.message_sent_count || 0, color: 'text-blue-500', icon: <Send className="w-4 h-4" /> },
            { label: 'Recovered', value: stats.recovered_count || 0, color: 'text-green-500', icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: 'Today Abandoned', value: stats.today_abandoned || 0, color: 'text-orange-500', icon: <Clock className="w-4 h-4" /> },
            { label: 'Today Messages', value: stats.today_messages_sent || 0, color: 'text-blue-500', icon: <MessageSquare className="w-4 h-4" /> },
            { label: 'Recovered Revenue', value: fmt(stats.today_recovered_revenue), color: 'text-green-600', icon: <DollarSign className="w-4 h-4" /> },
          ].map((stat, i) => (
            <div key={i} className={`${bgCard} rounded-xl p-4 border ${borderColor}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>{stat.label}</span>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cart List */}
      <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className="p-4 border-b border-t-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {['all', 'abandoned', 'message_sent', 'recovered', 'expired'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === s ? 'bg-t-primary text-white shadow-sm' : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'} hover:bg-t-primary/10 hover:text-t-primary`
                }`}>
                {s === 'all' ? 'All' : (statusConfig[s]?.label || s)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-t-primary mb-4"></div>
              <p className={`text-sm font-bold uppercase tracking-wider ${mutedText}`}>Loading...</p>
            </div>
          ) : carts.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart className="w-12 h-12 mx-auto text-t-muted/30 mb-3" />
              <p className={`text-sm font-bold ${mutedText}`}>No abandoned carts found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={`${borderColor} border-b text-xs ${mutedText} uppercase tracking-wider`}>
                  <th className="text-left p-4 font-bold">Customer</th>
                  <th className="text-left p-4 font-bold">Phone</th>
                  <th className="text-left p-4 font-bold">Items</th>
                  <th className="text-right p-4 font-bold">Amount</th>
                  <th className="text-left p-4 font-bold">Status</th>
                  <th className="text-left p-4 font-bold">Created</th>
                </tr>
              </thead>
              <tbody>
                {carts.map(cart => {
                  const items = cart.items || [];
                  const status = statusConfig[cart.status] || statusConfig.abandoned;
                  return (
                    <tr key={cart.id} className={`${borderColor} border-b hover:bg-t-primary/5 transition-colors`}>
                      <td className="p-4">
                        <div className={`font-medium ${textColor}`}>{cart.customer_name || 'Unknown'}</div>
                        {cart.order_id && <div className={`text-xs ${mutedText}`}>Order #{cart.order_id}</div>}
                      </td>
                      <td className="p-4"><span className={`text-xs ${mutedText}`}>{cart.customer_phone || cart.customer_whatsapp || '-'}</span></td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {items.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-[10px] bg-t-primary/10 text-t-primary px-1.5 py-0.5 rounded">
                              {item.name || `#${item.product_id}`} ×{item.quantity}
                            </span>
                          ))}
                          {items.length > 3 && <span className="text-[10px] text-t-muted">+{items.length - 3}</span>}
                        </div>
                      </td>
                      <td className="p-4 text-right"><span className={`text-sm font-bold ${textColor}`}>{fmt(cart.total_amount)}</span></td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td className="p-4"><span className={`text-xs ${mutedText}`}>{new Date(cart.created_at).toLocaleDateString()}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {total > pageSize && (
          <div className={`p-4 border-t ${borderColor} flex items-center justify-between`}>
            <span className={`text-xs ${mutedText}`}>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${page === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-t-primary/10 text-t-primary'}`}>Previous</button>
              <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${(page + 1) * pageSize >= total ? 'opacity-30 cursor-not-allowed' : 'hover:bg-t-primary/10 text-t-primary'}`}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
