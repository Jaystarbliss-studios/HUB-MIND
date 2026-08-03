const fs = require('fs');
let code = fs.readFileSync('src/pages/DocumentEditor.tsx', 'utf8');

if (!code.includes('import { FontSize }')) {
  code = code.replace(
    "import { FontFamily } from '@tiptap/extension-font-family';",
    "import { FontFamily } from '@tiptap/extension-font-family';\nimport { FontSize } from '../lib/FontSize';"
  );
  
  code = code.replace(
    "FontFamily,",
    "FontFamily,\n      FontSize,"
  );
}

fs.writeFileSync('src/pages/DocumentEditor.tsx', code);
