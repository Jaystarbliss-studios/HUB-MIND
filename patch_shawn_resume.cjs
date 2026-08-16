const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

if (!code.includes('handleGlobalClick')) {
  code = code.replace(
    /useEffect\(\(\) => \{\n    return \(\) => \{\n      handleDisconnectLive\(\);\n    \};\n  \}, \[\]\);/g,
    "useEffect(() => {\n    const handleGlobalClick = () => {\n      if (liveClientRef.current) {\n        liveClientRef.current.resumeAudioContext();\n      }\n    };\n    window.addEventListener('click', handleGlobalClick);\n    window.addEventListener('touchstart', handleGlobalClick);\n    return () => {\n      window.removeEventListener('click', handleGlobalClick);\n      window.removeEventListener('touchstart', handleGlobalClick);\n      handleDisconnectLive();\n    };\n  }, []);"
  );
  fs.writeFileSync('src/components/Shawn.tsx', code);
}
