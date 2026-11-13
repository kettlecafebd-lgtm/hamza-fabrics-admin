import React, { useState, useEffect, useContext } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import API_BASE_URL from '../config/api';
import { cachedFetch, CACHE_TTLS } from '../lib/dataCache';
import { getToken } from '../utils/auth';
import { ThemeContext } from '../context/ThemeContext';

const Dashboard = () => {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [globalDateFilter, setGlobalDateFilter] = useState('30days');
  const [webOrderFilter, setWebOrderFilter] = useState('today');
  const [sourceFilter, setSourceFilter] = useState('today');
  const [orderCountFilter, setOrderCountFilter] = useState('30days');
  const [topProductFilter, setTopProductFilter] = useState('today');
  const [hourlyFilter, setHourlyFilter] = useState('today');



  // ===================== REAL DATA FETCHING =====================
  const fetchDashboardData = async ({ force = false } = {}) => {
    setLoading(true);
    try {
      const token = getToken();
      // Numbers may have moved between two visits, but not within 30 s — and a
      // tab-away/tab-back used to pay for the full analytics payload again.
      const response = await cachedFetch(`${API_BASE_URL}/api/analytics?filter=${globalDateFilter}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        token,
        ttl: CACHE_TTLS.analytics,
        force,
      });
      
      const result = await response.json();
      if (result.success) setData(result.data);
      else setError(result.message || 'Failed to load analytics data.');
    } catch (err) {
      console.error('API Fetch Error:', err);
      setError('Server is offline or unreachable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [globalDateFilter]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-t-base transition-colors duration-300">
        <div className="w-12 h-12 border-4 border-t-surface border-t-t-primary rounded-full animate-spin mb-4"></div>
        <div className="text-t-primary font-bold tracking-widest uppercase text-sm animate-pulse">Syncing Live Intelligence...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-t-base transition-colors duration-300">
        {/* 🔴 Updated to blend with dark themes */}
        <div className="bg-red-500/10 backdrop-blur-md p-8 text-center text-red-500 font-bold rounded-2xl border border-red-500/20 shadow-2xl max-w-md">
          <span className="text-4xl mb-4 block">⚠️</span>
          <p className="text-lg">{error}</p>
          <p className="text-xs text-red-400 mt-2 font-normal">Check your backend server connection.</p>
        </div>
      </div>
    );
  }

  // ===================== DATA MAPPING =====================
  const kpiData = {
    totalOrders: data?.overall?.total_orders || 0,
    totalSales: data?.profit?.totalRevenue || 0,
    profit: data?.profit?.netProfit || 0,
    pendingWeb: data?.orderStatus?.pendingOrders || 0
  };

  // 🔴 Updated semantic colors for Light/Dark mode compatibility
  const orderStatuses = [
    { name: 'Pending', count: data?.orderStatus?.pendingOrders || 0, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { name: 'Processing', count: data?.orderStatus?.processingOrders || 0, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { name: 'Shipped', count: data?.orderStatus?.shippedOrders || 0, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
    { name: 'Delivered', count: data?.orderStatus?.deliveredOrders || 0, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { name: 'Cancelled', count: data?.orderStatus?.cancelledOrders || 0, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' }
  ];

  const sourceData = [
    { name: 'WEB APP', value: kpiData.totalOrders > 0 ? kpiData.totalOrders : 1, color: 'var(--color-primary)' }
  ];

  const orderCountsData = (data?.dailyOrders || []).map(item => ({ date: item.date, count: item.orders }));
  const topProductsData = data?.topProducts || [];
  const hourlyData = data?.hourlyOrders || [];

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">
      
      {/* TOP HEADER & GLOBAL FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Business Overview</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Real-time analytics and performance metrics.</p>
        </div>
        
        <div className="flex items-center gap-3 mt-4 md:mt-0 bg-t-surface p-1.5 rounded-xl shadow-sm border border-t-border transition-colors duration-300">
          <select className="bg-transparent text-sm font-semibold text-t-main px-4 py-2 outline-none cursor-pointer hover:opacity-80 rounded-lg transition-colors border-none">
            <option>Approved Status</option>
            <option>All Status</option>
          </select>
          <div className="w-px h-6 bg-t-border"></div>
          <select 
            value={globalDateFilter} onChange={(e) => setGlobalDateFilter(e.target.value)}
            className="bg-transparent text-sm font-bold text-t-primary px-4 py-2 outline-none cursor-pointer hover:opacity-80 rounded-lg transition-colors border-none"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="custom">Custom Date</option>
          </select>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* ROW 1: PREMIUM KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Total Orders</span>
              <div className="bg-t-primary/10 p-2 rounded-lg text-t-primary group-hover:bg-t-primary group-hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg></div>
            </div>
            <div>
              <h2 className="text-4xl font-black tracking-tight">{kpiData.totalOrders}</h2>
              <p className="text-xs text-t-primary font-semibold mt-1 flex items-center gap-1">↑ Active Selection</p>
            </div>
          </div>

          <div className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Gross Sales</span>
              <div className="bg-red-500/10 p-2 rounded-lg text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg></div>
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight">৳{kpiData.totalSales.toLocaleString('en-IN')}</h2>
              <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">Total revenue generated</p>
            </div>
          </div>

          <div className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-t-accent/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Est. Net Profit</span>
              <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-black tracking-tight">৳{kpiData.profit.toLocaleString('en-IN')}</h2>
              <p className="text-xs text-blue-500 font-semibold mt-1 flex items-center gap-1">After cost deductions</p>
            </div>
          </div>

          <div className="bg-t-accent p-6 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Pending Web</span>
              <div className="bg-white/20 p-2 rounded-lg text-white backdrop-blur-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            </div>
            <div className="relative z-10">
              <h2 className="text-4xl font-black text-white tracking-tight">{kpiData.pendingWeb}</h2>
              <p className="text-xs text-white/80 font-semibold mt-1 flex items-center gap-1">Action required</p>
            </div>
          </div>
        </div>

        {/* STATUS PIPELINE */}
        <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border p-6 transition-colors duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-extrabold tracking-tight">Order Pipeline</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {orderStatuses.map(status => (
              <div key={status.name} className={`${status.bg} ${status.border} border p-4 rounded-xl text-center flex flex-col items-center justify-center transition-transform hover:scale-105 duration-200 cursor-default`}>
                <p className={`text-3xl font-black ${status.color} tracking-tight`}>{status.count}</p>
                <p className="text-[11px] text-t-muted font-bold uppercase tracking-wider mt-2">{status.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ROW 2: BAR CHART & PIE CHART */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border p-6 lg:col-span-2 flex flex-col transition-colors duration-300">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Daily Volume</h2>
                <p className="text-xs text-t-muted mt-1 font-medium">Order counts for the selected timeframe</p>
              </div>
              <select 
                value={orderCountFilter} 
                onChange={(e) => setOrderCountFilter(e.target.value)} 
                className="border border-t-border text-xs text-t-main rounded-lg px-3 py-1.5 outline-none focus:border-t-primary bg-t-base hover:opacity-80 cursor-pointer font-semibold transition-colors"
              >
                <option value="today">Today</option>
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
              </select>
            </div>
            <div className="h-[280px] w-full mt-auto">
              {orderCountsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderCountsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500}} />
                    <Tooltip cursor={{fill: 'var(--bg-base)'}} contentStyle={{fontSize: '12px', fontWeight: 'bold', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)'}} />
                    <Bar dataKey="count" fill="url(#colorBar)" maxBarSize={32} radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex justify-center items-center text-sm font-semibold text-t-muted bg-t-base rounded-xl border border-dashed border-t-border">No data available</div>
              )}
            </div>
          </div>

          <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border p-6 flex flex-col relative transition-colors duration-300">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Traffic Source</h2>
                <p className="text-xs text-t-muted font-medium mt-1">Where your orders are coming from</p>
              </div>
              <select 
                value={sourceFilter} 
                onChange={(e) => setSourceFilter(e.target.value)} 
                className="border border-t-border text-xs text-t-main rounded-lg px-2 py-1 outline-none focus:border-t-primary bg-t-base cursor-pointer font-semibold"
              >
                <option value="today">Today</option>
                <option value="30days">30 Days</option>
              </select>
            </div>
            <div className="flex-1 flex items-center justify-center relative mt-4">
              <div className="w-[220px] h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} innerRadius={70} outerRadius={95} paddingAngle={2} dataKey="value" stroke="none">
                      {sourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-xs font-bold text-t-muted uppercase tracking-widest mb-1">Total</span>
                <span className="text-3xl font-black tracking-tighter leading-none">{kpiData.totalOrders}</span>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <div className="flex items-center gap-3 bg-t-base px-4 py-2 rounded-full border border-t-border">
                <span className="w-2.5 h-2.5 rounded-full bg-t-primary shadow-sm"></span>
                <span className="text-xs text-t-main font-bold uppercase tracking-wider">Web Store</span>
                <span className="text-xs font-black ml-2">{kpiData.totalOrders}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: HOURLY ORDERS & TOP PRODUCTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
          <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border p-6 h-[400px] flex flex-col transition-colors duration-300">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Hourly Flow</h2>
                <p className="text-xs text-t-muted mt-1 font-medium">Order velocity throughout the day</p>
              </div>
              <select 
                value={hourlyFilter} 
                onChange={(e) => setHourlyFilter(e.target.value)} 
                className="border border-t-border text-xs text-t-main rounded-lg px-3 py-1.5 outline-none focus:border-t-primary bg-t-base cursor-pointer font-semibold"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
              </select>
            </div>
            <div className="flex-1 w-full">
              {hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500}} />
                    <Tooltip contentStyle={{fontSize: '12px', fontWeight: 'bold', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)'}} />
                    <Area type="monotone" dataKey="orders" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex justify-center items-center text-sm font-semibold text-t-muted bg-t-base rounded-xl border border-dashed border-t-border">Awaiting Hourly Tracker API...</div>
              )}
            </div>
          </div>

          <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border p-6 h-[400px] flex flex-col overflow-hidden transition-colors duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-t-border pb-4">
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Top Sellers</h2>
                <p className="text-xs text-t-muted mt-1 font-medium">Best performing products</p>
              </div>
              <select 
                value={topProductFilter} 
                onChange={(e) => setTopProductFilter(e.target.value)} 
                className="border border-t-border text-xs text-t-main rounded-lg px-3 py-1.5 outline-none focus:border-t-primary bg-t-base cursor-pointer font-semibold"
              >
                <option value="today">Today</option>
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto pr-3 space-y-5 custom-scrollbar">
              {topProductsData.length > 0 ? topProductsData.map((item, idx) => {
                const maxSales = Math.max(...topProductsData.map(p => p.sales));
                const widthPercent = (item.sales / maxSales) * 100;
                
                return (
                  <div key={idx} className="flex flex-col w-full group">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold truncate pr-4">{item.name}</span>
                      <span className="text-xs font-black text-t-primary">{item.sales} sold</span>
                    </div>
                    <div className="w-full relative h-2.5 bg-t-base rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-t-primary rounded-full transition-all duration-1000 ease-out group-hover:opacity-80" 
                        style={{ width: `${widthPercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="h-full flex flex-col justify-center items-center text-sm font-semibold text-t-muted bg-t-base rounded-xl border border-dashed border-t-border">
                  <svg className="w-8 h-8 opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  Awaiting Product Analytics
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ROW 4: Marketing Dashboard, Live Dashboard, Abandoned Carts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
          <a href="/admin/marketing-dashboard" className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col gap-3 group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="bg-t-primary/10 p-3 rounded-xl w-fit text-t-primary group-hover:bg-t-primary group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon strokeLinecap="round" strokeLinejoin="round" points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </div>
            <h3 className="text-base font-extrabold tracking-tight">Marketing Dashboard</h3>
            <p className="text-xs text-t-muted font-medium leading-relaxed">Campaign performance, ad spend, ROI tracking and conversion analytics.</p>
            <span className="text-xs font-bold text-t-primary mt-auto flex items-center gap-1 group-hover:gap-2 transition-all">
              Open Dashboard <span>→</span>
            </span>
          </a>

          <a href="/admin/live-dashboard" className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col gap-3 group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="bg-emerald-500/10 p-3 rounded-xl w-fit text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon strokeLinecap="round" strokeLinejoin="round" points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </div>
            <h3 className="text-base font-extrabold tracking-tight">Live Dashboard</h3>
            <p className="text-xs text-t-muted font-medium leading-relaxed">Real-time orders, live visitor count and instant performance metrics.</p>
            <span className="text-xs font-bold text-emerald-500 mt-auto flex items-center gap-1 group-hover:gap-2 transition-all">
              Go Live <span>→</span>
            </span>
          </a>

          <a href="/admin/crm" className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col gap-3 group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="bg-orange-500/10 p-3 rounded-xl w-fit text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.5-.832 2.5-2.333V6.667c0-1.5-.967-2.333-2.5-2.333H5.379c-1.54 0-2.5.832-2.5 2.333v8.667c0 1.5.967 2.333 2.5 2.333z"></path></svg>
            </div>
            <h3 className="text-base font-extrabold tracking-tight">Abandoned Carts</h3>
            <p className="text-xs text-t-muted font-medium leading-relaxed">Recover lost sales, view abandoned checkouts and send recovery emails.</p>
            <span className="text-xs font-bold text-orange-500 mt-auto flex items-center gap-1 group-hover:gap-2 transition-all">
              View Carts <span>→</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;