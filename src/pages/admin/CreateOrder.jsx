import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Phone, MessageCircle, Plus, FileText, 
  ExternalLink, Tags, Trash2, Star, Image as ImageIcon, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import API_BASE_URL from '../../config/api';
import toast from 'react-hot-toast';
import { getToken } from '../../utils/auth';

export default function CreateOrder() {
  const navigate = useNavigate();
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  
  const [couriers, setCouriers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [siteSettings, setSiteSettings] = useState(null);
  const [fraudData, setFraudData] = useState(null);

  const [orderFormData, setOrderFormData] = useState({
    customer: { name: '', phone: '', address: '', area: 'Inside Dhaka' },
    deliveryMethod: 'PATHAO',
    shippingNote: '',
    crossSale: false,
    items: [],
    billing: { discount: 0, advance: 0, subTotal: 0, deliveryCharge: 150, total: 0 }
  });

  useEffect(() => {
    const phone = orderFormData.customer.phone;
    if (phone && phone.replace(/\D/g, '').length >= 11) {
      fetch(`${API_BASE_URL}/api/courier/fraud-check/${phone.replace(/\D/g, '')}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const details = data.data.details || {};
            const summary = data.data.summary || {};
            const courierNames = { steadfast: 'Steadfast', pathao: 'Pathao', redx: 'RedX', paperfly: 'Paperfly', carrybee: 'Carrybee' };
            const couriers = Object.entries(courierNames)
              .filter(([key]) => details[key])
              .map(([key, name]) => {
                const c = details[key];
                return { name, successRate: c.total > 0 ? Math.round((c.success / c.total) * 100) : 0, total: c.total, success: c.success, cancelled: c.return };
              });
            setFraudData({
              overall: {
                successRate: summary.genuine_prob || 0,
                total: summary.total_orders || 0,
                success: summary.total_received || 0,
                cancelled: summary.total_returned || 0
              },
              couriers
            });
          }
        })
        .catch(() => setFraudData(null));
    } else {
      setFraudData(null);
    }
  }, [orderFormData.customer.phone]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
        const [couriersRes, productsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/courier/active`, { headers }),
          fetch(`${API_BASE_URL}/api/products`)
        ]);
        
        const cResult = await couriersRes.json();
        const pResult = await productsRes.json();
        
        if (cResult.success) {
          setCouriers(cResult.data);
          if (cResult.data.length > 0) {
            setOrderFormData(prev => ({ ...prev, deliveryMethod: cResult.data[0].name }));
          }
        }
        if (pResult.success) setProducts(pResult.data);

        const savedSettings = localStorage.getItem('siteSettings');
        if(savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSiteSettings(parsed);
          setOrderFormData(prev => ({
            ...prev, 
            billing: { ...prev.billing, deliveryCharge: Number(parsed.deliveryChargeInside) || 150 }
          }));
        }
      } catch (error) { console.error("Failed to load initial data"); }
    };
    fetchInitialData();
  }, []);

  const handleModalItemChange = (index, field, value) => {
    const newItems = [...orderFormData.items];
    newItems[index][field] = value;
    const newSubTotal = newItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * parseInt(item.quantity || 1)), 0);
    const newTotal = (newSubTotal + parseFloat(orderFormData.billing.deliveryCharge)) - parseFloat(orderFormData.billing.discount) - parseFloat(orderFormData.billing.advance);
    setOrderFormData({ ...orderFormData, items: newItems, billing: { ...orderFormData.billing, subTotal: newSubTotal, total: newTotal }});
  };

  const addProductToOrder = (prod) => {
    const newItem = { productId: prod.id, sku: prod.sku, name: prod.name, image: prod.image_url, price: prod.price, quantity: 1, size: '' };
    const newItems = [...orderFormData.items, newItem];
    const newSubTotal = newItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * parseInt(item.quantity || 1)), 0);
    const newTotal = (newSubTotal + parseFloat(orderFormData.billing.deliveryCharge)) - parseFloat(orderFormData.billing.discount) - parseFloat(orderFormData.billing.advance);
    setOrderFormData({ ...orderFormData, items: newItems, billing: { ...orderFormData.billing, subTotal: newSubTotal, total: newTotal }});
  };

  const removeModalItem = (index) => {
    const newItems = [...orderFormData.items];
    newItems.splice(index, 1);
    const newSubTotal = newItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * parseInt(item.quantity || 1)), 0);
    const newTotal = (newSubTotal + parseFloat(orderFormData.billing.deliveryCharge)) - parseFloat(orderFormData.billing.discount) - parseFloat(orderFormData.billing.advance);
    setOrderFormData({ ...orderFormData, items: newItems, billing: { ...orderFormData.billing, subTotal: newSubTotal, total: newTotal }});
  };

  const submitOrderForm = async (e) => {
    e.preventDefault(); 
    if(orderFormData.items.length === 0) return toast.error("Please add at least one product!");
    setIsSaving(true);
    
    const payload = {
      customerInfo: orderFormData.customer,
      items: orderFormData.items.map(i => ({ product: { id: i.productId, price: i.price }, quantity: i.quantity, size: i.size })),
      summary: { subtotal: orderFormData.billing.subTotal, deliveryCharge: orderFormData.billing.deliveryCharge, discount: orderFormData.billing.discount, total: orderFormData.billing.total },
      shipping_note: orderFormData.shippingNote, 
      is_cross_sale: orderFormData.crossSale, 
      courier: orderFormData.deliveryMethod
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/checkout`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, 
        body: JSON.stringify(payload) 
      });
      const result = await response.json();
      if(result.success) { 
        toast.success('Order Created Successfully!'); 
        navigate('/orders'); // 🔴 Success হলে ড্যাশবোর্ডে ব্যাক করবে
      } 
      else toast.error(result.message);
    } catch (err) { toast.error('Failed to save order'); } 
    finally { setIsSaving(false); }
  };

  return (
    <div className={`w-full min-h-[calc(100vh-2rem)] flex flex-col bg-[#0a0a0a] text-gray-200 font-sans p-4 sm:p-6 ${adminTheme}`}>
      
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
         <button onClick={() => navigate('/orders')} className="p-2 bg-[#151515] border border-[#333] rounded-lg hover:text-orange-500 transition-colors">
            <ArrowLeft size={20}/>
         </button>
         <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Create New Order</h1>
            <p className="text-xs text-gray-500 mt-1">Add customer details and products to generate a new invoice.</p>
         </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        
        {/* Left Side: Customer & Address */}
        <div className="flex-1 flex flex-col gap-6">
           <div className="bg-[#111] border border-[#222] rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4 border-b border-[#333] pb-2">Customer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="text-[11px] text-gray-400 font-bold mb-1.5 block">Mobile Number</label>
                    <div className="relative">
                      <input type="text" value={orderFormData.customer.phone} onChange={e => setOrderFormData({...orderFormData, customer: {...orderFormData.customer, phone: e.target.value}})} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-sm outline-none focus:border-green-500 text-white transition-colors" placeholder="e.g. 017..." required/>
                      <div className="absolute right-3 top-3 flex gap-2 text-gray-500">
                         <Phone size={16} className="cursor-pointer hover:text-green-500"/><MessageCircle size={16} className="cursor-pointer hover:text-green-500"/>
                      </div>
                    </div>
                 </div>
                 <div>
                    <label className="text-[11px] text-gray-400 font-bold mb-1.5 block">Full Name</label>
                    <input type="text" value={orderFormData.customer.name} onChange={e => setOrderFormData({...orderFormData, customer: {...orderFormData.customer, name: e.target.value}})} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-sm outline-none focus:border-green-500 text-white transition-colors" placeholder="Customer Name" required/>
                 </div>
                 <div className="md:col-span-2">
                    <label className="text-[11px] text-gray-400 font-bold mb-1.5 block">Delivery Address</label>
                    <textarea rows="2" value={orderFormData.customer.address} onChange={e => setOrderFormData({...orderFormData, customer: {...orderFormData.customer, address: e.target.value}})} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-sm outline-none focus:border-green-500 text-white custom-scrollbar transition-colors" placeholder="Full address..." required></textarea>
                 </div>
                  <div>
                     <label className="text-[11px] text-gray-400 font-bold mb-1.5 block">Delivery Method</label>
                     <select value={orderFormData.deliveryMethod} onChange={e => setOrderFormData({...orderFormData, deliveryMethod: e.target.value})} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-sm outline-none focus:border-green-500 text-white uppercase transition-colors">
                       {couriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                     </select>
                  </div>
                 <div>
                    <label className="text-[11px] text-gray-400 font-bold mb-1.5 flex justify-between">Shipping Note <span className="text-[10px] text-gray-600">{orderFormData.shippingNote.length}/350</span></label>
                    <input type="text" value={orderFormData.shippingNote} onChange={e => setOrderFormData({...orderFormData, shippingNote: e.target.value})} className="w-full bg-[#151515] border border-[#333] rounded-lg p-3 text-sm outline-none focus:border-green-500 text-white transition-colors" placeholder="Any instructions for courier?"/>
                 </div>
               </div>
            </div>

           {fraudData && (
             <div className="bg-[#111] border border-[#222] rounded-2xl p-5 shadow-xl space-y-3 animate-fadeIn">
               <div className="flex items-center gap-2 text-gray-400">
                 <ShieldCheck size={16} className="text-emerald-500" />
                 <span className="text-[11px] font-semibold uppercase tracking-wider">Fraud Check — {orderFormData.customer.phone}</span>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                 <div className="bg-[#151515] border border-[#333] rounded-lg p-3 col-span-2 sm:col-span-1">
                   <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Overall</p>
                   <div className="space-y-1.5">
                     <div className="flex justify-between text-[11px]"><span className="text-gray-400">Success Rate:</span><span className={`font-bold ${fraudData.overall.successRate > 50 ? 'text-emerald-500' : fraudData.overall.successRate > 0 ? 'text-orange-500' : 'text-red-500'}`}>{fraudData.overall.successRate}%</span></div>
                     <div className="flex justify-between text-[11px]"><span className="text-gray-400">Total:</span><span className="font-bold text-white">{fraudData.overall.total}</span></div>
                     <div className="flex justify-between text-[11px]"><span className="text-gray-400">Success:</span><span className="font-bold text-green-500">{fraudData.overall.success}</span></div>
                     <div className="flex justify-between text-[11px]"><span className="text-gray-400">Cancelled:</span><span className="font-bold text-red-500">{fraudData.overall.cancelled}</span></div>
                   </div>
                 </div>
                 {fraudData.couriers.map(c => (
                   <div key={c.name} className="bg-[#151515] border border-[#333] rounded-lg p-3">
                     <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{c.name}</p>
                     <div className="space-y-1.5">
                       <div className="flex justify-between text-[11px]"><span className="text-gray-400">Success Rate:</span><span className={`font-bold ${c.successRate > 50 ? 'text-emerald-500' : c.successRate > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{c.successRate}%</span></div>
                       <div className="flex justify-between text-[11px]"><span className="text-gray-400">Total:</span><span className="font-bold text-white">{c.total}</span></div>
                       <div className="flex justify-between text-[11px]"><span className="text-gray-400">Success:</span><span className="font-bold text-green-500">{c.success}</span></div>
                       <div className="flex justify-between text-[11px]"><span className="text-gray-400">Cancelled:</span><span className="font-bold text-red-500">{c.cancelled}</span></div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           <div className="bg-[#111] border border-[#222] rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
               <h3 className="text-sm font-bold text-white mb-4 border-b border-[#333] pb-2 flex justify-between items-center">
                  Ordered Products <span className="bg-[#222] text-gray-400 px-2 py-0.5 rounded text-[11px] font-mono">{orderFormData.items.length} Items</span>
              </h3>
              
              {orderFormData.items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-[#333] rounded-xl p-6">
                   <ImageIcon size={48} className="mb-3 opacity-20"/>
                   <p className="text-sm font-bold">No products added yet.</p>
                   <p className="text-xs">Search and click on products from the right panel.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                   {orderFormData.items.map((item, idx) => (
                      <div key={idx} className="bg-[#151515] border border-[#222] p-4 rounded-xl relative shadow-sm group hover:border-[#444] transition-colors">
                         <button type="button" onClick={() => removeModalItem(idx)} className="absolute top-4 right-4 text-gray-500 hover:text-red-500 bg-[#222] hover:bg-red-500/10 p-1.5 rounded-md transition-colors"><Trash2 size={16}/></button>
                         <div className="flex gap-4 mb-4 pr-8">
                            <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center text-[8px] text-black text-center font-bold overflow-hidden border border-gray-600 shrink-0">
                              {item.image ? <img src={item.image} className="w-full h-full object-cover" alt="product"/> : item.sku}
                            </div>
                            <div>
                               <h4 className="text-sm font-bold text-white leading-tight">{item.name}</h4>
                               <div className="text-[11px] text-gray-400 mt-1.5 flex gap-2 items-center">
                                  <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-md border border-green-500/20 font-bold">Primary</span> 
                                  <span className="font-mono bg-[#222] px-2 py-0.5 rounded-md">SKU: {item.sku}</span>
                               </div>
                            </div>
                         </div>
                         <div className="grid grid-cols-3 gap-4 border-t border-[#222] pt-4">
                            <div>
                              <label className="text-[11px] text-gray-500 font-bold block mb-1">Quantity</label>
                              <div className="flex items-center bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden">
                                <button type="button" onClick={() => handleModalItemChange(idx, 'quantity', Math.max(1, (item.quantity || 1) - 1))} className="px-3 py-1.5 text-gray-400 hover:text-white bg-[#1a1a1a] border-r border-[#333] transition-colors">-</button>
                                <input type="text" value={item.quantity || 1} readOnly className="w-full bg-transparent text-center text-sm font-bold text-white outline-none p-1.5" />
                                <button type="button" onClick={() => handleModalItemChange(idx, 'quantity', parseInt(item.quantity || 1) + 1)} className="px-3 py-1.5 text-gray-400 hover:text-white bg-[#1a1a1a] border-l border-[#333] transition-colors">+</button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-500 font-bold block mb-1">Unit Price</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">৳</span>
                                <input type="number" value={item.price || 0} onChange={e => handleModalItemChange(idx, 'price', e.target.value)} className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-1.5 pl-6 text-sm font-bold text-white outline-none focus:border-green-500 transition-colors" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-500 font-bold block mb-1">Total</label>
                              <div className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-1.5 text-center text-sm font-black text-[#38bdf8]">
                                ৳ {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                              </div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              )}
           </div>
        </div>

        {/* Right Side: Product Search & Billing */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6">
           {/* Product Search */}
           <div className="bg-[#111] border border-[#222] rounded-2xl p-5 shadow-xl flex flex-col h-[50vh] lg:h-[60vh]">
              <h3 className="text-sm font-bold text-white mb-3">Add Products</h3>
              <div className="relative mb-4 shrink-0">
                 <input type="text" placeholder="Search by name or SKU..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full bg-[#151515] border border-[#333] rounded-lg p-2.5 text-sm text-white outline-none focus:border-orange-500 transition-colors" />
              </div>
              
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                  {(products || []).filter(p => (p.sku || '').toLowerCase().includes((productSearch||'').toLowerCase()) || p.name?.toLowerCase().includes((productSearch||'').toLowerCase())).map((prod) => (
                    <div key={prod.id} onClick={() => addProductToOrder(prod)} className="bg-[#151515] border border-[#222] p-2.5 rounded-xl flex gap-3 cursor-pointer hover:border-orange-500/50 transition-colors group relative shrink-0">
                       <div className="absolute right-2 top-2 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={16}/></div>
                       <div className="w-12 h-12 bg-white rounded-md flex items-center justify-center border border-gray-700 shrink-0 overflow-hidden">
                         {prod.image_url ? <img src={prod.image_url} className="w-full h-full object-cover" alt="prod"/> : <ImageIcon size={20} className="text-gray-400"/>}
                       </div>
                       <div className="flex flex-col justify-between w-full">
                          <div>
                             <h4 className="text-[12px] font-aeonik-bold text-gray-200 line-clamp-1 pr-6">{prod.name}</h4>
                             <p className="text-[10px] font-mono text-gray-500 mt-0.5">SKU: {prod.sku || 'N/A'}</p>
                          </div>
                          <div className="flex justify-between items-end mt-1 text-[11px] font-bold text-gray-400">
                             <span className="text-white">৳{prod.price}</span>
                             <span className={prod.stock_quantity > 0 ? "text-green-500" : "text-red-500"}>Stock: {prod.stock_quantity || 0}</span>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Billing Summary */}
           <form onSubmit={submitOrderForm} className="bg-[#111] border border-[#222] rounded-2xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white border-b border-[#333] pb-2 mb-2">Order Summary</h3>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold">Sub Total</span>
                <span className="font-mono text-white font-bold">৳ {orderFormData.billing.subTotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 font-bold text-sm">Delivery Charge</span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">৳</span>
                  <input type="number" value={orderFormData.billing.deliveryCharge || 0} onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    const newTotal = (orderFormData.billing.subTotal + val) - parseFloat(orderFormData.billing.discount || 0) - parseFloat(orderFormData.billing.advance || 0);
                    setOrderFormData({...orderFormData, billing: {...orderFormData.billing, deliveryCharge: val, total: newTotal}});
                  }} className="w-full bg-[#151515] border border-[#333] rounded-md p-1.5 pl-6 text-sm outline-none text-white text-right focus:border-orange-500 transition-colors" />
                </div>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 font-bold text-sm">Discount</span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">৳</span>
                  <input type="number" value={orderFormData.billing.discount || 0} onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    const newTotal = (orderFormData.billing.subTotal + parseFloat(orderFormData.billing.deliveryCharge || 0)) - val - parseFloat(orderFormData.billing.advance || 0);
                    setOrderFormData({...orderFormData, billing: {...orderFormData.billing, discount: val, total: newTotal}});
                  }} className="w-full bg-[#151515] border border-[#333] rounded-md p-1.5 pl-6 text-sm outline-none text-white text-right focus:border-orange-500 transition-colors" />
                </div>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 font-bold text-sm">Advance</span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">৳</span>
                  <input type="number" value={orderFormData.billing.advance || 0} onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    const newTotal = (orderFormData.billing.subTotal + parseFloat(orderFormData.billing.deliveryCharge || 0)) - parseFloat(orderFormData.billing.discount || 0) - val;
                    setOrderFormData({...orderFormData, billing: {...orderFormData.billing, advance: val, total: newTotal}});
                  }} className="w-full bg-[#151515] border border-[#333] rounded-md p-1.5 pl-6 text-sm outline-none text-white text-right focus:border-orange-500 transition-colors" />
                </div>
              </div>

              <div className="border-t border-[#333] pt-4 mt-2 flex justify-between items-center">
                <span className="text-white font-black text-lg">Grand Total</span>
                <span className="font-mono text-orange-500 font-black text-2xl">৳ {orderFormData.billing.total.toFixed(2)}</span>
              </div>
              
              <button type="submit" disabled={isSaving} className="w-full mt-4 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black shadow-[0_0_15px_rgba(234,88,12,0.4)] transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                {isSaving ? 'Processing...' : <><CheckCircle2 size={18}/> Confirm Order</>}
              </button>
           </form>
        </div>
      </div>
    </div>
  );
}