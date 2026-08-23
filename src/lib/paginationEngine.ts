/**
 * HUB-MIND DOCUMENT EDITOR — PAGINATION & PRINT LAYOUT ENGINE
 * Centralized Single Source of Truth for Page Layout, Physical Metrics,
 * Margin Systems, and Semantic Multi-Page Flow.
 */

export type PaperSizeOption = 'a4' | 'letter' | 'legal';
export type OrientationOption = 'portrait' | 'landscape';
export type MarginOption = 'normal' | 'narrow' | 'moderate' | 'wide' | 'custom';
export type PaperThemeOption = 'white' | 'dark';

export interface MarginSettings {
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
}

export interface PaperSizeDefinition {
  id: PaperSizeOption;
  name: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: Record<PaperSizeOption, PaperSizeDefinition> = {
  a4: {
    id: 'a4',
    name: 'A4',
    widthMm: 210,
    heightMm: 297,
  },
  letter: {
    id: 'letter',
    name: 'US Letter',
    widthMm: 215.9,
    heightMm: 279.4,
  },
  legal: {
    id: 'legal',
    name: 'US Legal',
    widthMm: 215.9,
    heightMm: 355.6,
  },
};

export const MARGIN_PRESETS: Record<MarginOption, MarginSettings> = {
  normal: {
    topMm: 20,
    rightMm: 20,
    bottomMm: 20,
    leftMm: 20,
  },
  narrow: {
    topMm: 12.7,
    rightMm: 12.7,
    bottomMm: 12.7,
    leftMm: 12.7,
  },
  moderate: {
    topMm: 25.4,
    rightMm: 19.0,
    bottomMm: 25.4,
    leftMm: 19.0,
  },
  wide: {
    topMm: 25.4,
    rightMm: 50.8,
    bottomMm: 25.4,
    leftMm: 50.8,
  },
  custom: {
    topMm: 20,
    rightMm: 20,
    bottomMm: 20,
    leftMm: 20,
  },
};

// Conversion ratio: standard 96 DPI CSS pixels per millimeter (96 px / 25.4 mm = 3.7795275591 px/mm)
export const PX_PER_MM = 3.7795275591;

export function mmToPx(mm: number): number {
  return Math.round(mm * PX_PER_MM);
}

export function pxToMm(px: number): number {
  return Math.round((px / PX_PER_MM) * 10) / 10;
}

export interface DocumentPageConfig {
  paperSize: PaperSizeOption;
  orientation: OrientationOption;
  marginOption: MarginOption;
  customMargins?: MarginSettings;
  includeLetterheadOnPage1?: boolean;
}

export interface ComputedPageLayout {
  paperDef: PaperSizeDefinition;
  marginPreset: { name: string; id: MarginOption };
  pageWidthMm: number;
  pageHeightMm: number;
  pageWidthPx: number;
  pageHeightPx: number;
  marginsMm: MarginSettings;
  marginsPx: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  contentWidthMm: number;
  contentWidthPx: number;
  contentHeightMm: number;
  contentHeightPx: number;
  page1HeaderHeightPx: number;
  subsequentHeaderHeightPx: number;
  page1UsableHeightPx: number;
  subsequentUsableHeightPx: number;
}

/**
 * Calculates accurate physical page metrics based on paper size, orientation, and margins.
 */
export function computePageLayout(config: DocumentPageConfig): ComputedPageLayout {
  const paper = PAPER_SIZES[config.paperSize] || PAPER_SIZES.a4;
  const isLandscape = config.orientation === 'landscape';

  const rawWidthMm = isLandscape ? paper.heightMm : paper.widthMm;
  const rawHeightMm = isLandscape ? paper.widthMm : paper.heightMm;

  const marginsMm = config.marginOption === 'custom' && config.customMargins
    ? config.customMargins
    : (MARGIN_PRESETS[config.marginOption] || MARGIN_PRESETS.normal);

  const pageWidthPx = mmToPx(rawWidthMm);
  const pageHeightPx = mmToPx(rawHeightMm);

  const marginsPx = {
    top: mmToPx(marginsMm.topMm),
    right: mmToPx(marginsMm.rightMm),
    bottom: mmToPx(marginsMm.bottomMm),
    left: mmToPx(marginsMm.leftMm),
  };

  const contentWidthMm = Math.max(50, rawWidthMm - marginsMm.leftMm - marginsMm.rightMm);
  const contentWidthPx = pageWidthPx - marginsPx.left - marginsPx.right;

  const contentHeightMm = Math.max(50, rawHeightMm - marginsMm.topMm - marginsMm.bottomMm);
  const contentHeightPx = pageHeightPx - marginsPx.top - marginsPx.bottom;

  // Header heights
  // Official Letterhead on Page 1 is approx 115px (header + gap)
  const page1HeaderHeightPx = config.includeLetterheadOnPage1 !== false ? 120 : 0;
  const subsequentHeaderHeightPx = 30; // Running header on subsequent pages

  const page1UsableHeightPx = Math.max(200, contentHeightPx - page1HeaderHeightPx);
  const subsequentUsableHeightPx = Math.max(200, contentHeightPx - subsequentHeaderHeightPx);

  const marginPresetName = config.marginOption === 'normal' 
    ? 'Normal (20mm)' 
    : config.marginOption === 'narrow' 
    ? 'Narrow (12.7mm)' 
    : config.marginOption === 'moderate'
    ? 'Moderate'
    : config.marginOption === 'wide'
    ? 'Wide'
    : 'Custom';

  return {
    paperDef: paper,
    marginPreset: { name: marginPresetName, id: config.marginOption },
    pageWidthMm: rawWidthMm,
    pageHeightMm: rawHeightMm,
    pageWidthPx,
    pageHeightPx,
    marginsMm,
    marginsPx,
    contentWidthMm,
    contentWidthPx,
    contentHeightMm,
    contentHeightPx,
    page1HeaderHeightPx,
    subsequentHeaderHeightPx,
    page1UsableHeightPx,
    subsequentUsableHeightPx,
  };
}

export interface PageDebugInfo {
  pageNumber: number;
  totalElements: number;
  usedHeightPx: number;
  maxHeightPx: number;
  remainingHeightPx: number;
  hasOverflow: boolean;
}

export interface PaginationResult {
  pages: string[];
  totalPages: number;
  layout: ComputedPageLayout;
  debugInfo: PageDebugInfo[];
}

/**
 * Splits multi-row table across pages cleanly by keeping header and distributing rows
 */
function splitTableElement(
  tableEl: HTMLTableElement,
  availableHeight: number,
  subsequentHeight: number
): { fitPart: string | null; overflowPart: string | null } {
  const thead = tableEl.querySelector('thead');
  const theadHtml = thead ? thead.outerHTML : '';
  const rows = Array.from(tableEl.querySelectorAll('tbody tr, tr')).filter(
    (tr) => !tr.closest('thead')
  );

  if (rows.length <= 1) {
    return { fitPart: null, overflowPart: tableEl.outerHTML };
  }

  const tableClone = tableEl.cloneNode(false) as HTMLElement;
  const tagName = tableClone.tagName.toLowerCase();

  const fitRows: string[] = [];
  const overflowRows: string[] = [];
  let currentH = thead ? (thead as HTMLElement).offsetHeight || 35 : 0;
  let splitOccurred = false;

  rows.forEach((row) => {
    const rowEl = row as HTMLElement;
    const rHeight = rowEl.offsetHeight || 28;

    if (!splitOccurred && currentH + rHeight <= availableHeight) {
      fitRows.push(rowEl.outerHTML);
      currentH += rHeight;
    } else {
      splitOccurred = true;
      overflowRows.push(rowEl.outerHTML);
    }
  });

  if (fitRows.length === 0) {
    return { fitPart: null, overflowPart: tableEl.outerHTML };
  }

  const fitPart = `<${tagName} class="${tableEl.className}" style="${tableEl.getAttribute('style') || ''}">${theadHtml}<tbody>${fitRows.join('')}</tbody></${tagName}>`;
  const overflowPart = overflowRows.length > 0
    ? `<${tagName} class="${tableEl.className}" style="${tableEl.getAttribute('style') || ''}">${theadHtml}<tbody>${overflowRows.join('')}</tbody></${tagName}>`
    : null;

  return { fitPart, overflowPart };
}

/**
 * Splits long paragraphs across page boundaries at word boundaries
 */
function splitParagraphElement(
  pEl: HTMLElement,
  availableHeight: number,
  containerWidth: number
): { fitPart: string | null; overflowPart: string | null } {
  // If less than 2 lines (approx 36px) available, push entire paragraph to next page
  if (availableHeight < 36) {
    return { fitPart: null, overflowPart: pEl.outerHTML };
  }

  const text = pEl.innerText || pEl.textContent || '';
  if (!text.trim()) {
    return { fitPart: pEl.outerHTML, overflowPart: null };
  }

  // Tokenize words and whitespace
  const words = text.split(/(\s+)/);
  if (words.length <= 2) {
    return { fitPart: null, overflowPart: pEl.outerHTML };
  }

  // Use an off-screen probe with identical styling to measure word wraps
  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.top = '-99999px';
  probe.style.left = '-99999px';
  probe.style.width = `${containerWidth}px`;
  probe.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  probe.style.fontSize = '11pt';
  probe.style.lineHeight = '1.6';
  probe.style.boxSizing = 'border-box';

  const testP = pEl.cloneNode(false) as HTMLElement;
  probe.appendChild(testP);
  document.body.appendChild(probe);

  let low = 1;
  let high = words.length;
  let bestFitIndex = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    testP.textContent = words.slice(0, mid).join('');
    const h = testP.offsetHeight;

    if (h <= availableHeight) {
      bestFitIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  document.body.removeChild(probe);

  if (bestFitIndex <= 1) {
    return { fitPart: null, overflowPart: pEl.outerHTML };
  }

  const fitText = words.slice(0, bestFitIndex).join('').trim();
  const overflowText = words.slice(bestFitIndex).join('').trim();

  if (!overflowText) {
    return { fitPart: pEl.outerHTML, overflowPart: null };
  }

  const tagName = pEl.tagName.toLowerCase();
  const fitPart = `<${tagName} class="${pEl.className}" style="${pEl.getAttribute('style') || ''}">${fitText}</${tagName}>`;
  const overflowPart = `<${tagName} class="${pEl.className}" style="${pEl.getAttribute('style') || ''}">${overflowText}</${tagName}>`;

  return { fitPart, overflowPart };
}

/**
 * Splits ordered and unordered lists across pages, preserving list numbering
 */
function splitListElement(
  listEl: HTMLElement,
  availableHeight: number
): { fitPart: string | null; overflowPart: string | null } {
  const items = Array.from(listEl.children) as HTMLElement[];
  if (items.length <= 1) {
    return { fitPart: null, overflowPart: listEl.outerHTML };
  }

  const tagName = listEl.tagName.toLowerCase();
  const isOrdered = tagName === 'ol';
  const startAttr = parseInt(listEl.getAttribute('start') || '1', 10);

  const fitItems: string[] = [];
  const overflowItems: string[] = [];
  let currentH = 0;
  let splitOccurred = false;

  items.forEach((item) => {
    const itemH = item.offsetHeight || 24;
    if (!splitOccurred && currentH + itemH <= availableHeight) {
      fitItems.push(item.outerHTML);
      currentH += itemH;
    } else {
      splitOccurred = true;
      overflowItems.push(item.outerHTML);
    }
  });

  if (fitItems.length === 0) {
    return { fitPart: null, overflowPart: listEl.outerHTML };
  }

  const fitPart = `<${tagName} class="${listEl.className}" style="${listEl.getAttribute('style') || ''}" ${isOrdered ? `start="${startAttr}"` : ''}>${fitItems.join('')}</${tagName}>`;
  const overflowPart = overflowItems.length > 0
    ? `<${tagName} class="${listEl.className}" style="${listEl.getAttribute('style') || ''}" ${isOrdered ? `start="${startAttr + fitItems.length}"` : ''}>${overflowItems.join('')}</${tagName}>`
    : null;

  return { fitPart, overflowPart };
}

/**
 * Accurately measures and distributes HTML content across physical pages.
 * Respects headings, tables, lists, images, and manual page breaks.
 */
export function paginateDocument(
  htmlContent: string,
  config: DocumentPageConfig = {
    paperSize: 'a4',
    orientation: 'portrait',
    marginOption: 'normal',
  }
): PaginationResult {
  const layout = computePageLayout(config);

  if (!htmlContent || !htmlContent.trim() || htmlContent === '<p></p>') {
    return {
      pages: ['<p></p>'],
      totalPages: 1,
      layout,
      debugInfo: [
        {
          pageNumber: 1,
          totalElements: 0,
          usedHeightPx: 0,
          maxHeightPx: layout.page1UsableHeightPx,
          remainingHeightPx: layout.page1UsableHeightPx,
          hasOverflow: false,
        },
      ],
    };
  }

  // SSR or non-DOM environment fallback
  if (typeof document === 'undefined') {
    return {
      pages: [htmlContent],
      totalPages: 1,
      layout,
      debugInfo: [],
    };
  }

  // Create an off-screen staging DOM container with exact typography and dimensions
  const offscreen = document.createElement('div');
  offscreen.id = 'hubmind-pagination-staging-engine';
  offscreen.style.position = 'fixed';
  offscreen.style.top = '-99999px';
  offscreen.style.left = '-99999px';
  offscreen.style.width = `${layout.contentWidthPx}px`;
  offscreen.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  offscreen.style.fontSize = '11pt';
  offscreen.style.lineHeight = '1.6';
  offscreen.style.color = '#0f172a';
  offscreen.style.boxSizing = 'border-box';
  offscreen.innerHTML = htmlContent;

  document.body.appendChild(offscreen);

  // Fast check: if entire content fits into Page 1 and contains no explicit page breaks
  const containsExplicitPageBreak = htmlContent.includes('page-break') || htmlContent.includes('<hr');
  const totalRawHeight = offscreen.offsetHeight;

  if (!containsExplicitPageBreak && totalRawHeight <= layout.page1UsableHeightPx) {
    document.body.removeChild(offscreen);
    return {
      pages: [htmlContent],
      totalPages: 1,
      layout,
      debugInfo: [
        {
          pageNumber: 1,
          totalElements: offscreen.children.length,
          usedHeightPx: totalRawHeight,
          maxHeightPx: layout.page1UsableHeightPx,
          remainingHeightPx: Math.max(0, layout.page1UsableHeightPx - totalRawHeight),
          hasOverflow: false,
        },
      ],
    };
  }

  const pages: string[] = [];
  const debugInfo: PageDebugInfo[] = [];

  let currentPageElements: string[] = [];
  let currentAccumulatedHeight = 0;
  let currentPageIndex = 0;
  let elementCountOnCurrentPage = 0;

  const childNodes = Array.from(offscreen.children);

  if (childNodes.length === 0) {
    document.body.removeChild(offscreen);
    return {
      pages: [htmlContent],
      totalPages: 1,
      layout,
      debugInfo: [],
    };
  }

  const processNode = (node: HTMLElement) => {
    const isExplicitBreak =
      node.tagName.toLowerCase() === 'hr' ||
      node.classList.contains('page-break') ||
      node.getAttribute('data-page-break') === 'true';

    const maxAllowedHeight =
      currentPageIndex === 0
        ? layout.page1UsableHeightPx
        : layout.subsequentUsableHeightPx;

    // Handle Manual Page Break
    if (isExplicitBreak) {
      if (currentPageElements.length > 0) {
        pages.push(currentPageElements.join(''));
        debugInfo.push({
          pageNumber: currentPageIndex + 1,
          totalElements: elementCountOnCurrentPage,
          usedHeightPx: currentAccumulatedHeight,
          maxHeightPx: maxAllowedHeight,
          remainingHeightPx: Math.max(0, maxAllowedHeight - currentAccumulatedHeight),
          hasOverflow: false,
        });
        currentPageIndex++;
      }
      currentPageElements = [];
      currentAccumulatedHeight = 0;
      elementCountOnCurrentPage = 0;
      return;
    }

    const computedStyle = window.getComputedStyle(node);
    const marginTop = parseInt(computedStyle.marginTop || '0', 10);
    const marginBottom = parseInt(computedStyle.marginBottom || '0', 10);
    const nodeHeight = node.offsetHeight + marginTop + marginBottom;
    const tagName = node.tagName.toLowerCase();

    // Check for Heading Orphan Prevention (break-after: avoid)
    const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);
    const wouldOrphanHeading = isHeading && currentAccumulatedHeight + nodeHeight + 70 > maxAllowedHeight;

    // 1. Check for Multi-row Table splitting
    if (tagName === 'table' && currentAccumulatedHeight + nodeHeight > maxAllowedHeight) {
      const tableEl = node as HTMLTableElement;
      const remainingHeight = maxAllowedHeight - currentAccumulatedHeight;

      if (remainingHeight > 80) {
        const { fitPart, overflowPart } = splitTableElement(
          tableEl,
          remainingHeight,
          layout.subsequentUsableHeightPx
        );

        if (fitPart) {
          currentPageElements.push(fitPart);
          pages.push(currentPageElements.join(''));
          debugInfo.push({
            pageNumber: currentPageIndex + 1,
            totalElements: elementCountOnCurrentPage + 1,
            usedHeightPx: maxAllowedHeight,
            maxHeightPx: maxAllowedHeight,
            remainingHeightPx: 0,
            hasOverflow: false,
          });

          currentPageIndex++;
          currentPageElements = [];
          currentAccumulatedHeight = 0;
          elementCountOnCurrentPage = 0;

          if (overflowPart) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = overflowPart;
            const overflowTable = tempDiv.firstElementChild as HTMLElement;
            if (overflowTable) {
              processNode(overflowTable);
            }
          }
          return;
        }
      }
    }

    // 2. Check for List splitting (ol, ul)
    if (['ul', 'ol'].includes(tagName) && currentAccumulatedHeight + nodeHeight > maxAllowedHeight) {
      const remainingHeight = maxAllowedHeight - currentAccumulatedHeight;
      if (remainingHeight > 40) {
        const { fitPart, overflowPart } = splitListElement(node, remainingHeight);
        if (fitPart) {
          currentPageElements.push(fitPart);
          pages.push(currentPageElements.join(''));
          debugInfo.push({
            pageNumber: currentPageIndex + 1,
            totalElements: elementCountOnCurrentPage + 1,
            usedHeightPx: maxAllowedHeight,
            maxHeightPx: maxAllowedHeight,
            remainingHeightPx: 0,
            hasOverflow: false,
          });

          currentPageIndex++;
          currentPageElements = [];
          currentAccumulatedHeight = 0;
          elementCountOnCurrentPage = 0;

          if (overflowPart) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = overflowPart;
            const overflowList = tempDiv.firstElementChild as HTMLElement;
            if (overflowList) {
              processNode(overflowList);
            }
          }
          return;
        }
      }
    }

