import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import API_BASE_URL from '../config/api';

export default function ForgotPassword() {
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if(data.success) { setSent(true); toast.success('Reset link sent!'); }
      else toast.error(data.message);
    } catch {
      toast.error('Server connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-t-base flex items-center justify-center px-4 ${shopTheme}">
      <div className="w-full max-w-md bg-t-surface p-8 sm:p-10 rounded-3xl border border-t-border shadow-xl">
        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={30} className="text-green-600" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-widest text-t-main mb-2">Check Your Email</h2>
            <p className="text-sm text-t-muted leading-relaxed">
              If an account exists for <strong className="text-t-main">{email}</strong>, we've sent a password reset link.
            </p>
            <Link to="/reset-password"
              className="inline-block mt-5 text-xs font-bold text-t-primary hover:underline">
              Enter Reset Code Manually
            </Link>
          </div>
        ) : (
          <>
            <Link to="/customer/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-t-muted hover:text-t-primary mb-6 transition-colors">
              <ArrowLeft size={14} /> Back to Login
            </Link>
            <h2 className="text-xl font-black uppercase tracking-widest text-t-main mb-2">Forgot Password</h2>
            <p className="text-xs text-t-muted mb-8">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleReset} className="space-y-5">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-t-muted" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-t-base border border-t-border rounded-xl pl-10 pr-4 py-3.5 text-sm text-t-main placeholder:text-t-muted/60 focus:outline-none focus:border-t-primary transition-colors"
                  placeholder="your@email.com" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-t-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 transition-all">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
