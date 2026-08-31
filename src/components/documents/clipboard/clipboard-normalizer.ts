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

    // Handle actual CR/LF plus literal "\\n"/"\\r" and malformed "/n" sequences.
    if (!/(?:\\r?\\n|\\n|\\r|\/n)/.test(value)) return;

    const parts = value.split(/(?:\\r?\\n|\\n|\\r|\/n)/g);
    const fragment = document.createDocumentFragment();

    parts.forEach((part, index) => {
      if (part) fragment.appendChild(document.createTextNode(part));
      if (index < parts.length - 1) {
        fragment.appendChild(document.createElement('br'));
      }
    });

    textNode.parentNode?.replaceChild(fragment, textNode);
  });
}
