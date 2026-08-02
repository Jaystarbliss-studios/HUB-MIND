const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');

// Append new types
const newTypes = `
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
`;

content += newTypes;

// Add projectId to Task, Client, Meeting, DocumentInfo
content = content.replace(/export interface Task \{/, 'export interface Task {\n  projectId?: string;');
content = content.replace(/export interface Client \{/, 'export interface Client {\n  projectId?: string;');
content = content.replace(/export interface Meeting \{/, 'export interface Meeting {\n  projectId?: string;\n  decisions?: string[];\n  openQuestions?: string[];');
content = content.replace(/export interface DocumentInfo \{/, 'export interface DocumentInfo {\n  projectId?: string;');

fs.writeFileSync('src/types.ts', content);
