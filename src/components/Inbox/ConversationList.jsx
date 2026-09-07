import React, { useState } from 'react';
import { Search, MessageCircle, Filter } from 'lucide-react';

const platformIcons = {
  whatsapp: { emoji: '💬', color: 'text-green-500', bg: 'bg-green-500/10' },
  messenger: { emoji: '💙', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  instagram: { emoji: '📸', color: 'text-pink-500', bg: 'bg-pink-500/10' },
};

export default function ConversationList({ conversations, selectedId, onSelect, isDark, borderColor }) {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  const filtered = conversations.filter(c => {
    const matchesSearch = !search ||
      c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_phone?.includes(search) ||
      c.platform?.includes(search);
    const matchesPlatform = platformFilter === 'all' || c.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-t-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border border-t-border bg-t-base focus:outline-none focus:ring-2 focus:ring-t-primary/40"
          />
        </div>
        <div className="flex gap-1 mt-2">
          {['all', 'whatsapp', 'messenger', 'instagram'].map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${
                platformFilter === p ? 'bg-t-primary text-white' : 'text-t-muted hover:bg-t-primary/10'
              }`}>
              {p === 'all' ? 'All' : p === 'whatsapp' ? '💬 WA' : p === 'messenger' ? '💙 Msg' : '📸 IG'}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <MessageCircle className="w-8 h-8 mx-auto text-t-muted/30 mb-2" />
            <p className="text-xs text-t-muted font-bold">No conversations</p>
          </div>
        ) : filtered.map(conv => {
          const platform = platformIcons[conv.platform] || platformIcons.whatsapp;
          const isSelected = selectedId === conv.id;
          return (
            <div key={conv.id} onClick={() => onSelect(conv.id)}
              className={`p-3 border-b ${borderColor} cursor-pointer transition-all ${
                isSelected ? 'bg-t-primary/10 border-l-2 border-l-t-primary' : 'hover:bg-t-primary/5 border-l-2 border-l-transparent'
              }`}>
              <div className="flex items-start gap-2">
                <div className={`w-8 h-8 rounded-full ${platform.bg} flex items-center justify-center text-sm shrink-0`}>
                  {platform.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-t-main truncate">{conv.customer_name || 'Unknown'}</span>
                    <span className="text-[10px] text-t-muted shrink-0 ml-1">
                      {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[10px] font-bold ${platform.color} uppercase`}>{conv.platform}</span>
                    {conv.customer_phone && <span className="text-[10px] text-t-muted">• {conv.customer_phone}</span>}
                  </div>
                  <p className="text-xs text-t-muted truncate mt-0.5">{conv.last_message || 'No messages yet'}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-t-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
