const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Fix imports
code = code.replace(', X, Maximize2, Minimize2, Shrink, Expand } from \'lucide-react\';', '} from \'lucide-react\';');
// add X, Maximize2, Minimize2, Shrink, Expand into the list of lucide-react imports
code = code.replace('Zap,', 'Zap,\n  X,\n  Maximize2,\n  Minimize2,\n  Shrink,\n  Expand,');

// fix line 555 error
code = code.replace('    </div>    </div>  );}', '    </div>\n  );\n}');

fs.writeFileSync('src/components/Shawn.tsx', code);
