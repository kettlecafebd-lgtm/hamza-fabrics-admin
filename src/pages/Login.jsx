import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config/api';

const Login = () => {
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  const isDark = isShopDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 🔴 Password visibility state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 🔴 ডায়নামিক ব্র্যান্ড ইনফো স্টেট
  const [brand, setBrand] = useState({
    firstName: 'Hamza',
    lastName: 'BI',
    tagline: 'Intelligent Commerce Platform'
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/settings/system`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setBrand({
            firstName: data.data.brand_first_name || 'KING',
            lastName: data.data.brand_last_name || 'AI',
            tagline: data.data.tagline || 'Intelligent Commerce Platform'
          });
        }
      })
      .catch(err => console.error("Failed to fetch brand settings:", err));
  }, []);

  // Module U: Generate browser fingerprint for device trust
  const getFingerprint = () => {
    const raw = [
      navigator.userAgent,
      `${screen.width}x${screen.height}`,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const fingerprint = getFingerprint();
      const ip = ''; // Client can't know its IP; server will get it from req.ip

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fingerprint, ip }),
        credentials: 'include', // Module V: send cookies
      });

      const result = await response.json();

      if (result.success) {
        // Module U: If 2FA required, redirect to verification page
        if (result.requires2FA) {
          sessionStorage.setItem('pending2FAUserId', result.userId);
          sessionStorage.setItem('pending2FAEmail', result.email);
          navigate('/verify-2fa');
          return;
        }

        // Known device — direct login
        localStorage.setItem('adminToken', result.token);
        localStorage.setItem('userRole', result.user?.role || 'employee');
        navigate('/');
      } else {
        setError(result.message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Server connection failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-t-base px-4 sm:px-6 lg:px-8 font-sans text-t-main transition-colors duration-300 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-t-primary opacity-10 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-t-accent opacity-10 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-md w-full bg-t-surface/80 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl border border-t-border relative z-10 transition-colors duration-300">
        
        {/* 🔴 Dynamic Logo Section */}
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black tracking-tight text-t-primary">
            {brand.firstName}<span className="text-t-main">{brand.lastName}</span>
          </h2>
          <p className="text-sm text-t-muted mt-2 font-medium">{brand.tagline}</p>
          <div className="mt-5 inline-block bg-t-primary/10 text-t-primary px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border border-t-primary/20 shadow-sm">
            Admin Access Only
          </div>
        </div>

        {error && (
          <div role="alert" aria-live="assertive" className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm text-center font-bold animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[11px] font-bold text-t-muted uppercase tracking-widest mb-2">Email Address</label>
            <input
              type="email"
              required
              aria-required="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-4 text-sm font-semibold outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all"
              placeholder="admin@hamzafabrics.com"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-t-muted uppercase tracking-widest mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                aria-required="true"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-4 pr-12 text-sm font-semibold outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-t-muted hover:text-t-primary transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all transform mt-4 ${
              loading ? 'bg-t-muted cursor-not-allowed' : 'bg-t-primary hover:opacity-90 shadow-lg shadow-t-primary/30 hover:-translate-y-0.5'
            }`}
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;