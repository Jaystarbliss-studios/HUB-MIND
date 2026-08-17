import React from 'react';
import { StoredConversation } from '../types';
import { MessageSquare, Trash2, Plus, X, Calendar, Clock, ChevronRight } from 'lucide-react';
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
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-md flex flex-col animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <LogoIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Conversation History</h3>
            <p className="text-xs text-slate-400">Past chats and forked threads</p>
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

      {/* Action Button */}
      <div className="p-3 border-b border-slate-800/80">
        <button
          onClick={() => {
            onNewConversation();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 rounded-xl text-xs font-semibold tracking-wide transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Conversation
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {conversations.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-teal-400" />
            <p className="text-xs font-medium text-slate-400">No saved conversations yet</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              Chatting with Shawn will automatically persist your conversation history here.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const dateStr = new Date(conv.updatedAt || conv.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  onClose();
                }}
                className={`group relative p-3 rounded-xl cursor-pointer border transition-all flex items-start justify-between gap-3 ${
                  isActive
                    ? 'bg-teal-950/40 border-teal-500/50 shadow-md shadow-teal-950/30'
                    : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                    <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-teal-200' : 'text-slate-200'}`}>
                      {conv.title || 'Conversation'}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {dateStr}
                    </span>
                    <span>&bull;</span>
                    <span>{conv.messageCount || (conv.messages ? conv.messages.length : 0)} messages</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => onDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded transition"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-teal-400' : 'text-slate-600'}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
