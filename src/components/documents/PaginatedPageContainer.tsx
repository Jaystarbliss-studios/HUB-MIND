import React, { useEffect, useRef, useMemo, useState } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { OfficialLetterhead } from './OfficialLetterhead';
import { 
  PaperSizeOption, 
  OrientationOption, 
  MarginOption, 
  PaperThemeOption, 
  computePageLayout, 
  paginateDocument,
  PageDebugInfo,
  pxToMm
} from '../../lib/paginationEngine';
import { Layers, Bug, SplitSquareVertical, FileText } from 'lucide-react';

interface PaginatedPageContainerProps {
  editor: Editor | null;
  paperSize: PaperSizeOption;
  orientation: OrientationOption;
  marginOption: MarginOption;
  paperTheme: PaperThemeOption;
  zoomLevel: number;
  showPageBreaks: boolean;
  showMarginGuides: boolean;
  showDebugInfo: boolean;
  pageCount: number;
  activePage: number;
  onPageCountChange: (count: number) => void;
  onActivePageChange: (page: number) => void;
  onDebugInfoChange?: (info: PageDebugInfo[]) => void;
}

export function PaginatedPageContainer({
  editor,
  paperSize,
  orientation,
  marginOption,
  paperTheme,
  zoomLevel,
  showPageBreaks,
  showMarginGuides,
  showDebugInfo,
  pageCount,
  activePage,
  onPageCountChange,
  onActivePageChange,
  onDebugInfoChange,
}: PaginatedPageContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);
  const [debugData, setDebugData] = useState<PageDebugInfo[]>([]);

  // Calculate physical layout from single source of truth
  const layout = useMemo(() => {
    return computePageLayout({
      paperSize,
      orientation,
      marginOption,
      includeLetterheadOnPage1: true,
    });
  }, [paperSize, orientation, marginOption]);

  // Check mobile viewport width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Synchronize exact page count and debug information in real-time with debouncing
  useEffect(() => {
    if (!editor) return;

    const syncPagination = () => {
      const html = editor.getHTML();
      const result = paginateDocument(html, {
        paperSize,
        orientation,
        marginOption,
        includeLetterheadOnPage1: true,
      });

      if (result.totalPages !== pageCount && result.totalPages > 0) {
        onPageCountChange(result.totalPages);
      }

      setDebugData(result.debugInfo);
      if (onDebugInfoChange) {
        onDebugInfoChange(result.debugInfo);
      }
    };

    syncPagination();
    const timer = setTimeout(syncPagination, 120);

    return () => clearTimeout(timer);
  }, [editor, editor?.getHTML(), paperSize, orientation, marginOption, pageCount, onPageCountChange, onDebugInfoChange]);

  // Track active page based on scroll position in editor container
  useEffect(() => {
    const handleScroll = () => {
      const scrollParent = containerRef.current?.closest('.overflow-y-auto');
      if (!scrollParent) return;

      const scrollTop = scrollParent.scrollTop;
      const targetHeight = (layout.pageHeightPx + 40) * (isMobileScreen ? 1 : zoomLevel);
      const currentPage = Math.min(
        pageCount,
        Math.max(1, Math.floor((scrollTop + 200) / targetHeight) + 1)
      );

      if (currentPage !== activePage) {
        onActivePageChange(currentPage);
      }
    };

    const scrollParent = containerRef.current?.closest('.overflow-y-auto');
    if (scrollParent) {
      scrollParent.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollParent.removeEventListener('scroll', handleScroll);
    }
  }, [layout.pageHeightPx, zoomLevel, pageCount, activePage, onActivePageChange, isMobileScreen]);

  const isWhitePaper = paperTheme === 'white';
  const deskGapPx = 40;

  // Render individual physical pages in the background/foreground stack
  const pagesArray = useMemo(() => {
    return Array.from({ length: Math.max(1, pageCount) }, (_, idx) => idx + 1);
  }, [pageCount]);

  return (
    <div
      ref={containerRef}
      style={
        isMobileScreen
          ? { width: '100%' }
          : {
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top center',
              transition: 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
            }
      }
      className="w-full flex flex-col items-center pb-24 print:transform-none print:pb-0"
    >
      {/* Top Multi-Page & Orientation Status Badge */}
      <div className="mb-4 print:hidden flex items-center gap-2 bg-slate-900/95 border border-slate-800 backdrop-blur-md px-4 py-1.5 rounded-full text-xs text-slate-300 shadow-xl select-none animate-in fade-in duration-200">
        <Layers className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="font-medium">
          <strong className="text-white font-mono">{pageCount} {paperSize.toUpperCase()} {pageCount === 1 ? 'Page' : 'Pages'}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-[11px] text-slate-400 capitalize font-mono">{orientation}</span>
        <span className="text-slate-600">•</span>
        <span className="text-[11px] text-slate-400 font-mono">Margins: {marginOption}</span>
        <span className="text-slate-600">•</span>
        <span className="text-[11px] text-teal-400 font-mono font-semibold">Page {activePage} of {pageCount}</span>
      </div>

      {/* Physical Sheets Layout View */}
      <div className="flex flex-col items-center gap-8 print:gap-0 w-full">
        {pagesArray.map((pageNum, idx) => {
          const isFirstPage = pageNum === 1;

          return (
            <React.Fragment key={pageNum}>
              {/* Individual Physical Paper Sheet */}
              <div
                id={`document-physical-sheet-${pageNum}`}
                style={{
                  width: '100%',
                  maxWidth: isMobileScreen ? '100%' : `${layout.pageWidthPx}px`,
                  minHeight: isMobileScreen ? 'auto' : `${layout.pageHeightPx}px`,
                  paddingTop: isMobileScreen ? '24px' : `${layout.marginsPx.top}px`,
                  paddingRight: isMobileScreen ? '16px' : `${layout.marginsPx.right}px`,
                  paddingBottom: isMobileScreen ? '24px' : `${layout.marginsPx.bottom}px`,
                  paddingLeft: isMobileScreen ? '16px' : `${layout.marginsPx.left}px`,
                }}
                className={`relative transition-colors duration-150 ${
                  isWhitePaper
                    ? 'paper-white bg-white text-slate-950 border border-slate-300 shadow-2xl rounded-xs ring-1 ring-black/5'
                    : 'paper-dark bg-slate-900 text-slate-100 border border-slate-800 shadow-2xl rounded-xs ring-1 ring-white/5'
                } print:bg-white print:border-none print:shadow-none print:p-0 print:max-w-none print:min-h-0 print:rounded-none print:page-break-after-always`}
              >
                {/* Optional Visual Margin Guides (Dashed Box) */}
                {showMarginGuides && !isMobileScreen && (
                  <div 
                    className="absolute inset-0 pointer-events-none border border-dashed border-cyan-400/40 z-20 print:hidden"
                    style={{
                      top: `${layout.marginsPx.top}px`,
                      right: `${layout.marginsPx.right}px`,
                      bottom: `${layout.marginsPx.bottom}px`,
                      left: `${layout.marginsPx.left}px`,
                    }}
                  >
                    <span className="absolute -top-3 left-2 bg-cyan-950/80 text-cyan-300 text-[9px] font-mono px-1 rounded border border-cyan-500/40">
                      Print Area: {layout.contentWidthMm}mm × {layout.contentHeightMm}mm
                    </span>
                  </div>
                )}

                {/* Left Gutter Floating Sheet Number */}
                {!isMobileScreen && (
                  <div className="absolute -left-16 top-4 hidden xl:flex flex-col items-center gap-1 print:hidden select-none">
                    <div className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-300 rounded text-[10px] font-mono font-bold shadow-xl flex items-center gap-1">
                      <FileText className="w-3 h-3 text-accent" />
                      <span>{pageNum}</span>
                    </div>
                  </div>
                )}

                {/* Top of Sheet: Official Letterhead on Page 1, Running Header on Page 2+ */}
                {isFirstPage ? (
                  <OfficialLetterhead theme={paperTheme} />
                ) : (
                  <div className="running-header pb-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-sans select-none print:border-slate-300">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300 print:text-black">
                      Jaystarbliss Dynamic Institute
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 print:text-black">
                      Sheet {pageNum} of {pageCount}
                    </span>
                  </div>
                )}

                {/* TipTap Document Content Body is rendered in Sheet 1 */}
                {isFirstPage && (
                  <div className="pt-2 min-h-[400px]">
                    {editor && <EditorContent editor={editor} />}
                  </div>
                )}

                {/* Bottom of Sheet: Footer Page Indicator */}
                <div className="absolute bottom-3 right-6 text-[10px] font-mono text-slate-400 print:text-black select-none pointer-events-none">
                  Page {pageNum} of {pageCount}
                </div>
              </div>

              {/* Physical Desk Gap & Page Break Divider Between Consecutive Sheets */}
              {showPageBreaks && !isMobileScreen && idx < pagesArray.length - 1 && (
                <div className="w-full max-w-[840px] flex items-center justify-between px-6 py-2 bg-slate-950 border border-slate-800 rounded-lg shadow-inner text-[11px] font-mono text-slate-400 print:hidden select-none">
                  <div className="flex items-center gap-2 font-semibold">
                    <SplitSquareVertical className="w-4 h-4 text-accent" />
                    <span>PAGE BREAK &bull; {paperSize.toUpperCase()} ({orientation.toUpperCase()})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Passing into</span>
                    <span className="text-teal-300 font-bold bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
                      SHEET {pageNum + 1} OF {pageCount}
                    </span>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Pagination Debug Inspector Overlay */}
      {showDebugInfo && debugData.length > 0 && (
        <div className="fixed bottom-12 right-6 z-40 bg-slate-900/95 border border-cyan-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md max-w-sm w-full text-xs text-slate-200 print:hidden font-mono animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Bug className="w-4 h-4" />
              <span>Pagination Engine Inspector</span>
            </div>
            <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {paperSize.toUpperCase()} • {orientation}
            </span>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-slate-400">
              <span>Paper Size:</span>
              <span className="text-white font-semibold">{layout.pageWidthMm}mm × {layout.pageHeightMm}mm ({layout.pageWidthPx}×{layout.pageHeightPx}px)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Margins (T/R/B/L):</span>
              <span className="text-white font-semibold">{layout.marginsMm.topMm}mm / {layout.marginsMm.rightMm}mm / {layout.marginsMm.bottomMm}mm / {layout.marginsMm.leftMm}mm</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Content Area:</span>
              <span className="text-white font-semibold">{layout.contentWidthMm}mm × {layout.contentHeightMm}mm ({layout.contentWidthPx}×{layout.contentHeightPx}px)</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2">
            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1.5">Page Breakdown</div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 pr-1">
              {debugData.map((info) => (
                <div key={info.pageNumber} className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-accent font-bold">Page {info.pageNumber}</span>
                    <span className="text-slate-500 ml-1.5">({info.totalElements} nodes)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-300 font-mono">{info.usedHeightPx}px / {info.maxHeightPx}px</span>
                    <span className="text-slate-500 ml-1">({pxToMm(info.usedHeightPx)}mm)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
