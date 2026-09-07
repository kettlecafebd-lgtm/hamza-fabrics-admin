import React, { useState, useEffect, useContext } from 'react';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';
import { getToken } from '../utils/auth';

export default function ProfitAndSales() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); 
  const [dateFilter, setDateFilter] = useState('30days');
  const [activeTab, setActiveTab] = useState('Summary');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics?filter=${dateFilter}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const textResponse = await response.text(); 
      try {
        const result = JSON.parse(textResponse);
        if (result.success) setAnalyticsData(result.data);
        else setError(`API Error: ${result.message}`);
      } catch (e) {
        setError(`Server returned non-JSON data: ${textResponse.substring(0, 100)}...`);
      }
    } catch (err) {
      setError(`Network Error: ${err.message}. Check if Backend URL is correct and running.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateFilter]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-screen bg-t-base transition-colors duration-300">
      <div className="w-12 h-12 border-4 border-t-surface border-t-t-primary rounded-full animate-spin mb-4"></div>
      <div className="text-t-primary font-bold tracking-widest uppercase text-sm animate-pulse">Analyzing Financial Data...</div>
    </div>
  );
  
  if (error) return (
    <div className="flex justify-center items-center h-screen bg-t-base transition-colors duration-300">
      <div className="bg-red-500/10 backdrop-blur-md p-8 text-center text-red-500 font-bold rounded-2xl border border-red-500/20 shadow-2xl max-w-md">
        <span className="text-4xl mb-4 block">⚠️</span>
        <p className="text-lg">{error}</p>
      </div>
    </div>
  );
  
  if (!analyticsData) return <div className="p-12 text-center text-t-muted font-bold uppercase tracking-widest bg-t-base min-h-screen">No Data Available.</div>;

  const { profit, overall, orderStatus } = analyticsData;
  const totalRevenue = profit?.totalRevenue || 0;
  const productCost = profit?.totalCost || 0;
  const deliveryCost = 0;
  const netProfit = totalRevenue - productCost - deliveryCost;
  
  const profitPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
  const costPct = totalRevenue > 0 ? ((productCost / totalRevenue) * 100).toFixed(1) : 0;
  const deliveryPct = totalRevenue > 0 ? ((deliveryCost / totalRevenue) * 100).toFixed(1) : 0;

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-t-border pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">P&amp;L Analytics</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Comprehensive breakdown of sales, costs, and estimated profit.</p>
        </div>
        
        <div className="flex items-center gap-3 mt-4 md:mt-0 bg-t-surface p-1.5 rounded-xl shadow-sm border border-t-border">
          <button onClick={() => setDateFilter('today')} className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors ${dateFilter === 'today' ? 'bg-t-primary/10 text-t-primary' : 'text-t-muted hover:text-t-main'}`}>Today</button>
          <div className="w-px h-5 bg-t-border"></div>
          <button onClick={() => setDateFilter('7days')} className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors ${dateFilter === '7days' ? 'bg-t-primary/10 text-t-primary' : 'text-t-muted hover:text-t-main'}`}>7D</button>
          <div className="w-px h-5 bg-t-border"></div>
          <button onClick={() => setDateFilter('30days')} className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors ${dateFilter === '30days' ? 'bg-t-primary/10 text-t-primary' : 'text-t-muted hover:text-t-main'}`}>30D</button>
          <div className="w-px h-5 bg-t-border"></div>
          <button onClick={fetchAnalytics} className="p-2 rounded-lg text-t-muted hover:text-t-primary hover:bg-t-primary/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
      </div>

      <div className="bg-t-surface rounded-3xl shadow-sm border border-t-border overflow-hidden transition-colors duration-300">
        
        <div className="flex border-b border-t-border px-8 pt-6 gap-8 text-sm font-bold bg-t-base/30 overflow-x-auto hide-scrollbar">
          {['Summary', 'Sales', 'Expenses', 'Delivered Orders'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === tab ? 'border-t-primary text-t-primary' : 'border-transparent text-t-muted hover:text-t-main'}`}>
               {tab}
             </button>
          ))}
        </div>

        <div className="p-8 sm:p-10">
          {activeTab === 'Summary' && (
            <div className="animate-fade-in space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Total Sales</span>
                    <div className="bg-t-primary/10 p-2 rounded-lg text-t-primary group-hover:bg-t-primary group-hover:text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-black tracking-tight">৳ {totalRevenue.toLocaleString('en-IN')}</div>
                    <p className="text-xs text-t-primary font-semibold mt-1 flex items-center gap-1">↑ {overall.total_orders} Orders</p>
                  </div>
                </div>

                <div className="bg-t-accent p-6 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Estimated Profit</span>
                    <div className="bg-white/20 p-2 rounded-lg text-white backdrop-blur-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                    </div>
                  </div>
                  <div className="relative z-10">
                    <div className="text-4xl font-black text-white tracking-tight">৳ {netProfit.toLocaleString('en-IN')}</div>
                    <p className="text-xs text-white/80 font-semibold mt-1">~ {profitPct}% Profit Margin</p>
                  </div>
                </div>

                <div className="bg-t-surface p-6 rounded-2xl shadow-sm border border-t-border flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Order Statistics</span>
                    <span className="text-xs font-black text-t-main bg-t-base border border-t-border px-2 py-1 rounded-lg">{overall.total_orders} Total</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-center">
                    <div className="flex-1 bg-t-base py-2.5 rounded-lg border border-t-border">
                      <div className="text-xl text-t-main font-black">{overall.total_orders - orderStatus.pendingOrders - orderStatus.returnedOrders}</div>
                      <div className="text-t-muted mt-0.5 text-[10px] uppercase tracking-widest">Delivered</div>
                    </div>
                    <div className="flex-1 bg-orange-500/10 border border-orange-500/20 py-2.5 rounded-lg">
                      <div className="text-xl text-orange-500 font-black">{orderStatus.pendingOrders}</div>
                      <div className="text-orange-500/70 mt-0.5 text-[10px] uppercase tracking-widest">Pending</div>
                    </div>
                    <div className="flex-1 bg-red-500/10 border border-red-500/20 py-2.5 rounded-lg">
                      <div className="text-xl text-red-500 font-black">{orderStatus.returnedOrders}</div>
                      <div className="text-red-500/70 mt-0.5 text-[10px] uppercase tracking-widest">Returned</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-t-surface p-8 rounded-2xl border border-t-border shadow-sm">
                <h3 className="text-base font-extrabold text-t-main mb-6 tracking-tight">Revenue Allocation</h3>
                <div className="h-6 w-full flex rounded-full overflow-hidden shadow-inner mb-6 bg-t-base border border-t-border">
                  <div style={{ width: `${profitPct}%` }} className="bg-t-primary transition-all duration-1000 relative group cursor-pointer">
                     <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">{profitPct}%</span>
                  </div>
                  <div style={{ width: `${costPct}%` }} className="bg-t-accent transition-all duration-1000 relative group cursor-pointer">
                     <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">{costPct}%</span>
                  </div>
                  <div style={{ width: `${deliveryPct}%` }} className="bg-yellow-500 transition-all duration-1000 relative group cursor-pointer">
                     <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">{deliveryPct}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-bold">
                  <div className="flex justify-between items-center bg-t-base border border-t-border p-4 rounded-xl shadow-sm hover:bg-t-primary/5 transition-colors">
                    <div className="flex items-center gap-2.5"><span className="w-3.5 h-3.5 rounded-full bg-t-primary shadow-sm"></span> <span className="text-t-muted">Profit</span></div>
                    <div className="text-t-main font-black tracking-tight">৳ {netProfit.toLocaleString('en-IN')} <span className="text-t-muted ml-1.5 font-semibold text-[10px] bg-t-surface px-1.5 py-0.5 rounded">{profitPct}%</span></div>
                  </div>
                  <div className="flex justify-between items-center bg-t-base border border-t-border p-4 rounded-xl shadow-sm hover:bg-t-primary/5 transition-colors">
                    <div className="flex items-center gap-2.5"><span className="w-3.5 h-3.5 rounded-full bg-t-accent shadow-sm"></span> <span className="text-t-muted">Prod. Cost</span></div>
                    <div className="text-t-main font-black tracking-tight">৳ {productCost.toLocaleString('en-IN')} <span className="text-t-muted ml-1.5 font-semibold text-[10px] bg-t-surface px-1.5 py-0.5 rounded">{costPct}%</span></div>
                  </div>
                  <div className="flex justify-between items-center bg-t-base border border-t-border p-4 rounded-xl shadow-sm hover:bg-t-primary/5 transition-colors">
                    <div className="flex items-center gap-2.5"><span className="w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-sm"></span> <span className="text-t-muted">Del. Cost</span></div>
                    <div className="text-t-main font-black tracking-tight">৳ {deliveryCost.toLocaleString('en-IN')} <span className="text-t-muted ml-1.5 font-semibold text-[10px] bg-t-surface px-1.5 py-0.5 rounded">{deliveryPct}%</span></div>
                  </div>
                  <div className="flex justify-between items-center bg-t-base border border-t-border p-4 rounded-xl shadow-sm hover:bg-t-primary/5 transition-colors opacity-50">
                    <div className="flex items-center gap-2.5"><span className="w-3.5 h-3.5 rounded-full bg-pink-500 shadow-sm"></span> <span className="text-t-muted">Ads Exp.</span></div>
                    <div className="text-t-main font-black tracking-tight">৳ 0 <span className="text-t-muted ml-1.5 font-semibold text-[10px] bg-t-surface px-1.5 py-0.5 rounded">0.0%</span></div>
                  </div>
                </div>
              </div>

              <div className="border border-t-border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-t-base/80 border-b border-t-border text-xs uppercase tracking-widest">
                    <tr>
                      <th className="p-4 font-bold text-t-muted">Description</th>
                      <th className="p-4 font-bold text-t-muted text-right">Amount</th>
                      <th className="p-4 font-bold text-t-muted text-center">Count</th>
                      <th className="p-4 font-bold text-t-muted">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-t-border bg-t-surface">
                    <tr><td colSpan="4" className="p-4 bg-t-primary/10 text-t-primary font-black text-xs uppercase tracking-widest border-b border-t-primary/20">Revenue Source</td></tr>
                    <tr className="hover:bg-t-base/50 transition-colors">
                      <td className="p-4 font-bold text-t-main">Total Sales</td>
                      <td className="p-4 text-right font-black text-t-primary text-base tracking-tight">+ ৳ {totalRevenue.toLocaleString('en-IN')}</td>
                      <td className="p-4 text-center text-t-primary font-black bg-t-primary/5 rounded-lg m-2">{overall.total_orders}</td>
                      <td className="p-4 text-t-muted text-xs font-medium">Total revenue from delivered and shipped orders.</td>
                    </tr>
                    <tr className="hover:bg-t-base/50 transition-colors">
                      <td className="p-4 font-bold text-t-main">Return Charges</td>
                      <td className="p-4 text-right font-black text-t-muted">+ ৳ 0</td>
                      <td className="p-4 text-center text-t-muted font-bold">{orderStatus.returnedOrders}</td>
                      <td className="p-4 text-t-muted text-xs font-medium">Delivery charges recovered from returned orders.</td>
                    </tr>
                    <tr><td colSpan="4" className="p-4 bg-red-500/10 text-red-500 font-black text-xs uppercase tracking-widest mt-4 border-t border-red-500/20">Deductible Expenses</td></tr>
                    <tr className="hover:bg-t-base/50 transition-colors">
                      <td className="p-4 font-bold text-t-main">Product Cost</td>
                      <td className="p-4 text-right font-black text-red-500 text-base tracking-tight">- ৳ {productCost.toLocaleString('en-IN')}</td>
                      <td className="p-4 text-center text-red-500 font-black bg-red-500/5 rounded-lg m-2">{overall.total_orders}</td>
                      <td className="p-4 text-t-muted text-xs font-medium">Total procurement cost of sold products.</td>
                    </tr>
                    <tr className="hover:bg-t-base/50 transition-colors">
                      <td className="p-4 font-bold text-t-main">Delivery Cost</td>
                      <td className="p-4 text-right font-black text-red-500 text-base tracking-tight">- ৳ {deliveryCost.toLocaleString('en-IN')}</td>
                      <td className="p-4 text-center text-red-500 font-black bg-red-500/5 rounded-lg m-2">{overall.total_orders}</td>
                      <td className="p-4 text-t-muted text-xs font-medium">Operational delivery and courier expenses.</td>
                    </tr>
                    <tr className="bg-t-base/80 border-t-4 border-t-border">
                      <td className="p-5 font-black text-t-main uppercase tracking-widest text-xs">Total Estimated Profit</td>
                      <td className="p-5 text-right font-black text-t-primary text-xl tracking-tight">৳ {netProfit.toLocaleString('en-IN')}</td>
                      <td className="p-5"></td>
                      <td className="p-5 text-t-muted font-bold text-xs">Estimated based on selected timeframe (<span className="text-t-primary bg-t-primary/10 px-2 py-0.5 rounded">{profitPct}% margin</span>).</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Sales' && (
            <div className="animate-fade-in">
              <h3 className="text-lg font-extrabold text-t-main mb-6 uppercase tracking-widest">Sales Orders</h3>
              <div className="border border-t-border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-t-base/80 border-b border-t-border text-xs uppercase tracking-widest">
                    <tr>
                      <th className="p-4 font-bold text-t-muted">Order</th>
                      <th className="p-4 font-bold text-t-muted">Customer</th>
                      <th className="p-4 font-bold text-t-muted text-right">Subtotal</th>
                      <th className="p-4 font-bold text-t-muted text-right">Discount</th>
                      <th className="p-4 font-bold text-t-muted text-right">Delivery</th>
                      <th className="p-4 font-bold text-t-muted text-right">Total</th>
                      <th className="p-4 font-bold text-t-muted">Status</th>
                      <th className="p-4 font-bold text-t-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-t-border bg-t-surface">
                    {analyticsData.recentOrders?.filter(o => o.status === 'delivered' || o.status === 'shipped').map(order => (
                      <tr key={order.id} className="hover:bg-t-base/50 transition-colors">
                        <td className="p-4 font-bold text-t-main">#{order.order_code}</td>
                        <td className="p-4 text-t-muted">{order.customer_name}</td>
                        <td className="p-4 text-right font-semibold">৳{Number(order.subtotal || 0).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right text-red-500 font-semibold">-৳{Number(order.discount_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-semibold">+৳{Number(order.delivery_charge || 0).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-black text-t-primary">৳{Number(order.total_amount).toLocaleString('en-IN')}</td>
                        <td className="p-4"><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${order.status === 'delivered' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'}`}>{order.status}</span></td>
                        <td className="p-4 text-t-muted text-xs">{new Date(order.created_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                    {(!analyticsData.recentOrders || analyticsData.recentOrders.filter(o => o.status === 'delivered' || o.status === 'shipped').length === 0) && (
                      <tr><td colSpan="8" className="p-12 text-center text-t-muted font-semibold">No sales orders in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Expenses' && (
            <div className="animate-fade-in">
              <h3 className="text-lg font-extrabold text-t-main mb-6 uppercase tracking-widest">Order Expenses</h3>
              <div className="border border-t-border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-t-base/80 border-b border-t-border text-xs uppercase tracking-widest">
                    <tr>
                      <th className="p-4 font-bold text-t-muted">Order</th>
                      <th className="p-4 font-bold text-t-muted">Customer</th>
                      <th className="p-4 font-bold text-t-muted text-right">Product Cost</th>
                      <th className="p-4 font-bold text-t-muted text-right">Delivery Cost</th>
                      <th className="p-4 font-bold text-t-muted text-right">Total Cost</th>
                      <th className="p-4 font-bold text-t-muted text-right">Revenue</th>
                      <th className="p-4 font-bold text-t-muted text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-t-border bg-t-surface">
                    {analyticsData.recentOrders?.filter(o => o.status === 'delivered' || o.status === 'shipped').map(order => {
                      const cost = Number(order.total_cost_price || 0) + Number(order.delivery_charge || 0);
                      const revenue = Number(order.total_amount || 0);
                      const margin = revenue > 0 ? ((revenue - cost) / revenue * 100).toFixed(1) : 0;
                      return (
                        <tr key={order.id} className="hover:bg-t-base/50 transition-colors">
                          <td className="p-4 font-bold text-t-main">#{order.code || order.order_code}</td>
                          <td className="p-4 text-t-muted">{order.customer_name}</td>
                          <td className="p-4 text-right text-red-500 font-semibold">-৳{Number(order.total_cost_price || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right text-red-500 font-semibold">-৳{Number(order.delivery_charge || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-bold text-red-600">-৳{cost.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-bold text-t-primary">+৳{revenue.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right"><span className={`text-xs font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{margin}%</span></td>
                        </tr>
                      );
                    })}
                    {(!analyticsData.recentOrders || analyticsData.recentOrders.filter(o => o.status === 'delivered' || o.status === 'shipped').length === 0) && (
                      <tr><td colSpan="7" className="p-12 text-center text-t-muted font-semibold">No delivered orders in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Delivered Orders' && (
            <div className="animate-fade-in">
              <h3 className="text-lg font-extrabold text-t-main mb-6 uppercase tracking-widest">Delivered Orders</h3>
              <div className="border border-t-border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-t-base/80 border-b border-t-border text-xs uppercase tracking-widest">
                    <tr>
                      <th className="p-4 font-bold text-t-muted">Order</th>
                      <th className="p-4 font-bold text-t-muted">Customer</th>
                      <th className="p-4 font-bold text-t-muted">Phone</th>
                      <th className="p-4 font-bold text-t-muted text-right">Amount</th>
                      <th className="p-4 font-bold text-t-muted text-right">Profit</th>
                      <th className="p-4 font-bold text-t-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-t-border bg-t-surface">
                    {analyticsData.recentOrders?.filter(o => o.status === 'delivered').map(order => {
                      const cost = Number(order.total_cost_price || 0) + Number(order.delivery_charge || 0);
                      const profitVal = Number(order.total_amount || 0) - cost;
                      return (
                        <tr key={order.id} className="hover:bg-t-base/50 transition-colors">
                          <td className="p-4 font-bold text-t-main">#{order.order_code}</td>
                          <td className="p-4 text-t-muted">{order.customer_name}</td>
                          <td className="p-4 text-t-muted text-xs font-mono">{order.customer_phone || '-'}</td>
                          <td className="p-4 text-right font-black text-t-primary">৳{Number(order.total_amount).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right"><span className={`font-bold text-xs ${profitVal >= 0 ? 'text-green-600' : 'text-red-500'}`}>৳{profitVal.toLocaleString('en-IN')}</span></td>
                          <td className="p-4 text-t-muted text-xs">{new Date(order.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      );
                    })}
                    {(!analyticsData.recentOrders || analyticsData.recentOrders.filter(o => o.status === 'delivered').length === 0) && (
                      <tr><td colSpan="6" className="p-12 text-center text-t-muted font-semibold">No delivered orders in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}