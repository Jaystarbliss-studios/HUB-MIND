const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

if (!content.includes('const [clients, setClients]')) {
  // Add state for clients and selected client
  content = content.replace(
    /const \[actionTime, setActionTime\] = useState\(''\);/,
    "const [actionTime, setActionTime] = useState('');\n  const [clientId, setClientId] = useState('');\n  const [clients, setClients] = useState<{id: string, name: string}[]>([]);"
  );

  // Fetch clients inside useEffect
  content = content.replace(
    /setLoading\(true\);/,
    "setLoading(true);\n    const fetchClients = async () => {\n      const { getDocs, collection } = await import('firebase/firestore');\n      const snap = await getDocs(collection(db, 'clients'));\n      setClients(snap.docs.map(d => ({id: d.id, name: d.data().name})));\n    };\n    fetchClients();"
  );

  // Use clientId in handleActionSubmit for task
  content = content.replace(
    /createdBy: profile\?\.id,/,
    "createdBy: profile?.id,\n          clientId: clientId || null,"
  );

  // Use clientId in handleActionSubmit for meeting
  content = content.replace(
    /ownerId: profile\?\.id,/,
    "ownerId: profile?.id,\n          clientId: clientId || null,"
  );

  // reset clientId on opening action form
  content = content.replace(
    /setActionTime\(''\);/,
    "setActionTime('');\n    setClientId('');"
  );

  // Add client selector in the form
  const clientSelector = `
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Related Client (Optional)</label>
                    <select 
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    >
                      <option value="">None</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
  `;
  
  content = content.replace(
    /<div className="flex justify-end gap-2">/,
    clientSelector + '\n<div className="flex justify-end gap-2">'
  );
  
  fs.writeFileSync('src/pages/Inbox.tsx', content);
  console.log('Inbox updated');
}
