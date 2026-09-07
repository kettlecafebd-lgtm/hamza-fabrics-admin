import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
// 🔴 ThemeContext ইমপোর্ট করা হলো (পাথ আপনার প্রজেক্ট অনুযায়ী ঠিক করে নেবেন)
import { ThemeContext } from '../context/ThemeContext'; 
import API_BASE_URL from '../config/api';

export default function SideCart() {
  const { cart, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useContext(CartContext);
  
  // 🔴 Context থেকে shopTheme নিয়ে আসা হলো
  const { shopTheme, isShopDark } = useContext(ThemeContext); 
  
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const itemsToFreeShipping = 3 - totalItems;

  return (
    <>
      {/* Background Overlay (Dimmed background when cart is open) */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isCartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsCartOpen(false)}
      ></div>

      {/* 🔴 Windows Start-Menu Style Floating Pop-up / Drawer (shopTheme ক্লাস যোগ করা হয়েছে) */}
      <div className={`fixed top-16 sm:top-20 right-4 sm:right-8 h-auto max-h-[85vh] w-[92%] sm:w-[420px] bg-t-surface backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[70] flex flex-col rounded-3xl border border-t-border transform transition-all duration-400 ease-in-out ${isCartOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95 pointer-events-none'} ${shopTheme}`}>
        
        {/* Header Area */}
        <div className="p-5 border-b border-t-border flex justify-between items-center rounded-t-3xl bg-t-base/50">
          <h2 className="text-xl font-black text-t-main tracking-tight flex items-center gap-3 uppercase">
            {/* 🔴 ইমোজি সরিয়ে প্রফেশনাল শপিং ব্যাগ আইকন দেওয়া হলো */}
            <svg className="w-6 h-6 text-t-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
            </svg>
            My Cart
          </h2>
          <div className="flex items-center gap-3">
             <span className="bg-t-primary/20 text-t-primary border border-t-primary/30 font-black px-3 py-1 rounded-full text-xs shadow-sm uppercase tracking-widest">{totalItems} Item{totalItems > 1 ? 's' : ''}</span>
             <button onClick={() => setIsCartOpen(false)} className="text-t-muted hover:text-white bg-t-base border border-t-border hover:bg-red-500 hover:border-red-500 shadow-sm hover:shadow-md w-8 h-8 rounded-full flex items-center justify-center transition-all text-xl font-bold">&times;</button>
          </div>
        </div>

        {/* Dynamic Free Shipping Notice */}
        <div className={`py-2.5 text-center text-[10px] font-black uppercase tracking-widest backdrop-blur-md transition-colors border-b border-t-border ${itemsToFreeShipping > 0 ? 'bg-t-primary/10 text-t-primary' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
          {itemsToFreeShipping > 0 
            ? `Add ${itemsToFreeShipping} more item${itemsToFreeShipping > 1 ? 's' : ''} for FREE SHIPPING!` 
            : '🎉 FREE SHIPPING UNLOCKED!'}
        </div>

        {/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-t-base/30">
          {cart.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-t-muted">
              {/* এম্পটি কার্ট আইকন */}
              <svg className="w-16 h-16 mb-4 opacity-40 text-t-muted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <p className="font-bold text-sm tracking-widest uppercase">Your cart is feeling light.</p>
              <button onClick={() => setIsCartOpen(false)} className="mt-4 text-t-primary text-[10px] font-black uppercase tracking-widest hover:underline">Continue Shopping</button>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="flex gap-4 items-center bg-t-surface backdrop-blur-md p-3 rounded-2xl border border-t-border shadow-sm hover:shadow-md transition-all group">
                <div className="w-16 h-20 bg-t-base rounded-xl overflow-hidden flex-shrink-0 relative shadow-inner border border-t-border/50">
                  {item.image_url ? (
                     <img src={item.image_url.startsWith('http') ? item.image_url : `${API_BASE_URL}${item.image_url}`} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-[10px] text-t-muted font-bold uppercase tracking-widest">No Img</div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-extrabold text-t-main text-xs leading-tight line-clamp-1">{item.name}</h4>
                  
                 {/* 🟢 [FIX]: ভ্যারিয়েন্ট থাকলে তার নাম দেখাবে, না থাকলে নরমাল সাইজ দেখাবে */}
                  {item.variant ? (
                     <p className="text-[9px] text-t-muted font-bold mt-1 uppercase tracking-wider">
                       Variant: <span className="text-t-main">{item.variant.name || item.selectedSize}</span>
                     </p>
                  ) : item.selectedSize && (
                     <p className="text-[9px] text-t-muted font-bold mt-1 uppercase tracking-wider">
                       Size: <span className="text-t-main">{item.selectedSize}</span>
                     </p>
                  )}
                  
                  <p className="font-black text-t-primary text-sm mt-1">৳ {item.price}</p>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center bg-t-base border border-t-border rounded-lg shadow-sm h-7 overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, item.selectedSize, -1)} className="px-2.5 text-t-muted hover:text-t-main font-bold hover:bg-t-surface transition-colors">-</button>
                      <span className="px-2 font-black text-xs w-6 text-center text-t-main border-x border-t-border/50 bg-t-surface">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.selectedSize, 1)} className="px-2.5 text-t-muted hover:text-t-main font-bold hover:bg-t-surface transition-colors">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id, item.selectedSize)} className="text-t-muted hover:text-white bg-t-base border border-t-border hover:bg-red-500 hover:border-red-500 w-7 h-7 rounded-lg transition-colors flex items-center justify-center text-xs shadow-sm">✕</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Area */}
        {cart.length > 0 && (
          <div className="p-5 bg-t-surface backdrop-blur-xl border-t border-t-border rounded-b-3xl">
            <div className="flex justify-between items-center text-sm font-bold text-t-muted mb-4">
              <span className="uppercase tracking-widest text-[10px]">Subtotal</span>
              <span className="text-t-main font-black text-lg">৳ {subtotal.toLocaleString()}</span>
            </div>
            <button 
              onClick={() => { setIsCartOpen(false); navigate('/checkout'); }}
              className="w-full bg-t-primary hover:opacity-90 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-t-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex justify-center items-center gap-2"
            >
              Checkout Now <span>→</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}