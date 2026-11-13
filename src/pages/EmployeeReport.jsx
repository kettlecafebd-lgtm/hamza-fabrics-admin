import React, { useState, useEffect, useContext } from 'react';
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';
import { ThemeContext } from '../context/ThemeContext';

export default function EmployeeReport() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [showMoney, setShowMoney] = useState(true);
  const [dateFilter, setDateFilter] = useState('30D');
  const [activeTab, setActiveTab] = useState('Employee Report');
  
  const [employees, setEmployees] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workLogPage, setWorkLogPage] = useState(1);

  const [empForm, setEmpForm] = useState({
    name: '', email: '', password: '', role: 'employee'
  });

  const handleInputChange = (e) => {
    setEmpForm({ ...empForm, [e.target.name]: e.target.value });
  };

  const fetchEmployees = async () => {
    try {
      const [empRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/auth/employees?limit=100`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        }),
        fetch(`${API_BASE_URL}/api/analytics?filter=${dateFilter === 'Today' ? 'today' : '30days'}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        })
      ]);
      const empResult = await empRes.json();
      const analyticsResult = await analyticsRes.json();
      if (empResult.success) {
        const orders = analyticsResult.success ? analyticsResult.data.recentOrders || [] : [];
        setRecentOrders(orders);
        const delivered = orders.filter(o => o.status === 'delivered');
        const shipped = orders.filter(o => o.status === 'shipped');
        const pending = orders.filter(o => o.status === 'pending');
        const totalRevenue = delivered.reduce((s, o) => s + Number(o.total_amount || 0), 0) + shipped.reduce((s, o) => s + Number(o.total_amount || 0), 0);
        const totalCost = delivered.reduce((s, o) => s + Number(o.total_cost_price || 0) + Number(o.delivery_charge || 0), 0) + shipped.reduce((s, o) => s + Number(o.total_cost_price || 0) + Number(o.delivery_charge || 0), 0);
        const formatted = empResult.data.map((emp, i) => ({
          ...emp,
          total: orders.length,
          money: totalRevenue,
          pending: pending.length,
          pendingMoney: pending.reduce((s, o) => s + Number(o.total_amount || 0), 0),
          rts: 0,
          rtsMoney: 0,
          delivered: delivered.length,
          deliveredMoney: delivered.reduce((s, o) => s + Number(o.total_amount || 0), 0),
          profit: totalRevenue - totalCost
        }));
        setEmployees(formatted);
      }
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [dateFilter]);

  // 🔴 ২. রিয়েল এমপ্লয়ী অ্যাড করা
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/add-employee`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(empForm),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Employee Added Successfully!');
        fetchEmployees(); // নতুন অ্যাড হওয়ার পর লিস্ট অটো রিফ্রেশ হবে
        setEmpForm({ name: '', email: '', password: '', role: 'employee' });
        setShowAddModal(false);
      } else {
        toast.error(`Failed: ${result.message}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Server connection failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔴 ৩. এমপ্লয়ী ডিলিট করা
  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/employee/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const result = await response.json();
      
      if (result.success) {
        // ডিলিট সফল হলে ফ্রন্টএন্ডের লিস্ট থেকে তা সরিয়ে দেওয়া
        setEmployees(employees.filter(emp => emp.id !== id));
      } else {
        toast(result.message);
      }
    } catch (err) {
      toast.error('Failed to delete employee.');
    }
  };

  const totalRow = employees.reduce((acc, curr) => {
    acc.total += curr.total; acc.money += curr.money;
    acc.pending += curr.pending; acc.pendingMoney += curr.pendingMoney;
    return acc;
  }, { total: 0, money: 0, pending: 0, pendingMoney: 0, rts: 0, rtsMoney: 0, shipped: 0, shippedMoney: 0, delivered: 0, deliveredMoney: 0 });

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">
      
      {/* Top Navigation Tabs */}
      <div className="flex border-b border-t-border mb-8 gap-8 text-sm font-bold overflow-x-auto hide-scrollbar">
        {['Employee Report', 'Combined Employee Report', 'Work Log', 'Order Completions'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === tab ? 'border-t-primary text-t-primary' : 'border-transparent text-t-muted hover:text-t-main'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-t-surface rounded-3xl shadow-sm border border-t-border overflow-hidden transition-colors duration-300">
        
        {/* Header & Controls */}
        <div className="p-6 sm:p-8 border-b border-t-border flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-t-base/30">
          <h2 className="text-2xl font-black tracking-tight">{activeTab}</h2>
          
          <div className="flex flex-wrap items-center gap-5">
            {activeTab === 'Employee Report' && (
              <button onClick={() => setShowAddModal(true)} className="bg-t-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-t-primary/30 transition-transform transform hover:-translate-y-0.5">
                + Add Employee
              </button>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Status</span>
              <select className="border border-t-border bg-t-surface text-t-main rounded-xl px-4 py-2 text-sm outline-none focus:border-t-primary font-semibold">
                <option>Default</option><option>Active</option><option>Inactive</option>
              </select>
            </div>

            <div className="flex items-center gap-3 bg-t-base px-4 py-2 rounded-xl border border-t-border">
              <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Money</span>
              <button onClick={() => setShowMoney(!showMoney)} className={`w-10 h-5 rounded-full relative transition-colors shadow-inner ${showMoney ? 'bg-t-primary' : 'bg-t-muted/50'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${showMoney ? 'translate-x-5' : ''}`}></span>
              </button>
            </div>

            <div className="flex border border-t-border rounded-xl overflow-hidden text-xs font-bold shadow-sm">
              <button onClick={() => setDateFilter('Today')} className={`px-5 py-2 transition-colors ${dateFilter === 'Today' ? 'bg-t-primary/10 text-t-primary' : 'bg-t-surface text-t-muted hover:bg-t-base'}`}>Today</button>
              <div className="w-px bg-t-border"></div>
              <button onClick={() => setDateFilter('30D')} className={`px-5 py-2 transition-colors ${dateFilter === '30D' ? 'bg-t-primary/10 text-t-primary' : 'bg-t-surface text-t-muted hover:bg-t-base'}`}>30D</button>
            </div>
          </div>
        </div>

        {activeTab === 'Employee Report' && (
          <>
            <div className="p-5 border-b border-t-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-t-surface">
              <div className="relative w-full sm:w-72">
                <span className="absolute left-3 top-2.5 text-t-muted">🔍</span>
                <input type="text" placeholder="Search all columns..." className="w-full pl-10 pr-4 py-2 border border-t-border bg-t-base text-t-main rounded-xl text-sm outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all" />
              </div>
              <div className="flex gap-3">
                <button className="border border-t-border bg-t-base text-t-main px-4 py-2 rounded-xl text-sm font-bold hover:opacity-80 transition-opacity flex items-center gap-2">👁️ View</button>
                <button className="border border-t-border bg-t-base text-t-main px-4 py-2 rounded-xl text-sm font-bold hover:opacity-80 transition-opacity flex items-center gap-2">⬇️ Download</button>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-t-base/50 text-[10px] font-black text-t-muted uppercase tracking-widest border-b border-t-border">
                    <th className="p-5 cursor-pointer hover:bg-t-base transition-colors w-72">Employee ↕</th>
                    <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-center">Total ↕</th>
                    {showMoney && <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-right">Total Money ↕</th>}
                    <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-center">Pending ↕</th>
                    {showMoney && <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-right">Pending Amt ↕</th>}
                    <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-center">RTS ↕</th>
                    {showMoney && <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-right">RTS Amt ↕</th>}
                    <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-center">Delivered ↕</th>
                    {showMoney && <th className="p-5 cursor-pointer hover:bg-t-base transition-colors text-right pr-6">Delivered Amt ↕</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-t-border text-sm">
                  {employees.length === 0 ? (
                    <tr><td colSpan="9" className="p-16 text-center text-t-muted font-bold uppercase tracking-widest text-xs">No employees added yet.</td></tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-t-base/50 transition-colors group">
                        <td className="p-5 flex justify-between items-center">
                          <div>
                            <div className="font-extrabold text-t-main flex items-center gap-2">
                              {emp.name}
                              {/* এমপ্লয়ী নাকি সুপার অ্যাডমিন তা দেখানোর ট্যাগ */}
                              <span className={`text-[8px] uppercase px-2 py-0.5 rounded-md font-black tracking-widest ${emp.role === 'super_admin' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' : 'bg-t-primary/10 text-t-primary border border-t-primary/20'}`}>
                                {emp.role.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="text-[10px] text-t-muted font-mono mt-1 border border-t-border bg-t-base rounded px-2 py-0.5 inline-block">{emp.email}</div>
                          </div>
                          
                          {/* 🔴 ডিলিট বাটন */}
                          <button 
                            onClick={() => handleDeleteEmployee(emp.id)} 
                            className="text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-xs"
                            title="Delete Employee"
                          >
                            🗑️
                          </button>
                        </td>
                        <td className="p-5 text-center">
                          <span className={`font-black px-3 py-1 rounded-lg text-xs ${emp.total > 0 ? 'bg-t-primary/10 text-t-primary' : 'text-t-muted bg-t-base'}`}>{emp.total}</span>
                        </td>
                        {showMoney && <td className="p-5 font-black text-t-primary text-right">৳ {emp.money.toLocaleString('en-IN')}</td>}
                        
                        <td className="p-5 text-center">
                          <div className="font-bold text-t-main">{emp.pending}</div>
                          <div className="text-[10px] text-t-muted mt-0.5 font-semibold">({emp.total > 0 ? ((emp.pending/emp.total)*100).toFixed(1) : '0.0'}%)</div>
                        </td>
                        {showMoney && <td className="p-5 font-bold text-t-muted text-right">৳ {emp.pendingMoney.toLocaleString('en-IN')}</td>}
                        
                        <td className="p-5 text-center">
                          <div className="font-bold text-t-main">{emp.rts}</div>
                          <div className="text-[10px] text-t-muted mt-0.5 font-semibold">(0.0%)</div>
                        </td>
                        {showMoney && <td className="p-5 font-bold text-t-muted text-right">৳ {emp.rtsMoney}</td>}

                        <td className="p-5 text-center">
                          <div className="font-black text-green-500">{emp.delivered}</div>
                          <div className="text-[10px] text-t-muted mt-0.5 font-semibold">(0.0%)</div>
                        </td>
                        {showMoney && <td className="p-5 font-black text-green-500 text-right pr-6">৳ {emp.deliveredMoney}</td>}
                      </tr>
                    ))
                  )}

                  <tr className="bg-t-base/80 border-t-2 border-t-border">
                    <td className="p-5 font-black text-t-main uppercase tracking-widest text-xs">Total</td>
                    <td className="p-5 font-black text-t-main text-center">{totalRow.total}</td>
                    {showMoney && <td className="p-5 font-black text-t-primary text-right">৳ {totalRow.money.toLocaleString('en-IN')}</td>}
                    <td className="p-5 font-black text-t-main text-center">{totalRow.pending}</td>
                    {showMoney && <td className="p-5 font-black text-t-main text-right">৳ {totalRow.pendingMoney.toLocaleString('en-IN')}</td>}
                    <td className="p-5 font-black text-t-main text-center">0</td>
                    {showMoney && <td className="p-5 font-black text-t-main text-right">৳ 0</td>}
                    <td className="p-5 font-black text-t-main text-center">0</td>
                    {showMoney && <td className="p-5 font-black text-t-main text-right pr-6">৳ 0</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'Combined Employee Report' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-t-base/50 text-[10px] font-black text-t-muted uppercase tracking-widest border-b border-t-border">
                  <th className="p-5">Employee</th>
                  <th className="p-5 text-center">Total Orders</th>
                  <th className="p-5 text-right">Revenue</th>
                  <th className="p-5 text-right">Cost</th>
                  <th className="p-5 text-right">Profit</th>
                  <th className="p-5 text-center">Delivered</th>
                  <th className="p-5 text-center">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-t-border text-sm">
                {employees.map(emp => {
                  const cost = emp.deliveredMoney > 0 ? (emp.deliveredMoney * 0.6) : 0;
                  const profit = emp.deliveredMoney - cost;
                  return (
                    <tr key={emp.id} className="hover:bg-t-base/50 transition-colors">
                      <td className="p-5">
                        <div className="font-extrabold text-t-main">{emp.name}</div>
                        <div className="text-[10px] text-t-muted">{emp.email}</div>
                      </td>
                      <td className="p-5 text-center font-black text-t-main">{emp.total}</td>
                      <td className="p-5 text-right font-black text-t-primary">৳{emp.money.toLocaleString('en-IN')}</td>
                      <td className="p-5 text-right font-bold text-red-500">-৳{cost.toLocaleString('en-IN')}</td>
                      <td className="p-5 text-right"><span className={`font-black ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>৳{profit.toLocaleString('en-IN')}</span></td>
                      <td className="p-5 text-center"><span className="font-black text-green-500 bg-green-100 px-3 py-1 rounded-lg text-xs">{emp.delivered}</span></td>
                      <td className="p-5 text-center"><span className="font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-lg text-xs">{emp.pending}</span></td>
                    </tr>
                  );
                })}
                {employees.length === 0 && (
                  <tr><td colSpan="7" className="p-16 text-center text-t-muted font-bold uppercase tracking-widest text-xs">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Work Log' && (
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold text-t-muted mb-6 uppercase tracking-widest">Recent order activity log</p>
            {recentOrders.length === 0 ? (
              <div className="p-12 text-center text-t-muted font-bold text-xs uppercase tracking-widest border border-dashed border-t-border rounded-2xl bg-t-base">
                No activity in this period.
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.slice(0, workLogPage * 15).map(o => (
                  <div key={o.id} className="flex items-center gap-4 bg-t-base border border-t-border rounded-xl p-4 hover:bg-t-surface transition-colors">
                    <div className="w-9 h-9 rounded-full bg-t-primary/10 text-t-primary flex items-center justify-center text-xs font-black shrink-0">
                      {o.status === 'delivered' ? '✓' : o.status === 'shipped' ? '📦' : o.status === 'pending' ? '⏳' : '↩'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-t-main truncate">Order #{o.order_code}</div>
                      <div className="text-[10px] text-t-muted mt-0.5">
                        <span className={`font-bold uppercase ${o.status === 'delivered' ? 'text-green-600' : o.status === 'shipped' ? 'text-blue-600' : o.status === 'pending' ? 'text-amber-600' : 'text-red-500'}`}>{o.status}</span>
                        <span className="mx-2">·</span>
                        {o.customer_name}
                        <span className="mx-2">·</span>
                        ৳{Number(o.total_amount).toLocaleString('en-IN')}
                        <span className="mx-2">·</span>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                {recentOrders.length > workLogPage * 15 && (
                  <button onClick={() => setWorkLogPage(p => p + 1)} className="w-full py-3 text-xs font-bold text-t-primary hover:underline">
                    Load More
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Order Completions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-t-base/50 text-[10px] font-black text-t-muted uppercase tracking-widest border-b border-t-border">
                  <th className="p-5">Order</th>
                  <th className="p-5">Customer</th>
                  <th className="p-5 text-right">Amount</th>
                  <th className="p-5 text-right">Profit</th>
                  <th className="p-5">Status</th>
                  <th className="p-5">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-t-border text-sm">
                {recentOrders.filter(o => o.status === 'delivered' || o.status === 'shipped').map(o => {
                  const cost = Number(o.total_cost_price || 0) + Number(o.delivery_charge || 0);
                  const profit = Number(o.total_amount || 0) - cost;
                  return (
                    <tr key={o.id} className="hover:bg-t-base/50 transition-colors">
                      <td className="p-5 font-bold text-t-main">#{o.order_code}</td>
                      <td className="p-5 text-t-muted">{o.customer_name}</td>
                      <td className="p-5 text-right font-black text-t-primary">৳{Number(o.total_amount).toLocaleString('en-IN')}</td>
                      <td className="p-5 text-right"><span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>৳{profit.toLocaleString('en-IN')}</span></td>
                      <td className="p-5"><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${o.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span></td>
                      <td className="p-5 text-t-muted text-xs">{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  );
                })}
                {recentOrders.filter(o => o.status === 'delivered' || o.status === 'shipped').length === 0 && (
                  <tr><td colSpan="6" className="p-16 text-center text-t-muted font-bold uppercase tracking-widest text-xs">No completed orders in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleAddEmployee} className="bg-t-surface rounded-3xl p-8 w-full max-w-md shadow-2xl border border-t-border">
            <h3 className="font-black text-xl mb-6 text-t-main tracking-tight">Register New Employee</h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-2">Employee Name</label>
                <input type="text" name="name" required value={empForm.name} onChange={handleInputChange} placeholder="e.g. Rakib Hasan" className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary font-semibold transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-2">Login Email</label>
                <input type="email" name="email" required value={empForm.email} onChange={handleInputChange} placeholder="rakib@hamzafabrics.com" className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary font-semibold transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-2">Password</label>
                <input type="password" name="password" required value={empForm.password} onChange={handleInputChange} placeholder="Enter secure password" className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary font-semibold transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-2">Access Role</label>
                <select name="role" value={empForm.role} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary font-semibold transition-all cursor-pointer">
                  <option value="employee">Employee (Limited Access)</option>
                  <option value="super_admin">Super Admin (Full Access)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-4 border-t border-t-border pt-6">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 border border-t-border bg-t-base text-t-main rounded-xl font-bold hover:opacity-80 transition-colors text-sm">Cancel</button>
              <button type="submit" disabled={isSubmitting} className={`px-6 py-3 bg-t-primary text-white rounded-xl font-bold shadow-lg shadow-t-primary/30 text-sm transition-all transform ${isSubmitting ? 'opacity-70' : 'hover:opacity-90 hover:-translate-y-0.5'}`}>
                {isSubmitting ? 'Saving...' : 'Register Employee'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}