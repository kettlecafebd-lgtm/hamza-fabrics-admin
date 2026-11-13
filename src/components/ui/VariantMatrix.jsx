import React, { useState, useEffect, useCallback } from 'react';
import InlineEditableCell from './InlineEditableCell';
import StatusBadge, { StockIndicator } from './StatusBadge';
import { thumbUrl, srcSet, IMAGE_PLACEHOLDER } from '../../utils/imageUrl';

/**
 * VariantMatrix — Premium Accordion Table for Product & Variant Management
 *
 * Features:
 *   - Collapsible product rows with animated variant expansion
 *   - Inline double-click editing for stock & price
 *   - Glassmorphism variant panel
 *   - Premium accent colors (Electric Blue / Neon Orange)
 *   - Smooth CSS animations
 *
 * Props:
 *   products           — array of product objects
 *   API_BASE_URL       — backend URL
 *   onEditProduct(product)   — callback to open edit modal
 *   onDeleteProduct(id)      — callback to delete
 *   onDuplicateProduct(id)   — callback to duplicate
 *   onToggleActive(id, current) — callback to toggle active status
 *   onStockUpdate(productId, variantId, newStock) — callback for inline stock edit
 *   onPriceUpdate(productId, variantId, newPrice) — callback for inline price edit
 *   onViewImage(url)         — callback to open image viewer
 */
