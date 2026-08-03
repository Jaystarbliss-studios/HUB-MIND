const fs = require('fs');
let content = fs.readFileSync('src/pages/Knowledge.tsx', 'utf8');

// import deleteDoc and doc
if (!content.includes('deleteDoc')) {
  content = content.replace(
    /import \{ collection, query, orderBy, getDocs, addDoc \} from 'firebase\/firestore';/,
    "import { collection, query, orderBy, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';"
  );
  
  content = content.replace(
    /import \{ Loader2, Plus, Book, Search, FileText, Bookmark \} from 'lucide-react';/,
    "import { Loader2, Plus, Book, Search, FileText, Bookmark, Trash2 } from 'lucide-react';"
  );
  
  const deleteFunc = `
  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    try {
      await deleteDoc(doc(db, 'knowledge', id));
      await logActivity(id, 'knowledge', 'deleted knowledge article', title, profile?.name || 'User');
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting knowledge", error);
    }
  };
  `;
  
  content = content.replace(
    /const filtered = items\.filter/,
    deleteFunc + '\n  const filtered = items.filter'
  );
  
  const deleteButton = `
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
  `;
  
  content = content.replace(
    /<span className="text-xs text-slate-500">\{format\(parseISO\(item\.createdAt\), 'MMM d, yyyy'\)\}<\/span>/,
    '<span className="text-xs text-slate-500">{format(parseISO(item.createdAt), \'MMM d, yyyy\')}</span>\n                ' + deleteButton
  );

  fs.writeFileSync('src/pages/Knowledge.tsx', content);
  console.log('Knowledge updated');
} else {
  console.log('Already updated');
}
