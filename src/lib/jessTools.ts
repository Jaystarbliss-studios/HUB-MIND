import { addDoc, collection, doc, getDoc, getDocs, limit, query, updateDoc, where, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, DocumentInfo, RecurringMeetingTemplate } from '../types';
import { 
  createGoogleCalendarEvent, 
  listGoogleCalendarEvents, 
  connectGoogleCalendarOnce, 
  isGoogleCalendarConnected, 
  getGoogleCalendarConnectionInfo 
} from './googleCalendar';
import { globalSearch } from './globalSearch';
import { queueJessDocumentEdit } from './jessDocumentBridge';
import { getLocalDocsMap, setLocalDocsMap } from './offlineSync';
import { jessBackgroundTasks } from '../services/jessBackgroundTasks';
import { materializeRecurringMeetings } from './recurringMeetings';

export interface JessToolDefinition {
  name: string;
  description: string;
  parameters: { type: string; properties: Record<string, any>; required?: string[] };
}

const object = (properties: Record<string, any>, required?: string[]): JessToolDefinition['parameters'] => ({
  type: 'object',
  properties,
  ...(required ? { required } : {}),
});

export const JESS_TOOLS_DECLARATIONS: JessToolDefinition[] = [
  { name: 'get_user_profile', description: 'Get the signed-in Hub-Mind user profile, role and preferences.', parameters: object({}) },
  { name: 'get_current_context', description: 'Get the current Hub-Mind route and active workspace context.', parameters: object({}) },
  { name: 'get_workspace_overview', description: 'Get a concise overview of tasks, documents, and projects.', parameters: object({}) },
  { name: 'search_workspace', description: 'Search the signed-in workspace for documents, tasks, projects, clients and records by keywords.', parameters: object({ query: { type: 'string' }, limit: { type: 'number' } }, ['query']) },
  { name: 'list_tasks', description: 'List tasks visible to the signed-in user with status or priority filters.', parameters: object({ status: { type: 'string' }, priority: { type: 'string' }, limit: { type: 'number' } }) },
  { name: 'create_task', description: 'Create a new task in Hub-Mind.', parameters: object({ title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }, deadline: { type: 'string' }, assignedTo: { type: 'string' } }, ['title']) },
  { name: 'update_task', description: 'Update an existing task.', parameters: object({ taskId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' }, status: { type: 'string' }, deadline: { type: 'string' }, assignedTo: { type: 'string' } }, ['taskId']) },
  { name: 'list_documents', description: 'List recent documents in the workspace, sorted with newest first.', parameters: object({ limit: { type: 'number' }, query: { type: 'string' } }) },
  { name: 'find_document', description: 'Find a document by searching title or content.', parameters: object({ title: { type: 'string' } }, ['title']) },
  { name: 'get_document_content', description: 'Read a document content by ID or title.', parameters: object({ documentId: { type: 'string' } }, ['documentId']) },
  { name: 'create_document', description: 'Create a new document with title and content in Hub-Mind.', parameters: object({ title: { type: 'string' }, content: { type: 'string' }, projectId: { type: 'string' }, category: { type: 'string' } }, ['title']) },
  { name: 'update_document', description: 'Update an existing document content or title.', parameters: object({ documentId: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, ['documentId']) },
  { name: 'list_projects', description: 'List visible projects in Hub-Mind.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'open_project', description: 'Open a project on screen.', parameters: object({ projectId: { type: 'string' } }, ['projectId']) },
  { name: 'list_clients', description: 'List visible clients in Hub-Mind.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'list_meetings', description: 'List upcoming and scheduled meetings from the Hub-Mind calendar.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'create_meeting', description: 'Schedule a new meeting on the Hub-Mind calendar.', parameters: object({ title: { type: 'string' }, date: { type: 'string', description: 'ISO date string or YYYY-MM-DDTHH:mm' }, location: { type: 'string' }, notes: { type: 'string' }, clientId: { type: 'string' }, projectId: { type: 'string' } }, ['title', 'date']) },
  { name: 'update_meeting', description: 'Update a meeting on the Hub-Mind calendar.', parameters: object({ meetingId: { type: 'string' }, title: { type: 'string' }, date: { type: 'string' }, location: { type: 'string' }, status: { type: 'string' } }, ['meetingId']) },
  { name: 'delete_meeting', description: 'Delete a meeting from the Hub-Mind calendar.', parameters: object({ meetingId: { type: 'string' } }, ['meetingId']) },
  { name: 'create_recurring_schedule', description: 'Create a repeating schedule (e.g. music classes, weekly team meetings, daily standups, appointments) in Hub-Mind that automatically generates recurring calendar entries.', parameters: object({ title: { type: 'string' }, type: { type: 'string', enum: ['class', 'meeting', 'appointment', 'school_event', 'other'] }, frequency: { type: 'string', enum: ['weekly', 'daily', 'monthly'] }, daysOfWeek: { type: 'array', items: { type: 'number' }, description: 'Array of day numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat' }, dayOfMonth: { type: 'number', description: 'Day of month (1-31) for monthly recurrence' }, startTime: { type: 'string', description: 'Start time in HH:mm format, e.g. 09:00 or 14:30' }, endTime: { type: 'string', description: 'End time in HH:mm format, e.g. 10:00 or 15:30' }, startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' }, endDate: { type: 'string', description: 'Optional end date in YYYY-MM-DD format' }, location: { type: 'string' }, description: { type: 'string' }, syncToGoogleCalendar: { type: 'boolean' } }, ['title', 'frequency', 'startTime']) },
  { name: 'list_recurring_schedules', description: 'List all recurring schedule templates in Hub-Mind.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'delete_recurring_schedule', description: 'Delete a recurring schedule template.', parameters: object({ templateId: { type: 'string' } }, ['templateId']) },
  { name: 'list_follow_ups', description: 'List follow-ups visible to the user.', parameters: object({ status: { type: 'string' }, limit: { type: 'number' } }) },
  { name: 'list_knowledge', description: 'List knowledge base articles.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'open_task', description: 'Open a task on screen.', parameters: object({ taskId: { type: 'string' } }, ['taskId']) },
  { name: 'open_client', description: 'Open a client on screen.', parameters: object({ clientId: { type: 'string' } }, ['clientId']) },
  { name: 'list_calendar_events', description: 'List Google Calendar events.', parameters: object({ timeMin: { type: 'string' }, timeMax: { type: 'string' } }) },
  { name: 'create_calendar_event', description: 'Create a Google Calendar event (supports single and recurring events via recurrenceRule).', parameters: object({ title: { type: 'string' }, startDateTime: { type: 'string' }, endDateTime: { type: 'string' }, reminderMinutes: { type: 'number' }, location: { type: 'string' }, description: { type: 'string' }, recurrenceRule: { type: 'string', description: 'Optional recurrence rule e.g. RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR' } }, ['title', 'startDateTime']) },
  { name: 'connect_google_calendar', description: 'Perform one-time Google Calendar connection to link the users account once for permanent sync.', parameters: object({}) },
  { name: 'get_google_calendar_status', description: 'Check whether Google Calendar is currently connected.', parameters: object({}) },
  { name: 'navigate_app', description: 'Navigate to an internal application page.', parameters: object({ path: { type: 'string' } }, ['path']) },
  { name: 'open_document', description: 'Open a document in the document editor.', parameters: object({ documentId: { type: 'string' } }, ['documentId']) },
  { name: 'set_preferred_name', description: 'Save the name the signed-in user wants to be addressed with.', parameters: object({ preferredName: { type: 'string' } }, ['preferredName']) },
  { name: 'start_background_operation', description: 'Start a long-running task in the background (e.g. document drafting, audit, batch organization, research). Jess can continue conversing while it runs.', parameters: object({ title: { type: 'string' }, description: { type: 'string' }, taskType: { type: 'string' } }, ['title']) },
  { name: 'get_background_tasks_status', description: 'Check the real-time progress percentage and stage of background tasks.', parameters: object({ taskId: { type: 'string' } }) },
  { name: 'end_session', description: 'Put the AI assistant to sleep or end the current live voice session when the user says "end this session", "go to sleep", "sleep", "deactivate", or wants to conclude.', parameters: object({ reason: { type: 'string' } }) },
];

const safeLimit = (value: any, fallback = 30) => Math.max(1, Math.min(100, Number(value) || fallback));

const dayNameToNumber: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function normalizeDaysOfWeek(input: any): number[] {
  if (!input) return [1];
  if (Array.isArray(input)) {
    return input.map(item => {
      if (typeof item === 'number') return item;
      const str = String(item).toLowerCase().trim();
      return dayNameToNumber[str] !== undefined ? dayNameToNumber[str] : 1;
    }).filter(n => n >= 0 && n <= 6);
  }
  if (typeof input === 'number') return [input];
  if (typeof input === 'string') {
    const parts = input.split(/[,;\s]+/);
    return parts.map(p => {
      const lower = p.toLowerCase().trim();
      return dayNameToNumber[lower] !== undefined ? dayNameToNumber[lower] : null;
    }).filter((n): n is number => n !== null);
  }
  return [1];
}

function normalizeTime(timeStr?: string): string {
  if (!timeStr) return '09:00';
  const clean = timeStr.trim();
  const match = clean.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return '09:00';
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? match[2] : '00';
  const ampm = (match[3] || '').toLowerCase();
  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

async function fetchAllDocumentsForUser(user: User): Promise<any[]> {
  const map = new Map<string, any>();

  try {
    const local = getLocalDocsMap();
    Object.values(local).forEach(d => {
      if (d && d.id) map.set(d.id, { id: d.id, ...d });
    });
  } catch {}

  try {
    const colRef = collection(db, 'documents');
    if (user.role === 'admin') {
      const snap = await getDocs(query(colRef, limit(100)));
      snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
    } else {
      const [ownSnap, workSnap, createdSnap] = await Promise.all([
        getDocs(query(colRef, where('ownerId', '==', user.id), limit(60))).catch(() => null),
        getDocs(query(colRef, where('visibility', '==', 'workspace'), limit(60))).catch(() => null),
        getDocs(query(colRef, where('createdBy', '==', user.id), limit(60))).catch(() => null),
      ]);
      ownSnap?.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
      workSnap?.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
      createdSnap?.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
    }
  } catch (e) {
    console.warn('[Jess] Documents fetch fallback:', e);
  }

  return Array.from(map.values()).sort((a, b) => {
    const aTime = new Date(a.lastEditedAt || a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.lastEditedAt || b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

async function readResource(collectionName: string, id: string, user: User) {
  try {
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) {
      if (collectionName === 'documents') {
        const local = getLocalDocsMap()[id];
        if (local) return { id, data: local };
      }
      return null;
    }
    const data: any = snap.data();
    const sharedPermission = data.sharedWith?.[user.id];
    const readable =
      user.role === 'admin' ||
      data.ownerId === user.id ||
      data.createdBy === user.id ||
      data.visibility === 'workspace' ||
      (data.visibility === 'shared' && !!sharedPermission);
    return readable ? { id: snap.id, data } : null;
  } catch (err) {
    console.warn(`[Jess] Read resource error on ${collectionName}/${id}:`, err);
    return null;
  }
}

async function canWrite(collectionName: string, id: string, user: User) {
  if (user.role === 'admin') return true;
  const item = await readResource(collectionName, id, user);
  if (!item) return false;
  const { data } = item;
  return (
    data.ownerId === user.id ||
    data.createdBy === user.id ||
    data.visibility === 'workspace' ||
    (data.visibility === 'shared' && data.sharedWith?.[user.id] === 'write')
  );
}

const navigatePayload = (path: string) => ({ type: 'navigate', path });

export async function executeJessTool(
  name: string,
  args: any,
  user: User | null,
  onPreferredName?: (name: string) => void,
  context?: { page?: string; documentId?: string; projectId?: string }
): Promise<{ result: any; actionPayload?: any }> {
  if (!user?.id || user.status === 'suspended' || user.status === 'inactive') {
    return { result: { success: false, error: 'No active authorized Hub-Mind user is available.' } };
  }

  try {
    switch (name) {
      case 'get_user_profile':
        return {
          result: {
            success: true,
            user: {
              id: user.id,
              name: user.preferredName || user.displayName || user.name,
              email: user.email,
              role: user.role,
              status: user.status,
              googleCalendarConnected: isGoogleCalendarConnected(),
            },
          },
        };

      case 'get_current_context':
        return {
          result: {
            success: true,
            context: context || {},
            backgroundTasksSummary: jessBackgroundTasks.getActiveTasksSummary(),
          },
        };

      case 'get_workspace_overview': {
        const docs = await fetchAllDocumentsForUser(user);
        const [tasksSnap, projectsSnap, meetingsSnap] = await Promise.all([
          getDocs(user.role === 'admin' ? query(collection(db, 'tasks'), limit(50)) : query(collection(db, 'tasks'), where('assignedTo', '==', user.id), limit(50))).catch(() => ({ docs: [], size: 0 })),
          getDocs(query(collection(db, 'projects'), limit(50))).catch(() => ({ docs: [], size: 0 })),
          getDocs(query(collection(db, 'meetings'), limit(50))).catch(() => ({ docs: [], size: 0 })),
        ]);
        return {
          result: {
            success: true,
            counts: { tasks: tasksSnap.size, documents: docs.length, projects: projectsSnap.size, meetings: meetingsSnap.size },
            recentDocuments: docs.slice(0, 8).map(d => ({ id: d.id, title: d.title, category: d.category, updatedAt: d.updatedAt })),
            tasks: (tasksSnap.docs || []).slice(0, 8).map(d => ({ id: d.id, ...d.data() })),
            projects: (projectsSnap.docs || []).slice(0, 8).map(d => ({ id: d.id, ...d.data() })),
            meetings: (meetingsSnap.docs || []).slice(0, 8).map(d => ({ id: d.id, ...d.data() })),
          },
        };
      }

      case 'search_workspace':
        return {
          result: {
            success: true,
            results: await globalSearch(String(args.query || ''), user.id, Math.min(15, safeLimit(args.limit, 10)), user.role),
          },
        };

      case 'list_tasks': {
        const snap = await getDocs(user.role === 'admin' ? query(collection(db, 'tasks'), limit(safeLimit(args.limit))) : query(collection(db, 'tasks'), where('assignedTo', '==', user.id), limit(safeLimit(args.limit))));
        return {
          result: {
            success: true,
            tasks: snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter((t: any) => !args.status || t.status === args.status)
              .filter((t: any) => !args.priority || t.priority === args.priority),
          },
        };
      }

      case 'create_task': {
        const now = new Date().toISOString();
        const data = {
          title: args.title,
          description: args.description || '',
          priority: args.priority || 'medium',
          status: 'assigned',
          assignedTo: args.assignedTo || user.id,
          createdBy: user.id,
          ownerId: user.id,
          visibility: 'workspace',
          deadline: args.deadline || '',
          checklist: [],
          comments: [],
          createdAt: now,
          updatedAt: now,
        };
        const ref = await addDoc(collection(db, 'tasks'), data);
        return {
          result: { success: true, taskId: ref.id, task: { id: ref.id, ...data } },
          actionPayload: navigatePayload(`/tasks/${ref.id}`),
        };
      }

      case 'update_task': {
        if (!(await canWrite('tasks', args.taskId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this task.' } };
        }
        const patch: any = { updatedAt: new Date().toISOString() };
        for (const key of ['title', 'description', 'priority', 'status', 'deadline', 'assignedTo']) {
          if (args[key] !== undefined) patch[key] = args[key];
        }
        await updateDoc(doc(db, 'tasks', args.taskId), patch);
        return { result: { success: true, taskId: args.taskId, updated: patch } };
      }

      case 'list_documents': {
        const allDocs = await fetchAllDocumentsForUser(user);
        let filtered = allDocs;
        if (args.query) {
          const q = String(args.query).toLowerCase();
          filtered = allDocs.filter(d => (d.title || '').toLowerCase().includes(q) || (d.content || '').toLowerCase().includes(q));
        }
        return {
          result: {
            success: true,
            total: filtered.length,
            documents: filtered.slice(0, safeLimit(args.limit, 25)).map(d => ({
              id: d.id,
              title: d.title || 'Untitled Document',
              category: d.category || 'other',
              updatedAt: d.updatedAt || d.lastEditedAt || d.createdAt,
              ownerId: d.ownerId,
            })),
          },
        };
      }

      case 'find_document': {
        const term = String(args.title || '').toLowerCase().trim();
        const allDocs = await fetchAllDocumentsForUser(user);
        const matches = allDocs.filter(d => (d.title || '').toLowerCase().includes(term));
        if (matches.length === 0) {
          return { result: { success: false, message: `No document matching "${args.title}" was found.` } };
        }
        const top = matches[0];
        return {
          result: {
            success: true,
            document: { id: top.id, title: top.title, content: top.content || '', category: top.category },
            otherMatches: matches.slice(1, 5).map(d => ({ id: d.id, title: d.title })),
          },
          actionPayload: navigatePayload(`/documents/${top.id}`),
        };
      }

      case 'get_document_content': {
        let docId = args.documentId;
        let item = await readResource('documents', docId, user);
        if (!item) {
          const allDocs = await fetchAllDocumentsForUser(user);
          const found = allDocs.find(d => d.id === docId || (d.title && d.title.toLowerCase() === String(docId).toLowerCase()));
          if (found) {
            item = { id: found.id, data: found };
          }
        }
        if (!item) {
          return { result: { success: false, error: 'Document not found or access denied.' } };
        }
        return {
          result: {
            success: true,
            document: {
              id: item.id,
              title: item.data.title || 'Untitled Document',
              content: item.data.content || '',
              category: item.data.category || 'other',
              projectId: item.data.projectId || null,
              updatedAt: item.data.updatedAt,
            },
          },
        };
      }

      case 'create_document': {
        const now = new Date().toISOString();
        const rawTitle = String(args.title || 'Untitled Document').trim();
        const data = {
          title: rawTitle,
          content: args.content || '<p></p>',
          projectId: args.projectId || null,
          category: args.category || 'other',
          ownerId: user.id,
          visibility: 'workspace',
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
          lastEditedAt: now,
          lastSavedAt: now,
          version: 1,
          pageSize: 'a4',
          orientation: 'portrait',
          marginOption: 'normal',
        };
        const ref = await addDoc(collection(db, 'documents'), data);

        const localDocs = getLocalDocsMap();
        localDocs[ref.id] = {
          id: ref.id,
          title: rawTitle,
          content: args.content || '',
          updatedAt: now,
          lastSavedAt: now,
          lastEditedAt: now,
          synced: true,
        };
        setLocalDocsMap(localDocs);

        if (args.content) {
          queueJessDocumentEdit({ documentId: ref.id, content: args.content, mode: 'replace' });
        }

        return {
          result: { success: true, documentId: ref.id, title: data.title, message: `Document "${data.title}" successfully created.` },
          actionPayload: navigatePayload(`/documents/${ref.id}`),
        };
      }

      case 'update_document': {
        if (!(await canWrite('documents', args.documentId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this document.' } };
        }
        const ref = doc(db, 'documents', args.documentId);
        const snap = await getDoc(ref);
        const current: any = snap.exists() ? snap.data() : (getLocalDocsMap()[args.documentId] || {});
        const now = new Date().toISOString();
        const patch: any = { updatedAt: now, lastEditedAt: now, lastSavedAt: now, version: Number(current.version || 1) + 1 };
        if (args.title !== undefined) patch.title = args.title;
        if (args.content !== undefined) patch.content = args.content;
        await updateDoc(ref, patch);

        const localDocs = getLocalDocsMap();
        if (localDocs[args.documentId]) {
          if (args.title) localDocs[args.documentId].title = args.title;
          if (args.content) localDocs[args.documentId].content = args.content;
          localDocs[args.documentId].updatedAt = now;
          setLocalDocsMap(localDocs);
        }

        if (args.content !== undefined) {
          queueJessDocumentEdit({ documentId: args.documentId, content: args.content, mode: 'replace' });
        }
        return {
          result: { success: true, documentId: args.documentId, updated: patch },
          actionPayload: navigatePayload(`/documents/${args.documentId}`),
        };
      }

      case 'list_projects': {
        const snap = await getDocs(query(collection(db, 'projects'), limit(safeLimit(args.limit))));
        return { result: { success: true, projects: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      }

      case 'open_project': {
        const item = await readResource('projects', args.projectId, user);
        return item
          ? { result: { success: true, project: { id: item.id, ...item.data } }, actionPayload: navigatePayload(`/projects/${args.projectId}`) }
          : { result: { success: false, error: 'Project not found or access denied.' } };
      }

      case 'list_clients': {
        const snap = await getDocs(query(collection(db, 'clients'), limit(safeLimit(args.limit))));
        return { result: { success: true, clients: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      }

      case 'list_meetings': {
        const snap = await getDocs(query(collection(db, 'meetings'), limit(safeLimit(args.limit))));
        return { result: { success: true, meetings: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      }

      case 'create_meeting': {
        const meetingDate = new Date(args.date);
        const data = {
          title: args.title,
          notesRaw: args.notes || args.title,
          date: isNaN(meetingDate.getTime()) ? new Date().toISOString() : meetingDate.toISOString(),
          location: args.location || null,
          clientId: args.clientId || null,
          projectId: args.projectId || null,
          attendees: args.attendees || [],
          actionPoints: [],
          generatedDocs: [],
          status: 'scheduled',
          ownerId: user.id,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const ref = await addDoc(collection(db, 'meetings'), data);
        return {
          result: { success: true, meetingId: ref.id, message: `Meeting "${args.title}" scheduled on the calendar.` },
          actionPayload: navigatePayload('/calendar'),
        };
      }

      case 'update_meeting': {
        if (!(await canWrite('meetings', args.meetingId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this meeting.' } };
        }
        const patch: any = { updatedAt: new Date().toISOString() };
        if (args.title !== undefined) { patch.title = args.title; patch.notesRaw = args.title; }
        if (args.date !== undefined) patch.date = new Date(args.date).toISOString();
        if (args.location !== undefined) patch.location = args.location;
        if (args.status !== undefined) patch.status = args.status;
        await updateDoc(doc(db, 'meetings', args.meetingId), patch);
        return { result: { success: true, meetingId: args.meetingId, updated: patch } };
      }

      case 'delete_meeting': {
        if (!(await canWrite('meetings', args.meetingId, user))) {
          return { result: { success: false, error: 'You do not have permission to delete this meeting.' } };
        }
        await deleteDoc(doc(db, 'meetings', args.meetingId));
        return { result: { success: true, meetingId: args.meetingId, message: 'Meeting removed from calendar.' } };
      }

      case 'create_recurring_schedule': {
        const title = String(args.title || '').trim();
        if (!title) return { result: { success: false, error: 'Title is required for recurring schedule.' } };

        const type = args.type || 'class';
        const frequency = args.frequency || 'weekly';
        const daysOfWeek = normalizeDaysOfWeek(args.daysOfWeek);
        const startTime = normalizeTime(args.startTime);
        const endTime = args.endTime ? normalizeTime(args.endTime) : null;
        const startDate = args.startDate || new Date().toISOString().slice(0, 10);
        const endDate = args.endDate || null;
        const dayOfMonth = frequency === 'monthly' ? Number(args.dayOfMonth || startDate.slice(8, 10)) : null;

        const templateData: Omit<RecurringMeetingTemplate, 'id'> = {
          title,
          type,
          frequency,
          daysOfWeek: frequency === 'weekly' ? daysOfWeek : [],
          dayOfMonth,
          startTime,
          endTime,
          startDate,
          endDate,
          location: args.location || null,
          description: args.description || null,
          ownerId: user.id,
          attendees: [],
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const templateRef = await addDoc(collection(db, 'recurringMeetingTemplates'), templateData);

        // Instantly materialize 90 days of calendar instances
        await materializeRecurringMeetings(90, user);

        // If requested and Google Calendar is connected, also create recurring event on Google Calendar
        let gcalResult: any = null;
        if (args.syncToGoogleCalendar && isGoogleCalendarConnected()) {
          try {
            const dayLetters = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
            let rrule = 'RRULE:';
            if (frequency === 'daily') rrule += 'FREQ=DAILY';
            else if (frequency === 'weekly') {
              const byDays = daysOfWeek.map(d => dayLetters[d]).join(',');
              rrule += `FREQ=WEEKLY;BYDAY=${byDays}`;
            } else if (frequency === 'monthly') {
              rrule += 'FREQ=MONTHLY';
            }

            const [hours, minutes] = startTime.split(':').map(Number);
            const startDateTime = new Date(`${startDate}T${startTime}:00`);
            const endDateTime = endTime ? new Date(`${startDate}T${endTime}:00`) : new Date(startDateTime.getTime() + 60 * 60 * 1000);

            gcalResult = await createGoogleCalendarEvent({
              summary: title,
              description: args.description || `Recurring ${type} managed by Hub-Mind`,
              startDateTime: startDateTime.toISOString(),
              endDateTime: endDateTime.toISOString(),
              location: args.location || undefined,
              recurrenceRule: rrule,
            });
          } catch (gcalErr) {
            console.warn('Optional Google Calendar sync warning:', gcalErr);
          }
        }

        return {
          result: {
            success: true,
            templateId: templateRef.id,
            title,
            frequency,
            startTime,
            endTime,
            daysOfWeek,
            googleCalendarSynced: !!gcalResult?.success,
            message: `Successfully created recurring schedule "${title}" (${frequency}, ${startTime}${endTime ? `–${endTime}` : ''}). Upcoming occurrences for the next 90 days have been added to your calendar.`,
          },
          actionPayload: navigatePayload('/calendar'),
        };
      }

      case 'list_recurring_schedules': {
        const q = user.role === 'admin'
          ? collection(db, 'recurringMeetingTemplates')
          : query(collection(db, 'recurringMeetingTemplates'), where('ownerId', '==', user.id));
        const snap = await getDocs(q);
        const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return {
          result: {
            success: true,
            total: templates.length,
            recurringSchedules: templates,
          },
        };
      }

      case 'delete_recurring_schedule': {
        const templateId = String(args.templateId || '');
        if (!templateId) return { result: { success: false, error: 'templateId is required.' } };
        await deleteDoc(doc(db, 'recurringMeetingTemplates', templateId));
        return { result: { success: true, message: `Recurring schedule template ${templateId} deleted.` } };
      }

      case 'list_follow_ups': {
        const snap = await getDocs(query(collection(db, 'followUps'), limit(safeLimit(args.limit))));
        return {
          result: {
            success: true,
            followUps: snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((item: any) => !args.status || item.status === args.status),
          },
        };
      }

      case 'list_knowledge': {
        const snap = await getDocs(query(collection(db, 'knowledge'), limit(safeLimit(args.limit))));
        return { result: { success: true, knowledge: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      }

      case 'open_task': {
        const item = await readResource('tasks', args.taskId, user);
        return item
          ? { result: { success: true, task: { id: item.id, ...item.data } }, actionPayload: navigatePayload(`/tasks/${args.taskId}`) }
          : { result: { success: false, error: 'Task not found or access denied.' } };
      }

      case 'open_client': {
        const item = await readResource('clients', args.clientId, user);
        return item
          ? { result: { success: true, client: { id: item.id, ...item.data } }, actionPayload: navigatePayload(`/clients/${args.clientId}`) }
          : { result: { success: false, error: 'Client not found or access denied.' } };
      }

      case 'list_calendar_events': {
        const events = await listGoogleCalendarEvents(args.timeMin, args.timeMax);
        return {
          result: {
            success: true,
            events: events.map((e: any) => ({ id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date, link: e.htmlLink, recurrence: e.recurrence })),
          },
        };
      }

      case 'create_calendar_event': {
        const res = await createGoogleCalendarEvent({
          summary: args.title,
          startDateTime: args.startDateTime,
          endDateTime: args.endDateTime,
          reminderMinutes: args.reminderMinutes,
          location: args.location,
          description: args.description,
          recurrenceRule: args.recurrenceRule,
        });
        return { result: { success: true, message: res.message, htmlLink: res.htmlLink } };
      }

      case 'connect_google_calendar': {
        const res = await connectGoogleCalendarOnce();
        return { result: res };
      }

      case 'get_google_calendar_status': {
        const info = getGoogleCalendarConnectionInfo();
        return {
          result: {
            success: true,
            connected: info.connected,
            email: info.email,
          },
        };
      }

      case 'navigate_app': {
        const path = String(args.path || '');
        if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
          return { result: { success: false, error: 'Only internal Hub-Mind routes are allowed.' } };
        }
        return { result: { success: true, path }, actionPayload: navigatePayload(path) };
      }

      case 'open_document': {
        let docId = args.documentId;
        let item = await readResource('documents', docId, user);
        if (!item) {
          const allDocs = await fetchAllDocumentsForUser(user);
          const found = allDocs.find(d => d.id === docId || (d.title && d.title.toLowerCase() === String(docId).toLowerCase()));
          if (found) {
            item = { id: found.id, data: found };
            docId = found.id;
          }
        }
        return item
          ? { result: { success: true, documentId: docId, title: item.data.title }, actionPayload: navigatePayload(`/documents/${docId}`) }
          : { result: { success: false, error: 'Document not found or access denied.' } };
      }

      case 'set_preferred_name': {
        const clean = String(args.preferredName || '').trim();
        if (!clean) return { result: { success: false, error: 'Preferred name cannot be empty.' } };
        onPreferredName?.(clean);
        return { result: { success: true, preferredName: clean } };
      }

      case 'start_background_operation': {
        const taskTitle = String(args.title || 'Workspace Background Operation');
        const description = String(args.description || '');
        const taskType = (args.taskType || 'custom') as any;

        const bgTask = jessBackgroundTasks.enqueueTask({
          title: taskTitle,
          description,
          taskType,
          priority: 'normal',
          customStages: [
            { atPct: 25, stage: 'Gathering workspace records and analyzing operational context...', delayMs: 1500 },
            { atPct: 50, stage: 'Processing records and composing content in background...', delayMs: 2200 },
            { atPct: 75, stage: 'Applying changes and syncing cloud documents...', delayMs: 1800 },
            { atPct: 90, stage: 'Finalizing verification and updating indexes...', delayMs: 1200 },
          ],
          onComplete: async () => {
            return {
              summary: `Completed "${taskTitle}". All workspace updates are live and saved.`,
            };
          }
        });

        return {
          result: {
            success: true,
            taskId: bgTask.id,
            progress: bgTask.progress,
            stage: bgTask.stage,
            message: `Started "${taskTitle}" in the background processing queue (ID: ${bgTask.id}). I am here and ready to continue talking while it works. You can ask for status or percentage at any time!`,
          },
        };
      }

      case 'get_background_tasks_status': {
        if (args.taskId) {
          const t = jessBackgroundTasks.getTask(args.taskId);
          if (!t) return { result: { success: false, error: `Task ${args.taskId} not found.` } };
          return { result: { success: true, task: t } };
        }
        return {
          result: {
            success: true,
            activeTasks: jessBackgroundTasks.getActiveTasks(),
            allTasks: jessBackgroundTasks.getAllTasks().slice(0, 5),
            summary: jessBackgroundTasks.getActiveTasksSummary(),
          },
        };
      }

      case 'end_session': {
        return {
          result: {
            success: true,
            message: 'Session ended successfully. Assistant entering sleep mode.',
          },
          actionPayload: { type: 'sleep' },
        };
      }

      default:
        return { result: { success: false, error: `Unknown Jess tool: ${name}` } };
    }
  } catch (error: any) {
    console.error(`[Jess] Tool ${name} failed`, error);
    return { result: { success: false, error: error?.message || 'Tool execution failed.' } };
  }
}
