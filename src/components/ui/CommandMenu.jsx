import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../config/api';

/**
 * CommandMenu — Global Spotlight Search (Ctrl+K / Cmd+K)
 *
 * Features:
 *   - Glassmorphism modal (Apple/Vercel style)
 *   - Search pages, products, customers, quick actions
 *   - Keyboard navigation (↑↓ Enter Esc)
 *   - Fuzzy matching
 *   - Recent searches (localStorage)
 */

// ── Static Commands (Pages & Actions) ──
const PAGE_COMMANDS = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: '📊', category: 'Navigation', keywords: 'home main overview' },
  { id: 'products', label: 'All Products', path: '/products', icon: '📦', category: 'Navigation', keywords: 'product list inventory items' },
  { id: 'combo-builder', label: 'Combo Builder', path: '/combo-builder', icon: '🎯', category: 'Navigation', keywords: 'combo bundle pack set' },
  { id: 'stock-network', label: 'Stock Network', path: '/stock-network', icon: '🕸️', category: 'Navigation', keywords: 'stock pool visualizer graph' },
  { id: 'orders', label: 'Orders', path: '/orders', icon: '🛒', category: 'Navigation', keywords: 'order list sales' },
  { id: 'create-order', label: 'Create New Order', path: '/admin/orders/create', icon: '➕', category: 'Quick Action', keywords: 'new order add create' },
  { id: 'pos', label: 'Point of Sale (POS)', path: '/pos', icon: '💳', category: 'Navigation', keywords: 'pos terminal billing' },
  { id: 'customers', label: 'Customer List', path: '/customers', icon: '👥', category: 'Navigation', keywords: 'customer client user' },
  { id: 'inventory', label: 'Inventory Dashboard', path: '/inventory', icon: '📈', category: 'Navigation', keywords: 'inventory stock level' },
  { id: 'smart-restock', label: 'Smart Restock', path: '/smart-restock', icon: '🔄', category: 'Navigation', keywords: 'restock reorder low stock' },
  { id: 'categories', label: 'Categories & Brands', path: '/categories', icon: '🏷️', category: 'Navigation', keywords: 'category brand tag' },
  { id: 'couriers', label: 'Courier Management', path: '/couriers', icon: '🚚', category: 'Navigation', keywords: 'courier delivery shipping' },
  { id: 'profit-sales', label: 'Profit & Sales', path: '/profit-sales', icon: '💰', category: 'Navigation', keywords: 'profit sales revenue' },
  { id: 'expense-tracker', label: 'Expense Tracker', path: '/expense-tracker', icon: '💸', category: 'Navigation', keywords: 'expense cost spending' },
  { id: 'order-report', label: 'Order Report', path: '/order-report', icon: '📋', category: 'Navigation', keywords: 'order report analytics' },
  { id: 'employee-report', label: 'Employee Report', path: '/employee-report', icon: '👨‍💼', category: 'Navigation', keywords: 'employee staff team' },
  { id: 'brain', label: 'Brain Dashboard', path: '/admin/command-center?tab=ai', icon: '🧠', category: 'Navigation', keywords: 'ai brain intelligence' },
  { id: 'crm', label: 'CRM Leads', path: '/admin/crm', icon: '📞', category: 'Navigation', keywords: 'crm leads sales pipeline' },
  { id: 'fraud', label: 'Fraud Checker', path: '/fraud-checker', icon: '🛡️', category: 'Navigation', keywords: 'fraud security check' },
  { id: 'inbox', label: 'Unified Inbox', path: '/admin/inbox', icon: '💬', category: 'Navigation', keywords: 'inbox message chat communication' },
  { id: 'returns', label: 'Returns Management', path: '/admin/returns', icon: '↩️', category: 'Navigation', keywords: 'returns refund rma' },
  { id: 'financial-audit', label: 'Financial Audit', path: '/admin/financial-audit', icon: '📑', category: 'Navigation', keywords: 'finance audit accounting' },
  { id: 'marketing', label: 'Marketing Settings', path: '/admin/marketing', icon: '📣', category: 'Navigation', keywords: 'marketing settings campaign' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: '⚙️', category: 'Navigation', keywords: 'settings config preference' },
];

// ── Fuzzy Match ──
function fuzzyMatch(text, query) {
  if (!query) return true;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  // Exact substring match
  if (lower.includes(q)) return true;
  // Check each word
  const words = q.split(' ').filter(Boolean);
  return words.every((w) => lower.includes(w));
}

// ── Score for ranking ──
function matchScore(item, query) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const keywords = (item.keywords || '').toLowerCase();
  let score = 0;
  if (label.startsWith(q)) score += 100;
  if (label.includes(q)) score += 50;
  if (keywords.includes(q)) score += 30;
  return score;
}

