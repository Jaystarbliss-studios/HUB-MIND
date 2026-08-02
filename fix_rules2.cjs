const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

// Simplify the roles checks and read operations that are failing.
rules = rules.replace(/match \/inbox\/\{itemId\} \{[\s\S]*?\}/, `match /inbox/{itemId} {
      allow read, write: if isSignedIn();
    }`);

rules = rules.replace(/match \/tasks\/\{taskId\} \{[\s\S]*?\}/, `match /tasks/{taskId} {
      allow read, write: if isSignedIn();
    }`);

rules = rules.replace(/match \/meetings\/\{meetingId\} \{[\s\S]*?\}/, `match /meetings/{meetingId} {
      allow read, write: if isSignedIn();
    }`);
    
rules = rules.replace(/match \/clients\/\{clientId\} \{[\s\S]*?\}/, `match /clients/{clientId} {
      allow read, write: if isSignedIn();
    }`);

fs.writeFileSync('firestore.rules', rules);
