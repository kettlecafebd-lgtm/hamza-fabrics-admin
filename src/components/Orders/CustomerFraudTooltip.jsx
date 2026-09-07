import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import API_BASE_URL from '../../config/api';

export default function CustomerFraudTooltip({ phone, existingMetrics }) {
  const [fraudData, setFraudData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const handleMouseEnter = async () => {
    if (hasFetched || loading) return;
    
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/courier/fraud-check/${phone}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        setFraudData(result.data);
      } else {
        setError('No data found');
      }
    } catch (err) {
      setError('API Error');
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  const displayRate = fraudData ? fraudData.summary.genuine_prob : (existingMetrics?.success_rate || '?');
  const isGood = displayRate >= 80;

  return (
    <div 
      className="relative group/fraud inline-block ml-2 cursor-pointer"
      onMouseEnter={handleMouseEnter}
    >
      {/* Badge / Trigger */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-black flex items-center gap-1 w-max ${isGood ? 'text-green-500 bg-green-500/10' : 'text-orange-500 bg-orange-500/10'}`}>
        {displayRate}% {loading && <Loader2 size={10} className="animate-spin" />}
      </span>

      {/* Tooltip Content */}
      <div className="absolute hidden group-hover/fraud:block z-[100] left-1/2 -translate-x-1/2 top-full mt-2 bg-t-surface border border-t-border rounded-lg shadow-2xl p-4 w-[280px] pointer-events-none">
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-4 text-t-muted">
            <Loader2 size={24} className="animate-spin mb-2 text-blue-500" />
            <p className="text-xs font-bold">Checking multiple couriers...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center text-red-500 text-xs py-2 font-bold flex items-center justify-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {fraudData && !loading && (
          <>
            {/* Header: Success Rate */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xl font-bold ${fraudData.summary.genuine_prob >= 80 ? 'text-green-500' : 'text-orange-500'}`}>
                {fraudData.summary.genuine_prob}%
              </span>
              <span className="text-xs text-t-muted font-medium">success rate</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-t-base h-1.5 rounded-full mb-4 overflow-hidden">
              <div 
                className={`h-full ${fraudData.summary.genuine_prob >= 80 ? 'bg-green-500' : 'bg-orange-500'}`} 
                style={{ width: `${fraudData.summary.genuine_prob}%` }}
              ></div>
            </div>

            {/* Total Orders Box */}
            <div className="border border-t-border rounded p-3 mb-4 bg-t-base">
              <p className="text-[10px] text-t-muted font-bold mb-1 uppercase tracking-wider">Total Orders</p>
              <div className="flex justify-between items-end">
                <p className="text-lg font-black text-t-main leading-none">{fraudData.summary.total_orders}</p>
                <div className="text-[10px] text-t-muted flex gap-2">
                  <span className="text-green-500 flex items-center gap-0.5"><CheckCircle2 size={10}/> {fraudData.summary.total_received}</span>
                  <span className="text-red-500 flex items-center gap-0.5"><XCircle size={10}/> {fraudData.summary.total_returned}</span>
                </div>
              </div>
            </div>

            {/* Breakdown List */}
            <p className="text-[10px] text-t-muted font-bold mb-2 uppercase tracking-wider">Breakdown</p>
            <div className="space-y-2 text-xs text-t-main">
              {Object.entries(fraudData.details).map(([courier, data]) => {
                if (data.total === 0) return null;
                
                return (
                  <div key={courier} className="flex justify-between items-center bg-t-base p-1.5 rounded border border-t-border">
                    <span className="capitalize font-medium text-[11px] flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${data.success > data.return ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {courier}
                    </span>
                    <span className="font-mono text-[10px] bg-t-surface px-1.5 py-0.5 rounded border border-t-border">
                      <span className="text-green-500">{data.success}</span> / <span className="text-t-muted">{data.total}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

CustomerFraudTooltip.propTypes = {
  phone: PropTypes.string.isRequired,
  existingMetrics: PropTypes.object,
};