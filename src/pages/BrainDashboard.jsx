import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient';
import { toBrainPhone } from '../utils/phone';
import { Brain, MapPin, AlertTriangle, Users, TrendingUp, TrendingDown, Activity, Settings, Shield, BarChart3, Clock, RefreshCw, Play, Search, X, CheckCircle2 } from 'lucide-react';

const segmentLabels = { vip: 'VIP', loyal: 'Loyal', regular: 'Regular', at_risk: 'At Risk', new: 'New' };
const segmentColors = { vip: 'text-yellow-500', loyal: 'text-green-500', regular: 'text-blue-500', at_risk: 'text-orange-500', new: 'text-gray-500' };

/**
 * Reads one Brain address. It reads again when the address changes (a filter
 * click) or when `refresh` goes up (after something changed on the server).
 * A late answer for an old address is dropped, so a list never shows the rows
 * of another filter. Returns {} while waiting, then { data } or { error }.
 */
function useBrain(path, refresh) {
  const [state, setState] = useState({});
  useEffect(() => {
    let ignore = false;
    apiClient(path)
      .then(data => { if (!ignore) setState({ data }); })
      .catch(error => {
        if (ignore) return;
        setState({ error });
        toast.error(error.message, { id: 'brain-load' }); // one message, even when all eight reads fail
      });
    return () => { ignore = true; };
  }, [path, refresh]);
  return state;
}

