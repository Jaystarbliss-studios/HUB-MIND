const fs = require('fs');
let code = fs.readFileSync('src/services/wakeWordDetector.ts', 'utf8');

// The file has two `case 'hey_shawn':`
// I'll just remove the second one.
const lines = code.split('\n');
let newLines = [];
let seenHeyShawn = false;
let skipNextReturn = false;

for (let line of lines) {
  if (line.includes("case 'hey_shawn':")) {
    if (seenHeyShawn) {
      skipNextReturn = true;
      continue; // Skip the duplicate case
    }
    seenHeyShawn = true;
  }
  if (skipNextReturn && line.includes("return ['hey shawn'")) {
    skipNextReturn = false;
    continue; // Skip the return inside the duplicate case
  }
  newLines.push(line);
}

fs.writeFileSync('src/services/wakeWordDetector.ts', newLines.join('\n'));
