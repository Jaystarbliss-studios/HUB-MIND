const fs = require('fs');

let content = fs.readFileSync('src/pages/Documents.tsx', 'utf8');
content = content.replace(/import \{ collection, query, getDocs, orderBy, addDoc \} from 'firebase\/firestore';/,
  "import { collection, query, getDocs, orderBy, addDoc, where } from 'firebase/firestore';");

fs.writeFileSync('src/pages/Documents.tsx', content);
