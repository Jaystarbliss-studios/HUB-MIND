const fs = require('fs');
let content = fs.readFileSync('src/lib/auth.tsx', 'utf8');

// Inside auth.tsx, we want to make sure photoUrl is preserved.
// When creating the first user:
content = content.replace(
  /name: firebaseUser\.displayName \|\| 'New User',/,
  "name: firebaseUser.displayName || 'New User',\n                  photoUrl: firebaseUser.photoURL || undefined,"
);

// We'll also update existing user profile if it doesn't have photoUrl.
const updateCode = `
            if (userDoc) {
              const data = userDoc.data();
              if (firebaseUser.photoURL && data.photoUrl !== firebaseUser.photoURL) {
                await setDoc(doc(db, 'users', userDoc.id), { photoUrl: firebaseUser.photoURL }, { merge: true });
                data.photoUrl = firebaseUser.photoURL;
              }
              setProfile({ id: userDoc.id, ...data } as User);
            }
`;

content = content.replace(
  /if \(userDoc\) \{\s*setProfile\(\{ id: userDoc\.id, \.\.\.userDoc\.data\(\) \} as User\);\s*\}/,
  updateCode
);

const docUpdateCode = `
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (firebaseUser.photoURL && data.photoUrl !== firebaseUser.photoURL) {
              await setDoc(doc(db, 'users', docSnap.id), { photoUrl: firebaseUser.photoURL }, { merge: true });
              data.photoUrl = firebaseUser.photoURL;
            }
            setProfile({ id: docSnap.id, ...data } as User);
          }
`;

content = content.replace(
  /if \(docSnap\.exists\(\)\) \{\s*setProfile\(\{ id: docSnap\.id, \.\.\.docSnap\.data\(\) \} as User\);\s*\}/,
  docUpdateCode
);

fs.writeFileSync('src/lib/auth.tsx', content);
