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
  staff: [
    'view_users',
    'create_task',
    'edit_task',
    'create_document',
    'edit_document',
    'create_project',
    'edit_project',
    'create_client',
    'edit_client',
    'create_meeting',
    'edit_meeting',
    'access_knowledge_base',
    'manage_recurring_tasks',
  ],
};

/**
 * Verifies if a given role is allowed to perform an action.
 */
export function canPerform(role: Role | undefined | null, action: AppAction): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(action) : false;
}

/**
 * Returns all actions a role can perform.
 */
export function getRoleCapabilities(role: Role): AppAction[] {
  return ROLE_PERMISSIONS[role] || [];
}
