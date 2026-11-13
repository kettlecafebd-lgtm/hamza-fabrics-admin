import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { Phone, PhoneCall, Clock, RefreshCw, Play, CheckCircle2, XCircle, AlertTriangle, Activity, Zap } from 'lucide-react';
import API_BASE_URL from '../config/api';

export default function AutoCallCenterReport() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const h = { Authorization: `Bearer ${token}` };
      const [statsRes, queueRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/auto-call/stats`, { headers: h }),
        fetch(`${API_BASE_URL}/api/auto-call/queue?status=${queueFilter}`, { headers: h }),
        fetch(`${API_BASE_URL}/api/auto-call/logs?limit=100`, { headers: h })
      ]);
      const s = await statsRes.json();
      const q = await queueRes.json();
      const l = await logsRes.json();
      if (s.success) setStats(s.stats);
      if (q.success) setQueue(q.queue);
      if (l.success) setLogs(l.logs);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [queueFilter]);

  const handleInitiateCall = async (queueId) => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/auto-call/initiate/${queueId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) { fetchData(); }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-4 sm:p-8 w-full mx-auto bg-t-base min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-t-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-t-primary flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-black ${textColor}`}>Auto Call Center</h1>
              <p className={`text-xs ${mutedText}`}>Queue management, call logs, and outcome tracking</p>
            </div>
          </div>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-t-surface border border-t-border rounded-lg text-xs font-bold hover:border-t-primary transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${bgCard} border ${borderColor} p-5 rounded-2xl`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Total Calls</span>
            <Phone className="w-4 h-4 text-t-primary" />
          </div>
          <div className={`text-3xl font-black ${textColor}`}>{stats?.calls?.total_calls || 0}</div>
        </div>
        <div className="bg-green-500/5 border border-green-500/20 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Confirmed (Pressed 1)</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-black text-green-600">{stats?.calls?.confirmed || 0}</div>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Failed</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-500">{stats?.calls?.failed || 0}</div>
        </div>
        <div className="bg-orange-500/5 border border-orange-500/20 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">In Queue</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-3xl font-black text-orange-500">{stats?.queue?.pending || stats?.queue?.retrying || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Queue */}
        <div className={`${bgCard} border ${borderColor} rounded-2xl overflow-hidden`}>
          <div className="px-6 py-4 border-b border-t-border flex items-center justify-between">
            <h3 className={`font-black text-sm ${textColor}`}>Call Queue</h3>
            <div className="flex gap-1">
              {['', 'pending', 'in_progress', 'completed'].map(f => (
                <button key={f} onClick={() => setQueueFilter(f)}
                  className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${queueFilter === f ? 'bg-t-primary text-white' : 'bg-t-base text-t-muted hover:text-t-main'}`}>
                  {f || 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-t-border max-h-[400px] overflow-y-auto">
            {queue.length === 0 ? (
              <div className="p-8 text-center text-t-muted font-bold">No queued calls</div>
            ) : queue.map((q, i) => (
              <div key={q.id || i} className="p-4 hover:bg-t-base/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${textColor}`}>{q.phone}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                        q.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        q.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        q.status === 'completed' ? 'bg-green-100 text-green-700' :
                        q.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>{q.status}</span>
                    </div>
                    <div className={`text-xs ${mutedText} mt-0.5`}>
                      {q.customer_name} — {q.order_code}
                    </div>
                    <div className={`text-[10px] ${mutedText} mt-0.5`}>
                      Attempts: {q.attempts}/{q.max_attempts} | Order: {q.order_status}
                    </div>
                  </div>
                  {(q.status === 'pending' || q.status === 'retrying') && (
                    <button onClick={() => handleInitiateCall(q.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-t-primary text-white rounded-lg text-xs font-bold hover:bg-t-primary/90 transition-colors">
                      <Play className="w-3 h-3" /> Call
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Logs */}
        <div className={`${bgCard} border ${borderColor} rounded-2xl overflow-hidden`}>
          <div className="px-6 py-4 border-b border-t-border">
            <h3 className={`font-black text-sm ${textColor}`}>Recent Call Logs</h3>
          </div>
          <div className="divide-y divide-t-border max-h-[400px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-t-muted font-bold">No call logs yet</div>
            ) : logs.map((log, i) => (
              <div key={log.id || i} className="p-4 hover:bg-t-base/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${textColor}`}>{log.phone}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                        log.status === 'completed' && log.outcome === 'confirmed' ? 'bg-green-100 text-green-700' :
                        log.status === 'ringing' ? 'bg-blue-100 text-blue-700' :
                        log.status === 'failed' || log.status === 'no_answer' || log.status === 'busy' ? 'bg-red-100 text-red-700' :
                        log.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{log.outcome || log.status}</span>
                    </div>
                    <div className={`text-xs ${mutedText} mt-0.5`}>
                      {log.order_code} — {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold">{log.duration}s</div>
                    {log.pressed_key && <div className="text-[10px] text-t-muted">Pressed: {log.pressed_key}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Queue Summary from AutoCallCenterReport style */}
      <div className={`${bgCard} border ${borderColor} rounded-2xl overflow-hidden`}>
        <div className="px-6 py-4 border-b border-t-border">
          <h3 className={`font-black text-sm ${textColor}`}>Queue Summary</h3>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Pending', key: 'pending', color: 'text-yellow-500', bg: 'bg-yellow-50' },
            { label: 'In Progress', key: 'in_progress', color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Retrying', key: 'retrying', color: 'text-orange-500', bg: 'bg-orange-50' },
            { label: 'Completed', key: 'completed', color: 'text-green-500', bg: 'bg-green-50' },
            { label: 'Failed', key: 'failed', color: 'text-red-500', bg: 'bg-red-50' },
          ].map((item) => (
            <div key={item.key} className={`${item.bg} p-4 rounded-xl text-center`}>
              <div className={`text-2xl font-black ${item.color}`}>{stats?.queue?.[item.key] || 0}</div>
              <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${item.color}`}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
