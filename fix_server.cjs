const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const shareRoute = `
  // Handle Web Share Target
  app.post("/share-target", (req, res) => {
    // In a real app we'd parse the multipart/form-data here using multer
    // and store it temporarily or upload to cloud storage.
    // For now, redirect to inbox where the user can see it
    res.redirect(303, '/inbox?shared=true');
  });

  // Vite middleware for development
`;

code = code.replace('  // Vite middleware for development', shareRoute);
fs.writeFileSync('server.ts', code);
