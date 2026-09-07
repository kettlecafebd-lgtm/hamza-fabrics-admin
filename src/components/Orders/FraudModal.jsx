import React from 'react';
import PropTypes from 'prop-types';
import { X, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function FraudModal({ fraudData, setFraudData }) {
  if (!fraudData) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Fraud detection results" className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[300] p-4 font-sans">
      <div className="bg-t-base rounded-2xl w-full max-w-5xl border border-t-border shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-t-border flex justify-between items-center bg-t-surface">
           <h3 className="font-black text-lg text-t-main flex items-center gap-2">Fraud Detection Center</h3>
           <button onClick={() => setFraudData(null)} className="text-t-muted hover:text-red-500 transition-colors"><X size={24}/></button>
        </div>

        {/* Body */}
        <div className="p-8 bg-t-base">
           {/* Top Stats */}
           <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Genuine Box */}
              <div className="relative bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 overflow-hidden flex flex-col items-center justify-center h-48">
                 <CheckCircle2 size={150} className="absolute -right-6 -bottom-6 text-emerald-500/20 pointer-events-none" />
                 <h4 className="text-[11px] font-black text-emerald-500 tracking-[0.2em] mb-2 z-10">GENUINE PROBABILITY</h4>
                 <h2 className="text-7xl font-black text-emerald-500 mb-4 z-10">{fraudData?.summary?.genuine_prob || 0}%</h2>
                 <div className="bg-emerald-500/20 px-4 py-1.5 rounded-full z-10">
                    <span className="text-[11px] font-bold text-emerald-400">Successful Deliveries: {fraudData?.summary?.total_received || 0} out of {fraudData?.summary?.total_orders || 0}</span>
                 </div>
              </div>

              {/* Fraud Box */}
              <div className="relative bg-red-500/10 border border-red-500/20 rounded-2xl p-6 overflow-hidden flex flex-col items-center justify-center h-48">
                 <XCircle size={150} className="absolute -right-6 -bottom-6 text-red-500/20 pointer-events-none" />
                 <h4 className="text-[11px] font-black text-red-500 tracking-[0.2em] mb-2 z-10">FRAUD PROBABILITY</h4>
                 <h2 className="text-7xl font-black text-red-500 mb-4 z-10">{fraudData?.summary?.fraud_prob || 0}%</h2>
                 <div className="bg-red-500/20 px-4 py-1.5 rounded-full z-10">
                    <span className="text-[11px] font-bold text-red-400">Cancelled/Returned: {fraudData?.summary?.total_returned || 0} out of {fraudData?.summary?.total_orders || 0}</span>
                 </div>
              </div>
           </div>

           {/* Breakdown Title */}
           <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-orange-500" />
              <h4 className="text-[11px] font-black text-orange-500 tracking-widest uppercase">Detailed Courier Breakdown</h4>
           </div>

           {/* Couriers Grid */}
           <div className="grid grid-cols-5 gap-4">
              {['STEADFAST', 'PATHAO', 'REDX', 'PAPERFLY', 'CARRYBEE'].map(courier => {
                 const info = fraudData?.details?.[courier.toLowerCase()] || { status: 'failed', error: 'No Data' };
                 const hasError = !!info.error || info.status !== 'success';
                 
                 return (
                   <div key={courier} className="bg-t-surface border border-t-border rounded-xl p-4 flex flex-col h-[180px]">
                      <h5 className="text-[11px] font-black text-t-main tracking-widest mb-4 border-b border-t-border pb-2">{courier}</h5>
                      
                      {hasError ? (
                         <div className="flex-1 flex items-center justify-center">
                            <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-3 w-full text-center">
                               <p className="text-[9px] font-bold text-red-500 uppercase leading-relaxed">
                                  {info.error || 'Request Failed / Server Error'}
                               </p>
                            </div>
                         </div>
                      ) : (
                         <div className="flex-1 flex flex-col justify-center space-y-4">
                            <div>
                               <p className="text-[9px] font-bold text-t-muted uppercase mb-1">Success</p>
                               <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-black text-emerald-500 leading-none">{info.success || 0}</span>
                                  <span className="text-xs font-bold text-t-muted">/ {info.total || 0}</span>
                               </div>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-t-muted uppercase mb-1">Returned</p>
                               <span className="text-xl font-black text-red-500 leading-none">{info.return || 0}</span>
                            </div>
                         </div>
                      )}
                   </div>
                 )
              })}
           </div>
        </div>
      </div>
    </div>
  );
}

FraudModal.propTypes = {
  fraudData: PropTypes.object,
  setFraudData: PropTypes.func.isRequired,
};