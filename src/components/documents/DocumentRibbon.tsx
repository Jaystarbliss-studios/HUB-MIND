import React, { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Underline, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Quote, Minus,
  Undo, Redo, Table as TableIcon, Image as ImageIcon, Link as LinkIcon,
  Subscript, Superscript, Eraser, Baseline,
  FileText, Layout as LayoutIcon, Eye, CheckCircle2,
  Printer, Download, Upload, Copy, Scissors, ClipboardPaste,
  Search, ZoomIn, ZoomOut, Maximize2, SplitSquareVertical,
  Plus, Trash2, Columns, Rows, Pin, PinOff, ChevronUp, ChevronDown,
  History, Clock
} from 'lucide-react';
import { ImportExportMenu } from './ImportExportMenu';
import { PaperSizeOption, OrientationOption, MarginOption, PaperThemeOption } from '../../lib/paginationEngine';

export type RibbonTab = 'home' | 'insert' | 'layout' | 'review' | 'view' | 'file';

interface DocumentRibbonProps {
  editor: Editor;
  docTitle: string;
  pageSize: PaperSizeOption;
  setPageSize: (size: PaperSizeOption) => void;
  orientation: OrientationOption;
  setOrientation: (o: OrientationOption) => void;
  marginOption: MarginOption;
  setMarginOption: (m: MarginOption) => void;
  paperTheme: PaperThemeOption;
  setPaperTheme: React.Dispatch<React.SetStateAction<PaperThemeOption>>;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  showPageBreaks: boolean;
  setShowPageBreaks: React.Dispatch<React.SetStateAction<boolean>>;
  showMarginGuides: boolean;
  setShowMarginGuides: React.Dispatch<React.SetStateAction<boolean>>;
  showDebugInfo: boolean;
  setShowDebugInfo: React.Dispatch<React.SetStateAction<boolean>>;
  pageCount: number;
  activePage?: number;
  onOpenPreview?: () => void;
  onOpenVersionHistory?: () => void;
  onInsertPageBreak?: () => void;
  onAutoPaginate?: () => void;
  isApproachingBoundary?: boolean;
  docHeightPx?: number;
}

