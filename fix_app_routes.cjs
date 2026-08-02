const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('path="meetings/:id"')) {
  content = content.replace(
    /<Route path="clients\/:id" element=\{<div className="p-6">Client Detail \(Coming Soon\)<\/div>\} \/>/,
    '<Route path="clients/:id" element={<div className="p-6">Client Detail (Coming Soon)</div>} />\n            <Route path="meetings/:id" element={<div className="p-6">Meeting Detail (Coming Soon)</div>} />'
  );
  fs.writeFileSync('src/App.tsx', content);
}