// ── Main Component ──
export default function CommandMenu({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [products, setProducts] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hamzabi-cmd-recent');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch products on search (debounced)
  useEffect(() => {
    if (!open) return;
    if (query.length < 2) {
      setProducts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('adminToken') || '';
        const res = await fetch(`${API_BASE_URL}/api/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          const filtered = (json.data || []).filter(
            (p) =>
              fuzzyMatch(p.name, query) ||
              fuzzyMatch(p.sku || p.sku_code || '', query)
          );
          setProducts(filtered.slice(0, 8)); // Max 8 product results
        }
      } catch {}
      setLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, open]);

  // ── Combine results ──
  const allResults = useMemo(() => {
    const results = [];

    // If no query, show recent + popular pages
    if (!query) {
      // Recent searches
      if (recentSearches.length > 0) {
        results.push({ type: 'header', label: 'Recent' });
        recentSearches.slice(0, 3).forEach((r) => {
          results.push({ type: 'recent', ...r });
        });
      }
      results.push({ type: 'header', label: 'Quick Actions' });
      results.push(
        ...PAGE_COMMANDS.filter((c) =>
          ['create-order', 'pos', 'combo-builder', 'stock-network'].includes(c.id)
        ).map((c) => ({ type: 'action', ...c }))
      );
      results.push({ type: 'header', label: 'Pages' });
      results.push(
        ...PAGE_COMMANDS.filter((c) =>
          ['dashboard', 'products', 'orders', 'customers', 'inventory'].includes(c.id)
        ).map((c) => ({ type: 'page', ...c }))
      );
      return results;
    }

    // Search pages
    const matchedPages = PAGE_COMMANDS.filter((c) => fuzzyMatch(`${c.label} ${c.keywords}`, query))
      .sort((a, b) => matchScore(b, query) - matchScore(a, query));

    if (matchedPages.length > 0) {
      results.push({ type: 'header', label: 'Pages' });
      matchedPages.slice(0, 6).forEach((c) => results.push({ type: 'page', ...c }));
    }

    // Search products
    if (products.length > 0) {
      results.push({ type: 'header', label: 'Products' });
      products.forEach((p) =>
        results.push({
          type: 'product',
          id: `product-${p.id}`,
          label: p.name,
          sublabel: `${p.sku || p.sku_code || ''} · ৳${p.price} · Stock: ${p.stock_quantity || 0}`,
          path: `/products`,
          icon: p.image_url
            ? null
            : '📦',
          imageUrl: p.image_url
            ? p.image_url.startsWith('http')
              ? p.image_url
              : `${API_BASE_URL}${p.image_url}`
            : null,
        })
      );
    }

    if (results.length === 0 || (results.length === 1 && results[0].type === 'header')) {
      results.push({ type: 'empty' });
    }

    return results;
  }, [query, products, recentSearches]);

  const selectableResults = allResults.filter((r) => r.type !== 'header' && r.type !== 'empty');

  // ── Keyboard Navigation ──
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, selectableResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = selectableResults[selectedIndex];
        if (selected && selected.path) {
          // Save to recent
          const newRecent = [
            { label: selected.label, path: selected.path, icon: selected.icon },
            ...recentSearches.filter((r) => r.path !== selected.path),
          ].slice(0, 5);
          setRecentSearches(newRecent);
          localStorage.setItem('hamzabi-cmd-recent', JSON.stringify(newRecent));
          navigate(selected.path);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }

      // Scroll selected item into view
      if (listRef.current) {
        const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'nearest' });
        }
      }
    },
    [selectedIndex, selectableResults, navigate, onClose, recentSearches]
  );

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  let selectableIndex = -1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Command Palette */}
      <div className="relative w-full max-w-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-3xl border border-white/40 dark:border-white/10 shadow-2xl shadow-black/30 dark:shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200/50 dark:border-white/10">
          {/* Search Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, products, actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base font-medium text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-gray-400 border border-gray-200/50 dark:border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2 custom-scrollbar">
          {allResults.map((item, i) => {
            // Skip headers for indexing
            if (item.type === 'header') {
              return (
                <div key={`header-${item.label}`} className="px-5 pt-3 pb-1">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {item.label}
                  </span>
                </div>
              );
            }

            if (item.type === 'empty') {
              return (
                <div key="empty" className="px-5 py-10 text-center">
                  <p className="text-3xl mb-3 opacity-30">🔍</p>
                  <p className="text-sm font-medium text-gray-400">No results found</p>
                  <p className="text-xs text-gray-400/60 mt-1">Try a different search term</p>
                </div>
              );
            }

            selectableIndex++;
            const isSelected = selectableIndex === selectedIndex;
            const currentIndex = selectableIndex;

            return (
              <button
                key={item.id}
                data-index={currentIndex}
                onClick={() => {
                  if (item.path) {
                    const newRecent = [
                      { label: item.label, path: item.path, icon: item.icon },
                      ...recentSearches.filter((r) => r.path !== item.path),
                    ].slice(0, 5);
                    setRecentSearches(newRecent);
                    localStorage.setItem('hamzabi-cmd-recent', JSON.stringify(newRecent));
                    navigate(item.path);
                    onClose();
                  }
                }}
                onMouseEnter={() => setSelectedIndex(currentIndex)}
                className={`
                  w-full text-left px-5 py-3 flex items-center gap-3 transition-colors duration-100
                  ${isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-500/10'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                  }
                `}
              >
                {/* Icon / Image */}
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-lg">{item.icon || '📄'}</span>
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                    {item.label}
                  </p>
                  {item.sublabel && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{item.sublabel}</p>
                  )}
                </div>

                {/* Category Badge */}
                {item.category && (
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-md shrink-0">
                    {item.category}
                  </span>
                )}

                {/* Arrow */}
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400 shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-200/50 dark:border-white/10 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 border border-gray-200/50 dark:border-white/10 font-bold">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 border border-gray-200/50 dark:border-white/10 font-bold">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 border border-gray-200/50 dark:border-white/10 font-bold">Esc</kbd>
            Close
          </span>
          <span className="ml-auto opacity-50">HamzaBI</span>
        </div>
      </div>
    </div>
  );
}
