const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Revert the previous mistake
code = code.replace(`  const handleSend = async (overrideInput?: string) => {
    // Update ref for speech recognition
    handleSendRef.current = handleSend;`, `  const handleSend = async (overrideInput?: string) => {`);

const handleSendEnd = `    } finally {
      setLoading(false);
    }
  };`;
const insertAfter = `    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);`;

code = code.replace(handleSendEnd, insertAfter);
fs.writeFileSync('src/components/Shawn.tsx', code);
