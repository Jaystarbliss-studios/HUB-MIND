const fs = require('fs');
let code = fs.readFileSync('src/services/liveAudioClient.ts', 'utf8');

if (!code.includes('public resumeAudioContext()')) {
  code = code.replace(
    /public async connect\(\): Promise<void> \{/g,
    "public async resumeAudioContext(): Promise<void> {\n    if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {\n      await this.outputAudioCtx.resume();\n      console.log('AudioContext resumed via user gesture');\n    }\n    if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {\n      await this.inputAudioCtx.resume();\n    }\n  }\n\n  public async connect(): Promise<void> {"
  );
  fs.writeFileSync('src/services/liveAudioClient.ts', code);
}
