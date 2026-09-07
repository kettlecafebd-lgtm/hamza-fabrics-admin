import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';
import {
  LayoutDashboard, ShoppingBag, User, MapPin, Trophy, Star, LogOut,
  Package, Clock, ChevronRight, Mail, Phone, MapPinIcon,
  Save, Camera, CheckCircle, Shield, Edit3, Trash2, Plus,
  ImageOff, AlertCircle, BadgeCheck, Box, Heart, Percent
} from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'account', label: 'Account', icon: User },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'points', label: 'Points', icon: Trophy },
  { id: 'reviews', label: 'Reviews', icon: Star },
];

const token = () => localStorage.getItem('customerToken');
const authHeaders = () => ({ 'Authorization': `Bearer ${token()}` });

const statusStyles = {
  pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800', shipped: 'bg-blue-100 text-blue-800',
  rts: 'bg-purple-100 text-purple-800', delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800', returned: 'bg-gray-100 text-gray-800',
  partial: 'bg-orange-100 text-orange-800', preorder: 'bg-pink-100 text-pink-800',
  lost: 'bg-red-100 text-red-800',
};

export default function Profile() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/customers/dashboard`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success) setProfile(d.data); })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const updateCustomerData = (updated) => {
    const existing = JSON.parse(localStorage.getItem('customerData') || '{}');
    localStorage.setItem('customerData', JSON.stringify({ ...existing, ...updated }));
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerData');
      window.location.href = '/customer/login';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-t-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 overflow-hidden">
      {/* Tab Navigation - pill style, horizontal scroll on mobile */}
      <div className="flex gap-1 mb-8 overflow-x-auto scrollbar-none border-b border-t-border pb-1 -mx-1 px-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-t-primary text-white shadow-lg shadow-t-primary/20'
                  : 'text-t-muted hover:text-t-main hover:bg-t-base'
              }`}>
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl text-red-500 hover:bg-red-500/10 transition-all whitespace-nowrap shrink-0 ml-auto">
          <LogOut size={15} /> Logout
        </button>
      </div>

      {/* Tab Content - contain overflow */}
      <div className="w-full max-w-full overflow-hidden">
        {activeTab === 'dashboard' && <DashboardTab profile={profile} />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'account' && <AccountTab profile={profile} onUpdate={(d) => { setProfile(prev => ({ ...prev, user: { ...prev?.user, ...d } })); updateCustomerData(d); }} />}
        {activeTab === 'addresses' && <AddressesTab />}
        {activeTab === 'points' && <PointsTab profile={profile} />}
        {activeTab === 'reviews' && <ReviewsTab />}
      </div>
    </div>
  );
}

