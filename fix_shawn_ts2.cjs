const fs = require('fs');

let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// 1. Add onError and onAudioLevel
code = code.replace(
  /onTurnComplete: \(\) => \{\n        setLiveUserTranscript/g,
  "onError: (err) => setErrorMessage(err),\n      onAudioLevel: (input, output) => { setInputLevel(input); setOutputLevel(output); },\n      onTurnComplete: () => {\n        setLiveUserTranscript"
);

// 2. Add missing props to LiveVoiceControls
code = code.replace(
  /onTogglePushToTalk=\{.*?\}\n            \/>/g,
  "onTogglePushToTalk={(val) => setIsPushToTalk(val)}\n              onPushToTalkActive={() => {}}\n              isCameraActive={isCameraActive}\n              onToggleCamera={() => setIsCameraActive(!isCameraActive)}\n              onSendImageFrame={() => {}}\n              audioSettings={audioSettings}\n              onUpdateAudioSettings={() => {}}\n              inputLevel={inputLevel}\n              outputLevel={outputLevel}\n            />"
);

// 3. Add isConnectedLive to ChatDrawer
code = code.replace(
  /isLoading=\{isChatLoading\}\n          \/>/g,
  "isLoading={isChatLoading}\n            isConnectedLive={connectionState === 'connected'}\n          />"
);

fs.writeFileSync('src/components/Shawn.tsx', code);
