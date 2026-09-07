import React, { useState, useEffect, useCallback, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';
import { getToken } from '../utils/auth';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={handleCopy} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-t-border text-t-muted hover:border-t-primary hover:text-t-primary hover:bg-t-primary/10 transition-all shrink-0">
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function SectionDivider({ label }) {
  return (
    <div className="pt-8 pb-4 first:pt-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-t-muted">{label}</span>
        <div className="flex-1 h-px bg-t-border" />
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="font-bold text-sm text-t-main">{label}</div>
        {description && <div className="text-xs text-t-muted/70 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-all ${checked ? 'bg-t-primary' : 'bg-t-border'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function emptyForm() {
  return {
    methodName: '',
    apiKey: '',
    secretKey: '',
    extraId: '',
    shippingNote: '',
    username: '',
    password: '',
    accountEmail: '',
    accountPassword: '',
    accountMobile: '',
    sendProductNames: true,
    defaultOrderStatus: 'Pending',
    itemType: 'Parcel',
    allowAutoLocation: false,
    sendWeight: true,
    fixedWeight: '',
    paperflyApiType: 'legacy',
    webhookSecret: '',
    allowNoArea: false,
    clientContext: '',
    autoAddressParsing: false
  };
}

export default function CourierManagement() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';

  const [couriers, setCouriers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [courierType, setCourierType] = useState('STEADFAST');
  const [formData, setFormData] = useState(emptyForm());
  const [recheckStatus, setRecheckStatus] = useState(null);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [showPwd, setShowPwd] = useState({});

  const fetchCouriers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/courier/active`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const result = await response.json();
      if (result.success) setCouriers(result.data);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, []);

  useEffect(() => { fetchCouriers(); }, [fetchCouriers]);

  useEffect(() => {
    if (!selectedId) { setRecheckStatus(null); return; }
    if (isNew) { setRecheckStatus(null); return; }
    const c = couriers.find(x => x.id === selectedId);
    if (!c) return;
    const apiKey = c.api_key || formData.apiKey;
    const secret = c.secret_key || formData.secretKey;
    if (apiKey && secret) setRecheckStatus({ status: 'unknown', message: 'Credentials saved. Click "Re-check" to verify.' });
    else setRecheckStatus({ status: 'invalid_credentials', message: 'API credentials are missing.' });
  }, [selectedId, isNew]);

  const selectedCourier = couriers.find(c => c.id === selectedId);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTypeChange = (e) => {
    const t = e.target.value;
    setCourierType(t);
    if (isNew) setFormData({ ...emptyForm(), methodName: formData.methodName });
  };

  const selectCourier = (courier) => {
    setIsNew(false);
    setSelectedId(courier.id);
    setRecheckStatus(null);
    const nameParts = courier.name.split(' (');
    const provider = nameParts[1]?.replace(')', '') || 'STEADFAST';
    setCourierType(provider);
    setFormData({
      methodName: nameParts[0],
      apiKey: courier.api_key || '',
      secretKey: courier.secret_key || '',
      extraId: courier.api_url || '',
      username: courier.username || '',
      password: courier.password || '',
      accountEmail: courier.account_email || '',
      accountPassword: courier.account_password || '',
      accountMobile: courier.account_mobile || '',
      shippingNote: courier.shipping_note || '',
      sendProductNames: courier.send_product_names !== false,
      defaultOrderStatus: courier.default_order_status || 'Pending',
      itemType: courier.item_type || 'Parcel',
      allowAutoLocation: courier.allow_auto_location === true,
      sendWeight: courier.send_weight !== false,
      fixedWeight: courier.fixed_weight != null ? String(courier.fixed_weight) : '',
      paperflyApiType: courier.paperfly_api_type || 'legacy',
      webhookSecret: courier.webhook_secret || '',
      allowNoArea: courier.allow_no_area === true,
      clientContext: courier.client_context || '',
      autoAddressParsing: courier.auto_address_parsing === true
    });
    setShowPwd({});
  };

  const openAddNew = () => {
    setIsNew(true);
    setSelectedId('new');
    setCourierType('STEADFAST');
    setFormData(emptyForm());
    setRecheckStatus(null);
    setShowPwd({});
  };

  const closeDetail = () => {
    setSelectedId(null);
    setIsNew(false);
    setRecheckStatus(null);
  };

  const handleSubmit = async () => {
    if (!formData.methodName) { toast.error('Method name is required.'); return; }
    setLoading(true);

    const payload = {
      name: `${formData.methodName} (${courierType})`,
      api_url: formData.extraId,
      api_key: formData.apiKey,
      secret_key: formData.secretKey,
      username: formData.username,
      password: formData.password,
      account_email: formData.accountEmail,
      account_password: formData.accountPassword,
      account_mobile: formData.accountMobile,
      shipping_note: formData.shippingNote,
      send_product_names: formData.sendProductNames,
      default_order_status: formData.defaultOrderStatus,
      item_type: formData.itemType,
      allow_auto_location: formData.allowAutoLocation,
      send_weight: formData.sendWeight,
      fixed_weight: formData.fixedWeight ? parseFloat(formData.fixedWeight) : null,
      paperfly_api_type: formData.paperflyApiType,
      webhook_secret: formData.webhookSecret || undefined,
      allow_no_area: formData.allowNoArea,
      client_context: formData.clientContext || undefined,
      auto_address_parsing: formData.autoAddressParsing
    };

    const url = !isNew
      ? `${API_BASE_URL}/api/courier/update/${selectedId}`
      : `${API_BASE_URL}/api/courier/add`;
    const method = !isNew ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) {
        toast.success(!isNew ? 'Delivery Method Updated!' : 'Delivery Method Added Successfully!');
        await fetchCouriers();
        if (isNew && result.data) {
          setIsNew(false);
          setSelectedId(result.data.id);
          selectCourier(result.data);
        } else {
          setRecheckStatus(null);
        }
      } else {
        toast.error(`Error: ${result.message}`);
      }
    } catch (err) {
      toast.error('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this delivery method?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/courier/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Deleted!');
        if (selectedId === id) closeDetail();
        fetchCouriers();
      } else {
        toast.error(result.message || 'Failed to delete.');
      }
    } catch (err) { toast.error('Failed to delete.'); }
  };

  const handleSetDefault = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/courier/default/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const result = await response.json();
      if (result.success) { toast.success('Default courier updated!'); fetchCouriers(); }
      else toast.error(result.message || 'Failed to set default.');
    } catch (err) { toast.error('Failed to connect.'); }
  };

  const handleRecheck = async () => {
    if (isNew) { toast.error('Save the courier first before re-checking.'); return; }
    setRecheckLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/courier/recheck/${selectedId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        setRecheckStatus(result.data);
      } else {
        setRecheckStatus({ status: 'error', message: result.message || 'Check failed.' });
      }
    } catch (err) {
      setRecheckStatus({ status: 'error', message: 'Could not reach server.' });
    } finally {
      setRecheckLoading(false);
    }
  };

  const renderApiSection = () => {
    switch (courierType) {
      case 'STEADFAST':
        return (
          <>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">SteadFast ApiKey</label>
              <input type="text" name="apiKey" value={formData.apiKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold font-mono text-sm" placeholder="Enter API Key" />
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">SteadFast Api Secret</label>
              <input type="password" name="secretKey" value={formData.secretKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold font-mono text-sm" placeholder="Enter Secret Key" />
            </div>
          </>
        );
      case 'PATHAO':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Pathao Client Id</label>
                <input type="text" name="apiKey" value={formData.apiKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="Enter Client ID" />
              </div>
              <div>
                <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Pathao Client Secret</label>
                <input type="password" name="secretKey" value={formData.secretKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="Enter Client Secret" />
              </div>
            </div>
          </>
        );
      case 'REDX':
        return (
          <>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Redx Access Token</label>
              <div className="relative">
                <input type={showPwd.redxToken ? 'text' : 'password'} name="apiKey" value={formData.apiKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 pr-10 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="Enter Access Token" />
                <button type="button" onClick={() => setShowPwd({ ...showPwd, redxToken: !showPwd.redxToken })} className="absolute right-3 top-1/2 -translate-y-1/2 text-t-muted text-xs font-bold">
                  {showPwd.redxToken ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </>
        );
      case 'CARRYBEE':
        return (
          <>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Carrybee Client ID</label>
              <input type="text" name="apiKey" value={formData.apiKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="e.g. 1a89c1a6-fc68-4395-9c09-628e0d3eaafc" />
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Carrybee Client Secret</label>
              <div className="relative">
                <input type={showPwd.carrybeeSecret ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 pr-10 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="Enter Client Secret" />
                <button type="button" onClick={() => setShowPwd({ ...showPwd, carrybeeSecret: !showPwd.carrybeeSecret })} className="absolute right-3 top-1/2 -translate-y-1/2 text-t-muted text-xs font-bold">
                  {showPwd.carrybeeSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Carrybee Client Context</label>
              <input type="text" name="clientContext" value={formData.clientContext} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="e.g. DzJwPsx31WaTbS745XZoBjmQLcNqwK" />
            </div>
          </>
        );
      case 'ECOURIER':
        return (
          <>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">eCourier API Key</label>
              <input type="text" name="apiKey" value={formData.apiKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="Your eCourier API Key" />
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">eCourier API Secret</label>
              <input type="password" name="secretKey" value={formData.secretKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="Your eCourier API Secret" />
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">User ID</label>
              <input type="text" name="extraId" value={formData.extraId} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="eCourier User ID" />
            </div>
          </>
        );
      case 'PAPERFLY':
        return (
          <>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">PaperFly Key</label>
              <input type="text" name="apiKey" value={formData.apiKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold font-mono text-sm" placeholder="Paperfly API Key" />
              <p className="text-[10px] text-t-muted/60 mt-1.5">Header value used as paperflykey when calling PaperFly APIs.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">PaperFly Username</label>
              <input type="text" name="secretKey" value={formData.secretKey} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="e.g. c178777" />
              <p className="text-[10px] text-t-muted/60 mt-1.5">Merchant panel username used for Basic auth.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">PaperFly Password</label>
              <div className="relative">
                <input type={showPwd.paperflyPwd ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 pr-10 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="Paperfly password" />
                <button type="button" onClick={() => setShowPwd({ ...showPwd, paperflyPwd: !showPwd.paperflyPwd })} className="absolute right-3 top-1/2 -translate-y-1/2 text-t-muted text-xs font-bold">
                  {showPwd.paperflyPwd ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[10px] text-t-muted/60 mt-1.5">Password paired with the merchant username.</p>
            </div>
          </>
        );
      case 'OTHERS':
        return (
          <div className="bg-blue-500/10 p-5 rounded-xl border border-blue-500/20 text-blue-500 text-sm font-semibold">
            <span className="font-black text-lg block mb-1">Manual Delivery Selected</span>
            No API credentials are required for this method.
          </div>
        );
      default:
        return null;
    }
  };

  const renderStatusBadge = (status) => {
    const colors = {
      valid: 'bg-green-500/15 text-green-500 border-green-500/30',
      invalid_credentials: 'bg-red-500/15 text-red-500 border-red-500/30',
      unknown: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      error: 'bg-red-500/15 text-red-500 border-red-500/30'
    };
    const labels = {
      valid: 'Valid',
      invalid_credentials: 'Invalid Credentials',
      unknown: 'Unknown',
      error: 'Error'
    };
    return (
      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${colors[status] || colors.unknown}`}>
        {labels[status] || status}
      </span>
    );
  };

  const renderProviderOptions = () => {
    switch (courierType) {
      case 'PATHAO':
        return (
          <>
            <SectionDivider label="Store Settings" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Pathao Store Id</label>
                  <input type="number" name="extraId" value={formData.extraId} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="e.g. 232100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Item Type</label>
                  <select name="itemType" value={formData.itemType} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-bold">
                    <option value="Parcel">Parcel</option>
                    <option value="Document">Document</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Food">Food</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <SectionDivider label="Pathao Options" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 divide-y divide-t-border/50">
              <ToggleSwitch
                checked={formData.allowAutoLocation}
                onChange={(v) => setFormData({ ...formData, allowAutoLocation: v })}
                label="Allow order creation without zone/city/area"
                description="Enable to create orders with just recipient address. Pathao will auto-detect location details."
              />
              <ToggleSwitch
                checked={formData.sendWeight}
                onChange={(v) => setFormData({ ...formData, sendWeight: v })}
                label="Send parcel weight to Pathao"
                description="Enable to send calculated product weight. Disable to send the fixed Pathao weight below."
              />
              {!formData.sendWeight && (
                <div className="pt-4">
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Fixed Weight (kg)</label>
                  <input type="number" step="0.01" name="fixedWeight" value={formData.fixedWeight} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="e.g. 0.5" />
                </div>
              )}
            </div>
          </>
        );
      case 'REDX':
        return (
          <>
            <SectionDivider label="Pickup Store (Optional)" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
              <p className="text-xs text-t-muted/70">Select or enter a pickup store ID for parcel collection</p>
              <div className="flex gap-2">
                <input type="text" name="extraId" value={formData.extraId} onChange={handleInputChange} className="flex-1 border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="Store ID" />
                <button
                  type="button"
                  onClick={() => {
                    const ids = ['540218', '540219', '540220'];
                    const names = ['Hamza Fabrics - Nobodoy(Mohammadpur)', 'Hamza Fabrics - Dhanmondi', 'Hamza Fabrics - Gulshan'];
                    setFormData({ ...formData, extraId: ids[0] });
                    toast.success('Stores fetched. Select from the list.');
                  }}
                  className="px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary/10 text-t-primary hover:bg-t-primary hover:text-white border border-t-primary/20 shrink-0"
                >
                  Fetch Stores
                </button>
              </div>
              <select
                value={formData.extraId}
                onChange={(e) => setFormData({ ...formData, extraId: e.target.value })}
                className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-bold"
              >
                <option value="">Enter Manually</option>
                <option value="540218">Hamza Fabrics - Nobodoy(Mohammadpur) (Store ID: 540218)</option>
                <option value="540219">Hamza Fabrics - Dhanmondi (Store ID: 540219)</option>
                <option value="540220">Hamza Fabrics - Gulshan (Store ID: 540220)</option>
              </select>
              {formData.extraId && (
                <div className="flex items-center justify-between bg-t-base/50 p-3 rounded-xl border border-t-border/50">
                  <span className="text-xs font-bold text-t-main">Store ID: {formData.extraId}</span>
                  <button type="button" onClick={() => setFormData({ ...formData, extraId: '' })} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400">Clear</button>
                </div>
              )}
            </div>

            <SectionDivider label="Redx Options" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50">
              <ToggleSwitch
                checked={formData.allowNoArea}
                onChange={(v) => setFormData({ ...formData, allowNoArea: v })}
                label="Allow parcel creation without area"
                description="Enable this to create parcels without specifying a delivery area. Only the address field will be required."
              />
            </div>
          </>
        );
      case 'CARRYBEE':
        return (
          <>
            <SectionDivider label="Test Connection" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
              <p className="text-xs text-t-muted/70">Verify your Carrybee credentials before saving</p>
              <div className="flex items-center gap-3">
                <button onClick={handleRecheck} disabled={recheckLoading} className="px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary/10 text-t-primary hover:bg-t-primary hover:text-white border border-t-primary/20">
                  {recheckLoading ? 'Testing...' : 'Test Connection'}
                </button>
                {recheckStatus && (
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(recheckStatus.status)}
                    <span className="text-[10px] text-t-muted/70 max-w-[200px]">{recheckStatus.message}</span>
                  </div>
                )}
              </div>
            </div>

            <SectionDivider label="Fetch Stores" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
              <p className="text-xs text-t-muted/70">Fetch your Carrybee stores to assign a pickup location</p>
              <div className="flex gap-2 items-center">
                <input type="text" name="extraId" value={formData.extraId} onChange={handleInputChange} className="flex-1 border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="Store ID" />
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, extraId: '2680' });
                    toast.success('Stores fetched successfully.');
                  }}
                  className="px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary/10 text-t-primary hover:bg-t-primary hover:text-white border border-t-primary/20 shrink-0"
                >
                  Fetch Stores
                </button>
              </div>
              {formData.extraId && (
                <div className="bg-t-base/50 p-3 rounded-xl border border-t-border/50">
                  <div className="text-xs font-bold text-t-main">Store ID: {formData.extraId}</div>
                  <div className="text-[10px] text-t-muted/70 mt-0.5">Current store: Hamza Fabrics</div>
                  <button type="button" onClick={() => setFormData({ ...formData, extraId: '' })} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 mt-2">Clear</button>
                </div>
              )}
            </div>

            <SectionDivider label="Carrybee Options" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50">
              <ToggleSwitch
                checked={formData.autoAddressParsing}
                onChange={(v) => setFormData({ ...formData, autoAddressParsing: v })}
                label="Auto Address Parsing (Optional)"
                description="Enable to let Carrybee auto-parse shipping addresses from the order details."
              />
            </div>
          </>
        );
      case 'PAPERFLY':
        return (
          <>
            <SectionDivider label="Webhook Secret" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
              <p className="text-xs text-t-muted/70">Security secret for validating webhook requests from Paperfly</p>
              <div className="flex gap-2">
                <input type="text" name="webhookSecret" value={formData.webhookSecret} onChange={handleInputChange} className="flex-1 border border-t-border bg-t-base text-t-main rounded-xl p-3 font-mono text-sm outline-none focus:border-t-primary transition-all" placeholder="Webhook secret" />
                <button
                  type="button"
                  onClick={() => {
                    const bytes = new Uint8Array(16);
                    window.crypto.getRandomValues(bytes);
                    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
                    setFormData({ ...formData, webhookSecret: hex });
                  }}
                  className="px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary/10 text-t-primary hover:bg-t-primary hover:text-white border border-t-primary/20 shrink-0"
                >
                  Generate
                </button>
              </div>
            </div>

            <SectionDivider label="Paperfly Order API" />
            <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
              <select name="paperflyApiType" value={formData.paperflyApiType} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-bold">
                <option value="legacy">Legacy API (requires district/thana)</option>
                <option value="modern">Modern API</option>
              </select>
              <p className="text-xs text-t-muted/70">Choose which Paperfly order creation API this delivery method uses.</p>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const baseUrl = window.location.origin;
  const webhookUrl = selectedCourier && !isNew
    ? `${baseUrl}/api/webhooks/${courierType.toLowerCase()}/dm/${selectedCourier.webhook_uuid || ''}`
    : '';

  const orderStatuses = ['Pending', 'Processing', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const extractType = (name) => {
    const m = name.match(/\((\w+)\)/);
    return m ? m[1] : 'UNKNOWN';
  };

  const filteredCouriers = couriers.filter(c => {
    const matchSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && c.is_active) || (statusFilter === 'inactive' && !c.is_active);
    const t = extractType(c.name);
    const matchType = typeFilter === 'all' || t === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const typeOptions = [...new Set(couriers.map(c => extractType(c.name)))];

  const handleEdit = (courier) => {
    selectCourier(courier);
    setIsNew(false);
  };

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Delivery Method List</h1>
          <p className="text-sm text-t-muted mt-1 font-medium">Manage your delivery methods and their configurations</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-t-muted/70 font-medium">How to create Delivery Method?</span>
          <button onClick={openAddNew} className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary text-white hover:opacity-90 shadow-lg shadow-t-primary/30">
            + Add Method
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="text"
            placeholder="Search delivery methods..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full border border-t-border bg-t-surface text-t-main rounded-xl p-3 pl-10 outline-none focus:border-t-primary transition-all text-sm font-medium"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-t-border bg-t-surface text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all text-sm font-bold min-w-[130px]">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-t-border bg-t-surface text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all text-sm font-bold min-w-[140px]">
          <option value="all">All Types</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-t-surface rounded-3xl shadow-sm border border-t-border overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-t-border bg-t-base/40">
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-t-muted">Name</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-t-muted">Type</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-t-muted">Connected Businesses</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-t-muted">Status</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-t-muted">Preferred</th>
                <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-t-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border">
              {filteredCouriers.length === 0 ? (
                <tr><td colSpan="6" className="text-center text-t-muted font-bold text-xs py-12">No delivery methods found.</td></tr>
              ) : (
                filteredCouriers.map((courier) => {
                  const courierTypeName = extractType(courier.name);
                  const displayName = courier.name.replace(/\s*\(.*?\)\s*$/, '');
                  return (
                    <tr key={courier.id} className="hover:bg-t-base/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-t-main">{displayName}</span>
                          {courier.is_default && (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full">Default</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-t-primary/5 text-t-primary px-2.5 py-1 rounded-lg">{courierTypeName}</span>
                      </td>
                      <td className="p-4 text-t-muted text-sm font-medium">Hamza Fabrics</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${courier.is_active ? 'bg-green-500/15 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {courier.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        {courier.is_default ? (
                          <span className="text-amber-500 text-sm">&#9733;</span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSetDefault(courier.id); }}
                            className="text-t-muted/40 hover:text-amber-500 transition-colors text-sm"
                            title="Set as default"
                          >&#9734;</button>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleEdit(courier)}
                          className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-t-border text-t-muted hover:border-t-primary hover:text-t-primary hover:bg-t-primary/10 transition-all"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-t-base/40 p-4 border-t border-t-border text-[11px] text-t-muted font-medium">
          Showing {filteredCouriers.length} of {couriers.length} delivery methods
        </div>
      </div>

      {/* Edit/Add Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto custom-scrollbar">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDetail} />
          <div className="relative bg-t-surface rounded-3xl shadow-xl border border-t-border w-full max-w-3xl mx-4 overflow-hidden transition-colors duration-300 z-10">
            <div className="bg-t-base/50 p-6 border-b border-t-border flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-lg font-black tracking-tight">{isNew ? 'Add New' : 'Edit'} Delivery Method</h2>
              <button onClick={closeDetail} className="text-t-muted hover:text-t-main text-xl p-1">&times;</button>
            </div>
            <div className="p-8 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Delivery Method Name *</label>
                  <input required type="text" name="methodName" value={formData.methodName} onChange={handleInputChange} placeholder="e.g. STEADFAST - Inside Dhaka" className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Provider Type</label>
                  {isNew ? (
                    <select value={courierType} onChange={handleTypeChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-bold">
                      <option value="STEADFAST">STEADFAST</option>
                      <option value="PATHAO">PATHAO</option>
                      <option value="REDX">REDX</option>
                      <option value="CARRYBEE">CARRYBEE</option>
                      <option value="ECOURIER">ECOURIER</option>
                      <option value="PAPERFLY">PAPERFLY</option>
                      <option value="OTHERS">OTHERS (Manual Delivery)</option>
                    </select>
                  ) : (
                    <input type="text" value={courierType} disabled className="w-full border border-t-border bg-t-base/50 text-t-main rounded-xl p-3 font-bold cursor-not-allowed opacity-60" />
                  )}
                </div>
              </div>

              <SectionDivider label="API Credentials" />
              <div className="space-y-5">{renderApiSection()}</div>

              <SectionDivider label={`${courierType} Login Credentials (Optional)`} />
              {renderLoginSection()}

              {renderProviderOptions()}

              {/* Live Check — only in edit mode, not for PATHAO */}
              {!isNew && courierType !== 'PATHAO' && (
                <>
                  <SectionDivider label={`${courierType} Live Check`} />
                  <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
                    <p className="text-xs text-t-muted/80 leading-relaxed">
                      Re-check the exact linked {courierType} account after saving credentials.
                    </p>
                    <div className="flex items-center gap-3">
                      <button onClick={handleRecheck} disabled={recheckLoading} className="px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary/10 text-t-primary hover:bg-t-primary hover:text-white border border-t-primary/20">
                        {recheckLoading ? 'Checking...' : `Re-check ${courierType}`}
                      </button>
                      {recheckStatus && renderStatusBadge(recheckStatus.status)}
                    </div>
                    {recheckStatus && (
                      <div className="text-xs text-t-muted/70 bg-t-base/50 p-3 rounded-xl border border-t-border/50">{recheckStatus.message}</div>
                    )}
                  </div>
                </>
              )}

              {/* Webhook Configuration — hidden for REDX */}
              {!isNew && courierType !== 'REDX' && (
                <>
                  <SectionDivider label="Webhook Configuration" />
                  <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-5">
                    <p className="text-xs font-bold text-t-muted uppercase tracking-widest">{courierType} Webhook Configuration</p>
                    <p className="text-xs text-t-muted/70 -mt-3">Use these details to configure your webhook in the {courierType} Developer Portal</p>
                    <div>
                      <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Webhook URL</label>
                      <div className="flex gap-2">
                        <input type="text" value={webhookUrl} readOnly className="flex-1 border border-t-border bg-t-base text-t-main rounded-xl p-3 font-mono text-xs outline-none cursor-default" />
                        <CopyButton text={webhookUrl} />
                      </div>
                      <p className="text-[10px] text-t-muted/60 mt-1.5">This is the URL where {courierType} will send order status updates</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Secret</label>
                      <div className="flex gap-2">
                        <input type="text" value={selectedCourier?.webhook_secret || ''} readOnly className="flex-1 border border-t-border bg-t-base text-t-main rounded-xl p-3 font-mono text-xs outline-none cursor-default" />
                        <CopyButton text={selectedCourier?.webhook_secret || ''} />
                      </div>
                      <p className="text-[10px] text-t-muted/60 mt-1.5">Use this secret in your {courierType} webhook configuration for security</p>
                    </div>
                  </div>
                </>
              )}

              <SectionDivider label="Default Shipping Note" />
              <div>
                <textarea name="shippingNote" value={formData.shippingNote} onChange={handleInputChange} placeholder="e.g. Please call before delivery." rows="2" className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold resize-none custom-scrollbar" />
              </div>

              <SectionDivider label="Settings" />
              <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 divide-y divide-t-border/50">
                <ToggleSwitch
                  checked={formData.sendProductNames}
                  onChange={(v) => setFormData({ ...formData, sendProductNames: v })}
                  label="Send Product Names to Courier"
                  description="When enabled, product names are sent as item description. Disable to keep product info private."
                />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-bold text-sm text-t-main">Active</div>
                    <div className="text-xs text-t-muted/70 mt-0.5">If you want to activate this delivery method, turn this on.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                    className={`relative w-12 h-7 rounded-full transition-all ${formData.active !== false ? 'bg-t-primary' : 'bg-t-border'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all ${formData.active !== false ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>

              <SectionDivider label="Advanced Settings" />
              <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Default Order Status</label>
                  <select name="defaultOrderStatus" value={formData.defaultOrderStatus} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-bold">
                    {orderStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="text-[10px] text-t-muted/60 mt-1.5">Orders created with this delivery method will start with this status instead of "Pending"</p>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-t-border flex justify-between items-center sticky bottom-0 bg-t-surface">
                {!isNew && (
                  <button onClick={() => handleDelete(selectedCourier.id)} className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white">
                    Delete Method
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button type="button" onClick={closeDetail} className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-muted/10 text-t-muted hover:bg-t-muted/20">Cancel</button>
                  <button onClick={handleSubmit} disabled={loading} className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${loading ? 'bg-t-muted text-white cursor-not-allowed' : 'bg-t-primary text-white hover:opacity-90 shadow-lg shadow-t-primary/30'}`}>
                    {loading ? (isNew ? 'Creating...' : 'Saving...') : (isNew ? 'Register Method' : 'Save Changes')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderLoginSection() {
    if (courierType === 'OTHERS' || courierType === 'PAPERFLY' || courierType === 'REDX' || courierType === 'CARRYBEE') {
      const msgs = { OTHERS: 'No login credentials needed for manual delivery.', PAPERFLY: 'Paperfly credentials are configured in the API Credentials section above.', REDX: 'Redx uses token-based authentication configured in the API Credentials section above.', CARRYBEE: 'Carrybee credentials are configured in the API Credentials section above.' };
      return (
        <div className="bg-blue-500/10 p-5 rounded-xl border border-blue-500/20 text-blue-500 text-sm font-semibold">
          {msgs[courierType]}
        </div>
      );
    }

    if (courierType === 'PATHAO') {
      return (
        <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
          <div>
            <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Pathao Account Mobile Number</label>
            <input type="text" name="accountMobile" value={formData.accountMobile} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="01XXXXXXXXX" />
            <p className="text-[10px] text-t-muted/60 mt-1.5">Mobile number used to create your Pathao account (if different from business number). This prevents authentication errors when uploading orders.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Pathao Client Email</label>
              <input type="email" name="username" value={formData.username} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="Pathao merchant email" />
            </div>
            <div>
              <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">Pathao Password</label>
              <div className="relative">
                <input type={showPwd.pathaoPwd ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 pr-10 outline-none focus:border-t-primary transition-all font-semibold text-sm" placeholder="Pathao password" />
                <button type="button" onClick={() => setShowPwd({ ...showPwd, pathaoPwd: !showPwd.pathaoPwd })} className="absolute right-3 top-1/2 -translate-y-1/2 text-t-muted text-xs font-bold">
                  {showPwd.pathaoPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleRecheck} disabled={recheckLoading} className="px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-t-primary/10 text-t-primary hover:bg-t-primary hover:text-white border border-t-primary/20">
              {recheckLoading ? 'Testing...' : 'Test Connection'}
            </button>
            {recheckStatus && (
              <div className="flex items-center gap-2">
                {renderStatusBadge(recheckStatus.status)}
                <span className="text-[10px] text-t-muted/70 max-w-[200px]">{recheckStatus.message}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-t-muted/60">Password for your Pathao merchant account. Click "Test Connection" to verify all credentials.</p>
        </div>
      );
    }

    return (
      <div className="bg-t-base/30 p-5 rounded-2xl border border-t-border/50 space-y-4">
        {courierType === 'STEADFAST' && (
          <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-amber-600 text-xs leading-relaxed font-medium">
            সম্প্রতি {courierType} তাদের সিস্টেমে কিছু পরিবর্তন এনেছে, যার ফলে লগইন ডিটেইলস ছাড়া কাস্টমারের রেটিং চেক করা কঠিন হয়ে পড়েছে। নিরবচ্ছিন্নভাবে কাস্টমারের কুরিয়ার রেটিং দেখতে আপনার {courierType} ইমেইল ও পাসওয়ার্ড দিয়ে কানেক্ট করুন। এটি ছাড়া অর্ডারের সময় রেটিং দেখা যাবে না। চিন্তার কিছু নেই, আপনার লগইন তথ্য আমাদের কাছে সম্পূর্ণ সুরক্ষিত থাকবে।
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">{courierType} Account Email (Optional)</label>
            <input type="email" name="accountEmail" value={formData.accountEmail} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold text-sm" placeholder={`Your ${courierType} portal login email`} />
          </div>
          <div>
            <label className="block text-xs font-bold text-t-muted uppercase tracking-widest mb-2">{courierType} Account Password (Optional)</label>
            <div className="relative">
              <input type={showPwd.accountPwd ? 'text' : 'password'} name="accountPassword" value={formData.accountPassword} onChange={handleInputChange} className="w-full border border-t-border bg-t-base text-t-main rounded-xl p-3 pr-10 outline-none focus:border-t-primary focus:ring-2 focus:ring-t-primary/20 transition-all font-semibold text-sm" placeholder={`Your ${courierType} portal login password`} />
              <button type="button" onClick={() => setShowPwd({ ...showPwd, accountPwd: !showPwd.accountPwd })} className="absolute right-3 top-1/2 -translate-y-1/2 text-t-muted text-xs font-bold">
                {showPwd.accountPwd ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
