const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Add new imports
const importMatch = code.match(/import\s+{[^}]*}\s+from\s+'lucide-react';/);
if (importMatch) {
  const newImport = importMatch[0].replace('}', ', X, Maximize2, Minimize2, Shrink, Expand }');
  code = code.replace(importMatch[0], newImport);
}

// Rename component
code = code.replace('export default function App() {', 'export function Shawn() {\n  const [isOpen, setIsOpen] = useState(false);\n  const [isFullScreen, setIsFullScreen] = useState(false);');

// Replace "Angel" to "Shawn" where applicable in text
code = code.replace(/Angel/g, 'Shawn');
code = code.replace(/angel/g, 'shawn'); // mostly for state variables
code = code.replace(/shawnNote/g, 'shawnNote');
code = code.replace(/ShawnOrbVisualizer/g, 'AngelOrbVisualizer'); // Keep original component name
code = code.replace(/ShawnVault/g, 'AngelVault'); // Keep original component name
code = code.replace(/AngelState/g, 'AngelState'); 

// Now fix the return
const returnRegex = /return \(\s*<div className="min-h-screen/s;
const match = code.match(returnRegex);

if (match) {
  const before = code.substring(0, match.index);
  const after = code.substring(match.index + match[0].length);
  
  const newReturn = `
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[100] p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 bg-gradient-to-br from-amber-500 to-amber-600 text-stone-950"
      >
        <Crown className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className={\`fixed z-[100] transition-all duration-300 overflow-hidden shadow-2xl flex flex-col bg-stone-950 text-stone-100 font-sans \${
      isFullScreen 
        ? 'inset-4 rounded-3xl' 
        : 'bottom-6 right-6 w-[95vw] md:w-[850px] lg:w-[1000px] h-[85vh] rounded-2xl'
    }\`}>
      <div className="absolute top-2 right-2 flex items-center gap-2 z-50">
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-lg backdrop-blur-md border border-stone-700 transition">
          {isFullScreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
        </button>
        <button onClick={() => setIsOpen(false)} className="p-1.5 bg-rose-900/50 hover:bg-rose-900/80 text-rose-200 rounded-lg backdrop-blur-md border border-rose-800 transition">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
`;

  code = before + newReturn + after;
  
  // Find the last </div>); and replace it
  const endMatch = code.lastIndexOf('</div>\n  );');
  if (endMatch !== -1) {
    code = code.substring(0, endMatch) + '</div>\n    </div>\n  );' + code.substring(endMatch + 11);
  } else {
    const endMatch2 = code.lastIndexOf('</div>\n    </div>\n  );');
    if (endMatch2 === -1) {
       // if we can't find it easily just append it at the end
       code = code.replace(/(\n  \);\n})$/, '\n    </div>\n  </div>\n  );\n}');
    }
  }
}

// Ensure the types for 'shawnState' are correct because AngelState became ShawnState? 
code = code.replace(/setShawnState/g, 'setAngelState');
code = code.replace(/shawnState/g, 'angelState');

// Also handle the AngelVault/Visualizer props
code = code.replace(/onDiscussWithShawn=/g, 'onDiscussWithAngel=');
code = code.replace(/liveShawnTranscript=/g, 'liveAngelTranscript=');

fs.writeFileSync('src/components/Shawn.tsx', code);
