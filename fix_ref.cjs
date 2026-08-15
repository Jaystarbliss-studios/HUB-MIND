const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Remove the one I just added
code = code.replace(`  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

`, ``);

// Add it after handleSend
const handleSendCode = `  const handleSend = async (overrideInput?: string) => {`;
code = code.replace(handleSendCode, `${handleSendCode}
    // Update ref for speech recognition
    handleSendRef.current = handleSend;`);

fs.writeFileSync('src/components/Shawn.tsx', code);
