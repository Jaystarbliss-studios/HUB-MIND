const fs = require('fs');
let code = fs.readFileSync('src/pages/Knowledge.tsx', 'utf8');

if (!code.includes('const [articleToDelete, setArticleToDelete]')) {
  code = code.replace(
    "const [loading, setLoading] = useState(true);",
    "const [loading, setLoading] = useState(true);\n  const [articleToDelete, setArticleToDelete] = useState<{id: string, title: string} | null>(null);"
  );
  
  code = code.replace(
    "const handleDelete = async (id: string, title: string) => {\n    // Removed window.confirm due to iframe restrictions\n    try {",
    "const confirmDelete = (id: string, title: string) => { setArticleToDelete({id, title}); };\n  const handleDelete = async (id: string, title: string) => {\n    setArticleToDelete(null);\n    try {"
  );
  
  code = code.replace(
    /onClick=\{\(\) => handleDelete\(item.id, item.title\)\}/g,
    "onClick={() => confirmDelete(item.id, item.title)}"
  );
  
  code = code.replace(
    "onClick={() => handleDelete(articleToDelete)}",
    "onClick={() => { if(articleToDelete) handleDelete(articleToDelete.id, articleToDelete.title); }}"
  );

  fs.writeFileSync('src/pages/Knowledge.tsx', code);
}
