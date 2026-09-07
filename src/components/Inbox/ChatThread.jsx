import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import API_BASE_URL from '../../config/api';

export default function ChatThread({ conversationId, conversation, isDark, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
      }
    } catch (e) { console.error(e); }
    setSending(false);
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-t-muted">
        <div className="text-center">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-sm font-bold">Select a conversation</p>
          <p className="text-xs text-t-muted/60 mt-1">Unified Inbox — WhatsApp, Messenger & Instagram</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-t-border flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-1.5 rounded-lg hover:bg-t-primary/10 text-t-muted">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-t-main truncate">{conversation?.customer_name || 'Unknown'}</span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
              conversation?.platform === 'whatsapp' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
              conversation?.platform === 'messenger' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
              'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
            }`}>{conversation?.platform}</span>
          </div>
          {conversation?.customer_phone && (
            <p className="text-[10px] text-t-muted">{conversation.customer_phone}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-t-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-t-muted text-sm">No messages yet</div>
        ) : messages.map(msg => {
          const isOutbound = msg.direction === 'outbound';
          return (
            <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isOutbound
                  ? 'bg-t-primary text-white rounded-br-md'
                  : `${isDark ? 'bg-gray-700' : 'bg-gray-100'} text-t-main rounded-bl-md`
              }`}>
                {!isOutbound && msg.sender_name && (
                  <p className="text-[10px] font-bold opacity-70 mb-0.5">{msg.sender_name}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[9px] mt-1 ${isOutbound ? 'text-white/60' : 'text-t-muted'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-t-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-t-border bg-t-base focus:outline-none focus:ring-2 focus:ring-t-primary/40"
            disabled={sending}
          />
          <button onClick={handleSend} disabled={!newMessage.trim() || sending}
            className="p-2.5 bg-t-primary text-white rounded-xl hover:bg-t-primary/90 transition-all disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
