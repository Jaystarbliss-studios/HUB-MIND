export type PaperSizeOption = 'a4' | 'letter' | 'legal';
export type OrientationOption = 'portrait' | 'landscape';
export type MarginOption = 'normal' | 'narrow' | 'moderate' | 'wide' | 'custom';

export type Role = 'admin' | 'staff';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string; // Firebase Auth UID
  email: string;
  username: string; // Unique lowercase handle without @ (e.g. "john")
  displayName: string;
  name?: string; // Optional alias for displayName
  preferredName?: string;
  role: Role;
  status: UserStatus;
  phone?: string;
  photoUrl?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  defaultVisibility?: ResourceVisibility;
}

export type InvitationStatus = 'invited' | 'accepted' | 'revoked' | 'expired';

export interface UserInvitation {
  id: string;
  email: string;
  username: string;
  displayName: string;
  phone?: string;
  role: 'staff';
  status: InvitationStatus;
  invitedBy: string; // Admin UID or email
  createdAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  acceptedByUid?: string;
  token?: string;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface UserConnection {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterDisplayName: string;
  requesterPhotoUrl?: string;
  recipientId: string;
  recipientUsername: string;
  recipientDisplayName: string;
  recipientPhotoUrl?: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export type ResourceType = 'document' | 'task' | 'meeting' | 'project' | 'client' | 'followup';
export type ResourceVisibility = 'private' | 'workspace' | 'shared';
export type SharePermission = 'read' | 'write';
export type ShareStatus = 'active' | 'revoked';

export interface ResourceShare {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceTitle?: string;
  ownerId: string;
  recipientUserId: string;
  recipientUsername: string;
  permission: SharePermission;
  status: ShareStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export type ClientType = 'school' | 'parent' | 'partner' | 'business';
export type ClientStatus = 'active' | 'lead' | 'inactive';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  phone?: string;
  email?: string;
  address?: string;
  status: ClientStatus;
  projectId?: string;
  ownerId: string;
  createdBy?: string;
  visibility?: ResourceVisibility;
  sharedWith?: string[];
  permissions?: Record<string, SharePermission>;
  photoUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus =
  | 'draft'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'completed'
  | 'rejected'
  | 'archived';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string; // userId
  assignedToUsername?: string; // @username
  createdBy: string; // userId
  ownerId: string; // userId
  projectId?: string;
  clientId?: string;
  deadline?: string; // ISO string
  rejectionReason?: string;
  visibility?: ResourceVisibility;
  sharedWith?: string[];
  permissions?: Record<string, SharePermission>;
  checklist: { item: string; done: boolean }[];
  comments: { userId: string; username?: string; text: string; timestamp: string }[];
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export type MeetingStatus = 'scheduled' | 'in_session' | 'completed' | 'canceled' | 'rescheduled';

export interface Meeting {
  id: string;
  title?: string;
  status?: MeetingStatus;
  projectId?: string;
  clientId?: string;
  taskId?: string;
  documentId?: string;
  ownerId: string;
  visibility?: ResourceVisibility;
  sharedWith?: string[];
  permissions?: Record<string, SharePermission>;
  attendees: string[]; // userIds or emails/names
  date: string; // ISO string or timestamp
  endDate?: string;
  location?: string;
  meetingLink?: string;
  notesRaw: string;
  aiSummary?: string;
  decisions?: string[];
  openQuestions?: string[];
  actionPoints: { text: string; assignedTo: string; deadline: string }[];
  generatedDocs: { type: string; fileRef: string; createdAt: string }[];
  externalProvider?: 'google';
  externalEventId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  content: string;
  savedBy: string; // userId
  savedByUsername?: string;
  savedAt: string;
  changeSummary?: string;
}

export interface DocumentInfo {
  id: string;
  title: string;
  category: string;
  templateId?: string;
  type?: 'internal' | 'external';
  projectId?: string;
  clientId?: string;
  ownerId: string; // userId
  createdBy?: string;
  updatedBy?: string;
  visibility?: ResourceVisibility;
  sharedWith?: string[];
  permissions?: Record<string, SharePermission>;
  fileRef?: string;
  version?: number;
  createdAt: string;
  updatedAt?: string;
  lastEditedAt?: string;
  lastSavedAt?: string;
  lastModifiedBy?: string;
  content?: string;
  pageSize?: PaperSizeOption;
  orientation?: OrientationOption;
  marginOption?: MarginOption;
}

export interface Notification {
  id: string;
  userId: string;
  type: string; // task_assigned | task_accepted | task_rejected | document_shared | connection_request | connection_accepted | meeting_reminder | general
  title?: string;
  message: string;
  resourceType?: ResourceType;
  resourceId?: string;
  read: boolean;
  actionUrl?: string;
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

export type FollowUpStatus = 'scheduled' | 'due' | 'contacted' | 'waiting' | 'resolved' | 'cancelled';

export interface FollowUp {
  id: string;
  title: string;
  person?: string;
  clientId?: string;
  relatedTaskId?: string;
  relatedProjectId?: string;
  reason?: string;
  ownerId: string;
  visibility?: ResourceVisibility;
  sharedWith?: string[];
  permissions?: Record<string, SharePermission>;
  dueAt: string;
  status: FollowUpStatus;
  priority: TaskPriority;
  lastContactAt?: string;
  nextContactAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringMeetingTemplate {
  id: string;
  title: string;
  type: 'class' | 'meeting' | 'appointment' | 'school_event' | 'other';
  description?: string;
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
  frequency: 'daily' | 'weekly' | 'monthly';
  startTime: string; // "16:00"
  endTime?: string; // "17:00"
  startDate: string; // "2026-09-01"
  endDate?: string;
  dayOfMonth?: number;
  location?: string;
  meetingLink?: string;
  clientId?: string;
  projectId?: string;
  attendees?: string[];
  ownerId: string;
  visibility?: ResourceVisibility;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTaskTemplate {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assignedTo: string;
  assignedToUsername?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  lastGeneratedDate?: string;
  active: boolean;
  createdAt: string;
  ownerId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  ownerId: string;
  createdBy?: string;
  visibility?: ResourceVisibility;
  sharedWith?: string[];
  permissions?: Record<string, SharePermission>;
  collaboratorIds?: string[];
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
  ownerId?: string;
  visibility?: ResourceVisibility;
  sharedWith?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  entityId: string;
  entityType: 'task' | 'meeting' | 'client' | 'document' | 'project' | 'knowledge' | 'user' | 'share';
  action: string;
  userId: string;
  username?: string;
  userDisplayName?: string;
  details: string;
  createdAt: string;
}

export type LiveConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ShawnState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'muted';

export interface MessageActionPayload {
  type: 'delete_document' | 'delete_task' | 'delete_project' | 'share_resource' | 'share_document' | 'set_preferred_name';
  resourceType?: ResourceType;
  resourceId?: string;
  resourceTitle?: string;
  documentId?: string;
  documentTitle?: string;
  confirmed?: boolean;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'executed';
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        snippet?: string;
        reviewUri?: string;
      }[];
    };
  };
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
  groundingChunks?: GroundingChunk[];
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

export interface AudioSettings {
  voice: string;
  micGain: number;
  outputVolume: number;
  pushToTalk: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
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
