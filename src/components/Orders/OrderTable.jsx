import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { 
  MoreVertical, ExternalLink, Printer, Image as ImageIcon, 
  Edit, Box, X, StickyNote, Plus, Check, RefreshCw, 
  AlertCircle, Loader2, PhoneCall, Phone, MessageCircle, MapPin, 
  FileText, User, Tag, ShoppingBag, Clock, Copy
} from 'lucide-react';

import { ThemeContext } from '../../context/ThemeContext'; 
import API_BASE_URL from '../../config/api';
import { thumbUrl, srcSet, IMAGE_PLACEHOLDER } from '../../utils/imageUrl';
import toast from 'react-hot-toast';

export default function OrderTable({
  currentOrders, selectedOrders, handleSelectAll, handleSelectOrder, 
  handleSendToCourier, selectedCouriers, setSelectedCouriers, couriers,
  openActionId, setOpenActionId, handlePrintSingle, handlePrintSingleSticker, handleStatusChange, setEnlargedImage,
  openEditModal, handleAddNote, handleCreateTask, handleJpgExport,
  visibleColumns
}) {
  const { adminTheme, isAdminDark } = useContext(ThemeContext); 
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [fetchingPhone, setFetchingPhone] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState({});
  const [brainFlags, setBrainFlags] = useState({});

  const timeAgo = (date) => {
    if (!date) return 'Unknown';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return "Just now";
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return { date: 'N/A', time: '' };
    const d = new Date(dateString);
    return { date: d.toLocaleDateString('en-GB'), time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) };
  };

  const getTrackingUrl = (courierName, trackingCode) => {
    if (!courierName || !trackingCode) return '#';
    const name = courierName.toLowerCase();
    if (name.includes('pathao')) return `https://merchant.pathao.com/tracking?consignment_id=${trackingCode}`;
    if (name.includes('steadfast')) return `https://steadfast.com.bd/t/${trackingCode}`;
    if (name.includes('redx')) return `https://redx.com.bd/track-trace/?trackingId=${trackingCode}`;
    return '#'; 
  };

  const fetchLiveFraudData = async (orderId, phone, deliveryArea) => {
    if(!phone) return toast.error("No phone number found!");
    setFetchingPhone(orderId);
    try {
      const token = localStorage.getItem('adminToken');
      const [fraudRes, brainRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/courier/fraud-check/${phone}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/brain/check-checkout`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: `+88${phone.replace(/[^0-9]/g, '')}`, delivery_area: deliveryArea || '' })
        })
      ]);
      const result = await fraudRes.json();
      const brainData = await brainRes.json();
      
      if(brainData.success && !brainData.cod_allowed) {
        setBrainFlags(prev => ({ ...prev, [orderId]: brainData }));
      } else {
        setBrainFlags(prev => ({ ...prev, [orderId]: null }));
      }

      if(result.success && result.data) {
         const summary = result.data.summary;
         const details = result.data.details;
         const breakdown = Object.entries(details).map(([c, info]) => ({ courier: c.toUpperCase(), success: info.success || 0, total: info.total || 0 })).filter(b => b.total > 0);
         const newMetrics = { total_orders: summary.total_orders, success_rate: summary.genuine_prob, breakdown: breakdown };
         setLiveMetrics(prev => ({ ...prev, [orderId]: newMetrics }));
         try {
           await fetch(`${API_BASE_URL}/api/customers/${phone}/metrics`, {
             method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ metrics: newMetrics })
           });
         } catch(saveErr) { console.log("Auto-save failed", saveErr); }
      } else { 
         setLiveMetrics(prev => ({ ...prev, [orderId]: { total_orders: 0, success_rate: 0 } }));
         toast.error("No data found in couriers!"); 
      }
    } catch(err) { toast.error("Failed to fetch live rating."); } finally { setFetchingPhone(null); }
  };

  return (
    <div className={`flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar pb-32 ${adminTheme} bg-transparent text-t-main`}>
      <table className="w-full text-left border-collapse min-w-[1200px]">
        <thead className="bg-t-surface backdrop-blur-md sticky top-0 z-20 border-b border-t-border shadow-sm">
          <tr>
            <th className="p-4 w-12 text-center border-r border-t-border align-middle"><input type="checkbox" className="accent-t-primary w-4 h-4 cursor-pointer" onChange={handleSelectAll} checked={currentOrders.length > 0 && selectedOrders.length === currentOrders.filter(o => !o.tracking_code).length} /></th>
            {visibleColumns.dateInvoice && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border align-middle">Date & Invoice</th>}
            {visibleColumns.customer && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest min-w-[280px] max-w-[350px] border-r border-t-border align-middle">Customer</th>}
            {visibleColumns.repeat && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap text-center border-r border-t-border align-middle">Repeat</th>}
            {visibleColumns.note && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest min-w-[200px] border-r border-t-border align-middle">Note</th>}
            {visibleColumns.products && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest min-w-[350px] border-r border-t-border align-middle">Products</th>}
            {visibleColumns.tags && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border align-middle">Tags</th>}
            {visibleColumns.status && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border align-middle">Status</th>}
            {visibleColumns.print && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap text-center border-r border-t-border align-middle">Print</th>}
            {visibleColumns.total && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border align-middle">Total</th>}
            {visibleColumns.upload && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border align-middle">Upload</th>}
            {visibleColumns.crossSale && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap text-center border-r border-t-border align-middle">Cross Sale</th>}
            {visibleColumns.userSource && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border align-middle">User & Source</th>}
            {visibleColumns.shippingNote && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest min-w-[200px] border-r border-t-border align-middle">Shipping Note</th>}
            {visibleColumns.attachments && <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border align-middle">Attachments</th>}
            <th className="py-4 px-4 text-[11px] font-bold text-t-muted uppercase tracking-widest text-right w-24 sticky right-0 bg-t-surface/90 shadow-[-10px_0_15px_rgba(0,0,0,0.05)] z-30 align-middle">Actions</th>
          </tr>
        </thead>
        
        <tbody className="divide-y divide-t-border">
          {currentOrders.map((order) => {
            const dateTime = formatDateTime(order.date); 
            const items = order.products || []; 
            const orderTags = order.tags || [];
            
            let baseMetrics = order.customer?.metrics;
            if (typeof baseMetrics === 'string') {
              try { baseMetrics = JSON.parse(baseMetrics); } catch(e) { baseMetrics = null; }
            }
            
            const displayMetrics = liveMetrics[order.id] || baseMetrics || {};
            let sRate = displayMetrics.success_rate ?? displayMetrics.genuine_prob ?? null;
            if (sRate !== null) sRate = Number(sRate);

            const isDropdownOpen = openActionId === order.id;
            const displayedProducts = items.slice(0, 1);
            const remainingProductsCount = items.length - 1;

            return (
              <tr key={order.id} className={`hover:bg-t-primary/5 transition-colors duration-200 ${isDropdownOpen ? 'relative z-[50]' : 'relative z-0'}`}>
                
                <td className="p-4 text-center border-r border-t-border align-middle">
                  <input type="checkbox" className="accent-t-primary w-4 h-4 cursor-pointer" checked={selectedOrders.includes(order.id)} onChange={() => handleSelectOrder(order.id)} disabled={order.tracking_code} />
                </td>
                
                {visibleColumns.dateInvoice && (
                  <td className="py-4 px-4 align-middle border-r border-t-border whitespace-nowrap">
                    <div className="flex items-start gap-4">
                      <div>
                        <div className="text-[13px] font-bold flex items-center gap-1.5"><Clock size={12} className="opacity-70"/> {dateTime.date}</div>
                        <div className="text-[11px] font-medium opacity-70 mt-0.5 text-t-muted">{dateTime.time}</div>
                        <div className="text-[9px] font-bold text-t-primary mt-1 italic">Updated {timeAgo(order.updated_at || order.date)}</div>
                      </div>
                      <div className="pl-3 border-l border-t-border">
                        <span className="text-[14px] font-black text-blue-500">{order.invoice || '-'}</span>
                      </div>
                    </div>
                  </td>
                )}

                {visibleColumns.customer && (
                  <td className="py-4 px-4 align-middle border-r border-t-border min-w-[250px]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-t-main">
                        <User size={14} className="opacity-70"/>
                        {order.customer?.name || 'N/A'}
                        <Copy size={12} className="opacity-50 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(order.customer?.name)} />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="opacity-70 text-t-muted"/> 
                        <span className="text-[12px] font-mono text-t-main">{order.customer?.phone || 'N/A'}</span>
                        
                        {sRate !== null ? (
                          <span className={`text-[11px] font-black px-1.5 rounded ${sRate >= 80 ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
                            {sRate}%
                          </span>
                        ) : (
                          <button onClick={() => fetchLiveFraudData(order.id, order.customer?.phone, order.delivery_area)} disabled={fetchingPhone === order.id} className="text-[10px] bg-t-primary/10 text-t-primary px-1.5 py-0.5 rounded font-bold disabled:opacity-50 transition-colors">
                            {fetchingPhone === order.id ? '...' : 'Check'}
                          </button>
                        )}
                        {brainFlags[order.id] && (
                          <span title={brainFlags[order.id].reason} className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-600 ml-1 cursor-help">BRAIN</span>
                        )}
                        
                        <a href={`tel:${order.customer?.phone || ''}`} className="text-blue-500 hover:text-blue-400 ml-1 transition-colors"><PhoneCall size={12} /></a>
                        <a href={`https://wa.me/${(order.customer?.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-600 transition-colors"><MessageCircle size={12} /></a>
                      </div>
                      
                      <div className="flex items-start gap-2 text-t-muted mt-0.5">
                        <MapPin size={12} className="mt-0.5 text-t-primary shrink-0"/>
                        <span className="text-[11px] opacity-80 leading-relaxed line-clamp-2">{order.customer?.address || '-'}</span>
                      </div>
                    </div>
                  </td>
                )}

                {visibleColumns.repeat && (
                  <td className="py-4 px-4 align-middle text-center border-r border-t-border">
                    {orderTags.includes('REPEAT_CUSTOMER') ? <span className="bg-purple-500/10 text-purple-500 text-[10px] font-black uppercase px-2.5 py-1 rounded-md border border-purple-500/20">Yes</span> : <span className="opacity-50 text-[10px] text-t-muted">-</span>}
                  </td>
                )}

                {visibleColumns.note && (
                  <td className="py-4 px-4 align-middle border-r border-t-border min-w-[200px]">
                    <p className="text-[11px] opacity-70 leading-tight text-t-main"><StickyNote size={12} className="inline mr-1 opacity-50"/>{order.note || 'No notes.'}</p>
                  </td>
                )}

                {visibleColumns.products && (
                  <td className="py-4 px-4 align-middle border-r border-t-border min-w-[350px]">
                    <div className="space-y-3">
                      {/* List payloads may omit the line-item blob entirely (fields=list).
                          Fall back to the server-side count instead of rendering nothing. */}
                      {displayedProducts.length === 0 && Number(order.items_count) > 0 && (
                        <div className="flex items-center gap-2 text-t-muted">
                          <ShoppingBag size={14} className="opacity-60" />
                          <span className="text-[12px] font-bold text-t-main">
                            {order.items_count} item{Number(order.items_count) === 1 ? '' : 's'}
                          </span>
                          <span className="text-[10px] opacity-60">— open the order to view lines</span>
                        </div>
                      )}
                      {displayedProducts.map((prod, i) => {
                        const skuRaw = prod.sku_code || prod.sku;
                        const skuDisplay = (!skuRaw || String(skuRaw) === 'NaN' || String(skuRaw) === 'undefined') ? 'N/A' : skuRaw;
                        
                        return (
                          <div key={i} className="flex gap-3 items-center">
                            <div className="relative shrink-0">
                               <img src={thumbUrl(prod.image, 80) || IMAGE_PLACEHOLDER} srcSet={srcSet(prod.image, [80, 160])} sizes="40px" alt="" loading="lazy" decoding="async" width="40" height="40" className="w-10 h-10 rounded-md border border-t-border object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setEnlargedImage(prod.image)} />
                               <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-t-surface ${order.status === 'pending' ? 'bg-orange-500' : order.status === 'rts' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                            </div>
                            <div className="flex-1 flex justify-between items-center gap-4 text-t-main">
                               <div>
                                  <div className="text-[12px] font-aeonik-bold line-clamp-1">{prod.productName || prod.name || 'Unknown Product'}</div>
                                  <div className="text-[10px] opacity-70 mt-0.5 font-mono text-t-muted flex items-center flex-wrap">
                                     SKU: {skuDisplay}
                                      {prod.selected_size && (
                                        <span className="ml-2 text-[10px] text-t-muted">Var SKU: {skuDisplay}-{prod.selected_size.toUpperCase().replace(/\s+/g, '')}</span>
                                      )}
                                 </div>
                               </div>
                               <div className="text-right">
                                 <span className="text-[11px] font-black bg-t-base px-2 py-1 rounded-md border border-t-border">Qty: {prod.qty || 1}</span>
                               </div>
                            </div>
                          </div>
                        )
                      })}
                      {remainingProductsCount > 0 && (
                        <div className="text-[10px] font-bold text-blue-500 mt-2 flex items-center gap-1 cursor-pointer hover:underline">
                          <ShoppingBag size={12}/> + {remainingProductsCount} more product(s)
                        </div>
                      )}
                    </div>
                  </td>
                )}

                {visibleColumns.tags && (
                  <td className="py-4 px-4 align-middle border-r border-t-border whitespace-nowrap">
                    <div className="flex flex-col gap-1.5 w-32">
                      {orderTags.length > 0 ? orderTags.map((t, i) => <span key={i} className="bg-t-base opacity-80 text-[9px] px-2 py-1 rounded-md border border-t-border flex items-center gap-1 text-t-main"><Tag size={8} className="opacity-50 text-t-muted"/>{t}</span>) : <span className="opacity-50 text-xs text-t-muted">-</span>}
                    </div>
                  </td>
                )}

                {visibleColumns.status && (
                  <td className="py-4 px-4 align-middle border-r border-t-border whitespace-nowrap">
                     <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold uppercase px-3 py-1.5 rounded-md w-max inline-block shadow-sm">
                       {order.status}
                     </span>
                  </td>
                )}

                {visibleColumns.print && (
                  <td className="py-4 px-4 align-middle text-center border-r border-t-border">
                    {order.is_printed ? <Check size={18} className="text-green-500 mx-auto" /> : <span className="opacity-50 text-t-muted">-</span>}
                  </td>
                )}

                {visibleColumns.total && (
                  <td className="py-4 px-4 align-middle border-r border-t-border whitespace-nowrap">
                    <div className="text-[14px] font-black font-mono text-t-main">৳ {Number(order.total || 0).toFixed(2)}</div>
                    <div className="text-[9px] uppercase font-bold mt-1 opacity-50 text-t-muted">COD</div>
                  </td>
                )}

                {visibleColumns.upload && (
                  <td className="py-4 px-4 align-middle border-r border-t-border whitespace-nowrap">
                    {!order.tracking_code ? (
                      <div className="flex flex-col gap-2">
                        <select value={selectedCouriers[order.id] || ''} onChange={(e) => setSelectedCouriers({...selectedCouriers, [order.id]: e.target.value})} className="bg-t-base border border-t-border text-t-main text-[10px] rounded-md px-2 py-1.5 outline-none w-28 focus:border-t-primary transition-colors">
                          {couriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <button onClick={() => handleSendToCourier(order.id)} disabled={couriers.length === 0} className="w-28 bg-t-primary hover:opacity-90 text-white text-[10px] uppercase font-bold px-3 py-1.5 rounded-md transition-colors shadow-sm flex items-center justify-center gap-1.5">
                          <Box size={12}/> Send
                        </button>
                      </div>
                    ) : (
                      <div className="bg-t-base border border-t-border p-2 rounded-lg inline-block shadow-inner">
                        <p className="text-[9px] font-bold opacity-50 uppercase mb-1 text-t-muted">Tracking ID</p>
                        <a href={getTrackingUrl('Pathao', order.tracking_code)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono font-bold text-blue-500 hover:underline flex items-center gap-1.5">
                          {order.tracking_code} <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </td>
                )}

                {visibleColumns.crossSale && (
                  <td className="py-4 px-4 align-middle text-center border-r border-t-border">
                    {order.is_cross_sale ? <span className="text-green-500 text-[10px] font-bold border border-green-500/20 bg-green-500/10 px-2 py-0.5 rounded-md">Yes</span> : <span className="opacity-50 text-t-muted">-</span>}
                  </td>
                )}

                {visibleColumns.userSource && (
                  <td className="py-4 px-4 align-middle border-r border-t-border">
                    <div className="text-[11px] font-bold mb-1 flex items-center gap-1.5 text-t-main"><User size={10} className="opacity-50"/> {order.processed_by || 'System'}</div>
                    <span className="text-[9px] border border-t-border bg-t-base text-t-muted px-2 py-0.5 rounded-md uppercase font-bold opacity-70 mt-1 inline-block">{order.source || 'Website'}</span>
                  </td>
                )}

                {visibleColumns.shippingNote && (
                  <td className="py-4 px-4 align-middle border-r border-t-border min-w-[200px]">
                    <p className="text-[10px] opacity-70 line-clamp-2 leading-relaxed text-t-main"><FileText size={10} className="inline mr-1 opacity-50"/>{order.shipping_note || '-'}</p>
                  </td>
                )}

                {visibleColumns.attachments && (
                  <td className="py-4 px-4 align-middle border-r border-t-border">
                    {order.attachments?.length > 0 ? <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-500 px-2.5 py-1 rounded-md flex items-center gap-1 w-max"><ImageIcon size={10}/> {order.attachments.length} files</span> : <span className="opacity-50 text-t-muted">-</span>}
                  </td>
                )}

                <td className="py-4 px-4 align-middle text-right sticky right-0 bg-t-surface/90 shadow-[-10px_0_15px_rgba(0,0,0,0.05)] z-30">
                  <button aria-label={`Actions for order ${order.invoice || order.id}`} aria-haspopup="true" aria-expanded={isDropdownOpen} onClick={(e) => { e.stopPropagation(); setOpenActionId(isDropdownOpen ? null : order.id); setActiveTooltip(null); }} className="p-2 rounded-lg hover:bg-t-base transition-colors border border-transparent hover:border-t-border text-t-main">
                    <MoreVertical size={16} />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-8 top-full mt-1 w-52 bg-t-surface border border-t-border rounded-xl shadow-2xl z-[9999] py-1.5 flex flex-col overflow-hidden text-[12px] font-bold text-left text-t-main">
                      
                      <button onClick={() => openEditModal(order)} className="px-4 py-2 hover:bg-t-primary/10 flex items-center justify-between text-blue-500 w-full transition-colors">
                        <span className="flex items-center gap-2.5"><FileText size={14}/> Order Details</span><ExternalLink size={12}/>
                      </button>
                      <button onClick={() => handlePrintSingle(order)} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><Printer size={14}/> Print</button>
                      <button onClick={() => handlePrintSingleSticker(order)} className="px-4 py-2 hover:bg-t-primary/10 flex items-center gap-2.5 w-full transition-colors text-t-primary"><Box size={14}/> Print Sticker</button>
                      <button onClick={() => handleJpgExport(order)} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><ImageIcon size={14}/> JPG Export</button>
                      
                      {['pending', 'processing', 'rts', 'shipped'].includes(order.status) && (
                        <button onClick={() => openEditModal(order)} className="px-4 py-2 hover:bg-t-base flex items-center justify-between w-full transition-colors">
                          <span className="flex items-center gap-2.5"><Edit size={14}/> Edit</span><Edit size={12} className="opacity-50"/>
                        </button>
                      )}

                      <div className="h-px bg-t-border my-1 mx-2"></div>

                      {order.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatusChange(order.id, 'processing')} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><RefreshCw size={14}/> Send to Processing</button>
                          <button onClick={() => handleStatusChange(order.id, 'rts')} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><Box size={14}/> Send to RTS</button>
                          <button onClick={() => handleStatusChange(order.id, 'cancelled')} className="px-4 py-2 hover:bg-red-500/10 text-red-500 flex items-center gap-2.5 w-full transition-colors"><X size={14}/> Cancel</button>
                        </>
                      )}

                      {order.status === 'processing' && (
                        <>
                          <button onClick={() => handleStatusChange(order.id, 'pending')} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><Clock size={14}/> Send to Pending</button>
                          <button onClick={() => handleStatusChange(order.id, 'rts')} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><Box size={14}/> Send to RTS</button>
                          <button onClick={() => handleStatusChange(order.id, 'cancelled')} className="px-4 py-2 hover:bg-red-500/10 text-red-500 flex items-center gap-2.5 w-full transition-colors"><X size={14}/> Cancel</button>
                        </>
                      )}

                      {order.status === 'rts' && (
                        <>
                          <button onClick={() => handleStatusChange(order.id, 'pending')} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><Clock size={14}/> Send to Pending</button>
                          <button onClick={() => handleStatusChange(order.id, 'processing')} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><RefreshCw size={14}/> Send to Processing</button>
                          <button onClick={() => handleStatusChange(order.id, 'cancelled')} className="px-4 py-2 hover:bg-red-500/10 text-red-500 flex items-center gap-2.5 w-full transition-colors"><X size={14}/> Cancel</button>
                        </>
                      )}

                      {['shipped', 'pending_return', 'partial', 'pending_cancel'].includes(order.status) && (
                        <>
                          <button onClick={() => handleStatusChange(order.id, 'delivered')} className="px-4 py-2 hover:bg-green-500/10 text-green-500 flex items-center gap-2.5 w-full transition-colors"><Check size={14}/> Mark as Delivered</button>
                          <button onClick={() => handleStatusChange(order.id, 'returned')} className="px-4 py-2 hover:bg-t-primary/10 text-t-primary flex items-center gap-2.5 w-full transition-colors"><RefreshCw size={14}/> Return</button>
                          {order.status === 'pending_cancel' && (
                             <button onClick={() => handleStatusChange(order.id, 'cancelled')} className="px-4 py-2 hover:bg-red-500/10 text-red-500 flex items-center gap-2.5 w-full transition-colors"><X size={14}/> Cancel</button>
                          )}
                        </>
                      )}

                      <div className="h-px bg-t-border my-1 mx-2"></div>

                      <button onClick={() => handleCreateTask(order)} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><Plus size={14}/> Create Task</button>
                      {['pending', 'processing', 'rts', 'shipped', 'delivered', 'pending_return', 'returned', 'partial', 'cancelled', 'pending_cancel'].includes(order.status) && (
                        <button onClick={() => handleAddNote(order)} className="px-4 py-2 hover:bg-t-base flex items-center gap-2.5 w-full transition-colors"><StickyNote size={14}/> Add Note</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
}

OrderTable.propTypes = {
  currentOrders: PropTypes.array.isRequired,
  selectedOrders: PropTypes.array.isRequired,
  handleSelectAll: PropTypes.func.isRequired,
  handleSelectOrder: PropTypes.func.isRequired,
  handleSendToCourier: PropTypes.func.isRequired,
  selectedCouriers: PropTypes.object.isRequired,
  setSelectedCouriers: PropTypes.func.isRequired,
  couriers: PropTypes.array.isRequired,
  openActionId: PropTypes.any,
  setOpenActionId: PropTypes.func.isRequired,
  handlePrintSingle: PropTypes.func.isRequired,
  handlePrintSingleSticker: PropTypes.func.isRequired,
  handleStatusChange: PropTypes.func.isRequired,
  setEnlargedImage: PropTypes.func.isRequired,
  openEditModal: PropTypes.func.isRequired,
  handleAddNote: PropTypes.func.isRequired,
  handleCreateTask: PropTypes.func.isRequired,
  handleJpgExport: PropTypes.func.isRequired,
  visibleColumns: PropTypes.object.isRequired,
};