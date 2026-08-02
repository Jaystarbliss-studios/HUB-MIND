const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

const newRule = `
    // Activity Logs Collection
    match /activityLogs/{logId} {
      allow read, write: if isSignedIn();
    }
  }
}
`;

rules = rules.replace(/  \}\n\}/, newRule);
fs.writeFileSync('firestore.rules', rules);
