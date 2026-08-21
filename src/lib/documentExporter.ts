import * as mammoth from 'mammoth';
import { getOfficialLetterheadHTML, getOfficialLetterheadPlainText, REAL_LOGO_SRC } from '../components/documents/OfficialLetterhead';
import { REAL_LOGO_BASE64 } from '../components/documents/logoData';
import { PAGE_CONFIGS, PageSizeOption } from '../pages/DocumentEditor';

export interface ExportOptions {
  pageSize?: PageSizeOption;
  paperTheme?: 'white' | 'dark';
}

/**
 * Builds clean, standalone HTML suitable for printing or PDF rendering
 */
export function buildDocumentHTML(title: string, bodyHtml: string, pageSize: PageSizeOption = 'a4'): string {
  const config = PAGE_CONFIGS[pageSize] || PAGE_CONFIGS.a4;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Document')}</title>
  <style>
    @page {
      size: ${pageSize === 'letter' ? 'letter' : 'A4'} portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .document-page {
      max-width: 100%;
      margin: 0 auto;
    }
    .official-header {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .official-header table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    .official-header td {
      border: none;
      padding: 0;
      vertical-align: middle;
    }
    .logo-cell {
      width: 90px;
      text-align: center;
    }
    .logo-img {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      object-fit: contain;
      filter: grayscale(100%) contrast(140%);
    }
    .info-cell {
      text-align: center;
      padding-left: 12px;
    }
    .inst-title {
      font-size: 17pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000000;
      margin: 0 0 4px 0;
    }
    .inst-line {
      font-size: 9.5pt;
      font-weight: 600;
      color: #334155;
      margin: 0 0 2px 0;
    }
    .inst-links {
      font-size: 9.5pt;
      font-weight: 600;
      color: #0284c7;
      margin: 2px 0 0 0;
    }
    .inst-links a {
      color: #0284c7;
      text-decoration: none;
    }
    .content-body {
      margin-top: 16px;
      color: #0f172a;
    }
    .content-body h1 { font-size: 18pt; font-weight: 700; margin: 18px 0 8px; color: #000000; }
    .content-body h2 { font-size: 15pt; font-weight: 700; margin: 16px 0 6px; color: #0f172a; }
    .content-body h3 { font-size: 13pt; font-weight: 600; margin: 14px 0 6px; color: #1e293b; }
    .content-body p { margin: 0 0 10px 0; }
    .content-body ul, .content-body ol { margin: 0 0 12px 0; padding-left: 24px; }
    .content-body li { margin-bottom: 4px; }
    .content-body blockquote {
      border-left: 4px solid #cbd5e1;
      padding-left: 14px;
      margin: 12px 0;
      color: #475569;
      font-style: italic;
    }
    .content-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      page-break-inside: avoid;
    }
    .content-body th, .content-body td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
    }
    .content-body th {
      background-color: #f1f5f9;
      font-weight: 600;
    }
    .content-body img {
      max-width: 100%;
      height: auto;
      margin: 10px 0;
    }
    .content-body hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
  </style>
</head>
<body>
  <div class="document-page">
    <div class="official-header">
      <table>
        <tr>
          <td class="logo-cell">
            <img src="${REAL_LOGO_BASE64}" class="logo-img" alt="Jaystarbliss Logo" />
          </td>
          <td class="info-cell">
            <div class="inst-title">JAYSTARBLISS DYNAMIC INSTITUTE</div>
            <div class="inst-line">No, 3 Komolafe Street, Cedar County estate, Sangotedo, Lagos state.</div>
            <div class="inst-line">+234 9136518194, +2349130529010</div>
            <div class="inst-links">
              <span>jaystarblissstudios@gmail.com</span> • 
              <span>www.jaystarbliss-studios.name.ng</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div class="content-body">
      ${bodyHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Clean and reliable printing through an isolated iframe
 */
export function printDocumentDirect(title: string, bodyHtml: string, pageSize: PageSizeOption = 'a4'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const existingFrame = document.getElementById('hubmind-print-frame') as HTMLIFrameElement;
      if (existingFrame && existingFrame.parentNode) {
        existingFrame.parentNode.removeChild(existingFrame);
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'hubmind-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        resolve(true);
        return;
      }

      const fullHtml = buildDocumentHTML(title, bodyHtml, pageSize);
      doc.open();
      doc.write(fullHtml);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            resolve(true);
          } catch (e) {
            console.warn('Iframe print error, falling back to window.print', e);
            window.print();
            resolve(true);
          }
        }, 350);
      };
    } catch (err) {
      console.warn('Print direct error, falling back to window.print', err);
      window.print();
      resolve(true);
    }
  });
}

/**
 * Generate real PDF file download using html2pdf.js
 */
export async function exportDocumentAsPDF(
  title: string,
  bodyHtml: string,
  pageSize: PageSizeOption = 'a4',
  onProgress?: (percent: number) => void
): Promise<boolean> {
  try {
    if (onProgress) onProgress(10);
    // @ts-ignore
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;

    if (onProgress) onProgress(30);

    // Create a hidden container formatted specifically for PDF rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = pageSize === 'letter' ? '816px' : '794px';
    container.style.padding = '32px';
    container.style.background = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = 'Arial, sans-serif';

    container.innerHTML = `
      <div style="width: 100%;">
        ${getOfficialLetterheadHTML()}
        <div style="margin-top: 20px; font-size: 11pt; line-height: 1.6; color: #0f172a;">
          ${bodyHtml}
        </div>
      </div>
    `;

    document.body.appendChild(container);
    if (onProgress) onProgress(50);

    const safeTitle = (title || 'Document').replace(/[^a-z0-9_\-\s]/gi, '_');

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${safeTitle}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
      },
      jsPDF: {
        unit: 'mm',
        format: pageSize === 'letter' ? 'letter' : 'a4',
        orientation: 'portrait',
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    if (onProgress) onProgress(75);
    await (html2pdf as any)().set(opt).from(container).save();

    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (onProgress) onProgress(100);
    return true;
  } catch (error) {
    console.error('Error generating PDF via html2pdf:', error);
    // Fallback: Trigger direct print as PDF
    await printDocumentDirect(title, bodyHtml, pageSize);
    return false;
  }
}

/**
 * Export as Word (.docx)
 */
export async function exportDocumentAsDOCX(title: string, bodyHtml: string): Promise<boolean> {
  const safeTitle = (title || 'Document').replace(/[^a-z0-9_\-\s]/gi, '_');
  try {
    // @ts-ignore
    const htmlToDocx = (await import('html-to-docx')).default;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${getOfficialLetterheadHTML()}<div style="margin-top: 16px;">${bodyHtml}</div></body></html>`;
    const blob = await htmlToDocx(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('Failed to export DOCX, falling back to .doc format', e);
    const docHTML = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title || 'Document'}</title></head><body>${getOfficialLetterheadHTML()}<div style="margin-top: 16px;">${bodyHtml}</div></body></html>`;
    const blob = new Blob([docHTML], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
}

/**
 * Export as HTML file
 */
export function exportDocumentAsHTML(title: string, bodyHtml: string, pageSize: PageSizeOption = 'a4'): boolean {
  const safeTitle = (title || 'Document').replace(/[^a-z0-9_\-\s]/gi, '_');
  const fullHtml = buildDocumentHTML(title, bodyHtml, pageSize);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.html`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Export as Text file
 */
export function exportDocumentAsTXT(title: string, textContent: string): boolean {
  const safeTitle = (title || 'Document').replace(/[^a-z0-9_\-\s]/gi, '_');
  const fullText = getOfficialLetterheadPlainText() + '\n\n' + textContent;
  const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
