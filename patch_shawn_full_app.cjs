const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// 1. Change export default function App() to export function Shawn()
code = code.replace('export default function App() {', 'export function Shawn() {\n  const [isOpen, setIsOpen] = useState(false);\n  const [isFullScreen, setIsFullScreen] = useState(false);\n');

// 2. Add an import for X, Maximize, Minimize if not present
if (!code.includes('Maximize2')) {
  code = code.replace(/import {([^}]+)} from 'lucide-react';/, (match, p1) => {
    return `import {${p1}, X, Maximize2, Minimize2, Shrink, Expand} from 'lucide-react';`;
  });
}

// 3. Replace the main return with the widget wrapper
const returnIndex = code.indexOf('return (');
if (returnIndex !== -1) {
  const beforeReturn = code.substring(0, returnIndex);
  let afterReturn = code.substring(returnIndex);
  
  // Replace the first 'return ('
  const newReturn = `
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[100] p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 bg-accent hover:bg-accent-hover text-slate-950"
      >
        <Crown className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className={\`fixed z-[100] transition-all duration-300 overflow-hidden shadow-2xl flex flex-col \${
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
      <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-stone-950">
`;

  // Wrap the end of the return statement
  afterReturn = afterReturn.replace('return (', newReturn);
  // Add closing divs at the very end
  const lastBracket = afterReturn.lastIndexOf(');');
  afterReturn = afterReturn.substring(0, lastBracket) + '\n      </div>\n    </div>\n  );' + afterReturn.substring(lastBracket + 2);

  code = beforeReturn + afterReturn;
}

// Rename some 'Angel' occurrences to 'Shawn' in the UI
code = code.replace(/Angel\b/g, 'Shawn');
code = code.replace(/angelNote/g, 'shawnNote');
code = code.replace(/angelState/g, 'shawnState');
code = code.replace(/setAngelState/g, 'setShawnState');
code = code.replace(/liveAngelTranscript/g, 'liveShawnTranscript');
code = code.replace(/setLiveAngelTranscript/g, 'setLiveShawnTranscript');
code = code.replace(/AngelOrbVisualizer/g, 'AngelOrbVisualizer'); // Keep component name
code = code.replace(/AngelVault/g, 'AngelVault'); // Keep component name

fs.writeFileSync('src/components/Shawn.tsx', code);
