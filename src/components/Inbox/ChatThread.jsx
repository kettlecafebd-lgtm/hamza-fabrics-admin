import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import API_BASE_URL from '../../config/api';
import { useWebSocket } from '../../context/WebSocketContext';
import ChatMedia from './ChatMedia';

function mergeMessages(...messageLists) {
  const messages = [];
  const seen = new Set();

  for (const list of messageLists) {
    if (!Array.isArray(list)) continue;

    for (const message of list) {
      if (!message || typeof message !== 'object') continue;
      const key = message.id != null
        ? `id:${message.id}`
        : `fallback:${message.direction || ''}:${message.created_at || ''}:${message.content || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      messages.push(message);
    }
  }

  return messages;
}

export default function ChatThread({ conversationId, conversation, isDark, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);
  const { subscribe } = useWebSocket();

  const requestMessages = useCallback(async (signal) => {
    if (!conversationId) return [];

    const token = localStorage.getItem('adminToken');
    const res = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !Array.isArray(data.messages)) {
      throw new Error(data?.message || `Failed to load messages (${res.status}).`);
    }
    return data.messages;
  }, [conversationId]);

  const fetchMessages = useCallback(async (signal) => {
    if (!conversationId) return;
    setLoading(true);
    setLoadError('');

    try {
      const history = await requestMessages(signal);
      if (!signal?.aborted) {
        // Preserve messages that arrived over the socket while history was loading.
        setMessages(current => mergeMessages(history, current));
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error('Failed to fetch chat messages:', error);
        setLoadError(error.message || 'Could not load messages.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [conversationId, requestMessages]);

  useEffect(() => {
    if (!conversationId) return undefined;

    const controller = new AbortController();
    requestMessages(controller.signal)
      .then(history => {
        if (controller.signal.aborted) return;
        setLoadError('');
        // Preserve messages that arrived over the socket while history was loading.
        setMessages(current => mergeMessages(history, current));
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch chat messages:', error);
        setLoadError(error.message || 'Could not load messages.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [conversationId, requestMessages]);

  useEffect(() => {
    if (!conversationId) return undefined;

    return subscribe('chat:new_message', (event) => {
      if (String(event?.conversationId) !== String(conversationId) || !event.message) return;
      setMessages(current => mergeMessages(current, [event.message]));
    });
  }, [conversationId, subscribe]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || !conversationId || sending) return;

    setSending(true);
    setSendError('');
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Failed to send message (${res.status}).`);
      }

      if (data.message) {
        setMessages(current => mergeMessages(current, [data.message]));
      } else {
        // Some APIs acknowledge a send without returning the saved message.
        setLoadError('');
        setLoading(true);
        await fetchMessages();
      }
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send chat message:', error);
      setSendError(error.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
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
        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
            <span>{loadError}</span>
            <button
              onClick={() => { setLoadError(''); setLoading(true); fetchMessages(); }}
              className="shrink-0 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-t-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          loadError ? null : <div className="text-center py-8 text-t-muted text-sm">No messages yet</div>
        ) : messages.map(msg => {
          const isOutbound = msg.direction === 'outbound';
          return (
            <div key={msg.id ?? `${msg.created_at}-${msg.content}`} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isOutbound
                  ? 'bg-t-primary text-white rounded-br-md'
                  : `${isDark ? 'bg-gray-700' : 'bg-gray-100'} text-t-main rounded-bl-md`
              }`}>
                {!isOutbound && msg.sender_name && (
                  <p className="text-[10px] font-bold opacity-70 mb-0.5">{msg.sender_name}</p>
                )}
                {msg.has_media ? <ChatMedia message={msg} isOutbound={isOutbound} isDark={isDark} /> : null}
                {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
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
        {sendError && <p role="alert" className="mb-2 text-xs font-medium text-red-500">{sendError}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => { setNewMessage(e.target.value); setSendError(''); }}
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
