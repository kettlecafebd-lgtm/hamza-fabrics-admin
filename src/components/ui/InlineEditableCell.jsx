import React, { useState, useRef, useEffect } from 'react';

/**
 * InlineEditableCell
 *
 * Double-click → turns into an input field.
 * Press Enter or blur → saves.
 * Press Escape → cancels.
 *
 * Props:
 *   value        — current display value
 *   onSave(newValue) — callback when saved
 *   type         — "text" | "number" (default: "text")
 *   prefix       — optional prefix to display (e.g. "৳")
 *   className    — extra classes on the outer span
 *   inputClassName — extra classes on the input when editing
 *   displayClassName — extra classes on the display span
 *   disabled     — prevent editing
 *   placeholder  — input placeholder
 *   align        — "left" | "center" | "right"
 */
export default function InlineEditableCell({
  value,
  onSave,
  type = 'text',
  prefix = '',
  className = '',
  inputClassName = '',
  displayClassName = '',
  disabled = false,
  placeholder = '—',
  align = 'left',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value && onSave) {
      onSave(draft);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className={`w-full px-2 py-1 text-sm rounded-md border-2 border-indigo-400 bg-indigo-50/20 dark:bg-indigo-900/30 outline-none font-bold transition-all duration-150 ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
        } ${inputClassName}`}
        step={type === 'number' ? '1' : undefined}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => {
        if (!disabled) setEditing(true);
      }}
      title={disabled ? '' : 'Double-click to edit'}
      className={`inline-block px-2 py-1 text-sm rounded-md cursor-pointer transition-all duration-150 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 hover:ring-1 hover:ring-indigo-300/50 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${align === 'right' ? 'text-right w-full' : align === 'center' ? 'text-center w-full' : ''} ${displayClassName} ${className}`}
    >
      {prefix && <span className="text-t-muted mr-0.5">{prefix}</span>}
      <span className="font-bold">{value || placeholder}</span>
      {!disabled && (
        <svg className="inline-block ml-1 opacity-0 group-hover:opacity-100 transition-opacity" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      )}
    </span>
  );
}
