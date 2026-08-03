const fs = require('fs');
let code = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

// add state for delete confirmation
if (!code.includes('docToDelete')) {
  code = code.replace(
    "const [deletingId, setDeletingId] = useState<string | null>(null);",
    "const [deletingId, setDeletingId] = useState<string | null>(null);\n  const [docToDelete, setDocToDelete] = useState<string | null>(null);"
  );

  // change handleDeleteDoc to actually just do the delete, and create a prompt method
  code = code.replace(
    "const handleDeleteDoc = async (id: string) => {\n    // Removed window.confirm due to iframe restrictions",
    "const confirmDelete = (id: string) => { setDocToDelete(id); };\n  const handleDeleteDoc = async (id: string) => {\n    setDocToDelete(null);\n"
  );

  // replace the onClick on the trash button
  code = code.replace(
    /onClick=\{\(\) => handleDeleteDoc\(doc\.id\)\}/g,
    "onClick={() => confirmDelete(doc.id)}"
  );

  // add the modal to the bottom
  const modalCode = `
      {docToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Document</h3>
            <p className="text-sm text-slate-300 mb-6">Are you sure you want to delete this document? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteDoc(docToDelete)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;
  code = code.replace(
    /    <\/div>\n  \);\n\}$/,
    modalCode
  );

  fs.writeFileSync('src/pages/Documents.tsx', code);
}
