import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';

/**
 * Module U: Staff 2FA Verification Page
 * After password login from a new device, staff must enter a 6-digit code sent to their email.
 */
export default function Verify2FA() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [countdown, setCountdown] = useState(30);
  const otpRefs = useRef([]);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('pending2FAEmail');
    const storedUserId = sessionStorage.getItem('pending2FAUserId');
    if (!storedUserId) {
      navigate('/login');
      return;
    }
    setEmail(storedEmail || '***');
  }, [navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') handleVerify(e);
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(newOtp);
    if (pasted.length > 0) otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) return toast.error('Enter the complete 6-digit code');
    const userId = sessionStorage.getItem('pending2FAUserId');
    if (!userId) return toast.error('Session expired. Please log in again.');

    setLoading(true);
    try {
      const fingerprint = (() => {
        const raw = [navigator.userAgent, `${screen.width}x${screen.height}`, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
        let h = 0;
        for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h) + raw.charCodeAt(i); h |= 0; }
        return Math.abs(h).toString(36);
      })();

      const res = await fetch(`${API_BASE_URL}/api/auth/staff-verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: parseInt(userId), code, fingerprint, ip: '' }),
        credentials: 'include',
      });

      const result = await res.json();

      if (result.success) {
        sessionStorage.removeItem('pending2FAUserId');
        sessionStorage.removeItem('pending2FAEmail');
        localStorage.setItem('adminToken', result.token);
        localStorage.setItem('userRole', result.user?.role || 'employee');
        toast.success('2FA verified. Welcome!');
        navigate('/');
      } else {
        toast.error(result.message || 'Invalid code');
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-t-base px-4 font-sans">
      <div className="w-full max-w-md bg-t-surface p-8 rounded-3xl shadow-xl border border-t-border">
        <h1 className="text-2xl font-black text-t-main uppercase tracking-widest mb-2 text-center">2FA Verification</h1>
        <p className="text-xs text-t-muted text-center mb-6">
          Enter the 6-digit code sent to <strong>{email}</strong>
        </p>

        <div className="flex justify-center gap-3 mb-6">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (otpRefs.current[i] = el)}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              onPaste={handleOtpPaste}
              className="w-12 h-14 text-center text-xl font-black border-2 border-t-border rounded-xl bg-t-base text-t-main focus:border-t-primary focus:outline-none transition-colors"
              autoFocus={i === 0}
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || otp.join('').length !== 6}
          className="w-full bg-t-primary text-white py-4 rounded-xl font-black uppercase tracking-widest disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <div className="text-center mt-4">
          <button onClick={() => navigate('/login')} className="text-xs font-bold text-t-muted hover:text-t-primary transition-colors">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
