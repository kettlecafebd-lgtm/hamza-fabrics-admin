import React, { useState, useEffect, useContext, useMemo } from 'react';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';
import { getToken } from '../utils/auth';
import { BarChart3, TrendingUp, TrendingDown, Package, Truck, RotateCcw, XCircle, Clock, Download, Filter, Calendar, RefreshCw, Search, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  processing: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  shipped: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-500/20', dot: 'bg-indigo-500' },
  delivered: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/20', dot: 'bg-green-500' },
  returned: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/20', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/20', dot: 'bg-slate-500' },
  pending_return: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  rts: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20', dot: 'bg-purple-500' },
  partial_delivered: { bg: 'bg-teal-500/10', text: 'text-teal-600', border: 'border-teal-500/20', dot: 'bg-teal-500' },
  lost: { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-gray-500/20', dot: 'bg-gray-500' },
  preorder: { bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'border-cyan-500/20', dot: 'bg-cyan-500' },
};

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: '7 Days' },
  { key: '30days', label: '30 Days' },
  { key: 'custom', label: 'Custom' },
];

export default function OrderReport() {
  const { adminTheme } = useContext(ThemeContext);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('combined');
  const [dateFilter, setDateFilter] = useState('30days');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE_URL}/api/analytics?filter=${dateFilter}`;
      if (dateFilter === 'custom' && customRange.start && customRange.end) {
        url += `&start=${customRange.start}&end=${customRange.end}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const result = await response.json();
      if (result.success) {
        setAnalyticsData(result.data);
      } else {
        setError(result.message || 'Failed to fetch analytics.');
      }
    } catch (err) {
      setError('Network error: Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [dateFilter]);

  // ── Derived Data ──
  const stats = useMemo(() => {
    if (!analyticsData) return null;
    const total = parseInt(analyticsData.overall?.total_orders) || 0;
    const revenue = parseFloat(analyticsData.profit?.totalRevenue) || 0;
    const cost = parseFloat(analyticsData.profit?.totalCost) || 0;
    const profit = revenue - cost;
    const statusCounts = {};
    (analyticsData.orderStatus?.statusCounts || []).forEach(s => {
      statusCounts[s.status] = parseInt(s.count) || 0;
    });
    return { total, revenue, cost, profit, statusCounts, dailyOrders: analyticsData.dailyOrders || [], recentOrders: analyticsData.recentOrders || [], hourly: analyticsData.hourly || [], lowStock: analyticsData.lowStock || [] };
  }, [analyticsData]);

  // ── Filtered Orders ──
  const filteredOrders = useMemo(() => {
    if (!stats) return [];
    let orders = stats.recentOrders;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      orders = orders.filter(o => (o.order_code || '').toLowerCase().includes(q) || (o.customer_name || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      orders = orders.filter(o => o.status === statusFilter);
    }
    return orders;
  }, [stats, searchQuery, statusFilter]);

  // ── Export CSV ──
  const exportCSV = () => {
    if (!filteredOrders.length) return toast.error('No data to export');
    const headers = ['Invoice', 'Customer', 'Amount', 'Cost', 'Profit', 'Status', 'Date'];
    const rows = filteredOrders.map(o => [o.order_code, o.customer_name, o.total_amount, o.total_cost_price || 0, (o.total_amount - (o.total_cost_price || 0)).toFixed(2), o.status, new Date(o.created_at).toLocaleDateString()]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `OrderReport_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('CSV exported!');
  };

  // ── Max daily value for chart scaling ──
  const maxDaily = useMemo(() => {
    if (!stats?.dailyOrders?.length) return 1;
    return Math.max(...stats.dailyOrders.map(d => parseInt(d.orders) || 0), 1);
  }, [stats]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-t-base">
      <div className="w-12 h-12 border-4 border-t-border border-t-t-primary rounded-full animate-spin mb-4"></div>
      <div className="text-t-primary font-bold tracking-widest uppercase text-sm animate-pulse">Loading reports...</div>
    </div>
  );

  if (error) return (
    <div className="p-12 text-center bg-t-base min-h-screen">
      <div className="inline-block bg-red-500/10 border border-red-500/20 text-red-500 p-8 rounded-2xl">
        <h2 className="text-xl font-black mb-2">⚠️ Error</h2>
        <p className="font-semibold text-sm">{error}</p>
        <button onClick={fetchAnalytics} className="mt-4 text-xs font-bold underline">Retry</button>
      </div>
    </div>
  );

  if (!stats) return <div className="p-12 text-center text-t-muted bg-t-base min-h-screen">No Data Available.</div>;

  const delivered = stats.statusCounts.delivered || 0;
  const returned = (stats.statusCounts.returned || 0) + (stats.statusCounts.pending_return || 0);
  const cancelled = stats.statusCounts.cancelled || 0;
  const pending = (stats.statusCounts.pending || 0) + (stats.statusCounts.processing || 0);
  const shipped = (stats.statusCounts.shipped || 0) + (stats.statusCounts.rts || 0);
  const returnRate = stats.total > 0 ? ((returned / stats.total) * 100).toFixed(1) : 0;
  const deliveryRate = stats.total > 0 ? ((delivered / stats.total) * 100).toFixed(1) : 0;

  return (
    <div className="p-4 sm:p-6 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Order Reports</h1>
          <p className="text-xs text-t-muted mt-1 font-medium">Analytics, conversion funnel & order details</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Filter */}
          <div className="flex bg-t-surface border border-t-border rounded-xl overflow-hidden">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setDateFilter(f.key)}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${dateFilter === f.key ? 'bg-t-primary text-white' : 'text-t-muted hover:text-t-main'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customRange.start} onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
                className="bg-t-surface border border-t-border rounded-lg px-2 py-1.5 text-xs text-t-main outline-none" />
              <span className="text-t-muted text-xs">to</span>
              <input type="date" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
                className="bg-t-surface border border-t-border rounded-lg px-2 py-1.5 text-xs text-t-main outline-none" />
              <button onClick={fetchAnalytics} className="bg-t-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold">Go</button>
            </div>
          )}
          <button onClick={exportCSV} className="bg-t-surface border border-t-border text-t-main px-3 py-2 rounded-xl text-xs font-bold hover:bg-t-primary hover:text-white transition-colors flex items-center gap-1.5">
            <Download size={14} /> Export
          </button>
          <button onClick={fetchAnalytics} className="bg-t-primary text-white p-2 rounded-xl shadow-lg hover:opacity-90 transition-all">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-t-surface border border-t-border rounded-xl p-1 overflow-x-auto">
        {[{ key: 'combined', label: '📊 Combined' }, { key: 'orders', label: '📋 Order Details' }, { key: 'status', label: '📈 Status Breakdown' }, { key: 'hourly', label: '🕐 Hourly Today' }, { key: 'stock', label: '⚠️ Low Stock' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab.key ? 'bg-t-primary text-white shadow-md' : 'text-t-muted hover:text-t-main hover:bg-t-base'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Combined Funnel ═══ */}
      {activeTab === 'combined' && (
        <div className="bg-t-surface rounded-2xl border border-t-border p-6 sm:p-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total Orders', value: stats.total, icon: Package, color: 'text-t-primary', bg: 'bg-t-primary/10' },
              { label: 'Revenue', value: `৳${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-500/10' },
              { label: 'Profit', value: `৳${stats.profit.toLocaleString()}`, icon: stats.profit >= 0 ? TrendingUp : TrendingDown, color: stats.profit >= 0 ? 'text-green-600' : 'text-red-600', bg: stats.profit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10' },
              { label: 'Return Rate', value: `${returnRate}%`, icon: RotateCcw, color: 'text-red-600', bg: 'bg-red-500/10' },
            ].map((kpi, i) => (
              <div key={i} className={`${kpi.bg} border ${kpi.color.replace('text-', 'border-').replace('600', '500/20')} rounded-xl p-4`}>
                <kpi.icon size={16} className={`${kpi.color} mb-2`} />
                <div className="text-[10px] font-bold uppercase tracking-wider text-t-muted">{kpi.label}</div>
                <div className={`text-xl font-black ${kpi.color} mt-0.5`}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Funnel */}
          <div className="relative flex flex-col items-center max-w-3xl mx-auto py-4">
            <div className="bg-t-primary/5 border border-t-primary/20 rounded-2xl p-5 w-56 text-center shadow-sm">
              <div className="text-[10px] font-black text-t-primary uppercase tracking-widest mb-1">Incoming Orders</div>
              <div className="text-2xl font-black text-t-main">{stats.total}</div>
              <div className="text-xs text-t-primary font-bold">৳{stats.revenue.toLocaleString()}</div>
            </div>
            <div className="w-px h-10 bg-t-border"></div>
            <div className="flex gap-6">
              <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 w-36 text-center shadow-sm hover:-translate-y-1 transition-transform">
                <div className="text-2xl font-black text-green-600">{delivered}</div>
                <div className="text-[9px] font-black text-green-600 uppercase tracking-widest mt-1">Delivered</div>
                <div className="text-[10px] text-green-600/70 font-bold">{deliveryRate}%</div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 w-36 text-center shadow-sm hover:-translate-y-1 transition-transform">
                <div className="text-2xl font-black text-amber-600">{pending}</div>
                <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1">Pending</div>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 w-36 text-center shadow-sm hover:-translate-y-1 transition-transform">
                <div className="text-2xl font-black text-red-600">{returned}</div>
                <div className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-1">Returned</div>
                <div className="text-[10px] text-red-600/70 font-bold">{returnRate}%</div>
              </div>
            </div>
          </div>

          {/* Daily Orders Bar Chart */}
          {stats.dailyOrders.length > 0 && (
            <div className="mt-8 pt-6 border-t border-t-border">
              <h3 className="text-xs font-black uppercase tracking-widest text-t-muted mb-4">Daily Orders</h3>
              <div className="flex items-end gap-1 h-32 overflow-x-auto custom-scrollbar pb-1">
                {stats.dailyOrders.map((d, i) => {
                  const h = Math.max(4, (parseInt(d.orders) / maxDaily) * 100);
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 min-w-[28px] group relative">
                      <div className="text-[8px] font-bold text-t-muted opacity-0 group-hover:opacity-100 transition-opacity">{d.orders}</div>
                      <div className="w-5 rounded-t-md bg-t-primary/80 group-hover:bg-t-primary transition-colors" style={{ height: `${h}%` }}></div>
                      <div className="text-[7px] text-t-muted font-bold truncate w-8 text-center">{d.date}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Order Details ═══ */}
      {activeTab === 'orders' && (
        <div className="bg-t-surface rounded-2xl border border-t-border overflow-hidden">
          <div className="p-4 border-b border-t-border flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t-muted" />
              <input type="text" placeholder="Search by invoice or name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-t-base border border-t-border rounded-lg text-xs text-t-main outline-none focus:border-t-primary" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-t-base border border-t-border rounded-lg px-3 py-2 text-xs font-bold text-t-main outline-none">
              <option value="all">All Status</option>
              {Object.keys(STATUS_COLORS).map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
            <span className="text-[10px] text-t-muted font-bold">{filteredOrders.length} orders</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-t-base text-[10px] font-black uppercase tracking-wider text-t-muted">
                <tr><th className="p-3">Invoice</th><th className="p-3">Customer</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Profit</th><th className="p-3">Status</th><th className="p-3">Date</th></tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => {
                  const sc = STATUS_COLORS[o.status] || STATUS_COLORS.pending;
                  const profit = (parseFloat(o.total_amount) || 0) - (parseFloat(o.total_cost_price) || 0);
                  return (
                    <tr key={i} className="border-t border-t-border/50 hover:bg-t-base/50 transition-colors text-xs">
                      <td className="p-3 font-bold font-mono">{o.order_code}</td>
                      <td className="p-3 font-semibold">{o.customer_name}</td>
                      <td className="p-3 text-right font-bold">৳{(parseFloat(o.total_amount) || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-t-muted">৳{(parseFloat(o.total_cost_price) || 0).toLocaleString()}</td>
                      <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>৳{profit.toFixed(0)}</td>
                      <td className="p-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${sc.bg} ${sc.text} ${sc.border} border`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}></span>{o.status?.replace(/_/g, ' ')}</span></td>
                      <td className="p-3 text-t-muted">{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-t-muted text-xs">No orders match filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: Status Breakdown ═══ */}
      {activeTab === 'status' && (
        <div className="bg-t-surface rounded-2xl border border-t-border p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-t-muted mb-6">Status Distribution</h3>
          <div className="space-y-3">
            {Object.entries(stats.statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const pct = stats.total > 0 ? ((count / stats.total) * 100) : 0;
              const sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-32 text-[10px] font-bold uppercase tracking-wider text-t-muted flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sc.dot}`}></span>
                    {status.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 bg-t-base rounded-full h-6 overflow-hidden relative">
                    <div className={`h-full rounded-full transition-all duration-500 ${sc.bg.replace('/10', '')}`} style={{ width: `${pct}%` }}></div>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-t-main">{count} ({pct.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB: Hourly Today ═══ */}
      {activeTab === 'hourly' && (
        <div className="bg-t-surface rounded-2xl border border-t-border p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-t-muted mb-6">Today's Hourly Orders</h3>
          {stats.hourly.length > 0 ? (
            <div className="flex items-end gap-1 h-48 overflow-x-auto">
              {Array.from({ length: 24 }, (_, h) => {
                const found = stats.hourly.find(d => parseInt(d.hour) === h);
                const count = found ? parseInt(found.orders) : 0;
                const maxH = Math.max(...stats.hourly.map(d => parseInt(d.orders) || 0), 1);
                const height = count > 0 ? Math.max(4, (count / maxH) * 100) : 0;
                return (
                  <div key={h} className="flex flex-col items-center gap-1 min-w-[20px] group">
                    <div className="text-[8px] font-bold text-t-muted opacity-0 group-hover:opacity-100">{count}</div>
                    <div className={`w-4 rounded-t-sm transition-colors ${count > 0 ? 'bg-t-primary group-hover:bg-t-primary/80' : 'bg-t-border/50'}`} style={{ height: `${height}%` }}></div>
                    <div className="text-[7px] text-t-muted">{h}h</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-t-muted text-xs py-8">No hourly data for today</p>
          )}
        </div>
      )}

      {/* ═══ TAB: Low Stock ═══ */}
      {activeTab === 'stock' && (
        <div className="bg-t-surface rounded-2xl border border-t-border overflow-hidden">
          <div className="p-4 border-b border-t-border flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-t-muted">Low Stock Alert (≤10 units)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead className="bg-t-base text-[10px] font-black uppercase tracking-wider text-t-muted">
                <tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3 text-right">Stock</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody>
                {stats.lowStock.map((p, i) => (
                  <tr key={i} className="border-t border-t-border/50 hover:bg-t-base/50 text-xs">
                    <td className="p-3 font-bold">{p.name}</td>
                    <td className="p-3 text-t-muted font-mono">{p.sku}</td>
                    <td className="p-3 text-right font-black">{p.stock_quantity}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${p.stock_quantity === 0 ? 'bg-red-500/10 text-red-600' : p.stock_quantity <= 3 ? 'bg-orange-500/10 text-orange-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {p.stock_quantity === 0 ? 'OUT OF STOCK' : p.stock_quantity <= 3 ? 'CRITICAL' : 'LOW'}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.lowStock.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-t-muted text-xs">All products well stocked</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
