const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

const importRegex = /import \{ collection, query, where, getDocs, addDoc \} from 'firebase\/firestore';/;
content = content.replace(importRegex, "import { collection, query, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';");

const useEffectRegex = /useEffect\(\(\) => \{\s*fetchData\(\);\s*\}, \[currentDate, profile\]\);\s*const fetchData = async \(\) => \{[\s\S]*?setLoading\(false\);\s*\}\s*\};/;

const newUseEffect = `useEffect(() => {
    if (!profile) return;
    setLoading(true);

    const tasksQuery = profile.role === 'admin' || profile.role === 'assistant'
      ? query(collection(db, 'tasks'))
      : query(collection(db, 'tasks'), where('assignedTo', '==', profile.id));
      
    const meetingsQuery = query(collection(db, 'meetings'));

    let tasksLoaded = false;
    let meetingsLoaded = false;

    const checkLoading = () => {
      if (tasksLoaded && meetingsLoaded) setLoading(false);
    };

    const unsubTasks = onSnapshot(tasksQuery, (snap) => {
      setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      tasksLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Error fetching tasks:", error);
      tasksLoaded = true;
      checkLoading();
    });

    const unsubMeetings = onSnapshot(meetingsQuery, (snap) => {
      setMeetings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting)));
      meetingsLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Error fetching meetings:", error);
      meetingsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubTasks();
      unsubMeetings();
    };
  }, [profile]);`;

content = content.replace(useEffectRegex, newUseEffect);

fs.writeFileSync('src/pages/Calendar.tsx', content);
console.log('Fixed Calendar.tsx');
