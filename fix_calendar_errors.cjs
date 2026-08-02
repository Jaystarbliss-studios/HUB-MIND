const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

if (!content.includes('onSnapshot')) {
  content = content.replace("import { collection, query, getDocs, where, addDoc } from 'firebase/firestore';", "import { collection, query, getDocs, where, addDoc, onSnapshot } from 'firebase/firestore';");
} else if (content.match(/import \{ collection, query, getDocs, where, addDoc \} from 'firebase\/firestore';/)) {
  content = content.replace("import { collection, query, getDocs, where, addDoc } from 'firebase/firestore';", "import { collection, query, getDocs, where, addDoc, onSnapshot } from 'firebase/firestore';");
} else {
  // Just ensure onSnapshot is there
  if (!content.includes("onSnapshot,")) {
     content = content.replace("getDocs,", "getDocs, onSnapshot,");
  }
}

// Remove calls to fetchData
content = content.replace(/await fetchData\(\);/g, "// await fetchData(); // now using onSnapshot");
content = content.replace(/fetchData\(\);/g, "");

fs.writeFileSync('src/pages/Calendar.tsx', content);