export default function BrainDashboard() {
  const [tab, setTab] = useState('overview');
  const [refresh, setRefresh] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('');
  const [alertFilter, setAlertFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [customerDetail, setCustomerDetail] = useState(null);

  // One read per job: a filter click changes one address, so it reads one list again, not all eight.
  const brain = {
    summary: useBrain('/api/brain/summary', refresh),
    insights: useBrain('/api/brain/insights', refresh),
    zones: useBrain(`/api/brain/red-zones?status=${zoneFilter}`, refresh),
    alerts: useBrain(`/api/brain/fraud-alerts?risk=${alertFilter}`, refresh),
    customers: useBrain(`/api/brain/customers?segment=${segmentFilter}`, refresh),
    matrix: useBrain('/api/brain/risk-matrix', refresh),
    logs: useBrain('/api/brain/activity-log?limit=20', refresh),
    settings: useBrain('/api/brain/settings', refresh),
  };
  const alerts = brain.alerts.data?.alerts ?? [];
  const loading = Object.values(brain).some(read => !read.data && !read.error);

  const reload = () => setRefresh(n => n + 1);

  // Every change works the same way: ask the server, show its reason if it says no, then read the page again.
  // Resolves to true when the server did it.
  const change = async (path, options) => {
    try {
      await apiClient(path, options);
      reload();
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    await change('/api/brain/analyze', { method: 'POST' });
    setAnalyzing(false);
  };

  const resolveAlert = (id) => change(`/api/brain/fraud-alerts/${id}/resolve`, { method: 'PUT' });

  const bulkResolveAlerts = () => {
    const ids = alerts.filter(a => !a.resolved_at).map(a => a.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to resolve all ${ids.length} alerts in this list?`)) return;
    return change('/api/brain/fraud-alerts/bulk-resolve', { method: 'POST', body: { ids } });
  };

  const updateSetting = (key, value) => change('/api/brain/settings', { method: 'PUT', body: { key, value } });

  const searchCustomer = async () => {
    const typed = searchPhone.trim();
    if (!typed) return;
    // One person can be saved as "017…" or as "+88017…": try what was typed, then the other spellings.
    const withCode = toBrainPhone(typed);
    let lastError;
    for (const phone of new Set([typed, withCode, withCode.slice(3)].filter(Boolean))) {
      try {
        return setCustomerDetail(await apiClient(`/api/brain/customers/${encodeURIComponent(phone)}`));
      } catch (error) { lastError = error; }
    }
    setCustomerDetail(null); // never leave the card of the customer searched before
    toast.error(lastError.data?.message || ([200, 404].includes(lastError.status) ? 'Customer not found' : lastError.message));
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <Brain className="w-4 h-4" />, needs: ['summary', 'insights', 'matrix'] },
    { key: 'red_zones', label: 'Red Zones', icon: <MapPin className="w-4 h-4" />, needs: ['zones'] },
    { key: 'fraud', label: 'Fraud Alerts', icon: <AlertTriangle className="w-4 h-4" />, needs: ['alerts'] },
    { key: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" />, needs: ['customers'] },
    { key: 'risk_matrix', label: 'Risk Matrix', icon: <BarChart3 className="w-4 h-4" />, needs: ['matrix'] },
    { key: 'activity', label: 'Activity', icon: <Clock className="w-4 h-4" />, needs: ['logs'] },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, needs: ['settings'] },
  ];
  // A list that did not load must never look like an empty list ("No fraud alerts"): the tab shows the error instead.
  const loadError = tabs.find(t => t.key === tab).needs.map(need => brain[need].error).find(Boolean);

  if (loading) return (
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
          <div><h1 className="text-lg font-black uppercase tracking-wider">The Brain</h1><p className="text-xs text-t-muted">Intelligence Engine v2 — Insights, Risk, Automation</p></div>
        </div>
        <button onClick={runAnalysis} disabled={analyzing} className="flex items-center gap-2 px-4 py-2.5 bg-t-primary text-white rounded-lg hover:bg-t-primary/90 transition-all text-sm font-bold disabled:opacity-50">
          {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {analyzing ? 'Analyzing...' : 'Run Full Analysis'}
        </button>
      </div>

      <div className="flex gap-1 flex-wrap mb-6 p-1 rounded-xl bg-t-base border border-t-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.key ? 'bg-t-primary text-white shadow-sm' : 'text-t-muted hover:bg-t-primary/10 hover:text-t-primary'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loadError ? (
        <div role="alert" className="bg-t-surface rounded-xl border border-red-500/40 p-8 text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-t-main">This part of the Brain could not be loaded.</p>
          <p className="text-sm text-t-muted mt-1">{loadError.message}</p>
          <button onClick={reload} className="mt-4 px-4 py-2 bg-t-primary text-white rounded-lg text-xs font-bold hover:bg-t-primary/90 transition-all">Try again</button>
        </div>
      ) : <>
        {tab === 'overview' && <OverviewTab summary={brain.summary.data} insights={brain.insights.data?.insights} riskMatrix={brain.matrix.data?.matrix ?? []} />}
        {tab === 'red_zones' && <RedZonesTab zones={brain.zones.data?.zones ?? []} zoneFilter={zoneFilter} setZoneFilter={setZoneFilter} />}
        {tab === 'fraud' && <FraudAlertsTab alerts={alerts} alertFilter={alertFilter} setAlertFilter={setAlertFilter} onResolve={resolveAlert} onBulkResolve={bulkResolveAlerts} />}
        {tab === 'customers' && <CustomersTab customers={brain.customers.data?.customers ?? []} segmentFilter={segmentFilter} setSegmentFilter={setSegmentFilter} searchPhone={searchPhone} setSearchPhone={setSearchPhone} onSearch={searchCustomer} customerDetail={customerDetail} setCustomerDetail={setCustomerDetail} />}
        {tab === 'risk_matrix' && <RiskMatrixTab matrix={brain.matrix.data?.matrix ?? []} />}
        {tab === 'activity' && <ActivityTab logs={brain.logs.data?.logs ?? []} />}
        {tab === 'settings' && <SettingsTab settings={brain.settings.data?.settings ?? []} onUpdate={updateSetting} />}
      </>}
    </div>
  );
}

function OverviewTab({ summary, insights, riskMatrix }) {
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
        <div key={i} className="bg-t-surface rounded-xl p-4 border border-t-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-t-muted">{s.label}</span>
            <span className={s.color}>{s.icon}</span>
          </div>
          <div className="text-2xl font-black text-t-main">{s.value}</div>
          {s.sub && <div className="text-xs text-t-muted mt-0.5">{s.sub}</div>}
        </div>
      ))}
    </div>

    {insights && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-t-surface rounded-xl p-5 border border-t-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-t-muted mb-4 flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Worst Performing Areas</h3>
        {insights.worstAreas?.length > 0 ? <div className="space-y-2">
          {insights.worstAreas.map((a, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'red' ? 'bg-red-500' : 'bg-amber-500'} shrink-0`}></span>
                <span className="text-sm truncate text-t-main">{a.area_name || a.delivery_area}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-t-muted">{a.total_orders} orders</span>
                <span className={`text-xs font-bold ${a.success_rate < 50 ? 'text-red-500' : 'text-amber-500'}`}>{a.success_rate}%</span>
              </div>
            </div>
          ))}
        </div> : <p className="text-sm text-t-muted text-center py-4">No problem areas identified</p>}
      </div>

      <div className="bg-t-surface rounded-xl p-5 border border-t-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-t-muted mb-4 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> High Risk Customers</h3>
        {insights.highRiskCustomers?.length > 0 ? <div className="space-y-2 max-h-64 overflow-y-auto">
          {insights.highRiskCustomers.slice(0, 10).map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate text-t-main">{c.name || c.phone}</div>
                <div className="text-xs text-t-muted">{c.phone} • {c.total_orders} orders • {c.segment}</div>
              </div>
              <span className={`text-xs font-bold shrink-0 ${c.risk_score >= 70 ? 'text-red-500' : c.risk_score >= 50 ? 'text-orange-500' : 'text-yellow-500'}`}>{c.risk_score}</span>
            </div>
          ))}
        </div> : <p className="text-sm text-t-muted text-center py-4">No high-risk customers</p>}
      </div>

      {insights.churnRisks?.length > 0 && <div className="bg-t-surface rounded-xl p-5 border border-t-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-t-muted mb-4 flex items-center gap-2"><TrendingDown className="w-3.5 h-3.5" /> Churn Risk Customers</h3>
        <div className="space-y-2">
          {insights.churnRisks.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate text-t-main">{c.name || c.phone}</div>
                <div className="text-xs text-t-muted">{c.days_since_last_order}d inactive • Predicted: ৳{Number(c.predicted_ltv || 0).toLocaleString()}</div>
              </div>
              <span className={`text-xs font-bold ${c.churn_risk >= 70 ? 'text-red-500' : 'text-orange-500'}`}>{c.churn_risk}%</span>
            </div>
          ))}
        </div>
      </div>}

      {insights.topCustomers?.length > 0 && <div className="bg-t-surface rounded-xl p-5 border border-t-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-t-muted mb-4 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Top Customers by LTV</h3>
        <div className="space-y-2">
          {insights.topCustomers.map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate text-t-main">{c.name || c.phone}</div>
                <div className="text-xs text-t-muted">{c.total_orders} orders • ৳{Number(c.total_spent).toLocaleString()} • {c.segment}</div>
              </div>
              <span className={`text-xs font-bold ${segmentColors[c.segment] || 'text-gray-500'}`}>{c.ltv_score}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>}
  </div>;
}

