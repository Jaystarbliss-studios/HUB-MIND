const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

code = code.replace("import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';", "import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';");

fs.writeFileSync('src/components/Shawn.tsx', code);
