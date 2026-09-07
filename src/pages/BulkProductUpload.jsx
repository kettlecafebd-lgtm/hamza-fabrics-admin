import React, { useState, useContext } from 'react';
import API_BASE_URL from '../config/api';
import toast from 'react-hot-toast';
import { ThemeContext } from '../context/ThemeContext';
import { getToken } from '../utils/auth';

export default function BulkProductUpload() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const downloadTemplate = () => {
    const headers = ['name', 'sku', 'price', 'costPrice', 'stock', 'category', 'brand', 'description', 'imageUrl', 'alertQty', 'productType', 'size'];
    const sampleRow = ['Premium Cotton Panjabi', 'COTTON-PANJABI-01', '1850', '1200', '100', 'Panjabi', 'Hamza Fabrics', 'High-quality cotton fabric', 'https://example.com/img.jpg', '10', 'unstitched', 'M,L,XL'];
    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'product_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) {
      return toast.error('Please select a CSV file first!');
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/products/bulk-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message);
        setFile(null); 
        document.getElementById('csvFileInput').value = '';
      } else {
        toast.error(`Error: ${result.message}`);
      }
    } catch (error) {
      toast.error('Failed to connect to the server for upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-t-border pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Bulk Product Upload</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Upload or update multiple products using a CSV template.</p>
        </div>
      </div>

      <div className="bg-t-surface rounded-2xl shadow-sm border border-t-border overflow-hidden max-w-5xl transition-colors duration-300">
        
        <div className="p-8 md:p-10">
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
            <div className="flex-1 w-full border-2 border-dashed border-t-border rounded-xl p-4 flex items-center bg-t-base hover:border-t-primary/50 transition-colors">
              <input 
                id="csvFileInput"
                type="file" 
                accept=".csv" 
                onChange={handleFileChange}
                className="text-sm text-t-muted file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-t-primary/10 file:text-t-primary hover:file:bg-t-primary hover:file:text-white transition-all cursor-pointer w-full"
              />
            </div>
            <button onClick={downloadTemplate} className="w-full sm:w-auto bg-t-surface border border-t-border text-t-main px-6 py-4 rounded-xl text-sm font-bold hover:bg-t-base shadow-sm flex items-center justify-center gap-2 whitespace-nowrap transition-colors">
              <span>📥</span> Download Template
            </button>
          </div>

          <button 
            onClick={handleUpload}
            disabled={loading}
            className={`w-full text-white py-4 rounded-xl font-black tracking-widest uppercase text-sm shadow-lg transition-all flex items-center justify-center gap-3 ${loading ? 'bg-t-muted cursor-not-allowed' : 'bg-t-primary hover:opacity-90 shadow-t-primary/30 hover:-translate-y-0.5'}`}
          >
            <span>{loading ? '⏳' : '⬆️'}</span> {loading ? 'Uploading Products...' : 'Upload Products'}
          </button>

          <div className="mt-10 space-y-5 text-sm">
            <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-xl">
              <p className="font-extrabold text-blue-600 mb-2 uppercase tracking-widest text-xs">CSV Format Required</p>
              <p className="text-blue-600/80 font-medium leading-relaxed">Headers: <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">name</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">sku</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">price</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">costPrice</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">stock</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">category</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">brand</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">description</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">imageUrl</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">alertQty</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">productType</strong>, <strong className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-700">size</strong>.</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-xl">
              <p className="font-extrabold text-green-600 mb-2 uppercase tracking-widest text-xs">Match by SKU (Upsert)</p>
              <p className="text-green-600/80 font-medium leading-relaxed">If <strong className="font-mono bg-green-500/20 px-1.5 py-0.5 rounded text-green-700">sku</strong> matches an existing product, it will be <strong>updated</strong>. Otherwise a new product will be <strong>inserted</strong>. Only <strong className="font-mono bg-green-500/20 px-1.5 py-0.5 rounded text-green-700">name</strong> is required.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
