import React from 'react';

/**
 * StatusBadge — Reusable status indicator pill
 *
 * Props:
 *   status  — "active" | "inactive" | "low_stock" | "out_of_stock" | "good" | "warning" | "danger"
 *   label   — custom label text
 *   pulse   — enable pulsing animation (for urgent alerts)
 *   size    — "sm" | "md"
 */
const STATUS_CONFIG = {
  active: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  good: {
    bg: 'bg-blue-50 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
    ring: 'ring-blue-500/20',
    dot: 'bg-blue-500',
  },
  inactive: {
    bg: 'bg-gray-100 dark:bg-white/10',
    text: 'text-gray-600 dark:text-gray-400',
    ring: 'ring-gray-500/20',
    dot: 'bg-gray-400',
  },
  low_stock: {
    bg: 'bg-amber-50 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-500',
  },
  out_of_stock: {
    bg: 'bg-red-50 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    ring: 'ring-red-500/20',
    dot: 'bg-red-500',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    ring: 'ring-red-500/20',
    dot: 'bg-red-500',
  },
};

export default function StatusBadge({ status = 'active', label, pulse = false, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ring-inset
        ${config.bg} ${config.text} ${config.ring}
        ${sizeClasses}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {label || status.replace('_', ' ')}
    </span>
  );
}

/**
 * StockIndicator — Visual stock level bar with smart coloring
 *
 * Props:
 *   current  — current stock
 *   initial  — initial stock
 *   compact  — smaller version
 */
export function StockIndicator({ current, initial, compact = false }) {
  const stock = Number(current) || 0;
  const init = Number(initial) || 0;
  const sold = init - stock;
  const sellPercent = init > 0 ? Math.round((sold / init) * 100) : 0;

  let barColor = 'bg-gray-400';
  let textColor = 'text-gray-600 dark:text-gray-400';
  if (sellPercent >= 70) {
    barColor = 'bg-gradient-to-r from-emerald-500 to-green-400';
    textColor = 'text-emerald-600 dark:text-emerald-400';
  } else if (sellPercent >= 30) {
    barColor = 'bg-gradient-to-r from-blue-500 to-indigo-400';
    textColor = 'text-blue-600 dark:text-blue-400';
  } else if (sellPercent >= 15) {
    barColor = 'bg-gradient-to-r from-amber-500 to-orange-400';
    textColor = 'text-amber-600 dark:text-amber-400';
  }

  const isLow = stock <= 10 && stock > 0;
  const isOut = stock === 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200/50 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${Math.min(sellPercent, 100)}%` }}
          />
        </div>
        <span className={`text-[11px] font-bold tabular-nums ${textColor}`}>
          {stock}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span className="text-gray-700 dark:text-gray-300">Sold: {sold}</span>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
          sellPercent >= 15
            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'
            : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
        }`}>
          {sellPercent}%
        </span>
      </div>
      <div className="w-full bg-gray-200/50 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${Math.min(sellPercent, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-500 font-medium">
        <span>
          Stock: <span className={`font-bold ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-gray-800 dark:text-gray-200'}`}>{stock}</span> / {init}
        </span>
        {isLow && !isOut && (
          <span className="flex items-center gap-1 text-amber-500">
            <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
            Low
          </span>
        )}
        {isOut && (
          <span className="flex items-center gap-1 text-red-500">
            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
            Out
          </span>
        )}
      </div>
    </div>
  );
}
