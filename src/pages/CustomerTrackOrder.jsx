import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending', icon: '🕐' },
  { key: 'processing', label: 'Processing', icon: '⚙️' },
  { key: 'shipped', label: 'Shipped', icon: '📦' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

const statusOrder = ['pending', 'processing', 'shipped', 'delivered', 'rts', 'preorder', 'cancelled', 'returned', 'partial', 'lost'];

const getStepIndex = (status) => {
  const idx = statusOrder.indexOf(status);
  if (idx === -1) return 0;
  if (['cancelled', 'returned', 'lost'].includes(status)) return -1;
  const map = { pending: 0, preorder: 0, processing: 1, rts: 1, shipped: 2, delivered: 3 };
  return map[status] ?? 0;
};

export default function CustomerTrackOrder() {
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  const [searchParams] = useSearchParams();
  const [orderCode, setOrderCode] = useState(searchParams.get('code') || '');
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setOrderCode(code);
      handleTrack(code);
    }
  }, []);

  const handleTrack = async (code) => {
    const orderCodeValue = code || orderCode;
    if (!orderCodeValue.trim()) return toast.error('Please enter an order code.');

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/track/${encodeURIComponent(orderCodeValue.trim())}`);
      const data = await res.json();
      if (data.success) {
        setTrackingData(data.data);
      } else {
        setTrackingData(null);
        toast.error(data.message || 'Order not found.');
      }
    } catch {
      setTrackingData(null);
      toast.error('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTrack();
  };

  return (
    <div className={`min-h-screen bg-t-base text-t-main font-sans transition-colors duration-300 ${shopTheme}`}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-black uppercase tracking-widest text-center mb-2">Track Your Order</h1>
        <p className="text-center text-t-muted text-sm mb-8">Enter your order code to see real-time delivery status</p>

        <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-12">
          <div className="flex gap-3">
            <input
              type="text"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              placeholder="e.g. HF-123456"
              aria-label="Order code"
              className="flex-1 border border-t-border bg-t-surface text-t-main rounded-xl px-4 py-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold text-center uppercase tracking-wider"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-t-primary text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? '...' : 'Track'}
            </button>
          </div>
        </form>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-t-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && searched && !trackingData && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">🔍</p>
            <h2 className="text-xl font-bold text-t-muted">No order found with that code</h2>
            <p className="text-t-muted text-sm mt-2">Please double-check your order code and try again.</p>
          </div>
        )}

        {!loading && trackingData && (
          <div className="space-y-8">
            <div className="bg-t-surface border border-t-border rounded-2xl p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-bold text-t-muted uppercase tracking-widest">Order Code</p>
                  <p className="text-2xl font-black text-t-primary tracking-wider">{trackingData.order_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-t-muted uppercase tracking-widest">Status</p>
                  <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase ${
                    trackingData.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    trackingData.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    trackingData.status === 'returned' ? 'bg-gray-100 text-gray-800' :
                    trackingData.status === 'processing' || trackingData.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {trackingData.status}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-bold text-t-muted uppercase tracking-widest mb-1">Order Date</p>
                <p className="font-semibold">{new Date(trackingData.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              {trackingData.courier_name && (
                <div className="bg-t-base rounded-xl p-4 mb-6">
                  <p className="text-xs font-bold text-t-muted uppercase tracking-widest mb-1">Courier</p>
                  <p className="font-bold text-t-main">{trackingData.courier_name}</p>
                  {trackingData.tracking_code && (
                    <>
                      <p className="text-xs font-bold text-t-muted uppercase tracking-widest mt-2 mb-1">Tracking ID</p>
                      <p className="font-mono font-bold text-t-primary">{trackingData.tracking_code}</p>
                    </>
                  )}
                  {trackingData.courier_status && (
                    <>
                      <p className="text-xs font-bold text-t-muted uppercase tracking-widest mt-2 mb-1">Courier Status</p>
                      <p className="font-semibold">{trackingData.courier_status}</p>
                    </>
                  )}
                  {trackingData.courier_tracking_url && (
                    <a
                      href={trackingData.courier_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 text-sm font-bold text-t-primary hover:underline"
                    >
                      Track on {trackingData.courier_name} →
                    </a>
                  )}
                </div>
              )}

              {trackingData.courier_name && (
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    {STATUS_STEPS.map((step, i) => {
                      const currentIdx = getStepIndex(trackingData.status);
                      const isActive = currentIdx >= i;
                      const isCancelled = currentIdx === -1;
                      return (
                        <div key={step.key} className="flex flex-col items-center flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                            isCancelled ? 'bg-red-100 text-red-500' :
                            isActive ? 'bg-t-primary text-white shadow-md' : 'bg-t-base text-t-muted'
                          }`}>
                            {isCancelled && i === 0 ? '✕' : step.icon}
                          </div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-2 text-center ${
                            isActive ? 'text-t-main' : 'text-t-muted'
                          }`}>
                            {step.label}
                          </p>
                          {i < STATUS_STEPS.length - 1 && (
                            <div className={`h-0.5 w-full mt-[-1.25rem] ${isActive && !isCancelled ? 'bg-t-primary' : 'bg-t-base'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {['cancelled', 'returned', 'lost'].includes(trackingData.status) && (
                    <p className="text-center text-sm font-bold text-red-500 mt-4 uppercase">
                      {trackingData.status === 'cancelled' ? 'Order Cancelled' :
                       trackingData.status === 'returned' ? 'Order Returned' : 'Order Lost'}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-t-border pt-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-t-muted mb-3">Delivery Details</h3>
                <p className="font-semibold">{trackingData.customer_name}</p>
                <p className="text-t-muted text-sm">{trackingData.customer_phone}</p>
                <p className="text-t-muted text-sm mt-1">{trackingData.delivery_address}</p>
                {trackingData.delivery_area && (
                  <span className="inline-block mt-2 px-3 py-1 bg-t-base rounded-full text-xs font-bold text-t-muted uppercase">
                    {trackingData.delivery_area}
                  </span>
                )}
              </div>
            </div>

            {trackingData.items && trackingData.items.length > 0 && (
              <div className="bg-t-surface border border-t-border rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-t-muted mb-4">Items ({trackingData.items.length})</h3>
                <div className="divide-y divide-t-border">
                  {trackingData.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-semibold text-t-main">{item.product_name}</p>
                        <p className="text-xs text-t-muted">
                          Qty: {item.quantity}
                          {item.selected_size && ` | Size: ${item.selected_size}`}
                          {item.sku && ` | SKU: ${item.sku}`}
                        </p>
                      </div>
                      <p className="font-bold text-t-primary">৳{Number(item.price_at_purchase).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-t-border pt-4 mt-4 flex justify-between items-center">
                  <p className="font-bold text-t-main">Total</p>
                  <p className="text-xl font-black text-t-primary">৳{Number(trackingData.total_amount).toLocaleString()}</p>
                </div>
              </div>
            )}

            {trackingData.timeline && trackingData.timeline.length > 0 && (
              <div className="bg-t-surface border border-t-border rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-t-muted mb-4">Order Timeline</h3>
                <div className="space-y-4">
                  {trackingData.timeline.map((log, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${i === trackingData.timeline.length - 1 ? 'bg-t-primary' : 'bg-t-muted/30'}`} />
                        {i < trackingData.timeline.length - 1 && <div className="w-0.5 flex-1 bg-t-muted/20 mt-1" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-semibold text-t-main">{log.action}</p>
                        <p className="text-xs text-t-muted mt-0.5">
                          {new Date(log.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
