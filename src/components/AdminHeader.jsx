import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ProfileSettings from './ProfileSettings';
import { appConfig } from '../config/app';
import { useWebSocket } from '../context/WebSocketContext';

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch { return { name: 'Admin', email: '' }; }
}

const TYPE_STYLES = {
  new_order:       { bg: 'bg-emerald-500/10', dot: 'bg-emerald-500', label: 'New Order' },
  order_shipped:   { bg: 'bg-blue-500/10',    dot: 'bg-blue-500',    label: 'Shipped' },
  order_delivered: { bg: 'bg-green-500/10',   dot: 'bg-green-500',   label: 'Delivered' },
  order_cancelled: { bg: 'bg-red-500/10',     dot: 'bg-red-500',     label: 'Cancelled' },
  order_returned:  { bg: 'bg-orange-500/10',  dot: 'bg-orange-500',  label: 'Returned' },
  return_approved: { bg: 'bg-amber-500/10',   dot: 'bg-amber-500',   label: 'Return Approved' },
  return_requested:{ bg: 'bg-purple-500/10',  dot: 'bg-purple-500',  label: 'Return Request' },
  fraud_alert:     { bg: 'bg-rose-500/10',    dot: 'bg-rose-500',    label: 'Fraud Alert' },
  low_stock:       { bg: 'bg-yellow-500/10',  dot: 'bg-yellow-500',  label: 'Low Stock' },
};

const TOAST_ICONS = {
  new_order:       '🛒',
  order_shipped:   '📦',
  order_delivered: '✅',
  order_cancelled: '❌',
  order_returned:  '↩️',
  return_approved: '✅',
  return_requested:'↩️',
  fraud_alert:     '🚨',
  low_stock:       '⚠️',
};

const API = appConfig.apiUrl;