export default function VariantMatrix({
  products = [],
  API_BASE_URL = '',
  onEditProduct,
  onDeleteProduct,
  onDuplicateProduct,
  onToggleActive,
  onStockUpdate,
  onPriceUpdate,
  onViewImage,
  onTag,
  onHistory,
}) {
  const [expandedRows, setExpandedRows] = useState([]);
  const [openActionId, setOpenActionId] = useState(null);

  // Close action dropdown on outside click
  useEffect(() => {
    const handler = () => setOpenActionId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const toggleExpand = useCallback(async (id) => {
    if (expandedRows.includes(id)) {
      setExpandedRows((prev) => prev.filter((rowId) => rowId !== id));
    } else {
      setExpandedRows((prev) => [...prev, id]);
    }
  }, [expandedRows]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white/50 dark:bg-gray-900/40 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20">
      <table className="w-full text-left text-sm">
        {/* ── Table Head ── */}
        <thead>
          <tr className="border-b border-gray-200/60 dark:border-white/10">
            <th className="p-4 w-12" />
            <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Product</th>
            <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">SKU</th>
            <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider min-w-[180px]">Performance</th>
            <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Price</th>
            <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Status</th>
            <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          {products.map((p) => {
            const sold = Number(p.total_sold) || 0;
            const returned = Number(p.total_returned) || 0;
            const currentStock = Number(p.stock_quantity) || 0;
            const initialStock = currentStock + sold - returned;
            const isExpanded = expandedRows.includes(p.id);
            const isActive = p.is_active !== false;

            return (
              <React.Fragment key={p.id}>
                {/* ── Main Product Row ── */}
                <tr
                  className={`
                    border-b border-gray-100 dark:border-white/5
                    transition-all duration-200
                    ${isExpanded
                      ? 'bg-indigo-50/30 dark:bg-indigo-500/5'
                      : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.02]'
                    }
                    ${!isActive ? 'opacity-45' : ''}
                  `}
                >
                  {/* Expand/Collapse Toggle */}
                  <td className="p-4">
                    <button
                      onClick={() => toggleExpand(p.id)}
                      className={`
                        w-8 h-8 rounded-xl flex items-center justify-center
                        transition-all duration-300
                        ${isExpanded
                          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rotate-90'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-500'
                        }
                      `}
                      title={isExpanded ? 'Collapse variants' : 'Show variants'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </td>

                  {/* Product Info */}
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {p.image_url ? (
                          <img
                            onClick={() => onViewImage?.(
                              p.image_url.startsWith('http') ? p.image_url : `${API_BASE_URL}${p.image_url}`
                            )}
                            src={thumbUrl(p.image_url.startsWith('http') ? p.image_url : `${API_BASE_URL}${p.image_url}`, 96)}
                            srcSet={srcSet(p.image_url.startsWith('http') ? p.image_url : `${API_BASE_URL}${p.image_url}`, [96, 192])}
                            sizes="48px"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain cursor-pointer hover:scale-110 transition-transform duration-300"
                            alt={p.name}
                          />
                        ) : (
                          <span className="text-lg opacity-30">📦</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
                          {p.name}
                        </p>
                        {p.brand && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">
                            {p.brand}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="p-4">
                    <code className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-mono text-xs font-bold tracking-wide">
                      {p.sku || p.sku_code || '—'}
                    </code>
                  </td>

                  {/* Performance */}
                  <td className="p-4">
                    <StockIndicator current={currentStock} initial={initialStock} />
                  </td>

                  {/* Price */}
                  <td className="p-4">
                    <span className="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">
                      <span className="text-sm text-gray-400 dark:text-gray-500">৳</span>{' '}
                      {Number(p.price).toLocaleString()}
                    </span>
                    {Number(p.discount) > 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400">
                        -{p.discount}%
                      </span>
                    )}
                  </td>

                  {/* Status Toggle */}
                  <td className="p-4">
                    <button
                      onClick={() => onToggleActive?.(p.id, isActive)}
                      className={`
                        relative w-11 h-6 rounded-full transition-all duration-300
                        ${isActive
                          ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/25'
                          : 'bg-gray-300 dark:bg-white/15'
                        }
                      `}
                    >
                      <span
                        className={`
                          absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
                          transition-transform duration-300 ease-out
                          ${isActive ? 'translate-x-5' : 'translate-x-0'}
                        `}
                      />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionId(openActionId === p.id ? null : p.id);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200"
                      >
                        Actions ▾
                      </button>

                      {/* Dropdown */}
                      {openActionId === p.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-2 z-50 w-52 bg-white/80 dark:bg-gray-900/75 backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/10 shadow-2xl shadow-black/15 dark:shadow-black/50 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
                        >
                          <DropdownItem icon="✎" color="indigo" onClick={() => { setOpenActionId(null); onEditProduct?.(p); }}>Edit</DropdownItem>
                          <DropdownItem icon="⧉" color="blue" onClick={() => { setOpenActionId(null); onDuplicateProduct?.(p.id); }}>Duplicate</DropdownItem>
                          <DropdownItem icon="🏷" color="emerald" onClick={() => { setOpenActionId(null); onTag?.(p); }}>Tag</DropdownItem>
                          <DropdownItem icon="↻" color="violet" onClick={() => { setOpenActionId(null); onHistory?.(p, 'edit'); }}>Edit History</DropdownItem>
                          <DropdownItem icon="📦" color="amber" onClick={() => { setOpenActionId(null); onHistory?.(p, 'stock'); }}>Stock History</DropdownItem>
                          <div className="my-1 border-t border-gray-200/50 dark:border-white/10" />
                          <DropdownItem icon="🗑" color="red" onClick={() => { setOpenActionId(null); onDeleteProduct?.(p.id); }}>Delete</DropdownItem>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>

                {/* ── Expanded Variant Panel ── */}
                {isExpanded && (
                  <tr>
                    <td colSpan="7" className="p-0">
                      <div className="bg-gradient-to-b from-indigo-50/40 to-transparent dark:from-indigo-500/[0.03] dark:to-transparent">
                        <div className="px-16 py-5">
                          {/* Variant Header */}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Variant Matrix
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                              {p.variants?.length || 0} items
                            </span>
                          </div>

                          {p.variants && p.variants.length > 0 ? (
                            <div className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl rounded-xl border border-gray-200/50 dark:border-white/10 overflow-hidden shadow-lg shadow-black/[0.03] dark:shadow-black/10">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200/50 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                                    <th className="px-4 py-3 font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Image</th>
                                    <th className="px-4 py-3 font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Variant</th>
                                    <th className="px-4 py-3 font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Color</th>
                                    <th className="px-4 py-3 font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Size</th>
                                    <th className="px-4 py-3 font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-4 py-3 font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Cost</th>
                                    <th className="px-4 py-3 font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.variants.map((v, i) => {
                                    const variantStock = Number(v.stock) || 0;
                                    let stockStatus = 'good';
                                    if (variantStock === 0) stockStatus = 'out_of_stock';
                                    else if (variantStock <= 10) stockStatus = 'low_stock';

                                    return (
                                      <tr
                                        key={v.id || i}
                                        className="border-b border-gray-100/50 dark:border-white/5 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/[0.04] transition-colors group"
                                      >
                                        <td className="px-4 py-3">
                                          <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 flex items-center justify-center overflow-hidden">
                                            <img
                                              onClick={() => onViewImage?.(
                                                p.image_url
                                                  ? (p.image_url.startsWith('http') ? p.image_url : `${API_BASE_URL}${p.image_url}`)
                                                  : IMAGE_PLACEHOLDER
                                              )}
                                              src={thumbUrl(p.image_url
                                                ? (p.image_url.startsWith('http') ? p.image_url : `${API_BASE_URL}${p.image_url}`)
                                                : IMAGE_PLACEHOLDER, 72)}
                                              srcSet={srcSet(p.image_url
                                                ? (p.image_url.startsWith('http') ? p.image_url : `${API_BASE_URL}${p.image_url}`)
                                                : IMAGE_PLACEHOLDER, [72, 144])}
                                              sizes="36px"
                                              loading="lazy"
                                              decoding="async"
                                              className="w-full h-full object-contain cursor-pointer hover:scale-110 transition-transform"
                                              alt="variant"
                                            />
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                            {v.variant_name || `#${v.id}`}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {v.color ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 font-medium text-gray-700 dark:text-gray-300">
                                              <span className="w-2 h-2 rounded-full bg-gray-400" />
                                              {v.color}
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                                          {v.size || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-2">
                                            <InlineEditableCell
                                              value={v.stock || '0'}
                                              type="number"
                                              align="right"
                                              onSave={(newVal) => onStockUpdate?.(p.id, v.id, newVal)}
                                              displayClassName="font-bold text-gray-900 dark:text-white"
                                            />
                                            <StatusBadge status={stockStatus} size="sm" />
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-500 font-medium">
                                          ৳ {v.cost_price || 0}
                                        </td>
                                        <td className="px-4 py-3">
                                          <InlineEditableCell
                                            value={p.price || '0'}
                                            type="number"
                                            prefix="৳"
                                            align="right"
                                            onSave={(newVal) => onPriceUpdate?.(p.id, v.id, newVal)}
                                            displayClassName="font-extrabold text-gray-900 dark:text-white"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-10 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-200/50 dark:border-white/10 rounded-xl">
                              <div className="text-3xl mb-2 opacity-30">🔗</div>
                              <p className="text-sm font-medium">No variant mapping established</p>
                              <p className="text-xs mt-1 opacity-60">Click Edit to add variants</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Internal: Dropdown Menu Item ── */
function DropdownItem({ icon, color = 'gray', onClick, children }) {
  const colorMap = {
    indigo: 'text-indigo-500',
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    amber: 'text-amber-500',
    red: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
    gray: 'text-gray-500',
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-4 py-2.5 text-sm font-medium
        hover:bg-gray-100 dark:hover:bg-white/5
        flex items-center gap-2.5 transition-colors
        ${color === 'red' ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10' : `text-gray-700 dark:text-gray-300`}
      `}
    >
      <span className={`text-sm ${colorMap[color] || colorMap.gray}`}>{icon}</span>
      {children}
    </button>
  );
}
