const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes("import { ClientDetail }")) {
  content = content.replace(
    /import \{ Clients \} from '.\/pages\/Clients';/,
    "import { Clients } from './pages/Clients';\nimport { ClientDetail } from './pages/ClientDetail';"
  );
}

content = content.replace(
  /<Route path="clients\/:id" element=\{<div className="p-6">Client Detail \(Coming Soon\)<\/div>\} \/>/,
  '<Route path="clients/:id" element={<ClientDetail />} />'
);

fs.writeFileSync('src/App.tsx', content);
console.log('Updated App.tsx');
