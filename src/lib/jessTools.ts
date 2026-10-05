import { format } from 'date-fns';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, updateDoc, setDoc, where, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, DocumentInfo, RecurringMeetingTemplate, ResourceType, SharePermission } from '../types';
import { isSharedWith } from './rbac';
import { 
  createGoogleCalendarEvent, 
  listGoogleCalendarEvents, 
  connectGoogleCalendarOnce, 
  isGoogleCalendarConnected, 
  getGoogleCalendarConnectionInfo,
  getCachedGoogleCalendarEvents,
  refreshGoogleCalendarEvents 
} from './googleCalendar';
import { globalSearch } from './globalSearch';
import { queueJessDocumentEdit } from './jessDocumentBridge';
import { getLocalDocsMap, setLocalDocsMap } from './offlineSync';
import { jessBackgroundTasks } from '../services/jessBackgroundTasks';
import { materializeRecurringMeetings } from './recurringMeetings';
import { getCachedCollection } from '../services/jessWorkspaceCache';
import { 
  shareResourceWithUser, 
  sendDirectInformation, 
  findRecipientUser 
} from '../services/sharingService';
import { 
  saveUserMemory, 
  getUserMemories, 
  deleteUserMemory 
} from '../services/memoryService';
import { getAllUsers } from '../services/userService';
import { getShareUrl } from './shareLinks';

export interface JessToolDefinition {
  name: string;
  description: string;
  parameters: { type: string; properties: Record<string, any>; required?: string[] };
  behavior?: 'NON_BLOCKING';
}


