import { Task, Project, Client, Meeting, FollowUp } from '../types';

const TASKS_KEY = 'hubmind_local_tasks_v1';
const PROJECTS_KEY = 'hubmind_local_projects_v1';
const CLIENTS_KEY = 'hubmind_local_clients_v1';
const MEETINGS_KEY = 'hubmind_local_meetings_v1';
const FOLLOWUPS_KEY = 'hubmind_local_followups_v1';

export function getDefaultTasks(userId = 'default_user'): Task[] {
  const now = Date.now();
  return [
    {
      id: 'task-seed-1',
      title: 'Review Q3 Operational Budget & Projections',
      description: 'Analyze departmental expenditures, staffing overhead, and projected software licensing costs for the upcoming quarter.',
      priority: 'urgent',
      status: 'in_progress',
      assignedTo: userId,
      createdBy: userId,
      deadline: new Date(now + 86400000 * 2).toISOString(),
      checklist: [
        { item: 'Export ledger from accounting module', done: true },
        { item: 'Review contractor invoice totals', done: true },
        { item: 'Submit summary to executive board', done: false }
      ],
      comments: [
        { userId, text: 'Initial variance report prepared.', timestamp: new Date().toISOString() }
      ],
      createdAt: new Date(now - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'task-seed-2',
      title: 'Client Onboarding - St. Jude Regional Academy',
      description: 'Coordinate system integration kickoff, teacher credentials provisioning, and curriculum schedule alignment.',
      priority: 'high',
      status: 'pending',
      assignedTo: userId,
      createdBy: userId,
      deadline: new Date(now + 86400000 * 5).toISOString(),
      checklist: [
        { item: 'Verify administrative contact info', done: true },
        { item: 'Configure school roster permissions', done: false },
        { item: 'Host live teacher orientation call', done: false }
      ],
      comments: [],
      createdAt: new Date(now - 86400000 * 2).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'task-seed-3',
      title: 'Security Compliance Audit & Access Review',
      description: 'Periodic review of workspace user roles, API secret rotation, and Firestore security rules verification.',
      priority: 'medium',
      status: 'completed',
      assignedTo: userId,
      createdBy: userId,
      deadline: new Date(now - 86400000).toISOString(),
      checklist: [
        { item: 'Audit role assignments', done: true },
        { item: 'Verify security rules', done: true }
      ],
      comments: [
        { userId, text: 'All security checks completed successfully.', timestamp: new Date().toISOString() }
      ],
      createdAt: new Date(now - 86400000 * 5).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

export function getDefaultProjects(userId = 'default_user'): Project[] {
  const now = Date.now();
  return [
    {
      id: 'proj-seed-1',
      name: 'Academic Portal Expansion 2026',
      description: 'Rollout of next-generation student progress dashboards and staff grading automation across 12 partner schools.',
      status: 'active',
      ownerId: userId,
      createdAt: new Date(now - 86400000 * 14).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'proj-seed-2',
      name: 'Enterprise Client Success Onboarding',
      description: 'End-to-end framework for rapid integration, bespoke SLA workflows, and executive training.',
      status: 'active',
      ownerId: userId,
      createdAt: new Date(now - 86400000 * 10).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'proj-seed-3',
      name: 'AI Operations & Shawn Integration',
      description: 'Deployment of bidirectional voice capabilities, biometric voiceprint isolation, and real-time task synthesis.',
      status: 'active',
      ownerId: userId,
      createdAt: new Date(now - 86400000 * 20).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

export function getDefaultClients(userId = 'default_user'): Client[] {
  const now = Date.now();
  return [
    {
      id: 'client-seed-1',
      name: 'St. Jude Regional Academy',
      type: 'school',
      phone: '+1 (555) 234-8901',
      email: 'admin@stjudeacademy.edu',
      address: '450 University Way, Suite 100',
      status: 'active',
      ownerId: userId,
      createdAt: new Date(now - 86400000 * 12).toISOString()
    },
    {
      id: 'client-seed-2',
      name: 'Horizon STEM Partnerships',
      type: 'partner',
      phone: '+1 (555) 876-5432',
      email: 'partnerships@horizonstem.org',
      address: '100 Innovation Parkway',
      status: 'lead',
      ownerId: userId,
      createdAt: new Date(now - 86400000 * 5).toISOString()
    }
  ];
}

export function getDefaultMeetings(userId = 'default_user'): Meeting[] {
  const now = new Date();
  
  const todayMeeting = new Date(now);
  todayMeeting.setHours(14, 0, 0, 0);

  const tomorrowMeeting = new Date(now.getTime() + 86400000);
  tomorrowMeeting.setHours(10, 30, 0, 0);

  const fridayMeeting = new Date(now.getTime() + 86400000 * 3);
  fridayMeeting.setHours(15, 0, 0, 0);

  return [
    {
      id: 'meeting-seed-1',
      title: 'Weekly Executive Operations & Briefing',
      notesRaw: 'Review weekly organizational KPIs, budget allocations, and client project deliverables.',
      date: todayMeeting.toISOString(),
      status: 'scheduled',
      attendees: ['Executive Team', 'Shawn AI'],
      actionPoints: [
        { text: 'Finalize Q3 operational budget report', assignedTo: userId, deadline: new Date(now.getTime() + 86400000 * 2).toISOString() }
      ],
      generatedDocs: [],
      ownerId: userId,
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString()
    },
    {
      id: 'meeting-seed-2',
      title: 'St. Jude Regional Academy - Onboarding Kickoff',
      notesRaw: 'Orientation call with school administration regarding student roster integration and staff access.',
      date: tomorrowMeeting.toISOString(),
      status: 'scheduled',
      clientId: 'client-seed-1',
      attendees: ['Principal Henderson', 'IT Director', userId],
      actionPoints: [],
      generatedDocs: [],
      ownerId: userId,
      createdAt: new Date(now.getTime() - 86400000).toISOString()
    },
    {
      id: 'meeting-seed-3',
      title: 'Quarterly Financial & Systems Compliance Review',
      notesRaw: 'Quarterly compliance audit check-in and cloud database access verification.',
      date: fridayMeeting.toISOString(),
      status: 'scheduled',
      attendees: ['Compliance Auditor', userId],
      actionPoints: [],
      generatedDocs: [],
      ownerId: userId,
      createdAt: new Date(now.getTime() - 86400000 * 3).toISOString()
    }
  ];
}

export function initWorkspaceStorage(userId = 'default_user') {
  try {
    if (!localStorage.getItem(TASKS_KEY)) {
      localStorage.setItem(TASKS_KEY, JSON.stringify(getDefaultTasks(userId)));
    }
    if (!localStorage.getItem(PROJECTS_KEY)) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(getDefaultProjects(userId)));
    }
    if (!localStorage.getItem(CLIENTS_KEY)) {
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(getDefaultClients(userId)));
    }
    if (!localStorage.getItem(MEETINGS_KEY)) {
      localStorage.setItem(MEETINGS_KEY, JSON.stringify(getDefaultMeetings(userId)));
    }
  } catch (e) {
    console.warn('Failed to initialize local workspace storage:', e);
  }
}

// Tasks
export function getLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const defaults = getDefaultTasks();
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(defaults)); } catch {}
  return defaults;
}

export function setLocalTasks(tasks: Task[]) {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('Failed to save local tasks:', e);
  }
}