/* ───────── Dashboard Tab ───────── */
function DashboardTab({ profile }) {
  if (!profile) return null;
  const u = profile.user || {};
  const o = profile.orders || {};

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-t-primary/90 to-t-primary/60 p-6 text-white">
        <div className="relative z-10">
          <h2 className="text-xl font-black tracking-tight">Welcome back, {u.name}!</h2>
          <p className="text-sm text-white/80 mt-1 font-medium">Here's your account overview</p>
        </div>
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full"></div>
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full"></div>
      </div>

      {/* Stats Cards - compact grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: o.total || 0, icon: Box, color: 'from-blue-500/20 to-blue-600/10 text-blue-600' },
          { label: 'Delivered', value: o.delivered || 0, icon: BadgeCheck, color: 'from-green-500/20 to-green-600/10 text-green-600' },
          { label: 'Pending', value: o.pending || 0, icon: Clock, color: 'from-yellow-500/20 to-yellow-600/10 text-yellow-600' },
          { label: 'Reviews', value: profile.total_reviews || 0, icon: Star, color: 'from-purple-500/20 to-purple-600/10 text-purple-600' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.color} p-4 border border-t-border/50`}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={22} />
                <span className="text-2xl font-black">{card.value}</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="bg-t-base rounded-xl border border-t-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-t-border/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-t-main flex items-center gap-2">
            <Clock size={14} /> Recent Orders
          </h3>
          <button onClick={() => window.dispatchEvent(new CustomEvent('switch-profile-tab', { detail: 'orders' }))}
            className="text-[10px] font-bold text-t-primary hover:underline">View All</button>
        </div>
        {profile.recent_orders?.length > 0 ? (
          <div className="divide-y divide-t-border/50">
            {profile.recent_orders.map(order => (
              <Link key={order.id} to={`/account/track?code=${order.order_code}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-t-surface/50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-t-main">{order.order_code}</p>
                  <p className="text-[10px] text-t-muted font-semibold mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-black text-t-primary">৳{Number(order.total_amount).toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusStyles[order.status] || 'bg-gray-100 text-gray-800'}`}>{order.status}</span>
                  <ChevronRight size={14} className="text-t-muted" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-5">
            <ShoppingBag size={36} className="mx-auto text-t-muted mb-3" />
            <p className="text-sm font-bold text-t-muted">No orders yet</p>
            <Link to="/shop" className="inline-block mt-2 text-xs font-bold text-t-primary hover:underline">Start Shopping</Link>
          </div>
        )}
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-4 bg-t-base rounded-xl border border-t-border">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Mail size={18} className="text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-t-muted uppercase tracking-wider">Email</p>
            <p className="text-sm font-bold text-t-main truncate">{u.email}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {u.email_verified ? (
                <><CheckCircle size={11} className="text-green-500" /><span className="text-[9px] font-bold text-green-600">Verified</span></>
              ) : (
                <><AlertCircle size={11} className="text-yellow-500" /><span className="text-[9px] font-bold text-yellow-600">Not Verified</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-t-base rounded-xl border border-t-border">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-t-muted uppercase tracking-wider">Phone</p>
            <p className="text-sm font-bold text-t-main">{u.phone || 'Not set'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Orders Tab ───────── */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [load, setLoad] = useState(true);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/customers/orders`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success) setOrders(d.data); })
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoad(false));
  }, []);

  if (load) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-t-primary border-t-transparent rounded-full animate-spin"></div></div>;

  if (orders.length === 0) return (
    <div className="text-center py-16">
      <ShoppingBag size={44} className="mx-auto text-t-muted mb-4" />
      <h3 className="text-base font-black uppercase tracking-widest text-t-main mb-2">No Orders Yet</h3>
      <p className="text-xs font-bold text-t-muted mb-5">You haven't placed any orders yet.</p>
      <Link to="/shop" className="inline-block bg-t-primary text-white px-7 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs hover:opacity-90 transition-opacity">Start Shopping</Link>
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-t-main mb-3">Order History ({orders.length})</h3>
      {orders.map(order => (
        <Link key={order.id} to={`/account/track?code=${order.order_code}`}
          className="block p-4 bg-t-base rounded-xl border border-t-border hover:border-t-primary/50 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="font-bold text-t-main text-sm">{order.order_code}</p>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusStyles[order.status] || 'bg-gray-100 text-gray-800'}`}>{order.status}</span>
              </div>
              <p className="text-[10px] text-t-muted font-semibold">
                {new Date(order.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {order.items && order.items.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {order.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-t-surface rounded-lg px-2 py-1 border border-t-border/50">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-6 h-6 rounded object-cover" />
                      ) : <Package size={12} className="text-t-muted" />}
                      <span className="text-[9px] font-semibold text-t-muted max-w-[80px] truncate">{item.product_name || `Item #${item.id}`}</span>
                      <span className="text-[9px] font-bold text-t-main">x{item.quantity}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && <span className="text-[9px] font-bold text-t-muted self-center">+{order.items.length - 3}</span>}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-black text-t-primary">৳{Number(order.total_amount).toLocaleString()}</p>
              {order.courier_name && <p className="text-[9px] text-t-muted mt-0.5 font-semibold whitespace-nowrap">{order.courier_name}</p>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ───────── Account Tab ───────── */
function AccountTab({ profile, onUpdate }) {
  const [form, setForm] = useState({ firstName: '', secondName: '', phone: '', address: '', gender: '', date_of_birth: '' });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const fileRef = useRef();

  useEffect(() => {
    if (profile?.user) {
      const u = profile.user;
      const parts = (u.name || '').split(' ');
      const firstName = parts[0] || '';
      const secondName = parts.slice(1).join(' ') || '';
      setForm({ firstName, secondName, phone: u.phone || '', address: u.address || '', gender: u.gender || '', date_of_birth: u.date_of_birth ? u.date_of_birth.split('T')[0] : '' });
    }
  }, [profile]);

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (file) { setAvatar(file); setPreview(URL.createObjectURL(file)); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fullName = `${form.firstName} ${form.secondName}`.trim();
      const fd = new FormData();
      fd.append('name', fullName); fd.append('phone', form.phone); fd.append('address', form.address);
      fd.append('gender', form.gender); fd.append('date_of_birth', form.date_of_birth);
      if (avatar) fd.append('avatar', avatar);
      const res = await fetch(`${API_BASE_URL}/api/customers/profile`, {
        method: 'PUT', headers: authHeaders(), body: fd
      });
      const d = await res.json();
      if (d.success) { toast.success('Profile updated!'); onUpdate({ name: fullName, phone: form.phone, avatar_url: d.data?.avatar_url }); setAvatar(null); }
      else toast.error(d.message);
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/change-password`, {
        method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password })
      });
      const d = await res.json();
      if (d.success) { toast.success('Password changed!'); setPwForm({ current_password: '', new_password: '', confirm: '' }); }
      else toast.error(d.message);
    } catch { toast.error('Failed to change password'); }
  };

  const handleVerifyEmail = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/request-email-verification`, {
        method: 'POST', headers: authHeaders()
      });
      const d = await res.json();
      if (d.success) toast.success('Verification email sent!');
      else toast.error(d.message);
    } catch { toast.error('Failed to send verification'); }
  };

  const u = profile?.user || {};
  const avatarUrl = preview || u.avatar_url;

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center gap-5 p-5 bg-t-base rounded-xl border border-t-border">
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-t-primary/30 bg-t-surface flex items-center justify-center">
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : <User size={28} className="text-t-muted" />}
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-t-primary text-white rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-all">
            <Camera size={12} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-t-main">{u.name || 'Customer'}</h3>
          <p className="text-[11px] font-semibold text-t-muted mt-0.5 truncate">{u.email}</p>
          <div className="mt-1">
            {u.email_verified ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Verified</span>
            ) : (
              <button onClick={handleVerifyEmail} className="inline-flex items-center gap-1 text-[9px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full hover:bg-yellow-200 transition-colors">
                <AlertCircle size={10} /> Verify Email
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">First Name</label>
          <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
            className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold text-t-main focus:outline-none focus:border-t-primary transition-colors" />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">Second Name</label>
          <input type="text" value={form.secondName} onChange={e => setForm({ ...form, secondName: e.target.value })}
            className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold text-t-main focus:outline-none focus:border-t-primary transition-colors" />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">Phone</label>
          <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold text-t-main focus:outline-none focus:border-t-primary transition-colors" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">Address</label>
          <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2}
            className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold text-t-main focus:outline-none focus:border-t-primary transition-colors resize-none" />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">Gender</label>
          <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
            className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold text-t-main focus:outline-none focus:border-t-primary transition-colors">
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">Date of Birth</label>
          <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
            className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold text-t-main focus:outline-none focus:border-t-primary transition-colors" />
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 bg-t-primary text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50">
        <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Change Password */}
      <div className="border-t border-t-border pt-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-t-main mb-3 flex items-center gap-2">
          <Shield size={15} /> Change Password
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">Current Password</label>
            <input type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })}
              className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-primary transition-colors" />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">New Password</label>
            <input type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })}
              className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-primary transition-colors" />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-t-muted block mb-1">Confirm</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="w-full px-4 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-primary transition-colors" />
          </div>
        </div>
        <button onClick={handleChangePassword}
          className="mt-3 px-5 py-2 border border-t-primary text-t-primary rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-t-primary/10 transition-all">
          Update Password
        </button>
      </div>
    </div>
  );
}

