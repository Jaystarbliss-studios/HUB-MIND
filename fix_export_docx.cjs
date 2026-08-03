const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

const docxExportCode = `
  const handleExportDOCX = () => {
    const html = editor.getHTML();
    const docHTML = \`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>\` + html + \`</body></html>\`;
    const blob = new Blob([docHTML], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`\${docTitle || 'Document'}.doc\`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };
`;

code = code.replace(
  "const handleExportHTML = () => {",
  docxExportCode + "\n  const handleExportHTML = () => {"
);

const docxButton = `
          <button onClick={handleExportDOCX} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            <FileText className="w-4 h-4" /> As DOCX
          </button>
`;

code = code.replace(
  /<button onClick=\{handleExportPDF\}/,
  docxButton + "$&"
);

fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
