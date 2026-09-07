import React, { useState, useEffect } from 'react';
import { User, Shield, Target, ShoppingCart, RotateCcw, ChevronRight } from 'lucide-react';
import API_BASE_URL from '../../config/api';

export default function CustomerContextPanel({ conversationId, isDark, borderColor }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) { setContext(null); return; }
    const fetchContext = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/customer-context`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setContext(data.context);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchContext();
  }, [conversationId]);

  if (!conversationId) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full text-t-muted p-6">
        <User className="w-10 h-10 opacity-20 mb-3" />
        <p className="text-xs font-bold text-center">Select a chat to view customer context</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-t-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="p-4 text-center text-t-muted text-xs">No customer data found</div>
    );
  }

  const fraudScore = context.fraudScore != null ? parseFloat(context.fraudScore) : null;
  const successScore = context.successScore != null ? parseFloat(context.successScore) : null;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Customer Header */}
      <div className="text-center pb-3 border-b border-t-border">
        <div className="w-14 h-14 rounded-full bg-t-primary/10 flex items-center justify-center mx-auto mb-2">
          <User className="w-6 h-6 text-t-primary" />
        </div>
        <h3 className="text-sm font-black text-t-main">{context.customerName}</h3>
        <p className="text-[10px] text-t-muted mt-0.5">{context.customerPhone || 'No phone'}</p>
        <div className="flex items-center justify-center gap-1 mt-1">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
            context.platform === 'whatsapp' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
            context.platform === 'messenger' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
            'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
          }`}>{context.platform}</span>
        </div>
      </div>

      {/* Fraud Score */}
      {fraudScore != null && (
        <div className={`p-3 rounded-xl border ${borderColor}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-t-muted flex items-center gap-1">
              <Shield className="w-3 h-3" /> Fraud Risk
            </span>
            <span className={`text-sm font-black ${fraudScore > 50 ? 'text-red-500' : fraudScore > 25 ? 'text-yellow-500' : 'text-green-500'}`}>
              {fraudScore}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-t-base rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              fraudScore > 50 ? 'bg-red-500' : fraudScore > 25 ? 'bg-yellow-500' : 'bg-green-500'
            }`} style={{ width: `${Math.min(100, fraudScore)}%` }}></div>
          </div>
        </div>
      )}

      {/* Intent Score */}
      {context.intentScore != null && (
        <div className={`p-3 rounded-xl border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-t-muted flex items-center gap-1">
              <Target className="w-3 h-3" /> Intent
            </span>
            <span className="text-sm font-black text-blue-500">{context.intentScore}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`p-3 rounded-xl border ${borderColor} text-center`}>
          <ShoppingCart className="w-4 h-4 text-t-primary mx-auto mb-1" />
          <p className="text-lg font-black text-t-main">{context.totalPreviousOrders || 0}</p>
          <p className="text-[10px] text-t-muted">Orders</p>
        </div>
        <div className={`p-3 rounded-xl border ${borderColor} text-center`}>
          <RotateCcw className="w-4 h-4 text-orange-500 mx-auto mb-1" />
          <p className="text-lg font-black text-t-main">{context.returnCount || 0}</p>
          <p className="text-[10px] text-t-muted">Returns</p>
        </div>
      </div>

      {/* Total Spent */}
      {context.totalSpent > 0 && (
        <div className={`p-3 rounded-xl border ${borderColor} text-center`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-t-muted">Total Spent</p>
          <p className="text-xl font-black text-green-600 mt-1">৳{Number(context.totalSpent).toLocaleString()}</p>
        </div>
      )}

      {/* Success Score */}
      {successScore != null && (
        <div className={`p-3 rounded-xl border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-t-muted">Success Score</span>
            <span className={`text-sm font-black ${successScore >= 80 ? 'text-green-500' : successScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
              {successScore}%
            </span>
          </div>
          <p className="text-[10px] text-t-muted mt-1">Higher = more reliable customer</p>
        </div>
      )}

      {/* Recent Orders */}
      {context.recentOrders?.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-t-muted mb-2">Recent Orders</h4>
          <div className="space-y-1.5">
            {context.recentOrders.map(order => (
              <div key={order.id} className={`flex items-center justify-between p-2 rounded-lg border ${borderColor} text-xs`}>
                <div>
                  <span className="font-bold text-t-main">{order.order_code || `#${order.id}`}</span>
                  <span className="text-t-muted ml-1">৳{Number(order.total_amount).toLocaleString()}</span>
                </div>
                <span className={`font-bold uppercase ${
                  order.status === 'delivered' ? 'text-green-500' :
                  order.status === 'cancelled' ? 'text-red-500' : 'text-t-muted'
                }`}>{order.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return History */}
      {context.returnHistory?.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-t-muted mb-2">Return History</h4>
          <div className="space-y-1.5">
            {context.returnHistory.map(ret => (
              <div key={ret.id} className={`flex items-center justify-between p-2 rounded-lg border ${borderColor} text-xs`}>
                <div>
                  <span className="font-bold text-t-main">{ret.return_code}</span>
                  <span className="text-t-muted ml-1">{ret.reason || '-'}</span>
                </div>
                <span className="font-bold uppercase text-t-muted">{ret.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
