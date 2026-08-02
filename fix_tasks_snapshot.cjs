const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

const importRegex = /import \{ collection, query, where, getDocs, orderBy \} from 'firebase\/firestore';/;
content = content.replace(importRegex, "import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';");

const useEffectRegex = /useEffect\(\(\) => \{[\s\S]*?fetchTasks\(\);\n  \}, \[user, profile\]\);/;

const newUseEffect = `useEffect(() => {
    if (!user || !profile) return;
    
    setLoading(true);
    let q;
    if (profile.role === 'admin' || profile.role === 'assistant') {
      q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'tasks'), where('assignedTo', '==', profile.id));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Task));
      if (profile.role !== 'admin' && profile.role !== 'assistant') {
        data = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      setTasks(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile]);`;

content = content.replace(useEffectRegex, newUseEffect);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Tasks.tsx');
