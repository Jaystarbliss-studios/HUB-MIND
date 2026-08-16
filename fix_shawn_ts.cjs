const fs = require('fs');

let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// 1. Add Shield to imports
code = code.replace(
  /Expand,\n  Zap,\n} from 'lucide-react';/,
  "Expand,\n  Zap,\n  Shield,\n} from 'lucide-react';"
);

// 2. Remove onInputLevel and onOutputLevel from new LiveAudioClient
code = code.replace(/onInputLevel: setInputLevel,\n      onOutputLevel: setOutputLevel,\n    }\);/g, "    });");

// 3. Add isConnected to ShawnOrbVisualizer
code = code.replace(
  /<ShawnOrbVisualizer\n              state=\{shawnState\}\n              inputLevel=\{inputLevel\}\n              outputLevel=\{outputLevel\}\n            \/>/g,
  "<ShawnOrbVisualizer\n              state={shawnState}\n              inputLevel={inputLevel}\n              outputLevel={outputLevel}\n              isConnected={connectionState === 'connected'}\n            />"
);

// 4 & 5. Remove onSendAudio from LiveVoiceControls
code = code.replace(
  /onTogglePushToTalk=\{.*?\}\n              onSendAudio=\{.*?\}\n            \/>/gs,
  "onTogglePushToTalk={() => setIsPushToTalk(!isPushToTalk)}\n            />"
);

// 6. Remove placeholder from ChatDrawer
code = code.replace(
  /isLoading=\{isChatLoading\}\n            placeholder=".*?"\n          \/>/g,
  "isLoading={isChatLoading}\n          />"
);

fs.writeFileSync('src/components/Shawn.tsx', code);
