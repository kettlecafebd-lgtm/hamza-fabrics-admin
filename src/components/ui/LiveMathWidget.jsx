import React from 'react';

/**
 * LiveMathWidget — Floating Combo Price Calculator
 *
 * Shows at the bottom of the combo canvas.
 * Displays: Regular Price → Discount → Combo Price → Profit Margin
 *
 * Props:
 *   math   — object with: regularTotal, discountPercent, discountAmount,
 *            finalComboPrice, totalCost, profit, margin, itemCount
 *   isDark — boolean for dark mode
 */
export default function LiveMathWidget({ math, isDark }) {
  const {
    regularTotal,
    discountPercent,
    discountAmount,
    finalComboPrice,
    totalCost,
    profit,
    margin,
    itemCount,
  } = math;

  const isProfit = profit > 0;
  const marginNum = parseFloat(margin) || 0;

  return (
    <div className="shrink-0 border-t border-gray-200/50 dark:border-white/10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl">
      <div className="px-6 py-4">
        {/* Main Price Display */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-6">
            {/* Regular Total */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Regular</p>
              <p className="text-lg font-extrabold text-gray-400 line-through decoration-red-400/60">
                ৳{regularTotal.toLocaleString()}
              </p>
            </div>

            {/* Arrow + Discount */}
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 dark:text-gray-600">
                <path d="M5 12h14m-7-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200/50 dark:border-red-500/20">
                <p className="text-xs font-black text-red-500">-{discountPercent}%</p>
                <p className="text-[9px] text-red-400 font-medium">-৳{discountAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Final Combo Price */}
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 dark:text-gray-600">
                <path d="M5 12h14m-7-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Combo Price</p>
                <p className="text-2xl font-black text-white tabular-nums">
                  ৳{finalComboPrice.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Profit Info */}
          <div className="flex items-center gap-4">
            {/* Cost */}
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cost</p>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400">৳{totalCost.toLocaleString()}</p>
            </div>

            {/* Profit */}
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Profit</p>
              <p className={`text-sm font-black ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}৳{profit.toLocaleString()}
              </p>
            </div>

            {/* Margin Badge */}
            <div className={`
              px-4 py-2 rounded-xl border-2 transition-all duration-300
              ${marginNum >= 30
                ? 'border-emerald-400 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10'
                : marginNum >= 15
                ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10'
                : 'border-red-400 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10'
              }
            `}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Margin</p>
              <p className={`text-xl font-black tabular-nums ${
                marginNum >= 30
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : marginNum >= 15
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {margin}%
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200/50 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              marginNum >= 30
                ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                : marginNum >= 15
                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                : 'bg-gradient-to-r from-red-500 to-rose-400'
            }`}
            style={{ width: `${Math.min(Math.max(marginNum, 5), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
