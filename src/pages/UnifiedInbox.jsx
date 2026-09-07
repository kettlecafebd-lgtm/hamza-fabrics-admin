import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { useWebSocket } from '../context/WebSocketContext';
import API_BASE_URL from '../config/api';
import ConversationList from '../components/Inbox/ConversationList';
import ChatThread from '../components/Inbox/ChatThread';
import CustomerContextPanel from '../components/Inbox/CustomerContextPanel';
import { MessageCircle, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react';

export default function UnifiedInbox() {
  const { isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const { connected, subscribe } = useWebSocket();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(true);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setConversations(data.conversations);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchConversations(); }, []);

  // WebSocket: listen for new messages
  useEffect(() => {
    const unsub1 = subscribe('chat:new_message', (data) => {
      // Update conversation list with new message
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id === data.conversationId) {
            return { ...c, last_message: data.message.content, last_message_at: data.message.created_at, unread_count: c.id === selectedId ? 0 : (c.unread_count || 0) + (data.message.direction === 'inbound' ? 1 : 0) };
          }
          return c;
        });
        // Move updated conversation to top
        const idx = updated.findIndex(c => c.id === data.conversationId);
        if (idx > 0) {
          const [conv] = updated.splice(idx, 1);
          updated.unshift(conv);
        }
        return updated;
      });
    });

    const unsub2 = subscribe('chat:conversation_update', () => {
      fetchConversations();
    });

    return () => { unsub1(); unsub2(); };
  }, [subscribe, selectedId]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setSelectedConv(conversations.find(c => c.id === id));
    setShowMobileChat(true);
  };

  return (
    <div className="flex flex-col h-screen bg-t-base">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-t-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-t-primary/10">
            <MessageCircle className="w-5 h-5 text-t-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider">Unified Inbox</h1>
            <p className="text-[10px] text-t-muted">WhatsApp · Messenger · Instagram</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[10px] font-bold ${connected ? 'text-green-500' : 'text-red-500'}`}>
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connected ? 'Live' : 'Offline'}
          </span>
          <span className="text-xs text-t-muted font-bold">{conversations.length} chats</span>
          <button onClick={fetchConversations} className="p-2 rounded-lg hover:bg-t-primary/10 transition-colors text-t-muted hover:text-t-primary">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowContextPanel(p => !p)} className="p-2 rounded-lg hover:bg-t-primary/10 transition-colors text-t-muted hover:text-t-primary hidden lg:block">
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r ${borderColor} shrink-0 flex flex-col ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        }`}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-t-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={handleSelect}
              isDark={isDark}
              borderColor={borderColor}
            />
          )}
        </div>

        {/* Chat Thread */}
        <div className={`flex-1 flex flex-col min-w-0 ${
          showMobileChat ? 'flex' : 'hidden md:flex'
        }`}>
          <ChatThread
            conversationId={selectedId}
            conversation={selectedConv}
            isDark={isDark}
            onBack={() => setShowMobileChat(false)}
          />
        </div>

        {/* Customer Context Panel */}
        {showContextPanel && (
          <div className={`hidden lg:block w-72 border-l ${borderColor} shrink-0`}>
            <CustomerContextPanel
              conversationId={selectedId}
              isDark={isDark}
              borderColor={borderColor}
            />
          </div>
        )}
      </div>
    </div>
  );
}
