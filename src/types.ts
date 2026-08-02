export type Role = 'admin' | 'assistant' | 'teacher' | 'staff';
export type UserStatus = 'active' | 'training' | 'inactive';
export type ClientType = 'school' | 'parent' | 'partner';
export type ClientStatus = 'active' | 'lead' | 'inactive';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'waiting_review' | 'completed' | 'archived';

export interface User {
  id: string;
  name: string;
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

export interface Meeting {
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
  id: string;
  title: string;
  category: string; // contract | report | invoice | exam | certificate | other
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
    type: 'task' | 'meeting' | 'client' | 'reminder' | 'archived';
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
