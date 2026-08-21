import React, { useState } from 'react';
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
  Plus, Trash2, Columns, Rows
} from 'lucide-react';
import { ImportExportMenu } from './ImportExportMenu';
import { PageSizeOption, PaperThemeOption } from '../../pages/DocumentEditor';

export type RibbonTab = 'home' | 'insert' | 'layout' | 'review' | 'view' | 'file';

interface DocumentRibbonProps {
  editor: Editor;
  docTitle: string;
  pageSize: PageSizeOption;
  setPageSize: (size: PageSizeOption) => void;
  paperTheme: PaperThemeOption;
  setPaperTheme: React.Dispatch<React.SetStateAction<PaperThemeOption>>;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  showPageBreaks: boolean;
  setShowPageBreaks: React.Dispatch<React.SetStateAction<boolean>>;
  pageCount: number;
  activePage?: number;
  onOpenPreview?: () => void;
}

export function DocumentRibbon({
  editor,
  docTitle,
  pageSize,
  setPageSize,
  paperTheme,
  setPaperTheme,
  zoomLevel,
  setZoomLevel,
  showPageBreaks,
  setShowPageBreaks,
  pageCount,
  activePage = 1,
  onOpenPreview,
}: DocumentRibbonProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [promptState, setPromptState] = useState<{ type: 'image' | 'link' | null; defaultVal: string }>({
    type: null,
    defaultVal: ''
  });
  const [findText, setFindText] = useState('');
  const [showFindBar, setShowFindBar] = useState(false);

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
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
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

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200 select-none shrink-0 print:hidden shadow-md">
      {/* Top Ribbon Navigation Tabs */}
      <div className="flex items-center gap-0.5 px-3 pt-1 border-b border-slate-800/80 bg-slate-950 overflow-x-auto scrollbar-none text-xs">
        <button
          onClick={() => setActiveTab('file')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'file'
              ? 'bg-accent text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>File</span>
        </button>

        <button
          onClick={() => setActiveTab('home')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors ${
            activeTab === 'home'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Home
        </button>

        <button
          onClick={() => setActiveTab('insert')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors ${
            activeTab === 'insert'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Insert
        </button>

        <button
          onClick={() => setActiveTab('layout')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors ${
            activeTab === 'layout'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Layout
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors ${
            activeTab === 'review'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Review
        </button>

        <button
          onClick={() => setActiveTab('view')}
          className={`px-3.5 py-1.5 font-semibold rounded-t-md transition-colors ${
            activeTab === 'view'
              ? 'bg-slate-900 text-white border-t-2 border-accent'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          View
        </button>

        {/* Real-time Page Counter Display Widget in Ribbon Header */}
        <div className="ml-auto hidden sm:flex items-center gap-2 pl-3 py-1 shrink-0">
          <div 
            className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1 text-xs shadow-xs hover:border-slate-700 transition-colors"
            title={`Real-Time Document Pagination: Page ${activePage} of ${pageCount} (${pageSize.toUpperCase()})`}
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              <span className="text-slate-400">Page</span>
              <span className="text-accent font-mono font-bold">{activePage}</span>
              <span className="text-slate-500">/</span>
              <span className="text-white font-mono font-bold">{pageCount}</span>
            </div>
            <span className="text-slate-700">•</span>
            <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
              {pageSize}
            </span>
          </div>
        </div>
      </div>

      {/* Ribbon Command Strip */}
      <div className="p-2 overflow-x-auto whitespace-nowrap flex items-center gap-3 min-h-[58px]">
        {/* TAB 1: FILE */}
        {activeTab === 'file' && (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 pr-3 border-r border-slate-800">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-medium transition-colors"
                title="Print or Save as PDF"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Print / PDF</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Export & Cloud:</span>
              <ImportExportMenu editor={editor} docTitle={docTitle} />
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
                className="p-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                title="Smart Paste with Clean Formatting (Ctrl+V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px]">Paste</span>
              </button>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={handleCut}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  title="Cut (Ctrl+X)"
                >
                  <Scissors className="w-3 h-3" />
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
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
                className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none w-32"
              >
                {fontFamilies.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>

              <select
                onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
                value={editor.getAttributes('textStyle').fontSize || '16px'}
                className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none w-16"
              >
                {fontSizes.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            {/* Font Style Formatting */}
            <div className="flex items-center gap-0.5 pr-2 border-r border-slate-800">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-accent/20 text-accent font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('subscript') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Subscript"
              >
                <Subscript className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('superscript') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Superscript"
              >
                <Superscript className="w-3.5 h-3.5" />
              </button>

              {/* Text Color Picker */}
              <div className="relative group p-1">
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
              <div className="relative group p-1">
                <Highlighter className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 cursor-pointer" />
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                title="Clear Formatting"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Paragraph Alignments */}
            <div className="flex items-center gap-0.5 pr-2 border-r border-slate-800">
              <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-1.5 rounded-lg ${editor.isActive({ textAlign: 'left' }) ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Align Left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-1.5 rounded-lg ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Align Center"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-1.5 rounded-lg ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Align Right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`p-1.5 rounded-lg ${editor.isActive({ textAlign: 'justify' }) ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Justify"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Lists & Quotes */}
            <div className="flex items-center gap-0.5 pr-2 border-r border-slate-800">
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-lg ${editor.isActive('bulletList') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded-lg ${editor.isActive('orderedList') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1.5 rounded-lg ${editor.isActive('taskList') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Task Checklist"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded-lg ${editor.isActive('blockquote') ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Blockquote"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Heading Style Presets */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={`px-2.5 py-1 rounded text-xs border ${
                  editor.isActive('paragraph') && !editor.isActive('heading')
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`px-2.5 py-1 rounded text-xs border font-bold ${
                  editor.isActive('heading', { level: 1 })
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Heading 1
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`px-2.5 py-1 rounded text-xs border font-semibold ${
                  editor.isActive('heading', { level: 2 })
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Heading 2
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`px-2.5 py-1 rounded text-xs border ${
                  editor.isActive('heading', { level: 3 })
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
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
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
              <button
                onClick={insertTable}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
                title="Insert 3x3 Table"
              >
                <TableIcon className="w-3.5 h-3.5 text-accent" />
                <span>Table</span>
              </button>
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
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
                title="Insert Page Break / Dividing Rule"
              >
                <SplitSquareVertical className="w-3.5 h-3.5 text-accent" />
                <span>Page Break</span>
              </button>
              <button
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
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
              <div className="flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-lg px-2 py-1">
                <span className="text-[11px] font-bold text-accent pr-1">Table Controls:</span>
                <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="p-1 rounded bg-slate-800 text-[10px] text-slate-200" title="Add Column Before">+Col Left</button>
                <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="p-1 rounded bg-slate-800 text-[10px] text-slate-200" title="Add Column After">+Col Right</button>
                <button onClick={() => editor.chain().focus().deleteColumn().run()} className="p-1 rounded bg-slate-800 text-[10px] text-red-300" title="Delete Column">-Col</button>
                <button onClick={() => editor.chain().focus().addRowBefore().run()} className="p-1 rounded bg-slate-800 text-[10px] text-slate-200" title="Add Row Before">+Row Above</button>
                <button onClick={() => editor.chain().focus().addRowAfter().run()} className="p-1 rounded bg-slate-800 text-[10px] text-slate-200" title="Add Row After">+Row Below</button>
                <button onClick={() => editor.chain().focus().deleteRow().run()} className="p-1 rounded bg-slate-800 text-[10px] text-red-300" title="Delete Row">-Row</button>
                <button onClick={() => editor.chain().focus().mergeCells().run()} className="p-1 rounded bg-slate-800 text-[10px] text-accent font-semibold" title="Merge Cells">Merge</button>
                <button onClick={() => editor.chain().focus().splitCell().run()} className="p-1 rounded bg-slate-800 text-[10px] text-accent font-semibold" title="Split Cell">Split</button>
                <button onClick={() => editor.chain().focus().deleteTable().run()} className="p-1 rounded bg-red-950/60 border border-red-800 text-[10px] text-red-300 font-semibold" title="Delete Table">Delete Table</button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LAYOUT */}
        {activeTab === 'layout' && (
          <div className="flex items-center gap-3 text-xs">
            {/* Standard Page Dimensions */}
            <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Page Size:</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setPageSize('a4')}
                  className={`px-3 py-1 rounded transition-colors font-medium ${
                    pageSize === 'a4' ? 'bg-accent text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  A4 (210 × 297 mm)
                </button>
                <button
                  onClick={() => setPageSize('letter')}
                  className={`px-3 py-1 rounded transition-colors font-medium ${
                    pageSize === 'letter' ? 'bg-accent text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  US Letter (8.5 × 11 in)
                </button>
              </div>
            </div>

            {/* Paper Theme (White vs Dark) */}
            <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Paper Appearance:</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setPaperTheme('white')}
                  className={`px-3 py-1 rounded transition-colors font-medium ${
                    paperTheme === 'white' ? 'bg-white text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  White Paper (Print)
                </button>
                <button
                  onClick={() => setPaperTheme('dark')}
                  className={`px-3 py-1 rounded transition-colors font-medium ${
                    paperTheme === 'dark' ? 'bg-slate-950 text-cyan-400 border border-slate-700 font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Dark Sheet
                </button>
              </div>
            </div>

            {/* Page Break Guide Toggle & Insert Break */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPageBreaks(!showPageBreaks)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                  showPageBreaks
                    ? 'border-accent/50 bg-accent/10 text-accent font-semibold'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                <span>{showPageBreaks ? 'Page Guides: Visible' : 'Page Guides: Hidden'}</span>
              </button>

              <button
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 font-medium transition-colors"
                title="Insert page break separator"
              >
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>Insert Page Break</span>
              </button>
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
              <button
                onClick={() => editor.chain().focus().selectAll().run()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select All</span>
              </button>
              <button
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
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
