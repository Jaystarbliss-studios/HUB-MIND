const fs = require('fs');

let content = fs.readFileSync('src/pages/Documents.tsx', 'utf8');
content = content.replace(/import \{ collection, query, getDocs, orderBy \} from 'firebase\/firestore';/,
  "import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';");
content = content.replace(/\{ id: doc\.id, \.\.\.doc\.data\(\) \}/g, 
  "{ id: doc.id, ...(doc.data() as any) }");

fs.writeFileSync('src/pages/Documents.tsx', content);
