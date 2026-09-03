import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import {
  MessageSquare,
  Copy,
  Check,
  Trash2,
  Download,
  Volume2,
  Sparkles,
  User,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Send,
  Share2,
  Calendar,
  Globe,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';
import { getSiblingsInfo } from '../lib/conversationStore';

interface TranscriptViewProps {
  messages: ChatMessage[];
  allConversationMessages?: ChatMessage[];
  onClearTranscript: () => void;
  onSaveToVault?: () => void;
  onPlayTTS?: (text: string) => void;
  onBranchMessage?: (messageId: string) => void;
  onSwitchSiblingBranch?: (siblingMessageId: string) => void;
  onConfirmAction?: (messageId: string, actionType: string, confirmed: boolean, payload?: any) => void;
  liveUserTranscript?: string;
  liveShawnTranscript?: string;
  isLiveActive: boolean;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  messages,
  allConversationMessages = [],
  onClearTranscript,
  onSaveToVault,
  onPlayTTS,
  onBranchMessage,
  onSwitchSiblingBranch,
  onConfirmAction,
  liveUserTranscript,
  liveShawnTranscript,
  isLiveActive,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preferredNameInput, setPreferredNameInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages or streaming transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, liveUserTranscript, liveShawnTranscript]);

  const handleCopySingle = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="transcript-view-panel"
      className="flex flex-col h-full bg-slate-950/40 backdrop-blur-md overflow-hidden relative"
    >
      {/* Message List */}
      <div ref={scrollRef} className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 scroll-smooth">
        {messages.length === 0 && !liveUserTranscript && !liveShawnTranscript ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <LogoIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">How can I help you today?</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Ask about operational tasks, documents, schedule Google Calendar reminders, or switch to live voice mode.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isShawn = msg.sender === 'shawn';
              const isCopied = copiedId === msg.id;

              // Sibling branch information if all messages provided
              const siblingsInfo = allConversationMessages.length > 0
                ? getSiblingsInfo(allConversationMessages, msg.id)
                : { total: 1, currentIndex: 0, siblings: [] };

              return (
                <div
                  key={msg.id}
                  className={`group relative flex gap-2.5 text-sm animate-in fade-in duration-200 ${
                    isShawn ? 'items-start' : 'items-start flex-row-reverse'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      isShawn
                        ? 'border-teal-500/40 bg-gradient-to-tr from-teal-600 to-emerald-400 text-slate-950 shadow-md shadow-teal-500/20'
                        : 'border-slate-700 bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isShawn ? <LogoIcon className="w-4 h-4" /> : <User className="w-3.5 h-3.5" />}
                  </div>

                  {/* Message Bubble Container */}
                  <div className={`max-w-[88%] sm:max-w-[82%] space-y-1.5`}>
                    {/* Bubble */}
                    <div
                      className={`relative rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-md ${
                        isShawn
                          ? 'bg-slate-900/90 border border-slate-800 text-slate-100'
                          : 'bg-gradient-to-r from-teal-600/25 to-emerald-600/20 border border-teal-500/30 text-teal-50'
                      }`}
                    >
                      {/* Sender Header */}
                      <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-400 mb-1">
                        <span className="font-semibold text-slate-300">
                          {isShawn ? 'Shawn' : 'You'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Image Attachment if present */}
                      {msg.imageUrl && (
                        <div className="rounded-lg overflow-hidden border border-slate-700 max-w-xs my-2">
                          <img src={msg.imageUrl} alt="Shared context" className="w-full h-auto object-cover" />
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap font-sans select-text">
                        {msg.text}
                      </div>

                      {/* Grounding Sources (Google Search & Google Maps) */}
                      {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 space-y-1.5">
                          <div className="text-[10px] font-semibold text-teal-400/90 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Grounded Sources
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.groundingChunks.map((chunk, idx) => {
                              if (chunk.web?.uri) {
                                return (
                                  <a
                                    key={`web-${idx}`}
                                    href={chunk.web.uri}
                                    target="_blank"
                                    rel="noreferrer"
                                    referrerPolicy="no-referrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[10px] text-teal-300 transition-colors"
                                  >
                                    <Globe className="w-2.5 h-2.5 text-teal-400" />
                                    <span className="max-w-[150px] truncate">{chunk.web.title || 'Web Result'}</span>
                                    <ExternalLink className="w-2 h-2 text-slate-400" />
                                  </a>
                                );
                              }
                              if (chunk.maps?.uri) {
                                return (
                                  <a
                                    key={`maps-${idx}`}
                                    href={chunk.maps.uri}
                                    target="_blank"
                                    rel="noreferrer"
                                    referrerPolicy="no-referrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-[10px] text-emerald-300 transition-colors"
                                  >
                                    <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="max-w-[150px] truncate">{chunk.maps.title || 'Google Maps Location'}</span>
                                    <ExternalLink className="w-2 h-2 text-emerald-400/60" />
                                  </a>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      )}

                      {/* Action Required Card (e.g. Document Delete Confirmation or Preferred Name) */}
                      {msg.actionPayload && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                          {msg.actionPayload.type === 'delete_document' && (
                            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-2">
                              <div className="flex items-center gap-2 text-red-300 font-semibold text-xs">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                <span>Confirm Document Deletion</span>
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Permanently delete "{msg.actionPayload.documentTitle || 'document'}"? This action cannot be undone.
                              </p>
                              {msg.actionPayload.status === 'executed' ? (
                                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Deleted permanently.
                                </div>
                              ) : msg.actionPayload.status === 'cancelled' ? (
                                <div className="text-[11px] text-slate-400">Deletion cancelled.</div>
                              ) : (
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() => onConfirmAction && onConfirmAction(msg.id, 'delete_document', true, msg.actionPayload)}
                                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                                  >
                                    Confirm Delete
                                  </button>
                                  <button
                                    onClick={() => onConfirmAction && onConfirmAction(msg.id, 'delete_document', false, msg.actionPayload)}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {msg.actionPayload.type === 'share_document' && (
                            <div className="p-3 bg-teal-950/40 border border-teal-500/30 rounded-xl space-y-2">
                              <div className="flex items-center gap-2 text-teal-300 font-semibold text-xs">
                                <Share2 className="w-4 h-4 text-teal-400 shrink-0" />
                                <span>Confirm Document Share</span>
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Share "{msg.actionPayload.documentTitle || 'document'}" with team members?
                              </p>
                              {msg.actionPayload.status === 'executed' ? (
                                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Shared successfully.
                                </div>
                              ) : msg.actionPayload.status === 'cancelled' ? (
                                <div className="text-[11px] text-slate-400">Sharing cancelled.</div>
                              ) : (
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() => onConfirmAction && onConfirmAction(msg.id, 'share_document', true, msg.actionPayload)}
                                    className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 rounded-lg text-xs font-semibold transition"
                                  >
                                    Confirm Share
                                  </button>
                                  <button
                                    onClick={() => onConfirmAction && onConfirmAction(msg.id, 'share_document', false, msg.actionPayload)}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {msg.actionPayload.type === 'set_preferred_name' && (
                            <div className="p-3 bg-teal-950/40 border border-teal-500/30 rounded-xl space-y-2">
                              <p className="text-xs text-teal-200 font-medium">What name should I call you?</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="e.g. John, Alex..."
                                  value={preferredNameInput}
                                  onChange={(e) => setPreferredNameInput(e.target.value)}
                                  className="flex-1 bg-slate-900 border border-teal-500/40 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-teal-400"
                                />
                                <button
                                  onClick={() => {
                                    if (preferredNameInput.trim() && onConfirmAction) {
                                      onConfirmAction(msg.id, 'set_preferred_name', true, { preferredName: preferredNameInput.trim() });
                                    }
                                  }}
                                  disabled={!preferredNameInput.trim()}
                                  className="px-3 py-1 bg-teal-500 text-slate-950 rounded-lg text-xs font-bold hover:bg-teal-400 disabled:opacity-40 transition"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer Actions (Copy, Replay, Branch) */}
                      <div className="mt-2 pt-1 flex items-center justify-between gap-2 border-t border-slate-800/40 text-[10px]">
                        {/* Branching Sibling Switcher */}
                        {siblingsInfo.total > 1 ? (
                          <div className="flex items-center gap-1 text-slate-400 bg-slate-950/60 px-1.5 py-0.5 rounded-md border border-slate-800">
                            <button
                              onClick={() => {
                                const prevIdx = siblingsInfo.currentIndex - 1;
                                if (prevIdx >= 0) {
                                  onSwitchSiblingBranch?.(siblingsInfo.siblings[prevIdx].id);
                                }
                              }}
                              disabled={siblingsInfo.currentIndex === 0}
                              className="p-0.5 hover:text-teal-300 disabled:opacity-30"
                              title="Previous branch version"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-[9px]">
                              {siblingsInfo.currentIndex + 1}/{siblingsInfo.total}
                            </span>
                            <button
                              onClick={() => {
                                const nextIdx = siblingsInfo.currentIndex + 1;
                                if (nextIdx < siblingsInfo.total) {
                                  onSwitchSiblingBranch?.(siblingsInfo.siblings[nextIdx].id);
                                }
                              }}
                              disabled={siblingsInfo.currentIndex === siblingsInfo.total - 1}
                              className="p-0.5 hover:text-teal-300 disabled:opacity-30"
                              title="Next branch version"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        ) : <div />}

                        <div className="flex items-center gap-1.5">
                          {/* Copy message button */}
                          <button
                            onClick={() => handleCopySingle(msg.id, msg.text)}
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition flex items-center gap-1"
                            title="Copy message to clipboard"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-[9px] text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                              </>
                            )}
                          </button>

                          {/* Branch button */}
                          {onBranchMessage && (
                            <button
                              onClick={() => onBranchMessage(msg.id)}
                              className="p-1 text-slate-400 hover:text-teal-300 hover:bg-teal-950/30 rounded transition flex items-center gap-1"
                              title="Fork / branch a new response from here"
                            >
                              <GitBranch className="w-3 h-3" />
                              <span className="text-[9px] hidden sm:inline">Branch</span>
                            </button>
                          )}

                          {/* TTS Audio Replay */}
                          {isShawn && onPlayTTS && (
                            <button
                              onClick={() => onPlayTTS(msg.text)}
                              className="p-1 text-slate-400 hover:text-teal-300 hover:bg-slate-800/60 rounded transition flex items-center gap-1"
                              title="Replay turn aloud"
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Live Streaming User Speech */}
            {liveUserTranscript && (
              <div className="flex gap-2.5 text-sm items-start flex-row-reverse animate-pulse">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border border-teal-500/40 bg-teal-900/40 text-teal-300">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="max-w-[82%] rounded-2xl px-4 py-2.5 bg-teal-950/40 border border-teal-500/30 text-teal-200 space-y-1">
                  <div className="text-[10px] font-mono text-teal-400">Listening...</div>
                  <div className="text-xs leading-relaxed italic">{liveUserTranscript}</div>
                </div>
              </div>
            )}

            {/* Live Streaming Shawn Speech */}
            {liveShawnTranscript && (
              <div className="flex gap-2.5 text-sm items-start animate-in fade-in duration-150">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border border-teal-500/40 bg-gradient-to-tr from-teal-600 to-emerald-400 text-slate-950 shadow-md shadow-teal-500/20">
                  <LogoIcon className="w-4 h-4" />
                </div>
                <div className="max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 bg-slate-900/90 border border-teal-500/40 text-slate-100 shadow-lg shadow-teal-950/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-teal-400">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                    </span>
                    <span className="tracking-wide uppercase font-semibold">Shawn Speaking</span>
                  </div>
                  <div className="text-sm leading-relaxed text-slate-200">
                    {liveShawnTranscript}
                    <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-teal-400 animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
