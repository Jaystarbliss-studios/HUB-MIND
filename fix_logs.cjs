const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('console.log')) {
    code = code.replace(/console\.log\(.*?\);/g, '');
    fs.writeFileSync(file, code);
  }
}
