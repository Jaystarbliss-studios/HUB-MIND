const fs = require('fs');
let code = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

// Add useNavigate
if (!code.includes('useNavigate')) {
  code = code.replace(/import \{ Link \} from 'react-router-dom';/, "import { Link, useNavigate } from 'react-router-dom';");
}

// Inside Documents component
code = code.replace(/const \[loading, setLoading\] = useState\(true\);/, "const [loading, setLoading] = useState(true);\n  const navigate = useNavigate();");

const addCreateDocMethod = `
  const handleCreateDocument = async () => {
    if (!profile) return;
    try {
      const newDocRef = await addDoc(collection(db, 'documents'), {
        title: 'Untitled Document',
        type: 'internal',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
        category: 'other',
        ownerId: profile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      navigate('/documents/' + newDocRef.id);
    } catch (error) {
      console.error('Error creating doc:', error);
    }
  };
`;

code = code.replace(/useEffect\(\(\) => \{/, addCreateDocMethod + "\n  useEffect(() => {");

const buttonReplacement = `
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(profile?.role === 'admin' || profile?.role === 'assistant') && (
            <>
              <button 
                onClick={handleCreateDocument}
                className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Create Document
              </button>
              <button 
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                {showUploadForm ? 'Cancel Upload' : 'Upload File'}
              </button>
            </>
          )}
        </div>
`;

code = code.replace(/\{\(profile\?\.role === 'admin' \|\| profile\?\.role === 'assistant'\) && \([\s\S]*?<\/button>\s*\)\}/, buttonReplacement);

const openButtonReplacement = `
                      {doc.type === 'internal' ? (
                        <button 
                          onClick={() => navigate('/documents/' + doc.id)}
                          className="flex items-center gap-2 text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Open Editor
                        </button>
                      ) : (
                        <a 
                           href={doc.fileRef} 
                           target="_blank" 
                           rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm font-bold text-slate-950 bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          View File <ExternalLink className="w-4 h-4 hidden sm:inline" />
                        </a>
                      )}
`;

code = code.replace(/<a \s*href=\{doc\.fileRef\} \s*target="_blank" \s*rel="noopener noreferrer"\s*className="flex items-center gap-2 text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap"\s*>\s*Open <ExternalLink className="w-4 h-4 hidden sm:inline" \/>\s*<\/a>/, openButtonReplacement);

fs.writeFileSync('src/pages/Documents.tsx', code);
