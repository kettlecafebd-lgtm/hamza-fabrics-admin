import React, { useState, useEffect, useContext, useMemo } from 'react';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';
import { getToken } from '../utils/auth';

/**
 * SharedPoolVisualizer — Visual Stock Network Graph
 *
 * Shows master stock as a central node with branches to products and their variants.
 * Low stock nodes pulse red. Interactive hover/click.
 */

// ── Color Helpers ──
function getStockColor(stock, maxStock) {
  const ratio = maxStock > 0 ? stock / maxStock : 0;
  if (stock === 0) return { fill: '#ef4444', stroke: '#dc2626', text: '#fef2f2', label: 'Out' };
  if (ratio <= 0.1) return { fill: '#f59e0b', stroke: '#d97706', text: '#fffbeb', label: 'Low' };
  if (ratio <= 0.3) return { fill: '#3b82f6', stroke: '#2563eb', text: '#eff6ff', label: 'Medium' };
  return { fill: '#10b981', stroke: '#059669', text: '#ecfdf5', label: 'Good' };
}

function getStockPulse(stock, maxStock) {
  const ratio = maxStock > 0 ? stock / maxStock : 0;
  if (stock === 0) return true;
  if (ratio <= 0.1) return true;
  return false;
}

// ── Animated Connection Line ──
function ConnectionLine({ x1, y1, x2, y2, color, pulse, delay = 0 }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const curveOffset = Math.abs(x2 - x1) * 0.2;

  return (
    <g>
      {/* Glow effect */}
      <path
        d={`M ${x1} ${y1} Q ${midX} ${y1 + curveOffset} ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeOpacity="0.1"
        className={pulse ? 'animate-pulse' : ''}
      />
      {/* Main line */}
      <path
        d={`M ${x1} ${y1} Q ${midX} ${y1 + curveOffset} ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={pulse ? '6 4' : 'none'}
        className={pulse ? 'animate-[dash_1s_linear_infinite]' : ''}
        style={{ animationDelay: `${delay}ms` }}
      />
      {/* Flow dot */}
      <circle r="3" fill={color} opacity="0.8">
        <animateMotion
          dur={`${2 + delay * 0.001}s`}
          repeatCount="indefinite"
          path={`M ${x1} ${y1} Q ${midX} ${y1 + curveOffset} ${x2} ${y2}`}
        />
      </circle>
    </g>
  );
}

// ── Stock Node (Circle) ──
function StockNode({ x, y, stock, maxStock, name, sku, isMaster, onClick, isHovered }) {
  const color = getStockColor(stock, maxStock);
  const shouldPulse = getStockPulse(stock, maxStock);
  const radius = isMaster ? 55 : 38;

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => {}}
    >
      {/* Pulse ring for low stock */}
      {shouldPulse && (
        <circle
          cx={x}
          cy={y}
          r={radius + 8}
          fill="none"
          stroke={color.fill}
          strokeWidth="2"
          opacity="0.4"
        >
          <animate
            attributeName="r"
            values={`${radius + 4};${radius + 16};${radius + 4}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.4;0.1;0.4"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Shadow */}
      <circle
        cx={x}
        cy={y + 3}
        r={radius}
        fill="black"
        opacity="0.1"
      />

      {/* Main circle */}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={color.fill}
        stroke={isHovered ? '#ffffff' : color.stroke}
        strokeWidth={isHovered ? 3 : 2}
        style={{ transition: 'all 0.3s ease' }}
      />

      {/* Inner glow */}
      <circle
        cx={x - radius * 0.2}
        cy={y - radius * 0.2}
        r={radius * 0.6}
        fill="white"
        opacity="0.1"
      />

      {/* Stock Number */}
      <text
        x={x}
        y={y - (isMaster ? 6 : 4)}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={isMaster ? 22 : 16}
        fontWeight="900"
        fontFamily="system-ui, sans-serif"
      >
        {stock}
      </text>

      {/* "pcs" label */}
      <text
        x={x}
        y={y + (isMaster ? 14 : 10)}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={isMaster ? 10 : 8}
        fontWeight="600"
        opacity="0.7"
        fontFamily="system-ui, sans-serif"
      >
        pcs
      </text>

      {/* Name label */}
      <text
        x={x}
        y={y + radius + 18}
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        className="fill-gray-700 dark:fill-gray-300"
      >
        {name.length > 18 ? name.slice(0, 18) + '…' : name}
      </text>

      {/* SKU badge */}
      {sku && (
        <text
          x={x}
          y={y + radius + 32}
          textAnchor="middle"
          fill="currentColor"
          fontSize="9"
          fontWeight="500"
          fontFamily="monospace"
          className="fill-gray-400 dark:fill-gray-600"
        >
          {sku}
        </text>
      )}

      {/* Status label */}
      <text
        x={x}
        y={y + radius + (sku ? 44 : 32)}
        textAnchor="middle"
        fill={color.fill}
        fontSize="9"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        {color.label}
      </text>
    </g>
  );
}

// ── Main Component ──
export default function SharedPoolVisualizer() {
  const { isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Fetch products with variants
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (json.success) {
          const prods = json.data || [];
          // Fetch variants for each product
          const enriched = await Promise.all(
            prods.map(async (p) => {
              try {
                const vRes = await fetch(`${API_BASE_URL}/api/variants/${p.id}`);
                const vJson = await vRes.json();
                return { ...p, variants: vJson.success ? vJson.variants || [] : [] };
              } catch {
                return { ...p, variants: [] };
              }
            })
          );
          setProducts(enriched);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // ── Calculate Layout ──
  const totalMasterStock = useMemo(
    () => products.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0), 0),
    [products]
  );

  const maxProductStock = useMemo(
    () => Math.max(...products.map((p) => Number(p.stock_quantity) || 0), 1),
    [products]
  );

  // Layout positions — circular arrangement around master node
  const SVG_WIDTH = 1200;
  const SVG_HEIGHT = 700;
  const CENTER_X = SVG_WIDTH / 2;
  const CENTER_Y = SVG_HEIGHT / 2;

  const productPositions = useMemo(() => {
    const count = products.length;
    if (count === 0) return [];
    const radius = 250;
    return products.map((p, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      return {
        ...p,
        x: CENTER_X + radius * Math.cos(angle),
        y: CENTER_Y + radius * Math.sin(angle),
      };
    });
  }, [products]);

  // ── Theme ──
  const bgBase = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const bgSurface = isDark ? 'bg-gray-900/60' : 'bg-white/70';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderMain = isDark ? 'border-white/10' : 'border-gray-200/60';

  // ── Stats ──
  const lowStockCount = products.filter((p) => {
    const s = Number(p.stock_quantity) || 0;
    return s > 0 && s <= 10;
  }).length;
  const outOfStockCount = products.filter((p) => (Number(p.stock_quantity) || 0) === 0).length;
  const healthyCount = products.filter((p) => (Number(p.stock_quantity) || 0) > 10).length;

  return (
    <div className={`min-h-screen ${bgBase} text-t-main`}>
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[1000] px-5 py-3 rounded-2xl backdrop-blur-xl shadow-2xl border border-white/20 font-bold text-sm ${
          toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className={`px-6 py-4 border-b ${borderMain} ${bgSurface} backdrop-blur-xl`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-extrabold tracking-tight ${textMain}`}>
              🕸️ Shared Pool Visualizer
            </h1>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Visual stock network — click a product node to inspect variants
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> Good
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500" /> Medium
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" /> Low
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> Out
              </span>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 mt-3">
          <div className={`px-4 py-2 rounded-xl ${bgSurface} border ${borderMain}`}>
            <span className={`text-[10px] font-bold ${textMuted} uppercase`}>Master Stock</span>
            <p className={`text-lg font-black ${textMain}`}>{totalMasterStock.toLocaleString()} pcs</p>
          </div>
          <div className={`px-4 py-2 rounded-xl ${bgSurface} border ${borderMain}`}>
            <span className={`text-[10px] font-bold ${textMuted} uppercase`}>Products</span>
            <p className={`text-lg font-black ${textMain}`}>{products.length}</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Healthy</span>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{healthyCount}</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Low Stock</span>
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">{lowStockCount}</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20">
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Out of Stock</span>
            <p className="text-lg font-black text-red-600 dark:text-red-400">{outOfStockCount}</p>
          </div>
        </div>
      </div>

      {/* Graph Area */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className={`text-center py-32 ${textMuted}`}>
            <p className="text-4xl mb-4 opacity-30">🕸️</p>
            <p className="font-bold">No products found</p>
          </div>
        ) : (
          <div className={`${bgSurface} backdrop-blur-xl rounded-3xl border ${borderMain} shadow-xl overflow-hidden`}>
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full"
              style={{ minHeight: '500px' }}
            >
              <defs>
                {/* Gradient for master node */}
                <radialGradient id="masterGrad" cx="30%" cy="30%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </radialGradient>
                {/* Glow filter */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background grid pattern */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Connection lines from master to products */}
              {productPositions.map((p, i) => (
                <ConnectionLine
                  key={`line-${p.id}`}
                  x1={CENTER_X}
                  y1={CENTER_Y}
                  x2={p.x}
                  y2={p.y}
                  color={getStockColor(Number(p.stock_quantity) || 0, maxProductStock).fill}
                  pulse={getStockPulse(Number(p.stock_quantity) || 0, maxProductStock)}
                  delay={i * 100}
                />
              ))}

              {/* Connection lines from product to its variants */}
              {selectedProduct && productPositions.filter((p) => p.id === selectedProduct.id).map((p) => {
                const variants = p.variants || [];
                if (variants.length === 0) return null;
                const variantRadius = 80;
                return variants.map((v, vi) => {
                  const angle = (2 * Math.PI * vi) / variants.length - Math.PI / 2;
                  const vx = p.x + variantRadius * Math.cos(angle);
                  const vy = p.y + variantRadius * Math.sin(angle);
                  const vStock = Number(v.stock_quantity) || Number(v.stock) || 0;
                  return (
                    <g key={`variant-line-${v.id || vi}`}>
                      <ConnectionLine
                        x1={p.x}
                        y1={p.y}
                        x2={vx}
                        y2={vy}
                        color={getStockColor(vStock, 50).fill}
                        pulse={getStockPulse(vStock, 50)}
                        delay={vi * 80}
                      />
                      {/* Variant node */}
                      <g className="cursor-pointer">
                        <circle cx={vx} cy={vy} r={22} fill={getStockColor(vStock, 50).fill} stroke={getStockColor(vStock, 50).stroke} strokeWidth="2" />
                        {getStockPulse(vStock, 50) && (
                          <circle cx={vx} cy={vy} r={26} fill="none" stroke={getStockColor(vStock, 50).fill} strokeWidth="1.5" opacity="0.4">
                            <animate attributeName="r" values="24;32;24" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <text x={vx} y={vy - 3} textAnchor="middle" fill="white" fontSize="12" fontWeight="800" fontFamily="system-ui">
                          {vStock}
                        </text>
                        <text x={vx} y={vy + 9} textAnchor="middle" fill="white" fontSize="7" fontWeight="600" opacity="0.8" fontFamily="system-ui">
                          pcs
                        </text>
                        <text x={vx} y={vy + 36} textAnchor="middle" fill={isDark ? '#9ca3af' : '#6b7280'} fontSize="9" fontWeight="600" fontFamily="system-ui">
                          {v.color || v.variant_name || `V${vi + 1}`}
                        </text>
                        {v.size && (
                          <text x={vx} y={vy + 48} textAnchor="middle" fill={isDark ? '#6b7280' : '#9ca3af'} fontSize="8" fontFamily="monospace">
                            {v.size}
                          </text>
                        )}
                      </g>
                    </g>
                  );
                });
              })}

              {/* Product Nodes */}
              {productPositions.map((p) => (
                <g
                  key={p.id}
                  onMouseEnter={() => setHoveredNode(p.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <StockNode
                    x={p.x}
                    y={p.y}
                    stock={Number(p.stock_quantity) || 0}
                    maxStock={maxProductStock}
                    name={p.name}
                    sku={p.sku || p.sku_code}
                    isMaster={false}
                    onClick={() => setSelectedProduct(selectedProduct?.id === p.id ? null : p)}
                    isHovered={hoveredNode === p.id}
                  />
                </g>
              ))}

              {/* Master Stock Node (Center) */}
              <StockNode
                x={CENTER_X}
                y={CENTER_Y}
                stock={totalMasterStock}
                maxStock={totalMasterStock}
                name="Master Stock"
                sku={`${products.length} products`}
                isMaster={true}
                onClick={() => setSelectedProduct(null)}
                isHovered={hoveredNode === 'master'}
              />
            </svg>
          </div>
        )}

        {/* Selected Product Detail Panel */}
        {selectedProduct && (
          <div className={`mt-4 p-5 rounded-2xl ${bgSurface} backdrop-blur-xl border ${borderMain} shadow-xl`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-lg">📦</span>
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${textMain}`}>{selectedProduct.name}</h3>
                  <p className={`text-[10px] ${textMuted}`}>{selectedProduct.sku || selectedProduct.sku_code} · {selectedProduct.variants?.length || 0} variants</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all`}
              >
                ✕
              </button>
            </div>

            {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {selectedProduct.variants.map((v, i) => {
                  const vStock = Number(v.stock_quantity) || Number(v.stock) || 0;
                  const color = getStockColor(vStock, 50);
                  return (
                    <div
                      key={v.id || i}
                      className={`p-3 rounded-xl border ${borderMain} ${bgSurface} text-center`}
                    >
                      <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold ${getStockPulse(vStock, 50) ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: color.fill }}
                      >
                        {vStock}
                      </div>
                      <p className={`text-[10px] font-bold ${textMain}`}>{v.color || `V${i + 1}`}</p>
                      {v.size && <p className="text-[9px] text-gray-400">{v.size}</p>}
                      <p className="text-[9px] text-gray-400 mt-1">৳{v.price || selectedProduct.price}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`text-xs ${textMuted} text-center py-4`}>No variants — master product only</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
