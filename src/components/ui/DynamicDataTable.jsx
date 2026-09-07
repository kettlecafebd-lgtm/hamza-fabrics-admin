import React, { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

/**
 * DynamicDataTable - Universal, premium data table component
 * Extracted design language from Sidebar.jsx:
 * - Typography: font-semibold text-sm for body, text-[11px] uppercase tracking-widest font-bold for headers
 * - Colors: bg-t-surface, text-t-main, text-t-muted, text-t-primary, border-t-border
 * - Borders: border border-t-border, rounded-lg
 * - Hover: hover:bg-t-primary/5 transition-colors
 * - Padding: px-3 py-2.5 (matches Sidebar nav items)
 * - Icons: Lucide with strokeWidth 1.5, size 14-16
 */
const DynamicDataTable = ({
  columns = [],
  data = [],
  sortable = true,
  paginated = true,
  pageSize = 10,
  emptyMessage = "No data found",
  emptyIcon = null,
  actions = null, // render prop: (row, index) => ReactNode
  onRowClick = null,
  selectable = false,
  onSelectionChange = null,
  className = '',
  headerClassName = '',
  rowClassName = '',
  cellClassName = '',
  loading = false,
  loadingMessage = "Loading data...",
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  // Sorting logic
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [data, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, paginated]);

  // Selection logic
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = new Set(paginatedData.map((_, index) => (currentPage - 1) * pageSize + index));
      setSelectedRows(newSelected);
      onSelectionChange?.(Array.from(newSelected));
    } else {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (index, e) => {
    const newSelected = new Set(selectedRows);
    const globalIndex = (currentPage - 1) * pageSize + index;

    if (e.target.checked) {
      newSelected.add(globalIndex);
    } else {
      newSelected.delete(globalIndex);
    }

    setSelectedRows(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  // Sort handler
  const handleSort = (key) => {
    if (!sortable) return;

    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Sort indicator
  const SortIndicator = ({ columnKey }) => {
    if (!sortable || sortConfig.key !== columnKey) {
      return <ChevronsUpDown size={14} className="opacity-50" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={14} className="text-t-primary" />
      : <ChevronDown size={14} className="text-t-primary" />;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`bg-t-surface rounded-lg border border-t-border overflow-hidden ${className}`}>
        <div className="p-16 text-center">
          <div className="w-8 h-8 border-4 border-t-surface border-t-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-t-muted font-semibold text-sm">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={`bg-t-surface rounded-lg border border-t-border overflow-hidden ${className}`}>
        <div className="p-16 text-center">
          {emptyIcon ? (
            <div className="text-t-muted mb-4">{emptyIcon}</div>
          ) : (
            <div className="w-16 h-16 bg-t-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MoreHorizontal size={24} className="text-t-primary" />
            </div>
          )}
          <p className="text-t-muted font-semibold text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-t-surface rounded-lg border border-t-border overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-t-base/50 border-b border-t-border">
              {selectable && (
                <th className="p-4 w-12 text-center border-r border-t-border">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-t-border cursor-pointer accent-t-primary"
                    onChange={handleSelectAll}
                    checked={paginatedData.length > 0 && paginatedData.every((_, index) => selectedRows.has((currentPage - 1) * pageSize + index))}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`p-4 text-[11px] font-bold text-t-muted uppercase tracking-widest whitespace-nowrap border-r border-t-border last:border-r-0 ${
                    column.align === 'center' ? 'text-center' :
                    column.align === 'right' ? 'text-right' : 'text-left'
                  } ${sortable ? 'cursor-pointer hover:bg-t-primary/5 transition-colors' : ''} ${headerClassName}`}
                  onClick={() => handleSort(column.key)}
                  style={{ minWidth: column.minWidth || 'auto', maxWidth: column.maxWidth || 'auto' }}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {sortable && <SortIndicator columnKey={column.key} />}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="p-4 text-[11px] font-bold text-t-muted uppercase tracking-widest text-right w-24 border-t-border">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-t-border">
            {paginatedData.map((row, index) => (
              <tr
                key={row.id || index}
                className={`hover:bg-t-primary/5 transition-colors duration-200 ${
                  onRowClick ? 'cursor-pointer' : ''
                } ${rowClassName}`}
                onClick={() => onRowClick?.(row, index)}
              >
                {selectable && (
                  <td className="p-4 text-center border-r border-t-border">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-t-border cursor-pointer accent-t-primary"
                      checked={selectedRows.has((currentPage - 1) * pageSize + index)}
                      onChange={(e) => handleSelectRow(index, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`p-4 border-r border-t-border last:border-r-0 ${
                      column.align === 'center' ? 'text-center' :
                      column.align === 'right' ? 'text-right' : 'text-left'
                    } ${cellClassName}`}
                  >
                    {column.render
                      ? column.render(row[column.key], row, index)
                      : row[column.key] ?? '-'
                    }
                  </td>
                ))}
                {actions && (
                  <td className="p-4 text-right border-t-border">
                    {actions(row, index)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="p-4 border-t border-t-border bg-t-base/30 flex items-center justify-between">
          <div className="text-sm text-t-muted font-semibold">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-t-border text-t-muted hover:bg-t-primary/5 hover:text-t-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                    currentPage === pageNum
                      ? 'bg-t-primary text-white shadow-md shadow-t-primary/20'
                      : 'text-t-muted hover:bg-t-primary/5 hover:text-t-primary border border-t-border'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-t-border text-t-muted hover:bg-t-primary/5 hover:text-t-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicDataTable;