const fs = require('fs');
let code = fs.readFileSync('src/pages/Knowledge.tsx', 'utf8');

if (!code.includes('const [articleToDelete, setArticleToDelete]')) {
  code = code.replace(
    "const [deletingId, setDeletingId] = useState<string | null>(null);",
    "const [deletingId, setDeletingId] = useState<string | null>(null);\n  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);"
  );
  code = code.replace(
    "const confirmDelete = (id: string) => { setArticleToDelete(id); };",
    ""
  );
  code = code.replace(
    "const handleDelete = async (id: string) => {",
    "const confirmDelete = (id: string) => { setArticleToDelete(id); };\n  const handleDelete = async (id: string) => {\n    setArticleToDelete(null);\n"
  );
  fs.writeFileSync('src/pages/Knowledge.tsx', code);
}
