import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { FontFamily } from '@tiptap/extension-font-family';
import { FontSize } from '../lib/FontSize';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { CharacterCount } from '@tiptap/extension-character-count';
import { HubMindPasteEngine } from '../components/documents/clipboard/paste-engine';
import { DocumentRibbon } from '../components/documents/DocumentRibbon';
import { ImportExportMenu } from '../components/documents/ImportExportMenu';
import { PaginatedPageContainer } from '../components/documents/PaginatedPageContainer';
import { FullPagePreviewModal } from '../components/documents/FullPagePreviewModal';
import { VersionHistoryModal } from '../components/documents/VersionHistoryModal';
import { ShawnDocCoWriter } from '../components/documents/ShawnDocCoWriter';
import { 
  saveDocumentOffline, 
  getDocumentWithOfflineFallback, 
  processOfflineSyncQueue 
} from '../lib/offlineSync';
import { useAuth } from '../lib/auth';
import { formatExactTimestamp, formatTimeWithSeconds } from '../lib/dateUtils';
import { 
  ArrowLeft, Loader2, Save, Sun, Moon, 
  FileText, Eye, Sparkles,
  Clock, Cloud, CheckCheck, Mic, History, WifiOff, RefreshCw,
  Bold, Italic, List, Heading1, Heading2, Undo, Redo, Smartphone, Monitor
} from 'lucide-react';
import { 
  PaperSizeOption, 
  OrientationOption, 
  MarginOption, 
  PaperThemeOption, 
  PAPER_SIZES, 
  MARGIN_PRESETS,
  computePageLayout, 
  paginateDocument,
  calculateExactPageCount
} from '../lib/paginationEngine';

export type { PaperSizeOption, OrientationOption, MarginOption, PaperThemeOption };

export interface PageSizeConfig {
  name: string;
  dimensions: string;
  widthPx: number;
  heightPx: number;
}

