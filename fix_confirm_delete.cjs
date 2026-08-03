const fs = require('fs');
let content = fs.readFileSync('src/pages/ClientDetail.tsx', 'utf8');

// Use Radix Dialog instead of window.confirm
if (content.includes('window.confirm')) {
  content = content.replace(
    /import \{ Loader2, ArrowLeft/g,
    "import * as Dialog from '@radix-ui/react-dialog';\nimport { X } from 'lucide-react';\nimport { Loader2, ArrowLeft"
  );

  content = content.replace(
    /const \[isDeleting, setIsDeleting\] = useState\(false\);/,
    "const [isDeleting, setIsDeleting] = useState(false);\n  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);"
  );

  content = content.replace(
    /if \(!window\.confirm\('Are you sure you want to delete this client\? This cannot be undone\.'\)\) return;/,
    ""
  );

  content = content.replace(
    /setShowDeleteConfirm\(true\)/g,
    "" // in case it was there
  );

  content = content.replace(
    /<button onClick=\{handleDelete\}/,
    "<button onClick={() => setShowDeleteConfirm(true)}"
  );

  const deleteDialog = `
      <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl z-50 focus:outline-none">
            <Dialog.Title className="text-xl font-bold text-white mb-2">Delete Client</Dialog.Title>
            <Dialog.Description className="text-slate-400 mb-6">
              Are you sure you want to delete this client? This action cannot be undone and will not automatically delete related tasks or meetings.
            </Dialog.Description>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 font-semibold text-slate-300 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  `;

  content = content.replace(
    /<\/div>\s*<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shrink-0">/,
    '</div>\n' + deleteDialog + '\n      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shrink-0">'
  );

  fs.writeFileSync('src/pages/ClientDetail.tsx', content);
  console.log('ClientDetail fixed confirm');
}
