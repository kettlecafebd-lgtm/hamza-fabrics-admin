import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import { PhoneCall, Save, X, Edit, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import API_BASE_URL from '../../config/api';

export default function CRMLeads() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({
    net_profit_pushed: 0, success_count: 0, failed_count: 0, abandoned_leads: 0, recovered_leads: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [updateData, setUpdateData] = useState({ moderator_status: 'Pending', remarks: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchCRMData();
  }, []);

  const fetchCRMData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      // API Call: Analytics & Leads (একসাথে)
      const [summaryRes, leadsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/marketing/analytics-summary`, { headers }),
        fetch(`${API_BASE_URL}/api/marketing/abandoned-carts?limit=100`, { headers })
      ]);

      const summaryData = await summaryRes.json();
      const leadsData = await leadsRes.json();

      if (summaryData.success) setSummary(summaryData.summary);
      if (leadsData.success) setLeads(leadsData.leads);
      
    } catch (err) {
      toast.error('Failed to load CRM data!');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const openUpdateModal = (lead) => {
    setSelectedLead(lead);
    setUpdateData({ 
      moderator_status: lead.moderator_status || 'Pending', 
      remarks: lead.remarks || '' 
    });
    setIsModalOpen(true);
  };

  const handleUpdateLead = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/marketing/abandoned-carts/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(updateData)
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Lead updated successfully!');
        setIsModalOpen(false);
        fetchCRMData(); // ডেটা রিফ্রেশ
      } else {
        toast.error(data.message || 'Failed to update lead');
      }
    } catch (err) {
      toast.error('Server error!');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-t-muted font-bold uppercase tracking-widest bg-t-base min-h-screen">Loading CRM Data...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-t-base min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-t-main uppercase tracking-widest">Abandoned Cart CRM</h1>
          <p className="text-sm text-t-muted mt-1 font-semibold">Track & Recover Dropped Orders</p>
        </div>
        <button onClick={fetchCRMData} className="px-4 py-2 bg-t-surface text-t-muted font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-t-primary/10 hover:text-t-primary transition-colors border border-t-border">
          Refresh Data
        </button>
      </div>

      {/* 🔴 1. Analytics Summary (Top Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-t-surface p-5 rounded-2xl border border-t-border shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest">Net Profit Tracked</p>
          <h2 className="text-2xl font-black text-emerald-500">৳{summary.net_profit_pushed.toLocaleString()}</h2>
        </div>
        <div className="bg-t-surface p-5 rounded-2xl border border-t-border shadow-sm">
          <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest">Successful Events</p>
          <h2 className="text-2xl font-black text-t-main">{summary.success_count}</h2>
        </div>
        <div className="bg-t-surface p-5 rounded-2xl border border-t-border shadow-sm">
          <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest">Failed Events</p>
          <h2 className="text-2xl font-black text-red-500">{summary.failed_count}</h2>
        </div>
        <div className="bg-t-surface p-5 rounded-2xl border border-t-border shadow-sm border-l-4 border-l-orange-500">
          <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest">Abandoned Leads</p>
          <h2 className="text-2xl font-black text-orange-500">{summary.abandoned_leads}</h2>
        </div>
        <div className="bg-t-surface p-5 rounded-2xl border border-t-border shadow-sm border-l-4 border-l-blue-500">
          <p className="text-[10px] font-bold text-t-muted uppercase tracking-widest">Recovered</p>
          <h2 className="text-2xl font-black text-blue-500">{summary.recovered_leads}</h2>
        </div>
      </div>

      {/* 🔴 2. CRM Leads Table */}
      <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border overflow-hidden">
        <div className="p-5 border-b border-t-border bg-t-base/50 flex justify-between items-center">
          <h2 className="text-sm font-black uppercase tracking-widest text-t-main flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-500"/> Hot Leads (Follow Up Required)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-t-surface text-t-muted font-bold uppercase text-[10px] tracking-widest border-b border-t-border">
              <tr>
                <th className="p-4">Customer Info</th>
                <th className="p-4">Cart Details</th>
                <th className="p-4">Drop Step</th>
                <th className="p-4">Mod. Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border/50">
              {leads.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-t-muted font-bold">No abandoned carts found. Great job!</td></tr>
              ) : leads.map((lead) => {
                let items = [];
                try { items = JSON.parse(lead.cart_items); } catch(e){}
                
                return (
                  <tr key={lead.id} className="hover:bg-t-base/50 transition-colors group">
                    <td className="p-4">
                      <div className="font-black text-t-main flex items-center gap-2">
                        {lead.phone}
                        <a href={`tel:${lead.phone}`} className="text-t-primary hover:bg-t-primary/10 p-1 rounded-full"><PhoneCall size={14}/></a>
                      </div>
                      <div className="text-xs font-semibold text-t-muted mt-1">{lead.customer_name || 'N/A'}</div>
                      <div className="text-[10px] text-t-muted/60 mt-0.5 truncate max-w-[200px]">{lead.address || 'No address provided'}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-black text-t-main">৳{Number(lead.total_value).toLocaleString()}</div>
                      <div className="text-[10px] font-semibold text-t-muted mt-1">
                        {items.length} item(s) in cart
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded text-[10px] font-black uppercase">
                        {lead.last_step}
                      </span>
                      <div className="text-[10px] text-t-muted/60 font-semibold mt-2">
                        {new Date(lead.updated_at).toLocaleString('en-GB', { hour12: true })}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className={`text-xs font-black uppercase tracking-wider ${
                        lead.moderator_status === 'Pending' ? 'text-t-muted' :
                        lead.moderator_status === 'Interested' ? 'text-blue-500' :
                        lead.moderator_status === 'Wrong Number' ? 'text-red-500' : 'text-emerald-500'
                      }`}>
                        {lead.moderator_status || 'Pending'}
                      </div>
                      {lead.remarks && (
                        <div className="text-[10px] text-t-muted mt-1 max-w-[150px] truncate flex items-center gap-1">
                          <MessageSquare size={10}/> {lead.remarks}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => openUpdateModal(lead)} className="px-3 py-1.5 bg-t-primary text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-t-primary/90 transition-colors flex items-center gap-2 mx-auto">
                        <Edit size={12}/> Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔴 3. Moderator Action Modal */}
      {isModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-t-surface w-full max-w-md rounded-2xl shadow-2xl p-6 relative border border-t-border">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-t-muted hover:text-t-main">
              <X size={20}/>
            </button>
            <h2 className="text-lg font-black uppercase tracking-widest text-t-main mb-1">Update Lead Status</h2>
            <p className="text-xs font-bold text-t-muted mb-6">{selectedLead.phone} • {selectedLead.customer_name}</p>

            <form onSubmit={handleUpdateLead} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-2">Call Status</label>
                <select 
                  value={updateData.moderator_status} 
                  onChange={(e) => setUpdateData({...updateData, moderator_status: e.target.value})}
                  className="w-full bg-t-base border border-t-border text-t-main text-sm font-bold p-3 rounded-xl outline-none focus:border-t-primary"
                >
                  <option value="Pending">Pending / Not Called</option>
                  <option value="Called - No Answer">Called - No Answer</option>
                  <option value="Followed Up">Followed Up</option>
                  <option value="Interested">Interested (Will Buy)</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Wrong Number">Wrong Number</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-2">Remarks / Notes</label>
                <textarea 
                  value={updateData.remarks} 
                  onChange={(e) => setUpdateData({...updateData, remarks: e.target.value})}
                  placeholder="e.g. Customer will confirm tomorrow morning..."
                  className="w-full bg-t-base border border-t-border text-t-main text-sm font-semibold p-3 rounded-xl outline-none focus:border-t-primary custom-scrollbar resize-none h-24"
                ></textarea>
              </div>

              <button type="submit" disabled={isUpdating} className="w-full bg-t-primary hover:bg-t-primary/90 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
                {isUpdating ? 'Saving...' : <><Save size={16}/> Save Updates</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}