const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
content = content.replace(/import \{ Projects \} from '.\/pages\/Projects';/,
  "import { Projects } from './pages/Projects';\nimport { ProjectDetail } from './pages/ProjectDetail';");

// Add route
content = content.replace(/<Route path="projects" element=\{<Projects \/>\} \/>/,
  "<Route path=\"projects\" element={<Projects />} />\n            <Route path=\"projects/:id\" element={<ProjectDetail />} />");

fs.writeFileSync('src/App.tsx', content);
