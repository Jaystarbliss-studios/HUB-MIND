import React, { useState, useEffect } from 'react';
import { UploadCloud, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { driveConfig, initDriveConfig } from '../driveConfig';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DriveUploadProps {
  onUploadSuccess: (webViewLink: string, fileId: string) => void;
  className?: string;
  label?: string;
}

export function DriveUpload({ onUploadSuccess, className, label = "Upload to Drive" }: DriveUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);
  
  useEffect(() => {
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
              setError(response.error);
              return;
            }
            setToken(response.access_token);
          },
        });
        setClient(tokenClient);
      };
      document.body.appendChild(script);
    }
    
    loadScript();
    
    return () => {
      isMounted = false;
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const requestAuth = () => {
    if (client) {
      client.requestAccessToken();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) {
      setError("Please authenticate with Google first.");
      return;
    }

    setUploading(true);
    setError(null);

    const metadata = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Upload failed");
      }

      onUploadSuccess(data.webViewLink, data.id);
    } catch (err: any) {
      setError(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      {!token ? (
        <button
          type="button"
          onClick={requestAuth}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-sm font-medium transition-colors"
        >
          <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" alt="Drive" className="w-4 h-4" />
          Connect Google Drive
        </button>
      ) : (
        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md cursor-pointer text-sm font-medium transition-colors">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <UploadCloud className="w-4 h-4" />}
          <span>{uploading ? "Uploading..." : label}</span>
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}
      
      {error && <p className="text-red-400 text-xs max-w-xs">{error}</p>}
      
      {token && !uploading && !error && (
        <p className="text-accent text-xs flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Drive Connected
        </p>
      )}
      <p className="text-slate-500 text-xs flex items-center gap-1">
        <FileText className="w-3 h-3" /> Any document type supported
      </p>
    </div>
  );
}
