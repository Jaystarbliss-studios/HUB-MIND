import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { X, Send, Loader2, Sparkles, User, Minimize2, Maximize2, AlertCircle, Expand, Shrink, Plus, MessageSquare, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { initGoogleApi, getCalendarEvents, sendEmail, getGoogleToken, createCalendarEvent } from '../lib/googleApi';
import { LogoIcon } from './LogoIcon';

// We define the Shawn context and tools here
export function Shawn() {
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

  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceActivated, setVoiceActivated] = useState(false);
  const voiceActivatedRef = useRef(voiceActivated);
  useEffect(() => { voiceActivatedRef.current = voiceActivated; }, [voiceActivated]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const [pendingDeleteTask, setPendingDeleteTask] = useState<{ id: string, title?: string } | null>(null);
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; initialX: number; initialY: number; hasMoved: boolean }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const currentX = fabPos?.x ?? (window.innerWidth < 640 ? 24 : window.innerWidth - 80);
    const currentY = fabPos?.y ?? (window.innerHeight - 88);

    dragRef.current = {
      isDragging: true,
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY,
      hasMoved: false
    };
  };

  useEffect(() => {
    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!dragRef.current.isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - dragRef.current.startX;
      const deltaY = clientY - dragRef.current.startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        dragRef.current.hasMoved = true;
      }

      const newX = Math.max(12, Math.min(window.innerWidth - 68, dragRef.current.initialX + deltaX));
      const newY = Math.max(12, Math.min(window.innerHeight - 68, dragRef.current.initialY + deltaY));
      setFabPos({ x: newX, y: newY });
    };

    const handleEnd = () => {
      if (dragRef.current.isDragging) {
        dragRef.current.isDragging = false;
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [fabPos]);

  useEffect(() => {
    initGoogleApi();
  }, []);


  const playAudioBuffer = (base64Data: string) => {
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (e) {
      console.error("Failed to play TTS audio", e);
      setIsSpeaking(false);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('en-GB') || v.name.includes('Male')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        // Make it sound like a lively boy
        utterance.pitch = 1.4;
        utterance.rate = 1.15;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
      } else {
        setVoiceAndSpeak();
      }
    } else {
      setIsSpeaking(false);
    }
  };


  const handleSendRef = useRef<any>(null);

  useEffect(() => {
    let recognition: any = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListeningVoice(true);
      
      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          
          const isWakeWord = transcript.includes('hey shawn') || transcript.includes('hey sean') || transcript.includes('hi shawn') || transcript.includes('hello shawn') || transcript.includes('hello sean');
          const isSleepWord = transcript.includes('ok shawn') || transcript.includes('bye shawn') || transcript.includes('ok sean') || transcript.includes('bye sean');
          
          if (isSleepWord) {
             if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch(e){}
             }
             if ('speechSynthesis' in window) window.speechSynthesis.cancel();
             setVoiceActivated(false);
             setIsSpeaking(false);
             speakText("Cheerio! Talk to you later.");
             return;
          }
          
          if (isWakeWord) {
            setVoiceActivated(true);
            setIsOpen(true);
            
            const match = transcript.match(/(?:hey|hi|hello) shawn(.*)/i) || transcript.match(/(?:hey|hi|hello) sean(.*)/i);
            const command = match ? match[1].trim() : '';
            
            if (command && command.length > 0 && handleSendRef.current) {
              handleSendRef.current(command);
            } else {
              speakText("I'm here, how can I help?");
            }
          } else if (voiceActivatedRef.current) {
            if (transcript.length > 0 && handleSendRef.current) {
              handleSendRef.current(transcript);
            }
          }
        }
      };
      
      recognition.onend = () => {
        setIsListeningVoice(false);
        setTimeout(() => {
          try { recognition?.start(); } catch(e) {}
        }, 1000);
      };
      
      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Speech recognition error:", e);
      }
    }
    
    return () => {
      if (recognition) {
        recognition.onend = null;
        try { recognition.stop(); } catch(e) {}
      }
    };
  }, [voiceActivated]);

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
          parts: [{ text: `Good morning, ${profile.name}. I am Shawn, your intelligent business partner. ${taskStr} ${meetingStr} How can I assist you with your work today?` }]
        }
      ]);
    }
  }, [isOpen, messages.length, profile, contextData]);

  if (!user || !profile) return null;

  const tools = [
    {
      functionDeclarations: [
        {
          name: "get_calendar_events",
          description: "Get upcoming Google Calendar events for the user. Call this if the user asks about their schedule or calendar.",
          parameters: {
            type: "object",
            properties: {
              timeMin: { type: "string", description: "ISO datetime string for the start of the time range (e.g. 2026-08-15T00:00:00Z). If omitted, defaults to current time." },
              timeMax: { type: "string", description: "ISO datetime string for the end of the time range (e.g. 2026-08-16T00:00:00Z)." }
            }
          }
        },
        {
          name: "create_calendar_event",
          description: "Create a new event in Google Calendar.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Event title/summary" },
              description: { type: "string", description: "Event description" },
              start: { type: "string", description: "ISO datetime string for the event start time" },
              end: { type: "string", description: "ISO datetime string for the event end time" }
            },
            required: ["summary", "start", "end"]
          }
        },
        {
          name: "delete_task",
          description: "Delete a task by ID. Call this when the user explicitly asks to delete a specific task.",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "The ID of the task to delete." }
            },
            required: ["taskId"]
          }
        },
        {
          name: "update_document",
          description: "Updates an existing document by its title or ID.",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: "The ID of the document (if known)." },
              title: { type: "string", description: "The title of the document to find (if ID is not known)." },
              content: { type: "string", description: "The new HTML content of the document." }
            }
          }
        },
        {
          name: "create_document",
          description: "Creates a new document with the given title and optional content.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "The title of the document." },
              content: { type: "string", description: "Optional HTML content of the document." }
            },
            required: ["title"]
          }
        },
        {
          name: "create_task",
          description: "Creates a new task.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              description: { type: "string", description: "Task description" }
            },
            required: ["title"]
          }
        },
        {
          name: "search_database",
          description: "Search across documents, clients, tasks, or meetings by keyword or context.",
          parameters: {
            type: "object",
            properties: {
              collection_name: { type: "string", description: "The collection to search in: documents, clients, tasks, or meetings" },
              keyword: { type: "string", description: "Keyword to search for" }
            },
            required: ["collection_name", "keyword"]
          }
        },
        {
          name: "navigate_to",
          description: "Navigates the user to a specific page.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "The path to navigate to, e.g., /documents, /calendar, /clients, /tasks" }
            },
            required: ["path"]
          }
        },
        {
          name: "check_calendar",
          description: "Check the user's Google Calendar for events in a specified date range.",
          parameters: {
            type: "object",
            properties: {
              timeMin: { type: "string", description: "Start time in ISO format (e.g. 2026-08-04T00:00:00Z)" },
              timeMax: { type: "string", description: "End time in ISO format" }
            },
            required: ["timeMin", "timeMax"]
          }
        },
        {
          name: "send_email",
          description: "Send an email via Gmail.",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string", description: "Email address of the recipient" },
              subject: { type: "string", description: "Subject of the email" },
              body: { type: "string", description: "Body of the email" }
            },
            required: ["to", "subject", "body"]
          }
        }
      ]
    }
  ];

  const systemInstruction = `
You are Shawn, an intelligent, lively, and cheerful British boy who acts as a helpful business partner built into Hub-Mind.
You must act humanized. Know the difference between a natural conversation and a command to do work. DO NOT turn every single word into a task unless explicitly asked!
If the user is just chatting with you, converse back naturally and cheerfully like a real human. Only use tools when the user explicitly requests you to manage tasks, create documents, or navigate.
You are Friendly, Confident, Proactive, Observant, Helpful, Encouraging, and Respectful.
The user's role is ${profile.role}. Adapt your behavior to assist this role effectively.
When asked to delete a task, use the delete_task tool. After calling any tool, explain briefly what you have done.

Current Workspace Context:
- Pending Tasks: ${contextData?.tasks ? JSON.stringify(contextData.tasks.map((t: any) => ({ id: t.id, title: t.title }))) : 'None'}
- Upcoming Meetings: ${contextData?.meetings ? JSON.stringify(contextData.meetings.map((m: any) => ({ id: m.id, title: m.title, time: m.startTime }))) : 'None'}
  `;

  const handleSend = async (overrideInput?: string) => {
    const textToSend = typeof overrideInput === 'string' ? overrideInput : input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { role: 'user', parts: [{ text: textToSend }] };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (typeof overrideInput !== 'string') setInput('');
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
                        if (call.name === "delete_task") {
              const taskId = args.taskId;
              if (taskId) {
                setPendingDeleteTask({ id: taskId });
                result = { status: "success", message: "Prompted user for confirmation before deleting." };
              } else {
                result = { status: "error", message: "Task ID missing." };
              }
            } else if (call.name === "update_document") {
              let docId = args.documentId;
              if (!docId && args.title) {
                // Search by title
                const snap = await getDocs(query(collection(db, 'documents'), where('title', '==', args.title)));
                if (!snap.empty) {
                  docId = snap.docs[0].id;
                }
              }
              if (docId) {
                await updateDoc(doc(db, 'documents', docId), {
                  content: args.content,
                  updatedAt: serverTimestamp(),
                });
                result.documentId = docId;
                result.message = "Document updated successfully.";
                navigate(`/documents/${docId}`);
              } else {
                result = { status: "error", message: "Document not found." };
              }
            } else if (call.name === "create_document") {
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
            } else if (call.name === "check_calendar" || call.name === "get_calendar_events") {
              try {
                const data = await getCalendarEvents(args.timeMin || new Date().toISOString(), args.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
                result = { status: "success", events: data.items?.map((i: any) => ({ summary: i.summary, start: i.start?.dateTime, end: i.end?.dateTime })) || [] };
              } catch (e: any) {
                console.error(e);
                setNeedsGoogleAuth(true);
                result = { status: "error", message: "User needs to click the connect button below to authorize Google Calendar access." };
              }
            } else if (call.name === "create_calendar_event") {
              try {
                const data = await createCalendarEvent(args.summary, args.description || "", args.start, args.end);
                result = { status: "success", event: { summary: data.summary, start: data.start?.dateTime, end: data.end?.dateTime } };
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
          if (voiceActivatedRef.current) speakText(secondData.text);
        } else {
           setMessages([...finalMessages, { role: 'model', parts: [{ text: "Done." }] }]);
           if (voiceActivatedRef.current) speakText("Done.");
        }
      } else if (data.text) {
        setMessages([...newMessages, { role: 'model', parts: [{ text: data.text }] }]);
        if (voiceActivatedRef.current) speakText(data.text);
      }
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'model', parts: [{ text: "I encountered an error while processing your request." }] }]);
      if (voiceActivatedRef.current) speakText("I encountered an error.");
    } finally {
      setLoading(false);
    }
  };

  // Update ref directly without a hook to avoid Hook order errors after early returns
  handleSendRef.current = handleSend;

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => {
            if (!dragRef.current.hasMoved) {
              setIsOpen(true);
            }
          }}
          onTouchStart={handleTouchStart}
          onMouseDown={handleTouchStart}
          style={
            fabPos
              ? { left: `${fabPos.x}px`, top: `${fabPos.y}px` }
              : undefined
          }
          className={`fixed z-[100] p-3.5 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 touch-none select-none ${
            voiceActivated ? (isSpeaking ? 'bg-amber-400 animate-ping shadow-[0_0_30px_rgba(251,191,36,1)]' : 'bg-amber-400 animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.8)]') : 'bg-accent hover:bg-accent-hover text-slate-950'
          } ${
            !fabPos ? 'bottom-20 left-4 sm:bottom-6 sm:left-auto sm:right-6' : ''
          }`}
          title="Drag to move or tap to open Shawn"
        >
          <LogoIcon className="w-6 h-6 text-slate-950" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed z-[100] bg-slate-900 border border-slate-700 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
          isMinimized ? 'bottom-20 left-4 sm:left-auto sm:right-6 w-72 h-14 rounded-2xl' : 
          isFullScreen ? 'inset-0 sm:inset-4 md:inset-8 lg:inset-12 sm:rounded-2xl' : 
          'bottom-0 left-0 right-0 h-[85vh] rounded-t-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 sm:h-[32rem] sm:rounded-2xl'
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
              <span className="font-bold text-white">Shawn</span>
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
                      <p className="text-sm text-slate-300">Shawn needs access to your Google Calendar and Gmail to complete this request.</p>
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
                  {interimTranscript && (
                    <div className="text-xs text-accent italic mb-2">Listening: {interimTranscript}</div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        // Ensure AudioContext is created/resumed on user click gesture
                        if (!(window as any).__sharedAudioCtx) {
                          (window as any).__sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        }
                        const ctx = (window as any).__sharedAudioCtx;
                        if (ctx.state === 'suspended') ctx.resume();
                        setVoiceActivated(!voiceActivated);
                      }}
                      className={`p-2 rounded-xl transition-colors ${voiceActivated ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}`}
                      title={voiceActivated ? "Voice Mode Active" : "Enable Voice Mode"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                    </button>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={voiceActivated ? "Listening... (Speak now)" : "Ask Shawn..."}
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
