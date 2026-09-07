import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Search, Filter, ArrowUpDown, MoreVertical, Check, CheckCircle2, Printer, Box, ClipboardList, Download, FileSpreadsheet, Copy, FileText, Calendar, User, AlertTriangle, SlidersHorizontal } from 'lucide-react';

export default function OrderToolbar({
  searchQuery, setSearchQuery, setMeta, showSortMenu, setShowSortMenu,
  setSortConfig, selectedOrders = [], currentOrders = [], handleSelectAll,
  setAdvancedFilters, advancedFilters, handleBulkPrint, handleExportExcel,
  handleCheckDuplicates, handleAutoCall,
  visibleColumns, setVisibleColumns,
  handleBulkFraudCheck, handleBulkStickerPrint // Module Z: Thermal Sticker
}) {
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false); 
  
  const [localFilters, setLocalFilters] = useState({ ...advancedFilters });
  const selectedCount = selectedOrders?.length || 0;

  const handleApplyFilters = () => {
    setAdvancedFilters(localFilters);
    setMeta(prev => ({...prev, page: 1}));
    setShowFilterMenu(false);
  };

  const columnLabels = {
    dateInvoice: "Date & Invoice", customer: "Customer", repeat: "Repeat Order", 
    note: "Note", products: "Products & SKU", tags: "Tags", status: "Status", 
    print: "Print Status", total: "Total & Payment", upload: "Upload Status", 
    crossSale: "Cross Sale", userSource: "User & Source", shippingNote: "Shipping Note", 
    attachments: "Attachments"
  };

  const handleResetColumns = () => {
    setVisibleColumns(Object.keys(visibleColumns).reduce((acc, k) => ({...acc, [k]: true}), {}));
  };

  return (
    <div className="p-3 border-b border-t-border bg-t-surface flex flex-wrap gap-3 items-center shrink-0 text-sm relative">
      <div className="relative flex-1 min-w-[200px] max-w-[400px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-t-muted" size={16} />
        <input type="text" placeholder="Search orders..." aria-label="Search orders" value={searchQuery} onChange={(e) => {setSearchQuery(e.target.value); setMeta(prev => ({...prev, page: 1}))}} className="w-full pl-9 pr-4 py-2 bg-t-base border border-t-border rounded-lg text-t-main focus:outline-none focus:border-t-primary transition-colors placeholder-t-muted" />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Filter Menu */}
        <div className="relative">
          <button onClick={() => {setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); setShowBulkActions(false); setShowViewMenu(false);}} aria-label="Toggle filters" aria-haspopup="true" aria-expanded={showFilterMenu} className={`flex items-center gap-2 border px-3 py-2 rounded-lg font-medium transition-colors ${showFilterMenu ? 'bg-t-primary/10 border-t-primary text-t-primary' : 'bg-t-base border-t-border text-t-main hover:border-t-primary'}`}>
            <Filter size={14}/> Filters
          </button>
          
          {showFilterMenu && (
            <div className="absolute top-full right-0 lg:left-0 mt-2 w-[320px] sm:w-[350px] bg-t-surface border border-t-border rounded-xl shadow-2xl z-50 p-5 text-sm text-t-main max-h-[75vh] overflow-y-auto custom-scrollbar">
              <h3 className="font-black text-xl mb-4 text-t-main">Filters</h3>
              <div className="space-y-4 font-semibold">
                
                <div>
                  <label className="text-xs font-bold mb-2 block">Print Status</label>
                  <div className="flex gap-2">
                    {['All', 'Printed', 'Not printed'].map(opt => (
                      <button key={opt} onClick={() => setLocalFilters({...localFilters, printStatus: opt})} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${localFilters.printStatus === opt ? 'bg-t-primary text-white border-t-primary' : 'bg-t-base border-t-border hover:bg-t-primary/5'}`}>{opt}</button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-bold mb-2 block">Upload Status</label>
                  <div className="flex gap-2">
                    {['All', 'Not Uploaded', 'Uploaded'].map(opt => (
                      <button key={opt} onClick={() => setLocalFilters({...localFilters, uploadStatus: opt})} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${localFilters.uploadStatus === opt ? 'bg-t-primary text-white border-t-primary' : 'bg-t-base border-t-border hover:bg-t-primary/5'}`}>{opt}</button>
                    ))}
                  </div>
                </div>

                <div><label className="text-xs font-bold mb-1 block">Product SKU</label><input type="text" value={localFilters.productSku} onChange={e => setLocalFilters({...localFilters, productSku: e.target.value})} placeholder="Enter SKU to filter" className="w-full bg-t-base border border-t-border rounded-lg p-2.5 outline-none focus:border-t-primary text-t-main" /></div>
                <div><label className="text-xs font-bold mb-1 block">Product Name</label><input type="text" value={localFilters.productName} onChange={e => setLocalFilters({...localFilters, productName: e.target.value})} placeholder="Enter product name" className="w-full bg-t-base border border-t-border rounded-lg p-2.5 outline-none focus:border-t-primary text-t-main" /></div>
                <div><label className="text-xs font-bold mb-1 block">Order Source</label><select value={localFilters.orderSource} onChange={e => setLocalFilters({...localFilters, orderSource: e.target.value})} className="w-full bg-t-base border border-t-border rounded-lg p-2.5 outline-none focus:border-t-primary text-t-main"><option>All Sources</option><option>Website</option><option>Facebook</option></select></div>
                
                <div>
                  <label className="text-[10px] font-bold mb-1 block text-t-muted uppercase tracking-widest">Quantity Range</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={localFilters.minQty} onChange={e => setLocalFilters({...localFilters, minQty: e.target.value})} placeholder="Min" className="flex-1 bg-t-base border border-t-border rounded-lg p-2.5 outline-none text-center text-t-main" />
                    <span className="text-t-muted">-</span>
                    <input type="number" value={localFilters.maxQty} onChange={e => setLocalFilters({...localFilters, maxQty: e.target.value})} placeholder="Max" className="flex-1 bg-t-base border border-t-border rounded-lg p-2.5 outline-none text-center text-t-main" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold mb-1 block text-t-muted uppercase tracking-widest">Date Range</label>
                  <div className="space-y-2">
                    <div className="relative"><Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-t-muted"/><input type="date" aria-label="From date" value={localFilters.fromDate} onChange={e => setLocalFilters({...localFilters, fromDate: e.target.value})} className="w-full bg-t-base border border-t-border rounded-lg p-2.5 outline-none cursor-pointer text-t-main" /></div>
                    <div className="relative"><Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-t-muted"/><input type="date" aria-label="To date" value={localFilters.toDate} onChange={e => setLocalFilters({...localFilters, toDate: e.target.value})} className="w-full bg-t-base border border-t-border rounded-lg p-2.5 outline-none cursor-pointer text-t-main" /></div>
                  </div>
                </div>
              </div>
              <button onClick={handleApplyFilters} className="w-full mt-6 py-3 bg-t-primary hover:opacity-90 text-white rounded-lg font-black flex items-center justify-center gap-2 transition-all shadow-md">
                <Filter size={16}/> Apply Filters
              </button>
            </div>
          )}
        </div>
        
        {/* Sort Menu */}
        <div className="relative">
          <button onClick={() => {setShowSortMenu(!showSortMenu); setShowBulkActions(false); setShowFilterMenu(false); setShowViewMenu(false);}} aria-label="Toggle sort options" aria-haspopup="true" aria-expanded={showSortMenu} className="flex items-center gap-2 bg-t-base border border-t-border hover:border-t-primary px-3 py-2 rounded-lg text-t-main font-medium transition-colors">
            <ArrowUpDown size={14}/> Sort
          </button>
          {showSortMenu && (
             <div className="absolute top-full right-0 mt-2 w-56 bg-t-surface border border-t-border rounded-xl shadow-2xl z-50 py-2 text-sm text-t-main">
                {[{ label: 'Date Created (Newest)', val: 'date_desc' }, { label: 'Date Created (Oldest)', val: 'date_asc' }, { label: 'Order Amount (High to Low)', val: 'amount_desc' }, { label: 'Order Amount (Low to High)', val: 'amount_asc' }].map(opt => (
                   <div key={opt.val} onClick={() => {setSortConfig({key: opt.val}); setShowSortMenu(false);}} className="px-4 py-2.5 hover:bg-t-base cursor-pointer flex items-center gap-3 transition-colors font-semibold"><span className="text-xs">{opt.label}</span></div>
                ))}
             </div>
          )}
        </div>

        {/* View/Columns Menu */}
        <div className="relative">
          <button onClick={() => {setShowViewMenu(!showViewMenu); setShowSortMenu(false); setShowFilterMenu(false); setShowBulkActions(false);}} aria-label="Toggle column view options" aria-haspopup="true" aria-expanded={showViewMenu} className={`flex items-center gap-2 border px-3 py-2 rounded-lg font-medium transition-colors ${showViewMenu ? 'bg-t-primary/10 border-t-primary text-t-primary' : 'bg-t-base border-t-border text-t-main hover:border-t-primary'}`}>
            <SlidersHorizontal size={14}/> View
          </button>
          {showViewMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-t-surface border border-t-border rounded-xl shadow-2xl z-50 p-4 text-sm text-t-main">
              <h3 className="font-bold text-sm mb-3">Toggle columns</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                 {Object.entries(columnLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleColumns[key] ? 'bg-t-primary border-t-primary' : 'border-t-border bg-t-base group-hover:border-t-primary'}`}>
                        {visibleColumns[key] && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-xs font-semibold select-none">{label}</span>
                      <input type="checkbox" className="hidden" checked={visibleColumns[key]} onChange={() => setVisibleColumns({...visibleColumns, [key]: !visibleColumns[key]})} />
                    </label>
                 ))}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-t-border">
                 <button onClick={() => setShowViewMenu(false)} className="flex-1 bg-green-500/10 text-green-600 border border-green-500/20 py-1.5 rounded-lg text-xs font-bold hover:bg-green-500 hover:text-white transition-colors">Save</button>
                 <button onClick={handleResetColumns} className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-colors">Reset</button>
              </div>
            </div>
          )}
        </div>

        {/* 🔴 Bulk Actions Menu (Check Multi Courier Restored) */}
        <div className="relative">
          <button onClick={() => {setShowBulkActions(!showBulkActions); setShowSortMenu(false); setShowFilterMenu(false); setShowViewMenu(false);}} aria-label="Toggle bulk actions" aria-haspopup="true" aria-expanded={showBulkActions} className="flex items-center gap-2 bg-t-base border border-t-border hover:border-t-primary px-3 py-2 rounded-lg text-t-main font-medium transition-colors">
            <MoreVertical size={14}/> Actions
          </button>
          {showBulkActions && (
            <div className="absolute top-full right-0 mt-2 w-[280px] bg-t-surface border border-t-border rounded-xl shadow-2xl z-50 p-4 text-sm text-t-main">
               <div className="flex justify-between items-center px-1 pb-3 border-b border-t-border mb-3">
                  <span className="bg-t-base border border-t-border px-3 py-1 rounded-full text-[11px] font-black">{selectedCount} selected</span>
                  <button onClick={handleSelectAll} className="flex items-center gap-1.5 text-[13px] font-bold hover:text-t-primary transition-colors"><Check size={14}/> Select All</button>
               </div>
               
               <button onClick={handleAutoCall} className="w-full flex items-center justify-start px-4 gap-3 border border-t-border bg-t-base hover:bg-t-primary/10 rounded-lg py-2.5 mb-2 transition-colors font-bold text-sm">
                  <CheckCircle2 size={16}/> Open Approved Auto Call
               </button>

               {/* 🔴 New Multi-Courier Bulk Button */}
               <button onClick={handleBulkFraudCheck} className="w-full flex items-center justify-start px-4 gap-3 border border-t-border bg-t-base hover:text-orange-500 hover:border-orange-500/50 hover:bg-orange-500/10 rounded-lg py-2.5 mb-4 transition-colors font-bold text-sm">
                  <AlertTriangle size={16}/> Check Multi-Courier
               </button>
               
               <div className="px-1 pb-2 text-[11px] font-black text-t-muted flex items-center gap-2"><Printer size={14}/> Print Options</div>
               <div className="grid grid-cols-2 gap-2 px-1 mb-4 border-b border-t-border pb-4">
                  <button onClick={() => handleBulkPrint('invoice')} className="flex items-center gap-2 font-bold hover:text-t-primary transition-colors py-1"><FileText size={14}/> Invoice</button>
                  <button onClick={handleBulkStickerPrint} className="flex items-center gap-2 font-bold hover:text-t-primary transition-colors py-1"><Box size={14}/> Sticker</button>
                  <button onClick={() => handleBulkPrint('picking')} className="flex items-center gap-2 font-bold hover:text-t-primary transition-colors py-1"><ClipboardList size={14}/> Picking</button>
               </div>

               <div className="px-1 pb-2 text-[11px] font-black text-t-muted flex items-center gap-2"><Download size={14}/> Tools & Export</div>
               <div className="grid grid-cols-2 gap-2 px-1">
                  <button onClick={handleExportExcel} className="flex items-center gap-2 font-bold hover:text-t-primary transition-colors py-1"><FileSpreadsheet size={14}/> Excel</button>
                  <button onClick={handleCheckDuplicates} className="flex items-center gap-2 font-bold hover:text-t-primary transition-colors py-1"><Copy size={14}/> Duplicates</button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

OrderToolbar.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
  setMeta: PropTypes.func.isRequired,
  showSortMenu: PropTypes.bool.isRequired,
  setShowSortMenu: PropTypes.func.isRequired,
  setSortConfig: PropTypes.func.isRequired,
  selectedOrders: PropTypes.array,
  currentOrders: PropTypes.array,
  handleSelectAll: PropTypes.func.isRequired,
  setAdvancedFilters: PropTypes.func.isRequired,
  advancedFilters: PropTypes.object.isRequired,
  handleBulkPrint: PropTypes.func.isRequired,
  handleExportExcel: PropTypes.func.isRequired,
  handleCheckDuplicates: PropTypes.func.isRequired,
  handleAutoCall: PropTypes.func.isRequired,
  visibleColumns: PropTypes.object.isRequired,
  setVisibleColumns: PropTypes.func.isRequired,
  handleBulkFraudCheck: PropTypes.func.isRequired,
  handleBulkStickerPrint: PropTypes.func.isRequired,
};