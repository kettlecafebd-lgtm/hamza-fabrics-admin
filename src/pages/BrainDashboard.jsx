import React, { useState, useEffect, useContext, useRef } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import API_BASE_URL from '../config/api';
import { cachedFetch, invalidateCache, CACHE_TTLS } from '../lib/dataCache';
import { Brain, MapPin, AlertTriangle, Users, TrendingUp, TrendingDown, Activity, Settings, Shield, BarChart3, Clock, RefreshCw, Play, Search, X, CheckCircle2, ChevronRight } from 'lucide-react';

const segmentLabels = { vip: 'VIP', loyal: 'Loyal', regular: 'Regular', at_risk: 'At Risk', new: 'New' };
const segmentColors = { vip: 'text-yellow-500', loyal: 'text-green-500', regular: 'text-blue-500', at_risk: 'text-orange-500', new: 'text-gray-500' };

export default function BrainDashboard() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const bgCard = isAdminDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isAdminDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isAdminDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isAdminDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isAdminDark ? 'bg-gray-700' : 'bg-gray-50';

  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState(null);
  const [zones, setZones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [riskMatrix, setRiskMatrix] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('');
  const [alertFilter, setAlertFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [customerDetail, setCustomerDetail] = useState(null);

  const token = localStorage.getItem('adminToken');
  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── Egress note ────────────────────────────────────────────────────────────
  // This page used to refetch all 8 endpoints whenever ANY filter changed.
  // Filter-independent data (summary / insights / risk-matrix / activity /
  // settings) is now loaded once; each filtered list reloads only when its own
  // filter changes. Mutations still refresh everything via fetchAll().
  const fetchCore = async (force = false) => {
    const opts = { headers: authHeaders, token, ttl: CACHE_TTLS.list, force };
    try {
      const [sRes, iRes, rRes, lRes, setRes] = await Promise.all([
        cachedFetch(`${API_BASE_URL}/api/brain/summary`, opts),
        cachedFetch(`${API_BASE_URL}/api/brain/insights`, opts),
        cachedFetch(`${API_BASE_URL}/api/brain/risk-matrix`, opts),
        cachedFetch(`${API_BASE_URL}/api/brain/activity-log?limit=20`, opts),
        cachedFetch(`${API_BASE_URL}/api/brain/settings`, opts),
      ]);
      const s = await sRes.json(); if (s.success) setSummary(s);
      const i = await iRes.json(); if (i.success) setInsights(i.insights);
      const r = await rRes.json(); if (r.success) setRiskMatrix(r.matrix);
      const l = await lRes.json(); if (l.success) setActivityLog(l.logs);
      const setD = await setRes.json(); if (setD.success) setSettings(setD.settings);
    } catch (e) { console.error(e); }
  };

  const fetchZones = async (force = false) => {
    try {
      const res = await cachedFetch(`${API_BASE_URL}/api/brain/red-zones?status=${zoneFilter}`, {
        headers: authHeaders, token, ttl: CACHE_TTLS.list, force,
      });
      const z = await res.json();
      if (z.success) setZones(z.zones);
    } catch (e) { console.error(e); }
  };

  const fetchAlerts = async (force = false) => {
    try {
      const res = await cachedFetch(`${API_BASE_URL}/api/brain/fraud-alerts?risk=${alertFilter}`, {
        headers: authHeaders, token, ttl: CACHE_TTLS.list, force,
      });
      const a = await res.json();
      if (a.success) setAlerts(a.alerts);
    } catch (e) { console.error(e); }
  };

  const fetchCustomers = async (force = false) => {
    // Bounded: the segment list has no pager, so cap what one request can pull.
    const params = new URLSearchParams({ segment: segmentFilter || 'all', limit: '200' });
    try {
      const res = await cachedFetch(`${API_BASE_URL}/api/brain/customers?${params}`, {
        headers: authHeaders, token, ttl: CACHE_TTLS.list, force,
      });
      const c = await res.json();
      if (c.success) setCustomers(c.customers);
    } catch (e) { console.error(e); }
  };

  // A mutation must see its own effect: drop the cached pages, then reload.
  const fetchAll = async (force = false) => {
    if (force) invalidateCache('/api/brain');
    await Promise.all([fetchCore(force), fetchZones(force), fetchAlerts(force), fetchCustomers(force)]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([fetchCore(), fetchZones(), fetchAlerts(), fetchCustomers()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter-scoped reloads: only the list that the filter belongs to is refetched.
  const isFirstZoneRun = useRef(true);
  const isFirstAlertRun = useRef(true);
  const isFirstSegmentRun = useRef(true);
  useEffect(() => {
    if (isFirstZoneRun.current) { isFirstZoneRun.current = false; return; }
    fetchZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneFilter]);
  useEffect(() => {
    if (isFirstAlertRun.current) { isFirstAlertRun.current = false; return; }
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertFilter]);
  useEffect(() => {
    if (isFirstSegmentRun.current) { isFirstSegmentRun.current = false; return; }
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentFilter]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/brain/analyze`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.success) fetchAll(true);   // POST /analyze rewrites the derived data
    } catch (e) { console.error(e); }
    setAnalyzing(false);
  };

  const resolveAlert = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/brain/fraud-alerts/${id}/resolve`, { method: 'PUT', headers: authHeaders });
      fetchAll(true);
    } catch (e) { console.error(e); }
  };

  const bulkResolveAlerts = async () => {
    const unresolved = alerts.filter(a => !a.resolved_at).map(a => a.id);
    if (unresolved.length === 0) return;
    try {
      await fetch(`${API_BASE_URL}/api/brain/fraud-alerts/bulk-resolve`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unresolved }),
      });
      fetchAll(true);
    } catch (e) { console.error(e); }
  };

  const updateSetting = async (key, value) => {
    try {
      await fetch(`${API_BASE_URL}/api/brain/settings`, {
        method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      fetchAll(true);
    } catch (e) { console.error(e); }
  };

  const searchCustomer = async () => {
    if (!searchPhone.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/brain/customers/${encodeURIComponent(searchPhone)}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setCustomerDetail(data);
    } catch (e) { console.error(e); }
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <Brain className="w-4 h-4" /> },
    { key: 'red_zones', label: 'Red Zones', icon: <MapPin className="w-4 h-4" /> },
    { key: 'fraud', label: 'Fraud Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
    { key: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { key: 'risk_matrix', label: 'Risk Matrix', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'activity', label: 'Activity', icon: <Clock className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  if (loading && !summary) return (
    <div className="p-8 text-center min-h-screen bg-t-base">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-t-primary mb-4"></div>
      <p className="font-bold uppercase tracking-widest text-sm text-gray-500">Loading The Brain...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-t-primary/10"><Brain className="w-5 h-5 text-t-primary" /></div>
          <div><h1 className="text-lg font-black uppercase tracking-wider">The Brain</h1><p className={`text-xs ${mutedText}`}>Intelligence Engine v2 — Insights, Risk, Automation</p></div>
        </div>
        <button onClick={runAnalysis} disabled={analyzing} className="flex items-center gap-2 px-4 py-2.5 bg-t-primary text-white rounded-lg hover:bg-t-primary/90 transition-all text-sm font-bold disabled:opacity-50">
          {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {analyzing ? 'Analyzing...' : 'Run Full Analysis'}
        </button>
      </div>

      <div className="flex gap-1 flex-wrap mb-6 p-1 rounded-xl bg-t-base border border-t-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.key ? 'bg-t-primary text-white shadow-sm' : `text-${mutedText} hover:bg-t-primary/10 hover:text-t-primary`}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab summary={summary} insights={insights} riskMatrix={riskMatrix} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} />}
      {tab === 'red_zones' && <RedZonesTab zones={zones} zoneFilter={zoneFilter} setZoneFilter={setZoneFilter} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} />}
      {tab === 'fraud' && <FraudAlertsTab alerts={alerts} alertFilter={alertFilter} setAlertFilter={setAlertFilter} onResolve={resolveAlert} onBulkResolve={bulkResolveAlerts} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} />}
      {tab === 'customers' && <CustomersTab customers={customers} segmentFilter={segmentFilter} setSegmentFilter={setSegmentFilter} searchPhone={searchPhone} setSearchPhone={setSearchPhone} onSearch={searchCustomer} customerDetail={customerDetail} setCustomerDetail={setCustomerDetail} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} inputBg={inputBg} />}
      {tab === 'risk_matrix' && <RiskMatrixTab matrix={riskMatrix} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} />}
      {tab === 'activity' && <ActivityTab logs={activityLog} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} />}
      {tab === 'settings' && <SettingsTab settings={settings} onUpdate={updateSetting} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} inputBg={inputBg} />}
    </div>
  );
}

