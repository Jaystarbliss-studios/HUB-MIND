import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Printer, Download, FileText, Code, ZoomIn, ZoomOut, Maximize2, 
  RotateCw, Layers, Check, Loader2, Sparkles, ChevronLeft, ChevronRight,
  Eye, FileSpreadsheet, Copy
} from 'lucide-react';
import { OfficialLetterhead } from './OfficialLetterhead';
import { PageSizeOption, PAGE_CONFIGS } from '../../pages/DocumentEditor';
import { 
  exportDocumentAsPDF, 
  printDocumentDirect, 
  exportDocumentAsDOCX, 
  exportDocumentAsHTML, 
  exportDocumentAsTXT 
} from '../../lib/documentExporter';

interface FullPagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docTitle: string;
  bodyHtml: string;
  textContent: string;
  pageSize?: PageSizeOption;
}

export const FullPagePreviewModal: React.FC<FullPagePreviewModalProps> = ({
  isOpen,
  onClose,
  docTitle,
  bodyHtml,
  textContent,
  pageSize = 'a4',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(0.9);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingDOCX, setIsExportingDOCX] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [currentPageSize, setCurrentPageSize] = useState<PageSizeOption>(pageSize);
  const [viewMode, setViewMode] = useState<'sheet' | 'paginated'>('sheet');

  const config = PAGE_CONFIGS[currentPageSize] || PAGE_CONFIGS.a4;
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPageSize(pageSize);
  }, [pageSize]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = async () => {
    await printDocumentDirect(docTitle, bodyHtml, currentPageSize);
  };

  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    setPdfProgress(10);
    try {
      await exportDocumentAsPDF(docTitle, bodyHtml, currentPageSize, (percent) => {
        setPdfProgress(percent);
      });
    } finally {
      setIsExportingPDF(false);
      setPdfProgress(0);
    }
  };

  const handleDownloadDOCX = async () => {
    setIsExportingDOCX(true);
    try {
      await exportDocumentAsDOCX(docTitle, bodyHtml);
    } finally {
      setIsExportingDOCX(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(textContent || '');
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Controls Header Bar */}
      <div className="h-14 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-lg select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-accent/15 text-accent">
            <Eye className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
              Full Page Preview: {docTitle || 'Untitled Document'}
            </h2>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              Print-Ready • {config.name} ({config.dimensions}) • Official Letterhead
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-semibold text-accent px-2 min-w-[48px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(0.9)}
              className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-300 hover:bg-slate-800 ml-1"
            >
              Fit
            </button>
          </div>

          {/* Page Size Switcher */}
          <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setCurrentPageSize('a4')}
              className={`px-2.5 py-1 rounded transition-colors font-medium ${
                currentPageSize === 'a4' ? 'bg-accent text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              A4
            </button>
            <button
              onClick={() => setCurrentPageSize('letter')}
              className={`px-2.5 py-1 rounded transition-colors font-medium ${
                currentPageSize === 'letter' ? 'bg-accent text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Letter
            </button>
          </div>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="px-3.5 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Download formatted PDF file"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Exporting {pdfProgress > 0 ? `${pdfProgress}%` : ''}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Save PDF</span>
              </>
            )}
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
            title="Print or Save via Print Dialog"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Export Word */}
          <button
            onClick={handleDownloadDOCX}
            disabled={isExportingDOCX}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
            title="Export as Microsoft Word (.docx)"
          >
            {isExportingDOCX ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-blue-400" />}
            <span>Word DOCX</span>
          </button>

          {/* Copy Plain Text */}
          <button
            onClick={handleCopyText}
            className="hidden sm:flex items-center gap-1.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Copy Text Content"
          >
            {copiedStatus ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Viewing Area */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex justify-center items-start bg-slate-950 scrollbar-thin scrollbar-thumb-slate-800">
        <div
          ref={modalContentRef}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: '100%',
            maxWidth: `${config.widthPx}px`,
          }}
          className="bg-white text-slate-950 p-10 sm:p-14 rounded-sm shadow-2xl border border-slate-300 ring-1 ring-black/10 min-h-[1050px] my-4"
        >
          {/* Real Official Letterhead */}
          <OfficialLetterhead theme="white" />

          {/* Rendered Document Body HTML */}
          <div 
            className="prose prose-slate max-w-none text-slate-900 leading-relaxed font-sans text-[11pt] pt-2"
            dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="text-slate-400 italic">No content in document.</p>' }}
          />

          {/* Official Document Footer */}
          <div className="mt-16 pt-6 border-t-2 border-slate-900/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2 select-none">
            <span className="font-bold uppercase tracking-wider text-slate-800">
              Jaystarbliss Dynamic Institute
            </span>
            <span className="font-mono text-slate-500 font-medium">
              Confidential & Official Record • {new Date().toLocaleDateString('en-GB')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
