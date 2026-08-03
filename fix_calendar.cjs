const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

if (!content.includes('const [clients, setClients]')) {
  // Add state for clients and selected client
  content = content.replace(
    /const \[time, setTime\] = useState\('09:00'\);/,
    "const [time, setTime] = useState('09:00');\n  const [clientId, setClientId] = useState('');\n  const [clients, setClients] = useState<{id: string, name: string}[]>([]);"
  );

  // Fetch clients inside useEffect
  content = content.replace(
    /setLoading\(true\);/,
    "setLoading(true);\n    const fetchClients = async () => {\n      const snap = await getDocs(collection(db, 'clients'));\n      setClients(snap.docs.map(d => ({id: d.id, name: d.data().name})));\n    };\n    fetchClients();"
  );

  // Use clientId in handleCreate for task
  content = content.replace(
    /assignedTo: profile\.id,/,
    "assignedTo: profile.id,\n          clientId: clientId || null,"
  );

  // reset clientId on openForm
  content = content.replace(
    /setTime\('09:00'\);/,
    "setTime('09:00');\n    setClientId('');"
  );

  // Add client selector in the form for tasks
  const clientSelector = `
                      {formType === 'task' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Related Client (Optional)</label>
                          <select 
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-accent text-sm"
                          >
                            <option value="">None</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
  `;
  
  content = content.replace(
    /<button\s+onClick=\{handleCreate\}/,
    clientSelector + '\n<button onClick={handleCreate}'
  );
  
  fs.writeFileSync('src/pages/Calendar.tsx', content);
  console.log('Calendar updated');
}
