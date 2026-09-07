import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';
import { getToken } from '../utils/auth';
import DynamicDataTable from '../components/ui/DynamicDataTable';
import { Package, Trash2 } from 'lucide-react';

export default function CategoriesBrands() {

  // 'Sizes' রিমুভ করা হয়েছে, এখন শুধু Categories এবং Brands থাকবে
  const [activeTab, setActiveTab] = useState('Categories');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [taxonomyData, setTaxonomyData] = useState({ Categories: [], Brands: [] });

  const fetchData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/taxonomy`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const result = await response.json();
      if (result.success) {
        setTaxonomyData(result.data);
      }
    } catch (err) {
      toast.error('Failed to connect to server.');
    }
  };

  useEffect(() => {
    fetchData(); 
  }, []);

  const getCurrentData = () => taxonomyData[activeTab] || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/taxonomy`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` 
        },
        body: JSON.stringify({ type: activeTab, name: newItemName })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`${activeTab} added successfully!`);
        fetchData(); 
        setNewItemName('');
        setShowAddModal(false);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error('Server error while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this item?`)) return;

    try {
      const url = `${API_BASE_URL}/api/taxonomy/${activeTab.toLowerCase()}/${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      const contentType = response.headers.get("content-type");
      
      if (contentType && contentType.includes("application/json")) {
        const result = await response.json();
        if (result.success) {
          toast.success('Deleted successfully!');
          fetchData(); 
        } else {
          toast.error(result.message || 'Failed to delete.');
        }
      } else {
        toast.error(`Route Error: ${response.status} ${response.statusText}. Check console!`);
      }
    } catch (err) {
      toast.error(`Crash: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-t-border pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Taxonomy & Formats</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Manage categories and brands for Hamza Fabrics storefront.</p>
        </div>
      </div>

      <div className="flex bg-t-surface border border-t-border rounded-xl p-1.5 w-fit mb-8 shadow-sm">
        {['Categories', 'Brands'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} 
            className={`px-8 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === tab ? 'bg-t-primary text-white shadow-md' : 'text-t-muted hover:text-t-main hover:bg-t-base'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border overflow-hidden transition-colors duration-300">
        <div className="p-6 border-b border-t-border flex justify-between items-center bg-t-base/30">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Global {activeTab}</h2>
            <p className="text-xs text-t-muted mt-1 font-medium">Manage and organize your global {activeTab.toLowerCase()} hierarchy.</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-t-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-t-primary/30 transition-transform transform hover:-translate-y-0.5">
            <span>+</span> Add {activeTab}
          </button>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-t-base/80 border-b border-t-border text-xs font-bold text-t-muted uppercase tracking-widest">
                <th className="p-5 w-20 text-center">ID</th>
                <th className="p-5">Name / Value</th>
                <th className="p-5 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border text-sm">
              {getCurrentData().map((item) => (
                <tr key={item.id} className="hover:bg-t-base/50 transition-colors group">
                  <td className="p-5 text-center font-bold text-t-muted">#{item.id.toString().slice(-4)}</td>
                  <td className="p-5 font-bold text-t-main">{item.name}</td>
                  <td className="p-5 text-right pr-6">
                    <button onClick={() => handleDelete(item.id)} className="text-t-muted hover:text-red-500 hover:bg-red-500/10 transition-colors p-2 rounded-lg text-xs font-bold">Delete</button>
                  </td>
                </tr>
              ))}
              {getCurrentData().length === 0 && (
                <tr><td colSpan="3" className="p-16 text-center text-t-muted font-bold">No {activeTab.toLowerCase()} found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAdd} className="bg-t-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-t-border">
            <div className="px-6 py-4 bg-t-base border-b border-t-border flex justify-between items-center">
              <h2 className="text-lg font-black text-t-main">Add New {activeTab}</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-t-muted hover:text-red-500 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-t-muted mb-2 uppercase tracking-widest">Enter Name</label>
              <input 
                autoFocus required type="text" 
                value={newItemName} 
                onChange={(e) => setNewItemName(e.target.value)} 
                placeholder={`e.g. ${activeTab === 'Categories' ? 'Bridal Wear' : 'Sabyasachi'}`}
                className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary" 
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-base/50">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2 text-sm border border-t-border text-t-main hover:opacity-80 rounded-xl font-bold">Cancel</button>
              <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-t-primary text-white rounded-xl font-bold shadow-md hover:opacity-90">{loading ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}