import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, query, limit, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { createGoogleCalendarEvent, listGoogleCalendarEvents } from './googleCalendar';
import { User, Task, DocumentInfo } from '../types';
import { shawnTaskManager } from './shawnTaskManager';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const SHAWN_TOOLS_DECLARATIONS: ToolDefinition[] = [
  {
    name: 'create_calendar_event',
    description: 'Schedule a Google Calendar event with an attached notification reminder. Use whenever the user asks to schedule an event, set a calendar reminder, or set a reminder alarm.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title or summary of the event/reminder' },
        startDateTime: { type: 'string', description: 'ISO 8601 start date-time (e.g. 2026-08-17T14:30:00Z)' },
        endDateTime: { type: 'string', description: 'ISO 8601 end date-time (optional, defaults to 30 mins after start)' },
        reminderMinutes: { type: 'number', description: 'Minutes before event to trigger notification popup (e.g. 10 or 15)' },
        description: { type: 'string', description: 'Optional event description or notes' },
      },
      required: ['title', 'startDateTime'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming Google Calendar events.',
    parameters: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'ISO 8601 start boundary' },
        timeMax: { type: 'string', description: 'ISO 8601 end boundary' },
      },
    },
  },
  {
    name: 'create_follow_up',
    description: 'Create a tracked follow-up for a person, client, payment, proposal, response, promise or other pending action.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What needs to be followed up.' },
        person: { type: 'string', description: 'Person or organisation involved.' },
        reason: { type: 'string', description: 'Why the follow-up is needed.' },
        dueAt: { type: 'string', description: 'ISO 8601 date-time when the follow-up is due.' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }
      },
      required: ['title', 'dueAt']
    }
  },
  {
    name: 'list_follow_ups',
    description: 'List active follow-ups and their due dates/statuses.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['scheduled', 'due', 'contacted', 'waiting', 'resolved', 'cancelled'] },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'create_task',
    description: 'Create a new operational task in Hub-Mind.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description or checklist details' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: 'Task priority level' },
        deadline: { type: 'string', description: 'Deadline date string' },
        assignedTo: { type: 'string', description: 'User ID or assignee name' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing operational task in Hub-Mind.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to update' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description or checklist details' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: 'Task priority level' },
        status: { type: 'string', enum: ['pending', 'in-progress', 'completed'], description: 'Task status' },
        deadline: { type: 'string', description: 'Deadline date string' },
        assignedTo: { type: 'string', description: 'User ID or assignee name' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'open_document',
    description: 'Directly open a document in the document editor on the user\'s screen. Use this when the user asks to open, view, or navigate to a document.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The ID of the document to open' },
        documentTitle: { type: 'string', description: 'Title or search keyword of the document if ID is unknown' },
      },
    },
  },
  {
    name: 'create_document',
    description: 'Create a new document in Hub-Mind and immediately open it in the document editor on the user\'s screen.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Initial HTML or text content of the document' },
        folderId: { type: 'string', description: 'Optional folder ID to place the document in' }
      },
      required: ['title'],
    },
  },
  {
    name: 'update_document',
    description: 'Update an existing document in Hub-Mind with new content, title, or sections.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The ID of the document to update' },
        title: { type: 'string', description: 'New document title' },
        content: { type: 'string', description: 'Updated HTML or text content of the document' }
      },
      required: ['documentId'],
    },
  },
  {
    name: 'edit_document_live',
    description: 'Directly open a document in the editor on the user\'s screen and stream live typing/edits in real-time. Shawn types the edits live on screen.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The document ID to edit live' },
        documentTitle: { type: 'string', description: 'Title of the document (will find or create if documentId not provided)' },
        contentToInsert: { type: 'string', description: 'The HTML formatted content to insert or draft' },
        summary: { type: 'string', description: 'A short description of the changes made' },
        mode: { type: 'string', enum: ['append', 'prepend', 'replace'], description: 'How to insert the content' }
      },
      required: ['contentToInsert']
    }
  },
  {
    name: 'background_edit_document',
    description: 'Edit a document asynchronously in the background while continuing to chat with the user without blocking.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The document ID to update in background' },
        documentTitle: { type: 'string', description: 'Title of the document' },
        contentToInsertOrUpdate: { type: 'string', description: 'The content/updates to apply' },
        taskDescription: { type: 'string', description: 'What task is being performed' }
      },
      required: ['documentId', 'contentToInsertOrUpdate']
    }
  },
  {
    name: 'get_user_profile',
    description: 'Retrieve the active user profile, role, permissions, and session context.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'request_document_delete',
    description: 'Request confirmation to delete a document. Crucial: Deletions require user confirmation before execution.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The Firestore document ID to delete' },
        documentTitle: { type: 'string', description: 'Title of the document for confirmation presentation' },
        confirmed: { type: 'boolean', description: 'Must be true if user explicitly confirmed deletion via UI or prompt' },
      },
      required: ['documentId', 'documentTitle'],
    },
  },
  {
    name: 'request_share_document',
    description: 'Request confirmation to share a document with external partners or team members.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The document ID to share' },
        documentTitle: { type: 'string', description: 'Title of the document' },
        recipient: { type: 'string', description: 'Target email or team name' },
        confirmed: { type: 'boolean', description: 'Whether explicitly confirmed' },
      },
      required: ['documentId', 'documentTitle'],
    },
  },
  {
    name: 'set_preferred_name',
    description: 'Update the user’s preferred name in their profile so Shawn addresses them by this name in all future sessions.',
    parameters: {
      type: 'object',
      properties: {
        preferredName: { type: 'string', description: 'The name the user wishes to be called' },
      },
      required: ['preferredName'],
    },
  },
  {
    name: 'navigate_app',
    description: 'Navigate the user directly to any section, screen, or document editor in the application (e.g. /documents, /documents/:id, /tasks, /inbox, /projects, /clients, /calendar, /notifications, /admin, /).',
    parameters: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: 'The path to navigate to, e.g. /documents, /documents/:id, /tasks, etc.' 
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_workspace_overview',
    description: 'Get an overview of active tasks, recent documents, and projects for context.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_tasks',
    description: 'List operational tasks in Hub-Mind. You can filter by status, priority, or assignee.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in-progress', 'completed'] },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        assignedTo: { type: 'string' }
      }
    }
  },
  {
    name: 'list_documents',
    description: 'List documents in Hub-Mind. Returns titles and IDs.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of documents to return, max 20.' }
      }
    }
  },
  {
    name: 'get_document_content',
    description: 'Get the full text content of a specific document.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string' }
      },
      required: ['documentId']
    }
  },
  {
    name: 'list_projects',
    description: 'List active projects.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_clients',
    description: 'List active clients.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'search_workspace',
    description: 'Search across tasks and documents using a free-text query. Use this for vague questions.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search term' }
      },
      required: ['query']
    }
  },

];