export default function AdminHeader() {
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifLoadOnce = useRef(false);
  const ws = useWebSocket();

  const token = localStorage.getItem('adminToken');
  const user = decodeToken(token);
  const initials = (user.name || 'A').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch(`${API}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!notifLoadOnce.current) {
      fetchNotifications();
      notifLoadOnce.current = true;
    }
  }, [fetchNotifications]);

  // WebSocket event handlers
  useEffect(() => {
    if (!ws) return;
    const unsubNotif = ws.subscribe('notification:new', (notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 30));
      setUnreadCount(prev => prev + 1);
      const style = TYPE_STYLES[notif.type];
      const icon = TOAST_ICONS[notif.type] || '🔔';
      toast.custom((t) => (
        <div
          onClick={() => { toast.dismiss(t.id); navigate(notif.link || '/'); }}
          className="flex items-start gap-3 bg-t-surface border border-t-border rounded-2xl shadow-2xl px-4 py-3 cursor-pointer hover:bg-t-base/80 transition-all max-w-sm"
        >
          <span className="text-lg shrink-0 mt-0.5">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${style ? style.bg : 'bg-t-base/50'} shrink-0`}>
                {style ? style.label : notif.type}
              </span>
            </div>
            <p className="text-xs font-bold text-t-main mt-1 truncate">{notif.title}</p>
            {notif.message && <p className="text-[11px] text-t-muted mt-0.5 line-clamp-1">{notif.message}</p>}
          </div>
        </div>
      ), { duration: 5000 });
    });
    return () => { if (unsubNotif) unsubNotif(); };
  }, [ws, navigate]);

  // Sync unread count from server periodically (fallback)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      if (!ws || !ws.connected) {
        try {
          const res = await fetch(`${API}/api/notifications/unread-count`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) setUnreadCount(data.count || 0);
        } catch (_) {}
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [token, ws]);

  const handleMarkRead = async (id) => {
    if (!token) return;
    try {
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await fetch(`${API}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleNotifClick = (n) => {
    if (!n.is_read) handleMarkRead(n.id);
    setNotifOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/orders?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  const closeAll = () => { setNotifOpen(false); setProfileOpen(false); };

  const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <header className="sticky top-0 z-30 bg-t-surface border-b border-t-border transition-colors duration-300">
      <div className="flex items-center justify-between h-16 px-4 md:px-6 gap-4">
        {/* Left: Search + Quick Links */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              className="w-full border border-t-border bg-t-base text-t-main rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-t-primary transition-all font-medium"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </form>

          {/* Ctrl+K Command Menu Trigger */}
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="hidden md:inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-t-border bg-t-base text-t-muted hover:text-t-main hover:border-t-primary/30 transition-all text-xs font-medium"
            title="Press Ctrl+K to search"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="hidden lg:inline">Search...</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-t-muted/10 text-[9px] font-bold border border-t-border">⌘K</kbd>
          </button>

          <Link to="/admin/orders/create" onClick={closeAll} className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-t-primary/10 text-t-primary hover:bg-t-primary hover:text-white transition-all shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            New Order
          </Link>

          <Link to="/orders?status=Pending" onClick={closeAll} className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending
          </Link>

          <Link to="/orders?status=Processing" onClick={closeAll} className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-all shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Processing
          </Link>
        </div>

        {/* Right: Notification + Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* WebSocket Status Indicator */}
          {ws && (
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${ws.connected ? 'bg-green-500' : 'bg-red-500'}`}
              title={ws.connected ? 'Live Connected' : 'Reconnecting...'}
            />
          )}

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); if (!notifOpen && notifications.length === 0) fetchNotifications(); }}
              className="relative p-2 rounded-xl text-t-muted hover:text-t-main hover:bg-t-base transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full shadow-lg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={closeAll} />
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-t-surface border border-t-border rounded-2xl shadow-xl z-20 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-t-border">
                    <p className="text-xs font-black uppercase tracking-widest text-t-muted">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </p>
                    {unreadCount > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkAllRead(); }}
                        className="text-[10px] font-bold text-t-primary hover:underline shrink-0"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="max-h-96 overflow-y-auto">
                    {notifLoading && notifications.length === 0 && (
                      <div className="p-6 text-center text-xs text-t-muted font-medium">Loading...</div>
                    )}
                    {!notifLoading && notifications.length === 0 && (
                      <div className="p-6 text-center text-xs text-t-muted font-medium">No new notifications</div>
                    )}
                    {notifications.map((n) => {
                      const style = TYPE_STYLES[n.type] || { bg: 'bg-t-base/50', dot: 'bg-t-muted', label: n.type };
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-t-base/50 transition-all border-b border-t-border/50 last:border-b-0 ${n.is_read ? 'opacity-60' : ''}`}
                        >
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${style.bg} shrink-0`}>
                                {style.label}
                              </span>
                              <span className="text-[10px] text-t-muted ml-auto shrink-0">{timeAgo(n.created_at)}</span>
                            </div>
                            <p className="text-xs font-bold text-t-main mt-1 truncate">{n.title}</p>
                            {n.message && (
                              <p className="text-[11px] text-t-muted mt-0.5 line-clamp-2">{n.message}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile Avatar Button */}
          <div className="relative">
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
              className="w-9 h-9 rounded-full bg-t-primary/15 text-t-primary font-black text-sm flex items-center justify-center hover:ring-2 hover:ring-t-primary/40 transition-all shrink-0"
            >
              {initials}
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={closeAll} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-t-surface border border-t-border rounded-2xl shadow-xl z-20 overflow-hidden">
                  {/* Avatar + Name + Email */}
                  <div className="p-5 pb-4 flex flex-col items-center border-b border-t-border">
                    <div className="w-16 h-16 rounded-full bg-t-primary/15 text-t-primary font-black text-xl flex items-center justify-center mb-3">
                      {initials}
                    </div>
                    <p className="text-sm font-bold text-t-main text-center">{user.name || 'Admin'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-xs text-t-muted">{user.email}</p>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">Primary</span>
                    </div>
                  </div>

                  {/* Email addresses */}
                  <div className="px-5 py-3 border-b border-t-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-t-muted mb-2">Email addresses</p>
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-t-muted shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                      <span className="text-xs text-t-main font-medium truncate">{user.email}</span>
                    </div>
                  </div>

                  {/* Connected account */}
                  <div className="px-5 py-3 border-b border-t-border">
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-t-muted shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      <div>
                        <p className="text-xs font-bold text-t-main">Google</p>
                        <p className="text-[10px] text-t-muted">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Manage Account */}
                  <div className="px-5 pt-3 pb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-t-muted mb-1">Manage account</p>
                  </div>
                  <button onClick={() => { closeAll(); setProfileModalOpen(true); }} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-t-base/50 transition-colors text-left">
                    <svg className="w-4 h-4 text-t-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <div>
                      <p className="text-xs font-bold text-t-main">{user.name || 'Admin'}</p>
                      <p className="text-[10px] text-t-muted">Profile, security & devices</p>
                    </div>
                  </button>

                  {/* Sign out */}
                  <div className="border-t border-t-border p-3">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {profileModalOpen && <ProfileSettings onClose={() => setProfileModalOpen(false)} />}
    </header>
  );
}
