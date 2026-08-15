const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Remove the problematic useEffect
const oldEffect = `  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);`;

code = code.replace(oldEffect, `  // Update ref directly without a hook to avoid Hook order errors after early returns
  handleSendRef.current = handleSend;`);

fs.writeFileSync('src/components/Shawn.tsx', code);
