import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shareHubMindItem, copyShareUrl } from '../lib/shareLinks';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { FontFamily } from '@tiptap/extension-font-family';
import { FontSize } from '../lib/FontSize';
import { DocumentFormatting } from '../lib/DocumentFormatting';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { CharacterCount } from '@tiptap/extension-character-count';
import { HubMindPasteEngine } from '../components/documents/clipboard/paste-engine';
import { sanitizeClipboardHtml } from '../components/documents/clipboard/clipboard-sanitizer';
import { normalizeClipboardHtml } from '../components/documents/clipboard/clipboard-normalizer';
import { DocumentRibbon } from '../components/documents/DocumentRibbon';
import { ImportExportMenu } from '../components/documents/ImportExportMenu';
import { PaginatedPageContainer } from '../components/documents/PaginatedPageContainer';
import { FullPagePreviewModal } from '../components/documents/FullPagePreviewModal';
import { VersionHistoryModal } from '../components/documents/VersionHistoryModal';
import { ShawnDocCoWriter } from '../components/documents/ShawnDocCoWriter';
import { 
  saveDocumentOffline, 
  getDocumentWithOfflineFallback, 
  processOfflineSyncQueue,
  isContentEffectivelyEmpty,
  extractDocumentBody
} from '../lib/offlineSync';
import { useAuth } from '../lib/auth';
import { formatExactTimestamp, formatTimeWithSeconds } from '../lib/dateUtils';
import { 
  ArrowLeft, Loader2, Save, Sun, Moon, 
  FileText, Eye, Sparkles,
  Clock, Cloud, History, WifiOff, RefreshCw,
  Bold, Italic, List, Undo, Redo
} from 'lucide-react';
import { 
  PaperSizeOption, 
  OrientationOption, 
  MarginOption, 
  PaperThemeOption, 
  computePageLayout, 
  calculateExactPageCount
} from '../lib/paginationEngine';

export type { PaperSizeOption, OrientationOption, MarginOption, PaperThemeOption };

export interface PageSizeConfig {
  name: string;
  dimensions: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Reads document content from both the current format and legacy records.
 * Older template creation stored HTML as a JSON-encoded string, so decode
 * that representation before handing the content to TipTap.
 */
function parseStoredDocumentContent(content: unknown): unknown {
  if (typeof content !== 'string') return content;

  const trimmed = content.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'string' ? parsed : parsed;
    } catch {
      // Ordinary HTML or text; leave untouched
    }
  }

  return content;
}

/**
 * Derives initial content for TipTap from a loaded document payload.
 * Prefers TipTap JSON when present, otherwise decodes and sanitizes stored HTML.
 */
function resolveInitialEditorContent(data: any): any {
  if (!data) return '<p></p>';
  const { html, json } = extractDocumentBody(data);
  if (json && !isContentEffectivelyEmpty(null, json)) {
    return json;
  }
  if (html && !isContentEffectivelyEmpty(html, null)) {
    const decoded = parseStoredDocumentContent(html);
    if (typeof decoded === 'string') {
      const cleanHtml = normalizeClipboardHtml(
        sanitizeClipboardHtml(decoded),
        'stored-doc'
      );
      return cleanHtml || decoded;
    }
    return decoded;
  }
  if (json) return json;
  return '<p></p>';
}

/**
 * Active Document Editor Workspace.
 * This component is ONLY rendered after the document data has been successfully
 * fetched and resolved asynchronously from Firestore and local offline storage.
 */
