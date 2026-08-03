const fs = require('fs');
let code = fs.readFileSync('src/pages/DocumentEditor.tsx', 'utf8');

if (!code.includes('return () => clearTimeout(timeoutRef.current);')) {
  code = code.replace(
    "fetchDoc();\n  }, [id, editor, navigate]);",
    "fetchDoc();\n    return () => {\n      if (timeoutRef.current) clearTimeout(timeoutRef.current);\n    };\n  }, [id, editor, navigate]);"
  );
  fs.writeFileSync('src/pages/DocumentEditor.tsx', code);
}
