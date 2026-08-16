const fs = require('fs');
let code = fs.readFileSync('src/services/liveAudioClient.ts', 'utf8');

code = code.replace(/onError: \(errorMsg: string\) => void;/g, "onError?: (errorMsg: string) => void;");
code = code.replace(/onAudioLevel: \(inputLevel: number, outputLevel: number\) => void;/g, "onAudioLevel?: (inputLevel: number, outputLevel: number) => void;");

fs.writeFileSync('src/services/liveAudioClient.ts', code);
