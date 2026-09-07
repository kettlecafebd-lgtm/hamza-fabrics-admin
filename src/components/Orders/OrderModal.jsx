import React from 'react';
import PropTypes from 'prop-types';
import { 
  Edit, X, RefreshCw, Phone, MessageCircle, Plus, 
  FileText, ExternalLink, Tags, Trash2, Star, Image as ImageIcon 
} from 'lucide-react';

export default function OrderModal({
  modalMode, orderFormData = {}, setOrderFormData, setShowOrderModal, 
  submitOrderForm, isSaving, couriers = [], products = [], 
  productSearch = '', setProductSearch, addProductToOrder, 
  removeModalItem, handleModalItemChange
}) {
  
  const safeData = orderFormData || {};
  const metrics = safeData.metrics || {};
  const customer = safeData.customer || { name: '', phone: '', address: '' };
  const billing = safeData.billing || { discount: 0, advance: 0, subTotal: 0, deliveryCharge: 0, total: 0 };
  const itemsList = safeData.items || [];
  const safeShippingNote = safeData.shippingNote || '';
  const noteLength = safeShippingNote.length || 0;
  const itemsCount = itemsList.length || 0;

  return (
    <div role="dialog" aria-modal="true" aria-label={modalMode === 'create' ? 'Create new order' : `Edit order ${safeData.invoice || ''}`} className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 font-sans">
      <div className="bg-t-base rounded-2xl w-full max-w-7xl h-[95vh] flex flex-col border border-t-border shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden text-t-main">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-t-surface border-b border-t-border flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2 text-t-main">
            <Edit size={20} className="text-t-muted"/> 
            {modalMode === 'create' ? 'Create New Order' : `Edit Order ${safeData.invoice || ''}`}
          </h2>
          <button aria-label="Close order modal" onClick={() => setShowOrderModal(false)} className="text-t-muted hover:text-red-500 transition-colors"><X size={24}/></button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
          
          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-t-surface border border-t-border rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-t-muted mb-2">Our Record</h3>
                <div className="text-[11px] space-y-1 font-mono">
                  <p className="text-blue-500">• Total: {metrics.total_orders || 0}</p>
                  <p className="text-orange-500">• Pending: {metrics.pending || 0}</p>
                  <p className="text-red-500">• Returned: {metrics.returned || 0}</p>
                </div>
              </div>
              <button type="button" className="w-full mt-3 bg-t-primary/10 text-t-primary text-xs py-1.5 rounded-lg border border-t-primary/20 hover:bg-t-primary/20 transition-colors">Fill</button>
            </div>

            {['Overall', 'Pathao', 'RedX'].map((courier) => {
              let sRate = metrics.success_rate || 0;
              let total = metrics.total_orders || 0;
              let success = metrics.successful_orders || 0;
              let cancelled = total - success;

              if (courier !== 'Overall' && metrics.breakdown) {
                const bd = metrics.breakdown.find(b => b.courier?.toLowerCase() === courier.toLowerCase());
                if (bd) { 
                  total = bd.total || 0; success = bd.success || 0; 
                  sRate = total > 0 ? Math.round((success/total)*100) : 0; 
                  cancelled = total - success; 
                } else { 
                  total = 0; success = 0; sRate = 0; cancelled = 0; 
                }
              }

              return (
                <div key={courier} className="bg-t-surface border border-t-border rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold text-t-main">{courier} {courier === 'Overall' && <RefreshCw size={12} className="inline ml-1 text-t-muted"/>}</h3>
                  </div>
                  <p className={`text-[11px] mb-2 ${sRate >= 80 ? 'text-green-500' : 'text-orange-500'}`}>Success Rate: {sRate}%</p>
                  <div className="text-[11px] text-t-muted space-y-0.5">
                    <p>Total: {total}</p><p>Success: {success}</p><p>Cancelled: {cancelled}</p>
                  </div>
                  <div className="w-full bg-t-base border border-t-border h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className={`${sRate >= 80 ? 'bg-green-500' : 'bg-orange-500'} h-full`} style={{width: `${sRate}%`}}></div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Customer Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div>
                <label className="text-[11px] text-t-muted font-bold mb-1.5 block">Mobile Number</label>
                <div className="relative">
                  <input type="text" value={customer.phone || ''} onChange={e => setOrderFormData({...safeData, customer: {...customer, phone: e.target.value}})} className="w-full bg-t-surface border border-t-border rounded-lg p-2.5 text-sm outline-none focus:border-t-primary text-t-main" />
                  <div className="absolute right-3 top-2.5 flex gap-2 text-t-primary">
                     <Phone size={14}/><MessageCircle size={14}/>
                  </div>
                </div>
                <p className="text-[10px] text-blue-500 mt-1 cursor-pointer">Check Our Record above for customer history</p>
             </div>
             <div>
                <label className="text-[11px] text-t-muted font-bold mb-1.5 block">Name</label>
                <input type="text" value={customer.name || ''} onChange={e => setOrderFormData({...safeData, customer: {...customer, name: e.target.value}})} className="w-full bg-t-surface border border-t-border rounded-lg p-2.5 text-sm outline-none focus:border-t-primary text-t-main" />
             </div>
             <div>
                <label className="text-[11px] text-t-muted font-bold mb-1.5 block">Delivery Method</label>
                <select value={safeData.deliveryMethod || 'PATHAO'} onChange={e => setOrderFormData({...safeData, deliveryMethod: e.target.value})} className="w-full bg-t-surface border border-t-border rounded-lg p-2.5 text-sm outline-none focus:border-t-primary text-t-main uppercase">
                  {couriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
             </div>
          </div>

          {/* Address & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div>
                <label className="text-[11px] text-t-muted font-bold mb-1.5 block">Address</label>
                <textarea rows="3" value={customer.address || ''} onChange={e => setOrderFormData({...safeData, customer: {...customer, address: e.target.value}})} className="w-full bg-t-surface border border-t-border rounded-lg p-2.5 text-sm outline-none focus:border-t-primary text-t-main custom-scrollbar"></textarea>
             </div>
             <div>
                <label className="text-[11px] text-t-muted font-bold mb-1.5 flex justify-between">Shipping Note <Plus size={12} className="border border-t-muted rounded cursor-pointer hover:text-t-main"/></label>
                <textarea rows="3" value={safeShippingNote} onChange={e => setOrderFormData({...safeData, shippingNote: e.target.value})} className="w-full bg-t-surface border border-t-border rounded-lg p-2.5 text-sm outline-none focus:border-t-primary text-t-main custom-scrollbar"></textarea>
                <div className="text-right text-[10px] text-t-muted mt-1">{noteLength}/350</div>
             </div>
             <div>
                <label className="text-[11px] text-t-muted font-bold mb-1.5 block">Extra Options</label>
                <div className="bg-t-surface border border-t-border rounded-lg p-3 flex justify-between items-center h-[88px]">
                   <div className="flex gap-3 text-t-muted">
                      <FileText size={16} className="cursor-pointer hover:text-t-main"/>
                      <ExternalLink size={16} className="cursor-pointer hover:text-t-main"/>
                      <Tags size={16} className="cursor-pointer hover:text-t-main"/>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-[10px] text-t-muted uppercase font-bold">Cross Sale</span>
                      <div onClick={() => setOrderFormData({...safeData, crossSale: !safeData.crossSale})} className={`w-10 h-5 rounded-full cursor-pointer flex items-center p-1 ${safeData.crossSale ? 'bg-green-500' : 'bg-t-base border border-t-border'}`}>
                        <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform ${safeData.crossSale ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Products Split Layout */}
          <div className="flex flex-col lg:flex-row gap-6 mt-2">
             {/* Left: Ordered Products */}
             <div className="flex-1 bg-t-surface border border-t-border rounded-xl p-4 flex flex-col">
                <h3 className="text-[13px] font-bold text-t-main mb-4 flex items-center gap-2">Ordered Products <span className="bg-t-base border border-t-border text-t-muted px-2 py-0.5 rounded text-[10px]">{itemsCount}</span></h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                   {itemsList.map((item, idx) => (
                      <div key={idx} className="bg-t-base border border-t-border p-3 rounded-lg relative">
                         <button type="button" onClick={() => removeModalItem(idx)} className="absolute top-3 right-3 text-red-500/80 hover:text-red-500 bg-red-500/10 p-1.5 rounded"><Trash2 size={14}/></button>
                         <div className="flex gap-3 mb-3">
                            <div className="w-12 h-12 bg-white rounded flex items-center justify-center text-[8px] text-black text-center font-bold overflow-hidden border border-t-border">
                              {item.image ? <img src={item.image} className="w-full h-full object-cover" alt="product"/> : item.sku}
                            </div>
                            <div>
                               <h4 className="text-[13px] font-bold text-t-main leading-tight">{item.name}</h4>
                               <div className="text-[10px] text-t-muted mt-1 flex gap-2 items-center">
                                  {/* 🟢 [UPDATE]: Item badge now reflects if it's a variant */}
                                  <span className="bg-t-surface border border-t-border px-1.5 py-0.5 rounded text-t-primary">
                                    {item.variant_id ? 'Variant' : 'Primary'}
                                  </span> 
                                  <span>৳{item.price}</span>
                                  <span>SKU: {item.sku}</span>
                                  {item.size && <span className="text-t-muted">Var SKU: {item.sku}-{item.size.toUpperCase().replace(/\s+/g, '')}</span>}
                               </div>
                            </div>
                         </div>
                         <div className="grid grid-cols-3 gap-4 border-t border-t-border pt-3">
                            <div>
                              <label className="text-[10px] text-t-muted block mb-1">Qty</label>
                              <div className="flex items-center bg-t-surface border border-t-border rounded overflow-hidden">
                                <button type="button" onClick={() => handleModalItemChange(idx, 'quantity', Math.max(1, (item.quantity || 1) - 1))} className="px-2 py-1 text-t-muted hover:text-t-main bg-t-base border-r border-t-border">-</button>
                                <input type="text" value={item.quantity || 1} readOnly className="w-full bg-transparent text-center text-sm font-bold text-t-main outline-none p-1" />
                                <button type="button" onClick={() => handleModalItemChange(idx, 'quantity', parseInt(item.quantity || 1) + 1)} className="px-2 py-1 text-t-muted hover:text-t-main bg-t-base border-l border-t-border">+</button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-t-muted block mb-1">Price</label>
                              <input type="number" value={item.price || 0} onChange={e => handleModalItemChange(idx, 'price', e.target.value)} className="w-full bg-t-surface border border-t-border rounded p-1 text-center text-sm font-bold text-t-main outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] text-t-muted block mb-1">Total</label>
                              <div className="w-full bg-t-surface border border-t-border rounded p-1.5 text-center text-sm font-bold text-t-main">
                                {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                              </div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             {/* Right: Product Search */}
             <div className="w-full lg:w-[350px] bg-t-surface border border-t-border rounded-xl p-4 flex flex-col h-[480px]">
                <h3 className="text-[13px] font-bold text-t-main mb-3">Click To Add Products</h3>
                <div className="flex gap-2 mb-2 shrink-0">
                   <div className="flex-1">
                      <label className="text-[10px] text-t-muted block mb-1">Code/sku</label>
                      <input type="text" placeholder="Type to Search.." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full bg-t-base border border-t-border rounded-lg p-2 text-xs text-t-main outline-none focus:border-t-primary transition-colors" />
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar mt-2 pr-1 space-y-2">
                   {/* 🟢 [UPDATE]: Variant Flattening Logic Here */}
                   {(products || [])
                      .flatMap(p => 
                          (p.variants && p.variants.length > 0) 
                            ? p.variants.map(v => ({ ...p, ...v, main_product_id: p.id, is_variant: true }))
                            : [{ ...p, main_product_id: p.id, is_variant: false }]
                      )
                      .filter(p => (p.sku?.toLowerCase().includes((productSearch||'').toLowerCase()) || p.name?.toLowerCase().includes((productSearch||'').toLowerCase())))
                      .map((prod) => (
                      <div 
                         key={prod.is_variant ? `var-${prod.id}` : `prod-${prod.main_product_id}`} 
                         // 🟢 [UPDATE]: Correctly mapping product_id and variant_id to state
                         onClick={() => addProductToOrder({
                             product_id: prod.main_product_id,
                             variant_id: prod.is_variant ? prod.id : null,
                             name: prod.is_variant ? `${prod.name} - ${prod.variant_name || prod.color || prod.size}` : prod.name,
                             sku: prod.sku,
                             price: prod.price,
                             image: prod.image_url,
                             quantity: 1
                         })} 
                         className="bg-t-base border border-t-border p-2 rounded-lg flex gap-3 cursor-pointer hover:border-t-primary transition-colors group relative shrink-0"
                      >
                         <div className="absolute right-2 top-2 text-t-primary opacity-0 group-hover:opacity-100"><Star size={14} fill="currentColor"/></div>
                         <div className="w-14 h-14 bg-white rounded flex items-center justify-center border border-t-border shrink-0">
                           {prod.image_url ? <img src={prod.image_url} className="w-full h-full object-cover rounded" alt="prod"/> : <ImageIcon size={20} className="text-t-muted"/>}
                         </div>
                         <div className="flex flex-col justify-between w-full">
                            <div>
                               <h4 className="text-[12px] font-bold text-t-main line-clamp-1 pr-4">
                                  {prod.is_variant ? `${prod.name} (${prod.variant_name || prod.size || prod.color})` : prod.name}
                               </h4>
                                 <p className="text-[10px] font-black text-t-muted mt-0.5">
                                   SKU: {prod.sku || 'N/A'}
                                   {prod.size && <span className="ml-1 text-t-primary">Var SKU: {prod.sku}-{prod.size.toUpperCase().replace(/\s+/g, '')}</span>}
                                 </p>
                            </div>
                            <div className="flex justify-between items-end mt-1 text-[10px] text-t-muted">
                               <span>Price: ৳{prod.price}</span>
                               <span className={prod.stock > 0 || prod.stock_quantity > 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                                  Stock: {prod.stock !== undefined ? prod.stock : (prod.stock_quantity || 0)}
                               </span>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>

        </div>

        {/* Footer Totals & Submit */}
        <form onSubmit={submitOrderForm} className="bg-t-surface border-t border-t-border p-6 shrink-0 flex flex-col gap-4">
           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="text-[11px] text-t-muted font-bold block mb-1.5">Discount</label>
                <input type="number" value={billing.discount || 0} onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  const newTotal = ((billing.subTotal || 0) + parseFloat(billing.deliveryCharge || 0)) - val - parseFloat(billing.advance || 0);
                  setOrderFormData({...safeData, billing: {...billing, discount: val, total: newTotal}});
                }} className="w-full bg-t-base border border-t-border rounded p-2.5 text-sm outline-none text-t-main text-center focus:border-t-primary" />
              </div>
              <div>
                <label className="text-[11px] text-t-muted font-bold block mb-1.5">Advance</label>
                <input type="number" value={billing.advance || 0} onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  const newTotal = ((billing.subTotal || 0) + parseFloat(billing.deliveryCharge || 0)) - parseFloat(billing.discount || 0) - val;
                  setOrderFormData({...safeData, billing: {...billing, advance: val, total: newTotal}});
                }} className="w-full bg-t-base border border-t-border rounded p-2.5 text-sm outline-none text-t-main text-center focus:border-t-primary" />
              </div>
              <div>
                <label className="text-[11px] text-t-muted font-bold block mb-1.5">Sub Total</label>
                <input type="text" readOnly value={billing.subTotal || 0} className="w-full bg-t-base opacity-70 border border-t-border rounded p-2.5 text-sm text-t-muted text-center cursor-not-allowed" />
              </div>
              <div>
                <label className="text-[11px] text-t-muted font-bold block mb-1.5">Delivery Charge</label>
                <input type="number" value={billing.deliveryCharge || 0} onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  const newTotal = ((billing.subTotal || 0) + val) - parseFloat(billing.discount || 0) - parseFloat(billing.advance || 0);
                  setOrderFormData({...safeData, billing: {...billing, deliveryCharge: val, total: newTotal}});
                }} className="w-full bg-t-base border border-t-border rounded p-2.5 text-sm outline-none text-t-main text-center focus:border-t-primary" />
              </div>
              <div>
                <label className="text-[11px] text-t-muted font-bold block mb-1.5 text-red-500">Grand Total</label>
                <input type="text" readOnly value={billing.total || 0} className="w-full bg-red-500/10 border border-red-500/30 rounded p-2.5 text-sm text-red-500 font-black text-center outline-none" />
              </div>
           </div>
           
           <div className="flex justify-center gap-4 mt-2">
              <button type="button" onClick={() => setShowOrderModal(false)} className="px-8 py-2.5 rounded-lg border border-t-border bg-t-base text-t-main font-bold hover:bg-t-primary/10 hover:text-t-primary transition-colors">Back</button>
              <button type="submit" disabled={isSaving} className="px-8 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all flex items-center gap-2">
                {isSaving ? 'Processing...' : `Save Order (${billing.total || 0}৳)`}
              </button>
           </div>
        </form>

      </div>
    </div>
  );
}

OrderModal.propTypes = {
  modalMode: PropTypes.string,
  orderFormData: PropTypes.object,
  setOrderFormData: PropTypes.func.isRequired,
  setShowOrderModal: PropTypes.func.isRequired,
  submitOrderForm: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
  couriers: PropTypes.array,
  products: PropTypes.array,
  productSearch: PropTypes.string,
  setProductSearch: PropTypes.func.isRequired,
  addProductToOrder: PropTypes.func.isRequired,
  removeModalItem: PropTypes.func.isRequired,
  handleModalItemChange: PropTypes.func.isRequired,
};