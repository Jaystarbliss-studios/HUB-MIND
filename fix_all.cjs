const fs = require('fs');

// 1. types.ts
let typesStr = fs.readFileSync('src/types.ts', 'utf8');
typesStr = typesStr.replace(
  /export type TaskStatus = .*?;/,
  "export type TaskStatus = 'pending' | 'in_progress' | 'under_review' | 'completed' | 'archived';"
);
typesStr = typesStr.replace(
  /export interface Meeting \{/,
  "export type MeetingStatus = 'scheduled' | 'in_session' | 'completed' | 'canceled' | 'rescheduled';\nexport interface Meeting {\n  status?: MeetingStatus;"
);
fs.writeFileSync('src/types.ts', typesStr);

// 2. Tasks.tsx filter statuses and tags
let tasksStr = fs.readFileSync('src/tasks.ts', 'utf8').catch(() => null); // wait, it's src/pages/Tasks.tsx
