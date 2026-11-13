import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';
import LiveMathWidget from '../components/ui/LiveMathWidget';
import { getToken } from '../utils/auth';
import { thumbUrl } from '../utils/imageUrl';

/**
 * ComboBuilder — Drag-and-Drop Combo Builder Page
 *
 * Split-screen layout:
 *   Left  → Product pool (draggable cards)
 *   Right → Combo Canvas (drop zone) + Live Math Widget
 */
export default function ComboBuilder() {
  const { isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;

  const [products, setProducts] = useState([]);
  const [comboItems, setComboItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const [comboName, setComboName] = useState('');
  const [comboDiscount, setComboDiscount] = useState('10');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const canvasRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Fetch all products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (json.success) setProducts(json.data || []);
      } catch (err) {
        console.error('Fetch products error:', err);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // ── Drag Handlers ──
  const handleDragStart = (e, product) => {
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCanvas(true);
  };

  const handleCanvasDragLeave = (e) => {
    // Only set false if we're actually leaving the canvas
    if (!canvasRef.current?.contains(e.relatedTarget)) {
      setDragOverCanvas(false);
    }
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setDragOverCanvas(false);
    try {
      const product = JSON.parse(e.dataTransfer.getData('application/json'));
      // Check if already in combo
      if (comboItems.find((item) => item.id === product.id)) {
        showToast('Product already in combo', 'error');
        return;
      }
      setComboItems((prev) => [
        ...prev,
        {
          ...product,
          comboQty: 1,
          overridePrice: product.price,
        },
      ]);
      showToast(`${product.name} added to combo`, 'success');
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // ── Combo Item Actions ──
  const removeComboItem = (id) => {
    setComboItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateComboQty = (id, qty) => {
    const newQty = Math.max(1, parseInt(qty) || 1);
    setComboItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, comboQty: newQty } : item))
    );
  };

  const updateOverridePrice = (id, price) => {
    setComboItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, overridePrice: parseFloat(price) || 0 } : item))
    );
  };

  // ── Calculate Combo Math ──
  const comboMath = React.useMemo(() => {
    const regularTotal = comboItems.reduce(
      (sum, item) => sum + Number(item.price) * item.comboQty,
      0
    );
    const overrideTotal = comboItems.reduce(
      (sum, item) => sum + (Number(item.overridePrice) || Number(item.price)) * item.comboQty,
      0
    );
    const discountPercent = parseFloat(comboDiscount) || 0;
    const discountAmount = (regularTotal * discountPercent) / 100;
    const finalComboPrice = regularTotal - discountAmount;
    const totalCost = comboItems.reduce(
      (sum, item) => sum + (Number(item.cost_price) || 0) * item.comboQty,
      0
    );
    const profit = finalComboPrice - totalCost;
    const margin = finalComboPrice > 0 ? ((profit / finalComboPrice) * 100).toFixed(1) : 0;

    return {
      regularTotal,
      overrideTotal,
      discountPercent,
      discountAmount,
      finalComboPrice,
      totalCost,
      profit,
      margin,
      itemCount: comboItems.length,
    };
  }, [comboItems, comboDiscount]);

  // ── Save Combo ──
  const handleSaveCombo = async () => {
    if (comboItems.length === 0) {
      showToast('Add products to combo first', 'error');
      return;
    }
    if (!comboName.trim()) {
      showToast('Enter a combo name', 'error');
      return;
    }

    const comboData = {
      name: comboName,
      discount_percent: comboDiscount,
      items: comboItems.map((item) => ({
        product_id: item.id,
        quantity: item.comboQty,
        override_price: item.overridePrice,
      })),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/combos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(comboData),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Combo saved successfully!', 'success');
        setComboItems([]);
        setComboName('');
      } else {
        showToast(json.message || 'Failed to save combo', 'error');
      }
    } catch {
      showToast('Server connection failed', 'error');
    }
  };

  // ── Filtered products for left panel ──
  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku_code || p.sku || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Theme Classes ──
  const bgBase = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const bgSurface = isDark ? 'bg-gray-900/60' : 'bg-white/70';
  const bgCard = isDark ? 'bg-gray-800/60' : 'bg-white/80';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderMain = isDark ? 'border-white/10' : 'border-gray-200/60';

  return (
    <div className={`h-screen flex flex-col ${bgBase} overflow-hidden`}>
      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[1000] px-5 py-3 rounded-2xl backdrop-blur-xl shadow-2xl border border-white/20 font-bold text-sm flex items-center gap-2 transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Header */}
      <div className={`shrink-0 px-6 py-4 border-b ${borderMain} ${bgSurface} backdrop-blur-xl flex items-center justify-between`}>
        <div>
          <h1 className={`text-xl font-extrabold tracking-tight ${textMain}`}>
            🎯 Combo Builder
          </h1>
          <p className={`text-xs ${textMuted} mt-0.5`}>
            Drag products from the left → drop into the canvas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            comboItems.length > 0
              ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-white/10 text-gray-500'
          }`}>
            {comboItems.length} items
          </span>
          <button
            onClick={() => { setComboItems([]); setComboName(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold border ${borderMain} ${textMuted} hover:bg-gray-100 dark:hover:bg-white/10 transition-all`}
          >
            Clear All
          </button>
          <button
            onClick={handleSaveCombo}
            disabled={comboItems.length === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            💾 Save Combo
          </button>
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Panel: Product Pool ── */}
        <div className={`w-[380px] shrink-0 border-r ${borderMain} ${bgSurface} backdrop-blur-xl flex flex-col`}>
          {/* Search */}
          <div className="p-4 border-b border-gray-200/30 dark:border-white/5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border ${borderMain} ${bgCard} backdrop-blur-sm ${textMain} placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
              />
            </div>
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className={`text-center py-16 ${textMuted} text-xs`}>No products found</div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, product)}
                  onDragEnd={handleDragEnd}
                  className={`
                    group cursor-grab active:cursor-grabbing
                    p-3 rounded-xl border ${borderMain}
                    ${bgCard} backdrop-blur-sm
                    hover:border-indigo-300 dark:hover:border-indigo-500/30
                    hover:shadow-lg hover:shadow-indigo-500/10
                    hover:-translate-y-0.5
                    transition-all duration-200
                    ${comboItems.find((i) => i.id === product.id)
                      ? 'opacity-40 border-indigo-300 dark:border-indigo-500/30 pointer-events-none'
                      : ''
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <div className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="5" r="1.5"/>
                        <circle cx="15" cy="5" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/>
                        <circle cx="15" cy="12" r="1.5"/>
                        <circle cx="9" cy="19" r="1.5"/>
                        <circle cx="15" cy="19" r="1.5"/>
                      </svg>
                    </div>

                    {/* Image */}
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {product.image_url ? (
                        <img
                          src={thumbUrl(product.image_url.startsWith('http') ? product.image_url : `${API_BASE_URL}${product.image_url}`, 80)}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain"
                          alt={product.name}
                        />
                      ) : (
                        <span className="text-sm opacity-30">📦</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${textMain} truncate`}>{product.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {product.sku || product.sku_code} · Stock: {product.stock_quantity || 0}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-extrabold ${textMain}`}>৳{product.price}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Combo Canvas ── */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Combo Name & Discount */}
          <div className={`px-6 py-3 border-b ${borderMain} flex items-center gap-4 ${bgSurface} backdrop-blur-xl`}>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Combo name (e.g. Summer Collection Pack)"
                value={comboName}
                onChange={(e) => setComboName(e.target.value)}
                className={`w-full px-4 py-2 text-sm font-bold rounded-xl border ${borderMain} bg-transparent ${textMain} placeholder-gray-400 outline-none focus:border-indigo-400 transition-all`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-xs font-bold ${textMuted}`}>Discount:</label>
              <div className="relative">
                <input
                  type="number"
                  value={comboDiscount}
                  onChange={(e) => setComboDiscount(e.target.value)}
                  min="0"
                  max="100"
                  className={`w-20 px-3 py-2 text-sm font-bold rounded-xl border ${borderMain} ${bgCard} ${textMain} text-center outline-none focus:border-indigo-400 transition-all`}
                />
                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${textMuted}`}>%</span>
              </div>
            </div>
          </div>

          {/* Canvas Drop Zone */}
          <div
            ref={canvasRef}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            className={`
              flex-1 overflow-y-auto p-6 transition-all duration-300
              ${dragOverCanvas
                ? 'bg-indigo-50/50 dark:bg-indigo-500/[0.05] ring-2 ring-inset ring-indigo-400/40'
                : ''
              }
            `}
          >
            {comboItems.length === 0 ? (
              /* Empty State */
              <div className={`h-full flex flex-col items-center justify-center ${dragOverCanvas ? 'scale-105' : ''} transition-transform duration-300`}>
                <div className={`
                  w-32 h-32 rounded-3xl flex items-center justify-center mb-6
                  ${dragOverCanvas
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 border-2 border-dashed border-indigo-400'
                    : 'bg-gray-100 dark:bg-white/5 border-2 border-dashed border-gray-300 dark:border-white/10'
                  }
                  transition-all duration-300
                `}>
                  <span className={`text-5xl ${dragOverCanvas ? 'animate-bounce' : ''}`}>
                    {dragOverCanvas ? '📥' : '🎯'}
                  </span>
                </div>
                <h3 className={`text-lg font-bold ${textMain} mb-2`}>
                  {dragOverCanvas ? 'Release to Add!' : 'Drop Products Here'}
                </h3>
                <p className={`text-xs ${textMuted} max-w-xs text-center`}>
                  {dragOverCanvas
                    ? 'Drop the product to add it to your combo'
                    : 'Drag products from the left panel and drop them here to build a combo set'}
                </p>
              </div>
            ) : (
              /* Combo Items Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {comboItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`
                      group relative p-4 rounded-2xl border ${borderMain}
                      ${bgCard} backdrop-blur-xl
                      hover:shadow-xl hover:shadow-indigo-500/10
                      hover:border-indigo-300 dark:hover:border-indigo-500/30
                      transition-all duration-300
                      animate-in fade-in slide-in-from-bottom-2
                    `}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Item Number Badge */}
                    <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-indigo-500/30">
                      {index + 1}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeComboItem(item.id)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-bold transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>

                    {/* Product Info */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 flex items-center justify-center overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={thumbUrl(item.image_url.startsWith('http') ? item.image_url : `${API_BASE_URL}${item.image_url}`, 96)}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                            alt={item.name}
                          />
                        ) : (
                          <span className="text-lg opacity-30">📦</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold ${textMain} truncate`}>{item.name}</p>
                        <p className="text-[10px] text-gray-400">{item.sku || item.sku_code}</p>
                      </div>
                    </div>

                    {/* Quantity & Price Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold ${textMuted} uppercase`}>Qty</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateComboQty(item.id, item.comboQty - 1)}
                            className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-600 flex items-center justify-center text-xs font-bold transition-all"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={item.comboQty}
                            onChange={(e) => updateComboQty(item.id, e.target.value)}
                            min="1"
                            className="w-10 text-center text-xs font-bold bg-transparent outline-none"
                          />
                          <button
                            onClick={() => updateComboQty(item.id, item.comboQty + 1)}
                            className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-600 flex items-center justify-center text-xs font-bold transition-all"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold ${textMuted} uppercase`}>Price</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs ${textMuted}`}>৳</span>
                          <input
                            type="number"
                            value={item.overridePrice}
                            onChange={(e) => updateOverridePrice(item.id, e.target.value)}
                            className={`w-20 text-right text-xs font-bold bg-transparent outline-none border-b border-dashed ${borderMain} focus:border-indigo-400 transition-all`}
                          />
                        </div>
                      </div>

                      <div className={`flex items-center justify-between pt-1 border-t ${borderMain}`}>
                        <span className={`text-[10px] font-bold ${textMuted}`}>Subtotal</span>
                        <span className={`text-xs font-extrabold ${textMain}`}>
                          ৳{((Number(item.overridePrice) || Number(item.price)) * item.comboQty).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Math Widget (Floating at Bottom) */}
          {comboItems.length > 0 && (
            <LiveMathWidget math={comboMath} isDark={isDark} />
          )}
        </div>
      </div>
    </div>
  );
}
