import React, { useState } from 'react';
import { StoredConversation } from '../types';
import {
  MessageSquare,
  Trash2,
  Plus,
  X,
  Clock,
  ChevronRight,
  Copy,
  Check,
  Search,
  ChevronDown,
  User,
  Bot,
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';

interface ShawnHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: StoredConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string, e: React.MouseEvent) => void;
}

export function ShawnHistoryDrawer({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ShawnHistoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchTitle = (c.title || '').toLowerCase().includes(query);
    const matchSnippet = (c.summary || '').toLowerCase().includes(query);
    const matchMessages = (c.messages || []).some((m) =>
      m.text.toLowerCase().includes(query)
    );
    return matchTitle || matchSnippet || matchMessages;
  });

  const handleCopyText = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyFullConversation = (conv: StoredConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = (conv.messages || [])
      .map((m) => `[${m.sender === 'user' ? 'USER' : 'SHAWN'} - ${new Date(m.timestamp).toLocaleTimeString()}]: ${m.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(formatted || conv.summary || 'No messages');
    setCopiedId(`full_${conv.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedConvId(expandedConvId === convId ? null : convId);
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-xl flex flex-col animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <LogoIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Conversation Archive</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300">
                {conversations.length} Logs
              </span>
            </h3>
            <p className="text-xs text-slate-400">Past chats, snippets & transcript export</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
          title="Close History"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Bar: Search & New Chat */}
      <div className="p-3 border-b border-slate-800/80 space-y-2 bg-slate-950/50">
        <button
          onClick={() => {
            onNewConversation();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 rounded-xl text-xs font-semibold tracking-wide transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Conversation Thread
        </button>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations, keywords, transcripts..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredConversations.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-teal-400" />
            <p className="text-xs font-medium text-slate-400">
              {searchQuery ? 'No matching conversations found' : 'No saved conversations yet'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
              Talking or typing with Shawn will automatically persist conversation threads here.
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isExpanded = expandedConvId === conv.id;
            const dateStr = new Date(conv.updatedAt || conv.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const messages = conv.messages || [];

            return (
              <div
                key={conv.id}
                className={`group rounded-xl border transition-all overflow-hidden ${
                  isActive
                    ? 'bg-teal-950/40 border-teal-500/50 shadow-md shadow-teal-950/30'
                    : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Row Summary */}
                <div
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                  className="p-3 cursor-pointer flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isActive ? 'text-teal-400' : 'text-slate-400'
                        }`}
                      />
                      <h4
                        className={`text-xs font-semibold truncate ${
                          isActive ? 'text-teal-200' : 'text-slate-200'
                        }`}
                      >
                        {conv.title || 'Conversation Thread'}
                      </h4>
                    </div>

                    {conv.summary && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 font-sans">
                        {conv.summary}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-600" />
                        {dateStr}
                      </span>
                      <span>&bull;</span>
                      <span>{messages.length} messages</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Copy Full Transcript */}
                    <button
                      onClick={(e) => handleCopyFullConversation(conv, e)}
                      className="p-1.5 text-slate-400 hover:text-teal-300 hover:bg-teal-950/40 rounded transition"
                      title="Copy full transcript"
                    >
                      {copiedId === `full_${conv.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Expand/Collapse preview */}
                    {messages.length > 0 && (
                      <button
                        onClick={(e) => toggleExpand(conv.id, e)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        title={isExpanded ? 'Collapse preview' : 'Expand preview'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-teal-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={(e) => onDeleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                      title="Delete Conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Snippet / Message Viewer */}
                {isExpanded && messages.length > 0 && (
                  <div className="border-t border-slate-800/80 bg-slate-950/70 p-3 space-y-2 max-h-56 overflow-y-auto">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span>Message Transcript Snippets:</span>
                      <button
                        onClick={(e) => handleCopyFullConversation(conv, e)}
                        className="text-teal-400 hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-2.5 h-2.5" /> Copy All
                      </button>
                    </div>

                    {messages.map((msg, i) => (
                      <div
                        key={msg.id || i}
                        className={`p-2 rounded-lg text-xs leading-relaxed flex items-start justify-between gap-2 ${
                          msg.sender === 'user'
                            ? 'bg-slate-900/90 border border-slate-800 text-slate-200'
                            : 'bg-teal-950/30 border border-teal-500/20 text-teal-100'
                        }`}
                      >
                        <div className="flex items-start gap-1.5 min-w-0">
                          {msg.sender === 'user' ? (
                            <User className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
                          ) : (
                            <Bot className="w-3 h-3 mt-0.5 text-teal-400 shrink-0" />
                          )}
                          <p className="text-[11px] font-sans break-words">{msg.text}</p>
                        </div>

                        <button
                          onClick={(e) => handleCopyText(msg.text, `${conv.id}_${i}`, e)}
                          className="text-slate-500 hover:text-slate-200 p-0.5 shrink-0"
                          title="Copy snippet"
                        >
                          {copiedId === `${conv.id}_${i}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
