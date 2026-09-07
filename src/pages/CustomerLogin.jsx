import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';

/**
 * Module T: Phone-First Customer Login
 * Step 1: Enter phone number → receive OTP via WhatsApp/SMS
 * Step 2: Enter 6-digit OTP → verified → logged in
 */
export default function CustomerLogin() {
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=phone, 2=otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState('');
  const otpRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (phone.length < 11) return toast.error('Enter a valid 11-digit phone number');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      if (result.success) {
        setMaskedPhone(result.phone || phone);
        setStep(2);
        setCountdown(60);
        toast.success(`OTP sent to ${result.phone || phone}`);
      } else {
        toast.error(result.message || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input (auto-advance)
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
    if (e.key === 'Enter') {
      handleVerifyOTP(e);
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(newOtp);
    if (pasted.length > 0) {
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) return toast.error('Enter the complete 6-digit code');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const result = await res.json();
      if (result.success) {
        // Store token for backward compat during migration
        localStorage.setItem('customerToken', result.token);
        localStorage.setItem('customerData', JSON.stringify(result.user));
        toast.success('Welcome to Hamza Fabrics!');
        navigate('/account/profile');
      } else {
        toast.error(result.message || 'Invalid OTP');
        if (result.remainingAttempts !== undefined) {
          toast(`Attempts remaining: ${result.remainingAttempts}`, { icon: '⚠️' });
        }
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-t-base px-4 font-sans ${shopTheme}`}>
      <div className="w-full max-w-md bg-t-surface p-8 rounded-3xl shadow-xl border border-t-border">
        <h1 className="text-2xl font-black text-t-main uppercase tracking-widest mb-2 text-center">Sign In</h1>
        <p className="text-xs text-t-muted text-center mb-6">
          {step === 1 ? 'Enter your phone number to get started' : `Enter the code sent to ${maskedPhone}`}
        </p>

        {step === 1 ? (
          /* Step 1: Phone Number Input */
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div>
              <label className="text-[11px] text-t-muted font-bold mb-1.5 block">Phone Number</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-t-muted font-bold text-sm">+88</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  className="w-full border border-t-border p-3.5 rounded-xl bg-t-base pl-14 text-t-main text-sm font-mono tracking-wider"
                  autoFocus
                  required
                />
              </div>
              <p className="text-[10px] text-t-muted mt-1.5">We'll send you a verification code via WhatsApp or SMS</p>
            </div>
            <button
              type="submit"
              disabled={loading || phone.length < 11}
              className="w-full bg-t-primary text-white py-4 rounded-xl font-black uppercase tracking-widest disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          /* Step 2: OTP Verification */
          <div className="space-y-6">
            {/* OTP Input Grid */}
            <div className="flex justify-center gap-3">
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
              onClick={handleVerifyOTP}
              disabled={loading || otp.join('').length !== 6}
              className="w-full bg-t-primary text-white py-4 rounded-xl font-black uppercase tracking-widest disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            {/* Resend / Change Phone */}
            <div className="text-center space-y-2">
              {countdown > 0 ? (
                <p className="text-xs text-t-muted">Resend OTP in {countdown}s</p>
              ) : (
                <button onClick={handleSendOTP} className="text-xs font-bold text-t-primary hover:underline">
                  Resend OTP
                </button>
              )}
              <div>
                <button onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); }} className="text-xs font-bold text-t-muted hover:text-t-primary transition-colors">
                  Change phone number
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
