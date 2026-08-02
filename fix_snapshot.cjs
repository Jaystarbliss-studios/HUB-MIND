const fs = require('fs');

function updateToSnapshot(filename, regex, replaceStr) {
  let content = fs.readFileSync(filename, 'utf8');
  if (content.includes('onSnapshot') && filename !== 'src/pages/Dashboard.tsx') {
    // maybe already updated
  } else {
    if (!content.includes('onSnapshot')) {
       content = content.replace(/import \{ collection, query, where, getDocs, (.*?)\} from 'firebase\/firestore';/, "import { collection, query, where, getDocs, onSnapshot, $1} from 'firebase/firestore';");
       if (!content.includes('onSnapshot')) {
          content = content.replace(/import \{.*?\} from 'firebase\/firestore';/, (match) => match.replace("getDocs", "getDocs, onSnapshot"));
       }
    }
  }
}
// I will just use sed or write a specific node script for each