function OverviewTab({ summary, insights, riskMatrix, bgCard, textColor, mutedText, borderColor }) {
  const bs = summary?.brainSummary || {};
  const as = summary?.analyticsSummary?.totals || {};

  const totalAlerts = (bs?.alerts?.high || 0) + (bs?.alerts?.medium || 0) + (bs?.alerts?.low || 0);
  const totalZones = (bs?.zoneStats?.red || 0) + (bs?.zoneStats?.amber || 0) + (bs?.zoneStats?.safe || 0);

  return <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {[
        { label: 'Red Zones', value: bs?.zoneStats?.red || 0, icon: <MapPin className="w-4 h-4" />, color: 'text-red-500', sub: `Amber: ${bs?.zoneStats?.amber || 0} / Safe: ${bs?.zoneStats?.safe || 0}` },
        { label: 'High Risk Alert', value: bs?.alerts?.high || 0, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-500', sub: `Medium: ${bs?.alerts?.medium || 0}` },
        { label: 'Total Customers', value: as?.total_customers || 0, icon: <Users className="w-4 h-4" />, color: 'text-blue-500', sub: `Avg LTV: ${as?.avg_ltv || 0}` },
        { label: 'Total Revenue', value: `৳${Number(as?.total_revenue || 0).toLocaleString()}`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-500' },
        { label: 'Avg Order Value', value: `৳${Number(as?.avg_order_value || 0).toLocaleString()}`, icon: <Activity className="w-4 h-4" />, color: 'text-purple-500' },
        { label: 'Risk Tiers', value: riskMatrix?.length || 0, icon: <Shield className="w-4 h-4" />, color: 'text-orange-500', sub: `${totalZones} zones / ${totalAlerts} alerts` },
      ].map((s, i) => (
        <div key={i} className={`${bgCard} rounded-xl p-4 border ${borderColor}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>{s.label}</span>
            <span className={s.color}>{s.icon}</span>
          </div>
          <div className={`text-2xl font-black ${textColor}`}>{s.value}</div>
          {s.sub && <div className="text-xs text-t-muted mt-0.5">{s.sub}</div>}
        </div>
      ))}
    </div>

    {insights && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={`${bgCard} rounded-xl p-5 border ${borderColor}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-4 flex items-center gap-2`}><MapPin className="w-3.5 h-3.5" /> Worst Performing Areas</h3>
        {insights.worstAreas?.length > 0 ? <div className="space-y-2">
          {insights.worstAreas.map((a, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'red' ? 'bg-red-500' : 'bg-amber-500'} shrink-0`}></span>
                <span className={`text-sm truncate ${textColor}`}>{a.area_name || a.delivery_area}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs ${mutedText}`}>{a.total_orders} orders</span>
                <span className={`text-xs font-bold ${a.success_rate < 50 ? 'text-red-500' : 'text-amber-500'}`}>{a.success_rate}%</span>
              </div>
            </div>
          ))}
        </div> : <p className={`text-sm ${mutedText} text-center py-4`}>No problem areas identified</p>}
      </div>

      <div className={`${bgCard} rounded-xl p-5 border ${borderColor}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-4 flex items-center gap-2`}><AlertTriangle className="w-3.5 h-3.5" /> High Risk Customers</h3>
        {insights.highRiskCustomers?.length > 0 ? <div className="space-y-2 max-h-64 overflow-y-auto">
          {insights.highRiskCustomers.slice(0, 10).map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className={`text-sm font-medium truncate ${textColor}`}>{c.name || c.phone}</div>
                <div className={`text-xs ${mutedText}`}>{c.phone} • {c.total_orders} orders • {c.segment}</div>
              </div>
              <span className={`text-xs font-bold shrink-0 ${c.risk_score >= 70 ? 'text-red-500' : c.risk_score >= 50 ? 'text-orange-500' : 'text-yellow-500'}`}>{c.risk_score}</span>
            </div>
          ))}
        </div> : <p className={`text-sm ${mutedText} text-center py-4`}>No high-risk customers</p>}
      </div>

      {insights.churnRisks?.length > 0 && <div className={`${bgCard} rounded-xl p-5 border ${borderColor}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-4 flex items-center gap-2`}><TrendingDown className="w-3.5 h-3.5" /> Churn Risk Customers</h3>
        <div className="space-y-2">
          {insights.churnRisks.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className={`text-sm font-medium truncate ${textColor}`}>{c.name || c.phone}</div>
                <div className={`text-xs ${mutedText}`}>{c.days_since_last_order}d inactive • Predicted: ৳{Number(c.predicted_ltv || 0).toLocaleString()}</div>
              </div>
              <span className={`text-xs font-bold ${c.churn_risk >= 70 ? 'text-red-500' : 'text-orange-500'}`}>{c.churn_risk}%</span>
            </div>
          ))}
        </div>
      </div>}

      {insights.topCustomers?.length > 0 && <div className={`${bgCard} rounded-xl p-5 border ${borderColor}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-4 flex items-center gap-2`}><TrendingUp className="w-3.5 h-3.5" /> Top Customers by LTV</h3>
        <div className="space-y-2">
          {insights.topCustomers.map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className={`text-sm font-medium truncate ${textColor}`}>{c.name || c.phone}</div>
                <div className={`text-xs ${mutedText}`}>{c.total_orders} orders • ৳{Number(c.total_spent).toLocaleString()} • {c.segment}</div>
              </div>
              <span className={`text-xs font-bold ${segmentColors[c.segment] || 'text-gray-500'}`}>{c.ltv_score}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>}
  </div>;
}

function RedZonesTab({ zones, zoneFilter, setZoneFilter, bgCard, textColor, mutedText, borderColor }) {
  return <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
    <div className="p-4 border-b border-t-border flex gap-2">
      {['', 'red', 'amber', 'safe'].map(s => (
        <button key={s} onClick={() => setZoneFilter(s)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoneFilter === s ? 'bg-t-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-t-muted hover:bg-t-primary/10'}`}>
          {s || 'All'}
        </button>
      ))}
    </div>
    <div className="overflow-x-auto">
      {zones.length === 0 ? <p className={`p-8 text-center text-sm ${mutedText}`}>No zones found</p> : <table className="w-full text-sm">
        <thead><tr className={`border-b ${borderColor} text-xs ${mutedText} uppercase tracking-wider`}>
          <th className="text-left p-4 font-bold">Area</th>
          <th className="text-right p-4 font-bold">Orders</th>
          <th className="text-right p-4 font-bold">Delivered</th>
          <th className="text-right p-4 font-bold">Failed</th>
          <th className="text-right p-4 font-bold">Success Rate</th>
          <th className="text-right p-4 font-bold">Status</th>
        </tr></thead>
        <tbody>{zones.map(z => (
          <tr key={z.id} className={`border-b ${borderColor} hover:bg-t-primary/5 transition-colors`}>
            <td className="p-4"><span className={`font-medium ${textColor}`}>{z.area_name || z.delivery_area}</span></td>
            <td className="p-4 text-right"><span className={textColor}>{z.total_orders}</span></td>
            <td className="p-4 text-right"><span className="text-green-500">{z.delivered_count}</span></td>
            <td className="p-4 text-right"><span className="text-red-500">{z.failed_count}</span></td>
            <td className="p-4 text-right"><span className={`font-bold ${z.status === 'red' ? 'text-red-500' : z.status === 'amber' ? 'text-amber-500' : 'text-green-500'}`}>{z.success_rate}%</span></td>
            <td className="p-4 text-right">
              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${z.status === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : z.status === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>{z.status}</span>
            </td>
          </tr>
        ))}</tbody>
      </table>}
    </div>
  </div>;
}

function FraudAlertsTab({ alerts, alertFilter, setAlertFilter, onResolve, onBulkResolve, bgCard, textColor, mutedText, borderColor }) {
  const unresolved = alerts.filter(a => !a.resolved_at);
  return <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
    <div className="p-4 border-b border-t-border flex items-center justify-between flex-wrap gap-2">
      <div className="flex gap-2">
        {['', 'high', 'medium', 'low'].map(s => (
          <button key={s} onClick={() => setAlertFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${alertFilter === s ? 'bg-t-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-t-muted hover:bg-t-primary/10'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>
      {unresolved.length > 0 && <button onClick={onBulkResolve} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-all">
        <CheckCircle2 className="w-3 h-3" /> Resolve All ({unresolved.length})
      </button>}
    </div>
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {alerts.length === 0 ? <p className={`col-span-full text-center py-8 text-sm ${mutedText}`}>No fraud alerts</p> : alerts.map(a => (
        <div key={a.id} className={`p-4 rounded-xl border ${borderColor} ${a.resolved_at ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-bold ${textColor}`}>{a.name || a.phone}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.risk_level === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : a.risk_level === 'medium' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{a.risk_level}</span>
          </div>
          <p className={`text-xs ${mutedText} mb-1`}>{a.phone}</p>
          <p className={`text-xs ${mutedText} mb-2`}>{a.reason}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs">
              <span className={textColor}>{a.total_orders} orders</span>
              <span className="text-red-500">{a.failed_deliveries} failed</span>
              <span className={a.success_rate < 50 ? 'text-red-500' : 'text-green-500'}>{a.success_rate}%</span>
            </div>
            {!a.resolved_at && <button onClick={() => onResolve(a.id)} className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30"><CheckCircle2 className="w-4 h-4 text-green-500" /></button>}
          </div>
          {a.resolved_at && <p className={`text-[10px] ${mutedText} mt-2`}>Resolved {new Date(a.resolved_at).toLocaleDateString()} by {a.resolved_by}</p>}
        </div>
      ))}
    </div>
  </div>;
}

function CustomersTab({ customers, segmentFilter, setSegmentFilter, searchPhone, setSearchPhone, onSearch, customerDetail, setCustomerDetail, bgCard, textColor, mutedText, borderColor, inputBg }) {
  return <div className="space-y-4">
    <div className="flex gap-2 items-center flex-wrap">
      <div className="flex gap-1">
        {['', 'vip', 'loyal', 'regular', 'at_risk', 'new'].map(s => (
          <button key={s} onClick={() => setSegmentFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${segmentFilter === s ? 'bg-t-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-t-muted hover:bg-t-primary/10'}`}>
            {segmentLabels[s] || 'All'}
          </button>
        ))}
      </div>
      <div className="flex gap-2 ml-auto">
        <input type="text" placeholder="Search phone..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch()}
          className={`w-48 px-3 py-1.5 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
        <button onClick={onSearch} className="px-3 py-1.5 bg-t-primary text-white rounded-lg text-xs font-bold"><Search className="w-3.5 h-3.5" /></button>
      </div>
    </div>

    {customerDetail && <div className={`${bgCard} rounded-xl p-5 border ${borderColor}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-bold ${textColor}`}>Customer: {customerDetail.customer?.name || customerDetail.customer?.phone}</h3>
        <button onClick={() => setCustomerDetail(null)} className="p-1 rounded hover:bg-t-primary/10"><X className="w-4 h-4 text-t-muted" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Orders', value: customerDetail.customer?.total_orders },
          { label: 'Total Spent', value: `৳${Number(customerDetail.customer?.total_spent || 0).toLocaleString()}` },
          { label: 'LTV Score', value: customerDetail.customer?.ltv_score },
          { label: 'Success Rate', value: `${customerDetail.customer?.success_rate || 0}%` },
          { label: 'Segment', value: segmentLabels[customerDetail.customer?.segment] },
          { label: 'Risk Score', value: customerDetail.customer?.risk_score },
          { label: 'Churn Risk', value: `${customerDetail.customer?.churn_risk || 0}%` },
          { label: 'Predicted LTV', value: `৳${Number(customerDetail.customer?.predicted_ltv || 0).toLocaleString()}` },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-t-base border border-t-border">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>{s.label}</div>
            <div className={`text-sm font-bold ${textColor}`}>{s.value || '-'}</div>
          </div>
        ))}
      </div>
      {customerDetail.fraudAlerts?.length > 0 && <div>
        <h4 className={`text-xs font-bold ${mutedText} mb-2 uppercase tracking-wider`}>Fraud History</h4>
        <div className="space-y-1">
          {customerDetail.fraudAlerts.map(fa => (
            <div key={fa.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${fa.resolved_at ? 'opacity-50' : ''} ${fa.risk_level === 'high' ? 'bg-red-500/5' : 'bg-yellow-500/5'}`}>
              <span className={textColor}>{fa.reason}</span>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${fa.risk_level === 'high' ? 'text-red-500' : 'text-yellow-500'}`}>{fa.risk_level}</span>
                {fa.resolved_at && <span className={mutedText}>Resolved {new Date(fa.resolved_at).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>}
    </div>}

    <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
      <div className="overflow-x-auto">
        {customers.length === 0 ? <p className={`p-8 text-center text-sm ${mutedText}`}>No customers found</p> : <table className="w-full text-sm">
          <thead><tr className={`border-b ${borderColor} text-xs ${mutedText} uppercase tracking-wider`}>
            <th className="text-left p-4 font-bold">Phone</th>
            <th className="text-left p-4 font-bold">Name</th>
            <th className="text-right p-4 font-bold">Orders</th>
            <th className="text-right p-4 font-bold">Spent</th>
            <th className="text-right p-4 font-bold">AOV</th>
            <th className="text-right p-4 font-bold">LTV</th>
            <th className="text-right p-4 font-bold">Success</th>
            <th className="text-right p-4 font-bold">Risk</th>
            <th className="text-right p-4 font-bold">Segment</th>
          </tr></thead>
          <tbody>{customers.map(c => (
            <tr key={c.id} className={`border-b ${borderColor} hover:bg-t-primary/5 transition-colors`}>
              <td className="p-4"><span className="font-mono text-xs text-t-muted">{c.phone}</span></td>
              <td className="p-4"><span className={`font-medium ${textColor}`}>{c.name || '-'}</span></td>
              <td className="p-4 text-right">{c.total_orders}</td>
              <td className="p-4 text-right font-medium">৳{Number(c.total_spent).toLocaleString()}</td>
              <td className="p-4 text-right">৳{Number(c.avg_order_value).toLocaleString()}</td>
              <td className="p-4 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div className="h-full bg-t-primary rounded-full" style={{ width: `${Math.min(100, c.ltv_score)}%` }}></div>
                  </div>
                  <span className="text-xs font-bold">{c.ltv_score}</span>
                </div>
              </td>
              <td className="p-4 text-right"><span className={c.success_rate >= 80 ? 'text-green-500' : 'text-red-500'}>{c.success_rate}%</span></td>
              <td className="p-4 text-right"><span className={c.risk_score >= 50 ? 'text-red-500 font-bold' : 'text-t-muted'}>{c.risk_score}</span></td>
              <td className="p-4 text-right">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.segment === 'vip' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : c.segment === 'loyal' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : c.segment === 'at_risk' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{segmentLabels[c.segment] || c.segment}</span>
              </td>
            </tr>
          ))}</tbody>
        </table>}
      </div>
    </div>
  </div>;
}

function RiskMatrixTab({ matrix, bgCard, textColor, mutedText, borderColor }) {
  const tierMeta = { critical: { label: 'Critical Risk', color: 'text-red-500', bar: 'bg-red-500', bg: 'bg-red-500/5' }, high: { label: 'High Risk', color: 'text-orange-500', bar: 'bg-orange-500', bg: 'bg-orange-500/5' }, medium: { label: 'Medium Risk', color: 'text-yellow-500', bar: 'bg-yellow-500', bg: 'bg-yellow-500/5' }, low: { label: 'Low Risk', color: 'text-blue-500', bar: 'bg-blue-500', bg: 'bg-blue-500/5' }, minimal: { label: 'Minimal Risk', color: 'text-green-500', bar: 'bg-green-500', bg: 'bg-green-500/5' } };
  const maxCount = Math.max(...(matrix.map(r => r.count) || [1]), 1);

  return <div className={`${bgCard} rounded-xl p-6 border ${borderColor}`}>
    <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-6`}>Customer Risk Distribution</h3>
    <div className="space-y-4">
      {matrix.length === 0 ? <p className={`text-sm ${mutedText} text-center py-8`}>No risk data available. Run analysis first.</p> : matrix.map((row, i) => {
        const meta = tierMeta[row.risk_tier] || { label: row.risk_tier, color: 'text-gray-500', bar: 'bg-gray-500', bg: 'bg-gray-500/5' };
        return <div key={i} className={`p-4 rounded-xl ${meta.bg} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
            <span className={`text-lg font-black ${meta.color}`}>{row.count}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-3">
            <div className={`h-full ${meta.bar} rounded-full transition-all duration-500`} style={{ width: `${(row.count / maxCount) * 100}%` }}></div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className={mutedText}>Avg Spend</span><p className={`font-bold ${textColor}`}>৳{Number(row.avg_spent).toLocaleString()}</p></div>
            <div><span className={mutedText}>Avg LTV</span><p className={`font-bold ${textColor}`}>{row.avg_ltv}</p></div>
            <div><span className={mutedText}>Success Rate</span><p className={`font-bold ${textColor}`}>{row.avg_success_rate}%</p></div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

function ActivityTab({ logs, bgCard, textColor, mutedText, borderColor }) {
  const actionMeta = {
    full_analysis: { label: 'Full Analysis', color: 'text-blue-500', icon: '🔬' },
    auto_resolve: { label: 'Auto Resolve', color: 'text-green-500', icon: '🤖' },
    resolve_alert: { label: 'Alert Resolved', color: 'text-emerald-500', icon: '✅' },
    bulk_resolve: { label: 'Bulk Resolve', color: 'text-teal-500', icon: '📋' },
    update_setting: { label: 'Setting Changed', color: 'text-purple-500', icon: '⚙️' },
  };

  return <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
    <div className="p-4 border-b border-t-border"><h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>Recent Brain Activity</h3></div>
    {logs.length === 0 ? <p className={`p-8 text-center text-sm ${mutedText}`}>No activity logged yet</p> : <div className="divide-y divide-t-border">
      {logs.map((log, i) => {
        const meta = actionMeta[log.action] || { label: log.action, color: 'text-gray-500', icon: '•' };
        return <div key={log.id || i} className="p-4 flex items-start gap-3">
          <span className="text-base">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
              {log.entity_id && <span className={`text-[10px] font-mono ${mutedText}`}>{log.entity_id}</span>}
            </div>
            {log.entity_type && <p className={`text-xs ${mutedText}`}>{log.entity_type}</p>}
            <p className={`text-[10px] ${mutedText} mt-0.5`}>{log.performed_by} • {new Date(log.created_at).toLocaleString()}</p>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}

function SettingsTab({ settings, onUpdate, bgCard, textColor, mutedText, borderColor, inputBg }) {
  const [editing, setEditing] = useState({});
  const settingMeta = {
    red_threshold: { label: 'Red Zone Threshold', desc: 'Success rate below this (%) = Red Zone', unit: '%' },
    amber_threshold: { label: 'Amber Zone Threshold', desc: 'Success rate below this (%) = Amber Zone', unit: '%' },
    min_orders_analysis: { label: 'Min Orders for Analysis', desc: 'Minimum orders needed to analyze an area', unit: '' },
    fraud_high_threshold: { label: 'High Risk Threshold', desc: 'Customer success rate below this (%) = High Risk', unit: '%' },
    fraud_medium_threshold: { label: 'Medium Risk Threshold', desc: 'Customer success rate below this (%) = Medium Risk', unit: '%' },
    cod_block_success_rate: { label: 'COD Block Threshold', desc: 'Customer success rate below this blocks COD', unit: '%' },
    vip_min_spent: { label: 'VIP Min Spent', desc: 'Minimum total spent (৳) for VIP segment', unit: '৳' },
    vip_min_orders: { label: 'VIP Min Orders', desc: 'Minimum orders for VIP segment', unit: '' },
    loyal_min_orders: { label: 'Loyal Min Orders', desc: 'Minimum orders for Loyal segment', unit: '' },
    loyal_max_inactive_days: { label: 'Loyal Max Inactive Days', desc: 'Max days since last order for Loyal', unit: 'days' },
    at_risk_inactive_days: { label: 'At Risk Inactive Days', desc: 'Days since last order to mark At Risk', unit: 'days' },
    auto_resolve_days: { label: 'Auto-Resolve Days', desc: 'Auto-resolve fraud alerts after N days', unit: 'days' },
    min_orders_fraud_flag: { label: 'Min Orders Fraud Flag', desc: 'Min orders before flagging for fraud', unit: '' },
  };

  const saveSetting = async (key) => {
    if (editing[key] !== undefined) { await onUpdate(key, editing[key]); setEditing(p => { const n = { ...p }; delete n[key]; return n; }); }
  };

  return <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
    <div className="p-4 border-b border-t-border"><h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>Brain Configuration — All thresholds are dynamic</h3></div>
    <div className="divide-y divide-t-border">
      {settings.map(s => {
        const meta = settingMeta[s.key] || { label: s.key, desc: s.description, unit: '' };
        return <div key={s.key} className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-medium ${textColor}`}>{meta.label}</div>
            <div className={`text-xs ${mutedText}`}>{meta.desc}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing[s.key] !== undefined ? <>
              <input type="number" value={editing[s.key]} onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))}
                className={`w-20 px-2 py-1.5 rounded-lg text-sm text-center border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
              <button onClick={() => saveSetting(s.key)} className="px-2.5 py-1.5 bg-t-primary text-white rounded-lg text-xs font-bold hover:bg-t-primary/90">Save</button>
              <button onClick={() => setEditing(p => { const n = { ...p }; delete n[s.key]; return n; })} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-t-border hover:bg-t-primary/5">Cancel</button>
            </> : <>
              <span className={`text-sm font-bold ${textColor} font-mono`}>{s.value}{meta.unit}</span>
              <button onClick={() => setEditing(p => ({ ...p, [s.key]: s.value }))} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-t-border hover:bg-t-primary/5 transition-all"><Settings className="w-3 h-3" /></button>
            </>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