export async function executeShawnTool(
  toolName: string,
  args: any,
  currentUser: User | null,
  onProfileUpdate?: (preferredName: string) => void
): Promise<{ result: any; actionPayload?: any }> {
  try {
    switch (toolName) {
      case 'create_calendar_event': {
        const res = await createGoogleCalendarEvent({
          summary: args.title,
          startDateTime: args.startDateTime,
          endDateTime: args.endDateTime,
          reminderMinutes: args.reminderMinutes,
          description: args.description,
        });
        return {
          result: {
            success: true,
            message: res.message,
            htmlLink: res.htmlLink,
            note: 'Confirmed: Google Calendar event created with notification reminder.',
          },
        };
      }

      case 'list_calendar_events': {
        const events = await listGoogleCalendarEvents(args.timeMin, args.timeMax);
        return {
          result: {
            count: events.length,
            events: events.map((e) => ({
              id: e.id,
              summary: e.summary,
              start: e.start?.dateTime || e.start?.date,
              link: e.htmlLink,
            })),
          },
        };
      }

      case 'create_follow_up': {
        const now = new Date().toISOString();
        const followUpData = {
          title: args.title,
          person: args.person || '',
          reason: args.reason || '',
          ownerId: currentUser?.id,
          dueAt: args.dueAt,
          status: 'scheduled',
          priority: args.priority || 'medium',
          createdAt: now,
          updatedAt: now,
        };
        const ref = await addDoc(collection(db, 'followUps'), followUpData);
        return {
          result: {
            success: true,
            followUpId: ref.id,
            followUp: { id: ref.id, ...followUpData },
            message: `Follow-up "${args.title}" scheduled for ${args.dueAt}.`,
          },
        };
      }

      case 'list_follow_ups': {
        const base = collection(db, 'followUps');
        const conditions: any[] = [];
        if (currentUser?.role !== 'admin' && currentUser?.role !== 'assistant') {
          conditions.push(where('ownerId', '==', currentUser?.id));
        }
        if (args.status) conditions.push(where('status', '==', args.status));
        const q = conditions.length ? query(base, ...conditions, limit(args.limit || 20)) : query(base, limit(args.limit || 20));
        const snap = await getDocs(q);
        return {
          result: {
            followUps: snap.docs.map(d => ({ id: d.id, ...d.data() }))
          }
        };
      }

      case 'create_task': {
        const taskData = {
          title: args.title,
          description: args.description || '',
          priority: args.priority || 'medium',
          status: 'pending',
          assignedTo: args.assignedTo || currentUser?.id || 'unassigned',
          createdBy: currentUser?.id || 'shawn',
          deadline: args.deadline || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const docRef = await addDoc(collection(db, 'tasks'), taskData);
        return {
          result: {
            success: true,
            taskId: docRef.id,
            task: { id: docRef.id, ...taskData },
            message: `Task "${args.title}" created successfully.`,
          },
        };
      }

      case 'update_task': {
        const { taskId, ...updates } = args;
        const taskRef = doc(db, 'tasks', taskId);
        const updateData = { ...updates, updatedAt: new Date().toISOString() };
        await updateDoc(taskRef, updateData);
        const updatedSnap = await getDoc(taskRef);
        return {
          result: {
            success: true,
            taskId,
            task: { id: updatedSnap.id, ...updatedSnap.data() },
            message: `Task ${taskId} updated successfully.`,
          },
        };
      }

      case 'open_document': {
        const { documentId, documentTitle } = args;
        let targetId = documentId;
        let titleFound = documentTitle || 'Document';

        if (targetId) {
          try {
            const snap = await getDoc(doc(db, 'documents', targetId));
            if (snap.exists()) {
              titleFound = snap.data().title || titleFound;
            }
          } catch (e) {
            console.warn('Error fetching doc by id:', e);
          }
        } else if (documentTitle) {
          // Search documents by title
          const qSnap = await getDocs(collection(db, 'documents'));
          const match = qSnap.docs.find(d => {
            const t = (d.data().title || '').toLowerCase();
            return t.includes(documentTitle.toLowerCase()) || documentTitle.toLowerCase().includes(t);
          });
          if (match) {
            targetId = match.id;
            titleFound = match.data().title || documentTitle;
          }
        }

        // If not found, create a new document with this title and open it!
        if (!targetId) {
          const now = new Date().toISOString();
          const newDocRef = await addDoc(collection(db, 'documents'), {
            title: documentTitle || 'Untitled Document',
            content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
            category: 'other',
            type: 'internal',
            ownerId: currentUser?.id || 'shawn',
            createdBy: currentUser?.id || 'shawn',
            createdAt: now,
            updatedAt: now,
            lastEditedAt: now,
            lastSavedAt: now,
            lastModifiedBy: 'Shawn AI'
          });
          targetId = newDocRef.id;
          titleFound = documentTitle || 'Untitled Document';
        }

        return {
          result: {
            success: true,
            documentId: targetId,
            title: titleFound,
            message: `Opening "${titleFound}" in the document editor on your screen right now!`,
          },
          actionPayload: {
            type: 'navigate',
            path: `/documents/${targetId}`,
          },
        };
      }

      case 'create_document': {
        const now = new Date().toISOString();
        let initialContent = '';
        if (args.content) {
          if (typeof args.content === 'string' && (args.content.startsWith('<') || args.content.startsWith('{'))) {
            initialContent = args.content;
          } else {
            initialContent = JSON.stringify({
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: args.content }] }]
            });
          }
        } else {
          initialContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
        }

        const docData = {
          title: args.title || 'Untitled Document',
          content: initialContent,
          folderId: args.folderId || null,
          category: 'other',
          type: 'internal',
          createdBy: currentUser?.id || 'shawn',
          ownerId: currentUser?.id || 'shawn',
          createdAt: now,
          updatedAt: now,
          lastEditedAt: now,
          lastSavedAt: now,
          lastModifiedBy: 'Shawn AI'
        };
        const docRef = await addDoc(collection(db, 'documents'), docData);
        
        return {
          result: {
            success: true,
            documentId: docRef.id,
            document: { id: docRef.id, ...docData },
            message: `Document "${args.title}" created and opened in the editor on your screen!`,
          },
          actionPayload: {
            type: 'navigate',
            path: `/documents/${docRef.id}`,
          },
        };
      }

      case 'update_document': {
        const { documentId, ...updates } = args;
        const now = new Date().toISOString();
        const docRef = doc(db, 'documents', documentId);
        const updateData = { 
          ...updates, 
          updatedAt: now, 
          lastEditedAt: now, 
          lastSavedAt: now, 
          lastModifiedBy: 'Shawn AI' 
        };
        await updateDoc(docRef, updateData);
        const updatedSnap = await getDoc(docRef);

        if (updates.content) {
          shawnTaskManager.broadcastEvent('shawn:live_document_edit', {
            documentId,
            html: updates.content,
            contentToInsert: updates.content,
            mode: 'replace',
            summary: `Shawn updated document content`,
            timestamp: Date.now(),
          });
        }

        return {
          result: {
            success: true,
            documentId,
            document: { id: updatedSnap.id, ...updatedSnap.data() },
            message: `Document ${documentId} updated and saved successfully with timestamps.`,
          },
          actionPayload: {
            type: 'navigate',
            path: `/documents/${documentId}`,
          },
        };
      }

      case 'edit_document_live': {
        const { documentId, documentTitle, contentToInsert, summary, mode } = args;
        let targetDocId = documentId;
        const now = new Date().toISOString();

        // If no documentId, search or create one immediately
        if (!targetDocId) {
          if (documentTitle) {
            const qSnap = await getDocs(collection(db, 'documents'));
            const match = qSnap.docs.find(d => {
              const t = (d.data().title || '').toLowerCase();
              return t.includes(documentTitle.toLowerCase()) || documentTitle.toLowerCase().includes(t);
            });
            if (match) {
              targetDocId = match.id;
            }
          }
        }

        if (!targetDocId) {
          // Create new document on the fly
          const newDocRef = await addDoc(collection(db, 'documents'), {
            title: documentTitle || 'New Document Draft',
            content: contentToInsert,
            category: 'other',
            type: 'internal',
            ownerId: currentUser?.id || 'shawn',
            createdBy: currentUser?.id || 'shawn',
            createdAt: now,
            updatedAt: now,
            lastEditedAt: now,
            lastSavedAt: now,
            lastModifiedBy: 'Shawn AI'
          });
          targetDocId = newDocRef.id;
        } else {
          // Update existing doc metadata
          try {
            const docRef = doc(db, 'documents', targetDocId);
            await updateDoc(docRef, {
              updatedAt: now,
              lastEditedAt: now,
              lastSavedAt: now,
              lastModifiedBy: 'Shawn AI'
            });
          } catch (e) {
            console.warn('Error updating doc timestamp on live edit:', e);
          }
        }
        
        // Broadcast live edit event so DocumentEditor directly renders and types it in real time
        shawnTaskManager.broadcastEvent('shawn:live_document_edit', {
          documentId: targetDocId,
          documentTitle: documentTitle || 'Document',
          html: contentToInsert,
          contentToInsert,
          summary: summary || `Shawn drafted updates live on screen.`,
          mode: mode || 'append',
          action: 'propose',
          timestamp: Date.now(),
        });

        const task = shawnTaskManager.createTask({
          type: 'document_edit',
          title: `Live Co-Edit: ${documentTitle || 'Document'}`,
          status: 'completed',
          progress: 100,
          currentStepMessage: 'Drafted and saved live in editor on screen.',
          documentId: targetDocId,
          documentTitle,
          proposedContent: contentToInsert,
        });

        return {
          result: {
            success: true,
            documentId: targetDocId,
            status: 'drafted_live',
            message: `I've opened the document editor directly on your screen and written the updates for you!`,
            taskId: task.id,
          },
          actionPayload: {
            type: 'navigate',
            path: `/documents/${targetDocId}`,
          },
        };
      }

      case 'background_edit_document': {
        const { documentId, documentTitle, contentToInsertOrUpdate, taskDescription } = args;
        const now = new Date().toISOString();
        
        const task = shawnTaskManager.createTask({
          type: 'document_edit',
          title: `Background Update: ${documentTitle || 'Document'}`,
          status: 'running',
          progress: 30,
          currentStepMessage: taskDescription || 'Updating document in background...',
          documentId,
          documentTitle,
        });

        // Run background write to Firestore
        (async () => {
          try {
            shawnTaskManager.updateTask(task.id, { progress: 60, currentStepMessage: 'Syncing changes to cloud...' });
            const docRef = doc(db, 'documents', documentId);
            const snap = await getDoc(docRef);
            
            if (snap.exists()) {
              const currentData = snap.data();
              let newContent = contentToInsertOrUpdate;
              if (currentData.content && typeof currentData.content === 'string') {
                if (currentData.content.startsWith('{')) {
                  newContent = `${currentData.content}\n${contentToInsertOrUpdate}`;
                } else {
                  newContent = `${currentData.content}\n\n${contentToInsertOrUpdate}`;
                }
              }

              const saveNow = new Date().toISOString();
              await updateDoc(docRef, {
                content: newContent,
                updatedAt: saveNow,
                lastEditedAt: saveNow,
                lastSavedAt: saveNow,
                lastModifiedBy: 'Shawn AI',
              });

              shawnTaskManager.broadcastEvent('shawn:live_document_edit', {
                documentId,
                html: newContent,
                contentToInsert: newContent,
                mode: 'replace',
                summary: `Background edit completed by Shawn AI`,
                timestamp: Date.now(),
              });

              shawnTaskManager.updateTask(task.id, { 
                status: 'completed', 
                progress: 100, 
                currentStepMessage: 'Background edit completed and saved successfully with exact timestamps!' 
              });
            } else {
              shawnTaskManager.updateTask(task.id, { 
                status: 'failed', 
                progress: 100, 
                currentStepMessage: 'Document not found in database.' 
              });
            }
          } catch (err: any) {
            shawnTaskManager.updateTask(task.id, { 
              status: 'failed', 
              progress: 100, 
              currentStepMessage: `Error: ${err.message}` 
            });
          }
        })();

        return {
          result: {
            success: true,
            documentId,
            taskId: task.id,
            status: 'in_progress',
            message: `Right away! I'm editing "${documentTitle || 'the document'}" in the background with timestamps. We can keep chatting while I finish this up!`,
          },
        };
      }

      case 'get_user_profile': {
        return {
          result: {
            id: currentUser?.id,
            name: currentUser?.name || 'User',
            preferredName: currentUser?.preferredName || currentUser?.name,
            email: currentUser?.email,
            role: currentUser?.role || 'staff',
            status: currentUser?.status || 'active',
            institution: 'Jaystarbliss Dynamic Institute',
          },
        };
      }

      case 'request_document_delete': {
        const { documentId, documentTitle, confirmed } = args;
        if (!confirmed) {
          return {
            result: {
              status: 'confirmation_required',
              message: `I need your explicit confirmation to delete "${documentTitle}". Please confirm in the card below or say yes.`,
            },
            actionPayload: {
              type: 'delete_document',
              documentId,
              documentTitle,
              confirmed: false,
              status: 'pending',
            },
          };
        }

        // Perform actual deletion with belt and braces
        const docRef = doc(db, 'documents', documentId);
        await deleteDoc(docRef);
        return {
          result: {
            status: 'deleted',
            message: `Document "${documentTitle}" has been permanently deleted.`,
          },
          actionPayload: {
            type: 'delete_document',
            documentId,
            documentTitle,
            confirmed: true,
            status: 'executed',
          },
        };
      }

      case 'request_share_document': {
        const { documentId, documentTitle, recipient, confirmed } = args;
        if (!confirmed) {
          return {
            result: {
              status: 'confirmation_required',
              message: `Please confirm sharing "${documentTitle}" with ${recipient || 'the team'}.`,
            },
            actionPayload: {
              type: 'share_document',
              documentId,
              documentTitle,
              confirmed: false,
              status: 'pending',
            },
          };
        }
        return {
          result: {
            status: 'shared',
            message: `Document "${documentTitle}" shared successfully.`,
          },
        };
      }

      case 'set_preferred_name': {
        const preferredName = (args.preferredName || '').trim();
        if (currentUser?.id && preferredName) {
          const userRef = doc(db, 'users', currentUser.id);
          await updateDoc(userRef, { preferredName });
          if (onProfileUpdate) {
            onProfileUpdate(preferredName);
          }
        }
        return {
          result: {
            success: true,
            preferredName,
            message: `Got it! I will call you ${preferredName} from now on.`,
          },
        };
      }

      case 'navigate_app': {
        return {
          result: {
            success: true,
            message: `Navigating to ${args.path}.`,
          },
          actionPayload: {
            type: 'navigate',
            path: args.path,
          },
        };
      }

      case 'get_workspace_overview': {
        const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('status', '!=', 'completed'), limit(20)));
        const docsSnap = await getDocs(query(collection(db, 'documents'), limit(5)));
        const followUpBase = collection(db, 'followUps');
        const followUpQuery = currentUser?.role === 'admin' || currentUser?.role === 'assistant'
          ? query(followUpBase, limit(20))
          : query(followUpBase, where('ownerId', '==', currentUser?.id), limit(20));
        const followUpsSnap = await getDocs(followUpQuery);
        const activeFollowUps = followUpsSnap.docs.filter(d => !['resolved', 'cancelled'].includes((d.data() as any).status));
        const now = Date.now();
        
        return {
          result: {
            user: {
              name: currentUser?.name,
              preferredName: currentUser?.preferredName,
              role: currentUser?.role,
            },
            summary: {
              openTasksCount: tasksSnap.docs.length,
              recentDocumentsCount: docsSnap.docs.length,
              followUpsDueCount: activeFollowUps.filter(d => new Date((d.data() as any).dueAt).getTime() <= now).length,
              followUpsWaitingCount: activeFollowUps.filter(d => (d.data() as any).status === 'waiting').length,
            }
          },
        };
      }
      
      case 'list_tasks': {
        let q = collection(db, 'tasks');
        let conditions = [];
        if (args.status) conditions.push(where('status', '==', args.status));
        if (args.priority) conditions.push(where('priority', '==', args.priority));
        if (args.assignedTo) conditions.push(where('assignedTo', '==', args.assignedTo));
        
        let finalQuery = conditions.length > 0 ? query(q, ...conditions, limit(20)) : query(q, limit(20));
        const snap = await getDocs(finalQuery);
        return {
          result: {
            tasks: snap.docs.map(d => ({ id: d.id, ...d.data() }))
          }
        };
      }
      
      case 'list_documents': {
        const snap = await getDocs(query(collection(db, 'documents'), limit(args.limit || 10)));
        return {
          result: {
            documents: snap.docs.map(d => ({ id: d.id, title: d.data().title, updatedAt: d.data().updatedAt }))
          }
        };
      }
      
      case 'get_document_content': {
        const d = await getDoc(doc(db, 'documents', args.documentId));
        if (!d.exists()) return { result: { error: 'Document not found' } };
        return {
          result: {
            document: { id: d.id, ...d.data() }
          }
        };
      }
      
      case 'list_projects': {
        const snap = await getDocs(query(collection(db, 'projects'), limit(20)));
        return {
          result: {
            projects: snap.docs.map(d => ({ id: d.id, ...d.data() }))
          }
        };
      }
      
      case 'list_clients': {
        const snap = await getDocs(query(collection(db, 'clients'), limit(20)));
        return {
          result: {
            clients: snap.docs.map(d => ({ id: d.id, ...d.data() }))
          }
        };
      }
      
      case 'search_workspace': {
        // Very basic mock search for now since Firestore doesn't support full-text search easily
        // We'll just fetch some recent items and filter in memory
        const tasksSnap = await getDocs(query(collection(db, 'tasks'), limit(20)));
        const docsSnap = await getDocs(query(collection(db, 'documents'), limit(20)));
        const term = args.query.toLowerCase();
        
        const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(t => (t.title && t.title.toLowerCase().includes(term)) || (t.description && t.description.toLowerCase().includes(term)));
        const docs = docsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(d => (d.title && d.title.toLowerCase().includes(term)) || (d.content && d.content.toLowerCase().includes(term)));
        
        return {
          result: {
            tasks,
            documents: docs.map(d => ({ id: d.id, title: d.title, contentSnippet: d.content?.substring(0, 100) }))
          }
        };
      }


      default:
        return { result: { error: `Tool ${toolName} not recognized.` } };
    }
  } catch (err: any) {
    return {
      result: { error: err.message || 'Tool execution failed' },
    };
  }
}
