const fs = require('fs');
let code = fs.readFileSync('src/pages/DocumentEditor.tsx', 'utf8');

if (!code.includes('@tiptap/extension-superscript')) {
  code = code.replace(
    "import { TextStyle } from '@tiptap/extension-text-style';",
    "import { TextStyle } from '@tiptap/extension-text-style';\nimport { Superscript } from '@tiptap/extension-superscript';\nimport { Subscript } from '@tiptap/extension-subscript';\nimport { FontFamily } from '@tiptap/extension-font-family';"
  );
  
  code = code.replace(
    "TextStyle,",
    "TextStyle,\n      FontFamily,\n      Superscript,\n      Subscript,"
  );
}

fs.writeFileSync('src/pages/DocumentEditor.tsx', code);
