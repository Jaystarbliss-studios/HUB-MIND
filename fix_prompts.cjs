const fs = require('fs');
let code = fs.readFileSync('src/components/documents/DocumentToolbar.tsx', 'utf8');

const replacement = `
  const addImage = () => {
    let url = null;
    try {
      url = window.prompt('Enter Image URL:');
    } catch(e) {
      url = 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=400&auto=format&fit=crop';
    }
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    let url = null;
    try {
      url = window.prompt('URL', previousUrl);
    } catch(e) {
      url = 'https://example.com';
    }
    if (url === null) {
      return;
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
`;

code = code.replace(
  /const addImage = \(\) => \{[\s\S]*?const insertTable = \(\) => \{/,
  replacement + "\n  const insertTable = () => {"
);

fs.writeFileSync('src/components/documents/DocumentToolbar.tsx', code);