    // 3. Check for Long Paragraph splitting (p, blockquote)
    if (['p', 'blockquote'].includes(tagName) && currentAccumulatedHeight + nodeHeight > maxAllowedHeight) {
      const remainingHeight = maxAllowedHeight - currentAccumulatedHeight;
      if (remainingHeight >= 40) {
        const { fitPart, overflowPart } = splitParagraphElement(node, remainingHeight, layout.contentWidthPx);
        if (fitPart && overflowPart) {
          currentPageElements.push(fitPart);
          pages.push(currentPageElements.join(''));
          debugInfo.push({
            pageNumber: currentPageIndex + 1,
            totalElements: elementCountOnCurrentPage + 1,
            usedHeightPx: maxAllowedHeight,
            maxHeightPx: maxAllowedHeight,
            remainingHeightPx: 0,
            hasOverflow: false,
          });

          currentPageIndex++;
          currentPageElements = [];
          currentAccumulatedHeight = 0;
          elementCountOnCurrentPage = 0;

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = overflowPart;
          const overflowP = tempDiv.firstElementChild as HTMLElement;
          if (overflowP) {
            processNode(overflowP);
          }
          return;
        }
      }
    }

    // Normal element overflow check
    if (
      (currentAccumulatedHeight + nodeHeight > maxAllowedHeight || wouldOrphanHeading) &&
      currentPageElements.length > 0
    ) {
      // Complete current page
      pages.push(currentPageElements.join(''));
      debugInfo.push({
        pageNumber: currentPageIndex + 1,
        totalElements: elementCountOnCurrentPage,
        usedHeightPx: currentAccumulatedHeight,
        maxHeightPx: maxAllowedHeight,
        remainingHeightPx: Math.max(0, maxAllowedHeight - currentAccumulatedHeight),
        hasOverflow: false,
      });

      // Start next page
      currentPageIndex++;
      currentPageElements = [];
      currentAccumulatedHeight = 0;
      elementCountOnCurrentPage = 0;

      // Check if node itself is larger than the entire next page
      const nextMaxHeight = layout.subsequentUsableHeightPx;
      if (['p', 'blockquote'].includes(tagName) && nodeHeight > nextMaxHeight) {
        const { fitPart, overflowPart } = splitParagraphElement(node, nextMaxHeight, layout.contentWidthPx);
        if (fitPart && overflowPart) {
          currentPageElements.push(fitPart);
          pages.push(currentPageElements.join(''));
          debugInfo.push({
            pageNumber: currentPageIndex + 1,
            totalElements: 1,
            usedHeightPx: nextMaxHeight,
            maxHeightPx: nextMaxHeight,
            remainingHeightPx: 0,
            hasOverflow: false,
          });

          currentPageIndex++;
          currentPageElements = [];
          currentAccumulatedHeight = 0;
          elementCountOnCurrentPage = 0;

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = overflowPart;
          const overflowP = tempDiv.firstElementChild as HTMLElement;
          if (overflowP) {
            processNode(overflowP);
          }
          return;
        }
      }

      currentPageElements = [node.outerHTML];
      currentAccumulatedHeight = nodeHeight;
      elementCountOnCurrentPage = 1;
    } else {
      currentPageElements.push(node.outerHTML);
      currentAccumulatedHeight += nodeHeight;
      elementCountOnCurrentPage++;
    }
  };

  childNodes.forEach((child) => {
    processNode(child as HTMLElement);
  });

  if (currentPageElements.length > 0) {
    const maxAllowedHeight =
      currentPageIndex === 0
        ? layout.page1UsableHeightPx
        : layout.subsequentUsableHeightPx;

    pages.push(currentPageElements.join(''));
    debugInfo.push({
      pageNumber: currentPageIndex + 1,
      totalElements: elementCountOnCurrentPage,
      usedHeightPx: currentAccumulatedHeight,
      maxHeightPx: maxAllowedHeight,
      remainingHeightPx: Math.max(0, maxAllowedHeight - currentAccumulatedHeight),
      hasOverflow: false,
    });
  }

  document.body.removeChild(offscreen);

  return {
    pages: pages.length > 0 ? pages : [htmlContent],
    totalPages: Math.max(1, pages.length),
    layout,
    debugInfo,
  };
}

/**
 * Helper compatibility wrapper for legacy callers
 */
export function paginateHtmlContent(
  htmlContent: string,
  pageSize: PaperSizeOption = 'a4',
  orientation: OrientationOption = 'portrait',
  marginOption: MarginOption = 'normal'
): string[] {
  const res = paginateDocument(htmlContent, {
    paperSize: pageSize,
    orientation,
    marginOption,
  });
  return res.pages;
}

/**
 * Calculates exact total page count
 */
export function calculateExactPageCount(
  htmlContent: string,
  pageSize: PaperSizeOption = 'a4',
  orientation: OrientationOption = 'portrait',
  marginOption: MarginOption = 'normal'
): number {
  const res = paginateDocument(htmlContent, {
    paperSize: pageSize,
    orientation,
    marginOption,
  });
  return res.totalPages;
}
