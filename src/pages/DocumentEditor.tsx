import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
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
import { OfficialLetterhead } from '../components/documents/OfficialLetterhead';
import { PaginatedPageContainer } from '../components/documents/PaginatedPageContainer';
import { FullPagePreviewModal } from '../components/documents/FullPagePreviewModal';
import { ShawnDocCoWriter } from '../components/documents/ShawnDocCoWriter';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { 
  ArrowLeft, Loader2, Save, Printer, Sun, Moon, 
  FileText, Layout, ChevronDown, CheckCircle2, SplitSquareVertical, Eye, Sparkles
} from 'lucide-react';

export type PageSizeOption = 'a4' | 'letter';
export type PaperThemeOption = 'white' | 'dark';

interface PageSizeConfig {
  name: string;
  dimensions: string;
  widthPx: number;
  heightPx: number;
}

export const PAGE_CONFIGS: Record<PageSizeOption, PageSizeConfig> = {
  a4: {
    name: 'A4',
    dimensions: '210 × 297 mm',
    widthPx: 794,
    heightPx: 1123,
  },
  letter: {
    name: 'US Letter',
    dimensions: '8.5 × 11 in',
    widthPx: 816,
    heightPx: 1056,
  },
};

export function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [docMeta, setDocMeta] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [paperTheme, setPaperTheme] = useState<PaperThemeOption>('white');
  const [pageCount, setPageCount] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showPageBreaks, setShowPageBreaks] = useState<boolean>(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isCoWriterOpen, setIsCoWriterOpen] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentConfig = PAGE_CONFIGS[pageSize];

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
      setSaveStatus('saving');
      const json = editor.getJSON();
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        saveDocument(json);
      }, 1500); // Autosave after 1.5 seconds of inactivity
    },
  });

  const saveDocument = async (content: any) => {
    if (!id) return;
    try {
      setSaveStatus('saving');
      await updateDoc(doc(db, 'documents', id), {
        content: JSON.stringify(content),
        updatedAt: new Date().toISOString()
      });
      setSaveStatus('saved');
    } catch (error) {
      console.error('Error saving document:', error);
      setSaveStatus('error');
    }
  };

  useEffect(() => {
    const fetchDoc = async () => {
      if (!id || !editor) return;
      try {
        const docRef = doc(db, 'documents', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDocMeta(data);
          if (data.content) {
            editor.commands.setContent(JSON.parse(data.content));
          }
        } else {
          // Document not found
          navigate('/documents');
        }
      } catch (error) {
        console.error('Error fetching document:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [id, editor, navigate]);

  const handlePrint = () => {
    setIsPreviewModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Generate visual page break offsets for multi-page document pagination
  const pageBreakOffsets: number[] = [];
  for (let i = 1; i < pageCount; i++) {
    pageBreakOffsets.push(i * currentConfig.heightPx);
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden font-sans">
      {/* Top Application Bar */}
      <div className="flex items-center justify-between p-2 md:p-3 border-b border-slate-800 bg-slate-950 shrink-0 print:hidden gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button 
            onClick={() => navigate('/documents')}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors shrink-0"
            title="Back to Documents"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-accent/20 rounded text-accent hidden sm:block shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <input 
                type="text" 
                value={docMeta?.title || 'Untitled Document'}
                onChange={(e) => {
                  setDocMeta({ ...docMeta, title: e.target.value });
                  updateDoc(doc(db, 'documents', id!), { title: e.target.value });
                }}
                className="bg-transparent text-slate-100 font-bold focus:outline-none focus:border-b border-accent px-1 truncate w-40 sm:w-64 md:w-80 text-sm sm:text-base"
                placeholder="Document Title"
              />
            </div>
          </div>
        </div>
        
        {/* Quick Top Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Ask Shawn Co-Writer Button */}
          <button
            onClick={() => setIsCoWriterOpen(!isCoWriterOpen)}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-linear-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/50 text-teal-300 hover:text-white hover:bg-teal-500/30 transition-all text-xs flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
            title="Ask Shawn to write or edit this document"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span className="hidden sm:inline">Shawn Co-Writer</span>
          </button>

          {/* Full Page Print Preview Button */}
          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors text-xs flex items-center gap-1.5 font-medium border border-slate-700 cursor-pointer"
            title="Open Full Page Print & PDF Preview"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Full Preview / PDF</span>
          </button>

          {/* Paper Theme Quick Switcher */}
          <button
            onClick={() => setPaperTheme(prev => prev === 'white' ? 'dark' : 'white')}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
            title={`Switch to ${paperTheme === 'white' ? 'Dark Sheet' : 'White Print Paper'}`}
          >
            {paperTheme === 'white' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline font-medium">White Paper</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline font-medium">Dark Paper</span>
              </>
            )}
          </button>

          {/* Export & Cloud Menu */}
          <ImportExportMenu 
            editor={editor} 
            docTitle={docMeta?.title || 'Untitled Document'} 
            onOpenPreview={() => setIsPreviewModalOpen(true)}
          />

          {/* Cloud Sync Status */}
          <div className="text-xs text-slate-500 hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800">
            {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-accent" /> Saving...</>}
            {saveStatus === 'saved' && <><Save className="w-3 h-3 text-emerald-400" /> Saved</>}
            {saveStatus === 'error' && <span className="text-red-400">Save failed</span>}
          </div>
        </div>
      </div>

      {/* Modern Office Ribbon Navigation Bar */}
      {editor && (
        <DocumentRibbon
          editor={editor}
          docTitle={docMeta?.title || 'Untitled Document'}
          pageSize={pageSize}
          setPageSize={setPageSize}
          paperTheme={paperTheme}
          setPaperTheme={setPaperTheme}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          showPageBreaks={showPageBreaks}
          setShowPageBreaks={setShowPageBreaks}
          pageCount={pageCount}
          activePage={activePage}
          onOpenPreview={() => setIsPreviewModalOpen(true)}
        />
      )}

      {/* Main Workspace Stage */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden print:bg-white print:overflow-visible">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex justify-center bg-slate-950 print:p-0 print:bg-white print:overflow-visible scrollbar-thin scrollbar-thumb-slate-800">
          <PaginatedPageContainer
            editor={editor}
            pageSize={pageSize}
            paperTheme={paperTheme}
            zoomLevel={zoomLevel}
            showPageBreaks={showPageBreaks}
            pageCount={pageCount}
            activePage={activePage}
            onPageCountChange={setPageCount}
            onActivePageChange={setActivePage}
          />
        </div>
      </div>
      
      {/* Bottom Status & Pagination Footer Bar */}
      <div className="h-8 border-t border-slate-800 bg-slate-950 flex items-center justify-between px-4 text-[11px] text-slate-400 tracking-normal shrink-0 print:hidden select-none">
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Dynamic Page Count Badge */}
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            <span>
              Page <strong className="text-accent font-mono">{activePage}</strong> of <strong className="text-white font-mono">{pageCount}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="uppercase text-slate-400 font-mono text-[10px]">
              {currentConfig.name} ({currentConfig.dimensions})
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-slate-400">
            <span>{editor?.storage.characterCount?.words() || 0} words</span>
            <span>•</span>
            <span>{editor?.storage.characterCount?.characters() || 0} characters</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-400">
          <span className="hidden sm:inline font-medium text-slate-300">Jaystarbliss Dynamic Institute</span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400">{saveStatus === 'saving' ? 'Autosaving...' : 'All changes saved'}</span>
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
        />
      )}

      {/* Shawn AI Co-Writer Live Dock */}
      {id && editor && (
        <ShawnDocCoWriter
          editor={editor}
          docTitle={docMeta?.title || 'Untitled Document'}
          docId={id}
          onSaveDocument={saveDocument}
          isOpen={isCoWriterOpen}
          onToggleOpen={() => setIsCoWriterOpen(!isCoWriterOpen)}
        />
      )}
    </div>
  );
}

