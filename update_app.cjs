const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add imports
content = content.replace(/import \{ Notifications \} from '.\/pages\/Notifications';/, 
  "import { Notifications } from './pages/Notifications';\nimport { Projects } from './pages/Projects';\nimport { Knowledge } from './pages/Knowledge';");

// Add routes
content = content.replace(/<Route path="clients" element=\{<Clients \/>\} \/>/, 
  "<Route path=\"projects\" element={<Projects />} />\n            <Route path=\"knowledge\" element={<Knowledge />} />\n            <Route path=\"clients\" element={<Clients />} />");

fs.writeFileSync('src/App.tsx', content);
