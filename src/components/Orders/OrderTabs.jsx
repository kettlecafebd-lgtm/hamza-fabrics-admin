import React from 'react';
import PropTypes from 'prop-types';

export default function OrderTabs({ activeTab, setActiveTab, orders, setSelectedOrders, setMeta }) {
  const TABS = ['Pending', 'Processing', 'RTS', 'Shipped', 'Delivered', 'Pending Return', 'Returned', 'Partial', 'Cancelled', 'Pending Cancel', 'Preorder', 'Lost'];

  return (
    <div role="tablist" aria-label="Order status tabs" className="border-b border-t-border px-2 pt-2 flex gap-2 overflow-x-auto custom-scrollbar bg-t-surface shrink-0">
      {TABS.map(tab => {
        const count = Array.isArray(orders) ? orders.filter(o => (o.status || 'pending').toLowerCase() === tab.toLowerCase().replace(' ', '_')).length : 0;
        return (
          <button 
            key={tab} 
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => { setActiveTab(tab); setSelectedOrders([]); setMeta(prev => ({ ...prev, page: 1 })); }} 
            className={`px-4 py-2.5 text-[12px] font-bold whitespace-nowrap border-b-2 transition-colors duration-200 flex items-center gap-2 ${activeTab === tab ? 'border-t-primary text-t-primary bg-t-primary/5' : 'border-transparent text-t-muted hover:text-t-main'}`}
          >
            {tab} <span className={`px-2 py-0.5 rounded-full text-[9px] ${activeTab === tab ? 'bg-t-primary text-white' : 'bg-t-base border border-t-border text-t-muted'}`}>{count}</span>
          </button>
        )
      })}
    </div>
  );
}

OrderTabs.propTypes = {
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  orders: PropTypes.array.isRequired,
  setSelectedOrders: PropTypes.func.isRequired,
  setMeta: PropTypes.func.isRequired,
};