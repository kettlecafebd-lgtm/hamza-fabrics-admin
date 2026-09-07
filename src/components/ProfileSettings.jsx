import React, { useState } from 'react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch { return { name: 'Admin', email: '', id: null }; }
}

export default function ProfileSettings({ onClose }) {
  const token = localStorage.getItem('adminToken');
  const user = decodeToken(token);
  const nameParts = (user.name || 'Admin').split(' ');
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [altEmail, setAltEmail] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const getHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB.'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim()) { toast.error('First name is required.'); return; }
    setSaving(true);
    try {
      let avatar_url = null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const uploadRes = await fetch(`${API_BASE_URL}/api/upload-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.success) avatar_url = uploadData.url;
        else { toast.error('Failed to upload avatar.'); setSaving(false); return; }
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), avatar_url, alternative_email: altEmail.trim() || null })
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Profile updated!');
        onClose();
      } else {
        toast.error(result.message || 'Failed to update profile.');
      }
    } catch { toast.error('Server error.'); } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) { toast.error('Fill all fields.'); return; }
    if (newPwd.length < 6) { toast.error('New password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match.'); return; }
    setChangingPwd(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Password changed!');
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      } else {
        toast.error(result.message || 'Failed to change password.');
      }
    } catch { toast.error('Server error.'); } finally { setChangingPwd(false); }
  };

  const initials = (user.name || 'A').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-12 overflow-y-auto custom-scrollbar">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-t-surface rounded-3xl shadow-xl border border-t-border w-full max-w-lg mx-4 overflow-hidden z-10">
        {/* Header */}
        <div className="bg-t-base/50 p-5 border-b border-t-border flex justify-between items-center">
          <h2 className="text-base font-black tracking-tight">Account Settings</h2>
          <button onClick={onClose} className="text-t-muted hover:text-t-main text-xl p-1">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-t-border">
          <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'profile' ? 'text-t-primary border-b-2 border-t-primary' : 'text-t-muted hover:text-t-main'}`}>Profile</button>
          <button onClick={() => setActiveTab('security')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'security' ? 'text-t-primary border-b-2 border-t-primary' : 'text-t-muted hover:text-t-main'}`}>Security</button>
          <button onClick={() => setActiveTab('devices')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'security' ? 'text-t-primary border-b-2 border-t-primary' : 'text-t-muted hover:text-t-main'}`}>Devices</button>
        </div>

        <div className="p-6 space-y-6">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 rounded-full bg-t-primary/15 text-t-primary font-black text-2xl flex items-center justify-center overflow-hidden">
                  {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" /> : initials}
                </div>
                <label className="mt-2 text-[10px] font-bold text-t-primary cursor-pointer hover:underline">
                  Upload Photo
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
                <p className="text-[9px] text-t-muted mt-0.5">Recommended size 1:1, up to 10MB.</p>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1.5">First name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm outline-none focus:border-t-primary transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1.5">Last name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm outline-none focus:border-t-primary transition-all font-medium" />
                </div>
              </div>

              {/* Primary Email */}
              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1.5">Email address <span className="text-green-500 ml-1">Primary</span></label>
                <input type="email" value={user.email || ''} disabled className="w-full border border-t-border bg-t-base/50 text-t-main rounded-xl p-3 text-sm outline-none cursor-not-allowed opacity-60 font-medium" />
              </div>

              {/* Alternative Email */}
              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1.5">Alternative email</label>
                <input type="email" value={altEmail} onChange={e => setAltEmail(e.target.value)} placeholder="Add alternative email" className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm outline-none focus:border-t-primary transition-all font-medium" />
              </div>

              <button onClick={handleSaveProfile} disabled={saving} className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary text-white hover:opacity-90 shadow-lg shadow-t-primary/30">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1.5">Current password</label>
                <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm outline-none focus:border-t-primary transition-all font-mono" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1.5">New password</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm outline-none focus:border-t-primary transition-all font-mono" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-t-muted uppercase tracking-widest mb-1.5">Confirm new password</label>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 text-sm outline-none focus:border-t-primary transition-all font-mono" />
              </div>
              <button onClick={handleChangePassword} disabled={changingPwd} className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary text-white hover:opacity-90 shadow-lg shadow-t-primary/30">
                {changingPwd ? 'Changing...' : 'Change Password'}
              </button>
            </>
          )}

          {/* DEVICES TAB */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <p className="text-xs text-t-muted/70">Active sessions on your account</p>
              <div className="bg-t-base/30 p-4 rounded-xl border border-t-border/50 flex items-center gap-3">
                <svg className="w-8 h-8 text-t-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <div className="flex-1">
                  <p className="text-xs font-bold text-t-main">Current device (this browser)</p>
                  <p className="text-[10px] text-t-muted mt-0.5">{navigator.userAgent || 'Unknown browser'}</p>
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest bg-green-500/15 text-green-500 px-2 py-0.5 rounded-full">Active now</span>
              </div>
              <p className="text-[10px] text-t-muted/60 text-center pt-2">Device tracking requires backend session management.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}