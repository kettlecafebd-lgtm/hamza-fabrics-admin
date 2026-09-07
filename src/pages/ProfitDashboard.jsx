import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { TrendingUp, DollarSign, PieChart, BarChart3, RefreshCw, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config/api';

export default function ProfitDashboard() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const navigate = useNavigate();
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/analytics/profit?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchProfit(); }, [period]);

  const formatNumber = (n) => Number(n || 0).toLocaleString();

  const periods = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: '1y', label: '1 Year' },
    { key: 'all', label: 'All Time' }
  ];

  const renderTrendChart = () => {
    if (!data?.trend?.length) return <p className="text-center text-t-muted py-8">No data for this period</p>;
    const max = Math.max(...data.trend.map(t => parseFloat(t.revenue)));
    return (
      <div className="space-y-1">
        {data.trend.slice(-14).map((t, i) => {
          const pct = max > 0 ? (parseFloat(t.revenue) / max) * 100 : 0;
          const isProfit = parseFloat(t.profit) >= 0;
          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className={`w-20 text-right font-mono ${mutedText}`}>
                {new Date(t.bucket).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
              <div className="flex-1 flex items-center gap-1">
                <div className="h-4 bg-blue-200 rounded" style={{ width: `${Math.max(2, pct)}%` }}></div>
                <span className="font-bold text-blue-600 w-16 text-right">৳{formatNumber(t.revenue)}</span>
              </div>
              <span className={`w-14 text-right font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                ৳{formatNumber(t.profit)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return (
    <div className="p-8 text-center min-h-screen bg-t-base">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-t-primary mb-4"></div>
      <p className={`font-bold uppercase tracking-widest text-sm ${mutedText}`}>Loading Profit Data...</p>
    </div>
  );

  const overview = data?.overview || {};

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-screen bg-t-base">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-black ${textColor}`}>Profit & Loss</h1>
              <p className={`text-xs ${mutedText}`}>Real-time profitability analytics</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                period === p.key ? 'bg-t-primary text-white' : 'bg-t-surface border border-t-border text-t-muted hover:text-t-main'
              }`}>{p.label}</button>
          ))}
          <button onClick={fetchProfit} className="p-2 rounded-lg bg-t-surface border border-t-border hover:border-t-primary transition-colors">
            <RefreshCw className="w-4 h-4 text-t-muted" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`${bgCard} rounded-xl border ${borderColor} p-5 border-l-4 border-l-blue-500`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Revenue</p>
          <p className="text-2xl font-black text-blue-600 mt-1">৳{formatNumber(overview.total_revenue)}</p>
        </div>
        <div className={`${bgCard} rounded-xl border ${borderColor} p-5 border-l-4 border-l-red-500`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Cost</p>
          <p className="text-2xl font-black text-red-500 mt-1">৳{formatNumber(overview.total_cost)}</p>
        </div>
        <div className={`${bgCard} rounded-xl border ${borderColor} p-5 border-l-4 border-l-green-500`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Net Profit</p>
          <p className="text-2xl font-black text-green-600 mt-1">৳{formatNumber(overview.total_profit)}</p>
        </div>
        <div className={`${bgCard} rounded-xl border ${borderColor} p-5 border-l-4 border-l-purple-500`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Margin</p>
          <p className={`text-2xl font-black mt-1 ${overview.profit_margin >= 20 ? 'text-green-600' : overview.profit_margin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
            {overview.profit_margin || 0}%
          </p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className={`${bgCard} rounded-xl border ${borderColor} p-4`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Orders</p>
          <p className={`text-lg font-black ${textColor}`}>{overview.total_orders}</p>
        </div>
        <div className={`${bgCard} rounded-xl border ${borderColor} p-4`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Avg Profit/Order</p>
          <p className="text-lg font-black text-green-600">৳{formatNumber(overview.avg_profit_per_order)}</p>
        </div>
        <div className={`${bgCard} rounded-xl border ${borderColor} p-4`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Delivered Profit</p>
          <p className="text-lg font-black text-green-600">৳{formatNumber(overview.delivered_profit)}</p>
        </div>
        <div className={`${bgCard} rounded-xl border ${borderColor} p-4`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Delivery Cost</p>
          <p className="text-lg font-black text-orange-500">৳{formatNumber(overview.total_delivery_charge)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Profit Trend */}
        <div className={`lg:col-span-2 ${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-t-border flex items-center justify-between">
            <h3 className={`font-black text-sm ${textColor}`}>Profit Trend</h3>
            <span className={`text-[10px] ${mutedText}`}>Last {period === '7d' ? '7' : period === '30d' ? '14' : period === '90d' ? '13 weeks' : '12 months'} shown</span>
          </div>
          <div className="p-5 overflow-x-auto">{renderTrendChart()}</div>
        </div>

        {/* By Source */}
        <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-t-border">
            <h3 className={`font-black text-sm ${textColor}`}>By Source</h3>
          </div>
          <div className="divide-y divide-t-border">
            {data?.bySource?.length === 0 ? (
              <p className={`p-5 text-center text-sm ${mutedText}`}>No data</p>
            ) : data?.bySource?.map((s, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className={`font-bold text-sm ${textColor}`}>{s.source}</p>
                  <p className={`text-xs ${mutedText}`}>{s.orders} orders</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-green-600">৳{formatNumber(s.profit)}</p>
                  <p className="text-xs text-t-muted">Rev: ৳{formatNumber(s.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products by Profit */}
      <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-t-border">
          <h3 className={`font-black text-sm ${textColor}`}>Top Products by Gross Profit</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b border-t-border ${mutedText} text-[10px] font-bold uppercase tracking-widest`}>
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-right px-5 py-3">SKU</th>
                <th className="text-right px-5 py-3">Units Sold</th>
                <th className="text-right px-5 py-3">Gross Sales</th>
                <th className="text-right px-5 py-3">Cost</th>
                <th className="text-right px-5 py-3">Gross Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border">
              {data?.topProducts?.length === 0 ? (
                <tr><td colSpan={6} className={`text-center py-8 ${mutedText}`}>No profit data. Set cost_price on products to see margins.</td></tr>
              ) : data?.topProducts?.map((p, i) => (
                <tr key={i} className="hover:bg-t-base/50">
                  <td className={`px-5 py-3 font-medium ${textColor}`}>{p.name}</td>
                  <td className={`px-5 py-3 text-right font-mono ${mutedText}`}>{p.sku || '-'}</td>
                  <td className="px-5 py-3 text-right">{p.units_sold}</td>
                  <td className="px-5 py-3 text-right font-medium">৳{formatNumber(p.gross_sales)}</td>
                  <td className="px-5 py-3 text-right text-red-500">৳{formatNumber(p.total_cost)}</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600">৳{formatNumber(p.gross_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
