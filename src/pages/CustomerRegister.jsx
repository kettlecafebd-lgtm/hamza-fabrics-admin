import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';

export default function CustomerRegister() {
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Passwords do not match!');
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Account created successfully!');
        localStorage.setItem('customerToken', result.token);
        localStorage.setItem('customerData', JSON.stringify(result.user));
        navigate('/account/profile'); // অ্যাকাউন্ট খোলার সাথে সাথেই লগইন হয়ে যাবে
      } else {
        toast.error(result.message || 'Registration failed');
      }
    } catch (error) {
      toast.error('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-t-base px-4 py-12 font-sans transition-colors duration-300 ${shopTheme}`}>
      <div className="w-full max-w-lg bg-t-surface p-8 sm:p-10 rounded-3xl shadow-xl border border-t-border animate-fade-in-up">
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black font-serif text-t-main uppercase tracking-widest mb-2">Create Account</h1>
          <p className="text-xs font-bold text-t-muted uppercase tracking-widest">Join the Hamza Fabrics family</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Full Name</label>
            <input 
              type="text" 
              name="name" 
              required 
              aria-required="true"
              value={formData.name} 
              onChange={handleChange} 
              className="w-full border border-t-border bg-t-base text-t-main rounded-xl px-4 py-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold"
              placeholder="e.g. Sarah Khan"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Email Address</label>
              <input 
                type="email" 
                name="email" 
                required 
                aria-required="true"
                value={formData.email} 
                onChange={handleChange} 
                className="w-full border border-t-border bg-t-base text-t-main rounded-xl px-4 py-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Phone Number</label>
              <input 
                type="text" 
                name="phone" 
                required 
                aria-required="true"
                value={formData.phone} 
                onChange={handleChange} 
                className="w-full border border-t-border bg-t-base text-t-main rounded-xl px-4 py-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-mono font-bold"
                placeholder="017XXXXXXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                name="password" 
                required 
                aria-required="true"
                value={formData.password} 
                onChange={handleChange} 
                className="w-full border border-t-border bg-t-base text-t-main rounded-xl px-4 py-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Confirm Password</label>
              <input 
                type="password" 
                name="confirmPassword" 
                required 
                aria-required="true"
                value={formData.confirmPassword} 
                onChange={handleChange} 
                className="w-full border border-t-border bg-t-base text-t-main rounded-xl px-4 py-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-t-primary hover:opacity-90 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg hover:-translate-y-0.5 mt-6"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-t-border pt-6">
          <p className="text-xs font-bold text-t-muted uppercase tracking-widest">
            Already have an account? 
            <Link to="/customer/login" className="text-t-primary ml-2 hover:underline">Sign In</Link>
          </p>
        </div>

      </div>
    </div>
  );
}