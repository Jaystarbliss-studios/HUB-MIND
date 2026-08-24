import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Sparkles, Send, Check, X, RefreshCw, Wand2, FileText, Table, 
  ShieldCheck, ArrowRight, Loader2, Bot, MessageSquare, ChevronDown, 
  ChevronUp, Minimize2, Maximize2
} from 'lucide-react';
import { shawnTaskManager } from '../../lib/shawnTaskManager';

interface ShawnDocCoWriterProps {
  editor: Editor | null;
  docTitle: string;
  docId: string;
  onSaveDocument: (content: any) => Promise<void>;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const ShawnDocCoWriter: React.FC<ShawnDocCoWriterProps> = ({
  editor,
  docTitle,
  docId,
  onSaveDocument,
  isOpen,
  onToggleOpen,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [proposedContent, setProposedContent] = useState<string | null>(null);
  const [previousEditorContent, setPreviousEditorContent] = useState<any>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Quick Action Presets
  const quickActions = [
    { label: 'Draw / Insert Table', prompt: 'Draw a comprehensive and styled HTML table for our Institute: include 4 columns (Course Name, Duration, Weekly Hours, Tuition Fee & Certification) with 4 realistic rows and clean headers.' },
    { label: 'Fee Schedule Table', prompt: 'Create a clean 4-column structured table for Jaystarbliss Dynamic Institute Course Modules, Durations, Certifications, and Fees in NGN and USD.' },
    { label: 'Student Roster Table', prompt: 'Insert a 5-column table for Student Roster (Student ID, Full Name, Department, Enrollment Status, Grade Average) with 5 sample rows.' },
    { label: 'Draft Official Memo', prompt: 'Write an official administrative memo for Jaystarbliss Dynamic Institute with date, reference number, subject, and professional sections.' },
    { label: 'Institute Agreement', prompt: 'Draft a standard student and client enrollment agreement with terms of service, payment schedules, and conduct expectations.' },
    { label: 'Formalize Tone', prompt: 'Review and rewrite the current content into a dignified, authoritative, and elegant educational tone.' },
  ];

  // Listen for live edit events broadcast by Shawn from Chat or Voice mode
  useEffect(() => {
    const handleLiveEditEvent = async (e: any) => {
      const detail = e.detail;
      if (!detail || !editor || editor.isDestroyed || !editor.commands) return;

      if (detail.documentId === docId || !detail.documentId) {
        if (!isOpen) onToggleOpen();

        if (detail.action === 'propose' || detail.html) {
          // Save snapshot before applying
          setPreviousEditorContent(editor.getJSON());
          const htmlToAdd = detail.html || detail.contentToInsert || '';
          
          if (detail.mode === 'replace') {
            editor.commands.setContent(htmlToAdd);
          } else {
            // Append or insert
            editor.commands.focus('end');
            editor.commands.insertContent(htmlToAdd);
          }

          setProposedContent(htmlToAdd);
          setPendingApproval(true);
          setStatusMessage(detail.summary || 'I have drafted the updates live into your document. Please review!');
        }
      }
    };

    window.addEventListener('shawn:live_document_edit', handleLiveEditEvent);
    return () => window.removeEventListener('shawn:live_document_edit', handleLiveEditEvent);
  }, [editor, docId, isOpen, onToggleOpen]);

  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim() || !editor || editor.isDestroyed || !editor.commands || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage('Shawn is crafting content in real time...');
    setPendingApproval(false);
    setPreviousEditorContent(editor.getJSON());

    // Register background task in Shawn's task manager
    const task = shawnTaskManager.createTask({
      type: 'document_edit',
      title: `Shawn Co-Writing: ${docTitle}`,
      status: 'running',
      progress: 20,
      currentStepMessage: 'Synthesizing document context...',
      documentId: docId,
      documentTitle: docTitle,
    });

    try {
      shawnTaskManager.updateTask(task.id, { progress: 45, currentStepMessage: 'Drafting structured response...' });
      
      const currentDocHtml = editor.getHTML();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              parts: [{
                text: `You are Shawn, the official AI Co-Writer for Jaystarbliss Dynamic Institute.
The user wants you to edit or generate content for the document titled "${docTitle}".
User Request: "${activePrompt}".

Current Document Content:
${currentDocHtml || '(Empty document)'}

IMPORTANT FORMATTING RULES:
1. Return ONLY the HTML markup to be inserted into the document editor.
2. Use proper clean HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <blockquote>.
3. For tables, always wrap cell text in <p> (e.g. <th><p>Header</p></th> and <td><p>Cell Data</p></td>) so TipTap parses and formats them properly.
4. Maintain official Jaystarbliss Dynamic Institute standards.
5. Do NOT wrap in markdown code blocks like \`\`\`html. Return plain raw HTML directly.`
              }]
            }
          ],
        }),
      });

      if (!response.ok) throw new Error('AI generation request failed');
      const data = await response.json();
      let generatedHtml = data.reply || (data.candidates && data.candidates[0]?.content?.parts[0]?.text) || '';

      // Strip markdown code fences if model returned them
      generatedHtml = generatedHtml.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

      if (!generatedHtml) {
        throw new Error('No content returned from AI');
      }

      shawnTaskManager.updateTask(task.id, { progress: 80, currentStepMessage: 'Streaming live edits into canvas...' });
      setStatusMessage('Typing changes into document...');

      // Live stream/insert into the document
      editor.commands.focus('end');
      editor.commands.insertContent(generatedHtml);

      setProposedContent(generatedHtml);
      setPendingApproval(true);
      setStatusMessage('I have completed drafting! Check out the changes above.');

      shawnTaskManager.updateTask(task.id, { 
        status: 'awaiting_approval', 
        progress: 95, 
        currentStepMessage: 'Awaiting user review and confirmation.' 
      });

    } catch (err: any) {
      console.error('Co-writer generation error:', err);
      setStatusMessage(`Generation encountered an issue: ${err.message || 'Please try again'}`);
      shawnTaskManager.updateTask(task.id, { 
        status: 'failed', 
        progress: 100, 
        currentStepMessage: 'Failed to generate content.' 
      });
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  const handleAcceptChanges = async () => {
    if (!editor) return;
    setStatusMessage('Saving document to cloud...');
    try {
      await onSaveDocument(editor.getJSON());
      setPendingApproval(false);
      setProposedContent(null);
      setStatusMessage('Changes accepted and saved successfully! 🎉');
      
      const activeTasks = shawnTaskManager.getActiveTasks().filter(t => t.documentId === docId);
      activeTasks.forEach(t => {
        shawnTaskManager.updateTask(t.id, { 
          status: 'completed', 
          progress: 100, 
          currentStepMessage: 'Changes accepted and synced with Firestore.' 
        });
      });

      setTimeout(() => setStatusMessage(''), 3500);
    } catch (e) {
      setStatusMessage('Failed to save document. Please click save manually.');
    }
  };

  const handleRejectChanges = () => {
    if (!editor || !previousEditorContent || editor.isDestroyed || !editor.commands) return;
    editor.commands.setContent(previousEditorContent);
    setPendingApproval(false);
    setProposedContent(null);
    setStatusMessage('Changes reverted back to original version.');
    
    const activeTasks = shawnTaskManager.getActiveTasks().filter(t => t.documentId === docId);
    activeTasks.forEach(t => {
      shawnTaskManager.updateTask(t.id, { 
        status: 'completed', 
        progress: 100, 
        currentStepMessage: 'User reverted proposed changes.' 
      });
    });

    setTimeout(() => setStatusMessage(''), 3000);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      id="shawn-cowriter-dock"
      className={`fixed right-4 sm:right-6 bottom-12 z-40 w-80 sm:w-96 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-200 print:hidden ${
        isMinimized ? 'h-14' : 'max-h-[580px]'
      }`}
    >
      {/* Dock Header */}
      <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              Shawn AI Co-Writer
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              Live in-document authoring & formatting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggleOpen}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            title="Close Co-Writer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3.5 flex flex-col gap-3 overflow-y-auto max-h-[500px] text-xs">
          {/* Status Message Notification */}
          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 flex items-center gap-2">
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
              ) : (
                <Bot className="w-4 h-4 text-accent shrink-0" />
              )}
              <span className="leading-snug">{statusMessage}</span>
            </div>
          )}

          {/* Pending Approval Action Card */}
          {pendingApproval && (
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start gap-2 text-slate-200">
                <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="text-white">Review Shawn's edits:</strong>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Changes have been typed into the document. Do they look good to save?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleAcceptChanges}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Looks Great, Save</span>
                </button>
                <button
                  onClick={handleRejectChanges}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                  title="Revert back to prior content"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quick Suggestions</span>
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleGenerate(action.prompt)}
                  disabled={isGenerating}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all text-[11px] font-medium disabled:opacity-50 text-left flex items-center gap-1"
                >
                  <Wand2 className="w-2.5 h-2.5 text-accent" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            className="mt-1 flex flex-col gap-2"
          >
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask Shawn to write, expand, format, or adjust anything in this document..."
                rows={3}
                disabled={isGenerating}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="w-full py-2 rounded-xl bg-accent text-slate-950 font-bold flex items-center justify-center gap-2 shadow-md hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Writing Live...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Write / Edit Document</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