export function DocumentRibbon({
  editor,
  docTitle,
  pageSize,
  setPageSize,
  orientation,
  setOrientation,
  marginOption,
  setMarginOption,
  paperTheme,
  setPaperTheme,
  zoomLevel,
  setZoomLevel,
  showPageBreaks,
  setShowPageBreaks,
  showMarginGuides,
  setShowMarginGuides,
  showDebugInfo,
  setShowDebugInfo,
  pageCount,
  activePage = 1,
  onOpenPreview,
  onOpenVersionHistory,
  onInsertPageBreak,
  onAutoPaginate,
  isApproachingBoundary,
  docHeightPx,
}: DocumentRibbonProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    const saved = localStorage.getItem('hubmind_ribbon_pinned');
    return saved !== null ? saved === 'true' : true;
  });
  const [isTemporarilyOpen, setIsTemporarilyOpen] = useState<boolean>(false);
  const [, setSelectionTick] = useState(0);

  const [promptState, setPromptState] = useState<{ type: 'image' | 'link' | null; defaultVal: string }>({
    type: null,
    defaultVal: ''
  });
  const [findText, setFindText] = useState('');
  const [showFindBar, setShowFindBar] = useState(false);

  // Table Drawer / Popover State
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [gridHover, setGridHover] = useState<{ rows: number; cols: number }>({ rows: 3, cols: 3 });
  const [customTableRows, setCustomTableRows] = useState<number>(3);
  const [customTableCols, setCustomTableCols] = useState<number>(3);
  const [customTableWithHeader, setCustomTableWithHeader] = useState<boolean>(true);

  // Re-render ribbon on every selection update or transaction so active tool highlights match Microsoft Word precisely
  useEffect(() => {
    if (!editor) return;
    const forceUpdate = () => setSelectionTick((t) => (t + 1) % 10000);
    editor.on('selectionUpdate', forceUpdate);
    editor.on('transaction', forceUpdate);
    return () => {
      editor.off('selectionUpdate', forceUpdate);
      editor.off('transaction', forceUpdate);
    };
  }, [editor]);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      localStorage.setItem('hubmind_ribbon_pinned', String(next));
      if (!next) {
        setIsTemporarilyOpen(false);
      }
      return next;
    });
  };

  const handleTabClick = (tab: RibbonTab) => {
    if (activeTab === tab && !isPinned) {
      setIsTemporarilyOpen((prev) => !prev);
    } else {
      setActiveTab(tab);
      if (!isPinned) {
        setIsTemporarilyOpen(true);
      }
    }
  };

  const isStripVisible = isPinned || isTemporarilyOpen;

  if (!editor) return null;

  const addImage = () => {
    setPromptState({ type: 'image', defaultVal: '' });
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setPromptState({ type: 'link', defaultVal: previousUrl });
  };

  const handlePromptSubmit = (val: string) => {
    if (promptState.type === 'image') {
      if (val) editor.chain().focus().setImage({ src: val }).run();
    } else if (promptState.type === 'link') {
      if (val === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else if (val !== null) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: val }).run();
      }
    }
    setPromptState({ type: null, defaultVal: '' });
  };

  const insertTable = () => {
    setIsTableMenuOpen(prev => !prev);
  };

  const handleInsertGridTable = (rows: number, cols: number, withHeader: boolean = true) => {
    editor.chain().focus().insertTable({ rows: Math.max(1, rows), cols: Math.max(1, cols), withHeaderRow: withHeader }).run();
    setIsTableMenuOpen(false);
  };

  const handleInsertCustomTable = () => {
    handleInsertGridTable(customTableRows, customTableCols, customTableWithHeader);
  };

  const handleInsertTemplateTable = (type: 'fees' | 'roster' | 'comparison' | 'matrix') => {
    if (type === 'fees') {
      const html = `<table><thead><tr><th><p>Course Module</p></th><th><p>Duration</p></th><th><p>Certifications</p></th><th><p>Tuition Fee (NGN / USD)</p></th></tr></thead><tbody><tr><td><p>Executive Leadership & Management</p></td><td><p>6 Weeks</p></td><td><p>Professional Diploma</p></td><td><p>₦150,000 / $250</p></td></tr><tr><td><p>Full-Stack Web & AI Engineering</p></td><td><p>12 Weeks</p></td><td><p>Certified Specialist</p></td><td><p>₦280,000 / $450</p></td></tr><tr><td><p>Data Analytics & Business Intelligence</p></td><td><p>8 Weeks</p></td><td><p>Associate Certificate</p></td><td><p>₦180,000 / $300</p></td></tr></tbody></table>`;
      editor.chain().focus().insertContent(html).run();
    } else if (type === 'roster') {
      const html = `<table><thead><tr><th><p>Student ID</p></th><th><p>Full Name</p></th><th><p>Department</p></th><th><p>Status</p></th><th><p>Grade Avg</p></th></tr></thead><tbody><tr><td><p>JDI-2026-001</p></td><td><p>Adeyemi Johnson</p></td><td><p>Computer Science</p></td><td><p>Enrolled</p></td><td><p>A (4.8)</p></td></tr><tr><td><p>JDI-2026-002</p></td><td><p>Blessing Chinedu</p></td><td><p>Business Admin</p></td><td><p>Active</p></td><td><p>A- (4.5)</p></td></tr><tr><td><p>JDI-2026-003</p></td><td><p>Faruq Abubakar</p></td><td><p>Data Science</p></td><td><p>Active</p></td><td><p>B+ (4.2)</p></td></tr></tbody></table>`;
      editor.chain().focus().insertContent(html).run();
    } else if (type === 'comparison') {
      const html = `<table><thead><tr><th><p>Key Dimension</p></th><th><p>Current Framework</p></th><th><p>Jaystarbliss Proposed</p></th></tr></thead><tbody><tr><td><p>Curriculum Architecture</p></td><td><p>Traditional lecture-based</p></td><td><p>AI-Integrated project sprints</p></td></tr><tr><td><p>Practical Mastery</p></td><td><p>Theoretical evaluations</p></td><td><p>Live industrial capstones</p></td></tr><tr><td><p>Industry Certification</p></td><td><p>Internal diploma only</p></td><td><p>Global dual credentialing</p></td></tr></tbody></table>`;
      editor.chain().focus().insertContent(html).run();
    } else {
      handleInsertGridTable(3, 3, true);
    }
    setIsTableMenuOpen(false);
  };

  const fontFamilies = [
    { label: 'Inter (Clean)', value: 'Inter, sans-serif' },
    { label: 'Arial (Standard)', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Georgia (Editorial)', value: 'Georgia, serif' },
    { label: 'Courier New (Mono)', value: '"Courier New", Courier, monospace' },
  ];

  const fontSizes = ['11px', '12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px'];

  const handleCopy = () => {
    document.execCommand('copy');
  };

  const handleCut = () => {
    document.execCommand('cut');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        editor.chain().focus().insertContent(text).run();
      }
    } catch (e) {
      editor.chain().focus().run();
    }
  };

  // Helper for active button classes with Word-style highlight
  const getToolClass = (isActive: boolean) =>
    isActive
      ? 'p-1.5 rounded-lg bg-teal-500/25 text-teal-300 ring-1 ring-teal-400/50 shadow-inner font-bold transition-all'
      : 'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors';

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200 select-none shrink-0 print:hidden shadow-md transition-all duration-200">
      {/* Top Ribbon Navigation Tabs */}
      <div className="flex items-center gap-0.5 px-3 pt-1 border-b border-slate-800/80 bg-slate-950 overflow-x-auto scrollbar-none text-xs">
        <button
          onClick={() => handleTabClick('file')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'file'
              ? 'bg-accent text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>File</span>
        </button>

        <button
          onClick={() => handleTabClick('home')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors cursor-pointer ${
            activeTab === 'home'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Home
        </button>

        <button
          onClick={() => handleTabClick('insert')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors cursor-pointer ${
            activeTab === 'insert'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Insert
        </button>

        <button
          onClick={() => handleTabClick('layout')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors cursor-pointer ${
            activeTab === 'layout'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Layout
        </button>

        <button
          onClick={() => handleTabClick('review')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors cursor-pointer ${
            activeTab === 'review'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Review
        </button>

        <button
          onClick={() => handleTabClick('view')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors cursor-pointer ${
            activeTab === 'view'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          View
        </button>

        {/* Ribbon Pin & Collapse Controls + Page Counter */}
        <div className="ml-auto flex items-center gap-2 pl-3 py-1 shrink-0">
          {/* Pagination Counter Badge */}
          <div 
            className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs shadow-xs hover:border-slate-700 transition-colors"
            title={`Real-Time Document Pagination: Page ${activePage} of ${pageCount} (${pageSize.toUpperCase()})`}
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              <span className="text-slate-400">Page</span>
              <span className="text-accent font-mono font-bold">{activePage}</span>
              <span className="text-slate-500">/</span>
              <span className="text-white font-mono font-bold">{pageCount}</span>
            </div>
          </div>

          {/* Microsoft Word Ribbon Pin / Collapse Button */}
          <button
            onClick={togglePin}
            className={`p-1.5 rounded-lg border transition-all text-xs flex items-center gap-1 cursor-pointer ${
              isPinned
                ? 'bg-slate-800 border-slate-700 text-teal-400 hover:text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title={isPinned ? 'Collapse Ribbon (Show Tabs Only)' : 'Pin Ribbon (Always Show Tools)'}
          >
            {isPinned ? (
              <>
                <Pin className="w-3.5 h-3.5 fill-teal-400" />
                <span className="hidden md:inline text-[11px] font-medium">Pinned</span>
                <ChevronUp className="w-3 h-3 text-slate-400 ml-0.5" />
              </>
            ) : (
              <>
                <PinOff className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline text-[11px] font-medium">Auto-Hide</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Ribbon Command Strip (Slide down / collapse based on isStripVisible) */}
      {isStripVisible && (
        <div className="p-2 overflow-x-auto whitespace-nowrap flex items-center gap-3 min-h-[58px] animate-in fade-in slide-in-from-top-1 duration-150">
          {/* TAB 1: FILE */}
          {activeTab === 'file' && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 pr-3 border-r border-slate-800">
                <button
                  onClick={() => onOpenPreview ? onOpenPreview() : window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  title="Print or Save as PDF"
                >
                  <Printer className="w-4 h-4 text-cyan-400" />
                  <span>Full Preview / PDF</span>
                </button>

                {onOpenVersionHistory && (
                  <button
                    onClick={onOpenVersionHistory}
                    className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
                    title="View, compare, and restore previous document versions"
                  >
                    <History className="w-4 h-4 text-teal-400" />
                    <span>Version History</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Export & Cloud:</span>
                <ImportExportMenu editor={editor} docTitle={docTitle} onOpenPreview={onOpenPreview} />
              </div>
            </div>
          )}

          {/* TAB 2: HOME */}
          {activeTab === 'home' && (
            <div className="flex items-center gap-2 text-xs">
              {/* Clipboard Group */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
                <button
                  onClick={handlePaste}
                  className="p-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  title="Smart Paste with Clean Formatting (Ctrl+V)"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px]">Paste</span>
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={handleCut}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Cut (Ctrl+X)"
                  >
                    <Scissors className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Copy (Ctrl+C)"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Undo / Redo */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-800">
                <button
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Font Family & Size */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
                <select
                  onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                  value={editor.getAttributes('textStyle').fontFamily || fontFamilies[0].value}
                  className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none w-32 cursor-pointer"
                >
                  {fontFamilies.map((font) => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>

                <select
                  onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
                  value={editor.getAttributes('textStyle').fontSize || '16px'}
                  className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none w-16 cursor-pointer"
                >
                  {fontSizes.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              {/* Font Style Formatting with Word-Style Active Reflection */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-800">
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`${getToolClass(editor.isActive('bold'))} cursor-pointer`}
                  title={`Bold (Ctrl+B) ${editor.isActive('bold') ? '• [Active]' : ''}`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`${getToolClass(editor.isActive('italic'))} cursor-pointer`}
                  title={`Italic (Ctrl+I) ${editor.isActive('italic') ? '• [Active]' : ''}`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={`${getToolClass(editor.isActive('underline'))} cursor-pointer`}
                  title={`Underline (Ctrl+U) ${editor.isActive('underline') ? '• [Active]' : ''}`}
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={`${getToolClass(editor.isActive('strike'))} cursor-pointer`}
                  title={`Strikethrough ${editor.isActive('strike') ? '• [Active]' : ''}`}
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleSubscript().run()}
                  className={`${getToolClass(editor.isActive('subscript'))} cursor-pointer`}
                  title={`Subscript ${editor.isActive('subscript') ? '• [Active]' : ''}`}
                >
                  <Subscript className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleSuperscript().run()}
                  className={`${getToolClass(editor.isActive('superscript'))} cursor-pointer`}
                  title={`Superscript ${editor.isActive('superscript') ? '• [Active]' : ''}`}
                >
                  <Superscript className="w-3.5 h-3.5" />
                </button>

                {/* Text Color Picker */}
                <div className={`relative group p-1 rounded-lg ${editor.getAttributes('textStyle').color ? 'bg-teal-500/10 ring-1 ring-teal-400/30' : ''}`}>
                  <Baseline className="w-3.5 h-3.5 text-slate-400 group-hover:text-white cursor-pointer" />
                  <input
                    type="color"
                    onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
                    value={editor.getAttributes('textStyle').color || '#000000'}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Font Color"
                  />
                </div>

                {/* Highlight Picker */}
                <div className={`relative group p-1 rounded-lg ${editor.isActive('highlight') ? 'bg-yellow-400/20 ring-1 ring-yellow-400/50' : ''}`}>
                  <Highlighter className={`w-3.5 h-3.5 cursor-pointer ${editor.isActive('highlight') ? 'text-yellow-400' : 'text-slate-400 group-hover:text-amber-400'}`} />
                  <input
                    type="color"
                    onInput={(e) => editor.chain().focus().toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()}
                    value={editor.getAttributes('highlight').color || '#ffff00'}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Text Highlight"
                  />
                </div>

                <button
                  onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Clear Formatting"
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Paragraph Alignments with Word-Style Active Reflection */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-800">
                <button
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  className={`${getToolClass(editor.isActive({ textAlign: 'left' }))} cursor-pointer`}
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  className={`${getToolClass(editor.isActive({ textAlign: 'center' }))} cursor-pointer`}
                  title="Align Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  className={`${getToolClass(editor.isActive({ textAlign: 'right' }))} cursor-pointer`}
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                  className={`${getToolClass(editor.isActive({ textAlign: 'justify' }))} cursor-pointer`}
                  title="Justify"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lists & Quotes with Active Reflection */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-800">
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`${getToolClass(editor.isActive('bulletList'))} cursor-pointer`}
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`${getToolClass(editor.isActive('orderedList'))} cursor-pointer`}
                  title="Numbered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  className={`${getToolClass(editor.isActive('taskList'))} cursor-pointer`}
                  title="Task Checklist"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className={`${getToolClass(editor.isActive('blockquote'))} cursor-pointer`}
                  title="Blockquote"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Heading Style Presets with Word-Style Active Reflection */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => editor.chain().focus().setParagraph().run()}
                  className={`px-2.5 py-1 rounded text-xs border cursor-pointer transition-all ${
                    editor.isActive('paragraph') && !editor.isActive('heading')
                      ? 'border-teal-400 bg-teal-500/20 text-teal-300 font-bold ring-1 ring-teal-400/40'
                      : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={`px-2.5 py-1 rounded text-xs border font-bold cursor-pointer transition-all ${
                    editor.isActive('heading', { level: 1 })
                      ? 'border-teal-400 bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40'
                      : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Heading 1
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`px-2.5 py-1 rounded text-xs border font-semibold cursor-pointer transition-all ${
                    editor.isActive('heading', { level: 2 })
                      ? 'border-teal-400 bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40'
                      : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Heading 2
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`px-2.5 py-1 rounded text-xs border cursor-pointer transition-all ${
                    editor.isActive('heading', { level: 3 })
                      ? 'border-teal-400 bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40'
                      : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Heading 3
                </button>
              </div>
            </div>
          )}

        {/* TAB 3: INSERT */}
        {activeTab === 'insert' && (
          <div className="flex items-center gap-3 text-xs relative">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
              {/* Interactive Table Insert / Draw Button & Popover */}
              <div className="relative">
                <button
                  onClick={insertTable}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isTableMenuOpen || editor.isActive('table')
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Draw or Insert Table"
                >
                  <TableIcon className="w-3.5 h-3.5 text-teal-400" />
                  <span>Table</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                </button>

                {/* Table Draw / Insert Dropdown */}
                {isTableMenuOpen && (
                  <div 
                    className="absolute top-full left-0 mt-2 z-50 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 select-none text-slate-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
                      <span className="font-bold text-xs text-teal-300 flex items-center gap-1.5">
                        <TableIcon className="w-3.5 h-3.5" />
                        Draw Table
                      </span>
                      <span className="text-[11px] font-mono font-bold text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {gridHover.cols} × {gridHover.rows} Table
                      </span>
                    </div>

                    {/* Interactive 8x8 Visual Grid Selector */}
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 mb-3 flex flex-col gap-1 items-center">
                      {Array.from({ length: 8 }).map((_, rIdx) => {
                        const rowNum = rIdx + 1;
                        return (
                          <div key={`grid-row-${rowNum}`} className="flex gap-1">
                            {Array.from({ length: 8 }).map((_, cIdx) => {
                              const colNum = cIdx + 1;
                              const isHovered = rowNum <= gridHover.rows && colNum <= gridHover.cols;
                              return (
                                <button
                                  key={`cell-${rowNum}-${colNum}`}
                                  type="button"
                                  onMouseEnter={() => setGridHover({ rows: rowNum, cols: colNum })}
                                  onClick={() => handleInsertGridTable(rowNum, colNum, true)}
                                  className={`w-5 h-5 rounded-xs transition-colors border ${
                                    isHovered
                                      ? 'bg-teal-500/50 border-teal-400 shadow-xs'
                                      : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
                                  }`}
                                  title={`Insert ${colNum} × ${rowNum} Table`}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Templates */}
                    <div className="mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Quick Layout Templates
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleInsertTemplateTable('fees')}
                          className="text-left px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-teal-300 truncate transition-colors"
                        >
                          📋 Fee Schedule (4 Col)
                        </button>
                        <button
                          onClick={() => handleInsertTemplateTable('roster')}
                          className="text-left px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-teal-300 truncate transition-colors"
                        >
                          👥 Student Roster (5 Col)
                        </button>
                        <button
                          onClick={() => handleInsertTemplateTable('comparison')}
                          className="text-left px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-teal-300 truncate transition-colors"
                        >
                          ⚖️ Comparison Matrix
                        </button>
                        <button
                          onClick={() => handleInsertTemplateTable('matrix')}
                          className="text-left px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-teal-300 truncate transition-colors"
                        >
                          📐 Standard 3 × 3 Grid
                        </button>
                      </div>
                    </div>

                    {/* Custom Dimension Form */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400">Cols:</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={customTableCols}
                          onChange={(e) => setCustomTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-10 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white"
                        />
                        <span className="text-slate-400 ml-1">Rows:</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={customTableRows}
                          onChange={(e) => setCustomTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-10 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white"
                        />
                      </div>
                      <button
                        onClick={handleInsertCustomTable}
                        className="px-2.5 py-1 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors shrink-0"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={addImage}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
                title="Insert Image (URL or Paste Screenshot)"
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Image</span>
              </button>
              <button
                onClick={setLink}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  editor.isActive('link') ? 'bg-accent text-slate-950 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="Insert / Edit Hyperlink"
              >
                <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Link</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
              <button
                onClick={() => {
                  if (onInsertPageBreak) {
                    onInsertPageBreak();
                  } else if (editor?.commands?.setPageBreak) {
                    editor.commands.setPageBreak('hard');
                  } else {
                    editor?.chain().focus().setHorizontalRule().run();
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
                title="Insert Page Break (Ctrl+Enter / Mod+Enter)"
              >
                <SplitSquareVertical className="w-3.5 h-3.5 text-accent" />
                <span>Page Break</span>
              </button>
              {onAutoPaginate && (
                <button
                  onClick={onAutoPaginate}
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors text-xs ${
                    isApproachingBoundary
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                  title="Auto Paginate: Inserts soft page breaks when content approaches A4 boundaries"
                >
                  <SplitSquareVertical className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Auto Paginate (A4)</span>
                </button>
              )}
              <button
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
                title="Horizontal Dividing Line"
              >
                <Minus className="w-3.5 h-3.5 text-slate-400" />
                <span>Divider</span>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  editor.isActive('codeBlock') ? 'bg-accent text-slate-950 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="Code Block"
              >
                <span className="font-mono text-xs font-bold text-amber-400">&lt;/&gt;</span>
                <span>Code Block</span>
              </button>
            </div>

            {/* Table Dynamic Tools when cursor is in table */}
            {editor.isActive('table') && (
              <div className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 rounded-lg px-2 py-1">
                <span className="text-[11px] font-bold text-teal-300 pr-1 flex items-center gap-1">
                  <TableIcon className="w-3 h-3 text-teal-400" />
                  Table:
                </span>
                <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200" title="Add Column Left">+Col Left</button>
                <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200" title="Add Column Right">+Col Right</button>
                <button onClick={() => editor.chain().focus().deleteColumn().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-red-300" title="Delete Column">-Col</button>
                <button onClick={() => editor.chain().focus().addRowBefore().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200" title="Add Row Above">+Row Above</button>
                <button onClick={() => editor.chain().focus().addRowAfter().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200" title="Add Row Below">+Row Below</button>
                <button onClick={() => editor.chain().focus().deleteRow().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-red-300" title="Delete Row">-Row</button>
                <button onClick={() => editor.chain().focus().mergeCells().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-teal-300 font-semibold" title="Merge Selected Cells">Merge</button>
                <button onClick={() => editor.chain().focus().splitCell().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-teal-300 font-semibold" title="Split Cell">Split</button>
                <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300 font-medium" title="Toggle Header Row">H-Row</button>
                <button onClick={() => editor.chain().focus().deleteTable().run()} className="p-1 rounded bg-red-950/70 hover:bg-red-900 border border-red-800 text-[10px] text-red-300 font-semibold" title="Delete Table">Delete Table</button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LAYOUT */}
        {activeTab === 'layout' && (
          <div className="flex items-center gap-3 text-xs overflow-x-auto py-1 scrollbar-none">
            {/* Paper Size Selector */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Size:</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setPageSize('a4')}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    pageSize === 'a4' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="A4 (210 × 297 mm)"
                >
                  A4
                </button>
                <button
                  onClick={() => setPageSize('letter')}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    pageSize === 'letter' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="US Letter (8.5 × 11 in)"
                >
                  Letter
                </button>
                <button
                  onClick={() => setPageSize('legal')}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    pageSize === 'legal' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="US Legal (8.5 × 14 in)"
                >
                  Legal
                </button>
              </div>
            </div>

            {/* Orientation Selector */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Orientation:</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setOrientation('portrait')}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    orientation === 'portrait' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Portrait (Vertical)"
                >
                  Portrait
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    orientation === 'landscape' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Landscape (Horizontal)"
                >
                  Landscape
                </button>
              </div>
            </div>

            {/* Margin System Selector */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Margins:</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setMarginOption('normal')}
                  className={`px-2 py-1 rounded transition-colors font-medium ${
                    marginOption === 'normal' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Normal: 20mm (All sides)"
                >
                  Normal
                </button>
                <button
                  onClick={() => setMarginOption('narrow')}
                  className={`px-2 py-1 rounded transition-colors font-medium ${
                    marginOption === 'narrow' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Narrow: 12.7mm (0.5 in)"
                >
                  Narrow
                </button>
                <button
                  onClick={() => setMarginOption('moderate')}
                  className={`px-2 py-1 rounded transition-colors font-medium ${
                    marginOption === 'moderate' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Moderate: Top/Bottom 25.4mm, Left/Right 19mm"
                >
                  Moderate
                </button>
                <button
                  onClick={() => setMarginOption('wide')}
                  className={`px-2 py-1 rounded transition-colors font-medium ${
                    marginOption === 'wide' ? 'bg-accent text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Wide: Top/Bottom 25.4mm, Left/Right 50.8mm"
                >
                  Wide
                </button>
              </div>
            </div>

            {/* Paper Theme (White vs Dark) */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Theme:</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setPaperTheme('white')}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    paperTheme === 'white' ? 'bg-white text-slate-950 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  White Paper
                </button>
                <button
                  onClick={() => setPaperTheme('dark')}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    paperTheme === 'dark' ? 'bg-slate-950 text-cyan-400 border border-slate-700 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Dark Sheet
                </button>
              </div>
            </div>

            {/* Margin Guides, Page Breaks, and Debug Inspector Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowMarginGuides(!showMarginGuides)}
                className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showMarginGuides
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 font-semibold'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Toggle visual margin guide boundaries on paper"
              >
                <span>Guides: {showMarginGuides ? 'On' : 'Off'}</span>
              </button>

              <button
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showDebugInfo
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 font-semibold'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Toggle real-time physical pagination metrics & inspector"
              >
                <span>Inspector: {showDebugInfo ? 'On' : 'Off'}</span>
              </button>

              <button
                onClick={() => {
                  if (onInsertPageBreak) {
                    onInsertPageBreak();
                  } else if (editor?.commands?.setPageBreak) {
                    editor.commands.setPageBreak('hard');
                  } else {
                    editor?.chain().focus().setHorizontalRule().run();
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                title="Insert explicit page break (Ctrl+Enter / Mod+Enter)"
              >
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>Page Break</span>
              </button>

              {onAutoPaginate && (
                <button
                  onClick={onAutoPaginate}
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                    isApproachingBoundary
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                  title="Auto Paginate: Inserts soft page breaks when content approaches A4 boundaries"
                >
                  <SplitSquareVertical className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Auto Paginate (A4)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: REVIEW */}
        {activeTab === 'review' && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-4 pr-4 border-r border-slate-800">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Pages</span>
                <span className="text-sm font-bold text-slate-200">{pageCount} {pageCount === 1 ? 'Page' : 'Pages'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Doc Height</span>
                <span className="text-sm font-bold text-cyan-300 font-mono">{docHeightPx ? `${docHeightPx}px` : 'Dynamic'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Word Count</span>
                <span className="text-sm font-bold text-accent">{editor.storage.characterCount?.words() || 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Characters</span>
                <span className="text-sm font-bold text-slate-200">{editor.storage.characterCount?.characters() || 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Est. Read Time</span>
                <span className="text-sm font-bold text-slate-200">
                  {Math.max(1, Math.ceil((editor.storage.characterCount?.words() || 0) / 200))} min
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenVersionHistory && (
                <button
                  onClick={onOpenVersionHistory}
                  className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
                  title="View and restore previous document versions"
                >
                  <History className="w-3.5 h-3.5 text-teal-400" />
                  <span>Version History</span>
                </button>
              )}
              <button
                onClick={() => editor.chain().focus().selectAll().run()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select All</span>
              </button>
              <button
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5 text-amber-400" />
                <span>Clean All Styles</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: VIEW */}
        {activeTab === 'view' && (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Zoom:</span>
              <button
                onClick={() => setZoomLevel((prev) => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10))}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs font-bold text-accent min-w-[40px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((prev) => Math.min(1.6, Math.round((prev + 0.1) * 10) / 10))}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1.0)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                title="Reset Zoom to 100%"
              >
                100%
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (onOpenPreview) {
                    onOpenPreview();
                  } else {
                    window.print();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Full Page Print & PDF Preview</span>
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Modal prompt for Link and Image insertion */}
      {promptState.type && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-150">
            <h3 className="text-sm font-bold text-slate-100 mb-2 capitalize">
              Insert {promptState.type}
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              {promptState.type === 'image' 
                ? 'Enter the image URL or paste an image directly from your clipboard anywhere into the document.' 
                : 'Enter the destination web URL (https://...):'}
            </p>
            <input
              type="text"
              defaultValue={promptState.defaultVal}
              id="prompt-input-field"
              placeholder={promptState.type === 'image' ? 'https://example.com/image.png' : 'https://example.com'}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 mb-4 focus:outline-none focus:border-accent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePromptSubmit((e.target as HTMLInputElement).value);
                }
              }}
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setPromptState({ type: null, defaultVal: '' })}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('prompt-input-field') as HTMLInputElement;
                  handlePromptSubmit(input ? input.value : '');
                }}
                className="px-4 py-1.5 rounded-lg bg-accent text-slate-950 font-bold hover:bg-accent/90 transition-colors"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
