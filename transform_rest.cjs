const fs = require('fs');
const files = [
  'src/components/AngelVault.tsx',
  'src/components/WorldPulse.tsx',
  'src/components/BrainstormStudio.tsx',
  'src/components/ChatDrawer.tsx',
  'src/components/VoiceAndWakeSettings.tsx',
  'src/components/TranscriptView.tsx',
  'src/components/LiveVoiceControls.tsx'
];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');

  // Text
  code = code.replace(/Angel/g, 'Shawn');
  code = code.replace(/angel/g, 'shawn');
  
  // Colors (aligning with Hub Mind)
  code = code.replace(/stone/g, 'slate');
  code = code.replace(/zinc/g, 'slate');
  code = code.replace(/amber/g, 'teal');
  code = code.replace(/yellow/g, 'emerald');

  // Any leftover descriptions
  code = code.replace(/M\.D\./g, 'Kid');

  fs.writeFileSync(file, code);
});
