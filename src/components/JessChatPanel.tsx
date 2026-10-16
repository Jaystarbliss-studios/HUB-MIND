import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Copy, LoaderCircle, MessageCircle, Plus, Sparkles, X } from 'lucide-react';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; at: number };

const starterPrompts = [
  { label: 'Help me write', text: 'Help me draft a clear, professional message.' },
  { label: 'Think it through', text: 'Help me think through a decision step by step.' },
  { label: 'Plan my work', text: 'Help me turn my priorities into a practical plan.' },
];

export function JessChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: 'Hi, I’m Jess. We can work through an idea, write something together, or plan your next steps. What’s on your mind?', at: Date.now() },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async (rawText = draft) => {
    const text = rawText.trim();
    if (!text || sending) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text, at: Date.now() };
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft('');
    setError('');
    setSending(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter(m => !m.id.startsWith('welcome')).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text }],
          })),
          systemInstruction: {
            parts: [{ text: 'You are Jess, the thoughtful, capable AI assistant inside Hub-Mind by Jaystarbliss Studios. Be warm, sharp, practical, and honest. Write naturally, not generically. Ask a focused clarifying question only when it is genuinely needed. Do not claim to have performed actions in the user’s workspace unless a connected tool has actually done so. Keep responses readable and useful.' }],
          },
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Jess could not reply just now. Please try again.');
      const reply = String(data?.text || data?.message?.parts?.find((part: any) => part.text)?.text || '').trim();
      if (!reply) throw new Error('Jess returned an empty reply. Please try again.');
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', text: reply, at: Date.now() }]);
    } catch (err: any) {
      setError(err?.name === 'TimeoutError' ? 'That took too long. Check your connection and try again.' : (err?.message || 'Could not reach Jess. Check your connection and try again.'));
    } finally {
      setSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const copyMessage = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* Clipboard access is optional. */ }
  };

  const resetChat = () => {
    setMessages([{ id: 'welcome-' + Date.now(), role: 'assistant', text: 'Fresh page. What would you like us to work on?', at: Date.now() }]);
    setError('');
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <section className="jess-chat-panel" role="dialog" aria-modal="false" aria-label="Chat with Jess">
      <header className="jess-chat-header">
        <div className="jess-chat-identity">
          <div className="jess-chat-avatar"><Sparkles size={17} /></div>
          <div className="jess-chat-heading">
            <strong>Jess</strong>
            <span><i /> Hub-Mind thought partner</span>
          </div>
        </div>
        <div className="jess-chat-header-actions">
          <button type="button" onClick={resetChat} title="Start a fresh chat" aria-label="Start a fresh chat"><Plus size={17} /></button>
          <button type="button" onClick={onClose} title="Close chat" aria-label="Close chat"><X size={18} /></button>
        </div>
      </header>

      <div className="jess-chat-context"><span className="jess-chat-context-dot" /> TEXT CHAT <span>·</span> You can switch to voice by speaking to Jess separately.</div>

      <div className="jess-chat-messages" ref={listRef} aria-live="polite">
        {messages.map((message, index) => (
          <article key={message.id} className={'jess-chat-message ' + (message.role === 'user' ? 'is-user' : 'is-jess')}>
            {message.role === 'assistant' && <div className="jess-chat-message-avatar"><Sparkles size={13} /></div>}
            <div className="jess-chat-message-body">
              <div className="jess-chat-message-label">{message.role === 'user' ? 'You' : 'Jess'}</div>
              <div className="jess-chat-bubble">{message.text}</div>
              {message.role === 'assistant' && index > 0 && <button type="button" className="jess-chat-copy" onClick={() => void copyMessage(message.text)}><Copy size={12} /> Copy reply</button>}
            </div>
          </article>
        ))}
        {sending && <div className="jess-chat-typing"><span className="jess-chat-message-avatar"><Sparkles size={13} /></span><span className="jess-chat-typing-dots"><i /><i /><i /></span><span>Jess is thinking</span><LoaderCircle className="jess-chat-spinner" size={13} /></div>}
        {error && <div className="jess-chat-error" role="alert">{error}<button type="button" onClick={() => { const last = messages[messages.length - 1]; if (last?.role === 'user') { setMessages(current => current.filter(message => message.id !== last.id)); void sendMessage(last.text); } else { void sendMessage(draft); } }}>Try again</button></div>}
      </div>

      {messages.length <= 1 && <div className="jess-chat-starters">{starterPrompts.map(prompt => <button type="button" key={prompt.label} onClick={() => void sendMessage(prompt.text)}>{prompt.label}<span>↗</span></button>)}</div>}

      <form className="jess-chat-composer" onSubmit={onSubmit}>
        <textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="Message Jess…" rows={1} aria-label="Message Jess" maxLength={12000} />
        <div className="jess-chat-composer-footer"><span>Enter to send <i>·</i> Shift + Enter for a new line</span><button type="submit" disabled={!draft.trim() || sending} aria-label="Send message"><ArrowUp size={17} /></button></div>
      </form>
      <p className="jess-chat-disclaimer">Jess can make mistakes. Review important details before acting.</p>
    </section>
  );
}

export function JessChatLauncher({ onClick }: { onClick: () => void }) {
  return <button type="button" className="jess-chat-launcher" onClick={onClick} aria-label="Open chat with Jess" title="Chat with Jess"><MessageCircle size={19} /><span>Chat with Jess</span></button>;
}
