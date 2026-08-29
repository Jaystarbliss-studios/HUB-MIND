import { filterSafeStyles } from './clipboard-sanitizer';

/**
 * Normalizes foreign HTML (Word, Teams, Google Docs, ChatGPT, Webpages)
 * into clean, semantic, Hub-Mind/TipTap compatible HTML.
 */
export function normalizeClipboardHtml(sanitizedHtml: string, source: string): string {
  if (!sanitizedHtml) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizedHtml, 'text/html');
  const body = doc.body;

  // Step 1: Remove Office XML/MSO comments & conditional blocks
  removeOfficeComments(body);

  // Step 1b: Convert escaped line-break sequences (\\n, /n, etc.) into real document breaks.
  // Some generated/template content arrives as literal text rather than HTML line breaks.
  normalizeEscapedLineBreaks(body);

  // Step 2: Resolve named paragraph styles and block-level Word/Google Docs formatting.
  normalizeParagraphStyles(body);

  // Step 2: Handle Microsoft Word lists (MsoListParagraph / mso-list)
  normalizeWordLists(body);

  // Step 3: Handle Google Docs wrappers
  normalizeGoogleDocsWrappers(body);

  // Step 4: Traverse and normalize elements recursively
  normalizeNodeTree(body);

  // Step 5: Clean up empty formatting tags and redundant spans
  cleanRedundantElements(body);

  return body.innerHTML;
}

/**
 * Strips HTML comment nodes and Word specific pseudo-comments
 */
function normalizeEscapedLineBreaks(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  nodes.forEach((textNode) => {
    const value = textNode.nodeValue || '';
    if (!/(?:\\r?\\n|\/n|\\r)/.test(value)) return;

    const parts = value.split(/(?:\\r?\\n|\/n|\\r)/g);
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (part) fragment.appendChild(document.createTextNode(part));
      if (index < parts.length - 1) fragment.appendChild(document.createElement('br'));
    });
    textNode.parentNode?.replaceChild(fragment, textNode);
  });
}