/* ───────── Addresses Tab ───────── */
function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ label: 'Home', full_name: '', phone: '', street_address: '', city: '', state: '', zip_code: '', country: 'Bangladesh', is_default: false });

  const fetchAddresses = () => {
    fetch(`${API_BASE_URL}/api/addresses`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success) setAddresses(d.data); })
      .catch(() => toast.error('Failed to load addresses'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAddresses(); }, []);

  const resetForm = () => {
    setForm({ label: 'Home', full_name: '', phone: '', street_address: '', city: '', state: '', zip_code: '', country: 'Bangladesh', is_default: false });
    setEditId(null); setShowForm(false);
  };

  const handleSubmit = async () => {
    const isEdit = !!editId;
    try {
      const res = await fetch(`${API_BASE_URL}/api/addresses${isEdit ? '/' + editId : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const d = await res.json();
      if (d.success) { toast.success(isEdit ? 'Address updated!' : 'Address added!'); resetForm(); fetchAddresses(); }
      else toast.error(d.message);
    } catch { toast.error('Failed to save address'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/addresses/${id}`, { method: 'DELETE', headers: authHeaders() });
      const d = await res.json();
      if (d.success) { toast.success('Address deleted!'); fetchAddresses(); }
    } catch { toast.error('Failed to delete'); }
  };

  const handleEdit = (addr) => {
    setForm(addr); setEditId(addr.id); setShowForm(true);
  };

  const handleSetDefault = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/addresses/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true })
      });
      const d = await res.json();
      if (d.success) { toast.success('Default address updated!'); fetchAddresses(); }
      else toast.error(d.message);
    } catch { toast.error('Failed to set default'); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-t-primary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="w-full max-w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-t-main">Saved Addresses ({addresses.length})</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-t-primary text-white px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all">
          <Plus size={13} /> Add New
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-t-base rounded-xl border border-t-border space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-t-main">{editId ? 'Edit' : 'New'} Address</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Label (Home/Office)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
              className="px-3.5 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold focus:outline-none focus:border-t-primary" />
            <input placeholder="Full Name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="px-3.5 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold focus:outline-none focus:border-t-primary" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="px-3.5 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold focus:outline-none focus:border-t-primary" />
            <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
              className="px-3.5 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold focus:outline-none focus:border-t-primary" />
            <div className="sm:col-span-2">
              <textarea placeholder="Street Address" value={form.street_address} onChange={e => setForm({ ...form, street_address: e.target.value })} rows={2}
                className="w-full px-3.5 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold focus:outline-none focus:border-t-primary resize-none" />
            </div>
            <input placeholder="State" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
              className="px-3.5 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold focus:outline-none focus:border-t-primary" />
            <input placeholder="ZIP Code" value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })}
              className="px-3.5 py-2.5 bg-t-surface border border-t-border rounded-lg text-sm font-semibold focus:outline-none focus:border-t-primary" />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-t-main cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="rounded" />
            Set as default address
          </label>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="bg-t-primary text-white px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all">
              {editId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="px-5 py-2 border border-t-border rounded-lg font-bold text-xs text-t-muted hover:bg-t-base transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-t-base rounded-xl border border-t-border">
          <MapPin size={36} className="mx-auto text-t-muted mb-3" />
          <p className="text-sm font-bold text-t-muted">No addresses saved yet</p>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="mt-2 text-xs font-bold text-t-primary hover:underline">Add an address</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses.map(addr => (
            <div key={addr.id} className={`p-4 bg-t-base rounded-xl border transition-all ${addr.is_default ? 'border-t-primary' : 'border-t-border'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-t-primary/10 text-t-primary rounded-lg text-[9px] font-bold uppercase">{addr.label}</span>
                  {addr.is_default && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-[9px] font-bold uppercase">Default</span>}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {!addr.is_default && (
                    <button onClick={() => handleSetDefault(addr.id)} className="p-1.5 hover:bg-t-surface rounded-lg text-t-muted hover:text-green-500 transition-all" title="Set as default"><CheckCircle size={13} /></button>
                  )}
                  <button onClick={() => handleEdit(addr)} className="p-1.5 hover:bg-t-surface rounded-lg text-t-muted hover:text-t-primary transition-all" title="Edit"><Edit3 size={13} /></button>
                  <button onClick={() => handleDelete(addr.id)} className="p-1.5 hover:bg-t-surface rounded-lg text-t-muted hover:text-red-500 transition-all" title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="text-sm font-bold text-t-main">{addr.full_name}</p>
              <p className="text-[10px] text-t-muted font-semibold mt-0.5">{addr.phone}</p>
              <p className="text-[10px] text-t-muted mt-1.5 line-clamp-2">{addr.street_address}, {addr.city}{addr.state ? ', ' + addr.state : ''}</p>
              <p className="text-[9px] text-t-muted mt-0.5">{addr.country}{addr.zip_code ? ' - ' + addr.zip_code : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Points Tab ───────── */
function PointsTab({ profile }) {
  const points = profile?.user?.loyalty_points || 0;
  const tiers = [
    { name: 'Bronze', min: 0, color: 'from-amber-700 to-amber-500' },
    { name: 'Silver', min: 100, color: 'from-gray-400 to-gray-300' },
    { name: 'Gold', min: 500, color: 'from-yellow-500 to-yellow-300' },
    { name: 'Platinum', min: 1000, color: 'from-slate-400 to-slate-300' },
  ];
  const currentTier = tiers.filter(t => points >= t.min).pop() || tiers[0];
  const nextTier = tiers.find(t => points < t.min);
  const progress = nextTier ? (points / nextTier.min) * 100 : 100;

  return (
    <div className="w-full max-w-full space-y-5">
      {/* Points Card */}
      <div className={`relative overflow-hidden p-6 rounded-xl bg-gradient-to-br ${currentTier.color} text-white`}>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">Loyalty Status</p>
              <p className="text-xl font-black">{currentTier.name}</p>
            </div>
            <Trophy size={28} className="opacity-80" />
          </div>
          <div className="text-4xl font-black mb-1">{points}</div>
          <p className="text-xs font-bold opacity-80">Reward Points</p>
          {nextTier && points > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-bold mb-1 opacity-80">
                <span>{Math.round(progress)}% to {nextTier.name}</span>
                <span>{points} / {nextTier.min}</span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }}></div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      </div>

      {/* How to earn */}
      <div className="p-4 bg-t-base rounded-xl border border-t-border">
        <h4 className="text-xs font-black uppercase tracking-widest text-t-main mb-3">How to Earn Points</h4>
        <div className="space-y-2.5">
          {[
            { icon: '৳100', color: 'bg-green-500/10 text-green-600', text: 'Spend ৳100 = 1 Point' },
            { icon: '+5', color: 'bg-blue-500/10 text-blue-600', text: 'Write a product review' },
            { icon: '+10', color: 'bg-purple-500/10 text-purple-600', text: 'Verify your email address' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center font-bold text-xs shrink-0`}>{item.icon}</div>
              <p className="text-xs font-semibold text-t-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All Tiers */}
      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-t-main mb-3">Membership Tiers</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {tiers.map(t => {
            const achieved = points >= t.min;
            return (
              <div key={t.name} className={`p-3.5 rounded-xl border text-center transition-all ${achieved ? 'bg-t-base border-t-primary/30' : 'bg-t-base/50 border-t-border opacity-50'}`}>
                <Trophy size={20} className={`mx-auto mb-1.5 ${achieved ? 'text-t-primary' : 'text-t-muted'}`} />
                <p className="text-sm font-black text-t-main">{t.name}</p>
                <p className="text-[9px] font-bold text-t-muted mt-0.5">{t.min} pts</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Reviews Tab ───────── */
function ReviewsTab() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/reviews/mine`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success) setReviews(d.data); })
      .catch(() => toast.error('Failed to load reviews'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-t-primary border-t-transparent rounded-full animate-spin"></div></div>;

  if (reviews.length === 0) return (
    <div className="text-center py-16">
      <Star size={44} className="mx-auto text-t-muted mb-4" />
      <h3 className="text-base font-black uppercase tracking-widest text-t-main mb-2">No Reviews Yet</h3>
      <p className="text-xs font-bold text-t-muted mb-5">You haven't reviewed any products yet.</p>
      <Link to="/shop" className="inline-block bg-t-primary text-white px-7 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs hover:opacity-90 transition-opacity">Browse Products</Link>
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-t-main mb-3">My Reviews ({reviews.length})</h3>
      {reviews.map(review => (
        <div key={review.id} className="p-4 bg-t-base rounded-xl border border-t-border">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-t-surface shrink-0 border border-t-border">
              {review.product_image ? <img src={review.product_image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><ImageOff size={16} className="text-t-muted" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-t-main truncate">{review.product_name || 'Product'}</p>
                  <p className="text-[9px] text-t-muted font-semibold">SKU: {review.sku_code || '-'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase whitespace-nowrap shrink-0 ${review.status === 'approved' ? 'bg-green-100 text-green-700' : review.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {review.status}
                </span>
              </div>
              <div className="flex items-center gap-0.5 mt-1.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={12} className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                ))}
              </div>
              {review.review_text && <p className="text-xs text-t-muted mt-1.5 leading-relaxed line-clamp-2">{review.review_text}</p>}
              <p className="text-[9px] text-t-muted mt-1.5 font-semibold">
                {new Date(review.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
