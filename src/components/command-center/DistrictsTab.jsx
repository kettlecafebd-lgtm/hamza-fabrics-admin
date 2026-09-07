import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import API_BASE_URL from '../../config/api';
import { ThemeContext } from '../../context/ThemeContext';
import DistrictMap from '../DistrictMap';
import { getToken } from '../../utils/auth';

/**
 * DistrictsTab — Embedded District Map + Stats for Command Center
 * Extracted from DistrictMapPage.jsx, adapted as a tab content component
 */
const bdDistricts = ['Bagerhat','Bandarban','Barguna','Barisal','Bhola','Bogra','Brahmanbaria','Chandpur','Chapainawabganj','Chittagong','Chuadanga','Comilla','Coxsbazar','Dhaka','Dinajpur','Faridpur','Feni','Gaibandha','Gazipur','Gopalganj','Habiganj','Jamalpur','Jashore','Jhalokati','Jhenaidah','Joypurhat','Khagrachari','Khulna','Kishoreganj','Kurigram','Kushtia','Lakshmipur','Lalmonirhat','Madaripur','Magura','Manikganj','Meherpur','Moulvibazar','Munshiganj','Mymensingh','Naogaon','Narail','Narayanganj','Narsingdi','Natore','Netrokona','Nilphamari','Noakhali','Pabna','Panchagarh','Patuakhali','Pirojpur','Rajbari','Rajshahi','Rangamati','Rangpur','Satkhira','Shariatpur','Sherpur','Sirajganj','Sunamganj','Sylhet','Tangail','Thakurgaon'];

export default function DistrictsTab() {
  const { isAdminDark } = useContext(ThemeContext);
  const [customers, setCustomers] = useState([]);
  const [districtData, setDistrictData] = useState([]);
  const [districtMeta, setDistrictMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [redZonePopup, setRedZonePopup] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, distRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/customers`, { headers: { Authorization: `Bearer ${getToken()}` } }),
          fetch(`${API_BASE_URL}/api/analytics/districts`, { headers: { Authorization: `Bearer ${getToken()}` } })
        ]);
        const custResult = await custRes.json();
        const distResult = await distRes.json();
        if (custResult.success) setCustomers(custResult.data || []);
        if (distResult.success) {
          setDistrictData(distResult.data || []);
          setDistrictMeta(distResult.meta);
          const redZones = (distResult.data || []).filter(d => d.status === 'red').sort((a, b) => a.successRate - b.successRate);
          setRedZonePopup(redZones.length > 0 ? redZones.slice(0, 5) : null);
        }
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const handleDistrictClick = useCallback((name, data) => { setSelectedDistrict(name); setSelectedInfo(data); }, []);

  const districtDataMap = useMemo(() => { const m = {}; districtData.forEach(d => { m[d.district] = d; }); return m; }, [districtData]);
  const unassignedCustomers = useMemo(() => customers.filter(c => !c.district), [customers]);
  const totalOrders = useMemo(() => customers.reduce((s, c) => s + (c.total_orders || 0), 0), [customers]);
  const totalRevenue = useMemo(() => customers.reduce((s, c) => s + (Number(c.total_spent) || 0), 0), [customers]);
  const topDistricts = useMemo(() => { const c = {}; customers.forEach(cu => { if (cu.district) c[cu.district] = (c[cu.district] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5); }, [customers]);

  const isDark = isAdminDark;
  const bgSurface = isDark ? 'bg-gray-900/60' : 'bg-white/70';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderMain = isDark ? 'border-white/10' : 'border-gray-200/60';

  return (
    <div className="space-y-5">
      {/* Red Zone Alert */}
      {redZonePopup && redZonePopup.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3">
          <span className="text-red-400 text-xl shrink-0">🚨</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-red-400 text-xs uppercase tracking-widest">{districtMeta?.redCount} Red Zone{districtMeta?.redCount > 1 ? 's' : ''}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {redZonePopup.map(d => (
                <button key={d.district} onClick={() => { setSelectedDistrict(d.district); setSelectedInfo(d); }}
                  className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2.5 py-1 rounded-lg border border-red-500/20 transition-colors"
                >{d.district} ({d.successRate}%)</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Map */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl relative" style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}>
          <DistrictMap districtData={districtData} loading={loading} selectedDistrict={selectedDistrict} onDistrictClick={handleDistrictClick} />
          {selectedInfo && (
            <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur-sm rounded-xl p-5 border border-yellow-500/30 shadow-xl min-w-[200px] max-w-[260px] z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-yellow-400 text-base">{selectedDistrict}</h3>
                <button onClick={() => { setSelectedDistrict(null); setSelectedInfo(null); }} className="text-slate-500 hover:text-white text-lg leading-none">&times;</button>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Orders</span><span className="text-white font-bold">{selectedInfo.totalOrders}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Delivered</span><span className="text-green-400 font-bold">{selectedInfo.delivered}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cancelled</span><span className="text-red-400 font-bold">{selectedInfo.cancelled}</span></div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Success Rate</span>
                  <span className={`font-bold ${selectedInfo.successRate < 50 ? 'text-red-400' : selectedInfo.successRate < 70 ? 'text-amber-400' : 'text-green-400'}`}>{selectedInfo.successRate}%</span>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">Revenue</span><span className="text-teal-400 font-bold">৳{selectedInfo.revenue.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">👤 Customers</span>
              <span className="font-black text-white text-2xl">{customers.length}</span>
            </div>
            <div className="flex justify-between items-center bg-teal-500/10 p-3 rounded-xl border border-teal-500/20">
              <span className="text-teal-400 font-bold uppercase tracking-widest text-[10px]">🛒 Orders</span>
              <span className="font-black text-teal-400 text-2xl">{totalOrders}</span>
            </div>
            <div className="flex justify-between items-center pt-1 px-1">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">💰 Revenue</span>
              <span className="font-black text-white text-xl tracking-tight">৳{totalRevenue.toLocaleString('en-IN')}</span>
            </div>
            {districtMeta && (
              <div className="border-t border-slate-700 pt-3 space-y-2">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>Red</span><span className="font-black text-red-400">{districtMeta.redCount}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>Amber</span><span className="font-black text-amber-400">{districtMeta.amberCount}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>Safe</span><span className="font-black text-green-400">{districtMeta.safeCount}</span></div>
              </div>
            )}
          </div>

          <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest border-b border-slate-700 pb-3">🏆 Top Locations</h4>
            <div className="space-y-3 text-sm font-semibold">
              {topDistricts.length > 0 ? topDistricts.map(([district, count]) => (
                <div key={district} className="flex justify-between items-center">
                  <span className="text-slate-300 cursor-pointer hover:text-teal-400 transition-colors" onClick={() => { setSelectedDistrict(district); setSelectedInfo(districtDataMap[district] || null); }}>{district}</span>
                  <span className="font-black text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg">{count}</span>
                </div>
              )) : <div className="text-slate-600 text-xs text-center py-4">No districts assigned</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
