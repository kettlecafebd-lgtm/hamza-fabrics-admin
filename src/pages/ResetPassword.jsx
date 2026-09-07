import React, { useState, useContext } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
import API_BASE_URL from '../config/api';

export default function ResetPassword() {
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword })
      });
      const data = await res.json();
      if (data.success) { setSuccess(true); toast.success('Password reset successful!'); }
      else toast.error(data.message);
    } catch {
      toast.error('Server error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-t-base flex items-center justify-center px-4 ${shopTheme}">
        <div className="w-full max-w-md bg-t-surface p-8 sm:p-10 rounded-3xl border border-t-border shadow-xl text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={30} className="text-green-600" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-widest text-t-main mb-2">Password Reset</h2>
          <p className="text-sm text-t-muted mb-6">Your password has been updated successfully.</p>
          <Link to="/customer/login"
            className="inline-block bg-t-primary text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-t-base flex items-center justify-center px-4 ${shopTheme}">
      <div className="w-full max-w-md bg-t-surface p-8 sm:p-10 rounded-3xl border border-t-border shadow-xl">
        <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-xs font-bold text-t-muted hover:text-t-primary mb-6 transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>
        <h2 className="text-xl font-black uppercase tracking-widest text-t-main mb-2">Reset Password</h2>
        <p className="text-xs text-t-muted mb-8">Enter the reset code from your email and choose a new password.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main focus:outline-none focus:border-t-primary transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Reset Code</label>
            <input type="text" required value={token} onChange={e => setToken(e.target.value)}
              className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main font-mono focus:outline-none focus:border-t-primary transition-colors"
              placeholder="Paste the code from the email" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">New Password</label>
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main focus:outline-none focus:border-t-primary transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-t-muted mb-1.5">Confirm Password</label>
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main focus:outline-none focus:border-t-primary transition-colors" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-t-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 transition-all">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
