import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';
import { getToken } from '../utils/auth';
import DynamicDataTable from '../components/ui/DynamicDataTable';
import { Users, Download, Search, ChevronDown, Edit, ShoppingBag, Trash2, X } from 'lucide-react';

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  // Server-side paging. Falls back to client-side paging when the backend
  // does not return a `total` (i.e. does not support ?page/?limit yet).
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [serverPaginated, setServerPaginated] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomers = async (signal, { paged = false } = {}) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (paged) {
        if (searchTerm) params.set('search', searchTerm);
        if (activeFilter !== 'All') params.set('type', activeFilter);
        params.set('fields', 'list');
      }
      const response = await fetch(`${API_BASE_URL}/api/customers?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
        signal,
      });
      const result = await response.json();
      if (result.success) {
        setCustomers(result.data || []);
        // `total` is only present on a paging-aware backend.
        if (typeof result.total === 'number') {
          setTotal(result.total);
          setServerPaginated(true);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.error('Error fetching customers:', error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Typing is local-only; the request fires after the user pauses.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchInput(searchTerm.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // NB: state updates above are deferred inside the timeout, so they never
  // cascade synchronously from the effect body.

  // Initial load (also the unpaged fallback path).
  useEffect(() => {
    const controller = new AbortController();
    fetchCustomers(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paged reloads — only once the backend has proven it supports them.
  useEffect(() => {
    if (!serverPaginated) return;
    const controller = new AbortController();
    fetchCustomers(controller.signal, { paged: true });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchInput, activeFilter, serverPaginated]);

  // Derived, not stored: in server mode the API already applied search + type +
  // paging, so the rows are used verbatim. Otherwise filter/sort in the browser
  // (the fallback path for a backend without paging support).
  const filteredCustomers = useMemo(() => {
    if (serverPaginated) return customers;

    let result = customers;
    if (searchInput) {
      const term = searchInput.toLowerCase();
      result = result.filter(c =>
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.address && c.address.toLowerCase().includes(term))
      );
    }
    if (activeFilter === 'VIP') result = result.filter(c => c.customer_type?.toLowerCase() === 'vip');
    else if (activeFilter === 'Regular') result = result.filter(c => c.customer_type?.toLowerCase() === 'regular');
    else if (activeFilter === 'HasOrders') result = result.filter(c => Number(c.total_orders) > 0);
    else if (activeFilter === 'TopSpenders') result = [...result].sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0));
    return result;
  }, [customers, searchInput, activeFilter, serverPaginated]);

  const handleEdit = (customer) => { setEditData({ ...customer }); setShowEditModal(true); };
  const handleEditChange = (e) => { setEditData({ ...editData, [e.target.name]: e.target.value }); };

  const submitEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setCustomers(customers.map(c => c.id === editData.id ? editData : c));
      toast.success('Customer profile updated successfully!');
      setIsSaving(false);
      setShowEditModal(false);
    }, 800);
  };

  const handleViewOrders = (phone) => { navigate(`/orders?search=${phone}`); };
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to permanently delete this customer?')) {
      setCustomers(customers.filter(c => c.id !== id));
      toast.success('Customer deleted successfully!');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const columns = [
    {
      key: 'phone',
      label: 'Mobile',
      minWidth: '140px',
      render: (value) => <span className="font-bold text-t-primary font-mono">{value}</span>
    },
    {
      key: 'name',
      label: 'Customer Details',
      minWidth: '250px',
      maxWidth: '350px',
      render: (value, row) => (
        <div>
          <div className="font-extrabold text-t-main">{row.name || 'Unknown'}</div>
          <div className="text-[11px] font-semibold text-t-muted mt-1 truncate max-w-xs">{row.address || '-'}</div>
        </div>
      )
    },
    {
      key: 'total_orders',
      label: 'Orders',
      align: 'center',
      render: (value) => <span className="font-black text-t-main">{value || 0}</span>
    },
    {
      key: 'total_spent',
      label: 'Total Spent',
      align: 'center',
      render: (value) => <span className="font-black text-t-main">{'৳'}{value || 0}</span>
    },
    {
      key: 'customer_type',
      label: 'Type',
      align: 'center',
      render: (value) => (
        <span className={`inline-flex items-center justify-center gap-1 font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-lg ${value?.toLowerCase() === 'vip' ? 'bg-orange-500/10 text-orange-500' : 'bg-t-primary/10 text-t-primary'}`}>
          {value || 'Regular'}
        </span>
      )
    },
    {
      key: 'last_order_date',
      label: 'Last Order',
      align: 'center',
      render: (value) => <span className="text-t-muted font-semibold text-xs">{formatDate(value)}</span>
    }
  ];

  const renderActions = (row) => (
    <div className="flex items-center gap-1">
      <button onClick={() => handleEdit(row)} className="p-2 text-t-muted hover:text-t-primary hover:bg-t-primary/10 transition-colors rounded-lg" title="Edit Profile">
        <Edit size={14} />
      </button>
      <button onClick={() => handleViewOrders(row.phone)} className="p-2 text-t-muted hover:text-blue-500 hover:bg-blue-500/10 transition-colors rounded-lg" title="View Orders">
        <ShoppingBag size={14} />
      </button>
      <button onClick={() => handleDelete(row.phone)} className="p-2 text-t-muted hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-lg" title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">

      {/* Top Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-t-border pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-t-primary/10 rounded-xl flex items-center justify-center">
            <Users size={24} className="text-t-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Customer Database</h1>
            <p className="text-sm text-t-muted mt-1 font-medium">Manage and segment your loyal customer base.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-t-surface border border-t-border text-t-main px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-t-base shadow-sm transition-colors">
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <div className="bg-t-surface rounded-lg shadow-sm border border-t-border overflow-visible transition-colors duration-300">

        {/* Header Bar with Search & Filter */}
        <div className="p-6 border-b border-t-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-t-base/30 rounded-t-lg">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <span className="text-t-primary"><Users size={18} /></span> Customer Directory
            </h2>
            <p className="text-xs text-t-muted mt-1 font-bold tracking-widest uppercase">
              {serverPaginated
                ? `${filteredCustomers.length} of ${total} total customers`
                : `${filteredCustomers.length} of ${customers.length} total customers`}
            </p>
          </div>

          <div className="flex gap-3 w-full sm:w-auto relative">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-3 text-t-muted" />
              <input
                type="text"
                placeholder="Search name, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-t-border bg-t-base text-t-main rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-t-primary/20 focus:border-t-primary transition-all shadow-sm font-semibold"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`px-5 py-2.5 border rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm whitespace-nowrap ${activeFilter !== 'All' ? 'bg-t-primary/10 border-t-primary/30 text-t-primary' : 'border-t-border bg-t-surface text-t-main hover:bg-t-base'}`}
              >
                {activeFilter === 'All' ? 'Filter' : activeFilter.replace(/([A-Z])/g, ' $1').trim()} <ChevronDown size={14} />
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-t-surface border border-t-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2 space-y-1">
                    {['All', 'VIP', 'Regular', 'HasOrders', 'TopSpenders'].map(filter => (
                      <button key={filter} onClick={() => { setActiveFilter(filter); setIsFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm rounded-lg transition-colors ${activeFilter === filter ? 'bg-t-primary/10 text-t-primary font-bold' : 'text-t-main hover:bg-t-base font-semibold'}`}>
                        {filter === 'All' ? 'All Customers' : filter === 'HasOrders' ? 'Has Orders (>0)' : filter === 'TopSpenders' ? 'Top Spenders First' : filter === 'VIP' ? 'VIP Only' : 'Regular Only'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DynamicDataTable */}
        <DynamicDataTable
          columns={columns}
          data={filteredCustomers}
          actions={renderActions}
          emptyMessage="No customers found matching your criteria."
          emptyIcon={<Users size={48} className="text-t-primary/30" />}
          loading={loading}
          loadingMessage="Loading Customers..."
          sortable={!serverPaginated}
          paginated={!serverPaginated}
          pageSize={pageSize}
          selectable={false}
        />

        {/* Server-side pager — only rendered once the API proves it supports paging */}
        {serverPaginated && total > pageSize && (
          <div className="p-4 border-t border-t-border flex items-center justify-between">
            <span className="text-xs text-t-muted">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${page === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-t-primary/10 text-t-primary'}`}
              >Previous</button>
              <button
                disabled={page * pageSize >= total}
                onClick={() => setPage(p => p + 1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${page * pageSize >= total ? 'opacity-30 cursor-not-allowed' : 'hover:bg-t-primary/10 text-t-primary'}`}
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Customer Modal */}
      {showEditModal && editData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-t-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-t-border animate-fade-in">
            <div className="px-8 py-5 bg-t-primary/10 border-b border-t-primary/20 flex justify-between items-center">
              <h2 className="text-xl font-black text-t-primary flex items-center gap-2 tracking-tight"><Edit size={18} /> Edit Customer Profile</h2>
              <button onClick={() => setShowEditModal(false)} className="text-t-primary/50 hover:text-red-500 hover:bg-red-500/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitEdit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Full Name</label>
                  <input type="text" name="name" value={editData.name || ''} onChange={handleEditChange} className="w-full border border-t-border bg-t-base text-t-main rounded-lg p-3 text-sm outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Phone Number</label>
                  <input type="text" name="phone" value={editData.phone || ''} onChange={handleEditChange} className="w-full border border-t-border bg-t-base text-t-main rounded-lg p-3 text-sm outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-mono font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Full Address</label>
                <textarea name="address" value={editData.address || ''} onChange={handleEditChange} rows="3" className="w-full border border-t-border bg-t-base text-t-main rounded-lg p-3 text-sm outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold resize-none custom-scrollbar"></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Customer Type</label>
                <select name="customer_type" value={editData.customer_type || 'Regular'} onChange={handleEditChange} className="w-full border border-t-border bg-t-base text-t-main rounded-lg p-3 text-sm outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-bold">
                  <option value="Regular">Regular</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>

              <div className="bg-t-base p-4 rounded-lg border border-t-border text-xs text-t-muted flex justify-between font-bold">
                <span>Total Orders: <strong className="text-t-main font-black ml-1">{editData.total_orders || 0}</strong></span>
                <span>Total Spent: <strong className="text-t-primary font-black ml-1 text-sm">{'৳'}{editData.total_spent || 0}</strong></span>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-t-border">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 text-sm border border-t-border text-t-main rounded-lg font-bold hover:bg-t-base transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-8 py-3 text-sm bg-t-primary hover:opacity-90 text-white rounded-lg font-black uppercase tracking-widest shadow-lg shadow-t-primary/30 transition-all">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}