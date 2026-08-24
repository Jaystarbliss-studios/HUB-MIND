import React, { useEffect, useLayoutEffect, useRef, useMemo, useState, useCallback } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { OfficialLetterhead } from './OfficialLetterhead';
import { 
  PaperSizeOption, 
  OrientationOption, 
  MarginOption, 
  PaperThemeOption, 
  computePageLayout, 
  ComputedPageLayout,
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
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);
  const [debugData, setDebugData] = useState<PageDebugInfo[]>([]);
  const [internalPageCount, setInternalPageCount] = useState<number>(Math.max(1, pageCount));

  const deskGapPx = 40;

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

  // Compute exact spacer needed to bridge from bottom of Sheet (N) to content top of Sheet (N+1)
  const breakSpacerHeight = useMemo(() => {
    return layout.marginsPx.bottom + deskGapPx + layout.marginsPx.top + layout.subsequentHeaderHeightPx + 24;
  }, [layout.marginsPx.bottom, deskGapPx, layout.marginsPx.top, layout.subsequentHeaderHeightPx]);

  // Layout function that measures live DOM elements in the editor and distributes them across physical pages
  const reflowEditorPages = useCallback(() => {
    if (!editorHostRef.current) return 1;

    const editorProse = editorHostRef.current.querySelector('.tiptap.ProseMirror') as HTMLElement | null;
    if (!editorProse) return 1;

    const children = Array.from(editorProse.children) as HTMLElement[];
    if (children.length === 0) return 1;

    // Reset previous inline styles and attributes before recalculating
    children.forEach((child) => {
      child.style.marginTop = '';
      child.removeAttribute('data-page-break-before');
      child.removeAttribute('data-page-number');
    });

    const hostRect = editorHostRef.current.getBoundingClientRect();
    const effectiveZoom = isMobileScreen ? 1 : (zoomLevel || 1);

    let currentPage = 1;
    let accumulatedHeightOnPage = 0;

    const firstPageCapacity = layout.page1UsableHeightPx;
    const subsequentPageCapacity = layout.subsequentUsableHeightPx;

    children.forEach((child, index) => {
      const tagName = child.tagName.toLowerCase();
      const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);
      const isExplicitBreak = tagName === 'hr' || child.classList.contains('page-break') || child.getAttribute('data-page-break') === 'true';

      const maxCapacity = currentPage === 1 ? firstPageCapacity : subsequentPageCapacity;
      const childHeight = child.offsetHeight || 28;
      const wouldOrphanHeading = isHeading && (accumulatedHeightOnPage + childHeight + 50 > maxCapacity);

      const shouldBreak = isExplicitBreak || (index > 0 && (accumulatedHeightOnPage + childHeight > maxCapacity || wouldOrphanHeading));

      if (shouldBreak) {
        // Push this element to start of next physical page sheet
        currentPage++;
        accumulatedHeightOnPage = childHeight;
        child.setAttribute('data-page-break-before', String(currentPage));
        child.setAttribute('data-page-number', String(currentPage));

        // Target Y for content on Sheet (currentPage) relative to the top of editorHostRef
        // Sheet N top = (N - 1) * (pageHeightPx + deskGapPx)
        // Content on Sheet N starts at: Sheet N top + margins.top + subsequentHeaderHeight + 20px gap below header line
        const targetTopRelativeToHost = (currentPage - 1) * (layout.pageHeightPx + deskGapPx) + layout.marginsPx.top + layout.subsequentHeaderHeightPx + 20;

        // Measure where the child is naturally positioned relative to host top
        const childRect = child.getBoundingClientRect();
        const currentTopRelativeToHost = (childRect.top - hostRect.top) / effectiveZoom;

        // Margin needed to push this element cleanly below the running header of Sheet (currentPage)
        const neededMarginTop = Math.max(24, Math.round(targetTopRelativeToHost - currentTopRelativeToHost));
        child.style.marginTop = `${neededMarginTop}px`;
      } else {
        accumulatedHeightOnPage += childHeight;
        child.setAttribute('data-page-number', String(currentPage));
      }
    });

    const totalPagesComputed = Math.max(1, currentPage);
    setInternalPageCount(totalPagesComputed);
    if (totalPagesComputed !== pageCount) {
      onPageCountChange(totalPagesComputed);
    }

    return totalPagesComputed;
  }, [layout, deskGapPx, zoomLevel, isMobileScreen, pageCount, onPageCountChange]);

  // Synchronize layout & pagination engine debug stats whenever editor changes
  useEffect(() => {
    if (!editor) return;

    const syncPagination = () => {
      reflowEditorPages();

      const html = editor.getHTML();
      const result = paginateDocument(html, {
        paperSize,
        orientation,
        marginOption,
        includeLetterheadOnPage1: true,
      });

      setDebugData(result.debugInfo);
      if (onDebugInfoChange) {
        onDebugInfoChange(result.debugInfo);
      }
    };

    syncPagination();
    const timer = setTimeout(syncPagination, 60);

    // TipTap transaction hook
    editor.on('transaction', syncPagination);

    return () => {
      clearTimeout(timer);
      editor.off('transaction', syncPagination);
    };
  }, [editor, paperSize, orientation, marginOption, reflowEditorPages, onDebugInfoChange]);

  // Re-flow on layout changes or window resizing
  useLayoutEffect(() => {
    reflowEditorPages();
  }, [layout, zoomLevel, paperSize, orientation, marginOption, reflowEditorPages]);

  // Track active page based on scroll position in editor container
  useEffect(() => {
    const handleScroll = () => {
      const scrollParent = containerRef.current?.closest('.overflow-y-auto');
      if (!scrollParent) return;

      const scrollTop = scrollParent.scrollTop;
      const targetHeight = (layout.pageHeightPx + deskGapPx) * (isMobileScreen ? 1 : zoomLevel);
      const currentPage = Math.min(
        effectivePageCount,
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
  }, [layout.pageHeightPx, deskGapPx, zoomLevel, internalPageCount, pageCount, activePage, onActivePageChange, isMobileScreen]);

  const effectivePageCount = Math.max(1, Math.max(pageCount, internalPageCount));
  const pagesArray = useMemo(() => {
    return Array.from({ length: effectivePageCount }, (_, idx) => idx + 1);
  }, [effectivePageCount]);

  const isWhitePaper = paperTheme === 'white';

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
          <strong className="text-white font-mono">{effectivePageCount} {paperSize.toUpperCase()} {effectivePageCount === 1 ? 'Page' : 'Pages'}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-[11px] text-slate-400 capitalize font-mono">{orientation}</span>
        <span className="text-slate-600">•</span>
        <span className="text-[11px] text-slate-400 font-mono">Margins: {marginOption}</span>
        <span className="text-slate-600">•</span>
        <span className="text-[11px] text-teal-400 font-mono font-semibold">Page {activePage} of {effectivePageCount}</span>
      </div>

      {/* Multi-Page Stack Canvas: Container holding layered physical sheets + active content */}
      <div 
        className="relative flex flex-col items-center print:block print:w-full"
        style={{
          width: isMobileScreen ? '100%' : `${layout.pageWidthPx}px`,
        }}
      >
        {/* Layer 1: Background Physical Paper Sheets (with desk gaps, running headers, footers) */}
        <div className="flex flex-col items-center w-full select-none pointer-events-none print:hidden">
          {pagesArray.map((pageNum, idx) => {
            const isFirstPage = pageNum === 1;

            return (
              <React.Fragment key={pageNum}>
                {/* Physical Sheet Card */}
                <div
                  id={`document-physical-sheet-${pageNum}`}
                  style={{
                    width: isMobileScreen ? '100%' : `${layout.pageWidthPx}px`,
                    height: isMobileScreen ? 'auto' : `${layout.pageHeightPx}px`,
                    paddingTop: `${layout.marginsPx.top}px`,
                    paddingRight: `${layout.marginsPx.right}px`,
                    paddingBottom: `${layout.marginsPx.bottom}px`,
                    paddingLeft: `${layout.marginsPx.left}px`,
                    boxSizing: 'border-box',
                  }}
                  className={`relative transition-colors duration-150 ${
                    isWhitePaper
                      ? 'paper-white bg-white text-slate-950 border border-slate-300 shadow-2xl rounded-xs ring-1 ring-black/5'
                      : 'paper-dark bg-slate-900 text-slate-100 border border-slate-800 shadow-2xl rounded-xs ring-1 ring-white/5'
                  }`}
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
                    <div className="absolute -left-16 top-4 hidden xl:flex flex-col items-center gap-1 print:hidden select-none pointer-events-auto">
                      <div className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-300 rounded text-[10px] font-mono font-bold shadow-xl flex items-center gap-1">
                        <FileText className="w-3 h-3 text-accent" />
                        <span>{pageNum}</span>
                      </div>
                    </div>
                  )}

                  {/* Top of Sheet: Official Letterhead on Page 1, Running Header on Page 2+ */}
                  {isFirstPage ? (
                    <div className="pointer-events-auto">
                      <OfficialLetterhead theme={paperTheme} />
                    </div>
                  ) : (
                    <div 
                      style={{ height: `${layout.subsequentHeaderHeightPx}px` }}
                      className="running-header pb-2 mb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-sans select-none print:border-slate-300 pointer-events-auto"
                    >
                      <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300 print:text-black">
                        Jaystarbliss Dynamic Institute
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 print:text-black font-semibold">
                        Sheet {pageNum} of {effectivePageCount}
                      </span>
                    </div>
                  )}

                  {/* Bottom of Sheet: Footer Page Indicator */}
                  <div className="absolute bottom-3 right-6 text-[10px] font-mono text-slate-400 print:text-black select-none pointer-events-none font-semibold">
                    Page {pageNum} of {effectivePageCount}
                  </div>
                </div>

                {/* Desk Gap & Page Break Ribbon Divider Between Consecutive Sheets */}
                {showPageBreaks && !isMobileScreen && idx < pagesArray.length - 1 && (
                  <div 
                    style={{ height: `${deskGapPx}px` }}
                    className="w-full flex items-center justify-between px-6 py-1 bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-400 print:hidden select-none pointer-events-auto shadow-inner"
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-300">
                      <SplitSquareVertical className="w-3.5 h-3.5 text-accent" />
                      <span>PAGE BREAK &bull; {paperSize.toUpperCase()} ({orientation.toUpperCase()})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]">Passing into</span>
                      <span className="text-teal-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[10px]">
                        SHEET {pageNum + 1} OF {effectivePageCount}
                      </span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Layer 2: Active TipTap Content Host Surface (positioned on top of the physical sheets) */}
        <div
          ref={editorHostRef}
          id="hubmind-active-editor-content-host"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: isMobileScreen ? '100%' : `${layout.pageWidthPx}px`,
            paddingTop: `${layout.marginsPx.top + layout.page1HeaderHeightPx}px`,
            paddingRight: `${layout.marginsPx.right}px`,
            paddingBottom: `${layout.marginsPx.bottom}px`,
            paddingLeft: `${layout.marginsPx.left}px`,
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
          className={`z-10 print:static print:p-0 print:w-full ${
            isWhitePaper ? 'paper-white text-slate-900' : 'paper-dark text-slate-100'
          }`}
        >
          {editor && (
            <div className={`document-paginated-editor-content min-h-[300px] ${
              isWhitePaper ? 'paper-white text-slate-900' : 'paper-dark text-slate-100'
            }`}>
              <EditorContent editor={editor} />
            </div>
          )}
        </div>
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
            <div className="flex justify-between text-slate-400">
              <span>Break Spacer:</span>
              <span className="text-teal-300 font-semibold">{breakSpacerHeight}px</span>
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
