import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, RefreshCw, AlertTriangle, Package, Layers, Search } from 'lucide-react';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';
import { getToken } from '../utils/auth';

const InventoryDashboard = () => {
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
  const [warehouse, setWarehouse] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analytics/inventory`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { setError(`Server returned ${res.status}`); setLoading(false); return; }
      const result = await res.json();
      if (result.success) setData(result.data);
      else setError(result.message || 'Failed to load data');
    } catch (err) {
      setError('Cannot connect to server. Is the backend running?');
      console.error('Failed to load inventory dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const health = data?.stockHealth || {};
  const movement = data?.movement || {};
  const attention = data?.attention || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full bg-t-base min-h-screen text-t-main space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Inventory Dashboard</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Monitor stock health and movements across your inventory</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 text-xs font-bold text-white bg-t-primary hover:opacity-90 transition-colors px-4 py-2 rounded-lg">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-sm font-bold tracking-widest uppercase text-t-primary animate-pulse">Loading inventory...</div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mt-4 text-center">
          <p className="text-sm font-bold text-red-500">{error}</p>
          <button onClick={fetchData} className="mt-3 text-xs font-bold text-white bg-t-primary px-4 py-2 rounded-lg hover:opacity-90 transition-colors">Retry</button>
        </div>
      ) : (
        <>
          {/* Stock Reconciliation */}
          <div className="bg-t-surface border border-t-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={18} className="text-t-primary" />
              <h2 className="text-sm font-extrabold">Stock Reconciliation</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Products', value: health.totalProducts, color: 'text-t-main' },
                { label: 'Healthy Stock', value: health.healthyStock, color: 'text-emerald-500' },
                { label: 'Low Stock', value: health.lowStock, color: 'text-amber-500' },
                { label: 'Out of Stock', value: health.outOfStock, color: 'text-red-500' },
              ].map(s => (
                <div key={s.label} className="bg-t-base border border-t-border rounded-lg p-4 text-center">
                  <p className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-t-muted font-bold mt-1 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Warehouse Lookup + Stock Health Overview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Warehouse Lookup */}
              <div className="bg-t-surface border border-t-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Search size={16} className="text-t-muted" />
                  <h2 className="text-sm font-extrabold">Warehouse Lookup</h2>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={warehouse}
                    onChange={e => setWarehouse(e.target.value)}
                    className="bg-t-base border border-t-border rounded-lg px-3 py-2 text-xs outline-none text-t-main w-full max-w-xs"
                  >
                    <option value="all">All Warehouses</option>
                    <option value="main">Main Warehouse</option>
                  </select>
                  <span className="text-[11px] text-t-muted font-mono">{health.totalProducts} products</span>
                </div>
              </div>

              {/* Stock Health Overview */}
              <div className="bg-t-surface border border-t-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-t-primary" />
                    <h2 className="text-sm font-extrabold">Stock Health Overview</h2>
                  </div>
                  <span className="text-[11px] text-t-muted">{health.totalProducts} Total</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Total Products', value: health.totalProducts, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                    { label: 'Healthy Stock', value: health.healthyStock, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                    { label: 'Low Stock', value: health.lowStock, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                    { label: 'Out of Stock', value: health.outOfStock, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                    { label: 'Negative Stock', value: health.negativeStock, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-3 text-center`}>
                      <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-t-muted font-bold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock Movement Summary */}
            <div className="bg-t-surface border border-t-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-extrabold">Stock Movement</h2>
                <span className="text-[10px] text-t-muted font-bold uppercase tracking-wider">Last 7 days</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-t-base border border-t-border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={16} className="text-red-500" />
                    <span className="text-xs font-bold text-t-muted">Units Sold</span>
                  </div>
                  <span className="text-sm font-black text-red-500">-{movement.unitsSold}</span>
                </div>
                <div className="flex items-center justify-between bg-t-base border border-t-border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold text-t-muted">Units Purchased</span>
                  </div>
                  <span className="text-sm font-black text-emerald-500">+{movement.unitsPurchased}</span>
                </div>
                <div className="flex items-center justify-between bg-t-base border border-t-border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={16} className="text-blue-500" />
                    <span className="text-xs font-bold text-t-muted">Returns</span>
                  </div>
                  <span className="text-sm font-black text-blue-500">+{movement.returns}</span>
                </div>
                <div className="border-t border-t-border pt-4">
                  <div className="flex items-center justify-between bg-t-base border border-t-border rounded-lg p-3">
                    <span className="text-xs font-bold text-t-muted">Net Change</span>
                    <span className={`text-sm font-black ${movement.netChange < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {movement.netChange}
                    </span>
                  </div>
                  <p className="text-[10px] text-t-muted text-center mt-2">{movement.totalMovements} total movements</p>
                </div>
              </div>
            </div>
          </div>

          {/* Attention Required */}
          <div className="bg-t-surface border border-t-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="text-sm font-extrabold">Attention Required</h2>
            </div>
            {attention.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-5 text-center">
                <p className="text-sm font-bold text-emerald-500">All products are in good standing. No issues found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-t-border text-t-muted text-[11px] uppercase tracking-wider">
                      <th className="p-3 font-bold">Product</th>
                      <th className="p-3 font-bold">SKU</th>
                      <th className="p-3 font-bold">Stock</th>
                      <th className="p-3 font-bold">Status</th>
                      <th className="p-3 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.map(p => (
                      <tr key={p.id} className="border-b border-t-border/50 hover:bg-t-base/30 transition-colors">
                        <td className="p-3 font-bold text-t-main text-xs">{p.name}</td>
                        <td className="p-3 text-[10px] text-t-muted font-mono">{p.sku}</td>
                        <td className="p-3">
                          <span className={`font-bold ${p.stock === 0 ? 'text-red-500' : 'text-orange-500'}`}>{p.stock}</span>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded ${p.stock === 0 ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                            {p.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </td>
                        <td className="p-3">
                          <Link to={`/products/${p.id}`} className="text-[10px] font-bold text-t-primary hover:underline">View Product</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InventoryDashboard;