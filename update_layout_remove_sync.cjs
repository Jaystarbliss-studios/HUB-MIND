const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Remove processRecurringTasks import and call
content = content.replace(/import \{ processRecurringTasks \} from '\.\.\/lib\/recurringTasks';\n/, "");
content = content.replace(/processRecurringTasks\(\);\n/, "");

fs.writeFileSync('src/components/Layout.tsx', content);