export function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [docMeta, setDocMeta] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastEditedTime, setLastEditedTime] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PaperSizeOption>('a4');
  const [orientation, setOrientation] = useState<OrientationOption>('portrait');
  const [marginOption, setMarginOption] = useState<MarginOption>('normal');
  const [paperTheme, setPaperTheme] = useState<PaperThemeOption>('white');
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(false);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);
  const [pageCount, setPageCount] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showPageBreaks, setShowPageBreaks] = useState<boolean>(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState<boolean>(false);
  const [isCoWriterOpen, setIsCoWriterOpen] = useState<boolean>(false);
  const [shawnActivityFlash, setShawnActivityFlash] = useState<string | null>(null);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentLayout = useMemo(() => {
    return computePageLayout({ paperSize: pageSize, orientation, marginOption });
  }, [pageSize, orientation, marginOption]);

  // Screen resize detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Superscript,
      Subscript,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      HubMindPasteEngine,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const editNow = new Date().toISOString();
      setLastEditedTime(editNow);
      setSaveStatus('saving');
      const htmlContent = editor.getHTML();

      // Recalculate page count
      const updatedPageCount = calculateExactPageCount(htmlContent, pageSize, orientation, marginOption);
      if (updatedPageCount !== pageCount) {
        setPageCount(updatedPageCount);
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        saveDocument(htmlContent, editNow);
      }, 1200); // Autosave after 1.2s of inactivity
    },
  });

  const saveLayoutSettings = async (
    nextPageSize: PaperSizeOption,
    nextOrientation: OrientationOption,
    nextMarginOption: MarginOption
  ) => {
    if (!id) return;
    const now = new Date().toISOString();
    try {
      await saveDocumentOffline(
        id,
        {
          pageSize: nextPageSize,
          orientation: nextOrientation,
          marginOption: nextMarginOption,
          updatedAt: now,
          lastEditedAt: now,
        },
        profile || undefined
      );
      setLastSavedTime(now);
    } catch (error) {
      console.error('Error saving document page layout:', error);
    }
  };

  const handlePageSizeChange = (next: PaperSizeOption) => {
    setPageSize(next);
    void saveLayoutSettings(next, orientation, marginOption);
  };

  const handleOrientationChange = (next: OrientationOption) => {
    setOrientation(next);
    void saveLayoutSettings(pageSize, next, marginOption);
  };

  const handleMarginChange = (next: MarginOption) => {
    setMarginOption(next);
    void saveLayoutSettings(pageSize, orientation, next);
  };

  const saveDocument = async (content: any, editTimestamp?: string) => {
    if (!id) return;
    try {
      setSaveStatus('saving');
      const saveNow = new Date().toISOString();
      const actualEditTime = editTimestamp || lastEditedTime || saveNow;
      const htmlString = typeof content === 'string' ? content : (editor?.getHTML() || '');

      await saveDocumentOffline(
        id,
        {
          title: docMeta?.title || 'Untitled Document',
          content: htmlString,
          updatedAt: saveNow,
          lastEditedAt: actualEditTime,
        },
        profile || undefined
      );

      setLastSavedTime(saveNow);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Error saving document:', error);
      setSaveStatus('error');
    }
  };

  // Online / Offline & Sync Event Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSyncStatus = (e: any) => {
      if (e.detail?.queueCount !== undefined) {
        setPendingSyncCount(e.detail.queueCount);
      }
      if (e.detail?.status === 'synced') {
        setSaveStatus('saved');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('hubmind:sync-status', handleSyncStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('hubmind:sync-status', handleSyncStatus);
    };
  }, []);

  // Open Unified Shawn Assistant
  const handleOpenShawnAI = (mode: 'chat' | 'voice' = 'chat') => {
    window.dispatchEvent(
      new CustomEvent('shawn:open', {
        detail: {
          mode,
          context: 'document',
          documentId: id,
          documentTitle: docMeta?.title || 'Untitled Document',
        },
      })
    );
  };

  // Listen for real-time Shawn AI document modification events
  useEffect(() => {
    const handleLiveDocEdit = (e: any) => {
      const { action, text, html, title, documentId } = e.detail || {};
      if (documentId && documentId !== id) return;
      if (!editor || editor.isDestroyed || !editor.commands) return;

      const now = new Date().toISOString();
      setLastEditedTime(now);

      if (action === 'insert_text' && text) {
        editor.commands.insertContent(text);
        setShawnActivityFlash(`Shawn inserted text`);
      } else if (action === 'append_content' && (html || text)) {
        const contentToAppend = html || `<p>${text}</p>`;
        editor.commands.insertContentAt(editor.state.doc.content.size, contentToAppend);
        setShawnActivityFlash(`Shawn appended content`);
      } else if (action === 'replace_all' && (html || text)) {
        const contentToSet = html || `<p>${text}</p>`;
        editor.commands.setContent(contentToSet);
        setShawnActivityFlash(`Shawn updated document content`);
      } else if (action === 'format_heading' && text) {
        editor.commands.setHeading({ level: 1 });
        editor.commands.insertContent(text);
        setShawnActivityFlash(`Shawn formatted heading`);
      }

      if (title && docMeta) {
        setDocMeta({ ...docMeta, title });
      }

      const updatedHtml = editor.getHTML();
      saveDocument(updatedHtml, now);

      setTimeout(() => {
        setShawnActivityFlash(null);
      }, 4000);
    };

    window.addEventListener('shawn:live_document_edit', handleLiveDocEdit);
    return () => {
      window.removeEventListener('shawn:live_document_edit', handleLiveDocEdit);
    };
  }, [editor, id, profile, docMeta]);

  useEffect(() => {
    let isMounted = true;
    const fetchDoc = async () => {
      if (!id) return;
      try {
        const data = await getDocumentWithOfflineFallback(id);
        
        if (!isMounted) return;

        if (data) {
          setDocMeta(data);
          if (data.pageSize) setPageSize(data.pageSize as PaperSizeOption);
          if (data.orientation) setOrientation(data.orientation as OrientationOption);
          if (data.marginOption) setMarginOption(data.marginOption as MarginOption);
          setLastEditedTime(data.lastEditedAt || data.updatedAt || data.createdAt || null);
          setLastSavedTime(data.lastSavedAt || data.updatedAt || data.createdAt || null);

          if (data.content && editor && !editor.isDestroyed && editor.commands) {
            try {
              if (typeof data.content === 'string' && (data.content.startsWith('{') || data.content.startsWith('['))) {
                editor.commands.setContent(JSON.parse(data.content));
              } else {
                editor.commands.setContent(data.content);
              }
            } catch (e) {
              if (editor && !editor.isDestroyed && editor.commands) {
                editor.commands.setContent(data.content);
              }
            }
          }
        } else {
          navigate('/documents');
        }
      } catch (error) {
        console.error('Error fetching document:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDoc();
    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [id, editor, navigate]);

  // Sync content if editor initializes after docMeta is loaded
  useEffect(() => {
    if (!editor || !docMeta?.content || editor.isDestroyed || !editor.commands) return;
    
    if (editor.isEmpty) {
      try {
        if (typeof docMeta.content === 'string' && (docMeta.content.startsWith('{') || docMeta.content.startsWith('['))) {
          editor.commands.setContent(JSON.parse(docMeta.content));
        } else {
          editor.commands.setContent(docMeta.content);
        }
      } catch (e) {
        editor.commands.setContent(docMeta.content);
      }
    }
  }, [editor, docMeta?.content]);

  // Recalculate page count whenever layout settings (size, orientation, margins) change
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const htmlContent = editor.getHTML();
    if (!htmlContent) return;
    const updatedCount = calculateExactPageCount(htmlContent, pageSize, orientation, marginOption);
    if (updatedCount !== pageCount) {
      setPageCount(updatedCount);
    }
  }, [editor, pageSize, orientation, marginOption]);

  // Handle version restore from Version History modal
  const handleRestoreVersion = (contentHtml: string, versionTitle?: string) => {
    if (!editor || editor.isDestroyed || !editor.commands) return;
    try {
      if (typeof contentHtml === 'string' && (contentHtml.startsWith('{') || contentHtml.startsWith('['))) {
        editor.commands.setContent(JSON.parse(contentHtml));
      } else {
        editor.commands.setContent(contentHtml);
      }
      const now = new Date().toISOString();
      setLastEditedTime(now);
      saveDocument(contentHtml, now);
      if (versionTitle && docMeta) {
        setDocMeta({ ...docMeta, title: versionTitle });
      }
    } catch (err) {
      console.error('Error applying restored version', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden font-sans">
      {/* Top Application Bar */}
      <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 border-b border-slate-800 bg-slate-950 shrink-0 print:hidden gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <button 
            onClick={() => navigate('/documents')}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors shrink-0 cursor-pointer"
            title="Back to Documents"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-accent/20 rounded text-accent hidden md:block shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <input 
                type="text" 
                value={docMeta?.title || 'Untitled Document'}
                onChange={(e) => {
                  const newT = e.target.value;
                  setDocMeta({ ...docMeta, title: newT });
                  const now = new Date().toISOString();
                  setLastEditedTime(now);
                  saveDocumentOffline(id!, { title: newT, updatedAt: now, lastEditedAt: now }, profile || undefined);
                  setLastSavedTime(now);
                }}
                className="bg-transparent text-slate-100 font-bold focus:outline-none focus:border-b border-accent px-1 truncate w-full max-w-[125px] xs:max-w-[170px] sm:max-w-[240px] md:max-w-sm text-xs sm:text-sm md:text-base"
                placeholder="Document Title"
              />

              {/* Exact Timestamps & Connectivity Indicator */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400 px-1 mt-0.5 select-none">
                <span 
                  className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-help truncate"
                  title={`Exact Last Edited Timestamp: ${formatExactTimestamp(lastEditedTime || docMeta?.lastEditedAt || docMeta?.updatedAt || docMeta?.createdAt)}`}
                >
                  <Clock className="w-3 h-3 text-amber-400/90 shrink-0" />
                  <span className="hidden md:inline">Edited:</span>
                  <strong className="text-slate-200 font-mono">{formatTimeWithSeconds(lastEditedTime || docMeta?.lastEditedAt || docMeta?.updatedAt || docMeta?.createdAt)}</strong>
                </span>
                <span className="text-slate-700">•</span>
                <span 
                  className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-help truncate"
                  title={`Exact Last Saved Timestamp: ${formatExactTimestamp(lastSavedTime || docMeta?.lastSavedAt || docMeta?.updatedAt || docMeta?.createdAt)}`}
                >
                  <Cloud className="w-3 h-3 text-emerald-400/90 shrink-0" />
                  <span className="hidden md:inline">Saved:</span>
                  <strong className="text-slate-200 font-mono">{formatTimeWithSeconds(lastSavedTime || docMeta?.lastSavedAt || docMeta?.updatedAt || docMeta?.createdAt)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Top Right Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Offline / Online Sync Status Pill */}
          {!isOnline ? (
            <div 
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold"
              title="Offline Mode"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Offline</span>
            </div>
          ) : pendingSyncCount > 0 ? (
            <button 
              onClick={() => processOfflineSyncQueue()}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold cursor-pointer hover:bg-cyan-500/25 transition-colors"
              title="Syncing"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{pendingSyncCount}</span>
            </button>
          ) : null}

          {/* Version History Button */}
          <button
            onClick={() => setIsVersionHistoryOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-300 border border-slate-700 transition-colors text-xs flex items-center gap-1.5 font-medium cursor-pointer"
            title="Open History"
          >
            <History className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden lg:inline">History</span>
          </button>

          {/* Ask Shawn to Edit Pill Button (Unified Assistant Button) */}
          <button
            onClick={() => handleOpenShawnAI('chat')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[#00b4a7] hover:bg-[#00c5b7] active:scale-95 text-slate-950 transition-all font-bold text-xs shadow-md shadow-teal-500/20 cursor-pointer shrink-0"
            title="Ask Shawn to Edit"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950 shrink-0" />
            <span className="whitespace-nowrap hidden xs:inline">Ask Shawn to Edit</span>
            <span className="whitespace-nowrap xs:hidden">Shawn</span>
          </button>

          {/* Full Page Print & PDF Preview Button */}
          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors text-xs flex items-center gap-1.5 font-semibold shadow-xs cursor-pointer"
            title="Full Page Print & PDF Preview"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Preview</span>
          </button>

          {/* Paper Theme Quick Switcher */}
          <button
            onClick={() => setPaperTheme(prev => prev === 'white' ? 'dark' : 'white')}
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
            title={`Switch to ${paperTheme === 'white' ? 'Dark Sheet' : 'White Print Paper'}`}
          >
            {paperTheme === 'white' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-cyan-400" />
            )}
          </button>

          {/* Export & Cloud Menu */}
          <ImportExportMenu 
            editor={editor} 
            docTitle={docMeta?.title || 'Untitled Document'} 
            pageSize={pageSize}
            orientation={orientation}
            marginOption={marginOption}
            onOpenPreview={() => setIsPreviewModalOpen(true)}
          />
        </div>
      </div>

      {/* Shawn Live Activity Flash Banner */}
      {shawnActivityFlash && (
        <div className="bg-linear-to-r from-teal-950/90 via-slate-900 to-cyan-950/90 border-b border-teal-500/40 px-4 py-1.5 flex items-center justify-between text-xs text-teal-200 shrink-0 select-none animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-accent animate-spin" />
            <span className="font-medium">{shawnActivityFlash}</span>
          </div>
          <button 
            onClick={() => setShawnActivityFlash(null)} 
            className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modern Office Ribbon Navigation Bar */}
      {editor && (
        <DocumentRibbon
          editor={editor}
          docTitle={docMeta?.title || 'Untitled Document'}
          pageSize={pageSize}
          setPageSize={handlePageSizeChange}
          orientation={orientation}
          setOrientation={handleOrientationChange}
          marginOption={marginOption}
          setMarginOption={handleMarginChange}
          paperTheme={paperTheme}
          setPaperTheme={setPaperTheme}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          showPageBreaks={showPageBreaks}
          setShowPageBreaks={setShowPageBreaks}
          showMarginGuides={showMarginGuides}
          setShowMarginGuides={setShowMarginGuides}
          showDebugInfo={showDebugInfo}
          setShowDebugInfo={setShowDebugInfo}
          pageCount={pageCount}
          activePage={activePage}
          onOpenPreview={() => setIsPreviewModalOpen(true)}
          onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
        />
      )}

      {/* Mobile Quick Action Formatting Bar for Smartphones */}
      {isMobileScreen && editor && (
        <div className="sm:hidden bg-slate-900 border-b border-slate-800 px-2 py-1.5 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none shrink-0 select-none">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded-lg text-xs font-bold ${
                editor.isActive('bold') ? 'bg-teal-500/25 text-teal-300 ring-1 ring-teal-400' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded-lg text-xs ${
                editor.isActive('italic') ? 'bg-teal-500/25 text-teal-300 ring-1 ring-teal-400' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold ${
                editor.isActive('heading', { level: 1 }) ? 'bg-teal-500/25 text-teal-300 ring-1 ring-teal-400' : 'bg-slate-800 text-slate-300'
              }`}
            >
              H1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold ${
                editor.isActive('heading', { level: 2 }) ? 'bg-teal-500/25 text-teal-300 ring-1 ring-teal-400' : 'bg-slate-800 text-slate-300'
              }`}
            >
              H2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded-lg text-xs ${
                editor.isActive('bulletList') ? 'bg-teal-500/25 text-teal-300 ring-1 ring-teal-400' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Stage */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden print:bg-white print:overflow-visible">
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 md:p-8 flex justify-center bg-slate-950 print:p-0 print:bg-white print:overflow-visible scrollbar-thin scrollbar-thumb-slate-800">
          <PaginatedPageContainer
            editor={editor}
            paperSize={pageSize}
            orientation={orientation}
            marginOption={marginOption}
            paperTheme={paperTheme}
            zoomLevel={zoomLevel}
            showPageBreaks={showPageBreaks}
            showMarginGuides={showMarginGuides}
            showDebugInfo={showDebugInfo}
            pageCount={pageCount}
            activePage={activePage}
            onPageCountChange={setPageCount}
            onActivePageChange={setActivePage}
          />
        </div>
      </div>
      
      {/* Bottom Status & Pagination Footer Bar with Exact Second Timestamps */}
      <div className="h-8 border-t border-slate-800 bg-slate-950 flex items-center justify-between px-3 sm:px-4 text-[10px] sm:text-[11px] text-slate-400 tracking-normal shrink-0 print:hidden select-none">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Dynamic Page Count Badge */}
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            <span>
              Page <strong className="text-accent font-mono">{activePage}</strong> of <strong className="text-white font-mono">{pageCount}</strong>
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="uppercase text-slate-400 font-mono text-[10px] hidden sm:inline">
              {currentLayout.paperDef.name} ({orientation})
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-slate-400">
            <span>{editor?.storage.characterCount?.words() || 0} words</span>
          </div>
        </div>

        {/* Real-time Second-Level Timestamps & Status in Footer Bar */}
        <div className="flex items-center gap-2 sm:gap-3 text-slate-400">
          <div 
            className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-help"
            title={`Last edited: ${formatExactTimestamp(lastEditedTime || docMeta?.lastEditedAt || docMeta?.updatedAt || docMeta?.createdAt)}`}
          >
            <Clock className="w-3 h-3 text-amber-400/90" />
            <span className="hidden sm:inline">Edited:</span>
            <strong className="text-slate-200 font-mono">{formatTimeWithSeconds(lastEditedTime || docMeta?.lastEditedAt || docMeta?.updatedAt || docMeta?.createdAt)}</strong>
          </div>

          <span className="text-slate-700">•</span>

          <div 
            className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-help"
            title={`Last saved: ${formatExactTimestamp(lastSavedTime || docMeta?.lastSavedAt || docMeta?.updatedAt || docMeta?.createdAt)}`}
          >
            <Cloud className="w-3 h-3 text-emerald-400/90" />
            <span className="hidden sm:inline">Saved:</span>
            <strong className="text-slate-200 font-mono">{formatTimeWithSeconds(lastSavedTime || docMeta?.lastSavedAt || docMeta?.updatedAt || docMeta?.createdAt)}</strong>
          </div>
        </div>
      </div>

      {/* Full Page Print & PDF Preview Modal */}
      {editor && (
        <FullPagePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          docTitle={docMeta?.title || 'Untitled Document'}
          bodyHtml={editor.getHTML()}
          textContent={editor.getText()}
          pageSize={pageSize}
          orientation={orientation}
          marginOption={marginOption}
        />
      )}

      {/* Document Version History & Restore Modal */}
      {id && editor && (
        <VersionHistoryModal
          isOpen={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          documentId={id}
          documentTitle={docMeta?.title || 'Untitled Document'}
          currentContentHtml={editor.getHTML()}
          onRestoreVersion={handleRestoreVersion}
          userProfile={profile || undefined}
        />
      )}

      {/* Shawn AI Co-Writer Live Dock */}
      {id && editor && (
        <ShawnDocCoWriter
          editor={editor}
          docTitle={docMeta?.title || 'Untitled Document'}
          docId={id}
          onSaveDocument={(content) => saveDocument(content, new Date().toISOString())}
          isOpen={isCoWriterOpen}
          onToggleOpen={() => setIsCoWriterOpen(!isCoWriterOpen)}
        />
      )}
    </div>
  );
}
