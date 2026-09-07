import React, { useState, useContext, useMemo } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, DollarSign, Package, RotateCcw, Receipt, TrendingUp,
  ChevronDown, ArrowRight, Filter, BarChart3, MapPin, FileText,
  Activity, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';

// ──────────────────────────────────────────────────
// MOCK DATA — replace with real API calls
// ──────────────────────────────────────────────────
const MOCK_METRICS = [
  {
    label: 'Total Orders',
    value: '12,483',
    subtitle: 'Avg: ৳1,380',
    icon: ShoppingCart,
    accent: '#3B82F6',      // blue
    trend: '+12.4%',
    trendUp: true,
  },
  {
    label: 'Total Revenue',
    value: '৳17.2M',
    subtitle: 'Margin: 42.8%',
    icon: DollarSign,
    accent: '#10B981',      // green
    trend: '+8.2%',
    trendUp: true,
  },
  {
    label: 'Delivered Orders',
    value: '10,847',
    subtitle: 'Rate: 86.9%',
    icon: Package,
    accent: '#6366F1',      // indigo
    trend: '+5.1%',
    trendUp: true,
  },
  {
    label: 'Return Orders',
    value: '1,203',
    subtitle: 'Rate: 9.6%',
    icon: RotateCcw,
    accent: '#F97316',      // orange
    trend: '-2.3%',
    trendUp: false,
  },
  {
    label: 'Product Cost',
    value: '৳9.8M',
    subtitle: 'Avg unit: ৳785',
    icon: Receipt,
    accent: '#8B5CF6',      // purple
    trend: '+3.7%',
    trendUp: true,
  },
  {
    label: 'Gross Profit',
    value: '৳7.4M',
    subtitle: 'Margin: 43.1%',
    icon: TrendingUp,
    accent: '#06B6D4',      // cyan
    trend: '+9.6%',
    trendUp: true,
  },
];

const MOCK_REVENUE_BREAKDOWN = [
  { status: 'Delivered', amount: 14_952_600, pct: 86.9, color: '#10B981' },
  { status: 'Pending', amount: 1_040_000, pct: 6.0, color: '#F59E0B' },
  { status: 'Returned', amount: 864_000, pct: 5.0, color: '#EF4444' },
  { status: 'Cancelled', amount: 343_400, pct: 2.1, color: '#6B7280' },
];

const MOCK_TRANSITIONS = [
  { from: 'New', to: 'Confirmed', count: 3_842, color: '#3B82F6' },
  { from: 'Confirmed', to: 'Processing', count: 3_215, color: '#6366F1' },
  { from: 'Processing', to: 'Shipped', count: 2_870, color: '#8B5CF6' },
  { from: 'Shipped', to: 'Delivered', count: 2_456, color: '#10B981' },
  { from: 'Shipped', to: 'RTS', count: 412, color: '#F97316' },
  { from: 'New', to: 'Cancelled', count: 285, color: '#EF4444' },
  { from: 'Pending', to: 'Confirmed', count: 1_920, color: '#06B6D4' },
  { from: 'Delivered', to: 'Returned', count: 310, color: '#F59E0B' },
];

// ──────────────────────────────────────────────────
// ANIMATION VARIANTS
// ──────────────────────────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

