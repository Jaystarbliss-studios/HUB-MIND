import React, { useEffect, useRef, useState, useMemo } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { OfficialLetterhead } from './OfficialLetterhead';
import { PageSizeOption, PaperThemeOption, PAGE_CONFIGS } from '../../pages/DocumentEditor';
import { SplitSquareVertical, FileText, ChevronUp, ChevronDown, Layers } from 'lucide-react';

interface PaginatedPageContainerProps {
  editor: Editor | null;
  pageSize: PageSizeOption;
  paperTheme: PaperThemeOption;
  zoomLevel: number;
  showPageBreaks: boolean;
  pageCount: number;
  activePage: number;
  onPageCountChange: (count: number) => void;
  onActivePageChange: (page: number) => void;
  viewMode?: 'continuous' | 'paginated';
}

export function PaginatedPageContainer({
  editor,
  pageSize,
  paperTheme,
  zoomLevel,
  showPageBreaks,
  pageCount,
  activePage,
  onPageCountChange,
  onActivePageChange,
  viewMode = 'continuous',
}: PaginatedPageContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const currentConfig = PAGE_CONFIGS[pageSize];

  // Measure content height and calculate total page count dynamically
  useEffect(() => {
    if (!contentWrapperRef.current) return;
    const contentEl = contentWrapperRef.current;

    const updatePages = () => {
      const fullHeight = contentEl.scrollHeight;
      const targetPageHeight = currentConfig.heightPx;
      // Subtract top/bottom padding allowances to determine true page boundaries
      const calculatedPages = Math.max(1, Math.ceil((fullHeight - 40) / targetPageHeight));
      if (calculatedPages !== pageCount) {
        onPageCountChange(calculatedPages);
      }
    };

    updatePages();

    const resizeObserver = new ResizeObserver(() => {
      updatePages();
    });

    resizeObserver.observe(contentEl);
    return () => resizeObserver.disconnect();
  }, [pageSize, currentConfig.heightPx, pageCount, onPageCountChange, editor?.getHTML()]);

  // Track active page based on scroll position in editor container
  useEffect(() => {
    const handleScroll = () => {
      const scrollParent = containerRef.current?.closest('.overflow-y-auto');
      if (!scrollParent || !contentWrapperRef.current) return;

      const scrollTop = scrollParent.scrollTop;
      const targetHeight = currentConfig.heightPx * zoomLevel;
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
  }, [currentConfig.heightPx, zoomLevel, pageCount, activePage, onActivePageChange]);

  // Generate page break offsets for multi-page document pagination
  const pageBreakOffsets = useMemo(() => {
    const offsets: number[] = [];
    for (let i = 1; i < pageCount; i++) {
      offsets.push(i * currentConfig.heightPx);
    }
    return offsets;
  }, [pageCount, currentConfig.heightPx]);

  const minTotalHeight = currentConfig.heightPx * pageCount;

  return (
    <div
      ref={containerRef}
      style={{
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'top center',
        transition: 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="w-full flex flex-col items-center pb-24 print:transform-none print:pb-0"
    >
      {/* Visual Page Count Notification Banner when document exceeds 1 page */}
      {pageCount > 1 && (
        <div className="mb-4 print:hidden flex items-center gap-2 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs text-slate-300 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium">
            Multi-Page Document: <strong className="text-white font-mono">{pageCount} {pageSize.toUpperCase()} Pages</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] text-slate-400">Current: Page {activePage}</span>
        </div>
      )}

      {/* Main Physical Document Canvas */}
      <div
        ref={contentWrapperRef}
        id="document-paginated-sheet"
        style={{
          width: '100%',
          maxWidth: `${currentConfig.widthPx}px`,
          minHeight: `${minTotalHeight}px`,
        }}
        className={`relative transition-colors duration-150 ${
          paperTheme === 'white'
            ? 'paper-white bg-white text-slate-950 border border-slate-300 shadow-2xl rounded-sm ring-1 ring-black/5'
            : 'paper-dark bg-slate-900 text-slate-100 border border-slate-800 shadow-2xl rounded-sm ring-1 ring-white/5'
        } p-8 sm:p-12 md:p-14 print:bg-white print:border-none print:shadow-none print:p-0 print:max-w-none print:min-h-0 print:rounded-none`}
      >
        {/* Dynamic Visual Page Break Guides & Page Separators */}
        {showPageBreaks &&
          pageBreakOffsets.map((offset, idx) => {
            const pageNumber = idx + 2;
            return (
              <div
                key={idx}
                style={{ top: `${offset}px` }}
                className="absolute left-0 right-0 pointer-events-none print:hidden z-20"
              >
                {/* Visual Page Break Separator Bar */}
                <div className="relative w-full flex items-center justify-between px-0 -mt-3.5">
                  <div className="w-full h-8 bg-slate-950/95 border-y border-slate-700 flex items-center justify-between px-4 sm:px-6 shadow-md backdrop-blur-sm">
                    <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                      <SplitSquareVertical className="w-3.5 h-3.5 text-accent" />
                      Page Break • End of Page {idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {currentConfig.name} ({currentConfig.dimensions})
                      </span>
                      <span className="bg-accent text-slate-950 text-[11px] px-2.5 py-0.5 rounded-full font-bold font-mono shadow-xs">
                        Page {pageNumber} of {pageCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Official Letterhead on Page 1 */}
        <OfficialLetterhead theme={paperTheme} />

        {/* TipTap Document Content Body */}
        <div className="pt-2 min-h-[450px]">
          {editor && <EditorContent editor={editor} />}
        </div>

        {/* Document Page Footer Indicator at Bottom of Sheet */}
        <div className="mt-12 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 print:hidden select-none">
          <span className="font-medium">Jaystarbliss Dynamic Institute</span>
          <span className="font-mono text-slate-500">
            Page {pageCount} of {pageCount}
          </span>
        </div>
      </div>
    </div>
  );
}
