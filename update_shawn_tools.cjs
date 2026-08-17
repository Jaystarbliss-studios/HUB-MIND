const fs = require('fs');
let code = fs.readFileSync('src/lib/shawnTools.ts', 'utf8');

const newTools = `
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
`;

code = code.replace(/name: 'get_workspace_overview'[\s\S]*?},\n  },/m, 'name: \'get_workspace_overview\',\n    description: \'Get an overview of active tasks, recent documents, and projects for context.\',\n    parameters: {\n      type: \'object\',\n      properties: {},\n    },\n  },' + newTools);


const newImplementations = `
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
        
        const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => (t.title && t.title.toLowerCase().includes(term)) || (t.description && t.description.toLowerCase().includes(term)));
        const docs = docsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => (d.title && d.title.toLowerCase().includes(term)) || (d.content && d.content.toLowerCase().includes(term)));
        
        return {
          result: {
            tasks,
            documents: docs.map(d => ({ id: d.id, title: d.title, contentSnippet: d.content?.substring(0, 100) }))
          }
        };
      }
`;

code = code.replace(/case 'get_workspace_overview': \{[\s\S]*?return \{\s*result: \{\s*user:[\s\S]*?recentDocs:.*?,\s*\},\s*\};\s*\}/m, 
  `case 'get_workspace_overview': {
        const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('status', '!=', 'completed'), limit(20)));
        const docsSnap = await getDocs(query(collection(db, 'documents'), limit(5)));
        const today = new Date().toISOString().split('T')[0];
        
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
            }
          },
        };
      }
      ` + newImplementations
);

// We also need to return the saved record for create_task, update_task, create_document, update_document
code = code.replace(/case 'create_task': \{[\s\S]*?taskId: docRef\.id,[\s\S]*?message: \`Task "\$\{args\.title\}" created successfully\.\`,[\s\S]*?\},[\s\S]*?\};\s*\}/m, 
  `case 'create_task': {
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
            message: \`Task "\$\{args.title\}" created successfully.\`,
          },
        };
      }`
);

code = code.replace(/case 'update_task': \{[\s\S]*?await updateDoc\(taskRef, \{ \.\.\.updates, updatedAt: new Date\(\)\.toISOString\(\) \}\);[\s\S]*?result: \{[\s\S]*?success: true,[\s\S]*?taskId,[\s\S]*?message: \`Task \$\{taskId\} updated successfully\.\`,[\s\S]*?\},[\s\S]*?\};\s*\}/m,
  `case 'update_task': {
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
            message: \`Task \$\{taskId\} updated successfully.\`,
          },
        };
      }`
);

code = code.replace(/case 'create_document': \{[\s\S]*?documentId: docRef\.id,[\s\S]*?message: \`Document "\$\{args\.title\}" created successfully\.\`,[\s\S]*?\},[\s\S]*?\};\s*\}/m,
  `case 'create_document': {
        const docData = {
          title: args.title,
          content: args.content || '',
          folderId: args.folderId || null,
          createdBy: currentUser?.id || 'shawn',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          type: 'document'
        };
        const docRef = await addDoc(collection(db, 'documents'), docData);
        return {
          result: {
            success: true,
            documentId: docRef.id,
            document: { id: docRef.id, ...docData },
            message: \`Document "\$\{args.title\}" created successfully.\`,
          },
        };
      }`
);

code = code.replace(/case 'update_document': \{[\s\S]*?await updateDoc\(docRef, \{ \.\.\.updates, updatedAt: new Date\(\)\.toISOString\(\) \}\);[\s\S]*?result: \{[\s\S]*?success: true,[\s\S]*?documentId,[\s\S]*?message: \`Document \$\{documentId\} updated successfully\.\`,[\s\S]*?\},[\s\S]*?\};\s*\}/m,
  `case 'update_document': {
        const { documentId, ...updates } = args;
        const docRef = doc(db, 'documents', documentId);
        const updateData = { ...updates, updatedAt: new Date().toISOString() };
        await updateDoc(docRef, updateData);
        const updatedSnap = await getDoc(docRef);
        return {
          result: {
            success: true,
            documentId,
            document: { id: updatedSnap.id, ...updatedSnap.data() },
            message: \`Document \$\{documentId\} updated successfully.\`,
          },
        };
      }`
);

fs.writeFileSync('src/lib/shawnTools.ts', code);
