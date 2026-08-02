const fs = require('fs');

let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

// Add Book to imports
content = content.replace(/Archive, CheckSquare, Users, Calendar, ArrowRight/,
  "Archive, CheckSquare, Users, Calendar, ArrowRight, Book");

// Add convertToKnowledge
const convertToKnowledge = `
  const convertToKnowledge = async (item: InboxItem) => {
    setProcessingId(item.id);
    try {
      const docRef = await addDoc(collection(db, 'knowledge'), {
        title: item.text.split('\\n')[0].substring(0, 50) || 'New Knowledge',
        content: item.text,
        category: 'faq',
        tags: [],
        createdBy: profile?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'inbox', item.id), {
        status: 'processed',
        convertedTo: { type: 'knowledge', id: docRef.id }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to convert to knowledge.');
    } finally {
      setProcessingId(null);
    }
  };
`;

content = content.replace(/return \(/, convertToKnowledge + '\n  return (');

// Add the button to UI
const buttonCode = `
                <button
                  onClick={() => convertToKnowledge(item)}
                  disabled={processingId === item.id}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm flex-1 md:flex-none justify-center"
                >
                  <Book className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline">To Knowledge</span>
                </button>
`;

content = content.replace(/<button[^>]*>\s*<Archive className="w-4 h-4" \/>\s*Archive\s*<\/button>/, 
  buttonCode + '\n                <button\n                  onClick={() => handleArchive(item)}\n                  disabled={processingId === item.id}\n                  className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm md:ml-auto justify-center w-full md:w-auto"\n                >\n                  <Archive className="w-4 h-4" />\n                  Archive\n                </button>');

fs.writeFileSync('src/pages/Inbox.tsx', content);