function removeOfficeComments(root: HTMLElement) {
  const iterator = document.createNodeIterator(root, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  let current: Node | null;
  while ((current = iterator.nextNode())) {
    comments.push(current as Comment);
  }
  for (const c of comments) {
    if (c.parentNode) {
      c.parentNode.removeChild(c);
    }
  }
}

/**
 * Google Docs frequently wraps the entire clipboard in a <b id="docs-internal-guid-..." style="font-weight:normal">
 * which would otherwise cause everything to become bold or misformatted.
 */
function normalizeGoogleDocsWrappers(root: HTMLElement) {
  const googleWrappers = root.querySelectorAll('b[id^="docs-internal-guid"], span[id^="docs-internal-guid"]');
  googleWrappers.forEach((el) => {
    const style = el.getAttribute('style') || '';
    if (style.includes('font-weight:normal') || style.includes('font-weight: normal') || style.includes('font-weight:400')) {
      // Unwrap the element, keeping its children
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    }
  });
}

/**
 * Microsoft Word exports lists as ordinary <p class="MsoListParagraph"> with symbol spans.
 * This converts them into real semantic <ul> and <ol> elements.
 */

function normalizeParagraphStyles(root: HTMLElement) {
  const blocks = Array.from(root.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6'));
  blocks.forEach((el) => {
    const style = el.getAttribute('style') || '';
    const className = el.getAttribute('class') || '';
    const combined = `${className} ${style}`.toLowerCase();

    // Word named styles frequently survive as class/style metadata rather than semantic headings.
    const headingMatch = combined.match(/(?:^|[ ._-])heading\s*([1-9])(?:$|[ ._-])/i);
    if (headingMatch && /^p|^div$/i.test(el.tagName)) {
      const heading = document.createElement(`h${Math.min(6, Number(headingMatch[1]))}`);
      copyAttributes(el, heading);
      while (el.firstChild) heading.appendChild(el.firstChild);
      el.parentNode?.replaceChild(heading, el);
      return;
    }

    // Preserve paragraph alignment and indentation even when the source used HTML align attributes.
    const align = el.getAttribute('align');
    if (align && !/text-align\s*:/i.test(style)) {
      el.style.textAlign = align;
    }

    // Convert common Word break controls into a stable marker that survives HTML import.
    if (/page-break-(?:before|after)\s*:\s*(?:always|page|left|right)|break-(?:before|after)\s*:\s*page/i.test(style)) {
      el.setAttribute('data-hubmind-page-break', 'true');
    }
  });
}

function copyAttributes(from: HTMLElement, to: HTMLElement) {
  Array.from(from.attributes).forEach((attr) => {
    if (attr.name !== 'class') to.setAttribute(attr.name, attr.value);
  });
}

function normalizeWordLists(root: HTMLElement) {
  const listParagraphs = Array.from(root.querySelectorAll('p[class*="MsoList"], p[style*="mso-list"]'));
  if (listParagraphs.length === 0) return;

  let currentList: HTMLElement | null = null;
  let currentListType: 'ul' | 'ol' = 'ul';

  listParagraphs.forEach((p) => {
    const textContent = p.textContent || '';
    const styleAttr = p.getAttribute('style') || '';
    const isOrdered = /^\s*\d+[\.\)]/i.test(textContent) || styleAttr.includes('level1 lfo');

    // Determine if we need to start a new list
    const desiredType = isOrdered ? 'ol' : 'ul';
    if (!currentList || currentListType !== desiredType || p.previousElementSibling !== currentList) {
      currentList = document.createElement(desiredType);
      currentListType = desiredType;
      p.parentNode?.insertBefore(currentList, p);
    }

    // Strip bullet symbols or number prefixes from the first span or text
    const li = document.createElement('li');
    
    // Clone children into li
    while (p.firstChild) {
      li.appendChild(p.firstChild);
    }

    // Clean leading bullet bullet chars (·, o, §, numbers) from the li
    cleanLeadingBulletSymbol(li);

    currentList.appendChild(li);
    p.parentNode?.removeChild(p);
  });
}

function cleanLeadingBulletSymbol(li: HTMLElement) {
  const firstChild = li.firstChild;
  if (!firstChild) return;

  if (firstChild.nodeType === Node.ELEMENT_NODE) {
    const el = firstChild as HTMLElement;
    const style = el.getAttribute('style') || '';
    if (style.includes('mso-list:Ignore') || el.className.includes('mso-list-ignore') || /^[\u00b7\u2022\u2013\u25aa\u25cf\u25cb\d+\.\)]+$/.test(el.textContent?.trim() || '')) {
      li.removeChild(el);
      return;
    }
  }

  if (firstChild.nodeType === Node.TEXT_NODE && firstChild.textContent) {
    firstChild.textContent = firstChild.textContent.replace(/^[\s\u00b7\u2022\u2013\u25aa\u25cf\u25cb\d+\.\)]+/, '').trimStart();
  }
}

/**
 * Traverses every node and applies semantic normalization
 */
function normalizeNodeTree(node: Node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // 1. Clean style attribute with safe properties
    const styleAttr = el.getAttribute('style');
    if (styleAttr) {
      const cleanedStyle = filterSafeStyles(styleAttr);
      if (cleanedStyle) {
        el.setAttribute('style', cleanedStyle);
      } else {
        el.removeAttribute('style');
      }
    }

    // 2. Remove Word specific classes
    if (el.className) {
      const cleanClass = el.className.replace(/\b(Mso\w+|apple-converted-space)\b/g, '').trim();
      if (cleanClass) {
        el.className = cleanClass;
      } else {
        el.removeAttribute('class');
      }
    }

    // 3. Normalize Font tags: <font color="red" face="Arial" size="4">
    if (tagName === 'font') {
      const span = document.createElement('span');
      let styles = '';
      if (el.getAttribute('color')) styles += `color: ${el.getAttribute('color')}; `;
      if (el.getAttribute('face')) styles += `font-family: ${el.getAttribute('face')}; `;
      if (el.getAttribute('size')) {
        const sizeMap: Record<string, string> = { '1': '10px', '2': '12px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };
        const s = el.getAttribute('size') || '3';
        styles += `font-size: ${sizeMap[s] || '16px'}; `;
      }
      if (styles) span.setAttribute('style', styles.trim());
      replaceElement(el, span);
      normalizeNodeTree(span);
      return;
    }

    // 4. Normalize <b> to <strong> and <i> to <em>
    if (tagName === 'b') {
      const strong = document.createElement('strong');
      replaceElement(el, strong);
      normalizeNodeTree(strong);
      return;
    }
    if (tagName === 'i') {
      const em = document.createElement('em');
      replaceElement(el, em);
      normalizeNodeTree(em);
      return;
    }
    if (tagName === 'strike' || tagName === 'del') {
      const s = document.createElement('s');
      replaceElement(el, s);
      normalizeNodeTree(s);
      return;
    }

    // 5. Convert inline styles in spans to semantic tags if cleaner
    if (tagName === 'span') {
      const style = el.getAttribute('style') || '';
      if (/font-weight:\s*(bold|[789]\d\d)/i.test(style) && !el.querySelector('strong, b')) {
        const strong = document.createElement('strong');
        wrapChildren(el, strong);
      }
      if (/font-style:\s*italic/i.test(style) && !el.querySelector('em, i')) {
        const em = document.createElement('em');
        wrapChildren(el, em);
      }
      if (/text-decoration(-line)?:\s*underline/i.test(style) && !el.querySelector('u')) {
        const u = document.createElement('u');
        wrapChildren(el, u);
      }
      if (/text-decoration(-line)?:\s*line-through/i.test(style) && !el.querySelector('s, strike, del')) {
        const s = document.createElement('s');
        wrapChildren(el, s);
      }
    }

    // 6. Normalize Tables
    if (tagName === 'table') {
      normalizeTableElement(el as HTMLTableElement);
    }

    // 7. Normalize Links
    if (tagName === 'a') {
      normalizeLinkElement(el as HTMLAnchorElement);
    }

    // 8. Normalize Divs to Paragraphs if they contain inline content
    if (tagName === 'div' && !hasBlockChild(el)) {
      const p = document.createElement('p');
      const style = el.getAttribute('style');
      if (style) p.setAttribute('style', style);
      replaceElement(el, p);
      normalizeNodeTree(p);
      return;
    }
  }

  // Recurse over children
  let child = node.firstChild;
  while (child) {
    const next = child.nextSibling;
    normalizeNodeTree(child);
    child = next;
  }
}

