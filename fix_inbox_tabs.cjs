const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

const tabs = `
      <div className="shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Inbox</h1>
        <p className="text-sm text-slate-400 mt-1">Quick captures and notes</p>
      </div>
      
      <div className="flex border-b border-slate-800 shrink-0">
        <button 
          onClick={() => setViewMode('unprocessed')}
          className={\`px-4 py-2 font-medium text-sm transition-colors border-b-2 \${viewMode === 'unprocessed' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-300'}\`}
        >
          Unprocessed
        </button>
        <button 
          onClick={() => setViewMode('processed')}
          className={\`px-4 py-2 font-medium text-sm transition-colors border-b-2 \${viewMode === 'processed' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-300'}\`}
        >
          Archived
        </button>
      </div>
`;

content = content.replace(
  /<div className="shrink-0">\s*<h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Inbox<\/h1>\s*<p className="text-sm text-slate-400 mt-1">Unprocessed quick captures<\/p>\s*<\/div>/,
  tabs
);

// We should also change the empty state depending on viewMode
content = content.replace(
  /<h2 className="text-xl font-bold text-white mb-2">Inbox Zero<\/h2>\s*<p className="text-slate-400 text-center text-sm max-w-sm">\s*All your captured thoughts have been processed\. Tap the Quick Capture button to add more\.\s*<\/p>/,
  '<h2 className="text-xl font-bold text-white mb-2">{viewMode === \'unprocessed\' ? \'Inbox Zero\' : \'No Archived Items\'}</h2>\n          <p className="text-slate-400 text-center text-sm max-w-sm">\n            {viewMode === \'unprocessed\' ? \'All your captured thoughts have been processed. Tap the Quick Capture button to add more.\' : \'You have not archived any items yet.\'}\n          </p>'
);

// If the viewMode is processed, we shouldn't show the Action buttons (Task/Meeting/Archive)
// Or maybe we can just hide them.
// Let's hide the actions section if viewMode is processed
content = content.replace(
  /<div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">/,
  '{viewMode === \'unprocessed\' && (\n                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">'
);

content = content.replace(
  /<\/div>\s*\{\/\* Action Forms \*\/\}/,
  '</div>\n              )}\n\n              {/* Action Forms */}'
);

fs.writeFileSync('src/pages/Inbox.tsx', content);
console.log('Inbox tabs added');
