import { driveConfig, initDriveConfig } from '../../driveConfig'; 
import React, { useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { Download, Upload, FileText, File, Code, FileImage, Loader2, Cloud, Eye, Printer } from 'lucide-react';
import * as mammoth from 'mammoth';
import { 
  exportDocumentAsPDF, 
  exportDocumentAsDOCX, 
  exportDocumentAsHTML, 
  exportDocumentAsTXT, 
  printDocumentDirect 
} from '../../lib/documentExporter';
import { getOfficialLetterheadHTML } from './OfficialLetterhead';

interface ImportExportMenuProps {
  editor: Editor;
  docTitle: string;
  onOpenPreview?: () => void;
}

export function ImportExportMenu({ editor, docTitle, onOpenPreview }: ImportExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingDOCX, setIsExportingDOCX] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
   

  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveClient, setDriveClient] = useState<any>(null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState(false);

  React.useEffect(() => {
    let isMounted = true;
    async function loadScript() {
      await initDriveConfig();
      if (!isMounted) return;
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // @ts-ignore
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: driveConfig.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.error !== undefined) {
              setDriveError(response.error);
              return;
            }
            setDriveToken(response.access_token);
          },
        });
        setDriveClient(tokenClient);
      };
      document.body.appendChild(script);
    }
    loadScript();
    return () => {
      isMounted = false;
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const handleDriveExport = async () => {
    if (!driveToken) {
      if (driveClient) driveClient.requestAccessToken();
      return;
    }
    
    setIsUploadingDrive(true);
    setDriveError(null);
    setDriveSuccess(false);
    
    const bodyHtml = editor.getHTML();
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docTitle || 'Document'}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #111827; }
    img { max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; }
  </style>
</head>
<body>
  ${getOfficialLetterheadHTML()}
  <div class="document-content">
    ${bodyHtml}
  </div>
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const metadata = {
      name: `${docTitle || 'Document'}.html`,
      mimeType: 'text/html',
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    
    try {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${driveToken}` },
        body: form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Upload failed");
      setDriveSuccess(true);
      setTimeout(() => setIsOpen(false), 2000);
    } catch (err: any) {
      setDriveError(err.message || "Failed to upload document");
    } finally {
      setIsUploadingDrive(false);
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  
  const handleExportDOCX = async () => {
    setIsExportingDOCX(true);
    try {
      await exportDocumentAsDOCX(editor.getHTML(), docTitle || 'Document');
    } catch (e) {
      console.error('Failed to export DOCX', e);
    } finally {
      setIsExportingDOCX(false);
      setIsOpen(false);
    }
  };

  const handleExportHTML = () => {
    exportDocumentAsHTML(editor.getHTML(), docTitle || 'Document');
    setIsOpen(false);
  };

  const handleExportTXT = () => {
    exportDocumentAsTXT(editor.getText(), docTitle || 'Document');
    setIsOpen(false);
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportDocumentAsPDF(editor.getHTML(), docTitle || 'Document');
    } catch (e) {
      console.error('Failed to export PDF', e);
    } finally {
      setIsExportingPDF(false);
      setIsOpen(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setIsOpen(false);

    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        editor.commands.setContent(`<p>${text.replace(/\n/g, '<br>')}</p>`);
      } else if (file.type === 'text/html' || file.name.endsWith('.html')) {
        const html = await file.text();
        editor.commands.setContent(html);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const options = {
          convertImage: mammoth.images.imgElement(function(image) {
            return image.read("base64").then(function(imageBuffer) {
              return {
                src: "data:" + image.contentType + ";base64," + imageBuffer
              };
            });
          }),
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Heading 6'] => h6:fresh",
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
            "p[style-name='Normal'] => p:fresh",
          ],
          includeDefaultStyleMap: true
        };
        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
        editor.commands.setContent(result.value);
      } else {
        setDriveError('Unsupported file format'); setTimeout(() => setDriveError(null), 3000);
      }
    } catch (error) {
      console.error("Import error:", error);
      setDriveError('Failed to import document'); setTimeout(() => setDriveError(null), 3000);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">File</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
          <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preview & Export</div>
          
          {onOpenPreview && (
            <button 
              onClick={() => {
                onOpenPreview();
                setIsOpen(false);
              }} 
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-cyan-300 hover:bg-slate-700 hover:text-white transition-colors font-medium"
            >
              <Eye className="w-4 h-4 text-cyan-400" /> Full Page Preview & Print
            </button>
          )}

          <button 
            onClick={handleExportPDF} 
            disabled={isExportingPDF}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <FileImage className="w-4 h-4 text-red-400" />}
            <span>{isExportingPDF ? 'Generating PDF...' : 'Download as PDF'}</span>
          </button>

          <button 
            onClick={handleExportDOCX} 
            disabled={isExportingDOCX}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {isExportingDOCX ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <FileText className="w-4 h-4 text-blue-400" />}
            <span>{isExportingDOCX ? 'Generating DOCX...' : 'Download as DOCX'}</span>
          </button>
          <button onClick={handleExportHTML} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            <Code className="w-4 h-4" /> As HTML
          </button>
          <button onClick={handleExportTXT} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            <FileText className="w-4 h-4" /> As TXT
          </button>
          <button onClick={handleDriveExport} disabled={isUploadingDrive} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            {isUploadingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} 
            {isUploadingDrive ? 'Uploading...' : (!driveToken ? 'Connect Drive' : 'Save to Drive')}
          </button>
          {driveSuccess && <div className="px-4 py-1 text-xs text-green-400">Upload Successful!</div>}
          {driveError && <div className="px-4 py-1 text-xs text-red-400">{driveError}</div>}

          
          <div className="my-1 border-t border-slate-700"></div>
          
          <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Import</div>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isImporting ? 'Importing...' : 'Upload File (DOCX, TXT, HTML)'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".docx,.txt,.html" 
            className="hidden" 
          />
        </div>
      )}
    </div>
  );
}