function DocumentEditorWorkspace({ initialDoc, docId }: { initialDoc: any; docId: string }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isSharedView = new URLSearchParams(window.location.search).get('shared') === '1';

  const [docMeta, setDocMeta] = useState<any>(initialDoc);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastEditedTime, setLastEditedTime] = useState<string | null>(
    initialDoc?.lastEditedAt || initialDoc?.updatedAt || initialDoc?.createdAt || null
  );
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(
    initialDoc?.lastSavedAt || initialDoc?.updatedAt || initialDoc?.createdAt || null
  );
  const [pageSize, setPageSize] = useState<PaperSizeOption>(initialDoc?.pageSize || 'a4');
  const [orientation, setOrientation] = useState<OrientationOption>(initialDoc?.orientation || 'portrait');
  const [marginOption, setMarginOption] = useState<MarginOption>(initialDoc?.marginOption || 'normal');
  const [paperTheme, setPaperTheme] = useState<PaperThemeOption>('white');
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(false);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);
  const [pageCount, setPageCount] = useState<number>(() => {
    const initialHtml = typeof initialDoc?.content === 'string' ? initialDoc.content : '';
    return calculateExactPageCount(
      initialHtml, 
      initialDoc?.pageSize || 'a4', 
      initialDoc?.orientation || 'portrait', 
      initialDoc?.marginOption || 'normal'
    );
  });
  const [editorHtml, setEditorHtml] = useState<string>(
    typeof initialDoc?.content === 'string' ? initialDoc.content : ''
  );
  const [editorText, setEditorText] = useState<string>('');
  const [activePage, setActivePage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showPageBreaks, setShowPageBreaks] = useState<boolean>(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState<boolean>(false);
  const [isCoWriterOpen, setIsCoWriterOpen] = useState<boolean>(false);
  const [shawnActivityFlash, setShawnActivityFlash] = useState<string | null>(null);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestTitleRef = useRef(initialDoc?.title || 'Untitled Document');
  const latestContentRef = useRef(typeof initialDoc?.content === 'string' ? initialDoc.content : '');
  const latestEditTimestampRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveSequenceRef = useRef(0);
  const dirtyRef = useRef(false);
  const hasMountedRef = useRef(false);

  // Firestore Document Loading & User Edit Guards:
  // Autosave must NEVER run automatically until:
  // 1) The document from Firestore has completely loaded into the editor
  // 2) Actual modifications have been made by the user
  // 3) The document is NOT a blank page of 0 words
  const baselineHtmlRef = useRef<string>('');
  const baselineTextRef = useRef<string>('');
  const isDocumentLoadedRef = useRef<boolean>(false);
  const hasUserEditedRef = useRef<boolean>(false);

  // Compute layout specs for dynamic display
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

  // Compute resolved initial content once on mount
  const initialContent = useMemo(() => {
    return resolveInitialEditorContent(initialDoc);
  }, [initialDoc]);

  // Initialize TipTap editor instance with the already-fetched document content
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
        underline: {},
      }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      DocumentFormatting,
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
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      HubMindPasteEngine,
    ],
    content: initialContent,
    editable: !isSharedView,
    onCreate: ({ editor }) => {
      // Document is mounted in ProseMirror
      const loadedHtml = editor.getHTML();
      const loadedText = editor.getText();
      baselineHtmlRef.current = loadedHtml;
      baselineTextRef.current = loadedText;

      // Allow TipTap / ProseMirror schemas and extensions to complete initial normalization
      setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          baselineHtmlRef.current = editor.getHTML();
          baselineTextRef.current = editor.getText();
        }
        isDocumentLoadedRef.current = true;
        hasMountedRef.current = true;
        dirtyRef.current = false;
        hasUserEditedRef.current = false;
        setSaveStatus('saved');
      }, 400);
    },
    onUpdate: ({ editor, transaction }) => {
      // 1. MUST wait for Firestore document content to be completely loaded and ready
      if (!isDocumentLoadedRef.current || !hasMountedRef.current) {
        return;
      }

      // 2. MUST be an actual document content change transaction
      if (!transaction || !transaction.docChanged) {
        return;
      }

      const htmlContent = editor.getHTML();
      const textContent = editor.getText();
      const wordCount = editor.storage.characterCount?.words() ?? 0;
      const textLength = textContent.trim().length;

      // 3. MUST NOT save if content has not actually changed from the loaded Firestore baseline
      if (htmlContent === baselineHtmlRef.current && textContent === baselineTextRef.current) {
        return;
      }

      // Recalculate page count
      const updatedPageCount = calculateExactPageCount(htmlContent, pageSize, orientation, marginOption);
      if (updatedPageCount !== pageCount) {
        setPageCount(updatedPageCount);
      }
      setEditorHtml(htmlContent);
      setEditorText(textContent);
      latestContentRef.current = htmlContent;

      // 4. STRICT USER DIRECTIVE: Never save a blank page of 0 words automatically!
      // If current document has 0 words or is empty, DO NOT schedule autosave!
      if (wordCount === 0 || textLength === 0 || isContentEffectivelyEmpty(htmlContent, editor.getJSON())) {
        console.log('[DocumentEditor] Autosave suppressed: blank document or 0 words.');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setSaveStatus('saved');
        return;
      }

      // Mark that genuine user edits have been made
      hasUserEditedRef.current = true;
      dirtyRef.current = true;

      const editNow = new Date().toISOString();
      setLastEditedTime(editNow);
      setSaveStatus('saving');
      latestEditTimestampRef.current = editNow;
      const jsonContent = editor.getJSON();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Autosave only after user has made real edits and document has > 0 words
      timeoutRef.current = setTimeout(() => {
        void saveDocument(htmlContent, editNow, undefined, jsonContent, false);
      }, 1000); // Autosave after 1s of inactivity
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!isSharedView);
    }
  }, [editor, isSharedView]);

  const saveLayoutSettings = async (
    nextPageSize: PaperSizeOption,
    nextOrientation: OrientationOption,
    nextMarginOption: MarginOption
  ) => {
    if (!docId) return;
    const now = new Date().toISOString();
    try {
      await saveDocumentOffline(
        docId,
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

  const saveDocument = async (
    content?: string,
    editTimestamp?: string,
    titleOverride?: string,
    contentJsonOverride?: any,
    forceSave = false
  ) => {
    if (!docId || isSharedView) return;

    // Guard 1: Must wait for Firestore to load the document before saving
    if (!isDocumentLoadedRef.current && !forceSave) {
      console.warn('[DocumentEditor] Autosave blocked: document is still loading from Firestore.');
      return;
    }

    // Guard 2: Never save automatically until there are changes being made
    if (!hasUserEditedRef.current && !dirtyRef.current && !forceSave) {
      return;
    }

    const htmlString = typeof content === 'string'
      ? content
      : (latestContentRef.current || (editor && !editor.isDestroyed ? editor.getHTML() : '') || '');

    const contentJson = contentJsonOverride ?? (editor && !editor.isDestroyed ? editor.getJSON() : undefined);

    const words = editor?.storage.characterCount?.words() ?? 0;
    const textLength = (editor ? editor.getText() : (typeof content === 'string' ? content : '')).trim().length;
    const isBlankOrZeroWords = isContentEffectivelyEmpty(htmlString, contentJson) || words === 0 || textLength === 0;

    // Guard 3: Strict user directive: never save a blank page of 0 words automatically!
    if (isBlankOrZeroWords && !forceSave) {
      console.log('[DocumentEditor] Autosave blocked: will never automatically save a blank page of 0 words.');
      setSaveStatus('saved');
      return;
    }

    // Guard 4: If blank and no user edits were made, block even if forceSave was called
    if (isBlankOrZeroWords && !hasUserEditedRef.current && !forceSave) {
      return;
    }

    const title = titleOverride !== undefined ? titleOverride : latestTitleRef.current;
    const actualEditTime = editTimestamp || latestEditTimestampRef.current || lastEditedTime || new Date().toISOString();
    const saveNow = new Date().toISOString();
    const sequence = ++saveSequenceRef.current;

    // Serialize writes so autosaves and manual saves cannot race each other
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        setSaveStatus('saving');

        const payload: Record<string, any> = {
          content: htmlString,
          ...(contentJson ? { contentJson } : {}),
          updatedAt: saveNow,
          lastEditedAt: actualEditTime,
          allowEmpty: forceSave && !isBlankOrZeroWords,
        };
        if (titleOverride !== undefined) {
          payload.title = title;
        }

        await saveDocumentOffline(
          docId,
          payload,
          profile || undefined
        );

        if (sequence === saveSequenceRef.current) {
          setLastSavedTime(saveNow);
          setSaveStatus('saved');
        }
      })
      .catch((error) => {
        console.error('Error saving document:', error);
        if (sequence === saveSequenceRef.current) setSaveStatus('error');
      });

    return saveChainRef.current;
  };

  const handleTitleChange = (newTitle: string) => {
    setDocMeta((prev: any) => prev ? { ...prev, title: newTitle } : prev);
    latestTitleRef.current = newTitle;
    const now = new Date().toISOString();
    setLastEditedTime(now);

    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(async () => {
      if (!docId || isSharedView) return;
      const finalTitle = newTitle.trim() || 'Untitled Document';
      try {
        setSaveStatus('saving');
        await saveDocumentOffline(
          docId,
          {
            title: finalTitle,
            lastEditedAt: now,
            updatedAt: new Date().toISOString(),
            allowUntitled: true,
          },
          profile || undefined
        );
        setLastSavedTime(new Date().toISOString());
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save document title:', err);
        setSaveStatus('error');
      }
    }, 400);
  };

  const handleManualSave = async () => {
    if (!editor || !docId || isSharedView) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const words = editor.storage.characterCount?.words() ?? 0;
    const textLength = editor.getText().trim().length;
    const html = editor.getHTML();
    const json = editor.getJSON();

    if ((words === 0 || textLength === 0 || isContentEffectivelyEmpty(html, json)) && !hasUserEditedRef.current) {
      console.log('[DocumentEditor] Manual save skipped: document has 0 words with no edits.');
      setSaveStatus('saved');
      return;
    }

    const now = new Date().toISOString();
    latestEditTimestampRef.current = now;
    setLastEditedTime(now);
    dirtyRef.current = true;
    hasUserEditedRef.current = true;
    await saveDocument(html, now, undefined, json, true);
  };

  // Keep the latest editor state available for all save paths and consumer modals
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const syncEditorSnapshot = () => {
      try {
        const html = editor.getHTML();
        latestContentRef.current = html;
        setEditorHtml(html);
        setEditorText(editor.getText());
      } catch (error) {
        console.warn('Editor snapshot unavailable before ProseMirror view mount:', error);
      }
    };
    syncEditorSnapshot();
    editor.on('transaction', syncEditorSnapshot);
    return () => {
      editor.off('transaction', syncEditorSnapshot);
    };
  }, [editor]);

  // Flush a pending debounce when the page is hidden or navigated away from
  useEffect(() => {
    const flushPendingSave = () => {
      if (isSharedView || !docId || !editor || editor.isDestroyed) return;
      if (!isDocumentLoadedRef.current) return;
      if (!dirtyRef.current || !hasUserEditedRef.current) return;

      const words = editor.storage.characterCount?.words() ?? 0;
      const textLength = editor.getText().trim().length;
      const html = editor.getHTML();
      const json = editor.getJSON();

      // STRICT USER RULE: Never flush/save a blank page of 0 words!
      if (words === 0 || textLength === 0 || isContentEffectivelyEmpty(html, json)) {
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      void saveDocument(html, new Date().toISOString(), undefined, json, false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingSave();
    };
    window.addEventListener('pagehide', flushPendingSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushPendingSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [editor, docId, isSharedView]);

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
          documentId: docId,
          documentTitle: docMeta?.title || 'Untitled Document',
        },
      })
    );
  };

  // Publish the active document to Shawn assistant for context grounding
  useEffect(() => {
    if (!docId) return;
    window.dispatchEvent(new CustomEvent('shawn:document_context', {
      detail: { documentId: docId, title: docMeta?.title || 'Current document' }
    }));
  }, [docId, docMeta?.title]);

  // Listen for real-time Shawn AI document modification events
  useEffect(() => {
    const handleLiveDocEdit = (e: any) => {
      const { action, text, html, title, documentId } = e.detail || {};
      if (documentId && documentId !== docId) return;
      if (!editor || editor.isDestroyed || !editor.commands) return;

      const now = new Date().toISOString();
      setLastEditedTime(now);

      if (action === 'insert_text' && text) {
        editor.commands.insertContent(text);
        setShawnActivityFlash('Shawn inserted text');
      } else if (action === 'append_content' && (html || text)) {
        const contentToAppend = html || `<p>${text}</p>`;
        editor.commands.insertContentAt(editor.state.doc.content.size, contentToAppend);
        setShawnActivityFlash('Shawn appended content');
      } else if (action === 'replace_all' && (html || text)) {
        const contentToSet = html || `<p>${text}</p>`;
        editor.commands.setContent(contentToSet);
        setShawnActivityFlash('Shawn updated document content');
      } else if (action === 'format_heading' && text) {
        editor.commands.setHeading({ level: 1 });
        editor.commands.insertContent(text);
        setShawnActivityFlash('Shawn formatted heading');
      }

      if (title && docMeta) {
        setDocMeta({ ...docMeta, title });
      }

      hasUserEditedRef.current = true;
      dirtyRef.current = true;
      const updatedHtml = editor.getHTML();
      void saveDocument(updatedHtml, now, undefined, editor.getJSON(), true);

      setTimeout(() => {
        setShawnActivityFlash(null);
      }, 4000);
    };

    window.addEventListener('shawn:live_document_edit', handleLiveDocEdit);
    return () => {
      window.removeEventListener('shawn:live_document_edit', handleLiveDocEdit);
    };
  }, [editor, docId, docMeta]);

  // Recalculate page count whenever layout settings change
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
      hasUserEditedRef.current = true;
      dirtyRef.current = true;
      void saveDocument(contentHtml, now, versionTitle || undefined, editor.getJSON(), true);
      if (versionTitle && docMeta) {
        setDocMeta({ ...docMeta, title: versionTitle });
      }
    } catch (err) {
      console.error('Error applying restored version', err);
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-slate-950 overflow-hidden font-sans"
      onKeyDown={() => {
        if (isDocumentLoadedRef.current) hasUserEditedRef.current = true;
      }}
      onPaste={() => {
        if (isDocumentLoadedRef.current) hasUserEditedRef.current = true;
      }}
      onDrop={() => {
        if (isDocumentLoadedRef.current) hasUserEditedRef.current = true;
      }}
    >
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
                value={docMeta?.title || ''}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="bg-transparent text-slate-100 font-bold focus:outline-none focus:border-b border-accent px-1 truncate w-full max-w-[125px] xs:max-w-[170px] sm:max-w-[240px] md:max-w-sm text-xs sm:text-sm md:text-base"
                placeholder="Untitled Document"
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
          <button
            onClick={async () => {
              if (!docId) return;
              const path = `/documents/${docId}?shared=1`;
              try { await copyShareUrl(path); } catch {}
              shareHubMindItem(path, docMeta?.title || 'Document');
            }}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-colors text-xs flex items-center gap-1.5 font-semibold"
            title="Share this document"
          >
            <span className="text-sm">↗</span><span className="hidden sm:inline">Share</span>
          </button>
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

          {!isSharedView && (
            <button
              onClick={handleManualSave}
              disabled={!editor || isSharedView}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-slate-950 text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
              title="Save document now"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Retry Save' : 'Save'}</span>
            </button>
          )}

          {/* Version History Button */}
          <button
            onClick={() => setIsVersionHistoryOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-300 border border-slate-700 transition-colors text-xs flex items-center gap-1.5 font-medium cursor-pointer"
            title="Open History"
          >
            <History className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden lg:inline">History</span>
          </button>

          {/* Ask Shawn to Edit Pill Button */}
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
          bodyHtml={editorHtml}
          textContent={editorText}
          pageSize={pageSize}
          orientation={orientation}
          marginOption={marginOption}
        />
      )}

      {/* Document Version History & Restore Modal */}
      {docId && editor && (
        <VersionHistoryModal
          isOpen={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          documentId={docId}
          documentTitle={docMeta?.title || 'Untitled Document'}
          currentContentHtml={editorHtml}
          onRestoreVersion={handleRestoreVersion}
          userProfile={profile || undefined}
        />
      )}

      {/* Shawn AI Co-Writer Live Dock */}
      {docId && editor && (
        <ShawnDocCoWriter
          editor={editor}
          docTitle={docMeta?.title || 'Untitled Document'}
          docId={docId}
          onSaveDocument={(content) => saveDocument(content, new Date().toISOString(), undefined, undefined, true)}
          isOpen={isCoWriterOpen}
          onToggleOpen={() => setIsCoWriterOpen(!isCoWriterOpen)}
        />
      )}
    </div>
  );
}

/**
 * Top-Level DocumentEditor Entry Point.
 * Correctly fetches document data from the database and handles asynchronous
 * document loading BEFORE rendering the TipTap editor instance.
 */
export function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    if (!id) {
      navigate('/documents');
      return;
    }

    const fetchDoc = async () => {
      try {
        const data = await getDocumentWithOfflineFallback(id);
        if (!isMounted) return;

        if (data) {
          setDocData(data);
          setLoading(false);
        } else {
          navigate('/documents');
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        if (isMounted) {
          navigate('/documents');
        }
      }
    };

    fetchDoc();

    return () => {
      isMounted = false;
    };
  }, [id, navigate]);

  if (loading || !docData || !id) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs sm:text-sm font-medium text-slate-400 select-none">Loading document...</p>
      </div>
    );
  }

  return (
    <DocumentEditorWorkspace
      key={docData.id || id}
      initialDoc={docData}
      docId={id}
    />
  );
}