export function upsertLocalTask(task: Task) {
  const current = getLocalTasks();
  const idx = current.findIndex(t => t.id === task.id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...task };
  } else {
    current.unshift(task);
  }
  setLocalTasks(current);
}

export function deleteLocalTask(taskId: string) {
  const current = getLocalTasks();
  setLocalTasks(current.filter(t => t.id !== taskId));
}

// Projects
export function getLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const defaults = getDefaultProjects();
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(defaults)); } catch {}
  return defaults;
}

export function setLocalProjects(projects: Project[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn('Failed to save local projects:', e);
  }
}

export function upsertLocalProject(project: Project) {
  const current = getLocalProjects();
  const idx = current.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...project };
  } else {
    current.unshift(project);
  }
  setLocalProjects(current);
}

// Clients
export function getLocalClients(): Client[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const defaults = getDefaultClients();
  try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(defaults)); } catch {}
  return defaults;
}

export function setLocalClients(clients: Client[]) {
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.warn('Failed to save local clients:', e);
  }
}

export function upsertLocalClient(client: Client) {
  const current = getLocalClients();
  const idx = current.findIndex(c => c.id === client.id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...client };
  } else {
    current.unshift(client);
  }
  setLocalClients(current);
}

// Meetings
export function getLocalMeetings(): Meeting[] {
  try {
    const raw = localStorage.getItem(MEETINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const defaults = getDefaultMeetings();
  try { localStorage.setItem(MEETINGS_KEY, JSON.stringify(defaults)); } catch {}
  return defaults;
}

export function setLocalMeetings(meetings: Meeting[]) {
  try {
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
  } catch (e) {
    console.warn('Failed to save local meetings:', e);
  }
}

export function upsertLocalMeeting(meeting: Meeting) {
  const current = getLocalMeetings();
  const idx = current.findIndex(m => m.id === meeting.id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...meeting };
  } else {
    current.unshift(meeting);
  }
  setLocalMeetings(current);
}
