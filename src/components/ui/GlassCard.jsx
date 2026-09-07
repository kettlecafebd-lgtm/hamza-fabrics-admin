import React from 'react';

/**
 * GlassCard — Glassmorphism wrapper component
 *
 * Provides a frosted-glass effect with backdrop-blur and semi-transparent backgrounds.
 * Works in both light and dark themes.
 *
 * Props:
 *   as          — HTML tag to render (default: "div")
 *   className   — extra classes
 *   hover       — enable hover glow effect
 *   children
 */
export default function GlassCard({
  as: Tag = 'div',
  className = '',
  hover = false,
  children,
  ...props
}) {
  return (
    <Tag
      className={`
        relative overflow-hidden rounded-2xl
        bg-white/70 dark:bg-gray-900/60
        backdrop-blur-xl
        border border-white/30 dark:border-white/10
        shadow-xl shadow-black/5 dark:shadow-black/30
        ${hover ? 'transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-300/30 dark:hover:border-indigo-400/20 hover:-translate-y-0.5' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * GlassModal — Glassmorphism modal overlay
 *
 * Props:
 *   open        — boolean
 *   onClose     — callback
 *   title       — modal title
 *   size        — "sm" | "md" | "lg" | "xl"
 *   children
 */
export function GlassModal({ open, onClose, title, size = 'lg', children }) {
  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-5xl',
    xl: 'max-w-7xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`
          relative w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col
          bg-white/80 dark:bg-gray-900/75
          backdrop-blur-2xl
          rounded-3xl
          border border-white/40 dark:border-white/10
          shadow-2xl shadow-black/20 dark:shadow-black/50
          overflow-hidden
          animate-in fade-in zoom-in-95 duration-200
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200/50 dark:border-white/10">
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all duration-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * GlassDropdown — Glassmorphism dropdown menu
 *
 * Props:
 *   open        — boolean
 *   onClose     — callback
 *   align       — "left" | "right"
 *   children
 */
export function GlassDropdown({ open, onClose, align = 'right', children, className = '' }) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={`
          absolute z-50 mt-2 w-56
          bg-white/80 dark:bg-gray-900/75
          backdrop-blur-2xl
          rounded-2xl
          border border-white/40 dark:border-white/10
          shadow-2xl shadow-black/15 dark:shadow-black/50
          py-1.5
          animate-in fade-in slide-in-from-top-2 duration-150
          ${align === 'right' ? 'right-0' : 'left-0'}
          ${className}
        `}
      >
        {children}
      </div>
    </>
  );
}
