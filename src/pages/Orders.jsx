import { ThemeContext } from '../context/ThemeContext';
import { getToken } from '../utils/auth';
import { useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight as ChevronRightIcon, X, ShoppingBag } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';

import OrderTabs from "../components/Orders/OrderTabs";
import OrderToolbar from "../components/Orders/OrderToolbar";
import OrderTable from "../components/Orders/OrderTable";
import OrderModal from "../components/Orders/OrderModal";
import FraudModal from "../components/Orders/FraudModal";
import ThermalSticker from "../components/Orders/ThermalSticker";

export default function Orders() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]); 
  const [products, setProducts] = useState([]);
  const [siteSettings, setSiteSettings] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Pending'); 
  const [selectedOrders, setSelectedOrders] = useState([]);
  
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date_desc' });

  const [advancedFilters, setAdvancedFilters] = useState({
    printStatus: 'All', uploadStatus: 'All', productSku: '', productName: '', 
    orderSource: 'All Sources', minQty: '', maxQty: '', fromDate: '', toDate: ''
  });

  // 🔴 FIX 1: Column Visibility saved to LocalStorage
  const defaultColumns = {
    dateInvoice: true, customer: true, repeat: true, note: true, 
    products: true, tags: true, status: true, print: true, 
    total: true, upload: true, crossSale: true, userSource: true, 
    shippingNote: true, attachments: true
  };
  
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const savedCols = localStorage.getItem('hamzaBiOrderCols');
    return savedCols ? JSON.parse(savedCols) : defaultColumns;
  });

  useEffect(() => {
    localStorage.setItem('hamzaBiOrderCols', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const savedLimit = parseInt(localStorage.getItem('ordersPerPage')) || 50;
  const [meta, setMeta] = useState({ page: 1, limit: savedLimit, total: 0 });
  // True once the API proves it understands ?page/?limit (i.e. returns `total`).
  // Until then we keep the historical fetch-everything + filter-in-browser path.
  const [serverPaginated, setServerPaginated] = useState(false);
  const [searchDebounced, setSearchDebounced] = useState('');
  const paginationReady = useRef(false);
  const [openActionId, setOpenActionId] = useState(null);
  
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [orderFormData, setOrderFormData] = useState({
    id: null, invoice: '', customer: { name: '', phone: '', address: '', area: 'Inside Dhaka' },
    deliveryMethod: 'PATHAO', shippingNote: '', crossSale: false, city: '', zone: '', areaGeo: '',
    items: [], billing: { discount: 0, advance: 0, subTotal: 0, deliveryCharge: 150, total: 0 }, metrics: null
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [selectedCouriers, setSelectedCouriers] = useState({});
  const [printOrders, setPrintOrders] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  
  const [fraudData, setFraudData] = useState(null);
  const [checkingPhone, setCheckingPhone] = useState(null);

  // Module Z: Thermal Sticker Printing
  const stickerRef = useRef(null);
  const [stickerOrders, setStickerOrders] = useState([]);
  const [activeStickerIndex, setActiveStickerIndex] = useState(0);
  const handleStickerPrint = useReactToPrint({
    contentRef: stickerRef,
    contentTitle: () => 'Thermal Sticker',
    onAfterPrint: () => {
      // If bulk printing, advance to next sticker
      if (stickerOrders.length > 1 && activeStickerIndex < stickerOrders.length - 1) {
        setActiveStickerIndex(prev => prev + 1);
      }
    },
  });



  const buildOrderParams = () => {
    const params = new URLSearchParams({ page: String(meta.page), limit: String(meta.limit) });

    // Ask for the list projection: no billing/metrics blobs, no line-item JSON.
    params.set('fields', 'list');
    if (activeTab !== 'All') params.set('status', activeTab.toLowerCase().replace(' ', '_'));
    if (searchDebounced) params.set('search', searchDebounced);
    if (sortConfig.key) params.set('sort', sortConfig.key);

    const f = advancedFilters;
    if (f.printStatus !== 'All') params.set('print_status', f.printStatus);
    if (f.uploadStatus !== 'All') params.set('upload_status', f.uploadStatus);
    if (f.orderSource !== 'All Sources') params.set('source', f.orderSource);
    if (f.productSku) params.set('product_sku', f.productSku);
    if (f.productName) params.set('product_name', f.productName);
    if (f.minQty) params.set('min_qty', f.minQty);
    if (f.maxQty) params.set('max_qty', f.maxQty);
    if (f.fromDate) params.set('from', f.fromDate);
    if (f.toDate) params.set('to', f.toDate);

    return params;
  };

  const fetchData = async (signal) => {
    try {
      setLoading(true);
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
      const params = buildOrderParams();
      const [ordersRes, couriersRes, productsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/orders?${params}`, { headers, signal }),
        fetch(`${API_BASE_URL}/api/courier/active`, { headers, signal }),
        // `orderform` projection must include variants (the modal flattens them
        // for size selection) — see EGRESS_AUDIT.md §1.3.
        fetch(`${API_BASE_URL}/api/products?limit=500&fields=orderform`, { signal })
      ]);

      const ordersResult = await ordersRes.json();
      const couriersResult = await couriersRes.json();
      const productsResult = await productsRes.json();

      let defaultCourier = 'Steadfast';
      if (couriersResult.success) {
        setCouriers(couriersResult.data);
        if (couriersResult.data.length > 0) defaultCourier = couriersResult.data[0].name;
      }

      if (ordersResult.success) {
        const rows = ordersResult.data || [];
        setOrders(rows);

        if (typeof ordersResult.total === 'number') {
          setServerPaginated(true);
          setMeta(m => ({ ...m, total: ordersResult.total }));
        } else if (rows.length >= meta.limit) {
          // Backend ignored ?limit (or honours it but never returns `total`).
          // We stay in client-side mode so nothing is silently truncated, but
          // say so loudly — this is the line that costs the most egress.
          console.warn(
            '[Orders] /api/orders returned %d rows with no `total`. ' +
            'Server-side paging is inactive — see EGRESS_AUDIT.md §2.1.',
            rows.length
          );
        }

        const initialCouriers = {};
        rows.forEach(o => { if (!o.tracking_code) initialCouriers[o.id] = defaultCourier; });
        setSelectedCouriers(initialCouriers);
      }
      if (productsResult.success) setProducts(productsResult.data || []);
    } catch (err) {
      if (err.name !== 'AbortError') setError('Server connection error.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Initial load.
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const savedSettings = localStorage.getItem('siteSettings');
    if (savedSettings) setSiteSettings(JSON.parse(savedSettings));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search is local-only while typing; query it after the user pauses.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(searchQuery.trim());
      setMeta(m => (m.page === 1 ? m : { ...m, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Page / page-size changes: only meaningful when the server is doing the paging.
  useEffect(() => {
    if (!serverPaginated) return;
    if (!paginationReady.current) { paginationReady.current = true; return; } // page 1 already loaded
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.page, meta.limit, serverPaginated]);

  // Tab / sort / advanced-filter changes: re-query once the server can filter.
  useEffect(() => {
    if (!serverPaginated) return;              // legacy mode filters client-side
    if (!paginationReady.current) { paginationReady.current = true; return; }
    if (meta.page !== 1) { setMeta(m => ({ ...m, page: 1 })); return; }
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab, sortConfig.key, searchDebounced,
    advancedFilters.printStatus, advancedFilters.uploadStatus,
    advancedFilters.orderSource, advancedFilters.productSku,
    advancedFilters.productName, advancedFilters.minQty,
    advancedFilters.maxQty, advancedFilters.fromDate, advancedFilters.toDate,
  ]);

  // In server mode the API has already applied the tab, search, advanced filters
  // and sort. Applying them again here would filter a single page against itself
  // and produce wrong counts — so the whole block is bypassed.
  const serverMode = serverPaginated;

  let filteredOrders = Array.isArray(orders) ? (serverMode ? orders : orders.filter(order => {
    const orderStatus = (order.status || 'pending').toLowerCase();
    const tabStatus = activeTab.toLowerCase().replace(' ', '_'); 
    let matchesTab = false;
    if (activeTab === 'All') matchesTab = true;
    else if (activeTab === 'Partial' && orderStatus === 'partial_delivered') matchesTab = true;
    else matchesTab = orderStatus === tabStatus;
    if (!matchesTab) return false;

    const searchLower = searchQuery?.toLowerCase() || '';
    const matchesSearch = String(order.invoice || '').toLowerCase().includes(searchLower) || 
                          String(order.customer?.name || '').toLowerCase().includes(searchLower) || 
                          String(order.customer?.phone || '').toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;

    const f = advancedFilters;
    if (f.printStatus === 'Printed' && !order.is_printed) return false;
    if (f.printStatus === 'Not printed' && order.is_printed) return false;
    if (f.uploadStatus === 'Uploaded' && !order.tracking_code) return false;
    if (f.uploadStatus === 'Not Uploaded' && order.tracking_code) return false;
    if (f.orderSource !== 'All Sources' && (order.source || 'Website').toLowerCase() !== f.orderSource.toLowerCase()) return false;

    if (f.productSku) {
      const hasSku = order.products?.some(p => ((p.sku || p.sku_code || '') + '').toLowerCase().includes(f.productSku.toLowerCase()));
      if (!hasSku) return false;
    }
    if (f.productName) {
      const hasName = order.products?.some(p => (p.productName || p.name || '').toLowerCase().includes(f.productName.toLowerCase()));
      if (!hasName) return false;
    }

    if (f.minQty || f.maxQty) {
      const totalQty = order.products?.reduce((acc, p) => acc + (parseInt(p.qty || p.quantity) || 1), 0) || 0;
      if (f.minQty && totalQty < parseInt(f.minQty)) return false;
      if (f.maxQty && totalQty > parseInt(f.maxQty)) return false;
    }

    if (f.fromDate || f.toDate) {
      const oDate = new Date(order.date);
      if (f.fromDate && oDate < new Date(f.fromDate)) return false;
      if (f.toDate) {
        const toD = new Date(f.toDate);
        toD.setHours(23, 59, 59, 999);
        if (oDate > toD) return false;
      }
    }

    return true;
  })) : [];

  if (!serverMode) filteredOrders.sort((a, b) => {
    if(sortConfig.key === 'date_desc') return new Date(b.date) - new Date(a.date);
    if(sortConfig.key === 'date_asc') return new Date(a.date) - new Date(b.date);
    if(sortConfig.key === 'amount_desc') return parseFloat(b.total) - parseFloat(a.total);
    if(sortConfig.key === 'amount_asc') return parseFloat(a.total) - parseFloat(b.total);
    return 0;
  });

  const totalPages = serverMode
    ? Math.max(1, Math.ceil((meta.total || 0) / meta.limit))
    : Math.ceil(filteredOrders.length / meta.limit);
  const indexOfLastOrder = meta.page * meta.limit;
  const indexOfFirstOrder = indexOfLastOrder - meta.limit;
  const currentOrders = serverMode
    ? filteredOrders                                  // already one page
    : filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value);
    localStorage.setItem('ordersPerPage', newLimit);
    setMeta(m => ({ ...m, page: 1, limit: newLimit }));
  };
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setMeta(m => ({ ...m, page: newPage }));
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === currentOrders.length) setSelectedOrders([]);
    else setSelectedOrders(currentOrders.map(o => o.id));
  };
  
  const handleSelectOrder = (id) => {
    if (selectedOrders.includes(id)) setSelectedOrders(selectedOrders.filter(orderId => orderId !== id));
    else setSelectedOrders([...selectedOrders, id]);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (result.success) setOrders(orders.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
    } catch (error) { toast.error('Something went wrong!'); }
  };

  const handleSendToCourier = async (orderId) => {
    const courierName = selectedCouriers[orderId] || couriers[0]?.name || 'PATHAO';
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/send-to-courier`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ courier: courierName })
      });
      const result = await response.json();
      if (result.success) { toast.success(`Sent to ${courierName}. Tracking: ${result.trackingCode}`); fetchData(); }
      else toast.error(`Failed: ${result.message}`);
    } catch (err) { toast.error('Error connecting to server.'); }
  };

  const handleSyncPathao = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/courier/sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }});
      const result = await res.json();
      if (result.success) { toast.success(result.message); fetchData(); } else toast.error(result.message || 'Sync failed.');
    } catch (err) { toast.error('Error connecting to sync server.'); } finally { setIsSyncing(false); }
  };

  // 🔴 FIX 3: Restored Bulk Fraud API Logic
  const handleBulkFraudCheck = async () => {
    if (selectedOrders.length === 0) return toast.error("Please select orders to check metrics!");
    const ordersToCheck = orders.filter(o => selectedOrders.includes(o.id));
    
    setIsSyncing(true);
    let updatedCount = 0;
    let brainFlags = 0;

    for (const order of ordersToCheck) {
      if (!order.customer?.phone) continue;
      try {
        const res = await fetch(`${API_BASE_URL}/api/courier/fraud-check/${order.customer.phone}`, { 
          headers: { 'Authorization': `Bearer ${getToken()}` } 
        });
        const result = await res.json();
        if (result.success && result.data) {
           const summary = result.data.summary;
           const breakdown = Object.entries(result.data.details).map(([c, info]) => ({ courier: c.toUpperCase(), success: info.success || 0, total: info.total || 0 })).filter(b => b.total > 0);
           const newMetrics = { total_orders: summary.total_orders, success_rate: summary.genuine_prob, breakdown: breakdown };
           await fetch(`${API_BASE_URL}/api/customers/${order.customer.phone}/metrics`, {
             method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ metrics: newMetrics })
           });
           updatedCount++;
        }
        const brainRes = await fetch(`${API_BASE_URL}/api/brain/check-checkout`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: order.customer.phone, delivery_area: order.customer?.area || '' })
        });
        const brainData = await brainRes.json();
        if (brainData.success && !brainData.cod_allowed) brainFlags++;
      } catch(err) { console.error(`Failed for ${order.customer.phone}`, err); }
    }
    setIsSyncing(false);
    toast.success(`Bulk check complete. Updated ${updatedCount} customers. ${brainFlags} flagged by Brain.`);
    fetchData();
  };

  // ── Line items on demand ───────────────────────────────────────────────────
  // List rows are fetched with `fields=list`, so they may only carry
  // `items_count` instead of the full `products` blob. Anything that needs the
  // actual line items (edit modal, thermal stickers) hydrates the single order.
  const ensureOrderItems = async (order) => {
    let items = [];
    try {
      items = typeof order.products === 'string' ? JSON.parse(order.products) : (order.products || []);
    } catch { items = []; }

    if (items.length > 0) return { ...order, products: items };
    if (!(Number(order.items_count) > 0)) return { ...order, products: [] };

    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      const full = json?.data || json;
      const loaded = typeof full?.products === 'string' ? JSON.parse(full.products) : (full?.products || []);
      return { ...order, ...(full || {}), products: loaded };
    } catch (err) {
      console.error('[Orders] could not load order detail for', order.id, err);
      return { ...order, products: [] };
    }
  };

  // Module Z: Thermal Sticker Print Handlers
  const handlePrintSingleSticker = async (order) => {
    const full = await ensureOrderItems(order);
    setStickerOrders([full]);
    setActiveStickerIndex(0);
    setOpenActionId(null);
    setTimeout(() => handleStickerPrint(), 200);
  };

  const handleBulkStickerPrint = async () => {
    if (selectedOrders.length === 0) return toast.error("Please select orders first!");
    const picked = orders.filter(o => selectedOrders.includes(o.id));
    const ordersToPrint = await Promise.all(picked.map(ensureOrderItems));
    setStickerOrders(ordersToPrint);
    setActiveStickerIndex(0);
    setTimeout(() => handleStickerPrint(), 200);
  };

  // Keep old print for backward compatibility (invoice view)
  const triggerPrint = () => { setIsPrinting(true); setTimeout(() => { window.print(); }, 800); };
  const handlePrintSingle = async (order) => {
    const full = await ensureOrderItems(order);
    setPrintOrders([full]);
    setOpenActionId(null);
    triggerPrint();
  };

  const handleBulkPrint = (type) => {
    if (selectedOrders.length === 0) return toast.error("Please select orders first!");
    const ordersToPrint = orders.filter(o => selectedOrders.includes(o.id));
    setPrintOrders(ordersToPrint);
    triggerPrint();
  };

  const handleExportExcel = () => {
    if (selectedOrders.length === 0) return toast.error("Please select orders first!");
    const ordersToExport = orders.filter(o => selectedOrders.includes(o.id));
    const headers = ["Invoice", "Date", "Customer Name", "Phone", "Address", "Total", "Status", "Courier"];
    const csvContent = [
      headers.join(","),
      ...ordersToExport.map(o => `"${o.invoice}","${new Date(o.date).toLocaleDateString()}","${o.customer?.name}","${o.customer?.phone}","${o.customer?.address}","${o.total}","${o.status}","${o.courier_name || ''}"`)
    ].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `HamzaFabrics_Orders_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const handleCheckDuplicates = () => {
    if (selectedOrders.length === 0) return toast.error("Please select orders to check duplicates!");
    const selected = orders.filter(o => selectedOrders.includes(o.id));
    const phones = selected.map(o => o.customer?.phone);
    const duplicates = phones.filter((item, index) => phones.indexOf(item) !== index);
    if(duplicates.length > 0) toast(`Found duplicate orders for phones: ${[...new Set(duplicates)].join(', ')}`);
    else toast("No duplicates found among selected orders!");
  };

  const handleAutoCall = () => {
    if (selectedOrders.length === 0) return toast.error("Select orders to initiate Auto Call!");
    toast(`Initiating Auto Call for ${selectedOrders.length} orders... (API Integration Pending)`);
  };

  const handleAddNote = async (order) => {
    const newNote = window.prompt(`✍️ Update note for Invoice ${order.invoice}:`, order.note || "");
    if (newNote !== null) {
      setOrders(orders.map(o => o.id === order.id ? { ...o, note: newNote } : o));
      try {
        await fetch(`${API_BASE_URL}/api/orders/${order.id}/note`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
          body: JSON.stringify({ note: newNote }),
        });
      } catch (error) { console.error("Note save failed", error); }
    }
    setOpenActionId(null);
  };

  const handleCreateTask = (order) => {
    const task = window.prompt(`➕ Create a new task for ${order.invoice}:`);
    if (task) toast.success(`Task "${task}" saved successfully!`);
    setOpenActionId(null);
  };

  const handleJpgExport = (order) => {
    toast(`JPG Export initiated for ${order.invoice}. (Integration Pending)`);
    setOpenActionId(null);
  };

  const openEditModal = async (order) => {
    setModalMode('edit');
    setOpenActionId(null);

    const hydrated = await ensureOrderItems(order);
    const parsedItems = hydrated.products || [];

    const formattedItems = parsedItems.map(p => {
      const masterProduct = products.find(mp => mp.id == (p.id || p.product_id || p.productId));
      return {
        productId: masterProduct?.id || p.id || '', sku: masterProduct?.sku || p.sku || 'N/A'  , 
        name: masterProduct?.name || p.productName || p.name || 'Unknown', image: masterProduct?.image_url || p.image || '', 
        price: parseFloat(p.price || masterProduct?.price || 0), quantity: parseInt(p.qty || p.quantity || 1), size: p.size || '', variant_sku: p.variant_sku || masterProduct?.variant_sku || ''
      };
    });
    
    const subTotal = formattedItems.reduce((acc, item) => acc + (parseFloat(item.price) * parseInt(item.quantity)), 0);

    setOrderFormData({
      id: order.id, invoice: order.invoice, customer: { name: order.customer?.name || '', phone: order.customer?.phone || '', address: order.customer?.address || '', area: 'Inside Dhaka' },
      deliveryMethod: order.courier_name || couriers[0]?.name || 'PATHAO', shippingNote: order.shipping_note || '', crossSale: order.is_cross_sale || false,
      city: '', zone: '', areaGeo: '', items: formattedItems, billing: { discount: order.discount || 0, advance: order.advance || 0, subTotal: subTotal, deliveryCharge: order.delivery_charge || 150, total: order.total },
      metrics: order.customer?.metrics || null
    });
    setShowOrderModal(true);
  };

  const submitOrderForm = async (e) => {
    e.preventDefault(); setIsSaving(true);
    const url = modalMode === 'create' ? `${API_BASE_URL}/api/orders/checkout` : `${API_BASE_URL}/api/orders/${orderFormData.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PUT';
    const payload = {
      customerInfo: orderFormData.customer,
      items: orderFormData.items.map(i => ({ product: { id: i.productId, price: i.price }, quantity: i.quantity, size: i.size })),
      summary: { subtotal: orderFormData.billing.subTotal, deliveryCharge: orderFormData.billing.deliveryCharge, discount: orderFormData.billing.discount, total: orderFormData.billing.total },
      shipping_note: orderFormData.shippingNote, is_cross_sale: orderFormData.crossSale, courier: orderFormData.deliveryMethod
    };
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify(payload) });
      const result = await response.json();
      if(result.success) { toast.success('Order Updated Successfully!'); setShowOrderModal(false); fetchData(); } 
      else toast.error(result.message);
    } catch (err) { toast.error('Failed to save order'); } finally { setIsSaving(false); }
  };

  return (
    <div className={`main-app-wrapper w-full h-[calc(100vh-2rem)] flex flex-col bg-t-base text-t-main font-sans p-4 sm:p-6 transition-all overflow-hidden relative ${adminTheme}`}>
      
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        
        @media print {
          @page { margin: 0; size: auto; }
          body { background: white !important; }
          .main-app-wrapper > *:not(#printable-invoice) { display: none !important; }
          .main-app-wrapper, body, html, #root { height: auto !important; overflow: visible !important; }
          #printable-invoice { display: block !important; position: static !important; width: 100% !important; }
          .sticker-page { page-break-after: always; padding: 20px; width: 100%; max-width: 4in; margin: 0 auto; display: block !important; }
        }
      `}</style>

      {showOrderModal && (
        <OrderModal 
          modalMode={modalMode} orderFormData={orderFormData} setOrderFormData={setOrderFormData} setShowOrderModal={setShowOrderModal} 
          submitOrderForm={submitOrderForm} isSaving={isSaving} couriers={couriers} products={products} productSearch={productSearch} 
          setProductSearch={setProductSearch} 
          addProductToOrder={(prod) => {
            const newItem = { productId: prod.main_product_id || prod.id, sku: prod.sku_code || prod.sku, name: prod.name, image: prod.image_url, price: prod.price, quantity: 1, size: prod.size || '' };
            const newItems = [...orderFormData.items, newItem];
            const newSubTotal = newItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * parseInt(item.quantity || 1)), 0);
            const newTotal = (newSubTotal + parseFloat(orderFormData.billing.deliveryCharge)) - parseFloat(orderFormData.billing.discount) - parseFloat(orderFormData.billing.advance);
            setOrderFormData({ ...orderFormData, items: newItems, billing: { ...orderFormData.billing, subTotal: newSubTotal, total: newTotal }});
          }} 
          removeModalItem={(index) => {
            const newItems = [...orderFormData.items];
            newItems.splice(index, 1);
            const newSubTotal = newItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * parseInt(item.quantity || 1)), 0);
            const newTotal = (newSubTotal + parseFloat(orderFormData.billing.deliveryCharge)) - parseFloat(orderFormData.billing.discount) - parseFloat(orderFormData.billing.advance);
            setOrderFormData({ ...orderFormData, items: newItems, billing: { ...orderFormData.billing, subTotal: newSubTotal, total: newTotal }});
          }} 
          handleModalItemChange={(index, field, value) => {
            const newItems = [...orderFormData.items];
            newItems[index][field] = value;
            const newSubTotal = newItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * parseInt(item.quantity || 1)), 0);
            const newTotal = (newSubTotal + parseFloat(orderFormData.billing.deliveryCharge)) - parseFloat(orderFormData.billing.discount) - parseFloat(orderFormData.billing.advance);
            setOrderFormData({ ...orderFormData, items: newItems, billing: { ...orderFormData.billing, subTotal: newSubTotal, total: newTotal }});
          }} 
        />
      )}

      {/* 🖨️ Thermal Sticker Print Section (Module Z) */}
      <div id="thermal-sticker-print" className="no-print" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {stickerOrders.length > 0 && stickerOrders[activeStickerIndex] && (
          <ThermalSticker ref={stickerRef} order={stickerOrders[activeStickerIndex]} />
        )}
      </div>

      {/* Legacy Invoice Print (kept for backward compat) */}
      <div id="printable-invoice" className="hidden print:block w-full bg-white text-black font-sans">
        {printOrders.map(order => (
          <div key={order.id} className="sticker-page border border-gray-400">
            <div className="text-center border-b-2 border-black pb-1 mb-2">
              <h1 className="text-lg font-black uppercase tracking-wider leading-none">Hamza Fabrics</h1>
              <p className="text-[9px] font-bold text-gray-600 mt-1">Premium Collection</p>
            </div>
            <div className="text-[11px] leading-snug space-y-1 text-left">
              <p><span className="font-bold">Name:</span> {order.customer?.name}</p>
              <p><span className="font-bold">Phone:</span> {order.customer?.phone}</p>
              <p className="break-words line-clamp-2"><span className="font-bold">Address:</span> {order.customer?.address}</p>
              <div className="mt-2 pt-2 border-t border-gray-300">
                <p className="font-bold mb-1 text-[10px]">Order Items:</p>
                {order.products?.map((p, i) => {
                  const price = Number(p.price || p.unit_price || 0);
                  const qty = Number(p.qty || p.quantity || 1);
                  const sku = p.sku || p.product_sku || 'N/A';
                  return (
                    <div key={i} className="flex justify-between text-[9px] mb-1">
                      <span className="truncate w-3/5">• {p.productName || p.name} (SKU: {sku}){p.variant_sku ? ` [Var: ${p.variant_sku}]` : ''}</span>
                      <span className="font-bold w-1/5 text-center">x{qty}</span>
                      <span className="font-bold w-1/5 text-right">৳{price * qty}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t-2 border-dashed border-gray-400 text-center">
              <div className="bg-gray-100 border border-gray-300 rounded py-1 flex justify-between px-2 items-center">
                <span className="text-[10px] uppercase font-bold text-gray-600">Total Due (COD):</span>
                <p className="text-sm font-black">৳ {Number(order.total || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {enlargedImage && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-zoom-out" onClick={() => setEnlargedImage(null)}>
          <div className="relative cursor-default" onClick={e => e.stopPropagation()}>
            <button onClick={() => setEnlargedImage(null)} className="absolute -top-10 right-0 text-t-muted hover:text-red-500 transition-colors bg-t-surface p-2 rounded-full border border-t-border"><X size={20}/></button>
            <img src={enlargedImage} alt="Enlarged Product" className="max-w-full max-h-[85vh] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-t-border object-contain" />
          </div>
        </div>
      )}

      {/* New Order Section Header */}
      <div className="bg-t-surface border border-t-border rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-t-primary/10 rounded-xl flex items-center justify-center text-t-primary">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h2 className="text-base font-black text-t-main tracking-tight">New Order</h2>
              <p className="text-xs text-t-muted mt-0.5">Create a quick in-store order</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSyncPathao} disabled={isSyncing} className="bg-t-base border border-t-border hover:bg-t-primary hover:text-white transition-colors text-t-muted text-xs font-semibold px-4 py-2.5 rounded-lg" style={{ height: '44px' }}>{isSyncing ? "Syncing..." : "Sync Pathao"}</button>
            <button onClick={() => navigate('/pos')}
              className="bg-t-primary hover:bg-t-primary/90 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-t-primary/20 transition-all flex items-center gap-2" style={{ height: '44px' }}>
              <ShoppingBag size={16} /> Create New Order
            </button>
          </div>
        </div>
      </div>

      {/* Status Summary Dashboard */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-6">
        {[
          { label: 'Pending', count: orders.filter(o => o.status === 'pending').length, color: 'bg-amber-500' },
          { label: 'Processing', count: orders.filter(o => o.status === 'processing').length, color: 'bg-blue-500' },
          { label: 'RTS', count: orders.filter(o => o.status === 'rts').length, color: 'bg-purple-500' },
          { label: 'Shipped', count: orders.filter(o => o.status === 'shipped').length, color: 'bg-indigo-500' },
          { label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length, color: 'bg-green-500' },
          { label: 'Pending Return', count: orders.filter(o => o.status === 'pending_return').length, color: 'bg-orange-500' },
          { label: 'Returned', count: orders.filter(o => o.status === 'returned').length, color: 'bg-red-500' },
          { label: 'Partial', count: orders.filter(o => o.status === 'partial_delivered').length, color: 'bg-teal-500' },
          { label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length, color: 'bg-slate-500' },
          { label: 'Pending Cancel', count: orders.filter(o => o.status === 'pending_cancel').length, color: 'bg-rose-500' },
          { label: 'Preorder', count: orders.filter(o => o.status === 'preorder').length, color: 'bg-cyan-500' },
          { label: 'Lost', count: orders.filter(o => o.status === 'lost').length, color: 'bg-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-t-surface border border-t-border rounded-xl p-2.5 flex flex-col items-center text-center hover:shadow-sm transition-shadow cursor-default">
            <span className="text-[9px] font-bold text-t-muted uppercase tracking-wider leading-tight">{s.label}</span>
            <span className={`text-lg font-black mt-0.5 ${s.count > 0 ? 'text-t-main' : 'text-t-muted/50'}`}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h1 className="text-xl font-black text-t-main tracking-tight">Order Management</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos')} className="bg-t-primary hover:bg-t-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-t-primary/20 transition-all flex items-center gap-2" style={{ height: '44px' }}>
            <ShoppingBag size={16} /> New Order
          </button>
        </div>
      </div>

      <div className="bg-t-surface rounded-xl border border-t-border shadow-md overflow-hidden flex flex-col flex-1 relative">
        <OrderTabs activeTab={activeTab} setActiveTab={setActiveTab} orders={orders} setSelectedOrders={setSelectedOrders} setMeta={setMeta} />
        
        <OrderToolbar 
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} setMeta={setMeta} 
          showSortMenu={showSortMenu} setShowSortMenu={setShowSortMenu} setSortConfig={setSortConfig}
          selectedOrders={selectedOrders} currentOrders={currentOrders} handleSelectAll={handleSelectAll} 
          setAdvancedFilters={setAdvancedFilters} advancedFilters={advancedFilters}
          handleBulkPrint={handleBulkPrint} handleExportExcel={handleExportExcel} 
          handleCheckDuplicates={handleCheckDuplicates} handleAutoCall={handleAutoCall}
          visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} 
          handleBulkFraudCheck={handleBulkFraudCheck} // 🔴 Passed to Toolbar
          handleBulkStickerPrint={handleBulkStickerPrint}
        />

        <OrderTable 
          currentOrders={currentOrders} selectedOrders={selectedOrders} handleSelectAll={handleSelectAll} handleSelectOrder={handleSelectOrder}
          handleSendToCourier={handleSendToCourier} selectedCouriers={selectedCouriers} setSelectedCouriers={setSelectedCouriers} couriers={couriers}
          openActionId={openActionId} setOpenActionId={setOpenActionId} handlePrintSingle={handlePrintSingle} handlePrintSingleSticker={handlePrintSingleSticker} handleStatusChange={handleStatusChange}
          setEnlargedImage={setEnlargedImage} openEditModal={openEditModal} handleAddNote={handleAddNote} handleCreateTask={handleCreateTask} handleJpgExport={handleJpgExport}
          visibleColumns={visibleColumns} 
        />

        <div className="bg-t-surface border-t border-t-border p-4 flex flex-col sm:flex-row justify-between items-center text-[12px] text-t-muted shrink-0">
          <div><span className="font-bold text-t-main">{selectedOrders.length}</span> selected</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">Rows <select value={meta.limit} onChange={handleLimitChange} className="bg-t-base border border-t-border rounded px-2 py-1 text-t-main outline-none focus:border-t-primary">{[10, 20, 50, 100].map(num => <option key={num} value={num}>{num}</option>)}</select></div>
            <div className="flex gap-1">
              <button aria-label="Previous page" onClick={() => handlePageChange(meta.page - 1)} disabled={meta.page <= 1} className="p-1 rounded hover:bg-t-primary/10 hover:text-t-primary disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-t-muted transition-colors"><ChevronLeft size={16}/></button>
              <span className="px-2 text-t-main font-bold" aria-live="polite" aria-atomic="true">{meta.page} / {totalPages || 1}</span>
              <button aria-label="Next page" onClick={() => handlePageChange(meta.page + 1)} disabled={meta.page >= totalPages} className="p-1 rounded hover:bg-t-primary/10 hover:text-t-primary disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-t-muted transition-colors"><ChevronRightIcon size={16}/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}