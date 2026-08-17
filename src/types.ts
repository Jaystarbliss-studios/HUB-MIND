export type Role = 'admin' | 'assistant' | 'teacher' | 'staff';
export type UserStatus = 'active' | 'training' | 'inactive';
export type ClientType = 'school' | 'parent' | 'partner';
export type ClientStatus = 'active' | 'lead' | 'inactive';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'under_review' | 'completed' | 'archived';

export interface User {
  id: string;
  name: string;
  preferredName?: string;
  email: string;
  role: Role;
  status: UserStatus;
  phone?: string;
  trainingStartDate?: string;
  confirmedDate?: string;
  createdAt: string;
  photoUrl?: string;
}

export interface Client {
  projectId?: string;
  id: string;
  name: string;
  type: ClientType;
  phone?: string;
  email?: string;
  address?: string;
  status: ClientStatus;
  ownerId?: string; // userId
  createdAt: string;
  photoUrl?: string;
}

export interface Task {
  projectId?: string;
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string; // userId
  createdBy: string; // userId
  clientId?: string;
  deadline?: string; // timestamp or ISO string
  checklist: { item: string; done: boolean }[];
  comments: { userId: string; text: string; timestamp: string }[];
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export type MeetingStatus = 'scheduled' | 'in_session' | 'completed' | 'canceled' | 'rescheduled';
export interface Meeting {
  status?: MeetingStatus;
  projectId?: string;
  decisions?: string[];
  openQuestions?: string[];
  id: string;
  clientId?: string;
  ownerId?: string; // userId
  attendees: string[]; // names or userIds
  date: string; // timestamp or ISO string
  notesRaw: string;
  aiSummary?: string;
  actionPoints: { text: string; assignedTo: string; deadline: string }[];
  generatedDocs: { type: string; fileRef: string; createdAt: string }[];
  createdAt: string;
}

export interface DocumentInfo {
  projectId?: string;
  id: string;
  title: string;
  category: string;
  type?: 'internal' | 'external'; // contract | report | invoice | exam | certificate | other
  clientId?: string;
  ownerId?: string; // userId
  fileRef: string; // Drive link
  version: number;
  createdBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string; // deadline | payment | birthday | meeting | task_completed
  message: string;
  read: boolean;
  createdAt: string;
}

export interface InboxItem {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
  status: 'unprocessed' | 'processed';
  convertedTo: {
    type: 'task' | 'meeting' | 'client' | 'reminder' | 'archived' | 'knowledge';
    id: string;
  } | null;
}

export interface RecurringTaskTemplate {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assignedTo: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  lastGeneratedDate?: string;
  active: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  category: 'sop' | 'template' | 'faq' | 'lesson';
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  entityId: string;
  entityType: 'task' | 'meeting' | 'client' | 'document' | 'project' | 'knowledge';
  action: string;
  userId: string;
  details: string;
  createdAt: string;
}
export type LiveConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type ShawnState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'muted';

export interface MessageActionPayload {
  type: 'delete_document' | 'share_document' | 'set_preferred_name';
  documentId?: string;
  documentTitle?: string;
  confirmed?: boolean;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'executed';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'shawn';
  text: string;
  timestamp: string;
  parentMessageId?: string | null;
  isStreaming?: boolean;
  audioBase64?: string;
  imageUrl?: string;
  tag?: string;
  actionPayload?: MessageActionPayload;
}

export interface MemoryItem {
  id: string;
  category: 'personal' | 'business' | 'health' | 'reminder' | 'confidential';
  content: string;
  timestamp: string;
  importance: 'high' | 'medium' | 'low';
}

export interface WorldPulseItem {
  region: string;
  title: string;
  summary: string;
  shawnNote: string;
  id: string;
}

export type WakeWordPreset =
  | 'hey_shawn'
  | 'wake_up_shawn'
  | 'hello_shawn'
  | 'hi_shawn'
  | 'shawn'
  | 'custom';

export interface WakeWordConfig {
  enabled: boolean;
  selectedPreset: WakeWordPreset;
  customKeyword: string;
  sensitivity: 'low' | 'medium' | 'high';
  autoRespond: boolean;
  wakeGreetingPrompt: string;
  soundFeedback: boolean;
}

export interface AudioSettings {
  voice: string;
  micGain: number;
  outputVolume: number;
  pushToTalk: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  wakeWord: WakeWordConfig;
}

export interface StoredConversation {
  id: string;
  userId?: string;
  title: string;
  summary?: string;
  messageCount: number;
  messages: ChatMessage[];
  rootMessageId?: string | null;
  activeLeafId?: string | null;
  createdAt: string;
  updatedAt: string;
  isLiveSession?: boolean;
}

export interface ScenarioPrompt {
  id: string;
  title: string;
  badge: string;
  description: string;
  prompt: string;
  category: 'strategy' | 'negotiation' | 'wellness' | 'culture' | 'humor';
}
