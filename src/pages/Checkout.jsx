import React, { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { ThemeContext } from '../context/ThemeContext';
import { useDevice } from '../context/DeviceContext';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';
import { trackBeginCheckout, trackPurchase } from '../lib/gtm';
import { fbqEvent } from '../lib/fbq';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const COOLDOWN_MS = 15 * 60 * 1000;

export default function Checkout() {
  const { cart, setCart } = useContext(CartContext);
  
  const { shopTheme, isShopDark } = useContext(ThemeContext); 

  const navigate = useNavigate();
  const { deviceUuid } = useDevice();
  const recaptchaLoaded = useRef(false);

  const [customerInfo, setCustomerInfo] = useState({ 
    name: '', phone: '', address: '', area: 'Inside Dhaka', notes: '' 
  });
  
  const [phoneInput, setPhoneInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [finalOrder, setFinalOrder] = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState('');

  const [deliveryRates, setDeliveryRates] = useState({ inside: 80, outside: 150 });
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoInput, setPromoInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [isPromoEnabled, setIsPromoEnabled] = useState(false);

  const [codCheck, setCodCheck] = useState({ cod_allowed: true, reason: '', checking: false });

  useEffect(() => {
    window.scrollTo(0, 0); 
    const saved = localStorage.getItem('siteSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setDeliveryRates({ 
        inside: Number(parsed.deliveryChargeInside) || 80, 
        outside: Number(parsed.deliveryChargeOutside) || 150 
      });
      setPromoCodes(parsed.promoCodes || []);
      setIsPromoEnabled(parsed.isPromoEnabled ?? true);
    }

    checkCooldown();
  }, []);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    if (document.querySelector('script[src*="recaptcha/api.js"]')) return;
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => { recaptchaLoaded.current = true; };
    document.head.appendChild(script);
  }, []);

  const checkCooldown = () => {
    const lastOrderTime = localStorage.getItem('last_order_time');
    if (lastOrderTime) {
      const elapsed = Date.now() - parseInt(lastOrderTime, 10);
      if (elapsed < COOLDOWN_MS) {
        setCooldownActive(true);
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
        setCooldownRemaining(`${remaining} minute${remaining > 1 ? 's' : ''}`);
        return;
      }
    }
    setCooldownActive(false);
    setCooldownRemaining('');
  };

  const getRecaptchaToken = () => {
    return new Promise((resolve) => {
      if (!RECAPTCHA_SITE_KEY || !window.grecaptcha || !recaptchaLoaded.current) {
        resolve('');
        return;
      }
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'checkout' }).then(resolve);
      });
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryCharge = totalItems >= 3 ? 0 : (customerInfo.area === 'Inside Dhaka' ? deliveryRates.inside : deliveryRates.outside);
  const total = subtotal + deliveryCharge - appliedDiscount;

  const handleInputChange = (e) => {
    setCustomerInfo({ ...customerInfo, [e.target.name]: e.target.value });
    if (e.target.name === 'area') {
      checkCodAllowed(phoneInput, e.target.value);
    }
  };

  // Auto-fill saved customer info when phone number is entered
  const handlePhoneBlur = async () => {
    const phone = phoneInput.replace(/[^0-9]/g, '');
    if (phone.length < 11) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/lookup-customer/${phone}`);
      const data = await res.json();
      if (data.success && data.data) {
        setCustomerInfo(prev => ({
          ...prev,
          name: data.data.name || prev.name,
          address: data.data.address || prev.address,
          phone: phone,
        }));
        toast('Saved info loaded!', { icon: '📱', duration: 2000 });
      }
    } catch (err) { /* silent */ }
  };

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    const bengaliToEnglish = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    
    val = val.replace(/[০-৯]/g, match => bengaliToEnglish[match]);
    val = val.replace(/\D/g, ''); 

    if (val.length > 11) val = val.slice(0, 11);
    setPhoneInput(val);
    setCustomerInfo({ ...customerInfo, phone: `+88${val}` });
    if (val.length === 11) {
      checkCodAllowed(val, customerInfo.area);
    }
  };

  // 🟢 Abandoned Cart Lead Capture Logic (Layer 1 + Layer 2)
  const captureLead = async () => {
    if (phoneInput.length === 11 && phoneInput.startsWith('01')) {
      // Layer 1: The Senses — GTM dataLayer
      trackBeginCheckout(cart, total);
      fbqEvent('InitiateCheckout', {
        content_ids: cart.map(item => String(item.id)),
        content_type: 'product',
        value: total,
        currency: 'BDT',
        num_items: cart.length
      });
      // Layer 2: The Gatekeeper — Server-side tracking
      try {
        await fetch(`${API_BASE_URL}/api/marketing/track-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName: 'InitiateCheckout',
            eventData: {
              name: customerInfo.name,
              phone: customerInfo.phone,
              address: customerInfo.address,
              value: total,
              url: window.location.href,
              items: cart.map(item => ({ 
                item_id: item.id.toString(), 
                item_name: item.name, 
                price: parseFloat(item.price), 
                quantity: item.quantity 
              }))
            }
          })
        });
      } catch (err) {
        console.error("Lead Capture Error:", err);
      }
    }
  };

  // 🟢 Layer 5: The Execution — Check if COD is allowed for this customer/area
  const checkCodAllowed = async (phone, area) => {
    if (!phone && !area) return;
    setCodCheck(prev => ({ ...prev, checking: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/brain/check-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+88${phone}`, delivery_area: area })
      });
      const data = await res.json();
      if (data.success) {
        setCodCheck({ cod_allowed: data.cod_allowed, reason: data.reason, checking: false });
      }
    } catch (e) {
      setCodCheck({ cod_allowed: true, reason: '', checking: false });
    }
  };

  const applyPromo = (e) => {
    e.preventDefault();
    const foundPromo = promoCodes.find(p => p.code === promoInput.toUpperCase());
    if (foundPromo) {
      setAppliedDiscount(Number(foundPromo.discount));
      toast.success(`Promo Code Applied: ৳${foundPromo.discount} Off!`);
    } else {
      setAppliedDiscount(0);
      toast.error('Invalid Promo Code!');
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return toast.error("Your cart is empty!");
    
    if (phoneInput.length !== 11 || !phoneInput.startsWith('01')) {
      return toast.error("Please enter a valid 11-digit Bangladeshi number (e.g. 017...)");
    }

    if (cooldownActive) {
      return toast.error(`Please wait ${cooldownRemaining} before placing a new order.`);
    }
    
    setIsSubmitting(true);

    const recaptchaToken = await getRecaptchaToken();
    
    const paymentMethod = codCheck.cod_allowed ? 'COD' : 'Pending';
    const orderPayload = {
      customerInfo: customerInfo,
      items: cart.map(item => ({ product: { id: item.id, price: item.price, name: item.name, sku: item.sku }, quantity: item.quantity, size: item.selectedSize || null })),
      summary: { subtotal, deliveryCharge, discount: appliedDiscount, total },
      payment_method: paymentMethod,
      cod_blocked: !codCheck.cod_allowed,
      cod_block_reason: codCheck.reason,
      recaptcha_token: recaptchaToken,
      device_uuid: deviceUuid
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload)
      });
      const result = await response.json();
      
      if (result.success) {
        // Layer 1: The Senses — GTM dataLayer
        trackPurchase({
          order: { order_code: result.orderCode, total_amount: total, delivery_charge },
          items: cart
        });
        fbqEvent('Purchase', {
          content_ids: cart.map(item => String(item.id)),
          content_type: 'product',
          value: total,
          currency: 'BDT',
          num_items: cart.length
        });
        // Layer 2: The Gatekeeper — Server-side tracking
        try {
        await fetch(`${API_BASE_URL}/api/marketing/track-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventName: 'Purchase',
              eventData: {
                phone: customerInfo.phone,
                value: total,
                orderCode: result.orderCode,
                url: window.location.href,
                items: cart.map(item => ({ item_id: item.id.toString(), item_name: item.name, price: parseFloat(item.price), quantity: item.quantity }))
              }
            })
          });
        } catch (trackingErr) {}

        localStorage.setItem('last_order_time', Date.now().toString());
        setCooldownActive(true);
        setCooldownRemaining('15 minutes');
        setFinalOrder({ ...orderPayload, orderCode: result.orderCode, cartItems: cart });
        setShowInvoiceModal(true);
        toast.success('Order Placed Successfully!');
      } else { 
        toast.error(result.message || "Failed to place order."); 
      }
    } catch (err) { 
      toast.error("Server connection error."); 
    } 
    finally { setIsSubmitting(false); }
  };

  const handleCloseAndRedirect = () => { setCart([]); setShowInvoiceModal(false); navigate('/shop'); };

  return (
    // 🔴 Full Background Wrapper যুক্ত করা হলো যেন থিম কালার পুরো পেজ জুড়ে পায়
    <div className={`min-h-screen bg-t-base w-full ${shopTheme}`}>
      <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto font-sans relative pt-24">
        
        {/* 🔴 Print CSS: স্ক্রিনে থিম থাকবে, তবে প্রিন্ট করলে সাদা-কালো (Black & White) হয়ে যাবে */}
        <style>{`
          @media print { 
            body * { visibility: hidden; } 
            #printable-invoice, #printable-invoice * { 
              visibility: visible; 
              color: #000 !important; 
              background-color: #fff !important; 
              border-color: #ddd !important;
            } 
            #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } 
            .no-print { display: none !important; }
          }
        `}</style>
        
        <div className="mb-8 no-print text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-serif font-black text-t-main tracking-wide">Secure Checkout</h1>
          <p className="text-sm text-t-muted mt-2">Complete your order by providing your details below.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 no-print items-start">
          
          <div className="lg:col-span-7 space-y-8 flex flex-col">
            <div className="bg-t-surface border border-t-border p-6 sm:p-8 rounded-2xl shadow-sm">
              <h2 className="text-lg font-black text-t-main border-b border-t-border pb-3 mb-6 uppercase tracking-widest">Shipping Information</h2>
              
              <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-t-muted mb-1.5 uppercase tracking-wider">Full Name *</label>
                  <input required type="text" name="name" value={customerInfo.name} onChange={handleInputChange} onBlur={captureLead} className="w-full border border-t-border bg-t-base text-t-main placeholder-t-muted/50 rounded-xl p-3.5 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-semibold transition-colors" placeholder="e.g. Afsana Rahman" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-t-muted mb-1.5 uppercase tracking-wider">Phone Number *</label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-t-primary/30">
                    <span className="inline-flex items-center px-4 bg-t-base border border-r-0 border-t-border font-bold text-t-muted select-none">+88</span>
                    <input required type="tel" value={phoneInput} onChange={handlePhoneChange} onBlur={(e) => { captureLead(e); handlePhoneBlur(); }} placeholder="01XXXXXXXXX" className="w-full border border-t-border bg-t-base text-t-main placeholder-t-muted/50 p-3.5 outline-none focus:border-t-primary font-bold tracking-widest transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-t-muted mb-1.5 uppercase tracking-wider">Delivery Area *</label>
                  <div className="relative">
                    <select name="area" value={customerInfo.area} onChange={handleInputChange} onBlur={captureLead} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3.5 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-bold appearance-none cursor-pointer">
                      <option value="Inside Dhaka">Inside Dhaka (৳{deliveryRates.inside})</option>
                      <option value="Outside Dhaka">Outside Dhaka (৳{deliveryRates.outside})</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-t-muted">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-t-muted mb-1.5 uppercase tracking-wider">Full Delivery Address *</label>
                  <textarea required name="address" value={customerInfo.address} onChange={handleInputChange} onBlur={captureLead} className="w-full border border-t-border bg-t-base text-t-main placeholder-t-muted/50 rounded-xl p-3.5 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 font-semibold custom-scrollbar" rows="3" placeholder="House/Flat No, Street, Thana, District"></textarea>
                </div>

                <div>
                  <label className="block text-xs font-bold text-t-muted mb-1.5 uppercase tracking-wider">Order Notes (Optional)</label>
                  <textarea name="notes" value={customerInfo.notes} onChange={handleInputChange} rows="2" className="w-full border border-t-border bg-t-base text-t-main placeholder-t-muted/50 rounded-xl p-3.5 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 custom-scrollbar resize-none" placeholder="Any specific instructions for delivery?"></textarea>
                </div>
              </form>
            </div>

            {isPromoEnabled && (
              <div className="bg-t-surface border border-t-border p-6 rounded-2xl shadow-sm">
                <h3 className="text-sm font-black mb-3 flex items-center gap-2 uppercase tracking-widest text-t-main"><span>🎟️</span> Have a Promo Code?</h3>
                <form onSubmit={applyPromo} className="flex flex-col sm:flex-row gap-3">
                  <input type="text" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="Enter code here" className="flex-1 border border-t-border bg-t-base text-t-main placeholder-t-muted/50 rounded-xl p-3.5 outline-none focus:border-t-primary focus:ring-1 focus:ring-t-primary/30 uppercase tracking-widest font-bold text-sm" />
                  <button type="submit" className="bg-t-primary text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs shadow-md hover:shadow-lg hover:opacity-90 transition-all">Apply</button>
                </form>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="bg-t-surface border border-t-border p-6 sm:p-8 rounded-2xl shadow-lg sticky top-28">
              <h2 className="text-lg font-black text-t-main border-b border-t-border pb-4 mb-6 uppercase tracking-widest">Order Summary</h2>
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                {cart.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start border-b border-t-border pb-4">
                    {/* Product Image */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-t-base rounded-xl overflow-hidden flex-shrink-0 border border-t-border/50">
                      {item.image_url ? (
                        <img
                          src={item.image_url.startsWith('http') ? item.image_url : `${API_BASE_URL}${item.image_url}`}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-t-muted font-bold">No Img</div>
                      )}
                    </div>
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-t-main leading-snug line-clamp-1">{item.name}</p>
                      {(item.sku || item.dynamicSku || item.variant?.name) && (
                        <p className="text-[10px] text-t-muted font-mono mt-0.5">
                          {item.variant?.name || item.dynamicSku || item.sku}
                          {item.selectedSize && <span className="text-t-primary ml-1">({item.selectedSize})</span>}
                        </p>
                      )}
                      <p className="text-[10px] text-t-muted mt-0.5">Qty: {item.quantity} × ৳{item.price.toLocaleString()}</p>
                    </div>
                    {/* Line Total */}
                    <span className="font-black text-t-main whitespace-nowrap text-sm">৳ {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3 text-sm font-bold border-b border-t-border pb-6 mb-6">
                <div className="flex justify-between"><span className="text-t-muted">Subtotal</span><span className="text-t-main">৳ {subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between">
                  <span className="text-t-muted">Shipping</span>
                  {totalItems >= 3 ? <span className="text-t-primary uppercase tracking-widest font-black">Free</span> : <span className="text-t-main">৳ {deliveryCharge}</span>}
                </div>
                {appliedDiscount > 0 && <div className="flex justify-between text-orange-500"><span>Discount Applied</span><span>- ৳ {appliedDiscount}</span></div>}
              </div>
              <div className="flex justify-between items-center text-lg font-black text-t-main mb-8">
                <span className="uppercase tracking-widest">Total Payable</span>
                <span className="text-2xl text-t-primary">৳ {total.toLocaleString()}</span>
              </div>
              
              {cooldownActive ? (
                <div className="w-full">
                  <button type="button" disabled className="w-full bg-t-muted cursor-not-allowed text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl">
                    Confirm Order
                  </button>
                  <p className="text-center text-xs text-amber-600 font-bold mt-3">You have recently placed an order. Please wait {cooldownRemaining} before placing a new one.</p>
                </div>
              ) : (
              <button form="checkout-form" type="submit" disabled={isSubmitting} className={`w-full text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all ${isSubmitting ? 'bg-t-muted cursor-not-allowed' : 'bg-t-primary hover:opacity-90 shadow-xl hover:-translate-y-1'}`}>
                {isSubmitting ? 'Processing Order...' : 'Confirm Order'}
              </button>
              )}
              
              {codCheck.checking ? (
                <p className="text-center text-[10px] text-t-muted mt-4">Checking payment options...</p>
              ) : codCheck.cod_allowed ? (
                <p className="text-center text-[10px] text-green-600 font-bold tracking-widest uppercase mt-4">Cash on Delivery Available</p>
              ) : (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-700 text-center">COD Not Available</p>
                  <p className="text-[10px] text-red-600 text-center mt-1">{codCheck.reason}</p>
                  <p className="text-[10px] text-gray-500 text-center mt-2">Please contact support for alternative payment.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 🔴 Invoice Modal - Theme সাপোর্টেড করা হলো */}
        {showInvoiceModal && finalOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div id="printable-invoice" className="bg-t-surface border border-t-border w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-fade-in-up text-t-main relative">
              
              <div className="text-center border-b border-t-border pb-6 mb-6">
                <div className="text-4xl mb-2 no-print">🎉</div>
                <h1 className="text-2xl font-black uppercase tracking-widest text-t-primary">Hamza Fabrics</h1>
                <p className="text-sm font-bold text-t-muted mt-1 no-print">Order Successfully Placed!</p>
              </div>
              
              <div className="flex justify-between text-sm mb-6 bg-t-base border border-t-border p-4 rounded-xl">
                <div>
                  <p className="text-t-muted font-bold uppercase text-[10px] mb-1">Billed To</p>
                  <p className="font-bold text-t-main">{finalOrder.customerInfo.name}</p>
                  <p className="text-t-main/80">{finalOrder.customerInfo.phone}</p>
                  <p className="text-t-main/80 max-w-[200px] text-xs mt-1">{finalOrder.customerInfo.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-t-muted font-bold uppercase text-[10px] mb-1">Order ID</p>
                  <p className="font-black text-lg text-t-primary">{finalOrder.orderCode}</p>
                  <p className="text-t-muted font-bold uppercase text-[10px] mt-3 mb-1">Payment Method</p>
                  <p className={`font-bold ${!codCheck.cod_allowed ? 'text-red-500' : 'text-t-main'}`}>{finalOrder.payment_method || 'COD'}</p>
                </div>
              </div>
              
              <div className="border border-t-border rounded-lg overflow-hidden mb-6">
                <table className="w-full text-left text-sm">
                  <thead className="bg-t-base text-t-muted text-[10px] uppercase tracking-widest border-b border-t-border">
                    <tr><th className="p-3">Item</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Price</th></tr>
                  </thead>
                  <tbody className="divide-y divide-t-border">
                    {finalOrder.cartItems.map((item, i) => (
                      <tr key={i} className="hover:bg-t-base transition-colors">
                        <td className="p-3 font-semibold text-t-main">{item.name} <span className="text-t-muted">{item.selectedSize && `(${item.selectedSize})`}</span></td>
                        <td className="p-3 text-center font-bold text-t-main/80">{item.quantity}</td>
                        <td className="p-3 text-right font-bold text-t-main">৳{(item.price * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="space-y-2 text-sm font-bold text-t-main/80 flex flex-col items-end border-b border-t-border pb-6 mb-6">
                <div className="flex justify-between w-52"><span>Subtotal:</span><span className="text-t-main">৳{finalOrder.summary.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between w-52"><span>Delivery:</span><span className="text-t-main">৳{finalOrder.summary.deliveryCharge}</span></div>
                {finalOrder.summary.discount > 0 && <div className="flex justify-between w-52 text-orange-500"><span>Discount:</span><span>- ৳{finalOrder.summary.discount}</span></div>}
                <div className="flex justify-between w-52 text-lg font-black text-t-main mt-3 pt-3 border-t border-t-border"><span>Total:</span><span className="text-t-primary">৳{finalOrder.summary.total.toLocaleString()}</span></div>
              </div>
              
              <div className="flex gap-4 no-print">
                <button onClick={handleCloseAndRedirect} className="flex-1 bg-transparent border border-t-border hover:bg-t-base text-t-main py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">Close</button>
                <button onClick={() => window.print()} className="flex-1 bg-t-primary hover:opacity-90 text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg flex justify-center items-center gap-2 transition-all">Print Invoice</button>
              </div>
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
}