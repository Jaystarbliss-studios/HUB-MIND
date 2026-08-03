const fs = require('fs');
let code = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

if (!code.includes('import { TemplateSelector }')) {
  code = code.replace(
    "import { useUsers } from '../lib/useUsers';",
    "import { useUsers } from '../lib/useUsers';\nimport { TemplateSelector } from '../components/documents/TemplateSelector';"
  );
}

code = code.replace(
  "const [isUploading, setIsUploading] = useState(false);",
  "const [isUploading, setIsUploading] = useState(false);\n  const [showTemplates, setShowTemplates] = useState(false);"
);

const handleCreateReplacement = `
  const handleCreateDocument = async (title: string = 'Untitled Document', content: string = '') => {
    if (!profile) return;
    try {
      const newDocRef = await addDoc(collection(db, 'documents'), {
        title: title,
        type: 'internal',
        content: JSON.stringify(content ? content : { type: 'doc', content: [{ type: 'paragraph' }] }),
        category: 'other',
        ownerId: profile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowTemplates(false);
      navigate('/documents/' + newDocRef.id);
    } catch (error) {
      console.error('Error creating doc:', error);
    }
  };
`;
code = code.replace(/const handleCreateDocument = async \(\) => \{[\s\S]*?catch \(error\) \{\s*console\.error\('Error creating doc:', error\);\s*\}\s*\};\s*/, handleCreateReplacement);

code = code.replace(
  "onClick={handleCreateDocument}",
  "onClick={() => setShowTemplates(true)}"
);

if (!code.includes('<TemplateSelector')) {
  code = code.replace(
    /(\{\s*loading\s*\?\s*\([\s\S]*?\)\s*:\s*\()/,
    "{showTemplates && <TemplateSelector onSelect={handleCreateDocument} onClose={() => setShowTemplates(false)} />}\n      $1"
  );
}

fs.writeFileSync('src/pages/Documents.tsx', code);
