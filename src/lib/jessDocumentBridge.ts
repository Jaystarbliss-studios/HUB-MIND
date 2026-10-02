export const JESS_DOCUMENT_EDIT_KEY = 'hubmind.jess.pendingDocumentEdit.v1';

export type PendingJessDocumentEdit = { documentId: string; content: string; mode?: 'replace' | 'append'; createdAt: number };

export function queueJessDocumentEdit(edit: Omit<PendingJessDocumentEdit, 'createdAt'>) {
  if (typeof window === 'undefined') return;
  const payload: PendingJessDocumentEdit = { ...edit, createdAt: Date.now() };
  try { sessionStorage.setItem(JESS_DOCUMENT_EDIT_KEY, JSON.stringify(payload)); } catch { /* storage is optional */ }
  window.dispatchEvent(new CustomEvent('jess:document_edit', { detail: payload }));
}
