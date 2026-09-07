import React, { useState, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext'; // আপনার ThemeContext এর সঠিক পাথ দিন
import { ShieldCheck, Search, Loader2, XCircle, CheckCircle, Package, AlertCircle, X } from 'lucide-react';
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';
import { getToken } from '../utils/auth';

export default function FraudChecker() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const [phoneInput, setPhoneInput] = useState('');
  const [fraudData, setFraudData] = useState(null);
  const [checkingPhone, setCheckingPhone] = useState(null);

  const handleManualFraudCheck = async (e) => {
    e.preventDefault();
    if (!phoneInput) return;

    setCheckingPhone(phoneInput);
    try {
      const response = await fetch(`${API_BASE_URL}/api/courier/fraud-check/${phoneInput}`, { 
        headers: { 'Authorization': `Bearer ${getToken()}` } 
      });
      const result = await response.json();
      if (result.success) setFraudData(result.data);
      else toast.error('Could not fetch courier data');
    } catch (err) { 
      toast.error('Failed to connect to Courier API.');
    } finally { 
      setCheckingPhone(null);
    }
  };

  return (
    // adminTheme ক্লাসটি মেইন কনটেইনারে অ্যাপ্লাই করা হলো
    <div className={`p-6 md:p-10 w-full mx-auto min-h-screen bg-t-base text-t-main transition-colors duration-300 ${adminTheme}`}>
      
      {/* 🔴 Search Card */}
      <div className="bg-t-surface rounded-3xl shadow-sm border border-t-border p-8 mb-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black mb-6 flex items-center justify-center gap-3 text-t-main">
          <ShieldCheck className="w-8 h-8 text-t-primary" />
          Intelligent Fraud Verification
        </h2>
        
        <form onSubmit={handleManualFraudCheck} className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-t-muted" />
            <input 
              type="text" 
              placeholder="Enter Customer Phone Number..." 
              value={phoneInput} 
              onChange={(e) => setPhoneInput(e.target.value)} 
              className="w-full pl-12 pr-4 py-4 border border-t-border bg-t-base text-t-main rounded-2xl focus:ring-2 focus:ring-t-primary/20 focus:border-t-primary outline-none font-medium text-lg transition-all"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={checkingPhone !== null} 
            className="bg-t-primary hover:opacity-90 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-t-primary/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-w-[160px]"
          >
            {checkingPhone ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Checking...</>
            ) : (
              'Verify Now'
            )}
          </button>
        </form>
      </div>

      {/* 🔴 Result Dashboard */}
      {fraudData && fraudData.summary && (
        <div className="bg-t-surface rounded-3xl p-8 md:p-10 w-full max-w-6xl mx-auto border border-t-border shadow-xl animate-fade-in">
          
          <div className="flex justify-between items-center mb-8 border-b border-t-border pb-6">
            <div>
              <h3 className="font-black text-2xl text-t-main flex items-center gap-3">
                <Package className="w-7 h-7 text-t-primary" /> 
                Customer Profile
              </h3>
              <p className="text-t-muted font-mono mt-1 text-lg">{fraudData.phone}</p>
            </div>
            <button onClick={() => setFraudData(null)} className="text-t-muted hover:text-red-500 bg-t-base hover:bg-red-500/10 p-2 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Probability Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden">
              <CheckCircle className="absolute -right-10 -bottom-10 w-48 h-48 text-emerald-500/10" />
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2 z-10">Genuine Probability</p>
              <h2 className="text-7xl font-black text-emerald-500 my-2 z-10">{fraudData.summary.genuine_prob || 0}%</h2>
              <div className="bg-emerald-500/10 text-emerald-600 px-4 py-1.5 rounded-full text-sm font-bold mt-2 z-10">
                Successful Deliveries: {fraudData.summary.total_received || 0} out of {fraudData.summary.total_orders || 0}
              </div>
            </div>
            
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden">
              <XCircle className="absolute -right-10 -bottom-10 w-48 h-48 text-rose-500/10" />
              <p className="text-xs font-black uppercase tracking-widest text-rose-600 mb-2 z-10">Fraud Probability</p>
              <h2 className="text-7xl font-black text-rose-500 my-2 z-10">{fraudData.summary.fraud_prob || 0}%</h2>
              <div className="bg-rose-500/10 text-rose-600 px-4 py-1.5 rounded-full text-sm font-bold mt-2 z-10">
                Cancelled/Returned: {fraudData.summary.total_returned || 0} out of {fraudData.summary.total_orders || 0}
              </div>
            </div>
          </div>

          {/* Courier Breakdown */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-t-primary mb-6 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Detailed Courier Breakdown
            </h4>
            
            {fraudData.details ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {Object.entries(fraudData.details).map(([key, item]) => {
                  if (!item) return null;
                  return (
                    <div key={key} className="bg-t-base border border-t-border rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:border-t-primary/50 transition-colors">
                      <div className="text-xs font-black uppercase tracking-widest text-t-muted mb-4 pb-4 border-b border-t-border flex justify-between items-center">
                        {key}
                      </div>
                      
                      {item.status === 'success' ? (
                        item.total > 0 ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] uppercase font-bold text-t-muted mb-1">Success</p>
                              <div className="text-2xl font-black text-emerald-500">{item.success} <span className="text-sm text-t-muted font-medium">/ {item.total}</span></div>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-t-muted mb-1">Returned</p>
                              <div className="text-lg font-bold text-rose-500">{item.return}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center min-h-[100px]">
                            <span className="bg-t-surface border border-t-border text-t-muted px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest">
                              No Records
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="flex-1 flex items-center justify-center mt-2">
                          <span className={`text-[10px] font-bold px-3 py-2 rounded-xl uppercase tracking-wider text-center w-full break-words border ${
                            item.status === 'no_credentials' 
                            ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' 
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {item.message}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-10 bg-t-base border border-t-border rounded-3xl text-t-muted font-medium">
                No courier data available for this number.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}