// ──────────────────────────────────────────────────
// SUB-COMPONENT: Primary Tab Bar
// ──────────────────────────────────────────────────
function PrimaryTabs({ tabs, active, onChange, isDark }) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`
            relative flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold
            rounded-xl transition-all duration-200 whitespace-nowrap
            ${active === t.id
              ? 'bg-white/10 text-white shadow-lg shadow-white/5'
              : isDark
                ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          {t.icon}
          <span>{t.label}</span>
          {active === t.id && (
            <motion.div
              layoutId="primaryTab"
              className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.06]"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────
// SUB-COMPONENT: Secondary Tab Bar
// ──────────────────────────────────────────────────
function SecondaryTabs({ tabs, active, onChange, isDark }) {
  return (
    <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`
            relative px-4 py-2 text-[12px] font-semibold rounded-lg transition-all duration-200 whitespace-nowrap
            ${active === t.id
              ? 'text-white'
              : isDark
                ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }
          `}
        >
          <span className="relative z-10">{t.label}</span>
          {active === t.id && (
            <motion.div
              layoutId="secondaryTab"
              className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.06]"
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────
// SUB-COMPONENT: Metric Card
// ──────────────────────────────────────────────────
function MetricCard({ metric, isDark }) {
  const Icon = metric.icon;
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`
        group relative overflow-hidden rounded-2xl
        border border-[#2a2a2a] bg-[#121212]
        hover:border-[#3a3a3a] transition-colors duration-300
      `}
      style={{ borderLeftWidth: '3px', borderLeftColor: metric.accent }}
    >
      {/* Subtle gradient glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at top right, ${metric.accent}, transparent 70%)` }}
      />

      <div className="relative p-5 flex flex-col justify-between min-h-[130px]">
        {/* Top row: icon + trend */}
        <div className="flex items-start justify-between">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ backgroundColor: `${metric.accent}15` }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: metric.accent }} strokeWidth={2} />
          </div>
          <div className={`
            flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full
            ${metric.trendUp
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
            }
          `}>
            {metric.trendUp
              ? <ArrowUpRight className="w-3 h-3" />
              : <ArrowDownRight className="w-3 h-3" />
            }
            {metric.trend}
          </div>
        </div>

        {/* Bottom: value + label */}
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">
            {metric.label}
          </p>
          <p className="text-2xl font-extrabold text-white tracking-tight leading-none">
            {metric.value}
          </p>
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
            {metric.subtitle}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────
// SUB-COMPONENT: Revenue Breakdown Row
// ──────────────────────────────────────────────────
function RevenueRow({ item, maxAmount, isDark }) {
  const barWidth = (item.amount / maxAmount) * 100;
  return (
    <div className="group">
      <div className="flex items-center justify-between py-3 px-1">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            {item.status}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm font-bold text-white tabular-nums">
            ৳{(item.amount / 1_000_000).toFixed(2)}M
          </span>
          <span
            className="text-[11px] font-bold w-12 text-right tabular-nums px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${item.color}18`,
              color: item.color,
            }}
          >
            {item.pct}%
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="h-full rounded-full"
          style={{ backgroundColor: item.color }}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// SUB-COMPONENT: Status Transition Row
