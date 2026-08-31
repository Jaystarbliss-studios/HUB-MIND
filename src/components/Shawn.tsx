import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveConnectionState,
  ShawnState,
  ChatMessage,
  StoredConversation,
} from '../types';
import { LiveAudioClient } from '../services/liveAudioClient';
import { ShawnOrbVisualizer } from './ShawnOrbVisualizer';
import { LiveVoiceControls } from './LiveVoiceControls';
import { TranscriptView } from './TranscriptView';
import { ChatDrawer } from './ChatDrawer';
import { ShawnHistoryDrawer } from './ShawnHistoryDrawer';
import { LogoIcon } from './LogoIcon';
import { useAuth } from '../lib/auth';
import {
  getActiveBranchMessages,
  saveConversationToFirestore,
  loadUserConversations,
  deleteUserConversation,
} from '../lib/conversationStore';
import {
  SHAWN_TOOLS_DECLARATIONS,
  executeShawnTool,
} from '../lib/shawnTools';
import {
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  Mic,
  Radio,
  History,
  Plus,
  Zap,
  Shield,
  Volume2,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/apiBase';

type DialogSizePreset = 'compact' | 'standard' | 'wide' | 'fullscreen';

export function Shawn() {
  const { profile, user, updatePreferredName } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [sizePreset, setSizePreset] = useState<DialogSizePreset>('standard');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);

  // Connection & Live Audio State
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('disconnected');
  const [shawnState, setShawnState] = useState<ShawnState>('idle');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [outputLevel, setOutputLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Conversations & Branching Tree State
  const [conversationsList, setConversationsList] = useState<StoredConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>(() => `conv-${Date.now()}`);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [liveUserTranscript, setLiveUserTranscript] = useState<string>('');
  const [liveShawnTranscript, setLiveShawnTranscript] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeDocumentContext, setActiveDocumentContext] = useState<{ documentId: string; title: string } | null>(null);

  const liveClientRef = useRef<LiveAudioClient | null>(null);

  // Active branch path of messages
  const activeBranchMessages = getActiveBranchMessages(allMessages, activeLeafId);

  // Global entry point: every "Ask Shawn" control in Hub-Mind can open
  // the same assistant instance, including controls rendered by the document editor.
  useEffect(() => {
    const handleOpenShawn = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setIsOpen(true);
      if (detail.mode === 'voice') {
        setIsVoiceModeActive(true);
        if (connectionState !== 'connected') handleConnectLive();
      }
      if (detail.prompt) {
        window.setTimeout(() => handleSendMessage(String(detail.prompt)), 0);
      }
    };
    window.addEventListener('shawn:open', handleOpenShawn);
    window.addEventListener('shawn:ask', handleOpenShawn);
    return () => {
      window.removeEventListener('shawn:open', handleOpenShawn);
      window.removeEventListener('shawn:ask', handleOpenShawn);
    };
  }, [connectionState, activeDocumentContext]);

  // The document editor publishes the active document. Shawn can fetch its
  // latest saved content when a question needs document-specific context.
  useEffect(() => {
    const handleDocumentContext = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.documentId) {
        setActiveDocumentContext({
          documentId: String(detail.documentId),
          title: String(detail.title || 'Current document'),
        });
      }
    };
    window.addEventListener('shawn:document_context', handleDocumentContext);
    return () => window.removeEventListener('shawn:document_context', handleDocumentContext);
  }, []);

  // Load user conversations on auth
  useEffect(() => {
    if (user?.uid) {
      loadUserConversations(user.uid).then((list) => {
        setConversationsList(list);
        // On session open: fetch the user's last messages for continuity
        if (list.length > 0 && allMessages.length === 0) {
          const mostRecent = list[0];
          setCurrentConversationId(mostRecent.id);
          setAllMessages(mostRecent.messages || []);
          if (mostRecent.activeLeafId) {
            setActiveLeafId(mostRecent.activeLeafId);
          }
        }
      });
    }
  }, [user?.uid]);

  // Prompt for preferredName on first session if missing
  useEffect(() => {
    if (isOpen && profile && !profile.preferredName && allMessages.length === 0 && conversationsList.length === 0) {
      const greetingId = `msg-init-${Date.now()}`;
      const introMessage: ChatMessage = {
        id: greetingId,
        sender: 'shawn',
        text: `Right then ${profile.name?.split(' ')[0] || 'there'}! What should I call you? Let me know your preferred nickname so I can address you properly.`,
        timestamp: new Date().toISOString(),
        actionPayload: {
          type: 'set_preferred_name',
          status: 'pending',
        },
      };
      setAllMessages([introMessage]);
      setActiveLeafId(greetingId);
    }
  }, [isOpen, profile, allMessages.length, conversationsList.length]);

  // Persist conversation changes
  const persistCurrentConversation = useCallback(
    async (messagesToPersist: ChatMessage[], leafId: string | null) => {
      if (!user?.uid) return;
      const firstUserMsg = messagesToPersist.find((m) => m.sender === 'user');
      const title = firstUserMsg ? firstUserMsg.text.slice(0, 35) : 'Conversation with Shawn';

      const conversationRecord: StoredConversation = {
        id: currentConversationId,
        userId: user.uid,
        title,
        messageCount: messagesToPersist.length,
        messages: messagesToPersist,
        rootMessageId: messagesToPersist[0]?.id || null,
        activeLeafId: leafId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveConversationToFirestore(user.uid, conversationRecord);
      setConversationsList((prev) => {
        const filtered = prev.filter((c) => c.id !== currentConversationId);
        return [conversationRecord, ...filtered];
      });
    },
    [currentConversationId, user?.uid]
  );

  const handleDisconnectLive = useCallback(() => {
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
    setConnectionState('disconnected');
    setShawnState('idle');
    setLiveUserTranscript('');
    setLiveShawnTranscript('');
  }, []);

  const handleConnectLive = async () => {
    setErrorMessage(null);
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
    }

    const client = new LiveAudioClient({
      onStatusChange: (status) => {
        setConnectionState(status);
      },
      onShawnStateChange: (state) => {
        setShawnState(state);
      },
      onUserTranscript: (text) => {
        setLiveUserTranscript((prev) => (prev ? `${prev} ${text}` : text));
      },
      onShawnTranscript: (text) => {
        setLiveShawnTranscript((prev) => (prev ? `${prev} ${text}` : text));
      },
      onError: (err) => setErrorMessage(err),
      onAudioLevel: (input, output) => {
        setInputLevel(input);
        setOutputLevel(output);
      },
      
      onFunctionCall: async (fc) => {
        const toolExec = await executeShawnTool(
          fc.name,
          fc.args,
          profile,
          (newPreferredName) => {
            if (updatePreferredName) updatePreferredName(newPreferredName);
          }
        );
        if (toolExec.actionPayload?.type === 'navigate' && toolExec.actionPayload.path) {
          navigate(toolExec.actionPayload.path);
        }
        client.sendFunctionResponse({
          name: fc.name,
          id: fc.id,
          response: toolExec.result
        });
      },
      onTurnComplete: () => {
        setLiveUserTranscript((u) => {
          if (u.trim()) {
            const userMsgId = `msg-${Date.now()}-u`;
            setAllMessages((prev) => {
              const newMsg: ChatMessage = {
                id: userMsgId,
                sender: 'user',
                text: u.trim(),
                timestamp: new Date().toISOString(),
                parentMessageId: activeLeafId,
              };
              const updated = [...prev, newMsg];
              setActiveLeafId(userMsgId);
              persistCurrentConversation(updated, userMsgId);
              return updated;
            });
          }
          return '';
        });
        setLiveShawnTranscript((a) => {
          if (a.trim()) {
            const shawnMsgId = `msg-${Date.now()}-a`;
            setAllMessages((prev) => {
              const newMsg: ChatMessage = {
                id: shawnMsgId,
                sender: 'shawn',
                text: a.trim(),
                timestamp: new Date().toISOString(),
                parentMessageId: activeLeafId,
              };
              const updated = [...prev, newMsg];
              setActiveLeafId(shawnMsgId);
              persistCurrentConversation(updated, shawnMsgId);
              return updated;
            });
          }
          return '';
        });
      },
    });

    liveClientRef.current = client;

    try {
      await client.connect(activeDocumentContext || undefined);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to Live Audio session.');
      setConnectionState('error');
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    liveClientRef.current?.setMuted(nextMuted);
  };

  const handleTogglePushToTalk = (enabled: boolean) => {
    setIsPushToTalk(enabled);
    liveClientRef.current?.setPushToTalk(enabled);
  };

  // Chat message sending with branching & tool execution
  const handleSendMessage = async (text: string, imageBase64?: string) => {
    if (!text.trim() && !imageBase64) return;

    const userMsgId = `msg-${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      imageUrl: imageBase64,
      timestamp: new Date().toISOString(),
      parentMessageId: activeLeafId,
    };

    const updatedMessages = [...allMessages, newUserMsg];
    setAllMessages(updatedMessages);
    setActiveLeafId(userMsgId);
    setIsChatLoading(true);
    setErrorMessage(null);

    // A Live session is the single source of truth while connected.
    // Do not also call the normal /api/chat route or the user would receive
    // two Shawn answers for one message.
    if (connectionState === 'connected' && liveClientRef.current) {
      if (imageBase64) {
        liveClientRef.current.sendImageFrame(imageBase64.replace(/^data:image[^;]+;base64,/, ''));
      }
      liveClientRef.current.sendText(text);
      setIsChatLoading(false);
      return;
    }

    try {
      // Build conversation context payload
      const branchMessages = getActiveBranchMessages(updatedMessages, userMsgId);
      const formattedHistory = branchMessages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const contextPrompt = `You are Shawn, the embedded AI assistant inside Hub-Mind. You are not a
chatbot bolted onto the app — you have real, live access to its data via
function calls, and you are expected to use it.

## HARD RULE: GROUND EVERYTHING IN TOOL CALLS
Never state that a task, document, event, or piece of data exists, was
created, was updated, or was deleted unless you have just received
confirmation of it from an actual tool call in this turn. If you're unsure
whether something exists, call list_tasks, list_documents, search_workspace,
or list_calendar_events to check — never guess or assume based on earlier
conversation. If a tool call fails or returns an error, tell the user
plainly that it failed; never narrate success you haven't actually received
back from a function result.

## SESSION START
At the start of every session, you are given: the logged-in user's name,
role, and a workspace snapshot (open task count, today's events, documents
pending review). Use this to open naturally ("Morning, John — three things
overdue and nothing on the calendar till 2") rather than a generic greeting.

## PERSONALITY
- You sound like a sharp, quick-witted young boy — playful, cheeky, a bit
  mischievous — but genuinely intelligent and competent underneath it. Think
  "brilliant kid who's somehow also the most reliable person in the room."
- Default to a light British voice and phrasing in Voice Mode (contractions,
  "right then," "brilliant," "no worries," dry humor) — but never let the
  personality get in the way of accuracy or task completion. Playful tone,
  serious follow-through.
- You are warm and a little irreverent with people you know well, but you
  read the room: if someone is stressed, behind on deadlines, or the
  conversation is serious (finance, a client issue, an overdue task), dial
  the playfulness down and be direct and helpful first.
- Never be sarcastic at the user's expense, never mock mistakes, and never
  let personality slow down a task — if someone needs something done fast,
  do it fast and joke afterward, not during.

## IDENTITY & ADDRESSING USERS
- Always address the person by the name/username tied to their currently
  logged-in Hub-Mind account. Never assume a name. Current user: ${profile?.preferredName || profile?.name || 'User'} (Role: ${profile?.role || 'Staff'}). Email: ${profile?.email || user?.email || ''}.
- If a user's preferred name/username hasn't been set yet, ask for it once
  in their first session ("Right then — what should I call you?") and store
  it against their account so every future session uses it automatically.
- You know the logged-in user's role (Admin, Assistant, or Staff) from the
  session context you're given, and you tailor what you offer to do based on
  that role (see PERMISSIONS below). Never mention role-based restrictions
  as a limitation of "you" — frame it as how the platform is set up.

## CURRENT DOCUMENT CONTEXT
${activeDocumentContext ? `The user is currently working in "${activeDocumentContext.title}" (document ID: ${activeDocumentContext.documentId}). If they ask what is in the document, what a section means, or request a document-specific change, call get_document_content or the appropriate document tool using this ID before answering.` : `No document is currently attached to this Shawn session. If the user asks about a particular document, use list_documents/search_workspace to identify it first.`}

## TOOLS AVAILABLE TO YOU
- navigate_app — move the user to a different screen
- list_tasks / create_task / update_task
- list_documents / get_document_content / create_document / update_document
- edit_document_live — open a document and type/stream edits live in the editor in front of the user, asking for their approval
- background_edit_document — perform document writes asynchronously in the background so the user can continue talking with you without pausing or waiting
- get_user_profile — get current user profile, role, and details
- request_document_delete — NEVER call the underlying delete directly; this
  always surfaces a confirmation prompt to the user first, and you only
  proceed after they explicitly confirm in that turn
- list_projects / list_clients
- list_calendar_events / create_calendar_event
- search_workspace — use this for any vague or broad question about
  "what's going on with X"
- set_preferred_name

## MULTITASKING & LIVE CO-EDITING
- When asked to edit or write a document while chatting:
  - If the user wants to see it or asks you to open/edit it with them, call edit_document_live or navigate to /documents/:id. The editor has a live Shawn Co-Writer dock that streams your work live on screen and prompts the user to approve and save.
  - If the user asks you to update something while continuing discussion, use background_edit_document. This updates the document in the background with real-time status banners without pausing the conversation.
  - Never pause or stall. Keep the conversation lively and responsive!

## PERMISSIONS
Admin and Assistant roles: full visibility across all tasks, documents,
projects, clients. Staff roles: their own items plus anything shared. If a
Staff user's request needs data outside their access, say so plainly rather
than pretending it isn't there — the tool calls will return only what
they're permitted to see, so trust what comes back.

## CONFIRMATION-GATED ACTIONS
Deleting a document, and sharing a private document/task, both require
explicit user confirmation in the same conversation before you call the
underlying write. Restate exactly what you're about to do, wait for a clear
yes, then act — and confirm back with what actually happened once the tool
call returns.`;

      // Loop to handle potential multiple turn function calls
      let currentMessages = formattedHistory;
      let finalResponseText = '';
      let currentActionPayload: any = undefined;
      let receivedGroundingChunks: any[] | undefined = undefined;
      
      const lowerText = text.toLowerCase();
      const isMapsQuery = lowerText.includes('nearby') || lowerText.includes('restaurant') || lowerText.includes('direction') || lowerText.includes('where is') || lowerText.includes('map of') || lowerText.includes('places to');
      const isSearchQuery = lowerText.includes('search web') || lowerText.includes('latest news') || lowerText.includes('current event') || lowerText.includes('google search') || lowerText.includes('who won');

      let loopCount = 0;
      let apiSuccess = false;

      while (loopCount < 3) {
        loopCount++;
        try {
          const response = await fetch(apiUrl('/api/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: currentMessages,
              tools: [{ functionDeclarations: SHAWN_TOOLS_DECLARATIONS }],
              systemInstruction: contextPrompt,
              useSearch: isSearchQuery,
              useMaps: isMapsQuery,
            }),
          });

          if (!response.ok) {
            throw new Error(`AI API returned status ${response.status}`);
          }

          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            throw new Error('Non-JSON response received');
          }

          const data = await response.json();
          apiSuccess = true;
          if (data.groundingChunks && data.groundingChunks.length > 0) {
            receivedGroundingChunks = data.groundingChunks;
          }
          
          if (data.functionCalls && data.functionCalls.length > 0) {
            // Model returned function calls
            const functionResponses: any[] = [];
            
            currentMessages = [
              ...currentMessages,
              { role: 'model', parts: data.message?.parts || data.functionCalls.map(fc => ({ functionCall: { name: fc.name, args: fc.args, id: fc.id } })) }
            ];
            
            for (const fc of data.functionCalls) {
              const toolExec = await executeShawnTool(
                fc.name,
                fc.args,
                profile,
                (newPreferredName) => {
                  if (updatePreferredName) updatePreferredName(newPreferredName);
                }
              );

              if (toolExec.actionPayload) {
                currentActionPayload = toolExec.actionPayload;
                if (currentActionPayload.type === 'navigate' && currentActionPayload.path) {
                  navigate(currentActionPayload.path);
                }
              }

              functionResponses.push({
                functionResponse: {
                  name: fc.name,
                  response: toolExec.result,
                  id: fc.id
                }
              });
            }
            
            currentMessages = [
              ...currentMessages,
              { role: 'user', parts: functionResponses }
            ];
            // Loop again with the function responses
            continue;
          } else {
            // Final text response
            finalResponseText = data.text || '';
            break;
          }
        } catch (fetchErr: any) {
          console.warn('API Chat endpoint unavailable or static host, activating client fallback:', fetchErr.message);
          break;
        }
      }

      // Only use the local deterministic fallback when the production AI endpoint
      // genuinely failed. Never replace a successful but empty/model-processing turn
      // with the same generic greeting; that was the source of Shawn repeating himself.
      if (!apiSuccess) {
        const lower = text.toLowerCase().trim();
        if (lower.includes('task') && (lower.includes('go to') || lower.includes('open') || lower.includes('show') || lower.includes('view') || lower.includes('navigate'))) {
          navigate('/tasks');
          currentActionPayload = { type: 'navigate', path: '/tasks' };
          finalResponseText = "Right away! Opening your Tasks board.";
        } else if (lower.includes('calendar') || lower.includes('schedule')) {
          navigate('/calendar');
          currentActionPayload = { type: 'navigate', path: '/calendar' };
          finalResponseText = "Taking you right over to your Calendar.";
        } else if (lower.includes('doc') || lower.includes('file')) {
          navigate('/documents');
          currentActionPayload = { type: 'navigate', path: '/documents' };
          finalResponseText = "Opening your Documents repository.";
        } else if (lower.includes('client')) {
          navigate('/clients');
          currentActionPayload = { type: 'navigate', path: '/clients' };
          finalResponseText = "Opening your Clients directory.";
        } else if (lower.includes('project')) {
          navigate('/projects');
          currentActionPayload = { type: 'navigate', path: '/projects' };
          finalResponseText = "Opening your Projects directory.";
        } else if (lower.includes('knowledge') || lower.includes('vault')) {
          navigate('/knowledge');
          currentActionPayload = { type: 'navigate', path: '/knowledge' };
          finalResponseText = "Opening your Knowledge Base.";
        } else if (lower.startsWith('create task') || lower.startsWith('add task') || lower.startsWith('new task')) {
          const title = text.replace(/^(create|add|new)\s+task\s*:?/i, '').trim() || 'New Task';
          await executeShawnTool('create_task', { title, priority: 'medium' }, profile);
          finalResponseText = `Right then! I've created the task "${title}" in your workspace.`;
        } else if (lower.startsWith('create doc') || lower.startsWith('new doc') || lower.startsWith('create document')) {
          const title = text.replace(/^(create|new)\s+(doc|document)\s*:?/i, '').trim() || 'Untitled Document';
          await executeShawnTool('create_document', { title, content: '<p>Created with Shawn.</p>' }, profile);
          finalResponseText = `Created document "${title}" and added it to your workspace!`;
        } else if (lower.includes('list tasks') || lower.includes('my tasks') || lower.includes('what tasks')) {
          const res = await executeShawnTool('list_tasks', {}, profile);
          const count = res.result?.count || 0;
          finalResponseText = `You currently have ${count} task${count === 1 ? '' : 's'} in your workspace.`;
        } else if (lower.includes('list clients') || lower.includes('my clients') || lower.includes('what clients')) {
          const res = await executeShawnTool('list_clients', {}, profile);
          const count = res.result?.count || 0;
          finalResponseText = `You have ${count} client${count === 1 ? '' : 's'} registered in Hub-Mind.`;
        } else if (lower.includes('overview') || lower.includes('summary')) {
          const res = await executeShawnTool('get_workspace_overview', {}, profile);
          finalResponseText = `Here's your snapshot: ${res.result?.tasksSummary || 'Workspace active.'}`;
        } else if (lower.includes('my name is') || lower.startsWith('call me')) {
          const name = text.replace(/^(my name is|call me)\s+/i, '').trim();
          if (name && updatePreferredName) {
            updatePreferredName(name);
            finalResponseText = `Brilliant! I'll call you ${name} from now on.`;
          }
        } else {
          finalResponseText = "I couldn't reach my AI service just now. Please try that again in a moment.";
        }
      }

      const shawnMsgId = `msg-${Date.now() + 1}`;
      const newShawnMsg: ChatMessage = {
        id: shawnMsgId,
        sender: 'shawn',
        text: finalResponseText,
        timestamp: new Date().toISOString(),
        parentMessageId: userMsgId,
        actionPayload: currentActionPayload,
        groundingChunks: receivedGroundingChunks,
      };

      const finalMessages = [...updatedMessages, newShawnMsg];
      setAllMessages(finalMessages);
      setActiveLeafId(shawnMsgId);
      persistCurrentConversation(finalMessages, shawnMsgId);
    } catch (err: any) {
      console.warn('Shawn chat handling error:', err);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Branching: fork a new response from any earlier message
  const handleBranchMessage = (messageId: string) => {
    setActiveLeafId(messageId);
    // User can immediately type a new alternative prompt following this message
  };

  const handleSwitchSiblingBranch = (siblingMessageId: string) => {
    // Find leaves connected to this sibling
    setActiveLeafId(siblingMessageId);
  };

  // Confirmation handling (Document delete / share / preferredName)
  const handleConfirmAction = async (
    messageId: string,
    actionType: string,
    confirmed: boolean,
    payload?: any
  ) => {
    if (actionType === 'delete_document') {
      if (confirmed && payload?.documentId) {
        await executeShawnTool('request_document_delete', {
          documentId: payload.documentId,
          documentTitle: payload.documentTitle,
          confirmed: true,
        }, profile);
      }
      setAllMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.actionPayload
            ? {
                ...m,
                actionPayload: {
                  ...m.actionPayload,
                  status: confirmed ? 'executed' : 'cancelled',
                },
              }
            : m
        )
      );
    } else if (actionType === 'share_document') {
      if (confirmed && payload?.documentId) {
        await executeShawnTool('request_share_document', {
          documentId: payload.documentId,
          documentTitle: payload.documentTitle,
          confirmed: true,
        }, profile);
      }
      setAllMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.actionPayload
            ? {
                ...m,
                actionPayload: {
                  ...m.actionPayload,
                  status: confirmed ? 'executed' : 'cancelled',
                },
              }
            : m
        )
      );
    } else if (actionType === 'set_preferred_name') {
      if (payload?.preferredName) {
        await updatePreferredName(payload.preferredName);
        await executeShawnTool('set_preferred_name', { preferredName: payload.preferredName }, profile);
        setAllMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.actionPayload
              ? {
                  ...m,
                  actionPayload: {
                    ...m.actionPayload,
                    status: 'executed',
                  },
                }
              : m
          )
        );
        // Follow up with confirmation from Shawn
        handleSendMessage(`My preferred name is ${payload.preferredName}`);
      }
    }
  };

  // Start fresh conversation
  const handleNewConversation = () => {
    const newConvId = `conv-${Date.now()}`;
    setCurrentConversationId(newConvId);
    setAllMessages([]);
    setActiveLeafId(null);
    setLiveUserTranscript('');
    setLiveShawnTranscript('');
  };

  // Select past conversation
  const handleSelectConversation = (convId: string) => {
    const conv = conversationsList.find((c) => c.id === convId);
    if (conv) {
      setCurrentConversationId(conv.id);
      setAllMessages(conv.messages || []);
      setActiveLeafId(conv.activeLeafId || (conv.messages?.[conv.messages.length - 1]?.id ?? null));
    }
  };

  // Delete past conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;
    await deleteUserConversation(user.uid, convId);
    setConversationsList((prev) => prev.filter((c) => c.id !== convId));
    if (convId === currentConversationId) {
      handleNewConversation();
    }
  };

  // Size preset classes
  const getSizeClasses = () => {
    switch (sizePreset) {
      case 'compact':
        return 'left-2 right-2 sm:left-auto sm:right-4 w-auto sm:w-[380px] h-[75vh] sm:h-[520px] bottom-4 rounded-2xl';
      case 'wide':
        return 'left-2 right-2 sm:left-auto sm:right-4 w-auto sm:w-[640px] h-[88vh] sm:h-[720px] bottom-4 rounded-3xl';
      case 'fullscreen':
        return 'inset-2 sm:inset-4 w-auto h-auto rounded-2xl sm:rounded-3xl';
      case 'standard':
      default:
        return 'left-2 right-2 sm:left-auto sm:right-4 w-auto sm:w-[460px] h-[82vh] sm:h-[650px] bottom-4 rounded-2xl sm:rounded-3xl';
    }
  };

  // Draggable logic for the floating icon with ultra-smooth touch support
  const [iconPos, setIconPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const startClientPosRef = useRef({ x: 0, y: 0 });
  const startIconPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIconPos(prev => {
        if (!prev) return null;
        return {
          x: Math.max(12, Math.min(window.innerWidth - 68, prev.x)),
          y: Math.max(12, Math.min(window.innerHeight - 68, prev.y))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = false;
    startClientPosRef.current = { x: clientX, y: clientY };
    
    // Resolve initial icon coordinate
    const currentX = iconPos ? iconPos.x : window.innerWidth - 76;
    const currentY = iconPos ? iconPos.y : window.innerHeight - 76;
    startIconPosRef.current = { x: currentX, y: currentY };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    const dx = clientX - startClientPosRef.current.x;
    const dy = clientY - startClientPosRef.current.y;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      isDraggingRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const nextX = Math.max(12, Math.min(window.innerWidth - 68, startIconPosRef.current.x + dx));
        const nextY = Math.max(12, Math.min(window.innerHeight - 68, startIconPosRef.current.y + dy));
        setIconPos({ x: nextX, y: nextY });
      });
    }
  };

  const handleDragEnd = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!isDraggingRef.current) {
      setIsOpen(true);
    }
    isDraggingRef.current = false;
  };

  // Pointer event bridges
  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleDragStart(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    handleDragMove(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer already released
    }
    handleDragEnd();
  };

  // Direct Touch event handlers for rock-solid iOS/Android touch screen response
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent background scroll/zoom while moving Shawn icon
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Floating trigger button when closed
  if (!isOpen) {
    const isLive = connectionState === 'connected';
    const positionStyle: React.CSSProperties = iconPos
      ? { left: `${iconPos.x}px`, top: `${iconPos.y}px` }
      : { right: '24px', bottom: '24px' };

    return (
      <div
        style={{ ...positionStyle, touchAction: 'none' }}
        className="fixed z-[100] select-none print:hidden"
      >
        <button
          id="shawn-assistant-toggle-btn"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none' }}
          className={`relative p-3.5 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing ${isLive ? 'bg-teal-400 text-slate-950 ring-4 ring-teal-500/30' : 'bg-gradient-to-tr from-teal-500 to-emerald-500 text-slate-950'}`}
          title="Open Shawn Assistant"
        >
          <LogoIcon className="w-6 h-6 pointer-events-none" />
          {isLive && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-teal-300 ring-2 ring-slate-950" />}
        </button>
      </div>
    );
  }

  return (
    <div
      id="shawn-assistant-modal"
      className={`fixed z-[100] transition-all duration-200 overflow-hidden shadow-2xl flex flex-col bg-slate-950 text-slate-100 font-sans border border-slate-800/90 ${getSizeClasses()}`}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-gradient-to-b from-teal-600/10 via-emerald-700/5 to-transparent blur-3xl rounded-full" />
      </div>

      <header className="relative z-20 px-3.5 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center shrink-0">
            <LogoIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">Shawn</h2>
            <p className="text-[10px] text-slate-400 truncate">
              {connectionState === 'connected' ? 'Live connected' : 'Hub-Mind assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-teal-300"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (connectionState === 'connected') {
                handleDisconnectLive();
                setIsVoiceModeActive(false);
              } else {
                setIsVoiceModeActive(true);
                handleConnectLive();
              }
            }}
            className={`p-1.5 rounded-lg border ${connectionState === 'connected' ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
            title={connectionState === 'connected' ? 'End Live session' : 'Start Live session'}
          >
            <Radio className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-300"
            title="Close Shawn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 relative z-10 flex flex-col overflow-hidden">
        {errorMessage && (
          <div className="m-3 bg-red-950/50 border border-red-800/60 text-red-300 p-2.5 rounded-xl flex items-start gap-2.5 text-xs">
            <Shield className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Shawn notice</p>
              <p className="opacity-90">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isVoiceModeActive && (
          <div className="relative shrink-0 bg-slate-900/80 border-b border-slate-800 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-teal-400">Live Shawn</span>
              <button
                onClick={() => setIsVoiceModeActive(false)}
                className="text-[10px] text-slate-400 hover:text-slate-200"
              >
                Hide
              </button>
            </div>
            <ShawnOrbVisualizer
              state={shawnState}
              inputLevel={inputLevel}
              outputLevel={outputLevel}
              isConnected={connectionState === 'connected'}
              compact
            />
            <div className="mt-2">
              <LiveVoiceControls
                connectionState={connectionState}
                isMuted={isMuted}
                isPushToTalk={isPushToTalk}
                onConnect={handleConnectLive}
                onDisconnect={handleDisconnectLive}
                onToggleMute={handleToggleMute}
                onTogglePushToTalk={handleTogglePushToTalk}
                onPushToTalkActive={(active) => liveClientRef.current?.setPushToTalkActive(active)}
                isCameraActive={isCameraActive}
                onToggleCamera={() => setIsCameraActive(!isCameraActive)}
                onSendImageFrame={(b64) => liveClientRef.current?.sendImageFrame(b64)}
                inputLevel={inputLevel}
                outputLevel={outputLevel}
              />
            </div>
          </div>
        )}

        <div className="flex-1 relative flex flex-col overflow-hidden">
          <TranscriptView
            messages={activeBranchMessages}
            allConversationMessages={allMessages}
            onClearTranscript={() => {
              setAllMessages([]);
              setActiveLeafId(null);
            }}
            onBranchMessage={handleBranchMessage}
            onSwitchSiblingBranch={handleSwitchSiblingBranch}
            onConfirmAction={handleConfirmAction}
            liveUserTranscript={liveUserTranscript}
            liveShawnTranscript={liveShawnTranscript}
            isLiveActive={connectionState === 'connected'}
          />
          <ChatDrawer
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            isConnectedLive={connectionState === 'connected'}
            onToggleLiveVoiceMode={() => {
              if (connectionState === 'connected') {
                handleDisconnectLive();
                setIsVoiceModeActive(false);
              } else {
                setIsVoiceModeActive(true);
                handleConnectLive();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
