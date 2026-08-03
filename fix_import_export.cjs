const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

const driveUploadCode = `
import { driveConfig } from '../../driveConfig';

  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveClient, setDriveClient] = useState<any>(null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState(false);

  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // @ts-ignore
      const tokenClient = google.accounts.oauth2.initTokenClient({
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
    return () => { document.body.removeChild(script); };
  }, []);

  const handleDriveExport = async () => {
    if (!driveToken) {
      if (driveClient) driveClient.requestAccessToken();
      return;
    }
    
    setIsUploadingDrive(true);
    setDriveError(null);
    setDriveSuccess(false);
    
    const html = editor.getHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const metadata = {
      name: \`\${docTitle || 'Document'}.html\`,
      mimeType: 'text/html',
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    
    try {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: { Authorization: \`Bearer \${driveToken}\` },
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
`;

code = code.replace(
  "import { Download, Upload, FileText, File, Code, FileImage, Loader2 } from 'lucide-react';",
  "import { Download, Upload, FileText, File, Code, FileImage, Loader2, Cloud } from 'lucide-react';"
);

code = code.replace(
  "const [isImporting, setIsImporting] = useState(false);",
  driveUploadCode.split('import { driveConfig }')[1] + "\n  const [isImporting, setIsImporting] = useState(false);"
);

code = "import { driveConfig } from '../../driveConfig';\n" + code;

const buttonDriveCode = `
          <button onClick={handleDriveExport} disabled={isUploadingDrive} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            {isUploadingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} 
            {isUploadingDrive ? 'Uploading...' : (!driveToken ? 'Connect Drive' : 'Save to Drive')}
          </button>
          {driveSuccess && <div className="px-4 py-1 text-xs text-green-400">Upload Successful!</div>}
          {driveError && <div className="px-4 py-1 text-xs text-red-400">{driveError}</div>}
`;

code = code.replace(
  /<button onClick=\{handleExportTXT\}[\s\S]*?<\/button>/,
  "$&" + buttonDriveCode
);

fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
