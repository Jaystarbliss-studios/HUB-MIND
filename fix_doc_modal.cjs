const fs = require('fs');
let code = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

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
`;

code = code.replace(/    <\/div>\s*\);\s*}\s*$/, modalCode + "\n    </div>\n  );\n}\n");
fs.writeFileSync('src/pages/Documents.tsx', code);
console.log("Done Documents");
