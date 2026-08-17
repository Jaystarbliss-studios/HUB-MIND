const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Replace the loadUserConversations block
const replacement = `loadUserConversations(user.uid).then((list) => {
        setConversationsList(list);
        // On session open: fetch the user's last messages for continuity
        if (list.length > 0 && allMessages.length === 0) {
          const mostRecent = list[0];
          setCurrentConversationId(mostRecent.id);
          setAllMessages(mostRecent.messages || []);
          if (mostRecent.activeLeafId) {
            setActiveLeafId(mostRecent.activeLeafId);
          }
        }
      });`;

code = code.replace(/loadUserConversations\(user\.uid\)\.then\(\(list\) => \{[\s\S]*?setConversationsList\(list\);\n\s*\}\);/, replacement);

fs.writeFileSync('src/components/Shawn.tsx', code);
