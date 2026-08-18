import { Role } from '../types';

export type AppAction =
  | 'view_users'
  | 'create_user'
  | 'edit_user'
  | 'delete_user'
  | 'change_user_role'
  | 'view_all_tasks'
  | 'create_task'
  | 'edit_task'
  | 'delete_task'
  | 'view_all_documents'
  | 'create_document'
  | 'edit_document'
  | 'delete_document'
  | 'view_all_projects'
  | 'create_project'
  | 'edit_project'
  | 'delete_project'
  | 'view_all_clients'
  | 'create_client'
  | 'edit_client'
  | 'delete_client'
  | 'view_all_meetings'
  | 'create_meeting'
  | 'edit_meeting'
  | 'delete_meeting'
  | 'access_knowledge_base'
  | 'manage_knowledge_base'
  | 'access_admin_settings'
  | 'view_activity_logs'
  | 'export_system_data'
  | 'manage_recurring_tasks';

/**
 * Role capability matrix
 */
const ROLE_PERMISSIONS: Record<Role, AppAction[]> = {
  admin: [
    'view_users',
    'create_user',
    'edit_user',
    'delete_user',
    'change_user_role',
    'view_all_tasks',
    'create_task',
    'edit_task',
    'delete_task',
    'view_all_documents',
    'create_document',
    'edit_document',
    'delete_document',
    'view_all_projects',
    'create_project',
    'edit_project',
    'delete_project',
    'view_all_clients',
    'create_client',
    'edit_client',
    'delete_client',
    'view_all_meetings',
    'create_meeting',
    'edit_meeting',
    'delete_meeting',
    'access_knowledge_base',
    'manage_knowledge_base',
    'access_admin_settings',
    'view_activity_logs',
    'export_system_data',
    'manage_recurring_tasks',
  ],
  assistant: [
    'view_users',
    'view_all_tasks',
    'create_task',
    'edit_task',
    'view_all_documents',
    'create_document',
    'edit_document',
    'view_all_projects',
    'create_project',
    'edit_project',
    'view_all_clients',
    'create_client',
    'edit_client',
    'view_all_meetings',
    'create_meeting',
    'edit_meeting',
    'access_knowledge_base',
    'manage_knowledge_base',
    'view_activity_logs',
    'manage_recurring_tasks',
  ],
  teacher: [
    'create_task',
    'edit_task',
    'create_document',
    'edit_document',
    'create_project',
    'create_meeting',
    'access_knowledge_base',
  ],
  staff: [
    'create_task',
    'edit_task',
    'create_document',
    'edit_document',
    'create_project',
    'create_meeting',
    'access_knowledge_base',
  ],
};

/**
 * Checks if a given role is authorized to perform a specific action
 */
export function canPerformAction(role: Role | string | undefined | null, action: AppAction): boolean {
  if (!role) return false;
  const normalizedRole = role.toLowerCase() as Role;
  const permissions = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS['staff'];
  return permissions.includes(action);
}

/**
 * Checks if a user has admin privileges
 */
export function isAdmin(role: Role | string | undefined | null, email?: string | null): boolean {
  if (email && email.toLowerCase() === 'johnrufai242@gmail.com') return true;
  if (!role) return false;
  return role.toLowerCase() === 'admin';
}

/**
 * Checks if a user has assistant or admin privileges
 */
export function isAssistantOrAdmin(role: Role | string | undefined | null, email?: string | null): boolean {
  if (email && email.toLowerCase() === 'johnrufai242@gmail.com') return true;
  if (!role) return false;
  const norm = role.toLowerCase();
  return norm === 'admin' || norm === 'assistant';
}

/**
 * Route protection helper
 */
export function canAccessRoute(role: Role | string | undefined | null, path: string, email?: string | null): boolean {
  if (isAdmin(role, email)) return true;
  
  if (path.startsWith('/admin') || path.startsWith('/users')) {
    return isAssistantOrAdmin(role, email);
  }
  
  return true;
}
