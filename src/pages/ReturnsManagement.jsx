import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';
import { RotateCcw, Search, X, Eye, ChevronRight, Clock, Package, CheckCircle2, XCircle, DollarSign, Truck, ClipboardCheck, Plus, RefreshCw, AlertTriangle, ArrowLeft, History, PackageCheck } from 'lucide-react';

const statusLabels = { pending_pickup: 'Pending Pickup', pickup_scheduled: 'Pickup Scheduled', picked_up: 'Picked Up', inspected: 'Inspected', approved: 'Approved', rejected: 'Rejected', refunded: 'Refunded', closed: 'Closed', cancelled: 'Cancelled' };
const statusColors = { pending_pickup: 'text-yellow-500', pickup_scheduled: 'text-blue-500', picked_up: 'text-indigo-500', inspected: 'text-purple-500', approved: 'text-green-500', rejected: 'text-red-500', refunded: 'text-emerald-500', closed: 'text-gray-500', cancelled: 'text-gray-400' };
const statusBadgeColors = { pending_pickup: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', pickup_scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', picked_up: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', inspected: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', refunded: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400' };

export default function ReturnsManagement() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const badgeBg = isDark ? 'bg-gray-700' : 'bg-gray-100';

  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockLog, setRestockLog] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const pageSize = 20;

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({ limit: pageSize, offset: page * pageSize });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const [statsRes, listRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/rma/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/rma/return-requests?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const s = await statsRes.json();
      const l = await listRes.json();
      if (s.success) setStats(s.stats);
      if (l.success) { setRequests(l.requests); setTotal(l.total); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [statusFilter, search, page]);

  const handleStatusChange = async (id, newStatus, note) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/rma/return-requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, note: note || '' }),
      });
      const data = await res.json();
      if (data.success) { fetchRequests(); if (selectedRequest?.id === id) { const r = await fetch(`${API_BASE_URL}/api/rma/return-requests/${id}`, { headers: { Authorization: `Bearer ${token}` } }); const rd = await r.json(); if (rd.success) setSelectedRequest(rd.returnRequest); } }
    } catch (e) { console.error(e); }
    setActionLoading(false);
  };

  const handleInspection = async (formData) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/rma/return-requests/${selectedRequest.id}/inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) { setShowInspectionModal(false); fetchRequests(); const r = await fetch(`${API_BASE_URL}/api/rma/return-requests/${selectedRequest.id}`, { headers: { Authorization: `Bearer ${token}` } }); const rd = await r.json(); if (rd.success) setSelectedRequest(rd.returnRequest); }
    } catch (e) { console.error(e); }
    setActionLoading(false);
  };

  const handleRefund = async (formData) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/rma/return-requests/${selectedRequest.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) { setShowRefundModal(false); fetchRequests(); const r = await fetch(`${API_BASE_URL}/api/rma/return-requests/${selectedRequest.id}`, { headers: { Authorization: `Bearer ${token}` } }); const rd = await r.json(); if (rd.success) setSelectedRequest(rd.returnRequest); }
    } catch (e) { console.error(e); }
    setActionLoading(false);
  };

  const viewDetails = async (id) => {
    try {
      const token = localStorage.getItem('adminToken');
      const [detailRes, restockRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/rma/return-requests/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/rma/return-requests/${id}/restock-log`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const data = await detailRes.json();
      const rLog = await restockRes.json();
      if (data.success) setSelectedRequest(data.returnRequest);
      if (rLog.success) setRestockLog(rLog.log);
    } catch (e) { console.error(e); }
  };

  const handleRestock = async (formData) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/rma/return-requests/${selectedRequest.id}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setShowRestockModal(false);
        toast.success(`Restocked ${data.restocked} items (${data.totalQuantity} units)`);
        fetchRequests();
        viewDetails(selectedRequest.id);
      }
    } catch (e) { console.error(e); }
    setActionLoading(false);
  };

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-t-primary/10">
            <RotateCcw className="w-5 h-5 text-t-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider">Returns & Refunds</h1>
            <p className="text-xs text-t-muted">Full RMA lifecycle management — pickup, inspection, refund</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchRequests} className="p-2 rounded-lg hover:bg-t-primary/10 transition-colors text-t-muted hover:text-t-primary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-t-primary text-white rounded-lg hover:bg-t-primary/90 transition-all text-sm font-bold"><Plus className="w-4 h-4" /> New Return</button>
        </div>
      </div>

      {stats && <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: 'Total Requests', value: stats.total, icon: <RotateCcw className="w-4 h-4" />, color: 'text-blue-500' },
          { label: 'Pending Pickup', value: stats.pending_pickup, icon: <Clock className="w-4 h-4" />, color: 'text-yellow-500' },
          { label: 'Picked Up', value: stats.picked_up, icon: <Package className="w-4 h-4" />, color: 'text-indigo-500' },
          { label: 'Inspected', value: stats.inspected, icon: <ClipboardCheck className="w-4 h-4" />, color: 'text-purple-500' },
          { label: 'Approved', value: stats.approved, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-500' },
          { label: 'Refunded', value: stats.refunded, icon: <DollarSign className="w-4 h-4" />, color: 'text-emerald-500' },
          { label: 'Refunded Amount', value: `৳${Number(stats.total_refunded_amount).toLocaleString()}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className={`${bgCard} rounded-xl p-4 border ${borderColor} transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>{stat.label}</span>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className={`text-2xl font-black ${textColor}`}>{stat.value}</div>
          </div>
        ))}
      </div>}

      <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className="p-4 border-b border-t-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {['all', 'pending_pickup', 'pickup_scheduled', 'picked_up', 'inspected', 'approved', 'rejected', 'refunded', 'closed'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? 'bg-t-primary text-white shadow-sm' : `${badgeBg} text-t-muted hover:bg-t-primary/10 hover:text-t-primary`}`}>
                {s === 'all' ? 'All' : (statusLabels[s] || s)}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted" />
            <input type="text" placeholder="Search by code/name/phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-t-primary mb-4"></div>
              <p className={`text-sm font-bold uppercase tracking-wider ${mutedText}`}>Loading...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center">
              <RotateCcw className="w-12 h-12 mx-auto text-t-muted/30 mb-3" />
              <p className={`text-sm font-bold ${mutedText}`}>No return requests found</p>
              <p className="text-xs text-t-muted/60 mt-1">Create a new return request to get started</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className={`${borderColor} border-b text-xs ${mutedText} uppercase tracking-wider`}>
                <th className="text-left p-4 font-bold">RMA Code</th>
                <th className="text-left p-4 font-bold">Order</th>
                <th className="text-left p-4 font-bold">Customer</th>
                <th className="text-left p-4 font-bold">Reason</th>
                <th className="text-left p-4 font-bold">Status</th>
                <th className="text-left p-4 font-bold">Refund</th>
                <th className="text-left p-4 font-bold">Created</th>
                <th className="text-right p-4 font-bold">Actions</th>
              </tr></thead>
              <tbody>{requests.map(r => (
                <tr key={r.id} className={`${borderColor} border-b hover:bg-t-primary/5 transition-colors`}>
                  <td className="p-4"><span className={`font-mono font-bold ${textColor}`}>{r.return_code}</span></td>
                  <td className="p-4"><span className="font-mono text-xs text-t-muted">{r.order_code || `#${r.order_id}`}</span></td>
                  <td className="p-4"><div className={`font-medium ${textColor}`}>{r.customer_name}</div><div className={`text-xs ${mutedText}`}>{r.customer_phone}</div></td>
                  <td className="p-4"><span className={`text-xs ${mutedText}`}>{r.reason || '-'}</span></td>
                  <td className="p-4"><span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${statusBadgeColors[r.status] || ''}`}>{statusLabels[r.status] || r.status}</span></td>
                  <td className="p-4"><span className={`text-sm font-bold ${textColor}`}>৳{Number(r.total_refund_amount).toLocaleString()}</span></td>
                  <td className="p-4"><span className={`text-xs ${mutedText}`}>{new Date(r.created_at).toLocaleDateString()}</span></td>
                  <td className="p-4 text-right">
                    <button onClick={() => viewDetails(r.id)} className="p-2 rounded-lg hover:bg-t-primary/10 transition-colors text-t-muted hover:text-t-primary"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {total > pageSize && <div className={`p-4 border-t ${borderColor} flex items-center justify-between`}>
          <span className={`text-xs ${mutedText}`}>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${page === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-t-primary/10 text-t-primary'}`}>Previous</button>
            <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${(page + 1) * pageSize >= total ? 'opacity-30 cursor-not-allowed' : 'hover:bg-t-primary/10 text-t-primary'}`}>Next</button>
          </div>
        </div>}
      </div>

      {showCreateModal && <CreateReturnModal
        isDark={isDark} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} inputBg={inputBg}
        onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchRequests(); }}
      />}

      {selectedRequest && !showCreateModal && !showInspectionModal && !showRefundModal && !showRestockModal && <ViewReturnModal
        request={selectedRequest} isDark={isDark} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor}
        statusLabels={statusLabels} statusBadgeColors={statusBadgeColors}
        onClose={() => setSelectedRequest(null)}
        onStatusChange={handleStatusChange}
        onOpenInspection={() => setShowInspectionModal(true)}
        onOpenRefund={() => setShowRefundModal(true)}
        onOpenRestock={() => setShowRestockModal(true)}
        actionLoading={actionLoading}
        restockLog={restockLog}
      />}

      {showInspectionModal && <InspectionModal
        request={selectedRequest} isDark={isDark} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} inputBg={inputBg}
        onClose={() => setShowInspectionModal(false)} onSubmit={handleInspection} actionLoading={actionLoading}
      />}

      {showRefundModal && <RefundModal
        request={selectedRequest} isDark={isDark} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} inputBg={inputBg}
        onClose={() => setShowRefundModal(false)} onSubmit={handleRefund} actionLoading={actionLoading}
      />}

      {showRestockModal && <RestockConfirmModal
        request={selectedRequest} isDark={isDark} bgCard={bgCard} textColor={textColor} mutedText={mutedText} borderColor={borderColor} inputBg={inputBg}
        onClose={() => setShowRestockModal(false)} onSubmit={handleRestock} actionLoading={actionLoading}
      />}
    </div>
  );
}

function CreateReturnModal({ isDark, bgCard, textColor, mutedText, borderColor, inputBg, onClose, onCreated }) {
  const [step, setStep] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [form, setForm] = useState({ reason: '', customerNote: '', notes: '' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [creating, setCreating] = useState(false);

  const searchOrders = async () => {
    if (!searchQuery.trim()) return;
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/rma/orders-for-return?search=${encodeURIComponent(searchQuery)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } catch (e) { console.error(e); }
  };

  const selectOrder = async (order) => {
    setSelectedOrder(order);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/rma/orders-for-return/${order.id}/items`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setOrderItems(data.items);
        setSelectedItems(data.items.map(i => ({ orderItemId: i.id, productName: i.product_name || `Product #${i.product_id}`, sku: i.sku || '', variantInfo: i.selected_size || '', quantity: 0, unitPrice: parseFloat(i.price_at_purchase) || 0 })));
      }
    } catch (e) { console.error(e); }
    setStep('items');
  };

  const toggleItem = (idx) => {
    setSelectedItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity > 0 ? 0 : 1 } : item));
  };

  const setItemQty = (idx, qty) => {
    setSelectedItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.min(Math.max(0, parseInt(qty) || 0), orderItems[i]?.quantity || 1) } : item));
  };

  const createReturn = async () => {
    if (!selectedOrder) return;
    const items = selectedItems.filter(i => i.quantity > 0);
    if (items.length === 0) return;
    setCreating(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/rma/return-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          customerName: selectedOrder.customer_name,
          customerPhone: selectedOrder.customer_phone,
          deliveryAddress: selectedOrder.delivery_address,
          reason: form.reason,
          customerNote: form.customerNote,
          notes: form.notes,
          items,
        }),
      });
      const data = await res.json();
      if (data.success) onCreated();
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${bgCard} rounded-2xl border ${borderColor} w-full max-w-2xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-t-border">
          <div className="flex items-center gap-3">
            {step === 'items' && <button onClick={() => { setStep('search'); setSelectedOrder(null); }} className="p-1.5 rounded-lg hover:bg-t-primary/10 text-t-muted"><ArrowLeft className="w-4 h-4" /></button>}
            <h2 className="text-lg font-black uppercase tracking-wider">{step === 'search' ? 'Select Order' : 'Return Items'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-t-primary/10 text-t-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6">
          {step === 'search' && <div>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder="Search by order code, customer name, or phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchOrders()}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
              <button onClick={searchOrders} className="px-4 py-2.5 bg-t-primary text-white rounded-lg hover:bg-t-primary/90 transition-all text-sm font-bold"><Search className="w-4 h-4" /></button>
            </div>

            {orders.length === 0 && <p className={`text-sm text-center py-8 ${mutedText}`}>Search for delivered orders to create a return</p>}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {orders.map(o => (
                <div key={o.id} onClick={() => selectOrder(o)}
                  className={`flex items-center justify-between p-4 rounded-xl border ${borderColor} cursor-pointer hover:border-t-primary hover:bg-t-primary/5 transition-all`}>
                  <div>
                    <div className={`font-bold ${textColor}`}>{o.order_code}</div>
                    <div className={`text-xs ${mutedText}`}>{o.customer_name} — {o.customer_phone}</div>
                    <div className={`text-xs ${mutedText} mt-0.5`}>৳{Number(o.total_amount).toLocaleString()} • {new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-t-muted" />
                </div>
              ))}
            </div>
          </div>}

          {step === 'items' && <div>
            <div className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} border ${borderColor}`}>
              <div className={`font-bold ${textColor}`}>{selectedOrder?.order_code}</div>
              <div className={`text-xs ${mutedText}`}>{selectedOrder?.customer_name} — {selectedOrder?.customer_phone}</div>
              <div className={`text-xs ${mutedText}`}>Order Total: ৳{Number(selectedOrder?.total_amount).toLocaleString()}</div>
            </div>

            <div className="space-y-2 mb-4">
              {selectedItems.map((item, idx) => {
                const maxQty = orderItems[idx]?.quantity || 1;
                const remaining = maxQty - (orderItems[idx]?.returned_quantity || 0);
                return <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${borderColor} ${item.quantity > 0 ? 'border-t-primary/50 bg-t-primary/5' : ''}`}>
                  <input type="checkbox" checked={item.quantity > 0} onChange={() => toggleItem(idx)} className="w-4 h-4 accent-t-primary rounded" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${textColor} truncate`}>{item.productName}</div>
                    <div className={`text-xs ${mutedText}`}>{item.sku} {item.variantInfo ? `• ${item.variantInfo}` : ''} • ৳{item.unitPrice}</div>
                    <div className={`text-xs ${mutedText}`}>Ordered: {maxQty} {remaining < maxQty ? `(already returned: ${orderItems[idx]?.returned_quantity || 0})` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${mutedText}`}>Qty:</span>
                    <input type="number" min="0" max={remaining} value={item.quantity} disabled={item.quantity === 0}
                      onChange={e => setItemQty(idx, e.target.value)}
                      className={`w-16 px-2 py-1.5 rounded-lg text-sm text-center border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40 ${item.quantity === 0 ? 'opacity-30' : ''}`} />
                  </div>
                </div>;
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className={`text-xs font-bold ${mutedText} block mb-1`}>Return Reason</label>
                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`}>
                  <option value="">Select reason...</option>
                  <option value="Damaged">Damaged / Defective</option>
                  <option value="Wrong Item">Wrong Item Received</option>
                  <option value="Size Issue">Size / Fit Issue</option>
                  <option value="Quality Issue">Quality Issue</option>
                  <option value="Not as Described">Not as Described</option>
                  <option value="Changed Mind">Changed Mind</option>
                  <option value="Duplicate">Duplicate Order</option>
                </select>
              </div>
              <div>
                <label className={`text-xs font-bold ${mutedText} block mb-1`}>Customer Note</label>
                <input type="text" value={form.customerNote} onChange={e => setForm(f => ({ ...f, customerNote: e.target.value }))} placeholder="Customer's message..." className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-t-border text-sm font-bold hover:bg-t-primary/5 transition-all">Cancel</button>
              <button onClick={createReturn} disabled={creating || selectedItems.filter(i => i.quantity > 0).length === 0}
                className="px-6 py-2.5 bg-t-primary text-white rounded-lg hover:bg-t-primary/90 transition-all text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                {creating ? <>Processing...</> : <><RotateCcw className="w-4 h-4" /> Create Return</>}
              </button>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

function ViewReturnModal({ request, isDark, bgCard, textColor, mutedText, borderColor, statusLabels, statusBadgeColors, onClose, onStatusChange, onOpenInspection, onOpenRefund, onOpenRestock, actionLoading, restockLog }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${bgCard} rounded-2xl border ${borderColor} w-full max-w-4xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-t-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black uppercase tracking-wider">{request.return_code}</h2>
            <span className={`px-3 py-1 rounded-md text-xs font-bold ${statusBadgeColors[request.status] || ''}`}>{statusLabels[request.status] || request.status}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-t-primary/10 text-t-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${borderColor}`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-2`}>Order Info</h3>
              <p className={`text-sm font-bold ${textColor}`}>{request.order_code || `#${request.order_id}`}</p>
              <p className={`text-xs ${mutedText}`}>Order Total: ৳{Number(request.order_total).toLocaleString()}</p>
              <p className={`text-xs ${mutedText}`}>Order Date: {request.order_date ? new Date(request.order_date).toLocaleDateString() : '-'}</p>
            </div>
            <div className={`p-4 rounded-xl border ${borderColor}`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-2`}>Customer</h3>
              <p className={`text-sm font-bold ${textColor}`}>{request.customer_name}</p>
              <p className={`text-xs ${mutedText}`}>{request.customer_phone}</p>
              <p className={`text-xs ${mutedText} truncate`}>{request.delivery_address || request.order_address || '-'}</p>
            </div>
          </div>

          {request.items?.length > 0 && <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-3`}>Return Items ({request.items.length})</h3>
            <div className="space-y-2">
              {request.items.map(item => (
                <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${borderColor}`}>
                  <div>
                    <div className={`text-sm font-medium ${textColor}`}>{item.product_name || item.sku || `Item #${item.id}`}</div>
                    <div className={`text-xs ${mutedText}`}>{item.sku} {item.variant_info ? `• ${item.variant_info}` : ''} {item.selected_size ? `• ${item.selected_size}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${textColor}`}>×{item.quantity}</div>
                    <div className={`text-xs ${mutedText}`}>৳{Number(item.unit_price).toLocaleString()} each</div>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          <div className="flex gap-3">
            {request.allowedTransitions?.includes('pickup_scheduled') && <button onClick={() => onStatusChange(request.id, 'pickup_scheduled')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-bold"><Truck className="w-4 h-4" /> Schedule Pickup</button>}
            {request.allowedTransitions?.includes('picked_up') && <button onClick={() => onStatusChange(request.id, 'picked_up')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all text-sm font-bold"><Package className="w-4 h-4" /> Mark Picked Up</button>}
            {request.allowedTransitions?.includes('inspected') && <button onClick={onOpenInspection} className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all text-sm font-bold"><ClipboardCheck className="w-4 h-4" /> Submit Inspection</button>}
            {request.allowedTransitions?.includes('refunded') && <button onClick={onOpenRefund} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-sm font-bold"><DollarSign className="w-4 h-4" /> Process Refund</button>}
            {['inspected', 'approved'].includes(request.status) && <button onClick={onOpenRestock} className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all text-sm font-bold"><PackageCheck className="w-4 h-4" /> Confirm Restock</button>}
            {request.allowedTransitions?.includes('rejected') && <button onClick={() => onStatusChange(request.id, 'rejected', 'Rejected during inspection')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm font-bold"><XCircle className="w-4 h-4" /> Reject</button>}
            {request.allowedTransitions?.includes('closed') && <button onClick={() => onStatusChange(request.id, 'closed')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all text-sm font-bold"><CheckCircle2 className="w-4 h-4" /> Close</button>}
            {request.allowedTransitions?.includes('cancelled') && <button onClick={() => onStatusChange(request.id, 'cancelled')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all text-sm font-bold"><X className="w-4 h-4" /> Cancel</button>}
          </div>

          {request.inspection && <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-3`}>Inspection Report</h3>
            <div className={`p-4 rounded-xl border ${borderColor} grid grid-cols-2 md:grid-cols-4 gap-4`}>
              <div><span className={`text-xs ${mutedText}`}>Condition</span><p className={`text-sm font-bold ${textColor}`}>{request.inspection.condition}</p></div>
              <div><span className={`text-xs ${mutedText}`}>Verdict</span><p className={`text-sm font-bold ${textColor}`}>{request.inspection.verdict}</p></div>
              <div><span className={`text-xs ${mutedText}`}>Approved Amount</span><p className={`text-sm font-bold ${textColor}`}>৳{Number(request.inspection.approved_amount).toLocaleString()}</p></div>
              <div><span className={`text-xs ${mutedText}`}>Inspected By</span><p className={`text-sm font-bold ${textColor}`}>{request.inspection.inspected_by || '-'}</p></div>
              {request.inspection.notes && <div className="col-span-full"><span className={`text-xs ${mutedText}`}>Notes</span><p className={`text-sm ${textColor}`}>{request.inspection.notes}</p></div>}
            </div>
          </div>}

          {request.refunds?.length > 0 && <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-3`}>Refund Transactions</h3>
            <div className="space-y-2">
              {request.refunds.map(ref => (
                <div key={ref.id} className={`flex items-center justify-between p-3 rounded-xl border ${borderColor}`}>
                  <div>
                    <div className={`text-sm font-bold ${textColor}`}>৳{Number(ref.amount).toLocaleString()} via {ref.method}</div>
                    <div className={`text-xs ${mutedText}`}>Ref: {ref.reference || '-'} • By: {ref.processed_by}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${ref.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{ref.status}</span>
                </div>
              ))}
            </div>
          </div>}

          {restockLog?.length > 0 && <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-3 flex items-center gap-2`}><PackageCheck className="w-3 h-3" /> Restock Log</h3>
            <div className="space-y-2">
              {restockLog.map(r => (
                <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl border ${borderColor}`}>
                  <div>
                    <div className={`text-sm font-medium ${textColor}`}>{r.product_name || `Product #${r.product_id}`}</div>
                    <div className={`text-xs ${mutedText}`}>SKU: {r.sku || '-'} • Condition: {r.condition}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold text-teal-600`}>+{r.quantity} restocked</div>
                    <div className={`text-xs ${mutedText}`}>By: {r.restored_by}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {request.history?.length > 0 && <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${mutedText} mb-3 flex items-center gap-2`}><History className="w-3 h-3" /> Status History</h3>
            <div className="space-y-1">
              {request.history.map(h => (
                <div key={h.id} className="flex items-center gap-3 text-xs">
                  <span className={`w-2 h-2 rounded-full ${statusColors[h.to_status] || 'bg-gray-400'}`}></span>
                  <span className="font-mono text-t-muted">{new Date(h.created_at).toLocaleString()}</span>
                  {h.from_status ? <><span className={statusBadgeColors[h.from_status] ? `px-1.5 py-0.5 rounded text-xs font-bold ${statusBadgeColors[h.from_status]}` : ''}>{statusLabels[h.from_status] || h.from_status}</span><ChevronRight className="w-3 h-3 text-t-muted" /></> : null}
                  <span className={statusBadgeColors[h.to_status] ? `px-1.5 py-0.5 rounded text-xs font-bold ${statusBadgeColors[h.to_status]}` : ''}>{statusLabels[h.to_status] || h.to_status}</span>
                  <span className="text-t-muted">— {h.changed_by}</span>
                  {h.note && <span className="text-t-muted/60">({h.note})</span>}
                </div>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

function InspectionModal({ request, isDark, bgCard, textColor, mutedText, borderColor, inputBg, onClose, onSubmit, actionLoading }) {
  const [form, setForm] = useState({ condition: 'good', verdict: 'approve', approvedAmount: request?.items?.reduce((sum, i) => sum + (parseFloat(i.unit_price) * i.quantity), 0) || 0, inspectedBy: 'Admin', notes: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${bgCard} rounded-2xl border ${borderColor} w-full max-w-lg`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-t-border">
          <h2 className="text-lg font-black uppercase tracking-wider">Inspection — {request.return_code}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-t-primary/10 text-t-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-bold ${mutedText} block mb-1`}>Item Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`}>
                <option value="good_restock">Good — Restock</option>
                <option value="good_keep">Good — Keep (As-is)</option>
                <option value="damaged_discard">Damaged — Discard</option>
                <option value="damaged_repair">Damaged — Repair</option>
              </select>
            </div>
            <div>
              <label className={`text-xs font-bold ${mutedText} block mb-1`}>Verdict</label>
              <select value={form.verdict} onChange={e => setForm(f => ({ ...f, verdict: e.target.value }))} className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`}>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="partial">Partial Approve</option>
              </select>
            </div>
          </div>
          <div>
            <label className={`text-xs font-bold ${mutedText} block mb-1`}>Approved Refund Amount (৳)</label>
            <input type="number" step="0.01" value={form.approvedAmount} onChange={e => setForm(f => ({ ...f, approvedAmount: parseFloat(e.target.value) || 0 }))} className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
          </div>
          <div>
            <label className={`text-xs font-bold ${mutedText} block mb-1`}>Inspector Name</label>
            <input type="text" value={form.inspectedBy} onChange={e => setForm(f => ({ ...f, inspectedBy: e.target.value }))} className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
          </div>
          <div>
            <label className={`text-xs font-bold ${mutedText} block mb-1`}>Notes</label>
            <textarea rows="3" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Inspection notes..." className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`}></textarea>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-t-border text-sm font-bold hover:bg-t-primary/5 transition-all">Cancel</button>
            <button onClick={() => onSubmit({ inspectedBy: form.inspectedBy, condition: form.condition, verdict: form.verdict, approvedAmount: form.approvedAmount, notes: form.notes })} disabled={actionLoading} className="px-6 py-2.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all text-sm font-bold disabled:opacity-50"><ClipboardCheck className="w-4 h-4 inline mr-1" /> Submit</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefundModal({ request, isDark, bgCard, textColor, mutedText, borderColor, inputBg, onClose, onSubmit, actionLoading }) {
  const [form, setForm] = useState({ amount: request?.inspection?.approved_amount || 0, method: 'bkash', reference: '', notes: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${bgCard} rounded-2xl border ${borderColor} w-full max-w-lg`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-t-border">
          <h2 className="text-lg font-black uppercase tracking-wider">Process Refund — {request.return_code}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-t-primary/10 text-t-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={`text-xs font-bold ${mutedText} block mb-1`}>Refund Amount (৳)</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
          </div>
          <div>
            <label className={`text-xs font-bold ${mutedText} block mb-1`}>Refund Method</label>
            <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`}>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="bank">Bank Transfer</option>
              <option value="cod">COD Deduction</option>
              <option value="wallet">Store Wallet</option>
            </select>
          </div>
          <div>
            <label className={`text-xs font-bold ${mutedText} block mb-1`}>Reference (Transaction ID)</label>
            <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. bkash-trnx-123" className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`} />
          </div>
          <div>
            <label className={`text-xs font-bold ${mutedText} block mb-1`}>Notes</label>
            <textarea rows="2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." className={`w-full px-3 py-2 rounded-lg text-sm border ${borderColor} ${inputBg} focus:outline-none focus:ring-2 focus:ring-t-primary/40`}></textarea>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-t-border text-sm font-bold hover:bg-t-primary/5 transition-all">Cancel</button>
            <button onClick={() => onSubmit({ amount: form.amount, method: form.method, reference: form.reference, notes: form.notes })} disabled={actionLoading || !form.amount} className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-sm font-bold disabled:opacity-50"><DollarSign className="w-4 h-4 inline mr-1" /> Process Refund</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RestockConfirmModal({ request, isDark, bgCard, textColor, mutedText, borderColor, inputBg, onClose, onSubmit, actionLoading }) {
  const [items, setItems] = useState(
    (request?.items || []).map(item => ({
      returnItemId: item.id,
      productId: item.product_id,
      productName: item.product_name || `Product #${item.product_id}`,
      sku: item.sku || '',
      quantity: item.quantity || 1,
      condition: 'good_restock',
    }))
  );

  const updateCondition = (idx, condition) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, condition } : item));
  };

  const conditionLabels = {
    good_restock: 'Good — Restock',
    good_keep: 'Good — Keep',
    damaged_discard: 'Damaged — Discard',
    damaged_repair: 'Damaged — Repair',
  };

  const conditionColors = {
    good_restock: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    good_keep: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    damaged_discard: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    damaged_repair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${bgCard} rounded-2xl border ${borderColor} w-full max-w-2xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-t-border">
          <h2 className="text-lg font-black uppercase tracking-wider">Confirm Restock — {request.return_code}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-t-primary/10 text-t-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          <p className={`text-sm ${mutedText} mb-4`}>Set the condition for each returned item. Items marked "Good — Restock" will automatically increment inventory.</p>
          <div className="space-y-3 mb-6">
            {items.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${borderColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`text-sm font-bold ${textColor}`}>{item.productName}</div>
                    <div className={`text-xs ${mutedText}`}>SKU: {item.sku || '-'} • Qty: {item.quantity}</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(conditionLabels).map(([key, label]) => (
                    <button key={key} onClick={() => updateCondition(idx, key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${item.condition === key ? conditionColors[key] : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-t-border text-sm font-bold hover:bg-t-primary/5 transition-all">Cancel</button>
            <button onClick={() => onSubmit({ items })} disabled={actionLoading}
              className="px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all text-sm font-bold disabled:opacity-50 flex items-center gap-2">
              {actionLoading ? 'Processing...' : <><PackageCheck className="w-4 h-4" /> Confirm Restock</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
