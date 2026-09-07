import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Upload, CheckCircle, Shield } from 'lucide-react';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';

const ISSUE_TYPES = [
  { value: 'wrong-color', label: 'Received wrong color or design' },
  { value: 'measurement', label: 'Measurement issue (Insufficient fabric length)' },
  { value: 'defective', label: 'Defective or damaged fabric (e.g., stains, tears, or misprints)' },
  { value: 'missing', label: 'Missing component (e.g., dupatta or bottom fabric missing)' },
  { value: 'other', label: 'Other' },
];

export default function ResolutionCenter() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const navigate = useNavigate();
  const customerData = JSON.parse(localStorage.getItem('customerData') || 'null');
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selected]);
    selected.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews(p => [...p, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerData) {
      toast.error('Please login to submit a resolution request');
      navigate('/customer/login');
      return;
    }
    if (!issueType) { toast.error('Please select an issue type'); return; }
    if (!description.trim()) { toast.error('Please describe the issue'); return; }
    if (files.length === 0) { toast.error('Please upload at least one image'); return; }

    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append('issue_type', issueType);
      form.append('description', description);
      form.append('customer_id', customerData.id);
      form.append('customer_email', customerData.email);
      files.forEach(f => form.append('images', f));

      const res = await fetch(`${API_BASE_URL}/api/resolution/create`, {
        method: 'POST',
        headers: customerData.token ? { Authorization: `Bearer ${customerData.token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        toast.success('Resolution request submitted');
      } else {
        toast.error(data.message || 'Failed to submit');
      }
    } catch {
      toast.error('Server error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-t-base flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-t-surface rounded-2xl border border-t-border shadow-xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={36} className="text-green-600" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-widest text-t-main mb-3">Request Submitted</h2>
          <p className="text-sm text-t-muted leading-relaxed">
            Your request has been successfully submitted. Our support team will review the details and contact you shortly with a solution.
          </p>
          <button onClick={() => navigate('/shop')}
            className="mt-6 bg-t-primary text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-t-base py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-t-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-t-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-[0.15em] text-t-main">Resolution Center</h1>
          <p className="text-sm text-t-muted mt-3 max-w-lg mx-auto leading-relaxed">
            Please provide the details of your issue. We are committed to resolving it as quickly as possible.
          </p>
        </div>

        {!customerData && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 font-semibold">
              You need to <button onClick={() => navigate('/customer/login')} className="underline hover:text-amber-600">login</button> to submit a resolution request.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Section 1: Issue Type */}
          <section className="bg-t-surface rounded-2xl border border-t-border p-6 sm:p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-t-main mb-1">Select the Issue</h2>
            <p className="text-xs text-t-muted mb-5">What type of issue are you experiencing? (Required)</p>
            <div className="space-y-3">
              {ISSUE_TYPES.map(t => (
                <label key={t.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    issueType === t.value
                      ? 'border-t-primary bg-t-primary/5 text-t-main'
                      : 'border-t-border text-t-muted hover:border-t-primary/50'
                  }`}>
                  <input type="radio" name="issueType" value={t.value}
                    checked={issueType === t.value}
                    onChange={e => setIssueType(e.target.value)}
                    className="appearance-none w-4 h-4 rounded-full border-2 border-t-border checked:border-t-primary checked:bg-t-primary checked:ring-2 checked:ring-t-primary/20 transition-all shrink-0" />
                  <span className="text-sm font-semibold">{t.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Section 2: Description */}
          <section className="bg-t-surface rounded-2xl border border-t-border p-6 sm:p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-t-main mb-1">Detailed Description</h2>
            <p className="text-xs text-t-muted mb-5">Please provide additional details (Required)</p>
            <textarea rows={5}
              placeholder="Please describe the issue in detail to help us understand and resolve it efficiently..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-t-base border border-t-border rounded-xl px-4 py-3 text-sm text-t-main placeholder:text-t-muted/60 focus:outline-none focus:border-t-primary transition-colors resize-none" />
          </section>

          {/* Section 3: Evidence Upload */}
          <section className="bg-t-surface rounded-2xl border border-t-border p-6 sm:p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-t-main mb-1">Evidence Upload</h2>
            <p className="text-xs text-t-muted mb-5">Upload supporting images (Required)</p>

            <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-t-border rounded-xl cursor-pointer hover:border-t-primary/50 transition-colors">
              <Upload size={32} className="text-t-muted" />
              <span className="text-sm font-bold text-t-muted">Choose File / Upload Images</span>
              <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>

            {previews.length > 0 && (
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-t-border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-t-muted mt-4">
              Please upload clear photos showing the defect, measurement issue, or the incorrect item. You can attach multiple images.
            </p>
          </section>

          {/* Submit */}
          <button type="submit" disabled={isSubmitting}
            className="w-full py-4 bg-t-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all">
            {isSubmitting ? 'Submitting...' : 'Submit Resolution Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
