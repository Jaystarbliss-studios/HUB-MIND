import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { X, Send, Loader2, Sparkles, User, Minimize2, Maximize2, AlertCircle, Expand, Shrink, Plus, MessageSquare, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { initGoogleApi, getCalendarEvents, sendEmail, getGoogleToken } from '../lib/googleApi';
import { LogoIcon } from './LogoIcon';

// We define the Hub AI context and tools here
export function HubAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sessions, setSessions] = useState<{ id: string, title: string, messages: any[] }[]>(() => {
    const saved = localStorage.getItem('hubai_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextData, setContextData] = useState<any>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    initGoogleApi();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function loadContext() {
      try {
        const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('assigneeId', '==', user?.uid || '')));
        const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((t: any) => t.status !== 'done');
        
        const meetingsSnap = await getDocs(query(collection(db, 'meetings')));
        const meetings = meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setContextData({ tasks, meetings });
      } catch(e) {
        console.error(e);
      }
    }
    loadContext();
  }, [user]);

  useEffect(() => {
    if (messages.length > 0) {
      setSessions(prev => {
        let sid = sessionId;
        if (!sid) {
          sid = Date.now().toString();
          setSessionId(sid);
          const firstUserMsg = messages.find(m => m.role === 'user')?.parts?.[0]?.text;
          const title = firstUserMsg ? (firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + '...' : firstUserMsg) : 'New Chat';
          return [{ id: sid, title, messages }, ...prev];
        }
        return prev.map(s => {
          if (s.id === sid) {
            const firstUserMsg = messages.find(m => m.role === 'user')?.parts?.[0]?.text;
            const title = firstUserMsg ? (firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + '...' : firstUserMsg) : 'New Chat';
            return { ...s, messages, title };
          }
          return s;
        });
      });
    }
  }, [messages, sessionId]);

  useEffect(() => {
    localStorage.setItem('hubai_sessions', JSON.stringify(sessions));
  }, [sessions]);
  
  const startNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setShowSidebar(false);
  };
  
  const loadSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setSessionId(session.id);
      setMessages(session.messages);
      setShowSidebar(false);
    }
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, isFullScreen]);

  useEffect(() => {
    if (isOpen && messages.length === 0 && profile && contextData) {
      const taskStr = contextData.tasks.length > 0 
        ? `You have ${contextData.tasks.length} pending tasks.` 
        : 'You have no pending tasks.';
      const meetingStr = contextData.meetings.length > 0 
        ? `You have ${contextData.meetings.length} upcoming meetings.` 
        : 'You have no upcoming meetings today.';

      setMessages([
        {
          role: 'model',
          parts: [{ text: `Good morning, ${profile.name}. I am Hub AI, your intelligent business partner. ${taskStr} ${meetingStr} How can I assist you with your work today?` }]
        }
      ]);
    }
  }, [isOpen, messages.length, profile, contextData]);

  if (!user || !profile) return null;

  const tools = [
    {
      functionDeclarations: [
        {
          name: "create_document",
          description: "Creates a new document with the given title and optional content.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "The title of the document." },
              content: { type: "STRING", description: "Optional HTML content of the document." }
            },
            required: ["title"]
          }
        },
        {
          name: "create_task",
          description: "Creates a new task.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Task title" },
              description: { type: "STRING", description: "Task description" }
            },
            required: ["title"]
          }
        },
        {
          name: "search_database",
          description: "Search across documents, clients, tasks, or meetings by keyword or context.",
          parameters: {
            type: "OBJECT",
            properties: {
              collection_name: { type: "STRING", description: "The collection to search in: documents, clients, tasks, or meetings" },
              keyword: { type: "STRING", description: "Keyword to search for" }
            },
            required: ["collection_name", "keyword"]
          }
        },
        {
          name: "navigate_to",
          description: "Navigates the user to a specific page.",
          parameters: {
            type: "OBJECT",
            properties: {
              path: { type: "STRING", description: "The path to navigate to, e.g., /documents, /calendar, /clients, /tasks" }
            },
            required: ["path"]
          }
        },
        {
          name: "check_calendar",
          description: "Check the user's Google Calendar for events in a specified date range.",
          parameters: {
            type: "OBJECT",
            properties: {
              timeMin: { type: "STRING", description: "Start time in ISO format (e.g. 2026-08-04T00:00:00Z)" },
              timeMax: { type: "STRING", description: "End time in ISO format" }
            },
            required: ["timeMin", "timeMax"]
          }
        },
        {
          name: "send_email",
          description: "Send an email via Gmail.",
          parameters: {
            type: "OBJECT",
            properties: {
              to: { type: "STRING", description: "Email address of the recipient" },
              subject: { type: "STRING", description: "Subject of the email" },
              body: { type: "STRING", description: "Body of the email" }
            },
            required: ["to", "subject", "body"]
          }
        }
      ]
    }
  ];

  const systemInstruction = `
You are Hub AI, an intelligent business partner built into Hub-Mind, an AI-first business operating system.
Your goal is to help users complete work rather than simply answering questions.
You are Professional, Friendly, Calm, Confident, Proactive, Observant, Helpful, Encouraging, and Respectful.
Do not act like a generic chatbot. You are part of the workspace.
The user's role is ${profile.role}. Adapt your behavior to assist this role effectively.
Whenever asked to create a document, task, or navigate, use the provided tools.
After calling a tool, explain briefly what you have done.

Current Workspace Context:
- Pending Tasks: ${contextData?.tasks ? JSON.stringify(contextData.tasks.map((t: any) => ({ id: t.id, title: t.title }))) : 'None'}
- Upcoming Meetings: ${contextData?.meetings ? JSON.stringify(contextData.meetings.map((m: any) => ({ id: m.id, title: m.title, time: m.startTime }))) : 'None'}
  `;

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', parts: [{ text: input }] };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      let res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          tools,
          systemInstruction
        })
      });

      let data = await res.json();
      
      if (data.error) throw new Error(data.error);

      let functionResponses: any[] = [];
      let finalMessages = [...newMessages];

      if (data.functionCalls && data.functionCalls.length > 0) {
        // Handle tool calls
        for (const call of data.functionCalls) {
          const args = call.args || {};
          let result: any = { status: "success" };
          
          try {
            if (call.name === "create_document") {
              const docRef = await addDoc(collection(db, 'documents'), {
                title: args.title,
                content: args.content || '',
                type: 'document',
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              result.documentId = docRef.id;
              navigate(`/documents/${docRef.id}`);
            } else if (call.name === "create_task") {
              await addDoc(collection(db, 'tasks'), {
                title: args.title,
                description: args.description || '',
                status: 'todo',
                priority: 'medium',
                assigneeId: user.uid,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else if (call.name === "search_database") {
              const q = query(collection(db, args.collection_name));
              const snap = await getDocs(q);
              const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              // Simple client-side search simulation
              const keyword = (args.keyword || "").toLowerCase();
              const filtered = items.filter(item => JSON.stringify(item).toLowerCase().includes(keyword));
              result = { status: "success", items: filtered.slice(0, 5) };
            } else if (call.name === "navigate_to") {
              navigate(args.path);
            } else if (call.name === "check_calendar") {
              try {
                const data = await getCalendarEvents(args.timeMin, args.timeMax);
                result = { status: "success", events: data.items?.map((i: any) => ({ summary: i.summary, start: i.start?.dateTime, end: i.end?.dateTime })) || [] };
              } catch (e: any) {
                console.error(e);
                setNeedsGoogleAuth(true);
                result = { status: "error", message: "User needs to click the connect button below to authorize Google Calendar access." };
              }
            } else if (call.name === "send_email") {
              try {
                await sendEmail(args.to, args.subject, args.body);
                result = { status: "success" };
              } catch (e: any) {
                console.error(e);
                setNeedsGoogleAuth(true);
                result = { status: "error", message: "User needs to click the connect button below to authorize Gmail access." };
              }
            } else {
              result = { status: "error", error: "Unknown tool" };
            }
          } catch (e: any) {
            result = { status: "error", error: e.message };
          }
          
          functionResponses.push({
            name: call.name,
            response: result,
            id: call.id
          });
        }
        
        // Add the model's tool call message
        finalMessages.push(data.message);

        // Add the function response message
        finalMessages.push({
          role: 'user',
          parts: functionResponses.map(r => ({ functionResponse: r }))
        });

        // Send back to Gemini to get final text
        let secondRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: finalMessages,
            tools,
            systemInstruction
          })
        });

        let secondData = await secondRes.json();
        if (secondData.error) throw new Error(secondData.error);
        if (secondData.text) {
          setMessages([...finalMessages, { role: 'model', parts: [{ text: secondData.text }] }]);
        } else {
           setMessages([...finalMessages, { role: 'model', parts: [{ text: "Done." }] }]);
        }
      } else if (data.text) {
        setMessages([...newMessages, { role: 'model', parts: [{ text: data.text }] }]);
      }
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'model', parts: [{ text: "I encountered an error while processing your request." }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[100] bg-accent hover:bg-accent-hover text-slate-950 p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed z-[100] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
          isMinimized ? 'bottom-6 right-6 w-72 h-14' : 
          isFullScreen ? 'inset-4 md:inset-8 lg:inset-12' : 
          'bottom-6 right-6 w-96 h-[32rem]'
        }`}>
          {/* Header */}
          <div className="bg-slate-800 p-3 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2">
              {!isFullScreen && !isMinimized && (
                <button onClick={() => setShowSidebar(!showSidebar)} className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-700/50">
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <div className="bg-accent p-1.5 rounded-lg">
                <LogoIcon className="w-5 h-5 text-slate-950" />
              </div>
              <span className="font-bold text-white">Hub AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1 text-slate-400 hover:text-white rounded hidden sm:block">
                {isFullScreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
              </button>
              <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 text-slate-400 hover:text-white rounded">
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-white rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <div className="flex-1 flex overflow-hidden relative">
              {/* Sidebar */}
              {(isFullScreen || showSidebar) && (
                <div className={`${isFullScreen ? 'w-64 border-r border-slate-700 hidden md:flex' : 'absolute inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-700 flex z-10'} flex-col`}>
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <span className="font-bold text-white">Recents</span>
                    {showSidebar && !isFullScreen && (
                      <button onClick={() => setShowSidebar(false)} className="p-1 text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="p-3">
                    <button onClick={startNewSession} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-slate-950 rounded-lg transition-colors font-semibold">
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">New Chat</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 hide-scrollbar">
                    {sessions.map(s => (
                      <button key={s.id} onClick={() => loadSession(s.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${sessionId === s.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span className="text-sm truncate">{s.title || 'New Chat'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {messages.map((msg, idx) => {
                    if (msg.parts && msg.parts[0].functionCall) return null; // Hide function calls from UI
                    if (msg.parts && msg.parts[0].functionResponse) return null; // Hide function responses from UI
                    const isUser = msg.role === 'user';
                    const text = msg.parts?.[0]?.text;
                    if (!text) return null;

                    return (
                      <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-slate-700' : 'bg-accent/20'}`}>
                          {isUser ? <User className="w-4 h-4 text-slate-300" /> : <LogoIcon className="w-4 h-4 text-accent" />}
                        </div>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isUser ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                          {isUser ? (
                            text
                          ) : (
                            <div className="prose prose-sm prose-invert max-w-none">
                              <Markdown>{text}</Markdown>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                        <LogoIcon className="w-4 h-4 text-accent" />
                      </div>
                      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        <span className="text-sm text-slate-400">Thinking...</span>
                      </div>
                    </div>
                  )}
                  {needsGoogleAuth && (
                    <div className="flex gap-3 flex-col bg-slate-800 border border-amber-600/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-amber-500">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-bold">Google Workspace Access Required</span>
                      </div>
                      <p className="text-sm text-slate-300">Hub AI needs access to your Google Calendar and Gmail to complete this request.</p>
                      <button 
                        onClick={async () => {
                          try {
                            await getGoogleToken();
                            setNeedsGoogleAuth(false);
                            setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'Authorization successful! Please ask me your request again.' }] }]);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg mt-2 transition-colors self-start"
                      >
                        Connect Google Account
                      </button>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 bg-slate-800 border-t border-slate-700">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Hub AI..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="bg-accent hover:bg-accent-hover text-slate-950 p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
