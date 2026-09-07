import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';

const statusStyles = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-blue-100 text-blue-800',
  rts: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-gray-100 text-gray-800',
  partial: 'bg-orange-100 text-orange-800',
  preorder: 'bg-pink-100 text-pink-800',
  lost: 'bg-red-100 text-red-800',
};

export default function CustomerOrders() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/customers/orders`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('customerToken')}` }
        });
        const data = await res.json();
        if (data.success) {
          setOrders(data.data);
        } else {
          toast.error(data.message || 'Failed to load orders');
        }
      } catch {
        toast.error('Server error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-t-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-black uppercase tracking-widest text-t-main mb-4">No Orders Yet</h2>
        <p className="text-t-muted mb-8">You haven't placed any orders yet.</p>
        <Link to="/shop" className="inline-block bg-t-primary text-white px-8 py-3 rounded-xl font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black uppercase tracking-widest text-t-main mb-8">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/account/track?code=${order.order_code}`}
            className="block bg-t-surface border border-t-border rounded-xl p-6 hover:border-t-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-t-main">{order.order_code}</p>
                <p className="text-sm text-t-muted mt-1">
                  {new Date(order.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-lg font-black text-t-primary mt-2">৳{Number(order.total_amount).toLocaleString()}</p>
              </div>
              <div className="text-right space-y-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${statusStyles[order.status] || 'bg-gray-100 text-gray-800'}`}>
                  {order.status}
                </span>
                {order.courier_name && (
                  <div className="text-xs text-t-muted">
                    <p>{order.courier_name}</p>
                    {order.tracking_code && <p className="font-mono text-[10px]">ID: {order.tracking_code}</p>}
                    {order.courier_status && <p className="text-t-primary font-semibold">{order.courier_status}</p>}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
