const fs = require('fs');
let code = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

const handleDuplicateCode = `
  const handleDuplicateDoc = async (docToDuplicate: DocumentInfo) => {
    if (!profile) return;
    try {
      const { ...docData } = docToDuplicate;
      delete (docData as any).id;
      
      const newDocRef = await addDoc(collection(db, 'documents'), {
        ...docData,
        title: \`\${docData.title} (Copy)\`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: profile.id
      });
      // Optionally redirect to it, or just let the list update
    } catch (error) {
      console.error('Error duplicating doc:', error);
    }
  };
`;

code = code.replace(
  "const handleDeleteDoc = async (id: string) => {",
  handleDuplicateCode + "\n  const handleDeleteDoc = async (id: string) => {"
);

// Add the Copy button next to Edit
const copyButtonReplacement = `
                          <button 
                            onClick={() => handleDuplicateDoc(doc)}
                            title="Duplicate"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { setEditingDocId(doc.id); setEditTitle(doc.title); }}
`;
code = code.replace(
  /<button\s*onClick=\{\(\) => \{ setEditingDocId\(doc\.id\); setEditTitle\(doc\.title\); \}\}/,
  copyButtonReplacement
);

fs.writeFileSync('src/pages/Documents.tsx', code);