// ──────────────────────────────────────────────────
function TransitionRow({ item, index, isDark }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={`
        flex items-center gap-3 sm:gap-6 py-3.5 px-4
        rounded-xl transition-colors duration-200
        ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50'}
      `}
    >
      {/* From Status — outlined pill */}
      <div className="flex-1 flex justify-center">
        <span
          className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[12px] font-bold border"
          style={{
            borderColor: `${item.color}50`,
            color: item.color,
            backgroundColor: `${item.color}10`,
          }}
        >
          {item.from}
        </span>
      </div>

      {/* Arrow */}
      <ArrowRight
        className="w-4 h-4 text-gray-600 shrink-0"
        strokeWidth={2.5}
      />

      {/* To Status — solid pill */}
      <div className="flex-1 flex justify-center">
        <span
          className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-white text-black"
        >
          {item.to}
        </span>
      </div>

      {/* Count */}
      <div className="w-20 text-right shrink-0">
        <span
          className="text-base font-extrabold tabular-nums"
          style={{ color: item.color }}
        >
          {item.count.toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════
// MAIN: AnalyticsDashboard
// ══════════════════════════════════════════════════
export default function AnalyticsDashboard() {
  const { isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;

  // ── Tab state ──
  const [primaryTab, setPrimaryTab] = useState('combined');
  const [secondaryTab, setSecondaryTab] = useState('overview');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValue, setFilterValue] = useState('Approved');

  const primaryTabs = [
    { id: 'combined', label: 'Combined', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'order-report', label: 'Order Report', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'district-map', label: 'District Map', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'status-update', label: 'Status Update', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  const secondaryTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'main-report', label: 'Main Report' },
    { id: 'advance-report', label: 'Advance Report' },
    { id: 'source', label: 'Source' },
  ];

  const filterOptions = ['Approved', 'Pending', 'Returned', 'All Orders'];

  const maxRevenue = useMemo(
    () => Math.max(...MOCK_REVENUE_BREAKDOWN.map((r) => r.amount)),
    []
  );

  // ── Background class ──
  const bgBase = isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50';
  const bgSurface = isDark ? 'bg-[#111111]' : 'bg-white';
  const borderMain = isDark ? 'border-[#1e1e1e]' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgBase} transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 1: PRIMARY NAVIGATION
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`
            flex flex-col sm:flex-row sm:items-center justify-between gap-4
            rounded-2xl border ${borderMain} bg-[#121212] p-2
          `}
        >
          <PrimaryTabs
            tabs={primaryTabs}
            active={primaryTab}
            onChange={setPrimaryTab}
            isDark={isDark}
          />

          {/* Filter Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`
                flex items-center gap-2 px-4 py-2 text-[12px] font-bold
                rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]
                text-gray-300 hover:bg-[#222] hover:text-white
                transition-all duration-200
              `}
            >
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span>{filterValue}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl shadow-black/50 overflow-hidden z-50"
                >
                  {filterOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setFilterValue(opt); setFilterOpen(false); }}
                      className={`
                        w-full text-left px-4 py-2.5 text-[12px] font-semibold transition-colors
                        ${filterValue === opt
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        }
                      `}
                    >
                      {opt}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 2: SECONDARY NAVIGATION
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={`
            rounded-2xl border ${borderMain} bg-[#121212] p-1.5 inline-flex
          `}
        >
          <SecondaryTabs
            tabs={secondaryTabs}
            active={secondaryTab}
            onChange={setSecondaryTab}
            isDark={isDark}
          />
        </motion.div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 3: OVERVIEW METRICS GRID
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-500">
              Overview Metrics
            </h2>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {MOCK_METRICS.map((m) => (
              <MetricCard key={m.label} metric={m} isDark={isDark} />
            ))}
          </motion.div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 4: REVENUE BY ORDER STATUS
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className={`
            rounded-2xl border border-[#2a2a2a] bg-[#121212]
            overflow-hidden
          `}
        >
          {/* Card header */}
          <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                Revenue by Order Status
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-gray-500 bg-white/5 px-3 py-1 rounded-full">
              Total: ৳17.2M
            </span>
          </div>

          {/* Rows */}
          <div className="px-6 py-4 divide-y divide-[#1e1e1e]">
            {MOCK_REVENUE_BREAKDOWN.map((item) => (
              <RevenueRow
                key={item.status}
                item={item}
                maxAmount={maxRevenue}
                isDark={isDark}
              />
            ))}
          </div>
        </motion.div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 5: STATUS TRANSITION BREAKDOWN
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className={`
            rounded-2xl border border-[#2a2a2a] bg-[#121212]
            overflow-hidden
          `}
        >
          {/* Card header */}
          <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">
                Status Transition Breakdown
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-gray-500 bg-white/5 px-3 py-1 rounded-full">
              {MOCK_TRANSITIONS.length} transitions
            </span>
          </div>

          {/* Column headers */}
          <div className="px-6 pt-4 pb-2 flex items-center gap-3 sm:gap-6 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            <div className="flex-1 text-center">From Status</div>
            <div className="w-4 shrink-0" />
            <div className="flex-1 text-center">To Status</div>
            <div className="w-20 text-right shrink-0">Count</div>
          </div>

          {/* Transition rows */}
          <div className="px-4 pb-4 divide-y divide-[#1a1a1a]">
            {MOCK_TRANSITIONS.map((item, i) => (
              <TransitionRow key={`${item.from}-${item.to}`} item={item} index={i} isDark={isDark} />
            ))}
          </div>
        </motion.div>

        {/* Footer spacer */}
        <div className="h-6" />
      </div>

      {/* Click-away handler for filter dropdown */}
      {filterOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
      )}

      {/* Custom scrollbar / no-scrollbar utility */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
