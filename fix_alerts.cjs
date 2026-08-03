const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

// replace alerts with the existing driveError state
code = code.replace(
  /alert\("Unsupported file format"\);/,
  "setDriveError('Unsupported file format'); setTimeout(() => setDriveError(null), 3000);"
);

code = code.replace(
  /alert\("Failed to import document"\);/,
  "setDriveError('Failed to import document'); setTimeout(() => setDriveError(null), 3000);"
);

fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