function RedZonesTab({ zones, zoneFilter, setZoneFilter }) {
  return <div className="bg-t-surface rounded-xl border border-t-border overflow-hidden">
    <div className="p-4 border-b border-t-border flex gap-2">
      {['', 'red', 'amber', 'safe'].map(s => (
        <button key={s} onClick={() => setZoneFilter(s)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoneFilter === s ? 'bg-t-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-t-muted hover:bg-t-primary/10'}`}>
          {s || 'All'}
        </button>
      ))}
    </div>
    <div className="overflow-x-auto">
      {zones.length === 0 ? <p className="p-8 text-center text-sm text-t-muted">No zones found</p> : <table className="w-full text-sm">
        <thead><tr className="border-b border-t-border text-xs text-t-muted uppercase tracking-wider">
          <th className="text-left p-4 font-bold">Area</th>
          <th className="text-right p-4 font-bold">Orders</th>
          <th className="text-right p-4 font-bold">Delivered</th>
          <th className="text-right p-4 font-bold">Failed</th>
          <th className="text-right p-4 font-bold">Success Rate</th>
          <th className="text-right p-4 font-bold">Status</th>
        </tr></thead>
        <tbody>{zones.map(z => (
          <tr key={z.id} className="border-b border-t-border hover:bg-t-primary/5 transition-colors">
            <td className="p-4"><span className="font-medium text-t-main">{z.area_name || z.delivery_area}</span></td>
            <td className="p-4 text-right"><span className="text-t-main">{z.total_orders}</span></td>
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

function FraudAlertsTab({ alerts, alertFilter, setAlertFilter, onResolve, onBulkResolve }) {
  const unresolved = alerts.filter(a => !a.resolved_at);
  return <div className="bg-t-surface rounded-xl border border-t-border overflow-hidden">
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
      {alerts.length === 0 ? <p className="col-span-full text-center py-8 text-sm text-t-muted">No fraud alerts</p> : alerts.map(a => (
        <div key={a.id} className={`p-4 rounded-xl border border-t-border ${a.resolved_at ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-t-main">{a.name || a.phone}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.risk_level === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : a.risk_level === 'medium' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{a.risk_level}</span>
          </div>
          <p className="text-xs text-t-muted mb-1">{a.phone}</p>
          <p className="text-xs text-t-muted mb-2">{a.reason}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs">
              <span className="text-t-main">{a.total_orders} orders</span>
              <span className="text-red-500">{a.failed_deliveries} failed</span>
              <span className={a.success_rate < 50 ? 'text-red-500' : 'text-green-500'}>{a.success_rate}%</span>
            </div>
            {!a.resolved_at && <button onClick={() => onResolve(a.id)} title="Resolve" aria-label="Resolve" className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30"><CheckCircle2 className="w-4 h-4 text-green-500" /></button>}
          </div>
          {a.resolved_at && <p className="text-[10px] text-t-muted mt-2">Resolved {new Date(a.resolved_at).toLocaleDateString()} by {a.resolved_by}</p>}
        </div>
      ))}
    </div>
  </div>;
}

function CustomersTab({ customers, segmentFilter, setSegmentFilter, searchPhone, setSearchPhone, onSearch, customerDetail, setCustomerDetail }) {
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
          className="w-48 px-3 py-1.5 rounded-lg text-sm border border-t-border bg-t-surface text-t-main focus:outline-none focus:ring-2 focus:ring-t-primary/40" />
        <button onClick={onSearch} className="px-3 py-1.5 bg-t-primary text-white rounded-lg text-xs font-bold"><Search className="w-3.5 h-3.5" /></button>
      </div>
    </div>

    {customerDetail && <div className="bg-t-surface rounded-xl p-5 border border-t-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-t-main">Customer: {customerDetail.customer?.name || customerDetail.customer?.phone}</h3>
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-t-muted">{s.label}</div>
            <div className="text-sm font-bold text-t-main">{s.value ?? '-'}</div>
          </div>
        ))}
      </div>
      {customerDetail.fraudAlerts?.length > 0 && <div>
        <h4 className="text-xs font-bold text-t-muted mb-2 uppercase tracking-wider">Fraud History</h4>
        <div className="space-y-1">
          {customerDetail.fraudAlerts.map(fa => (
            <div key={fa.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${fa.resolved_at ? 'opacity-50' : ''} ${fa.risk_level === 'high' ? 'bg-red-500/5' : 'bg-yellow-500/5'}`}>
              <span className="text-t-main">{fa.reason}</span>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${fa.risk_level === 'high' ? 'text-red-500' : 'text-yellow-500'}`}>{fa.risk_level}</span>
                {fa.resolved_at && <span className="text-t-muted">Resolved {new Date(fa.resolved_at).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>}
    </div>}

    <div className="bg-t-surface rounded-xl border border-t-border overflow-hidden">
      <div className="overflow-x-auto">
        {customers.length === 0 ? <p className="p-8 text-center text-sm text-t-muted">No customers found</p> : <table className="w-full text-sm">
          <thead><tr className="border-b border-t-border text-xs text-t-muted uppercase tracking-wider">
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
            <tr key={c.id} className="border-b border-t-border hover:bg-t-primary/5 transition-colors">
              <td className="p-4"><span className="font-mono text-xs text-t-muted">{c.phone}</span></td>
              <td className="p-4"><span className="font-medium text-t-main">{c.name || '-'}</span></td>
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

function RiskMatrixTab({ matrix }) {
  const tierMeta = { critical: { label: 'Critical Risk', color: 'text-red-500', bar: 'bg-red-500', bg: 'bg-red-500/5' }, high: { label: 'High Risk', color: 'text-orange-500', bar: 'bg-orange-500', bg: 'bg-orange-500/5' }, medium: { label: 'Medium Risk', color: 'text-yellow-500', bar: 'bg-yellow-500', bg: 'bg-yellow-500/5' }, low: { label: 'Low Risk', color: 'text-blue-500', bar: 'bg-blue-500', bg: 'bg-blue-500/5' }, minimal: { label: 'Minimal Risk', color: 'text-green-500', bar: 'bg-green-500', bg: 'bg-green-500/5' } };
  const maxCount = Math.max(...matrix.map(r => r.count), 1);

  return <div className="bg-t-surface rounded-xl p-6 border border-t-border">
    <h3 className="text-xs font-bold uppercase tracking-wider text-t-muted mb-6">Customer Risk Distribution</h3>
    <div className="space-y-4">
      {matrix.length === 0 ? <p className="text-sm text-t-muted text-center py-8">No risk data available. Run analysis first.</p> : matrix.map((row, i) => {
        const meta = tierMeta[row.risk_tier] || { label: row.risk_tier, color: 'text-gray-500', bar: 'bg-gray-500', bg: 'bg-gray-500/5' };
        return <div key={i} className={`p-4 rounded-xl ${meta.bg} border border-t-border`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
            <span className={`text-lg font-black ${meta.color}`}>{row.count}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-3">
            <div className={`h-full ${meta.bar} rounded-full transition-all duration-500`} style={{ width: `${(row.count / maxCount) * 100}%` }}></div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-t-muted">Avg Spend</span><p className="font-bold text-t-main">৳{Number(row.avg_spent).toLocaleString()}</p></div>
            <div><span className="text-t-muted">Avg LTV</span><p className="font-bold text-t-main">{row.avg_ltv}</p></div>
            <div><span className="text-t-muted">Success Rate</span><p className="font-bold text-t-main">{row.avg_success_rate}%</p></div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

function ActivityTab({ logs }) {
  const actionMeta = {
    full_analysis: { label: 'Full Analysis', color: 'text-blue-500', icon: '🔬' },
    auto_resolve: { label: 'Auto Resolve', color: 'text-green-500', icon: '🤖' },
    resolve_alert: { label: 'Alert Resolved', color: 'text-emerald-500', icon: '✅' },
    bulk_resolve: { label: 'Bulk Resolve', color: 'text-teal-500', icon: '📋' },
    update_setting: { label: 'Setting Changed', color: 'text-purple-500', icon: '⚙️' },
  };

  return <div className="bg-t-surface rounded-xl border border-t-border overflow-hidden">
    <div className="p-4 border-b border-t-border"><h3 className="text-xs font-bold uppercase tracking-wider text-t-muted">Recent Brain Activity</h3></div>
    {logs.length === 0 ? <p className="p-8 text-center text-sm text-t-muted">No activity logged yet</p> : <div className="divide-y divide-t-border">
      {logs.map((log, i) => {
        const meta = actionMeta[log.action] || { label: log.action, color: 'text-gray-500', icon: '•' };
        return <div key={log.id || i} className="p-4 flex items-start gap-3">
          <span className="text-base">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
              {log.entity_id && <span className="text-[10px] font-mono text-t-muted">{log.entity_id}</span>}
            </div>
            {log.entity_type && <p className="text-xs text-t-muted">{log.entity_type}</p>}
            <p className="text-[10px] text-t-muted mt-0.5">{log.performed_by} • {new Date(log.created_at).toLocaleString()}</p>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}

function SettingsTab({ settings, onUpdate }) {
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

  const stopEditing = (key) => setEditing(p => { const n = { ...p }; delete n[key]; return n; });

  const saveSetting = async (key) => {
    const value = editing[key];
    if (value === undefined) return;
    const isPercent = settingMeta[key]?.unit === '%';
    const number = Number(value);
    if (String(value).trim() === '' || !Number.isFinite(number) || number < 0 || (isPercent && number > 100)) {
      return toast.error(isPercent ? 'Enter a number from 0 to 100.' : 'Enter a number that is 0 or more.');
    }
    // If the server says no, the box stays open so the typed value is not lost.
    if (await onUpdate(key, value)) stopEditing(key);
  };

  return <div className="bg-t-surface rounded-xl border border-t-border overflow-hidden">
    <div className="p-4 border-b border-t-border"><h3 className="text-xs font-bold uppercase tracking-wider text-t-muted">Brain Configuration — All thresholds are dynamic</h3></div>
    <div className="divide-y divide-t-border">
      {settings.map(s => {
        const meta = settingMeta[s.key] || { label: s.key, desc: s.description, unit: '' };
        return <div key={s.key} className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-t-main">{meta.label}</div>
            <div className="text-xs text-t-muted">{meta.desc}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing[s.key] !== undefined ? <>
              <input type="number" value={editing[s.key]} onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))}
                className="w-20 px-2 py-1.5 rounded-lg text-sm text-center border border-t-border bg-t-base text-t-main focus:outline-none focus:ring-2 focus:ring-t-primary/40" />
              <button onClick={() => saveSetting(s.key)} className="px-2.5 py-1.5 bg-t-primary text-white rounded-lg text-xs font-bold hover:bg-t-primary/90">Save</button>
              <button onClick={() => stopEditing(s.key)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-t-border hover:bg-t-primary/5">Cancel</button>
            </> : <>
              <span className="text-sm font-bold text-t-main font-mono">{s.value}{meta.unit}</span>
              <button onClick={() => setEditing(p => ({ ...p, [s.key]: s.value }))} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-t-border hover:bg-t-primary/5 transition-all"><Settings className="w-3 h-3" /></button>
            </>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
