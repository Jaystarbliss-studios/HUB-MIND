import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { FontFamily } from '@tiptap/extension-font-family';
import { FontSize } from '../lib/FontSize';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { CharacterCount } from '@tiptap/extension-character-count';
import { DocumentToolbar } from '../components/documents/DocumentToolbar';
import { ImportExportMenu } from '../components/documents/ImportExportMenu';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ArrowLeft, Loader2, Save, MoreVertical, FileText } from 'lucide-react';

export function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [docMeta, setDocMeta] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Superscript,
      Subscript,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setSaveStatus('saving');
      const json = editor.getJSON();
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        saveDocument(json);
      }, 2000); // Autosave after 2 seconds of inactivity
    },
  });

  const saveDocument = async (content: any) => {
    if (!id) return;
    try {
      setSaveStatus('saving');
      await updateDoc(doc(db, 'documents', id), {
        content: JSON.stringify(content),
        updatedAt: new Date().toISOString()
      });
      setSaveStatus('saved');
    } catch (error) {
      console.error('Error saving document:', error);
      setSaveStatus('error');
    }
  };

  useEffect(() => {
    const fetchDoc = async () => {
      if (!id || !editor) return;
      try {
        const docRef = doc(db, 'documents', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDocMeta(data);
          if (data.content) {
            editor.commands.setContent(JSON.parse(data.content));
          }
        } else {
          // Document not found
          navigate('/documents');
        }
      } catch (error) {
        console.error('Error fetching document:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [id, editor, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between p-2 md:p-4 border-b border-slate-800 bg-slate-950 shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => navigate('/documents')}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-accent/20 rounded text-accent hidden sm:block">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <input 
                type="text" 
                value={docMeta?.title || 'Untitled Document'}
                onChange={(e) => {
                  setDocMeta({ ...docMeta, title: e.target.value });
                  updateDoc(doc(db, 'documents', id!), { title: e.target.value });
                }}
                className="bg-transparent text-slate-200 font-semibold focus:outline-none focus:border-b border-accent px-1 truncate w-40 sm:w-64"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <ImportExportMenu editor={editor} docTitle={docMeta?.title || 'Untitled Document'} />
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
            {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>}
            {saveStatus === 'saved' && <><Save className="w-3 h-3" /> Saved to cloud</>}
            {saveStatus === 'error' && <span className="text-red-400">Save failed</span>}
          </div>
          <button className="text-slate-400 hover:text-white p-2">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
        {editor && <DocumentToolbar editor={editor} />}
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-950/50">
          <div className="w-full max-w-4xl">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="h-8 border-t border-slate-800 bg-slate-950 flex items-center justify-between px-4 text-[10px] text-slate-500 uppercase tracking-wider shrink-0">
        <div className="flex items-center gap-4">
          <span>{editor?.storage.characterCount?.words() || 0} words</span>
          <span>{editor?.storage.characterCount?.characters() || 0} characters</span>
        </div>
        <div>
          {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
        </div>
      </div>
    </div>
  );
}
