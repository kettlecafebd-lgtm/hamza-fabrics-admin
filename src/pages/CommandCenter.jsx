import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { 
  Activity, AlertTriangle, Phone, TrendingUp, ShoppingCart, Users, 
  MapPin, Shield, PhoneCall, Clock, CheckCircle2, XCircle, 
  RefreshCw, ChevronRight, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config/api';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  preorder: 'bg-orange-100 text-orange-700'
};

const SEGMENT_COLORS = {
  vip: 'bg-purple-100 text-purple-700',
  loyal: 'bg-blue-100 text-blue-700',
  regular: 'bg-green-100 text-green-700',
  at_risk: 'bg-red-100 text-red-700',
  new: 'bg-gray-100 text-gray-600'
};

export default function CommandCenter() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const navigate = useNavigate();

  const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [lastRefresh, setLastRefresh] = useState(null);
const [syncing, setSyncing] = useState(false);

  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  const fetchCommandCenter = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/auto-call/command-center`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCommandCenter(); }, []);

  if (loading) return (
    <div className="p-8 text-center min-h-screen bg-t-base">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-t-primary mb-4"></div>
      <p className={`font-bold uppercase tracking-widest text-sm ${mutedText}`}>Loading Command Center...</p>
    </div>
  );

  const ordersByStatus = data?.ordersByStatus || [];
  const totalOrders = ordersByStatus.reduce((sum, r) => sum + r.count, 0);
  const todayOrders = data?.today?.total || 0;
  const todayRevenue = parseFloat(data?.today?.revenue || 0);
  const pendingCalls = data?.pendingCalls || 0;
  const redZones = data?.zoneStats?.red || 0;
  const amberZones = data?.zoneStats?.amber || 0;
  const highAlerts = data?.recentAlerts?.filter(a => a.risk_level === 'high').length || 0;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto min-h-screen bg-t-base">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-t-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-black ${textColor}`}>Command Center</h1>
              <p className={`text-xs ${mutedText}`}>HamzaBI Intelligence Dashboard — All 6 Layers</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className={`text-[10px] ${mutedText}`}>Updated {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button onClick={async () => {
            setSyncing(true);
            try {
              const token = localStorage.getItem('adminToken');
              await fetch(`${API_BASE_URL}/api/courier/sync`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            } catch(e) {}
            setSyncing(false);
            fetchCommandCenter();
          }} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </button>
          <button onClick={fetchCommandCenter} className="flex items-center gap-2 px-4 py-2 bg-t-surface border border-t-border rounded-lg text-xs font-bold hover:border-t-primary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Layer 1-2-3 Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: 'Total Orders', value: totalOrders, icon: <ShoppingCart className="w-4 h-4" />, color: 'text-blue-500', link: '/orders' },
          { label: 'Today', value: todayOrders, sub: `৳${todayRevenue.toLocaleString()}`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-500' },
          { label: 'Pending Calls', value: pendingCalls, icon: <Phone className="w-4 h-4" />, color: 'text-orange-500', link: '/auto-call-center' },
          { label: 'Red Zones', value: redZones, icon: <MapPin className="w-4 h-4" />, color: 'text-red-500', link: '/admin/brain' },
          { label: 'Amber Zones', value: amberZones, icon: <MapPin className="w-4 h-4" />, color: 'text-yellow-500', link: '/admin/brain' },
          { label: 'High Alerts', value: highAlerts, icon: <Shield className="w-4 h-4" />, color: 'text-red-600', link: '/admin/brain' },
          { label: 'Customers', value: data?.topCustomers?.length || 0, icon: <Users className="w-4 h-4" />, color: 'text-purple-500', link: '/admin/brain' }
        ].map((stat, i) => (
          <div
            key={i}
            onClick={() => stat.link && navigate(stat.link)}
            className={`${bgCard} rounded-xl p-4 border ${borderColor} ${stat.link ? 'cursor-pointer hover:border-t-primary hover:-translate-y-0.5' : ''} transition-all`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>{stat.label}</span>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className={`text-2xl font-black ${textColor}`}>{stat.value}</div>
            {stat.sub && <div className="text-xs text-green-600 font-bold mt-0.5">{stat.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Pipeline */}
        <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-t-border flex items-center justify-between">
            <h3 className={`font-black text-sm ${textColor}`}>Order Pipeline</h3>
            <button onClick={() => navigate('/orders')} className="text-[10px] font-bold text-t-primary hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3"/></button>
          </div>
          <div className="p-5 space-y-3">
            {ordersByStatus.length === 0 ? (
              <p className={`text-center py-4 ${mutedText} text-sm`}>No orders found</p>
            ) : ordersByStatus.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${textColor}`}>{s.count}</span>
                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                    <div className="bg-t-primary h-1.5 rounded-full transition-all" style={{ width: `${totalOrders > 0 ? (s.count / totalOrders) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fraud Alerts */}
        <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-t-border flex items-center justify-between">
            <h3 className={`font-black text-sm ${textColor}`}>Recent Fraud Alerts</h3>
            <button onClick={() => navigate('/admin/brain')} className="text-[10px] font-bold text-t-primary hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3"/></button>
          </div>
          <div className="p-5 space-y-3">
            {!data?.recentAlerts?.length ? (
              <p className={`text-center py-4 ${mutedText} text-sm`}>No pending alerts</p>
            ) : data.recentAlerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-t-base">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  alert.risk_level === 'high' ? 'text-red-500' : alert.risk_level === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${textColor}`}>{alert.phone}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      alert.risk_level === 'high' ? 'bg-red-100 text-red-700' : alert.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>{alert.risk_level}</span>
                  </div>
                  <p className={`text-xs ${mutedText} mt-0.5 truncate`}>{alert.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-t-border flex items-center justify-between">
            <h3 className={`font-black text-sm ${textColor}`}>Top Customers (LTV)</h3>
            <button onClick={() => navigate('/admin/brain?tab=customers')} className="text-[10px] font-bold text-t-primary hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3"/></button>
          </div>
          <div className="p-5 space-y-3">
            {!data?.topCustomers?.length ? (
              <p className={`text-center py-4 ${mutedText} text-sm`}>No customer data yet</p>
            ) : data.topCustomers.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-t-base">
                <div className="w-8 h-8 rounded-full bg-t-primary/10 flex items-center justify-center text-t-primary font-bold text-xs">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${textColor}`}>{c.name || c.phone}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${SEGMENT_COLORS[c.segment] || 'bg-gray-100 text-gray-600'}`}>{c.segment}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs ${mutedText}`}>{c.total_orders} orders</span>
                    <span className="text-xs font-bold text-green-600">৳{Number(c.total_spent).toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-t-primary">LTV {c.ltv_score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'New Order', icon: <ShoppingCart className="w-4 h-4" />, link: '/pos', color: 'bg-green-500 hover:bg-green-600' },
          { label: 'All Orders', icon: <Activity className="w-4 h-4" />, link: '/orders', color: 'bg-blue-500 hover:bg-blue-600' },
          { label: 'Fraud Check', icon: <Shield className="w-4 h-4" />, link: '/fraud-checker', color: 'bg-orange-500 hover:bg-orange-600' },
          { label: 'The Brain', icon: <Zap className="w-4 h-4" />, link: '/admin/brain', color: 'bg-purple-500 hover:bg-purple-600' },
          { label: 'Auto Calls', icon: <PhoneCall className="w-4 h-4" />, link: '/auto-call-center', color: 'bg-red-500 hover:bg-red-600' },
          { label: 'CRM Leads', icon: <Users className="w-4 h-4" />, link: '/admin/crm', color: 'bg-yellow-500 hover:bg-yellow-600' }
        ].map((action, i) => (
          <button
            key={i}
            onClick={() => navigate(action.link)}
            className={`${action.color} text-white rounded-xl p-4 flex flex-col items-center gap-2 font-bold text-xs uppercase tracking-wider hover:-translate-y-0.5 transition-all shadow-lg`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
