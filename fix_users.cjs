const fs = require('fs');

function fixFile(path, replacer) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    content = replacer(content);
    fs.writeFileSync(path, content);
  }
}

fixFile('src/pages/Tasks.tsx', (c) => {
  return c.replace(/\{users\[task\.assignedTo\] \|\| 'Unassigned'\}/g, 
    `{users[task.assignedTo] ? (
      <span className="flex items-center gap-1.5">
        {users[task.assignedTo].photoUrl ? (
          <img src={users[task.assignedTo].photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold">{users[task.assignedTo].name.charAt(0)}</span>
        )}
        {users[task.assignedTo].name}
      </span>
    ) : 'Unassigned'}`);
});

fixFile('src/pages/Clients.tsx', (c) => {
  return c.replace(/\{users\[client\.ownerId\] \|\| 'Owner'\}/g, 
    `{users[client.ownerId] ? (
      <span className="flex items-center gap-1.5">
        {users[client.ownerId].photoUrl ? (
          <img src={users[client.ownerId].photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold">{users[client.ownerId].name.charAt(0)}</span>
        )}
        {users[client.ownerId].name}
      </span>
    ) : 'Owner'}`);
});

fixFile('src/pages/Documents.tsx', (c) => {
  return c.replace(/\{users\[doc\.ownerId\] \|\| 'Owner'\}/g, 
    `{users[doc.ownerId] ? (
      <span className="flex items-center gap-1.5">
        {users[doc.ownerId].photoUrl ? (
          <img src={users[doc.ownerId].photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold">{users[doc.ownerId].name.charAt(0)}</span>
        )}
        {users[doc.ownerId].name}
      </span>
    ) : 'Owner'}`);
});

fixFile('src/pages/AdminUsers.tsx', (c) => {
  let changed = c.replace(/\{Object\.entries\(userLookup\)\.map\(\(\[id, name\]\) => \(/g, 
    "{Object.entries(userLookup).map(([id, u]) => (");
  changed = changed.replace(/<option key=\{id\} value=\{id\}>\{name\}<\/option>/g, 
    "<option key={id} value={id}>{u.name}</option>");
  changed = changed.replace(/\{userLookup\[t\.assignedTo\] \|\| 'User'\}/g, 
    "{userLookup[t.assignedTo]?.name || 'User'}");
  changed = changed.replace(/<UserIcon className="w-5 h-5 text-slate-400" \/>/g, 
    `{u.photoUrl ? <img src={u.photoUrl} alt="" className="w-full h-full rounded-xl object-cover" /> : <UserIcon className="w-5 h-5 text-slate-400" />}`);
  return changed;
});