function normalizeSearchText(value: any): string {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(about|the|a|an|this|that|please|find|show|open|document|doc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = old;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}
function markdownToTiptapHtml(input: any): string {
  const source = String(input ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return '<p></p>';

  // Jess can still pass already-structured Tiptap HTML. Do not double-escape it.
  if (/^\s*<(?:p|h[1-6]|ul|ol|li|blockquote|pre|table|div|section|strong|em|br)\b/i.test(source)) {
    return source;
  }

  const escape = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const inline = (value: string) => {
    let out = escape(value);
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    out = out.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
    out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    return out;
  };

  const lines = source.split('\n');
  const blocks: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const flushList = () => {
    if (!listType || !listItems.length) return;
    blocks.push('<' + listType + '>' + listItems.map(item => '<li>' + inline(item) + '</li>').join('') + '</' + listType + '>');
    listType = null;
    listItems = [];
  };
  const flushCode = () => {
    if (!inCode) return;
    blocks.push('<pre><code>' + escape(codeLines.join('\n')) + '</code></pre>');
    inCode = false;
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^\s*\x60\x60\x60/.test(line)) {
      if (inCode) flushCode();
      else { flushList(); inCode = true; codeLines = []; }
      continue;
    }
    if (inCode) { codeLines.push(rawLine); continue; }
    if (!line) { flushList(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = Math.min(6, heading[1].length);
      blocks.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
      continue;
    }
    if (/^[-*_]{3,}$/.test(line)) {
      flushList();
      blocks.push('<hr>');
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listItems.push(bullet[1]);
      continue;
    }
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listItems.push(numbered[1]);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushList();
      blocks.push('<blockquote><p>' + inline(quote[1]) + '</p></blockquote>');
      continue;
    }

    flushList();
    blocks.push('<p>' + inline(line) + '</p>');
  }

  flushList();
  flushCode();
  return blocks.join('') || '<p></p>';
}

function fuzzyRelevance(queryText: string, record: any): number {
  const queryTokens = normalizeSearchText(queryText).split(' ').filter(t => t.length >= 2);
  if (!queryTokens.length) return 0;
  const title = normalizeSearchText(record.title || record.name);
  const titleTokens = title.split(' ').filter(Boolean);
  const haystack = normalizeSearchText([
    record.title, record.name, record.description, record.category, record.content,
    record.notes, record.tags, record.projectName, record.clientName,
    record.assigneeName, record.location, record.summary
  ].join(' '));
  let score = title.includes(queryTokens.join(' ')) ? 30 : 0;
  for (const token of queryTokens) {
    let best = 0;
    for (const candidate of titleTokens) {
      if (candidate.includes(token) || token.includes(candidate)) best = Math.max(best, 0.95);
      else best = Math.max(best, tokenSimilarity(token, candidate));
    }
    if (best >= 0.82) score += 9;
    else if (best >= 0.68) score += 5;
    else if (haystack.includes(token)) score += 4;
  }
  score += Math.min(12, queryTokens.filter(t => haystack.includes(t)).length * 2);
  return score;
}

const object = (properties: Record<string, any>, required?: string[]): JessToolDefinition['parameters'] => ({
  type: 'object',
  properties,
  ...(required ? { required } : {}),
});

export const JESS_TOOLS_DECLARATIONS: JessToolDefinition[] = [
  { name: 'get_user_profile', description: 'Get the signed-in Hub-Mind user profile, role, name, preferred name, email, and preferences.', parameters: object({}) },
  { name: 'get_current_user_profile', description: 'Get the currently signed-in user identity, name, preferred name, email, role, and preferences.', parameters: object({}) },
  { name: 'get_current_context', description: 'Get the current Hub-Mind route and active workspace context.', parameters: object({}) },
  { name: 'get_workspace_overview', description: 'Get a concise overview of tasks, documents, and projects.', parameters: object({}) },
  { name: 'search_workspace', description: 'Search the signed-in workspace for documents, tasks, projects, clients and records by keywords.', parameters: object({ query: { type: 'string' }, limit: { type: 'number' } }, ['query']) },
  
  // Workspace Users & Directory
  { name: 'list_workspace_users', description: 'List and search colleagues, team members, and users in the Hub-Mind workspace to find usernames, roles, and contacts for sharing resources, assigning tasks, and sending schedules.', parameters: object({ query: { type: 'string', description: 'Optional search query by name, username, or email' }, limit: { type: 'number' } }) },

  // Sharing & Direct Info Distribution Tools
  {
    name: 'share_data',
    description: 'Universal sharing tool to share any Hub-Mind data (schedules, meetings, documents, tasks, projects, client profiles, briefing notes, texts, or operational updates) with other team members, colleagues, or external contacts. Updates permissions, delivers in-app notifications, and provides direct app and WhatsApp share links.',
    parameters: object({
      recipient: { type: 'string', description: 'Username (e.g. @sarah), name, email, or user ID of the recipient' },
      dataType: { type: 'string', enum: ['schedule', 'meeting', 'document', 'task', 'project', 'client', 'text', 'note', 'briefing', 'followup'], description: 'Type of data or resource being shared' },
      title: { type: 'string', description: 'Subject or title of the shared data' },
      content: { type: 'string', description: 'The text, message, meeting agenda, briefing, or summary to share' },
      resourceId: { type: 'string', description: 'Optional specific ID or title of the document, task, project, client, or meeting' },
      permission: { type: 'string', enum: ['read', 'write'], description: 'Access permission: "read" (view only) or "write" (can edit). Defaults to "read".' },
      daysAhead: { type: 'number', description: 'If sharing a schedule, number of days ahead to include (e.g. 7). Defaults to 7.' },
      notes: { type: 'string', description: 'Optional personal note or instructions to accompany the shared data' }
    }, ['recipient'])
  },
  { 
    name: 'share_resource', 
    description: 'Share any Hub-Mind resource (document, task, project, client, meeting, schedule, or note) with a colleague or team member by username (@username), email, name, or user ID. Grants read or edit permissions, updates workspace permissions, sends an instant in-app notification, and provides direct sharing links.', 
    parameters: object({ 
      resourceType: { type: 'string', enum: ['document', 'task', 'project', 'client', 'meeting', 'followup'], description: 'Type of resource to share' }, 
      resourceId: { type: 'string', description: 'ID or title of the resource to share' }, 
      resourceTitle: { type: 'string', description: 'Optional title of the resource' }, 
      recipient: { type: 'string', description: 'Username (e.g. @john), name, email, or user ID of the colleague to share with' }, 
      permission: { type: 'string', enum: ['read', 'write'], description: 'Access level: "read" (view only) or "write" (can edit). Defaults to "read".' }, 
      message: { type: 'string', description: 'Optional message or context to include with the share' } 
    }, ['resourceType', 'resourceId', 'recipient']) 
  },
  { 
    name: 'send_direct_information', 
    description: 'Send direct text messages, briefing notes, schedule summaries, or operational updates directly to another colleague or team member in Hub-Mind. Delivers directly to their notification inbox with optional links to workspace items.', 
    parameters: object({ 
      recipient: { type: 'string', description: 'Username (@username), name, email, or user ID of the recipient' }, 
      title: { type: 'string', description: 'Subject or title of the information' }, 
      content: { type: 'string', description: 'The text, message, summary, or briefing content to send' }, 
      type: { type: 'string', enum: ['note', 'briefing', 'document', 'task', 'project', 'meeting'], description: 'Type of information' }, 
      resourceId: { type: 'string', description: 'Optional resource ID if linking to a specific item' }, 
      permission: { type: 'string', enum: ['read', 'write'] } 
    }, ['recipient', 'title', 'content']) 
  },
  { 
    name: 'share_schedule', 
    description: 'Share the users upcoming calendar schedule, recurring classes, or a specific meeting agenda with a team member, client, or collaborator. Formats the schedule into a clear briefing and delivers it to the recipient in Hub-Mind.', 
    parameters: object({ 
      recipient: { type: 'string', description: 'Username, name, email, or user ID of the recipient' }, 
      meetingId: { type: 'string', description: 'Optional specific meeting ID to share' }, 
      daysAhead: { type: 'number', description: 'Number of days of schedule to summarize (e.g. 7 for next week). Defaults to 7.' }, 
      notes: { type: 'string', description: 'Optional personal note to include' } 
    }, ['recipient']) 
  },
  { 
    name: 'get_share_link', 
    description: 'Generate shareable URLs (direct app link, secure shared record link, and WhatsApp share link) for any document, task, meeting, project, client, or record in Hub-Mind.', 
    parameters: object({ 
      resourceType: { type: 'string', enum: ['document', 'task', 'project', 'client', 'meeting', 'followup'], description: 'Type of resource' }, 
      resourceId: { type: 'string', description: 'ID of the resource' }, 
      title: { type: 'string', description: 'Optional title of the resource' } 
    }, ['resourceType', 'resourceId']) 
  },

  // Tasks
  { name: 'list_tasks', description: 'List tasks visible to the signed-in user with status or priority filters.', parameters: object({ status: { type: 'string' }, priority: { type: 'string' }, limit: { type: 'number' } }) },
  { name: 'create_task', description: 'Create a new task in Hub-Mind.', parameters: object({ title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }, deadline: { type: 'string' }, assignedTo: { type: 'string' } }, ['title']) },
  { name: 'update_task', description: 'Update an existing task.', parameters: object({ taskId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' }, status: { type: 'string' }, deadline: { type: 'string' }, assignedTo: { type: 'string' } }, ['taskId']) },
  { name: 'delete_task', description: 'Delete a task from Hub-Mind. Opens the dashboard confirmation modal so the user has final confirmation.', parameters: object({ taskId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['taskId']) },
  
  // Documents
  { name: 'list_documents', description: 'List recent documents in the workspace, sorted with newest first.', parameters: object({ limit: { type: 'number' }, query: { type: 'string' } }) },
  { name: 'find_document', description: 'Find a document by searching title or content.', parameters: object({ title: { type: 'string' } }, ['title']) },
  { name: 'get_document_content', description: 'Read a document content by ID or title.', parameters: object({ documentId: { type: 'string' } }, ['documentId']) },
  { name: 'create_document', description: 'Create a new document with title and content in Hub-Mind.', parameters: object({ title: { type: 'string' }, content: { type: 'string' }, projectId: { type: 'string' }, category: { type: 'string' } }, ['title']) },
  { name: 'update_document', description: 'Update an existing document content or title.', parameters: object({ documentId: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, ['documentId']) },
  { name: 'delete_document', description: 'Delete a document from Hub-Mind. Opens the confirmation modal so the user has the final say.', parameters: object({ documentId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['documentId']) },
  
  // Projects & Clients
  { name: 'list_projects', description: 'List visible projects in Hub-Mind.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'create_project', description: 'Create a new project in Hub-Mind.', parameters: object({ name: { type: 'string' }, description: { type: 'string' }, status: { type: 'string', enum: ['active', 'completed', 'on_hold'] } }, ['name']) },
  { name: 'update_project', description: 'Update an existing project in Hub-Mind.', parameters: object({ projectId: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, status: { type: 'string' } }, ['projectId']) },
  { name: 'delete_project', description: 'Delete a project from Hub-Mind. Opens the confirmation modal for final user verification.', parameters: object({ projectId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['projectId']) },
  { name: 'open_project', description: 'Open a project on screen.', parameters: object({ projectId: { type: 'string' } }, ['projectId']) },
  
  { name: 'list_clients', description: 'List visible clients in Hub-Mind.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'create_client', description: 'Create a new client or contact profile in Hub-Mind.', parameters: object({ name: { type: 'string' }, type: { type: 'string', enum: ['school', 'parent', 'partner'] }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, notes: { type: 'string' }, status: { type: 'string', enum: ['active', 'lead', 'inactive'] } }, ['name']) },
  { name: 'update_client', description: 'Update an existing client profile.', parameters: object({ clientId: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, notes: { type: 'string' }, status: { type: 'string' } }, ['clientId']) },
  { name: 'delete_client', description: 'Delete a client profile from Hub-Mind. Opens confirmation modal for final user verification.', parameters: object({ clientId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['clientId']) },
  
  // Meetings & Calendar & Schedules
  {
    name: 'get_schedule',
    description: 'Get the user\'s complete schedule for any date range, day, or named period (e.g. today, tomorrow, this_week, next_week, this_month). Automatically includes ALL one-time meetings, appointments, AND recurring schedules/classes (daily, weekly, monthly routines) in chronological order.',
    parameters: object({
      period: { type: 'string', enum: ['today', 'tomorrow', 'this_week', 'next_week', 'this_month', 'custom'], description: 'Named period to fetch schedule for' },
      startDate: { type: 'string', description: 'Start date in YYYY-MM-DD or ISO string' },
      endDate: { type: 'string', description: 'End date in YYYY-MM-DD or ISO string' },
      limit: { type: 'number', description: 'Max events to return' }
    })
  },
  { name: 'list_meetings', description: 'List upcoming and scheduled meetings and recurring schedules from the Hub-Mind calendar.', parameters: object({ period: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, limit: { type: 'number' } }) },
  { name: 'create_meeting', description: 'Schedule a new meeting on the Hub-Mind calendar.', parameters: object({ title: { type: 'string' }, date: { type: 'string', description: 'ISO date string or YYYY-MM-DDTHH:mm' }, location: { type: 'string' }, notes: { type: 'string' }, clientId: { type: 'string' }, projectId: { type: 'string' } }, ['title', 'date']) },
  { name: 'update_meeting', description: 'Update a meeting on the Hub-Mind calendar.', parameters: object({ meetingId: { type: 'string' }, title: { type: 'string' }, date: { type: 'string' }, location: { type: 'string' }, status: { type: 'string' } }, ['meetingId']) },
  { name: 'delete_meeting', description: 'Delete a meeting from the Hub-Mind calendar. Opens confirmation modal for user verification.', parameters: object({ meetingId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['meetingId']) },
  
  // Recurring Schedules
  { name: 'create_recurring_schedule', description: 'Create a repeating schedule (e.g. music classes, weekly team meetings, daily standups, appointments) in Hub-Mind that automatically generates recurring calendar entries.', parameters: object({ title: { type: 'string' }, type: { type: 'string', enum: ['class', 'meeting', 'appointment', 'school_event', 'other'] }, frequency: { type: 'string', enum: ['weekly', 'daily', 'monthly'] }, daysOfWeek: { type: 'array', items: { type: 'number' }, description: 'Array of day numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat' }, dayOfMonth: { type: 'number', description: 'Day of month (1-31) for monthly recurrence' }, startTime: { type: 'string', description: 'Start time in HH:mm format, e.g. 09:00 or 14:30' }, endTime: { type: 'string', description: 'End time in HH:mm format, e.g. 10:00 or 15:30' }, startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' }, endDate: { type: 'string', description: 'Optional end date in YYYY-MM-DD format' }, location: { type: 'string' }, description: { type: 'string' }, syncToGoogleCalendar: { type: 'boolean' } }, ['title', 'frequency', 'startTime']) },
  { name: 'list_recurring_schedules', description: 'List all recurring schedule templates in Hub-Mind.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'update_recurring_schedule', description: 'Update an existing recurring schedule template.', parameters: object({ templateId: { type: 'string' }, title: { type: 'string' }, frequency: { type: 'string' }, startTime: { type: 'string' }, endTime: { type: 'string' }, location: { type: 'string' }, description: { type: 'string' } }, ['templateId']) },
  { name: 'delete_recurring_schedule', description: 'Delete a recurring schedule template. Opens confirmation modal for final user verification.', parameters: object({ templateId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['templateId']) },
  
  // Follow-ups & Knowledge
  { name: 'list_follow_ups', description: 'List follow-ups visible to the user.', parameters: object({ status: { type: 'string' }, limit: { type: 'number' } }) },
  { name: 'create_follow_up', description: 'Create a tracked follow-up reminder for a contact or pending task.', parameters: object({ title: { type: 'string' }, person: { type: 'string' }, reason: { type: 'string' }, dueAt: { type: 'string' }, priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }, notes: { type: 'string' } }, ['title', 'dueAt']) },
  { name: 'update_follow_up', description: 'Update a follow-up reminder status, due date, or notes.', parameters: object({ followUpId: { type: 'string' }, title: { type: 'string' }, person: { type: 'string' }, reason: { type: 'string' }, dueAt: { type: 'string' }, status: { type: 'string', enum: ['scheduled', 'due', 'contacted', 'waiting', 'resolved', 'cancelled'] }, priority: { type: 'string' }, notes: { type: 'string' } }, ['followUpId']) },
  { name: 'delete_follow_up', description: 'Delete a follow-up reminder. Opens confirmation modal for user verification.', parameters: object({ followUpId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['followUpId']) },

  { name: 'list_knowledge', description: 'List knowledge base articles.', parameters: object({ limit: { type: 'number' } }) },
  { name: 'create_knowledge', description: 'Create a knowledge base article, SOP, or template in Hub-Mind.', parameters: object({ title: { type: 'string' }, content: { type: 'string' }, category: { type: 'string', enum: ['sop', 'template', 'faq', 'lesson'] }, tags: { type: 'array', items: { type: 'string' } } }, ['title', 'content']) },
  { name: 'update_knowledge', description: 'Update a knowledge base article in Hub-Mind.', parameters: object({ knowledgeId: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, category: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, ['knowledgeId']) },
  { name: 'delete_knowledge', description: 'Delete a knowledge article from Hub-Mind. Opens confirmation modal for user verification.', parameters: object({ knowledgeId: { type: 'string' }, confirmed: { type: 'boolean' } }, ['knowledgeId']) },
  
  // Direct Screen Navigation
  { name: 'open_colleagues', description: 'Open the Colleagues & Team Directory tab on screen.', parameters: object({}) },
  { name: 'open_task', description: 'Open a task on screen.', parameters: object({ taskId: { type: 'string' } }, ['taskId']) },
  { name: 'open_client', description: 'Open a client on screen.', parameters: object({ clientId: { type: 'string' } }, ['clientId']) },
  { name: 'open_document', description: 'Open a document in the document editor.', parameters: object({ documentId: { type: 'string' } }, ['documentId']) },
  { name: 'navigate_app', description: 'Navigate user to a specific tab or page in Hub-Mind (e.g. /colleagues, /tasks, /calendar, /documents, /projects, /clients, /knowledge, /follow-ups, /inbox, /admin, /).', parameters: object({ path: { type: 'string', description: 'Path to open: /colleagues, /tasks, /calendar, /documents, /projects, /clients, /knowledge, /follow-ups, /inbox, /admin, /' } }, ['path']) },
  { name: 'scroll_screen', description: 'Control the visible Hub-Mind screen without touching it. Start/stop continuous scrolling, change speed, scroll a specific amount, or jump to top/bottom.', parameters: object({ mode: { type: 'string', enum: ['start', 'stop', 'by', 'top', 'bottom'] }, direction: { type: 'string', enum: ['up', 'down'] }, speed: { type: 'string', enum: ['slow', 'normal', 'fast', 'very_fast'] }, amount: { type: 'number' } }, ['mode']) },
  { name: 'click_screen', description: 'Click a visible Hub-Mind UI element by visible text, accessible label, title, or CSS selector.', parameters: object({ target: { type: 'string' }, selector: { type: 'string' } }) },
  { name: 'type_screen', description: 'Type into a visible input or editor field selected by label, placeholder, name, or CSS selector.', parameters: object({ target: { type: 'string' }, text: { type: 'string' }, selector: { type: 'string' }, clearFirst: { type: 'boolean' } }, ['text']) },
  { name: 'stop_screen_control', description: 'Immediately stop any ongoing Jess screen scrolling/control operation.', parameters: object({}) },

  // Google Calendar Integration
  { name: 'list_calendar_events', description: 'List Google Calendar events.', parameters: object({ timeMin: { type: 'string' }, timeMax: { type: 'string' } }) },
  { name: 'create_calendar_event', description: 'Create a Google Calendar event (supports single and recurring events via recurrenceRule).', parameters: object({ title: { type: 'string' }, startDateTime: { type: 'string' }, endDateTime: { type: 'string' }, reminderMinutes: { type: 'array', items: { type: 'number' }, description: 'Optional reminder times in minutes before the event, e.g. [1440, 60, 10].' }, location: { type: 'string' }, description: { type: 'string' }, recurrenceRule: { type: 'string', description: 'Optional recurrence rule e.g. RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR' } }, ['title', 'startDateTime']) },
  { name: 'connect_google_calendar', description: 'Perform one-time Google Calendar connection to link the users account once for permanent sync.', parameters: object({}) },
  { name: 'get_google_calendar_status', description: 'Check whether Google Calendar is currently connected.', parameters: object({}) },
  { name: 'save_activity_report', description: 'Write a daily or weekly activity report into the signed-in user\'s Today/report area and also save it as a workspace document. Use this for end-of-day reports, weekly activity summaries, and requested written operational reports.', parameters: object({ period: { type: 'string', enum: ['daily', 'weekly'] }, dateKey: { type: 'string', description: 'Optional YYYY-MM-DD date for daily reports.' }, title: { type: 'string' }, report: { type: 'string' }, snapshot: { type: 'object' } }, ['period', 'report']) },
  
  // Personalization, User Memory & Background Operations
  { name: 'set_preferred_name', description: 'Save the name the signed-in user wants to be addressed with.', parameters: object({ preferredName: { type: 'string' } }, ['preferredName']) },
  {
    name: 'set_language_preference',
    description: 'Update the user\'s preferred conversational language (e.g. English, Spanish, French, Yoruba, German, etc.). The workspace defaults to English for 90%+ of interactions, but smoothly switches and remembers any user-requested language preference.',
    parameters: object({
      language: { type: 'string', description: 'The preferred language name (e.g. "English", "Spanish", "French", "Yoruba", "German")' },
      reason: { type: 'string', description: 'Optional reason or context for the preference change' }
    }, ['language'])
  },
  {
    name: 'set_voice_isolation_mode',
    description: 'Configure noise suppression and dominant speaker isolation so Jess focuses strictly on the highest/nearest voice and filters out room murmurs, typing, or background chatter.',
    parameters: object({
      mode: { type: 'string', enum: ['high_priority_voice', 'balanced', 'ambient_allowed'], description: 'Voice isolation profile: "high_priority_voice" (strictly listens to highest voice, ignores noise), "balanced", or "ambient_allowed".' }
    }, ['mode'])
  },
  { 
    name: 'save_user_memory', 
    description: 'Save a specific personal preference, decision, habit, workflow choice, or key fact into the logged-in user\'s private AI memory. The AI remembers this across all future sessions whenever this specific user logs in.', 
    parameters: object({ 
      content: { type: 'string', description: 'The fact, preference, habit, choice, or instruction to remember (e.g. "Prefers summary bullet points first", "Always uses Letterhead template for proposals")' }, 
      key: { type: 'string', description: 'Optional short key name (e.g. "preferred_tone", "formatting_choice", "frequent_contact")' }, 
      category: { type: 'string', enum: ['preference', 'workflow', 'fact', 'instruction', 'habit', 'personal', 'business'], description: 'Category of the memory' },
      importance: { type: 'string', enum: ['high', 'medium', 'low'] }
    }, ['content']) 
  },
  { 
    name: 'get_user_memories', 
    description: 'Retrieve the private memories, choices, and stored preferences for the currently logged-in user.', 
    parameters: object({ 
      category: { type: 'string', description: 'Optional category filter' } 
    }) 
  },
  { 
    name: 'forget_user_memory', 
    description: 'Remove or forget a specific saved preference or memory for the current user when asked to clear or forget.', 
    parameters: object({ 
      keyOrMemoryId: { type: 'string', description: 'Key name or ID of the memory to remove' } 
    }, ['keyOrMemoryId']) 
  },
  { behavior: 'NON_BLOCKING', name: 'start_background_operation', description: 'Start a real multi-step background workflow. Jess can continue conversing while it runs. Progress must reflect completed executable steps, never simulated waiting.', parameters: object({ title: { type: 'string' }, description: { type: 'string' }, taskType: { type: 'string' }, steps: { type: 'array', description: 'Ordered executable tool steps.', items: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' }, label: { type: 'string' } }, required: ['tool'] } } }, ['title', 'steps']) },
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
    Object.values(getLocalDocsMap()).forEach(d => {
      if (d && d.id) map.set(d.id, { id: d.id, ...d });
    });
  } catch {}

  // Warm workspace cache is the primary fast path.
  getCachedCollection<any>('documents').forEach(d => map.set(d.id, d));

  // Only hit Firestore directly when the local index is empty. The live listener
  // will populate the cache in the background for subsequent requests.
  if (map.size === 0) {
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
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(b.lastEditedAt || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.lastEditedAt || a.updatedAt || a.createdAt || 0).getTime());
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
    const isOwner = data.ownerId === user.id || data.createdBy === user.id || data.userId === user.id;
    const isPublicOrWorkspace = !data.visibility || data.visibility === 'workspace' || data.visibility === 'public';
    const hasShared = isSharedWith(data.sharedWith, user.id) || isSharedWith(data.permissions, user.id);
    const readable = user.role === 'admin' || isOwner || isPublicOrWorkspace || hasShared;
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
  const isOwner = data.ownerId === user.id || data.createdBy === user.id || data.userId === user.id;
  const isWorkspace = !data.visibility || data.visibility === 'workspace';
  const sharedWrite = (typeof data.sharedWith === 'object' && !Array.isArray(data.sharedWith) && data.sharedWith?.[user.id] === 'write')
    || (typeof data.permissions === 'object' && data.permissions?.[user.id] === 'write')
    || (Array.isArray(data.sharedWith) && data.sharedWith.includes(user.id));
  return isOwner || isWorkspace || sharedWrite;
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
      case 'get_current_user_profile':
      case 'get_current_user':
      case 'whoami': {
        const primaryName = user.preferredName || user.displayName || user.name || `@${user.username}`;
        return {
          result: {
            success: true,
            user: {
              id: user.id,
              name: primaryName,
              preferredName: user.preferredName || user.displayName || user.name,
              displayName: user.displayName || user.name,
              username: user.username,
              email: user.email,
              role: user.role,
              status: user.status,
              googleCalendarConnected: isGoogleCalendarConnected(),
            },
            message: `Current logged-in user is ${primaryName} (@${user.username}), role: ${user.role}, email: ${user.email}.`,
          },
        };
      }

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
        let tasks = getCachedCollection<any>('tasks');
        let projects = getCachedCollection<any>('projects');
        let meetings = getCachedCollection<any>('meetings');

        if (!tasks.length || !projects.length || !meetings.length) {
          const [tasksSnap, projectsSnap, meetingsSnap] = await Promise.all([
            tasks.length ? Promise.resolve({ docs: tasks, size: tasks.length }) : getDocs(user.role === 'admin' ? query(collection(db, 'tasks'), limit(50)) : query(collection(db, 'tasks'), where('assignedTo', '==', user.id), limit(50))).catch(() => ({ docs: [], size: 0 })),
            projects.length ? Promise.resolve({ docs: projects, size: projects.length }) : getDocs(query(collection(db, 'projects'), limit(50))).catch(() => ({ docs: [], size: 0 })),
            meetings.length ? Promise.resolve({ docs: meetings, size: meetings.length }) : getDocs(query(collection(db, 'meetings'), limit(50))).catch(() => ({ docs: [], size: 0 })),
          ]);
          tasks = (tasksSnap.docs || []).map((d: any) => d.data ? ({ id: d.id, ...d.data() }) : d);
          projects = (projectsSnap.docs || []).map((d: any) => d.data ? ({ id: d.id, ...d.data() }) : d);
          meetings = (meetingsSnap.docs || []).map((d: any) => d.data ? ({ id: d.id, ...d.data() }) : d);
        }

        return {
          result: {
            success: true,
            counts: { tasks: tasks.length, documents: docs.length, projects: projects.length, meetings: meetings.length },
            recentDocuments: docs.slice(0, 8).map(d => ({ id: d.id, title: d.title, category: d.category, updatedAt: d.updatedAt })),
            tasks: tasks.slice(0, 8),
            projects: projects.slice(0, 8),
            meetings: meetings.slice(0, 8),
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

      case 'list_workspace_users': {
        const users = await getAllUsers();
        let filtered = users.filter(u => u.status !== 'inactive' && u.status !== 'suspended');
        if (args.query) {
          const q = String(args.query).toLowerCase().trim().replace(/^@/, '');
          filtered = filtered.filter(u =>
            (u.username && u.username.toLowerCase().includes(q)) ||
            (u.displayName && u.displayName.toLowerCase().includes(q)) ||
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q))
          );
        }
        return {
          result: {
            success: true,
            total: filtered.length,
            users: filtered.slice(0, safeLimit(args.limit, 20)).map(u => ({
              id: u.id,
              username: u.username,
              name: u.displayName || u.name || u.username,
              role: u.role,
              email: u.email,
            })),
          },
        };
      }

      case 'share_data': {
        const recipientIdentifier = String(args.recipient || '').trim();
        const dataType = String(args.dataType || '').toLowerCase().trim();
        const rawTitle = args.title ? String(args.title).trim() : '';
        const rawContent = args.content ? String(args.content).trim() : '';
        let resourceId = args.resourceId ? String(args.resourceId).trim() : '';
        const permission = (args.permission || 'read') as SharePermission;
        const daysAhead = Math.max(1, Math.min(30, Number(args.daysAhead) || 7));
        const notes = args.notes ? String(args.notes).trim() : '';

        if (!recipientIdentifier) {
          return { result: { success: false, error: 'recipient (username @username, email, or name) is required to share data.' } };
        }

        const recipientUser = await findRecipientUser(recipientIdentifier);
        if (!recipientUser) {
          const allUsers = await getAllUsers();
          const suggestions = allUsers.filter(u => u.status === 'active').slice(0, 5).map(u => `@${u.username} (${u.displayName || u.name})`);
          return {
            result: {
              success: false,
              error: `Could not find a user matching "${recipientIdentifier}". Available teammates: ${suggestions.join(', ')}`,
            },
          };
        }

        // Branch 1: Schedule sharing
        if (dataType === 'schedule' || (!resourceId && !rawContent && (rawTitle.toLowerCase().includes('schedule') || rawTitle.toLowerCase().includes('calendar')))) {
          const [meetingsSnap, templatesSnap] = await Promise.all([
            getDocs(query(collection(db, 'meetings'), limit(30))).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'recurringMeetingTemplates')).catch(() => ({ docs: [] })),
          ]);

          const now = new Date();
          const horizon = new Date(now.getTime() + daysAhead * 86400000);
          const upcomingMeetings = meetingsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(m => m.date && new Date(m.date) >= now && new Date(m.date) <= horizon)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const templates = templatesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(t => t.active !== false && (t.ownerId === user.id || user.role === 'admin'));

          const scheduleTitle = rawTitle || `Upcoming Schedule & Routine (${daysAhead} Days)`;
          const lines: string[] = [];
          if (upcomingMeetings.length > 0) {
            lines.push('--- Scheduled Meetings & Events ---');
            upcomingMeetings.forEach((m, idx) => {
              const dt = new Date(m.date);
              lines.push(`${idx + 1}. ${dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${m.title || m.notesRaw?.split('\n')[0] || 'Meeting'}${m.location ? ` (${m.location})` : ''}`);
            });
          }
          if (templates.length > 0) {
            lines.push('\n--- Recurring Classes & Sessions ---');
            templates.forEach(t => {
              lines.push(`• ${t.title}: ${t.frequency} at ${t.startTime}${t.endTime ? `–${t.endTime}` : ''}${t.location ? ` (${t.location})` : ''}`);
            });
          }
          if (lines.length === 0) {
            lines.push(`No scheduled meetings or recurring classes found for the next ${daysAhead} days.`);
          }

          let fullSummary = lines.join('\n');
          if (notes) fullSummary = `${notes}\n\n${fullSummary}`;
          if (rawContent) fullSummary = `${rawContent}\n\n${fullSummary}`;

          await sendDirectInformation({
            senderId: user.id,
            senderName: user.preferredName || user.displayName || user.name || `@${user.username}`,
            recipientId: recipientUser.id,
            recipientName: recipientUser.displayName || recipientUser.name,
            type: 'briefing',
            title: scheduleTitle,
            content: fullSummary,
            permission: 'read',
          });

          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const calendarUrl = `${origin}/calendar`;
          const waText = `Hi ${recipientUser.displayName || recipientUser.name || `@${recipientUser.username}`},\n\n*${scheduleTitle}*\n${fullSummary}\n\nCalendar: ${calendarUrl}\n— Shared via Hub-Mind by ${user.preferredName || user.displayName || user.name}`;
          const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

          return {
            result: {
              success: true,
              recipient: { id: recipientUser.id, username: recipientUser.username, name: recipientUser.displayName || recipientUser.name },
              title: scheduleTitle,
              dataType: 'schedule',
              content: fullSummary,
              directUrl: calendarUrl,
              whatsAppShareLink: waLink,
              message: `Successfully shared your ${daysAhead}-day schedule with @${recipientUser.username}. A full schedule briefing was delivered to their notification inbox.`,
            },
            actionPayload: navigatePayload('/calendar'),
          };
        }

        // Branch 2: Resource sharing (document, task, project, client, meeting, followup)
        const recognizedTypes: ResourceType[] = ['document', 'task', 'project', 'client', 'meeting', 'followup'];
        const matchedType = recognizedTypes.find(t => t === dataType || (t === 'followup' && (dataType === 'follow_up' || dataType === 'follow-up')));

        if (resourceId || matchedType) {
          const resType = (matchedType || 'document') as ResourceType;
          const collName = resType === 'followup' ? 'followUps' : `${resType}s`;
          let targetItem = resourceId ? await readResource(collName, resourceId, user) : null;
          let resolvedTitle = rawTitle;

          if (!targetItem && resType === 'document') {
            const allDocs = await fetchAllDocumentsForUser(user);
            const found = allDocs.find(d => d.id === resourceId || (resourceId && d.title && d.title.toLowerCase().includes(resourceId.toLowerCase())) || (rawTitle && d.title && d.title.toLowerCase().includes(rawTitle.toLowerCase())));
            if (found) {
              targetItem = { id: found.id, data: found };
              resourceId = found.id;
              resolvedTitle = resolvedTitle || found.title;
            }
          } else if (!targetItem && resType === 'task') {
            const tasksSnap = await getDocs(query(collection(db, 'tasks'), limit(50))).catch(() => ({ docs: [] }));
            const found = tasksSnap.docs.find(d => d.id === resourceId || (resourceId && String(d.data().title || '').toLowerCase().includes(resourceId.toLowerCase())) || (rawTitle && String(d.data().title || '').toLowerCase().includes(rawTitle.toLowerCase())));
            if (found) {
              targetItem = { id: found.id, data: found.data() };
              resourceId = found.id;
              resolvedTitle = resolvedTitle || (found.data() as any).title;
            }
          }

          if (targetItem || resourceId) {
            const resTitle = resolvedTitle || targetItem?.data?.title || targetItem?.data?.name || `${resType} ${resourceId}`;
            const share = await shareResourceWithUser({
              resourceType: resType,
              resourceId: resourceId || targetItem?.id || 'record',
              resourceTitle: resTitle,
              ownerId: user.id,
              ownerName: user.preferredName || user.displayName || user.name || `@${user.username}`,
              recipientUsernameOrId: recipientUser.username || recipientUser.id,
              permission,
              message: notes || rawContent || undefined,
            });

            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            let sharePath = `/${resType}s/${resourceId || targetItem?.id}`;
            if (resType === 'followup') sharePath = `/follow-ups/${resourceId || targetItem?.id}`;
            const directUrl = `${origin}${sharePath}`;
            const waText = `*${resTitle}*\nShared with you on Hub-Mind (${permission === 'write' ? 'Can Edit' : 'Read Only'}): ${directUrl}${notes ? `\n\nNote: ${notes}` : ''}`;
            const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

            return {
              result: {
                success: true,
                shareId: share.id,
                dataType: resType,
                resourceId: resourceId || targetItem?.id,
                title: resTitle,
                recipient: { id: recipientUser.id, username: recipientUser.username, name: recipientUser.displayName || recipientUser.name },
                permission,
                directUrl,
                whatsAppShareLink: waLink,
                message: `Successfully shared ${resType} "${resTitle}" with @${recipientUser.username} (${permission === 'write' ? 'Can Edit' : 'Read Only'}). Delivered to their notification center.`,
              },
              actionPayload: navigatePayload(sharePath),
            };
          }
        }

        // Branch 3: Direct text message, meeting agenda, briefing, or custom data payload
        const finalTitle = rawTitle || (dataType ? `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Information` : 'Direct Information');
        const finalContent = rawContent || notes || (dataType ? `Shared ${dataType} data.` : 'No additional content.');

        await sendDirectInformation({
          senderId: user.id,
          senderName: user.preferredName || user.displayName || user.name || `@${user.username}`,
          recipientId: recipientUser.id,
          recipientName: recipientUser.displayName || recipientUser.name,
          type: (dataType === 'briefing' || dataType === 'note' ? dataType : 'note') as any,
          title: finalTitle,
          content: finalContent,
          permission,
        });

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const waText = `Hi ${recipientUser.displayName || recipientUser.name || `@${recipientUser.username}`},\n\n*${finalTitle}*\n${finalContent}\n\n— Sent via Hub-Mind by ${user.preferredName || user.displayName || user.name}`;
        const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

        return {
          result: {
            success: true,
            dataType: dataType || 'text',
            title: finalTitle,
            content: finalContent,
            recipient: { id: recipientUser.id, username: recipientUser.username, name: recipientUser.displayName || recipientUser.name },
            whatsAppShareLink: waLink,
            message: `Sent "${finalTitle}" directly to @${recipientUser.username}. Delivered to their notification center and inbox.`,
          },
        };
      }

      case 'share_resource': {
        const resourceType = (args.resourceType || 'document') as ResourceType;
        let resourceId = String(args.resourceId || '').trim();
        let resourceTitle = String(args.resourceTitle || '').trim();
        const recipientIdentifier = String(args.recipient || '').trim();
        const permission = (args.permission || 'read') as SharePermission;
        const message = args.message ? String(args.message).trim() : undefined;

        if (!resourceId) {
          return { result: { success: false, error: 'resourceId is required to share a resource.' } };
        }
        if (!recipientIdentifier) {
          return { result: { success: false, error: 'recipient (username, email, or name) is required.' } };
        }

        // Auto-resolve resource if passed by title
        const collName = resourceType === 'followup' ? 'followUps' : `${resourceType}s`;
        let item = await readResource(collName, resourceId, user);
        if (!item && resourceType === 'document') {
          const allDocs = await fetchAllDocumentsForUser(user);
          const match = allDocs.find(d => d.id === resourceId || (d.title && d.title.toLowerCase().includes(resourceId.toLowerCase())));
          if (match) {
            item = { id: match.id, data: match };
            resourceId = match.id;
            resourceTitle = resourceTitle || match.title;
          }
        } else if (!item && resourceType === 'task') {
          const tasksSnap = await getDocs(query(collection(db, 'tasks'), limit(50))).catch(() => ({ docs: [] }));
          const match = tasksSnap.docs.find(d => d.id === resourceId || String(d.data().title || '').toLowerCase().includes(resourceId.toLowerCase()));
          if (match) {
            item = { id: match.id, data: match.data() };
            resourceId = match.id;
            resourceTitle = resourceTitle || (match.data() as any).title;
          }
        }

        if (item && !resourceTitle) {
          resourceTitle = item.data.title || item.data.name || item.data.notesRaw?.split('\n')[0] || `${resourceType} ${resourceId}`;
        }

        const recipientUser = await findRecipientUser(recipientIdentifier);
        if (!recipientUser) {
          return {
            result: {
              success: false,
              error: `Could not find a user matching "${recipientIdentifier}". Please check the username or run list_workspace_users.`,
            },
          };
        }

        const share = await shareResourceWithUser({
          resourceType,
          resourceId,
          resourceTitle: resourceTitle || 'Shared Resource',
          ownerId: user.id,
          ownerName: user.preferredName || user.displayName || user.name || `@${user.username}`,
          recipientUsernameOrId: recipientUser.username || recipientUser.id,
          permission,
          message,
        });

        const sharePath = `/${resourceType}s/${resourceId}`;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const directUrl = `${origin}${sharePath}`;
        const waText = `*${resourceTitle || 'Resource'}*\nShared with you on Hub-Mind (${permission === 'write' ? 'Can Edit' : 'Read Only'}): ${directUrl}${message ? `\n\nNote: ${message}` : ''}`;
        const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

        return {
          result: {
            success: true,
            shareId: share.id,
            resourceType,
            resourceId,
            resourceTitle: resourceTitle || 'Shared Resource',
            recipient: {
              id: recipientUser.id,
              username: recipientUser.username,
              name: recipientUser.displayName || recipientUser.name,
            },
            permission,
            directUrl,
            whatsAppShareLink: waLink,
            message: `Successfully shared ${resourceType} "${resourceTitle || resourceId}" with @${recipientUser.username} (${permission === 'write' ? 'Can Edit' : 'Read Only'}). A notification has been delivered to their workspace.`,
          },
          actionPayload: navigatePayload(sharePath),
        };
      }

      case 'send_direct_information': {
        const recipientIdentifier = String(args.recipient || '').trim();
        const title = String(args.title || 'Direct Information / Note').trim();
        const content = String(args.content || '').trim();
        const infoType = (args.type || 'note') as any;
        const resourceId = args.resourceId ? String(args.resourceId).trim() : undefined;
        const permission = (args.permission || 'read') as SharePermission;

        if (!recipientIdentifier) return { result: { success: false, error: 'recipient is required.' } };
        if (!content) return { result: { success: false, error: 'content is required.' } };

        const recipientUser = await findRecipientUser(recipientIdentifier);
        if (!recipientUser) {
          return {
            result: {
              success: false,
              error: `Could not find a user matching "${recipientIdentifier}". Ask to check the username.`,
            },
          };
        }

        await sendDirectInformation({
          senderId: user.id,
          senderName: user.preferredName || user.displayName || user.name || `@${user.username}`,
          recipientId: recipientUser.id,
          recipientName: recipientUser.displayName || recipientUser.name,
          type: infoType,
          title,
          content,
          resourceId,
          permission,
        });

        const waText = `Hi ${recipientUser.displayName || recipientUser.name || `@${recipientUser.username}`},\n\n*${title}*\n${content}\n\n— Sent via Hub-Mind by ${user.preferredName || user.displayName || user.name}`;
        const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

        return {
          result: {
            success: true,
            recipient: {
              id: recipientUser.id,
              username: recipientUser.username,
              name: recipientUser.displayName || recipientUser.name,
            },
            title,
            type: infoType,
            contentPreview: content.slice(0, 150),
            whatsAppShareLink: waLink,
            message: `Sent "${title}" directly to @${recipientUser.username}. Delivered to their notification center.`,
          },
        };
      }

      case 'share_schedule': {
        const recipientIdentifier = String(args.recipient || '').trim();
        const meetingId = args.meetingId ? String(args.meetingId).trim() : undefined;
        const daysAhead = Math.max(1, Math.min(30, Number(args.daysAhead) || 7));
        const customNotes = args.notes ? String(args.notes).trim() : '';

        if (!recipientIdentifier) {
          return { result: { success: false, error: 'recipient is required to share a schedule.' } };
        }

        const recipientUser = await findRecipientUser(recipientIdentifier);
        if (!recipientUser) {
          return {
            result: {
              success: false,
              error: `Could not find user "${recipientIdentifier}".`,
            },
          };
        }

        let scheduleSummaryText = '';
        let scheduleTitle = '';

        if (meetingId) {
          const item = await readResource('meetings', meetingId, user);
          if (!item) {
            return { result: { success: false, error: `Meeting with ID "${meetingId}" not found.` } };
          }
          const m = item.data;
          scheduleTitle = `Meeting Details: ${m.title || m.notesRaw?.split('\n')[0] || 'Scheduled Meeting'}`;
          scheduleSummaryText = `📅 Date/Time: ${new Date(m.date).toLocaleString()}\n📍 Location: ${m.location || 'Hub-Mind / Online'}\n📝 Agenda: ${m.notesRaw || 'Regular Sync'}`;
        } else {
          // Fetch upcoming meetings and recurring events for the user
          const [meetingsSnap, templatesSnap] = await Promise.all([
            getDocs(query(collection(db, 'meetings'), limit(30))).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'recurringMeetingTemplates')).catch(() => ({ docs: [] })),
          ]);

          const now = new Date();
          const horizon = new Date(now.getTime() + daysAhead * 86400000);

          const upcomingMeetings = meetingsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(m => {
              if (!m.date) return false;
              const d = new Date(m.date);
              return d >= now && d <= horizon;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const templates = templatesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(t => t.active !== false && (t.ownerId === user.id || user.role === 'admin'));

          scheduleTitle = `Upcoming Schedule (${daysAhead} Days)`;
          const lines: string[] = [];

          if (upcomingMeetings.length > 0) {
            lines.push('--- Scheduled Meetings & Events ---');
            upcomingMeetings.forEach((m, idx) => {
              const dt = new Date(m.date);
              lines.push(`${idx + 1}. ${dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${m.title || m.notesRaw?.split('\n')[0] || 'Meeting'}${m.location ? ` (${m.location})` : ''}`);
            });
          }

          if (templates.length > 0) {
            lines.push('\n--- Recurring Classes & Sessions ---');
            templates.forEach(t => {
              lines.push(`• ${t.title}: ${t.frequency} at ${t.startTime}${t.endTime ? `–${t.endTime}` : ''}${t.location ? ` (${t.location})` : ''}`);
            });
          }

          if (lines.length === 0) {
            lines.push('No scheduled meetings or classes on calendar for the next ' + daysAhead + ' days.');
          }

          scheduleSummaryText = lines.join('\n');
        }

        if (customNotes) {
          scheduleSummaryText = `${customNotes}\n\n${scheduleSummaryText}`;
        }

        await sendDirectInformation({
          senderId: user.id,
          senderName: user.preferredName || user.displayName || user.name || `@${user.username}`,
          recipientId: recipientUser.id,
          recipientName: recipientUser.displayName || recipientUser.name,
          type: 'briefing',
          title: scheduleTitle,
          content: scheduleSummaryText,
          resourceId: meetingId,
          permission: 'read',
        });

        const waText = `Hi ${recipientUser.displayName || recipientUser.name || `@${recipientUser.username}`},\n\n*${scheduleTitle}*\n${scheduleSummaryText}\n\n— Sent via Hub-Mind by ${user.preferredName || user.displayName || user.name}`;
        const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

        return {
          result: {
            success: true,
            recipient: {
              id: recipientUser.id,
              username: recipientUser.username,
              name: recipientUser.displayName || recipientUser.name,
            },
            title: scheduleTitle,
            scheduleSummary: scheduleSummaryText,
            whatsAppShareLink: waLink,
            message: `Successfully shared schedule with @${recipientUser.username}. A full schedule briefing was delivered to their notification inbox.`,
          },
          actionPayload: navigatePayload('/calendar'),
        };
      }

      case 'get_share_link': {
        const resourceType = (args.resourceType || 'document') as ResourceType;
        const resourceId = String(args.resourceId || '').trim();
        const title = String(args.title || resourceId).trim();

        if (!resourceId) return { result: { success: false, error: 'resourceId is required.' } };

        let path = `/${resourceType}s/${resourceId}`;
        if (resourceType === 'followup') path = `/follow-ups/${resourceId}`;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${origin}${path}`;
        const shareUrl = `${origin}/share/${resourceType}/${encodeURIComponent(resourceId)}`;
        const waText = `*${title}*\nOpen in Hub-Mind: ${fullUrl}`;
        const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

        return {
          result: {
            success: true,
            resourceType,
            resourceId,
            directLink: fullUrl,
            sharedRecordLink: shareUrl,
            whatsAppShareLink: waLink,
            message: `Generated share links for ${resourceType} "${title}". Direct Link: ${fullUrl}`,
          },
        };
      }

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

      case 'delete_task': {
        const item = await readResource('tasks', args.taskId, user);
        if (!item || !(await canWrite('tasks', args.taskId, user))) {
          return { result: { success: false, error: 'Task not found or you do not have permission to delete it.' } };
        }
        const title = item.data.title || 'Task';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'tasks', args.taskId));
          return { result: { success: true, taskId: args.taskId, message: `Task "${title}" permanently deleted.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for task "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'task', itemId: args.taskId, itemTitle: title, collectionName: 'tasks' }
        };
      }

      case 'list_documents': {
        const allDocs = await fetchAllDocumentsForUser(user);
        let filtered = allDocs;
        if (args.query) {
          filtered = allDocs
            .map(d => ({ doc: d, score: fuzzyRelevance(String(args.query), d) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.doc);
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
        const term = String(args.title || '').trim();
        const allDocs = await fetchAllDocumentsForUser(user);
        const ranked = allDocs
          .map(d => ({ doc: d, score: fuzzyRelevance(term, d) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score || new Date(b.doc.updatedAt || b.doc.createdAt || 0).getTime() - new Date(a.doc.updatedAt || a.doc.createdAt || 0).getTime());
        if (!ranked.length) return { result: { success: false, message: `No document or workspace record related to "${args.title}" was found.` } };
        const top = ranked[0].doc;
        return {
          result: {
            success: true,
            document: { id: top.id, title: top.title, content: top.content || '', category: top.category },
            relevance: ranked[0].score,
            otherMatches: ranked.slice(1, 6).map(x => ({ id: x.doc.id, title: x.doc.title, relevance: x.score })),
            message: ranked[0].score >= 8 ? `Found the most relevant document: "${top.title}".` : `I found the closest relevant document, "${top.title}", based on your wording and its content.`,
          },
          actionPayload: navigatePayload(`/documents/${top.id}`),
        };
      }

      case 'get_document_content': {
        let docId = args.documentId || args.id || context?.documentId;
        let item = docId ? await readResource('documents', docId, user) : null;
        if (!item) {
          const allDocs = await fetchAllDocumentsForUser(user);
          const searchTerm = String(args.documentId || args.title || docId || '').toLowerCase().trim();
          const found = allDocs.find(d => d.id === docId || (d.title && d.title.toLowerCase().includes(searchTerm)));
          if (found) {
            item = { id: found.id, data: found };
            docId = found.id;
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
          content: markdownToTiptapHtml(args.content || ''),
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
          content: markdownToTiptapHtml(args.content || ''),
          updatedAt: now,
          lastSavedAt: now,
          lastEditedAt: now,
          synced: true,
        };
        setLocalDocsMap(localDocs);

        if (args.content) {
          queueJessDocumentEdit({ documentId: ref.id, content: data.content, mode: 'replace' });
        }

        return {
          result: { success: true, documentId: ref.id, title: data.title, message: `Document "${data.title}" successfully created.` },
          actionPayload: navigatePayload(`/documents/${ref.id}`),
        };
      }

      case 'edit_document':
      case 'update_document':
      case 'edit_document_live':
      case 'background_edit_document': {
        const rawContent = args.content !== undefined ? args.content : (args.contentToInsert !== undefined ? args.contentToInsert : args.contentToInsertOrUpdate !== undefined ? args.contentToInsertOrUpdate : args.body !== undefined ? args.body : args.text);
        const rawTitle = args.title !== undefined ? args.title : args.documentTitle;
        let docId = args.documentId || args.docId || args.id || context?.documentId;
        let item = docId ? await readResource('documents', docId, user) : null;
        if (!item) {
          const allDocs = await fetchAllDocumentsForUser(user);
          const searchTerm = String(args.documentTitle || args.title || args.documentId || docId || '').toLowerCase().trim();
          const found = allDocs.find(d => d.id === docId || (d.title && d.title.toLowerCase().includes(searchTerm)) || (searchTerm && d.title && searchTerm.includes(d.title.toLowerCase())));
          if (found) {
            item = { id: found.id, data: found };
            docId = found.id;
          }
        }

        // If document doesn't exist yet but user wants to write/create it
        if (!item || !docId) {
          if (rawTitle || rawContent) {
            const createRes = await executeJessTool('create_document', { title: rawTitle || 'New Document', content: rawContent || '' }, user, onPreferredName, context);
            return createRes;
          }
          return { result: { success: false, error: 'Document not found or access denied.' } };
        }

        if (!(await canWrite('documents', docId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this document.' } };
        }

        const ref = doc(db, 'documents', docId);
        const snap = await getDoc(ref);
        const current: any = snap.exists() ? snap.data() : (getLocalDocsMap()[docId] || {});
        const now = new Date().toISOString();
        const patch: any = { updatedAt: now, lastEditedAt: now, lastSavedAt: now, version: Number(current.version || 1) + 1 };
        if (rawTitle !== undefined) patch.title = rawTitle;
        
        let finalContent = rawContent !== undefined ? markdownToTiptapHtml(rawContent) : undefined;
        if (rawContent !== undefined) {
          const mode = args.mode || 'replace';
          if (mode === 'append' && current.content) {
            finalContent = `${current.content}${markdownToTiptapHtml(rawContent)}`;
          } else if (mode === 'prepend' && current.content) {
            finalContent = `${markdownToTiptapHtml(rawContent)}${current.content}`;
          }
          patch.content = finalContent;
        }

        await updateDoc(ref, patch).catch(async () => {
          await setDoc(ref, { ...current, ...patch }, { merge: true });
        });

        const localDocs = getLocalDocsMap();
        if (localDocs[docId]) {
          if (rawTitle) localDocs[docId].title = rawTitle;
          if (finalContent !== undefined) localDocs[docId].content = finalContent;
          localDocs[docId].updatedAt = now;
          setLocalDocsMap(localDocs);
        }

        if (finalContent !== undefined) {
          queueJessDocumentEdit({ documentId: docId, content: finalContent, mode: args.mode || 'replace' });
        }
        return {
          result: { success: true, documentId: docId, updated: patch, message: `Document "${patch.title || current.title || 'Document'}" updated successfully.` },
          actionPayload: navigatePayload(`/documents/${docId}`),
        };
      }

      case 'request_document_delete':
      case 'delete_document': {
        let docId = args.documentId || args.docId || args.id;
        let item = docId ? await readResource('documents', docId, user) : null;
        if (!item) {
          const allDocs = await fetchAllDocumentsForUser(user);
          const searchTerm = String(args.documentTitle || args.title || docId || '').toLowerCase().trim();
          const found = allDocs.find(d => d.id === docId || (d.title && d.title.toLowerCase() === searchTerm) || (searchTerm && d.title && d.title.toLowerCase().includes(searchTerm)));
          if (found) { item = { id: found.id, data: found }; docId = found.id; }
        }
        if (!item || !docId || !(await canWrite('documents', docId, user))) {
          return { result: { success: false, error: 'Document not found or you do not have permission to delete it.' } };
        }
        const title = item.data.title || 'Document';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'documents', docId));
          const local = getLocalDocsMap();
          delete local[docId];
          setLocalDocsMap(local);
          return { result: { success: true, documentId: docId, message: `Document "${title}" permanently deleted.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for document "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'document', itemId: docId, itemTitle: title, collectionName: 'documents' }
        };
      }

      case 'request_share_document': {
        return executeJessTool('share_resource', {
          resourceType: 'document',
          resourceId: args.documentId || args.docId || args.id,
          resourceTitle: args.documentTitle || args.title,
          recipient: args.recipient,
          permission: args.permission || 'read'
        }, user, onPreferredName, context);
      }

      case 'list_projects': {
        const snap = await getDocs(query(collection(db, 'projects'), limit(safeLimit(args.limit))));
        return { result: { success: true, projects: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      }

      case 'create_project': {
        const now = new Date().toISOString();
        const name = String(args.name || 'New Project').trim();
        const data = {
          name,
          description: args.description || '',
          status: args.status || 'active',
          ownerId: user.id,
          createdBy: user.id,
          visibility: 'workspace',
          createdAt: now,
          updatedAt: now,
        };
        const ref = await addDoc(collection(db, 'projects'), data);
        return {
          result: { success: true, projectId: ref.id, project: { id: ref.id, ...data }, message: `Project "${name}" created.` },
          actionPayload: navigatePayload(`/projects/${ref.id}`)
        };
      }

      case 'update_project': {
        if (!(await canWrite('projects', args.projectId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this project.' } };
        }
        const patch: any = { updatedAt: new Date().toISOString() };
        if (args.name !== undefined) patch.name = args.name;
        if (args.description !== undefined) patch.description = args.description;
        if (args.status !== undefined) patch.status = args.status;
        await updateDoc(doc(db, 'projects', args.projectId), patch);
        return { result: { success: true, projectId: args.projectId, updated: patch } };
      }

      case 'delete_project': {
        const item = await readResource('projects', args.projectId, user);
        if (!item || !(await canWrite('projects', args.projectId, user))) {
          return { result: { success: false, error: 'Project not found or you do not have permission to delete it.' } };
        }
        const title = item.data.name || 'Project';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'projects', args.projectId));
          return { result: { success: true, projectId: args.projectId, message: `Project "${title}" permanently deleted.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for project "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'project', itemId: args.projectId, itemTitle: title, collectionName: 'projects' }
        };
      }

      case 'open_project': {
        let projId = args.projectId || args.id || args.name;
        let item = projId ? await readResource('projects', projId, user) : null;
        if (!item) {
          const snap = await getDocs(query(collection(db, 'projects'), limit(100))).catch(() => ({ docs: [] }));
          const searchTerm = String(projId || '').toLowerCase().trim();
          const found = snap.docs.find(d => d.id === projId || String(d.data().name || '').toLowerCase().includes(searchTerm));
          if (found) {
            item = { id: found.id, data: found.data() };
            projId = found.id;
          }
        }
        return item
          ? { result: { success: true, project: { id: item.id, ...item.data }, message: `Opening project "${item.data.name || 'Project'}" on screen.` }, actionPayload: navigatePayload(`/projects/${projId}`) }
          : { result: { success: false, error: `Project "${projId || ''}" not found or access denied.` } };
      }

      case 'list_clients': {
        const snap = await getDocs(query(collection(db, 'clients'), limit(safeLimit(args.limit))));
        return { result: { success: true, clients: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      }

      case 'create_client': {
        const now = new Date().toISOString();
        const name = String(args.name || 'New Client').trim();
        const data = {
          name,
          type: args.type || 'partner',
          email: args.email || '',
          phone: args.phone || '',
          address: args.address || '',
          notes: args.notes || '',
          status: args.status || 'active',
          ownerId: user.id,
          createdBy: user.id,
          visibility: 'workspace',
          createdAt: now,
          updatedAt: now,
        };
        const ref = await addDoc(collection(db, 'clients'), data);
        return {
          result: { success: true, clientId: ref.id, client: { id: ref.id, ...data }, message: `Client profile "${name}" created.` },
          actionPayload: navigatePayload(`/clients/${ref.id}`)
        };
      }

      case 'update_client': {
        if (!(await canWrite('clients', args.clientId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this client.' } };
        }
        const patch: any = { updatedAt: new Date().toISOString() };
        for (const key of ['name', 'type', 'email', 'phone', 'address', 'notes', 'status']) {
          if (args[key] !== undefined) patch[key] = args[key];
        }
        await updateDoc(doc(db, 'clients', args.clientId), patch);
        return { result: { success: true, clientId: args.clientId, updated: patch } };
      }

      case 'delete_client': {
        const item = await readResource('clients', args.clientId, user);
        if (!item || !(await canWrite('clients', args.clientId, user))) {
          return { result: { success: false, error: 'Client not found or you do not have permission to delete it.' } };
        }
        const title = item.data.name || 'Client';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'clients', args.clientId));
          return { result: { success: true, clientId: args.clientId, message: `Client "${title}" permanently deleted.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for client "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'client', itemId: args.clientId, itemTitle: title, collectionName: 'clients' }
        };
      }

      case 'get_schedule':
      case 'list_meetings': {
        // Materialization is maintenance work, not a reason to delay a voice answer.
        void materializeRecurringMeetings(90, user).catch(() => {});

        const now = new Date();
        let queryStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        let queryEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90, 23, 59, 59);

        const period = String(args.period || '').toLowerCase();
        if (period === 'today') {
          queryStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          queryEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (period === 'tomorrow') {
          queryStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
          queryEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
        } else if (period === 'this_week') {
          const dayOfWeek = now.getDay();
          const startSunday = new Date(now);
          startSunday.setDate(now.getDate() - dayOfWeek);
          startSunday.setHours(0, 0, 0, 0);
          const endSaturday = new Date(startSunday);
          endSaturday.setDate(startSunday.getDate() + 6);
          endSaturday.setHours(23, 59, 59, 999);
          queryStart = startSunday;
          queryEnd = endSaturday;
        } else if (period === 'next_week') {
          const dayOfWeek = now.getDay();
          const nextSunday = new Date(now);
          nextSunday.setDate(now.getDate() + (7 - dayOfWeek));
          nextSunday.setHours(0, 0, 0, 0);
          const nextSaturday = new Date(nextSunday);
          nextSaturday.setDate(nextSunday.getDate() + 6);
          nextSaturday.setHours(23, 59, 59, 999);
          queryStart = nextSunday;
          queryEnd = nextSaturday;
        } else if (period === 'this_month') {
          queryStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          queryEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (args.startDate) {
          const parsedStart = new Date(args.startDate);
          if (!isNaN(parsedStart.getTime())) {
            queryStart = parsedStart;
          }
          if (args.endDate) {
            const parsedEnd = new Date(args.endDate);
            if (!isNaN(parsedEnd.getTime())) {
              queryEnd = parsedEnd;
            }
          } else {
            queryEnd = new Date(queryStart.getFullYear(), queryStart.getMonth(), queryStart.getDate(), 23, 59, 59);
          }
        }

        // 1. Read the warm local workspace index first. Firestore listeners keep it fresh.
        let cachedMeetings = getCachedCollection<any>('meetings');
        let cachedTemplates = getCachedCollection<any>('recurringMeetingTemplates');
        if (cachedMeetings.length === 0 || cachedTemplates.length === 0) {
          const isPrivileged = user.role === 'admin';
          const meetingsQuery = isPrivileged
            ? collection(db, 'meetings')
            : query(collection(db, 'meetings'), where('ownerId', '==', user.id));
          const [meetingsSnap, templatesSnap] = await Promise.all([
            getDocs(query(meetingsQuery, limit(150))).catch(() => ({ docs: [] })),
            getDocs(isPrivileged
              ? query(collection(db, 'recurringMeetingTemplates'), where('active', '==', true), limit(150))
              : query(collection(db, 'recurringMeetingTemplates'), where('active', '==', true), where('ownerId', '==', user.id), limit(150))
            ).catch(() => ({ docs: [] })),
          ]);
          if (cachedMeetings.length === 0) cachedMeetings = meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (cachedTemplates.length === 0) cachedTemplates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        const allMeetings: any[] = [];
        cachedMeetings.forEach((d: any) => {
          const data = d.data || d;
          const mDate = new Date(data.date);
          if (!isNaN(mDate.getTime()) && mDate >= queryStart && mDate <= queryEnd) {
            allMeetings.push({
              id: d.id,
              title: data.title || data.notesRaw?.split('\n')[0] || 'Scheduled Event',
              date: data.date,
              time: format(mDate, 'h:mm a'),
              startTime: data.startTime || format(mDate, 'HH:mm'),
              endTime: data.endTime,
              location: data.location || null,
              status: data.status || 'scheduled',
              isRecurring: !!data.recurringTemplateId || !!data.recurringInstance,
              recurringTemplateId: data.recurringTemplateId || null,
              type: data.recurringTemplateId ? 'recurring_schedule' : 'meeting',
              attendees: data.attendees || []
            });
          }
        });

        // 2. Recurring templates are already in the same warm index.
        const templates = cachedTemplates
          .map((d: any) => ({ id: d.id, ...(d.data || d) } as RecurringMeetingTemplate))
          .filter((template: any) => template.active !== false && (user.role === 'admin' || template.ownerId === user.id));

        // Merge Google Calendar into the same schedule response. Cached events are instant;
        // a background refresh keeps them current without making every voice request wait.
        if (isGoogleCalendarConnected()) {
          const cachedGoogleEvents = getCachedGoogleCalendarEvents(queryStart.toISOString(), queryEnd.toISOString());
          const googleEvents = cachedGoogleEvents.length > 0
            ? cachedGoogleEvents
            : await Promise.race([
                refreshGoogleCalendarEvents(queryStart.toISOString(), queryEnd.toISOString()),
                new Promise<any[]>(resolve => setTimeout(() => resolve([]), 2500)),
              ]).catch(() => []);
          if (cachedGoogleEvents.length > 0) {
            void refreshGoogleCalendarEvents(queryStart.toISOString(), queryEnd.toISOString()).catch(() => {});
          }
          for (const event of googleEvents) {
            const eventDate = new Date(event.start?.dateTime || event.start?.date || '');
            if (isNaN(eventDate.getTime()) || eventDate < queryStart || eventDate > queryEnd) continue;
            if (allMeetings.some(item => item.googleCalendarId === event.id)) continue;
            allMeetings.push({
              id: `google-${event.id}`,
              googleCalendarId: event.id,
              title: event.summary || 'Google Calendar event',
              date: eventDate.toISOString(),
              time: format(eventDate, 'h:mm a'),
              startTime: format(eventDate, 'HH:mm'),
              endTime: event.end?.dateTime ? format(new Date(event.end.dateTime), 'HH:mm') : undefined,
              location: undefined,
              status: 'scheduled',
              isRecurring: !!event.recurrence,
              type: 'google_calendar',
              attendees: [],
            });
          }
        }

        // Evaluate recurring templates within queryStart .. queryEnd
        const dayDifference = Math.min(90, Math.max(1, Math.ceil((queryEnd.getTime() - queryStart.getTime()) / (1000 * 60 * 60 * 24))));
        for (const template of templates) {
          const tStart = new Date(template.startDate);
          const tEnd = template.endDate ? new Date(template.endDate) : queryEnd;

          for (let i = 0; i <= dayDifference; i++) {
            const checkDate = new Date(queryStart);
            checkDate.setDate(queryStart.getDate() + i);
            if (checkDate < tStart || checkDate > tEnd) continue;

            const dailyMatch = template.frequency === 'daily';
            const weeklyMatch = template.frequency === 'weekly' && (template.daysOfWeek || []).includes(checkDate.getDay());
            const monthlyMatch = template.frequency === 'monthly' && checkDate.getDate() === template.dayOfMonth;

            if (dailyMatch || weeklyMatch || monthlyMatch) {
              const [h, m] = (template.startTime || '09:00').split(':').map(Number);
              const occDate = new Date(checkDate);
              occDate.setHours(h || 0, m || 0, 0, 0);

              if (occDate >= queryStart && occDate <= queryEnd) {
                const exists = allMeetings.some(m => 
                  m.recurringTemplateId === template.id && 
                  new Date(m.date).toDateString() === occDate.toDateString()
                );
                if (!exists) {
                  allMeetings.push({
                    id: `recurring-${template.id}-${format(occDate, 'yyyy-MM-dd')}`,
                    title: template.title,
                    date: occDate.toISOString(),
                    time: format(occDate, 'h:mm a'),
                    startTime: template.startTime,
                    endTime: template.endTime,
                    location: template.location || null,
                    status: 'scheduled',
                    isRecurring: true,
                    frequency: template.frequency,
                    recurringTemplateId: template.id,
                    type: template.type || 'recurring_schedule',
                    attendees: template.attendees || []
                  });
                }
              }
            }
          }
        }

        // Sort chronologically
        allMeetings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Format conversational summary text
        const total = allMeetings.length;
        const periodLabel = period ? period.replace('_', ' ') : `from ${format(queryStart, 'MMM d')} to ${format(queryEnd, 'MMM d')}`;
        let summaryText = '';
        if (total === 0) {
          summaryText = `There are no scheduled meetings or recurring classes found for ${periodLabel}.`;
        } else {
          const itemsSummary = allMeetings.map((item, idx) => {
            const itemDate = new Date(item.date);
            const dateStr = format(itemDate, 'EEEE, MMM d');
            const timeStr = item.time || item.startTime || 'All day';
            const recLabel = item.isRecurring ? ' (Recurring Schedule)' : ' (Meeting)';
            return `${idx + 1}. ${item.title} at ${timeStr}, ${dateStr}${recLabel}${item.location ? ` [Location: ${item.location}]` : ''}`;
          }).join('\n');
          summaryText = `You have ${total} item${total === 1 ? '' : 's'} on your schedule for ${periodLabel}:\n${itemsSummary}`;
        }

        return {
          result: {
            success: true,
            total,
            period: period || 'range',
            startDate: queryStart.toISOString(),
            endDate: queryEnd.toISOString(),
            schedules: allMeetings,
            meetings: allMeetings,
            summaryText
          }
        };
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
        const item = await readResource('meetings', args.meetingId, user);
        if (!item || !(await canWrite('meetings', args.meetingId, user))) {
          return { result: { success: false, error: 'Meeting not found or you do not have permission to delete it.' } };
        }
        const title = item.data.title || item.data.notesRaw?.split('\n')[0] || 'Meeting';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'meetings', args.meetingId));
          return { result: { success: true, meetingId: args.meetingId, message: `Meeting "${title}" removed from calendar.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for meeting "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'meeting', itemId: args.meetingId, itemTitle: title, collectionName: 'meetings' }
        };
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

      case 'update_recurring_schedule': {
        const templateId = String(args.templateId || '');
        if (!templateId) return { result: { success: false, error: 'templateId is required.' } };
        const snap = await getDoc(doc(db, 'recurringMeetingTemplates', templateId));
        if (!snap.exists()) return { result: { success: false, error: 'Schedule template not found.' } };
        const patch: any = { updatedAt: new Date().toISOString() };
        if (args.title !== undefined) patch.title = args.title;
        if (args.type !== undefined) patch.type = args.type;
        if (args.frequency !== undefined) patch.frequency = args.frequency;
        if (args.daysOfWeek !== undefined) patch.daysOfWeek = normalizeDaysOfWeek(args.daysOfWeek);
        if (args.startTime !== undefined) patch.startTime = normalizeTime(args.startTime);
        if (args.endTime !== undefined) patch.endTime = normalizeTime(args.endTime);
        if (args.startDate !== undefined) patch.startDate = args.startDate;
        if (args.endDate !== undefined) patch.endDate = args.endDate;
        if (args.location !== undefined) patch.location = args.location;
        if (args.description !== undefined) patch.description = args.description;
        await updateDoc(doc(db, 'recurringMeetingTemplates', templateId), patch);
        await materializeRecurringMeetings(90, user);
        return { result: { success: true, templateId, updated: patch, message: 'Recurring schedule updated and calendar regenerated.' } };
      }

      case 'delete_recurring_schedule': {
        const templateId = String(args.templateId || '');
        if (!templateId) return { result: { success: false, error: 'templateId is required.' } };
        const snap = await getDoc(doc(db, 'recurringMeetingTemplates', templateId));
        if (!snap.exists()) return { result: { success: false, error: 'Schedule template not found.' } };
        const tData: any = snap.data();
        const title = tData.title || 'Recurring schedule';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'recurringMeetingTemplates', templateId));
          return { result: { success: true, message: `Recurring schedule template "${title}" deleted.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for schedule "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'schedule', itemId: templateId, itemTitle: title, collectionName: 'recurringMeetingTemplates' }
        };
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

      case 'create_follow_up': {
        const now = new Date().toISOString();
        const data = {
          title: args.title,
          person: args.person || '',
          reason: args.reason || '',
          dueAt: args.dueAt || now,
          status: 'scheduled',
          priority: args.priority || 'medium',
          notes: args.notes || '',
          ownerId: user.id,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        };
        const ref = await addDoc(collection(db, 'followUps'), data);
        return {
          result: { success: true, followUpId: ref.id, followUp: { id: ref.id, ...data }, message: `Follow-up "${args.title}" created.` },
          actionPayload: navigatePayload('/follow-ups')
        };
      }

      case 'update_follow_up': {
        if (!(await canWrite('followUps', args.followUpId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this follow-up.' } };
        }
        const patch: any = { updatedAt: new Date().toISOString() };
        for (const key of ['title', 'person', 'reason', 'dueAt', 'status', 'priority', 'notes']) {
          if (args[key] !== undefined) patch[key] = args[key];
        }
        await updateDoc(doc(db, 'followUps', args.followUpId), patch);
        return { result: { success: true, followUpId: args.followUpId, updated: patch } };
      }

      case 'delete_follow_up': {
        const item = await readResource('followUps', args.followUpId, user);
        if (!item || !(await canWrite('followUps', args.followUpId, user))) {
          return { result: { success: false, error: 'Follow-up not found or you do not have permission to delete it.' } };
        }
        const title = item.data.title || 'Follow-up';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'followUps', args.followUpId));
          return { result: { success: true, followUpId: args.followUpId, message: `Follow-up "${title}" permanently deleted.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for follow-up "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'followUp', itemId: args.followUpId, itemTitle: title, collectionName: 'followUps' }
        };
      }

      case 'list_knowledge': {
        const snap = await getDocs(query(collection(db, 'knowledge'), limit(safeLimit(args.limit))));
        return { result: { success: true, knowledge: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      }

      case 'create_knowledge': {
        const now = new Date().toISOString();
        const data = {
          title: args.title,
          content: args.content,
          category: args.category || 'sop',
          tags: Array.isArray(args.tags) ? args.tags : [],
          createdBy: user.id,
          ownerId: user.id,
          createdAt: now,
          updatedAt: now,
        };
        const ref = await addDoc(collection(db, 'knowledge'), data);
        return {
          result: { success: true, knowledgeId: ref.id, message: `Knowledge article "${args.title}" created.` },
          actionPayload: navigatePayload('/knowledge')
        };
      }

      case 'update_knowledge': {
        if (!(await canWrite('knowledge', args.knowledgeId, user))) {
          return { result: { success: false, error: 'You do not have permission to update this knowledge item.' } };
        }
        const patch: any = { updatedAt: new Date().toISOString() };
        if (args.title !== undefined) patch.title = args.title;
        if (args.content !== undefined) patch.content = args.content;
        if (args.category !== undefined) patch.category = args.category;
        if (args.tags !== undefined) patch.tags = args.tags;
        await updateDoc(doc(db, 'knowledge', args.knowledgeId), patch);
        return { result: { success: true, knowledgeId: args.knowledgeId, updated: patch } };
      }

      case 'delete_knowledge': {
        const item = await readResource('knowledge', args.knowledgeId, user);
        if (!item || !(await canWrite('knowledge', args.knowledgeId, user))) {
          return { result: { success: false, error: 'Knowledge item not found or you do not have permission to delete it.' } };
        }
        const title = item.data.title || 'Knowledge article';
        if (args.confirmed === true) {
          await deleteDoc(doc(db, 'knowledge', args.knowledgeId));
          return { result: { success: true, knowledgeId: args.knowledgeId, message: `Knowledge article "${title}" permanently deleted.` } };
        }
        return {
          result: { success: true, pendingConfirmation: true, message: `Opened deletion confirmation modal for knowledge article "${title}". Please click the final Delete button on your dashboard to confirm.` },
          actionPayload: { type: 'confirm_delete', itemType: 'knowledge', itemId: args.knowledgeId, itemTitle: title, collectionName: 'knowledge' }
        };
      }

      case 'open_task': {
        let taskId = args.taskId || args.id || args.title;
        let item = taskId ? await readResource('tasks', taskId, user) : null;
        if (!item) {
          const snap = await getDocs(query(collection(db, 'tasks'), limit(100))).catch(() => ({ docs: [] }));
          const searchTerm = String(taskId || '').toLowerCase().trim();
          const found = snap.docs.find(d => d.id === taskId || String(d.data().title || '').toLowerCase().includes(searchTerm));
          if (found) {
            item = { id: found.id, data: found.data() };
            taskId = found.id;
          }
        }
        return item
          ? { result: { success: true, task: { id: item.id, ...item.data }, message: `Opening task "${item.data.title || 'Task'}" on screen.` }, actionPayload: navigatePayload(`/tasks/${taskId}`) }
          : { result: { success: false, error: `Task "${taskId || ''}" not found or access denied.` } };
      }

      case 'open_client': {
        let clientId = args.clientId || args.id || args.name;
        let item = clientId ? await readResource('clients', clientId, user) : null;
        if (!item) {
          const snap = await getDocs(query(collection(db, 'clients'), limit(100))).catch(() => ({ docs: [] }));
          const searchTerm = String(clientId || '').toLowerCase().trim();
          const found = snap.docs.find(d => d.id === clientId || String(d.data().name || '').toLowerCase().includes(searchTerm));
          if (found) {
            item = { id: found.id, data: found.data() };
            clientId = found.id;
          }
        }
        return item
          ? { result: { success: true, client: { id: item.id, ...item.data }, message: `Opening client "${item.data.name || 'Client'}" on screen.` }, actionPayload: navigatePayload(`/clients/${clientId}`) }
          : { result: { success: false, error: `Client "${clientId || ''}" not found or access denied.` } };
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

      case 'save_activity_report': {
        const period = args.period === 'weekly' ? 'weekly' : 'daily';
        const now = new Date();
        const dateKey = String(args.dateKey || format(now, 'yyyy-MM-dd'));
        const title = String(args.title || (period === 'weekly' ? 'Weekly Activity Report' : 'Daily Report — ' + format(now, 'dd MMMM yyyy')));
        const report = String(args.report || '').trim();
        if (!report) return { result: { success: false, error: 'Report content is required.' } };
        const collectionName = period === 'weekly' ? 'weeklyReports' : 'dailyReports';
        await setDoc(doc(db, 'users', user.id, collectionName, dateKey), {
          date: dateKey,
          authorId: user.id,
          authorName: user.displayName || user.preferredName || user.name || user.username,
          report,
          updatedAt: now.toISOString(),
          snapshot: args.snapshot || {},
        }, { merge: true });

        const htmlContent = report.split('\n').map((line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return '<br/>';
          if (trimmed.startsWith('•')) return '<li>' + trimmed.substring(1).trim() + '</li>';
          if (trimmed.endsWith(':') || /REPORT/i.test(trimmed)) return '<h3><strong>' + trimmed + '</strong></h3>';
          return '<p>' + trimmed.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
        }).join('');
        const docRef = await addDoc(collection(db, 'documents'), {
          title,
          content: htmlContent,
          category: 'report',
          ownerId: user.id,
          createdBy: user.id,
          visibility: 'workspace',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          lastEditedAt: now.toISOString(),
          lastSavedAt: now.toISOString(),
          version: 1,
          type: 'internal',
        });
        return { result: { success: true, reportId: dateKey, documentId: docRef.id, title, message: title + ' saved to the ' + period + ' reports and workspace Documents.' } };
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

      case 'open_colleagues':
      case 'open_people': {
        return { result: { success: true, path: '/colleagues' }, actionPayload: navigatePayload('/colleagues') };
      }

      case 'scroll_screen':
      case 'stop_screen_control':
      case 'click_screen':
      case 'type_screen': {
        const payload = name === 'stop_screen_control'
          ? { type: 'screen_control', action: 'stop' }
          : name === 'scroll_screen'
            ? { type: 'screen_control', action: 'scroll', mode: args.mode || 'by', direction: args.direction || 'down', speed: args.speed || 'normal', amount: Number(args.amount || 0) }
            : { type: 'screen_control', action: name === 'click_screen' ? 'click' : 'type', target: args.target, selector: args.selector, text: args.text, clearFirst: args.clearFirst };
        return { result: { success: true, message: 'Screen control command accepted.' }, actionPayload: payload };
      }

      case 'navigate_app': {
        let path = String(args.path || '').trim();
        const lower = path.toLowerCase().replace(/^\/+/, '');
        if (lower === 'people' || lower === 'colleagues' || lower === 'colleague' || lower === 'team' || lower === 'directory' || lower === 'members') {
          path = '/colleagues';
        } else if (lower === 'today' || lower === 'dashboard' || lower === 'home') {
          path = '/';
        } else if (!path.startsWith('/')) {
          path = '/' + path;
        }
        if (path === '/people') path = '/colleagues';
        if (path.startsWith('//') || path.includes('://')) {
          return { result: { success: false, error: 'Only internal Hub-Mind routes are allowed.' } };
        }
        return { result: { success: true, path }, actionPayload: navigatePayload(path) };
      }

      case 'open_document': {
        const queryTerm = String(args.documentTitle || args.title || args.documentId || args.id || '').trim();
        let docId = args.documentId || args.id;
        let item = docId ? await readResource('documents', docId, user) : null;
        if (!item) {
          const allDocs = await fetchAllDocumentsForUser(user);
          const searchTerm = queryTerm.toLowerCase();
          const found = allDocs.find(d => 
            d.id === docId || 
            (d.title && d.title.toLowerCase() === searchTerm) ||
            (searchTerm && d.title && d.title.toLowerCase().includes(searchTerm)) ||
            (searchTerm && d.title && searchTerm.includes(d.title.toLowerCase()))
          );
          if (found) {
            item = { id: found.id, data: found };
            docId = found.id;
          }
        }
        return item && docId
          ? { result: { success: true, documentId: docId, title: item.data.title, message: `Opening document "${item.data.title || 'Untitled'}" on screen.` }, actionPayload: navigatePayload(`/documents/${docId}`) }
          : { result: { success: false, error: `Document "${queryTerm || docId || ''}" not found or access denied.` } };
      }

      case 'set_preferred_name': {
        const clean = String(args.preferredName || '').trim();
        if (!clean) return { result: { success: false, error: 'Preferred name cannot be empty.' } };
        onPreferredName?.(clean);
        // Persist to user's personalized memory
        await saveUserMemory(user.id, {
          key: 'preferred_name',
          content: `User prefers to be addressed as "${clean}".`,
          category: 'preference',
          importance: 'high',
          source: 'explicit',
        }).catch(() => {});
        return { result: { success: true, preferredName: clean, message: `Saved preferred name as "${clean}". Jess will remember this across all sessions.` } };
      }

      case 'set_language_preference': {
        const language = String(args.language || 'English').trim();
        await saveUserMemory(user.id, {
          key: 'preferred_language',
          content: `User's chosen language for conversations and voice interactions is ${language}. The default policy is English 90% of the time, but Jess seamlessly uses ${language} when requested.`,
          category: 'preference',
          importance: 'high',
          source: 'explicit',
        }).catch(() => {});
        return {
          result: {
            success: true,
            language,
            message: `Updated conversation language preference to ${language}. Jess will now listen and respond in ${language}. You can switch back to English or any other language at any time just by asking.`,
          },
        };
      }

      case 'set_voice_isolation_mode': {
        const mode = String(args.mode || 'high_priority_voice').trim();
        await saveUserMemory(user.id, {
          key: 'voice_isolation_mode',
          content: `Noise suppression & voice isolation mode set to "${mode}". Jess focuses strictly on the highest/clearest speaker voice and rejects background noises.`,
          category: 'preference',
          importance: 'medium',
          source: 'explicit',
        }).catch(() => {});
        return {
          result: {
            success: true,
            mode,
            message: `Voice isolation mode set to "${mode}". Noise suppression is active to prioritize your voice and filter out background chatter and ambient noise.`,
          },
        };
      }

      case 'save_user_memory': {
        const content = String(args.content || '').trim();
        if (!content) return { result: { success: false, error: 'Memory content is required.' } };
        const key = args.key ? String(args.key).trim() : undefined;
        const category = (args.category || 'preference') as any;
        const importance = (args.importance || 'medium') as any;

        const memory = await saveUserMemory(user.id, {
          content,
          key,
          category,
          importance,
          source: 'explicit',
        });

        return {
          result: {
            success: true,
            memoryId: memory.id,
            key: memory.key,
            content: memory.content,
            category: memory.category,
            message: `Remembered for @${user.username}: "${content}". I will keep this in mind across all your future sessions.`,
          },
        };
      }

      case 'get_user_memories': {
        const memories = await getUserMemories(user.id);
        const filtered = args.category ? memories.filter(m => m.category === args.category) : memories;
        return {
          result: {
            success: true,
            total: filtered.length,
            memories: filtered.map(m => ({
              id: m.id,
              key: m.key,
              content: m.content,
              category: m.category,
              importance: m.importance,
              updatedAt: m.updatedAt,
            })),
          },
        };
      }

      case 'forget_user_memory': {
        const keyOrId = String(args.keyOrMemoryId || '').trim();
        if (!keyOrId) return { result: { success: false, error: 'keyOrMemoryId is required.' } };
        const ok = await deleteUserMemory(user.id, keyOrId);
        return {
          result: {
            success: ok,
            message: ok ? `Successfully forgot memory "${keyOrId}".` : `Memory "${keyOrId}" could not be found.`,
          },
        };
      }

      case 'start_background_operation': {
        const taskTitle = String(args.title || 'Workspace Background Operation');
        const description = String(args.description || '');
        const taskType = (args.taskType || 'custom') as any;
        const steps = Array.isArray(args.steps) ? args.steps.filter((s: any) => s && s.tool) : [];
        if (!steps.length) {
          return { result: { success: false, error: 'A background operation needs at least one executable tool step so progress can be measured accurately.' } };
        }
        const bgTask = jessBackgroundTasks.enqueueTask({
          title: taskTitle,
          description,
          taskType,
          priority: 'normal',
          userId: user.id,
          payload: { steps },
          onComplete: async (task) => {
            const total = steps.length;
            const completed: string[] = [];
            for (let index = 0; index < total; index++) {
              const step = steps[index];
              const label = String(step.label || step.tool);
              jessBackgroundTasks.updateTaskProgress(task.id, Math.max(1, Math.round((index / total) * 95)), 'Working: ' + label + ' (' + (index + 1) + '/' + total + ')');
              let stepResult: any = null;
              let lastError = 'tool execution failed';
              for (let attempt = 1; attempt <= 3; attempt++) {
                stepResult = await executeJessTool(String(step.tool), step.args || {}, user, onPreferredName, context);
                if (stepResult.result?.success) break;
                lastError = stepResult.result?.error || 'tool execution failed';
                jessBackgroundTasks.updateTaskProgress(task.id, Math.max(1, Math.round((index / total) * 95)), 'Retrying: ' + label + ' (attempt ' + (attempt + 1) + '/3)');
                await new Promise(resolve => setTimeout(resolve, Math.min(1500 * attempt, 4000)));
              }
              if (!stepResult?.result?.success) throw new Error(label + ' failed after retries: ' + lastError);
              completed.push(label);
              jessBackgroundTasks.updateTaskProgress(task.id, Math.round(((index + 1) / total) * 95), 'Completed: ' + label + ' (' + (index + 1) + '/' + total + ')');
            }
            return { summary: 'Completed ' + completed.length + '/' + total + ' background steps for "' + taskTitle + '".' };
          }
        });
        return { result: { success: true, taskId: bgTask.id, progress: bgTask.progress, stage: bgTask.stage, message: 'Started "' + taskTitle + '" as a real background workflow with ' + steps.length + ' executable steps. Progress will reflect actual completed work.' } };
      }

      case 'get_background_tasks_status': {
        if (args.taskId) {
          const t = jessBackgroundTasks.getTask(args.taskId, user.id);
          if (!t) return { result: { success: false, error: `Task ${args.taskId} not found.` } };
          return { result: { success: true, task: t } };
        }
        return {
          result: {
            success: true,
            activeTasks: jessBackgroundTasks.getActiveTasksForUser(user.id),
            allTasks: jessBackgroundTasks.getTasksForUser(user.id).slice(0, 5),
            summary: jessBackgroundTasks.getActiveTasksSummary(user.id),
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
