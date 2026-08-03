const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

// Replace handleExportDOCX
const docxExportCode = `
  const handleExportDOCX = async () => {
    try {
      // @ts-ignore
      const htmlToDocx = (await import('html-to-docx')).default;
      const html = editor.getHTML();
      const blob = await htmlToDocx(html, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`\${docTitle || 'Document'}.docx\`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export DOCX', e);
      // Fallback
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
    }
    setIsOpen(false);
  };
`;

code = code.replace(
  /const handleExportDOCX = \(\) => \{[\s\S]*?URL\.revokeObjectURL\(url\);\s*setIsOpen\(false\);\s*\};/,
  docxExportCode.trim()
);

fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
