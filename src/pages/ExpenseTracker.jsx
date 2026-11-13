import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';
import { getToken } from '../utils/auth';

const EXPENSE_TYPES = [
  { value: 'Fixed', label: 'Fixed (Rent, Salary)' },
  { value: 'Variable', label: 'Variable (Packaging, Ads)' },
  { value: 'Logistics', label: 'Logistics (Courier, Return)' },
];

const ExpenseTracker = () => {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    expense_type: 'Fixed',
    category: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    added_by: 'Admin',
    remarks: ''
  });

  const fetchExpensesData = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${getToken()}` };
      const [listRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/expenses/list?limit=200&offset=0`, { headers }),
        fetch(`${API_BASE_URL}/api/expenses/summary`, { headers })
      ]);
      const listData = await listRes.json();
      if (listData.success) setExpenses(listData.data);
      const summaryData = await summaryRes.json();
      if (summaryData.success) setSummary(summaryData);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpensesData(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/expenses/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Expense added successfully!');
        setFormData({ ...formData, category: '', amount: '', remarks: '' });
        fetchExpensesData();
      } else {
        toast.error('Failed to add expense');
      }
    } catch (error) {
      toast.error('Server error');
    }
  };

  return (
    <div className={`p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen text-t-main transition-colors duration-300 ${adminTheme}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-t-border pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Expense Tracker</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Track and manage operational costs.</p>
        </div>
        <button onClick={fetchExpensesData}
          className="bg-t-surface border border-t-border px-5 py-2.5 rounded-xl text-xs font-bold text-t-muted hover:text-t-main hover:bg-t-base transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-bold text-t-muted uppercase tracking-widest">Current Month Total</span>
            <div className="text-4xl font-black text-t-main mt-3 tracking-tight">৳ {Number(summary.grand_total || 0).toLocaleString('en-IN')}</div>
          </div>
          {(summary.summary || []).slice(0, 2).map((item, i) => (
            <div key={i} className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm">
              <span className="text-xs font-bold text-t-muted uppercase tracking-widest">{item.category}</span>
              <div className="text-2xl font-black text-t-primary mt-3">৳ {Number(item.total_amount).toLocaleString('en-IN')}</div>
            </div>
          ))}
          {(!summary.summary || summary.summary.length === 0) && (
            <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm">
              <span className="text-xs font-bold text-t-muted uppercase tracking-widest">No category breakdown</span>
              <div className="text-sm text-t-muted mt-3">Add expenses to see breakdown.</div>
            </div>
          )}
        </div>
      )}

      {/* Breakdown (if more than 2 categories) */}
      {summary && summary.summary && summary.summary.length > 2 && (
        <div className="bg-t-surface border border-t-border rounded-2xl p-6 shadow-sm mb-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-t-muted mb-4">Full Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {summary.summary.map((item, i) => (
              <div key={i} className="bg-t-base border border-t-border rounded-xl p-4">
                <div className="text-xs font-bold text-t-muted">{item.category}</div>
                <div className="text-lg font-black text-t-main mt-1">৳ {Number(item.total_amount).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Form + List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Add Expense Form */}
        <div className="bg-t-surface rounded-2xl border border-t-border p-6 sm:p-8 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-t-main mb-6">Add New Expense</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Expense Type</label>
              <select name="expense_type" value={formData.expense_type} onChange={handleInputChange} required
                className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main outline-none focus:border-t-primary transition-colors">
                {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Category</label>
              <input type="text" name="category" value={formData.category} onChange={handleInputChange} placeholder="e.g. Facebook Ads, Utility" required
                className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main placeholder:text-t-muted/60 outline-none focus:border-t-primary transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Amount (৳)</label>
              <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="Enter amount" required
                className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main placeholder:text-t-muted/60 outline-none focus:border-t-primary transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Date</label>
              <input type="date" name="expense_date" value={formData.expense_date} onChange={handleInputChange} required
                className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main outline-none focus:border-t-primary transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Remarks</label>
              <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} placeholder="Optional notes" rows={3}
                className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main placeholder:text-t-muted/60 outline-none focus:border-t-primary transition-colors resize-none" />
            </div>
            <button type="submit"
              className="w-full bg-t-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all">
              Save Expense
            </button>
          </form>
        </div>

        {/* Recent Expenses List */}
        <div className="bg-t-surface rounded-2xl border border-t-border shadow-sm">
          <div className="p-6 sm:p-8 pb-0">
            <h3 className="text-sm font-black uppercase tracking-widest text-t-main">Recent Expenses</h3>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="w-8 h-8 border-4 border-t-surface border-t-t-primary rounded-full animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center text-t-muted font-bold text-xs uppercase tracking-widest border border-dashed border-t-border rounded-2xl bg-t-base m-6">
              No expenses found.
            </div>
          ) : (
            <div className="overflow-x-auto p-6 sm:p-8">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-t-border text-xs uppercase tracking-widest text-t-muted">
                    <th className="pb-3 pr-4 font-bold">Date</th>
                    <th className="pb-3 pr-4 font-bold">Type</th>
                    <th className="pb-3 pr-4 font-bold">Category</th>
                    <th className="pb-3 pr-4 font-bold text-right">Amount</th>
                    <th className="pb-3 font-bold">Added By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-t-border">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-t-base/50 transition-colors">
                      <td className="py-3.5 pr-4 text-t-muted text-xs whitespace-nowrap">{new Date(exp.expense_date).toLocaleDateString('en-IN')}</td>
                      <td className="py-3.5 pr-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                          exp.expense_type === 'Fixed' ? 'bg-blue-100 text-blue-700' :
                          exp.expense_type === 'Variable' ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{exp.expense_type}</span>
                      </td>
                      <td className="py-3.5 pr-4 font-semibold text-t-main">{exp.category}</td>
                      <td className="py-3.5 pr-4 text-right font-black text-t-main">৳ {Number(exp.amount).toLocaleString('en-IN')}</td>
                      <td className="py-3.5 text-t-muted text-xs">{exp.added_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;
