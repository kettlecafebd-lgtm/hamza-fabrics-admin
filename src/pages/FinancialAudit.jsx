import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import API_BASE_URL from '../config/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Truck, Megaphone, RefreshCw, AlertTriangle } from 'lucide-react';

export default function FinancialAudit() {
  const { isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  const [period, setPeriod] = useState('30d');
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [adConfig, setAdConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const [summaryRes, trendRes, configRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/financial-audit/summary?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/financial-audit/trend?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/financial-audit/ad-spend-config`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const s = await summaryRes.json();
      const t = await trendRes.json();
      const c = await configRes.json();
      if (s.success) setSummary(s.summary);
      if (t.success) setTrend(t.trend.map(r => ({
        ...r,
        label: new Date(r.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      })));
      if (c.success) setAdConfig(c.config);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [period]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('adminToken');
      await fetch(`${API_BASE_URL}/api/financial-audit/sync-ad-spend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  const fmt = (n) => `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtDecimal = (n) => Number(n || 0).toFixed(2);

  if (loading) return (
    <div className="p-8 text-center min-h-screen bg-t-base">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-t-primary mb-4"></div>
      <p className={`font-bold uppercase tracking-widest text-sm ${mutedText}`}>Loading Financial Audit...</p>
    </div>
  );

  const metrics = summary ? [
    { label: 'Gross Sales', value: fmt(summary.gross_sales), icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-l-blue-500', desc: 'Total order value (delivered/processing)' },
    { label: 'COGS', value: fmt(summary.cogs), icon: <ShoppingCart className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-l-red-500', desc: 'Cost of goods sold' },
    { label: 'Logistics Cost', value: fmt(summary.logistics_cost), icon: <Truck className="w-5 h-5" />, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-l-orange-500', desc: 'Delivery + packaging' },
    { label: 'Total Ad Spend', value: fmt(summary.total_ad_spend), icon: <Megaphone className="w-5 h-5" />, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-l-purple-500', desc: `Meta: ${fmt(summary.meta_ad_spend)} · Google: ${fmt(summary.google_ad_spend)}` },
    { label: 'Net Profit', value: fmt(summary.net_profit), icon: summary.net_profit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />, color: summary.net_profit >= 0 ? 'text-green-500' : 'text-red-500', bg: summary.net_profit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10', border: summary.net_profit >= 0 ? 'border-l-green-500' : 'border-l-red-500', desc: 'Sales − (COGS + Logistics + Ad Spend)' },
    { label: 'POAS', value: `${fmtDecimal(summary.poas)}x`, icon: <TrendingUp className="w-5 h-5" />, color: summary.poas >= 2 ? 'text-green-500' : summary.poas >= 1 ? 'text-yellow-500' : 'text-red-500', bg: summary.poas >= 2 ? 'bg-green-500/10' : summary.poas >= 1 ? 'bg-yellow-500/10' : 'bg-red-500/10', border: summary.poas >= 2 ? 'border-l-green-500' : summary.poas >= 1 ? 'border-l-yellow-500' : 'border-l-red-500', desc: 'Profit on Ad Spend ratio' },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-screen bg-t-base">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${summary?.net_profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-black ${textColor}`}>Financial Audit</h1>
            <p className={`text-xs ${mutedText}`}>The True Dashboard — actual net profit, stripped from vanity metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['today', '7d', '30d', '90d', '1y'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${period === p ? 'bg-t-primary text-white' : 'bg-t-surface border border-t-border text-t-muted hover:text-t-main'}`}>
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
            </button>
          ))}
          <button onClick={handleSync} disabled={syncing}
            className="p-2 rounded-lg bg-t-surface border border-t-border hover:border-t-primary transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-t-muted ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ad Spend Config Warning */}
      {adConfig && (!adConfig.meta?.configured || !adConfig.google?.configured) && (
        <div className={`mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex items-start gap-3`}>
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm font-bold ${textColor}`}>Ad Spend APIs Not Fully Configured</p>
            <p className={`text-xs ${mutedText} mt-1`}>
              {!adConfig.meta?.configured ? 'Meta Ads API: Missing credentials. ' : ''}
              {!adConfig.google?.configured ? 'Google Ads API: Missing credentials. ' : ''}
              Ad spend will show 0 until configured. Set environment variables to enable live sync.
            </p>
          </div>
        </div>
      )}

      {/* 6 Core Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {metrics.map((m, i) => (
          <div key={i} className={`${bgCard} rounded-xl border ${borderColor} p-5 border-l-4 ${m.border} transition-all hover:-translate-y-0.5 hover:shadow-lg`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>{m.label}</span>
              <div className={`${m.bg} p-2 rounded-lg ${m.color}`}>{m.icon}</div>
            </div>
            <p className={`text-3xl font-black ${m.color}`}>{m.value}</p>
            <p className={`text-xs ${mutedText} mt-1`}>{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Trend Chart */}
      {trend.length > 0 && (
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6 mb-6`}>
          <h3 className={`font-black text-sm ${textColor} mb-4`}>Daily Financial Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: '12px', fontWeight: 'bold', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                <Legend />
                <Bar dataKey="gross_sales" name="Gross Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ad_spend" name="Ad Spend" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net_profit" name="Net Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Breakdown Table */}
      {trend.length > 0 && (
        <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-t-border">
            <h3 className={`font-black text-sm ${textColor}`}>Daily Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b border-t-border ${mutedText} text-[10px] font-bold uppercase tracking-widest`}>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-right px-5 py-3">Gross Sales</th>
                  <th className="text-right px-5 py-3">COGS</th>
                  <th className="text-right px-5 py-3">Logistics</th>
                  <th className="text-right px-5 py-3">Ad Spend</th>
                  <th className="text-right px-5 py-3">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-t-border">
                {trend.slice(-14).reverse().map((row, i) => (
                  <tr key={i} className="hover:bg-t-base/50">
                    <td className={`px-5 py-3 font-medium ${textColor}`}>{row.label}</td>
                    <td className="px-5 py-3 text-right">{fmt(row.gross_sales)}</td>
                    <td className="px-5 py-3 text-right text-red-500">{fmt(row.cogs)}</td>
                    <td className="px-5 py-3 text-right text-orange-500">{fmt(row.logistics)}</td>
                    <td className="px-5 py-3 text-right text-purple-500">{fmt(row.ad_spend)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${row.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(row.net_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
