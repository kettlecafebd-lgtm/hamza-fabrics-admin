import React, { useState, useEffect, useMemo, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import { getToken } from '../utils/auth';

const STATUS_CONFIG = {
  out_of_stock: { label: 'Out of Stock', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
  critical:     { label: 'Critical',     cls: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  low_stock:    { label: 'Low Stock',    cls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  sufficient:   { label: 'Sufficient',   cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
};

const STAT_CARDS = [
  { key: 'totalProducts', label: 'Total Products', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'outOfStock',    label: 'Out of Stock',   color: 'text-red-500',  bg: 'bg-red-500/10' },
  { key: 'critical',      label: 'Critical',       color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { key: 'lowStock',      label: 'Low Stock',      color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { key: 'sufficient',    label: 'Sufficient',     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const SmartRestock = () => {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deadStockOpen, setDeadStockOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState({});
  const [search, setSearch] = useState('');
  const [abcFilter, setAbcFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analytics/restock`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch (err) {
      console.error('Failed to load restock data', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived lists ──
  const allProducts = data?.allProducts || [];
  const deadStockList = data?.deadStock || [];
  const needingReorder = data?.needingReorder || [];

  // ABC breakdown counts
  const abcCounts = useMemo(() => {
    if (!data?.abc) return { a: 0, b: 0, c: 0 };
    return { a: data.abc.a.length, b: data.abc.b.length, c: data.abc.c.length };
  }, [data]);

  // Filtered product list for the main table
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    // Dead stock goes to its own section — exclude from main table unless requested
    // Actually per the guide, show the main product table with all products and their status
    if (!deadStockOpen) {
      // keep all products, dead ones show as "Sufficient"
    }

    if (abcFilter !== 'all') list = list.filter(p => p.abc === abcFilter);
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    }
    return list;
  }, [allProducts, abcFilter, statusFilter, search, deadStockOpen]);

  const toggleFaq = (idx) => setFaqOpen(prev => ({ ...prev, [idx]: !prev[idx] }));

  // ── Guide content (from docs) ──
  const GUIDE_SECTIONS = [
    {
      title: 'Dashboard বুঝুন',
      content: (
        <div className="space-y-4 text-sm leading-relaxed">
          <p>উপরের স্ট্যাট কার্ডগুলো ছয়টি আলাদা প্রশ্নের উত্তর দেয়।</p>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-t-border"><th className="text-left p-2 font-bold">Signal</th><th className="text-left p-2 font-bold">Meaning</th><th className="text-left p-2 font-bold">Action</th></tr></thead>
            <tbody>
              <tr className="border-b border-t-border/50"><td className="p-2 font-bold">Total Products</td><td className="p-2 text-t-muted">মোট প্রোডাক্ট সংখ্যা</td><td className="p-2 text-t-muted">—</td></tr>
              <tr className="border-b border-t-border/50"><td className="p-2 font-bold text-red-500">Out of Stock</td><td className="p-2 text-t-muted">স্টক ০</td><td className="p-2 text-t-muted">এখনই অর্ডার দিন</td></tr>
              <tr className="border-b border-t-border/50"><td className="p-2 font-bold text-orange-500">Critical</td><td className="p-2 text-t-muted">স্টক ≤ ৫</td><td className="p-2 text-t-muted">দ্রুত অর্ডার দিন</td></tr>
              <tr className="border-b border-t-border/50"><td className="p-2 font-bold text-yellow-500">Low Stock</td><td className="p-2 text-t-muted">স্টক ≤ ১০</td><td className="p-2 text-t-muted">এই সপ্তাহে অর্ডার দিন</td></tr>
              <tr className="border-b border-t-border/50"><td className="p-2 font-bold text-emerald-500">Sufficient</td><td className="p-2 text-t-muted">পর্যাপ্ত স্টক</td><td className="p-2 text-t-muted">—</td></tr>
              <tr><td className="p-2 font-bold">Stock / Sell Value</td><td className="p-2 text-t-muted">Stock = মোট কস্ট প্রাইস · Sell = বিক্রয় মূল্য</td><td className="p-2 text-t-muted">—</td></tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      title: 'স্টক স্ট্যাটাস লজিক',
      content: (
        <div className="space-y-3 text-sm leading-relaxed">
          <p>সিস্টেম এই ক্রমে চেক করে — উপরের শর্ত মিললে নিচেরটা দেখা হয় না।</p>
          <ol className="list-decimal list-inside space-y-2 text-t-muted">
            <li><span className="font-bold text-red-500">স্টক = ০</span> → Out of Stock</li>
            <li><span className="font-bold text-t-main">ডেড স্টক</span> (৯০+ দিন বিক্রি নেই) → Sufficient</li>
            <li><span className="font-bold text-orange-500">স্টক ≤ ৫</span> → Critical</li>
            <li><span className="font-bold text-yellow-500">স্টক ≤ ১০</span> → Low Stock</li>
            <li><span className="font-bold text-emerald-500">অন্যথায়</span> → Sufficient</li>
          </ol>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs">
            <p className="font-bold text-amber-500 mb-1">গুরুত্বপূর্ণ</p>
            <p className="text-t-muted">ডেড স্টক কখনো "Critical" দেখাবে না। কারণ যে প্রোডাক্ট বিক্রিই হচ্ছে না, সেটা রিস্টক করার দরকার নেই।</p>
          </div>
        </div>
      ),
    },
    {
      title: 'ABC এনালাইসিস',
      content: (
        <div className="space-y-3 text-sm leading-relaxed">
          <p>গত ৯০ দিনের রেভিনিউ অনুযায়ী তিন স্তর:</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-black text-emerald-500">A</p>
              <p className="text-[11px] text-t-muted mt-1">~৮০% রেভিনিউ</p>
              <p className="text-[10px] text-t-muted">মূল আয়। স্টক কখনো শেষ হতে দেবেন না।</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-black text-amber-500">B</p>
              <p className="text-[11px] text-t-muted mt-1">~১৫% রেভিনিউ</p>
              <p className="text-[10px] text-t-muted">মাঝারি গুরুত্ব। সাধারণ স্টক লেভেল রাখুন।</p>
            </div>
            <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3 text-center">
              <p className={`text-2xl font-black ${mutedText}`}>C</p>
              <p className="text-[11px] text-t-muted mt-1">~৫% রেভিনিউ</p>
              <p className="text-[10px] text-t-muted">কম গুরুত্ব। মিনিমাম স্টক রাখুন।</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'গড় দৈনিক বিক্রি',
      content: (
        <div className="space-y-3 text-sm leading-relaxed">
          <p>গত ৯০ দিনের ডেলিভারড অর্ডার থেকে বিক্রির গতি বের করা হয়। শুধু যেদিন অর্ডার এসেছে সেই দিনগুলো গণনা করা হয়।</p>
          <div className="bg-t-surface border border-t-border rounded-lg p-3 text-xs">
            <p className="font-bold mb-1">Formula</p>
            <p className="text-t-muted">গড় দৈনিক বিক্রি = মোট বিক্রি ÷ যতদিন বিক্রি হয়েছে</p>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-t-border"><th className="text-left p-2 font-bold">Confidence</th><th className="text-left p-2 font-bold">Days</th></tr></thead>
            <tbody>
              <tr className="border-b border-t-border/50"><td className="p-2 text-emerald-500 font-bold">High</td><td className="p-2 text-t-muted">২০+ দিন বিক্রি</td></tr>
              <tr className="border-b border-t-border/50"><td className="p-2 text-amber-500 font-bold">Medium</td><td className="p-2 text-t-muted">১০–১৯ দিন</td></tr>
              <tr className="border-b border-t-border/50"><td className="p-2 text-orange-500 font-bold">Low</td><td className="p-2 text-t-muted">&lt;১০ দিন</td></tr>
              <tr><td className={`p-2 ${mutedText} font-bold`}>None</td><td className="p-2 text-t-muted">বিক্রি হয়নি</td></tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      title: 'রিঅর্ডার পয়েন্ট (ROP)',
      content: (
        <div className="space-y-3 text-sm leading-relaxed">
          <p>যে স্টক লেভেলে পৌঁছালে নতুন অর্ডার দিতে হবে।</p>
          <div className="bg-t-surface border border-t-border rounded-lg p-3 text-xs">
            <p className="font-bold mb-1">ROP = (গড় দৈনিক বিক্রি × লিড টাইম) + সেফটি স্টক</p>
            <p className="text-t-muted mt-1">সেফটি স্টক: A=১০, B=৭, C=৫ (ন্যূনতম ৫) · ন্যূনতম ROP = ১০</p>
          </div>
        </div>
      ),
    },
    {
      title: 'ডেড স্টক',
      content: (
        <div className="space-y-3 text-sm leading-relaxed">
          <p>যে প্রোডাক্ট ৯০ দিন বা তার বেশি সময় ধরে একটাও বিক্রি হয়নি।</p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs space-y-1">
            <p className="font-bold text-red-500">কেন এটা সমস্যা?</p>
            <p className="text-t-muted">ক্যাপিটাল আটকে আছে · গুদামে জায়গা নষ্ট · প্রোডাক্ট পুরনো/নষ্ট হতে পারে</p>
          </div>
          <p className="font-bold text-xs mt-2">ডেড স্টক নিয়ে কী করবেন?</p>
          <ol className="list-decimal list-inside text-xs text-t-muted space-y-1">
            <li>ক্লিয়ারেন্স সেল — ৩০-৫০% ছাড়ে বিক্রি</li>
            <li>বান্ডেল অফার — জনপ্রিয় প্রোডাক্টের সাথে</li>
            <li>সাপ্লায়ারকে ফেরত</li>
            <li>ডোনেশন — ট্যাক্স বেনিফিট</li>
          </ol>
        </div>
      ),
    },
    {
      title: 'টিপস ও অনুশীলন',
      content: (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-t-surface border border-t-border rounded-lg p-3">
              <p className="font-bold text-emerald-500 mb-1">প্রতিদিন</p>
              <ul className="list-disc list-inside text-t-muted space-y-0.5">
                <li>Critical ও Out of Stock লিস্ট</li>
                <li>Fast Moving প্রোডাক্টের স্টক</li>
              </ul>
            </div>
            <div className="bg-t-surface border border-t-border rounded-lg p-3">
              <p className="font-bold text-amber-500 mb-1">সাপ্তাহিক</p>
              <ul className="list-disc list-inside text-t-muted space-y-0.5">
                <li>Low Stock লিস্ট</li>
                <li>ABC এনালাইসিস</li>
              </ul>
            </div>
            <div className="bg-t-surface border border-t-border rounded-lg p-3">
              <p className="font-bold text-red-500 mb-1">মাসিক</p>
              <ul className="list-disc list-inside text-t-muted space-y-0.5">
                <li>ডেড স্টক রিপোর্ট</li>
                <li>সেফটি স্টক আপডেট</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const FAQS = [
    { q: '"Recalculate" বাটন কী করে?', a: 'এটি সকল প্রোডাক্টের জন্য নতুন করে ABC এনালাইসিস, গড় দৈনিক বিক্রি, এবং ROP পুনরায় ক্যালকুলেট করে।' },
    { q: 'কেন কিছু প্রোডাক্ট "0.0/day" দেখাচ্ছে?', a: 'যে প্রোডাক্টের গত ৯০ দিনে কোনো বিক্রি নেই, সেটির গড় দৈনিক বিক্রি ০ দেখাবে — এগুলো ডেড স্টক হিসেবে চিহ্নিত।' },
    { q: 'Critical আর Low Stock এর পার্থক্য কী?', a: 'Critical = স্টক ≤ ৫ (তাড়াতাড়ি ফুরিয়ে যাবে); Low Stock = স্টক ≤ ১০ (শীঘ্রই অর্ডার দিন)।' },
    { q: 'ABC ক্যাটেগরি কিভাবে আপডেট হয়?', a: 'প্রতি ৯০ দিনের ডেলিভারড অর্ডারের রেভিনিউ অনুযায়ী স্বয়ংক্রিয়ভাবে ক্যালকুলেট হয়। "Recalculate" বাটন চাপলেই আপডেট হবে।' },
    { q: 'সেফটি স্টক কিভাবে নির্ধারণ করব?', a: 'A ক্যাটেগরি: ১০ পিস · B: ৭ পিস · C: ৫ পিস (ন্যূনতম ৫ পিস)।' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full bg-t-base min-h-screen text-t-main">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Smart Restock</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Inventory management — complete reference for restock decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setGuideOpen(true)} className="text-xs font-bold text-t-muted hover:text-t-primary transition-colors px-3 py-2 border border-t-border rounded-lg">Guide</button>
          <button onClick={fetchData} className="text-xs font-bold text-t-muted hover:text-t-primary transition-colors px-3 py-2 border border-t-border rounded-lg">Recalculate</button>
          <button onClick={fetchData} className="text-xs font-bold text-white bg-t-primary hover:opacity-90 transition-colors px-4 py-2 rounded-lg">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-sm font-bold tracking-widest uppercase text-t-primary animate-pulse">Loading insights...</div>
        </div>
      ) : (
        <>
          {/* ═══ 6 Stat Cards ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {STAT_CARDS.map(s => {
              const val = data?.[s.key] ?? '-';
              return (
                <div key={s.key} className={`${s.bg} border border-t-border rounded-xl p-4`}>
                  <p className="text-xs font-bold text-t-muted uppercase tracking-wider">{s.label}</p>
                  <p className={`text-3xl font-black mt-1 ${s.color}`}>{val}</p>
                </div>
              );
            })}
            {/* Stock / Sell Value */}
            <div className="bg-purple-500/10 border border-t-border rounded-xl p-4">
              <p className="text-xs font-bold text-t-muted uppercase tracking-wider">Stock / Sell</p>
              <p className="text-lg font-black mt-1 text-purple-500 leading-tight">
                ৳{data?.stockValue ? Number(data.stockValue).toLocaleString() : '-'}
              </p>
              <p className="text-[10px] text-t-muted font-bold mt-0.5">
                / ৳{data?.sellValue ? Number(data.sellValue).toLocaleString() : '-'}
              </p>
            </div>
          </div>

          {/* ═══ Attention Banner (OOS / Critical) ═══ */}
          {(data?.outOfStock > 0 || data?.critical > 0) && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-base font-extrabold text-red-500">Attention Required</h2>
                <p className="text-sm text-t-muted mt-1">
                  {data?.outOfStock} products are out of stock. {data?.critical} products are critically low.
                </p>
              </div>
              <button onClick={() => setDeadStockOpen(true)} className="text-xs font-bold text-red-500 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors">View Details</button>
            </div>
          )}

          {/* ═══ ABC Analysis ═══ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-t-muted">ABC Analysis</h3>
              <p className="text-[10px] text-t-muted">Based on last 90 days revenue</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { cat: 'A', count: abcCounts.a, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: '~80% of revenue', border: 'border-emerald-500/20' },
                { cat: 'B', count: abcCounts.b, color: 'text-amber-500', bg: 'bg-amber-500/10', desc: '~15% of revenue', border: 'border-amber-500/20' },
                { cat: 'C', count: abcCounts.c, color: mutedText, bg: 'bg-gray-500/10', desc: '~5% of revenue', border: 'border-gray-500/20' },
              ].map(a => (
                <div key={a.cat} className={`${a.bg} ${a.border} border rounded-xl p-4 flex items-center justify-between`}>
                  <div>
                    <p className={`text-2xl font-black ${a.color}`}>{a.cat}</p>
                    <p className="text-xs text-t-muted mt-0.5">{a.desc}</p>
                  </div>
                  <p className={`text-3xl font-black ${a.color}`}>{a.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Dead Stock Warning ═══ */}
          {deadStockList.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🗑️</span>
                <div>
                  <p className="text-sm font-extrabold text-rose-500">{deadStockList.length} Dead Stock Products</p>
                  <p className="text-xs text-t-muted">No sales in 90+ days — capital is stuck</p>
                </div>
              </div>
              <button onClick={() => setDeadStockOpen(true)} className="text-xs font-bold text-rose-500 border border-rose-500/30 px-4 py-2 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0">View All</button>
            </div>
          )}

          {/* ═══ Filter Bar ═══ */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text" placeholder="Search by name or SKU..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="bg-t-surface border border-t-border rounded-lg px-3 py-2 text-xs outline-none focus:border-t-primary transition-colors w-full sm:w-64 text-t-main placeholder:text-t-muted"
            />
            <select value={abcFilter} onChange={e => setAbcFilter(e.target.value)} className="bg-t-surface border border-t-border rounded-lg px-3 py-2 text-xs outline-none text-t-muted">
              <option value="all">All ABC</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-t-surface border border-t-border rounded-lg px-3 py-2 text-xs outline-none text-t-muted">
              <option value="all">All Status</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="critical">Critical</option>
              <option value="low_stock">Low Stock</option>
              <option value="sufficient">Sufficient</option>
            </select>
            <span className="text-[11px] text-t-muted font-mono ml-auto">{filteredProducts.length} products</span>
          </div>

          {/* ═══ Main Product Table ═══ */}
          <div className="bg-t-surface border border-t-border rounded-xl mb-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-t-border text-t-muted text-[11px] uppercase tracking-wider">
                    <th className="p-3 font-bold w-8">#</th>
                    <th className="p-3 font-bold">Product</th>
                    <th className="p-3 font-bold">Stock Status</th>
                    <th className="p-3 font-bold">Stock</th>
                    <th className="p-3 font-bold">Avg Daily Sales</th>
                    <th className="p-3 font-bold">ROP</th>
                    <th className="p-3 font-bold">ABC</th>
                    <th className="p-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan="8" className="p-8 text-center text-t-muted text-sm">No products match the current filters.</td></tr>
                  ) : (
                    filteredProducts.map((p, i) => {
                      const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.sufficient;
                      return (
                        <tr key={p.id} className="border-b border-t-border/50 hover:bg-t-base/30 transition-colors">
                          <td className="p-3 text-t-muted text-[10px] font-mono">{i + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {p.imageUrl && (
                                <div className={`w-9 h-9 ${bgCard} rounded-md overflow-hidden shrink-0 border border-gray-600`}>
                                  <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-t-main text-xs leading-tight">{p.name}</p>
                                <p className="text-[10px] text-t-muted font-mono mt-0.5">{p.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="p-3">
                            <span className={`font-bold ${p.stock === 0 ? 'text-red-500' : p.stock <= 5 ? 'text-orange-500' : 'text-t-main'}`}>{p.stock}</span>
                            {p.isDead && <span className="ml-1.5 text-[9px] text-rose-500 font-bold">DEAD</span>}
                          </td>
                          <td className="p-3">
                            <span className="font-bold">{p.avgDailySales.toFixed(1)}/day</span>
                            {p.confidence !== 'none' && (
                              <span className={`ml-1.5 text-[10px] font-bold ${
                                p.confidence === 'high' ? 'text-emerald-500' : p.confidence === 'medium' ? 'text-amber-500' : 'text-orange-500'
                              }`}>
                                {p.daysWithOrders}d
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-t-main">{p.rop}</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-black px-2 py-1 rounded ${
                              p.abc === 'A' ? 'bg-emerald-500/10 text-emerald-500' : p.abc === 'B' ? 'bg-amber-500/10 text-amber-500' : `bg-gray-500/10 ${mutedText}`
                            }`}>{p.abc}</span>
                          </td>
                          <td className="p-3">
                            <Link to={`/products/${p.id}`} className="text-[10px] font-bold text-t-primary hover:underline">Edit</Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ FAQ ═══ */}
          <div className="bg-t-surface border border-t-border rounded-xl mb-6 overflow-hidden">
            <div className="p-4 border-b border-t-border">
              <h3 className="text-sm font-extrabold">প্রশ্নোত্তর (FAQ)</h3>
            </div>
            <div className="divide-y divide-t-border/50">
              {FAQS.map((faq, idx) => (
                <div key={idx}>
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-4 text-left text-sm hover:bg-t-base/30 transition-colors"
                  >
                    <span className="font-bold text-t-main">{faq.q}</span>
                    <span className={`text-t-muted transition-transform ${faqOpen[idx] ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {faqOpen[idx] && (
                    <div className="px-4 pb-4 text-sm text-t-muted leading-relaxed">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ════════ Dead Stock Modal ════════ */}
      {deadStockOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDeadStockOpen(false)}>
          <div className="bg-t-base w-full max-w-4xl max-h-[85vh] rounded-2xl border border-t-border shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-t-border shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-t-main">
                  {deadStockOpen === true ? 'Dead Stock Report' : 'Products Needing Reorder'}
                </h2>
                <p className="text-xs text-t-muted mt-0.5">{deadStockList.length} products with no sales in 90+ days</p>
              </div>
              <button onClick={() => setDeadStockOpen(false)} className="text-t-muted hover:text-t-main transition-colors p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-t-border text-t-muted text-[11px] uppercase tracking-wider">
                    <th className="pb-3 pr-3 font-bold">Product</th>
                    <th className="pb-3 pr-3 font-bold">SKU</th>
                    <th className="pb-3 pr-3 font-bold">Stock</th>
                    <th className="pb-3 pr-3 font-bold">Cost Price</th>
                    <th className="pb-3 pr-3 font-bold">Stuck Value</th>
                    <th className="pb-3 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStockList.length === 0 ? (
                    <tr><td colSpan="6" className="pt-6 text-center text-t-muted text-sm">No dead stock products found.</td></tr>
                  ) : (
                    deadStockList.map(p => (
                      <tr key={p.id} className="border-b border-t-border/50 hover:bg-t-base/30 transition-colors">
                        <td className="py-3 pr-3 font-bold text-t-main text-xs">{p.name}</td>
                        <td className="py-3 pr-3 text-[10px] text-t-muted font-mono">{p.sku}</td>
                        <td className="py-3 pr-3 font-bold text-rose-500">{p.stock}</td>
                        <td className="py-3 pr-3 text-t-muted">৳{p.costPrice.toFixed(2)}</td>
                        <td className="py-3 pr-3 text-rose-500 font-bold">৳{(p.stock * p.costPrice).toFixed(2)}</td>
                        <td className="py-3">
                          <Link to={`/products/${p.id}`} className="text-[10px] font-bold text-t-primary hover:underline">Edit</Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-t-border flex justify-end shrink-0">
              <button onClick={() => setDeadStockOpen(false)} className="bg-t-primary text-white px-5 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ Guide Modal ════════ */}
      {guideOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={() => setGuideOpen(false)}>
          <div className="bg-t-base w-full max-w-2xl rounded-2xl border border-t-border shadow-2xl overflow-hidden mb-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-t-border sticky top-0 bg-t-base z-10">
              <div>
                <h2 className="text-lg font-extrabold text-t-main">Smart Restock Guide</h2>
                <p className="text-xs text-t-muted mt-0.5">Complete inventory management reference — 7 chapters</p>
              </div>
              <button onClick={() => setGuideOpen(false)} className="text-t-muted hover:text-t-main transition-colors p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {GUIDE_SECTIONS.map((sec, i) => (
                <div key={i}>
                  <h3 className="text-sm font-extrabold text-t-main mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-t-primary/10 text-t-primary text-[10px] flex items-center justify-center font-black">{i + 1}</span>
                    {sec.title}
                  </h3>
                  {sec.content}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-t-border flex justify-end shrink-0">
              <button onClick={() => setGuideOpen(false)} className="bg-t-primary text-white px-5 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartRestock;