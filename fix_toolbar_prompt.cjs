const fs = require('fs');
let code = fs.readFileSync('src/components/documents/DocumentToolbar.tsx', 'utf8');

// Replace the addImage and setLink to just use state for the prompt modal
const replaceBlock = `
  const [promptState, setPromptState] = React.useState<{type: 'image' | 'link' | null, defaultVal: string}>({type: null, defaultVal: ''});

  const addImage = () => {
    setPromptState({type: 'image', defaultVal: ''});
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setPromptState({type: 'link', defaultVal: previousUrl});
  };

  const handlePromptSubmit = (val: string) => {
    if (promptState.type === 'image') {
      if (val) editor.chain().focus().setImage({ src: val }).run();
    } else if (promptState.type === 'link') {
      if (val === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else if (val !== null) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: val }).run();
      }
    }
    setPromptState({type: null, defaultVal: ''});
  };
`;

code = code.replace(
  /const addImage = \(\) => \{[\s\S]*?const insertTable = \(\) => \{/,
  replaceBlock + "\n  const insertTable = () => {"
);

// Add modal HTML at the end
const modalCode = `
      {promptState.type && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">{promptState.type === 'image' ? 'Insert Image URL' : 'Insert Link URL'}</h3>
            <input 
              type="text" 
              autoFocus
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent mb-6"
              defaultValue={promptState.defaultVal}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePromptSubmit(e.currentTarget.value);
                if (e.key === 'Escape') setPromptState({type: null, defaultVal: ''});
              }}
              id="prompt-input"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPromptState({type: null, defaultVal: ''})}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handlePromptSubmit((document.getElementById('prompt-input') as HTMLInputElement).value)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-slate-950 rounded-lg text-sm font-bold transition-colors shadow-sm"
              >
                Confirm
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

fs.writeFileSync('src/components/documents/DocumentToolbar.tsx', code);
