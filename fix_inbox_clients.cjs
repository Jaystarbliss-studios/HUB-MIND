const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

// Inject fetchClients inside useEffect
content = content.replace(
  /useEffect\(\(\) => \{/g,
  `useEffect(() => {
    const fetchClients = async () => {
      const { getDocs, collection } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'clients'));
      setClients(snap.docs.map(d => ({id: d.id, name: d.data().name})));
    };
    fetchClients();`
);

fs.writeFileSync('src/pages/Inbox.tsx', content);
console.log('Inbox clients fetched');