function normalizeTableElement(table: HTMLTableElement) {
  // Ensure tbody exists
  let tbody = table.querySelector('tbody');
  if (!tbody) {
    const trs = Array.from(table.querySelectorAll('tr'));
    if (trs.length > 0) {
      tbody = document.createElement('tbody');
      trs.forEach((tr) => tbody!.appendChild(tr));
      table.appendChild(tbody);
    }
  }

  // Clean empty tables or non-table tags inside table
  const cells = table.querySelectorAll('th, td');
  cells.forEach((cell) => {
    // Ensure cells have content or at least a <p></p>
    if (!cell.hasChildNodes() || (cell.textContent?.trim() === '' && !cell.querySelector('img, br'))) {
      cell.innerHTML = '<p></p>';
    }
  });
}

function normalizeLinkElement(a: HTMLAnchorElement) {
  const href = a.getAttribute('href') || '';
  if (!href || href.startsWith('javascript:') || href.startsWith('vbscript:')) {
    // Unwrap invalid links
    const parent = a.parentNode;
    if (parent) {
      while (a.firstChild) {
        parent.insertBefore(a.firstChild, a);
      }
      parent.removeChild(a);
    }
    return;
  }

  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener noreferrer nofollow');
}

function hasBlockChild(el: HTMLElement): boolean {
  const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'pre', 'hr'];
  for (let i = 0; i < el.children.length; i++) {
    if (blockTags.includes(el.children[i].tagName.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function replaceElement(oldEl: HTMLElement, newEl: HTMLElement) {
  while (oldEl.firstChild) {
    newEl.appendChild(oldEl.firstChild);
  }
  if (oldEl.parentNode) {
    oldEl.parentNode.replaceChild(newEl, oldEl);
  }
}

function wrapChildren(el: HTMLElement, wrapper: HTMLElement) {
  while (el.firstChild) {
    wrapper.appendChild(el.firstChild);
  }
  el.appendChild(wrapper);
}

function cleanRedundantElements(root: HTMLElement) {
  // Remove spans with no attributes
  const spans = Array.from(root.querySelectorAll('span'));
  spans.forEach((span) => {
    if (span.attributes.length === 0) {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      }
    }
  });
}
function normalizeEscapedLineBreaks(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  nodes.forEach((textNode) => {
    const value = textNode.nodeValue || '';
    if (!/(?:\\\\r?\\\\n|\\/n|\\\\r)/.test(value)) return;

    const parts = value.split(/(?:\\\\r?\\\\n|\\/n|\\\\r)/g);
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (part) fragment.appendChild(document.createTextNode(part));
      if (index < parts.length - 1) fragment.appendChild(document.createElement('br'));
    });
    textNode.parentNode?.replaceChild(fragment, textNode);
  });
}

