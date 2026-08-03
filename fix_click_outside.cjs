const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

if (!code.includes('menuRef')) {
  code = code.replace(
    "const [isOpen, setIsOpen] = useState(false);",
    "const [isOpen, setIsOpen] = useState(false);\n  const menuRef = useRef<HTMLDivElement>(null);\n\n  React.useEffect(() => {\n    const handleClickOutside = (event: MouseEvent) => {\n      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {\n        setIsOpen(false);\n      }\n    };\n    document.addEventListener('mousedown', handleClickOutside);\n    return () => {\n      document.removeEventListener('mousedown', handleClickOutside);\n    };\n  }, []);"
  );
  
  code = code.replace(
    '<div className="relative">',
    '<div className="relative" ref={menuRef}>'
  );
  
  fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
}
