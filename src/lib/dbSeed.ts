import { collection, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task, DocumentInfo, Project, Client, Knowledge } from '../types';

export async function checkAndSeedWorkspaceData(userId: string, userEmail: string) {
  try {
    // 1. Check if tasks collection has items
    const tasksSnap = await getDocs(collection(db, 'tasks'));
    if (tasksSnap.empty) {
      console.log('Restoring workspace tasks...');
      const defaultTasks: Omit<Task, 'id'>[] = [
        {
          title: 'Review Q3 Operational Budget & Projections',
          description: 'Analyze departmental expenditures, staffing overhead, and projected software licensing costs for the upcoming quarter.',
          priority: 'urgent',
          status: 'in_progress',
          assignedTo: userId,
          createdBy: userId,
          deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
          checklist: [
            { item: 'Export ledger from accounting module', done: true },
            { item: 'Review contractor invoice totals', done: true },
            { item: 'Submit summary to executive board', done: false }
          ],
          comments: [
            { userId, text: 'Initial variance report prepared.', timestamp: new Date().toISOString() }
          ],
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          title: 'Client Onboarding - St. Jude Regional Academy',
          description: 'Coordinate system integration kickoff, teacher credentials provisioning, and curriculum schedule alignment.',
          priority: 'high',
          status: 'pending',
          assignedTo: userId,
          createdBy: userId,
          deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
          checklist: [
            { item: 'Verify administrative contact info', done: true },
            { item: 'Configure school roster permissions', done: false },
            { item: 'Host live teacher orientation call', done: false }
          ],
          comments: [],
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          title: 'Security Compliance Audit & Access Review',
          description: 'Periodic review of workspace user roles, API secret rotation, and Firestore security rules verification.',
          priority: 'medium',
          status: 'completed',
          assignedTo: userId,
          createdBy: userId,
          deadline: new Date(Date.now() - 86400000).toISOString(),
          checklist: [
            { item: 'Audit role assignments', done: true },
            { item: 'Verify security rules', done: true }
          ],
          comments: [
            { userId, text: 'All security checks completed successfully.', timestamp: new Date().toISOString() }
          ],
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const t of defaultTasks) {
        await addDoc(collection(db, 'tasks'), t);
      }
    }

    // 2. Check documents
    const docsSnap = await getDocs(collection(db, 'documents'));
    if (docsSnap.empty) {
      console.log('Restoring workspace documents...');
      const defaultDocs: Omit<DocumentInfo, 'id'>[] = [
        {
          title: 'Standard Operating Procedures - Client SLA & Escalations',
          category: 'sop',
          type: 'internal',
          fileRef: 'https://docs.google.com/document/d/1_sop_example_sla',
          version: 2,
          ownerId: userId,
          createdBy: userId,
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
        },
        {
          title: 'Service Master Agreement & Terms Template',
          category: 'contracts',
          type: 'external',
          fileRef: 'https://docs.google.com/document/d/1_master_agreement_template',
          version: 1,
          ownerId: userId,
          createdBy: userId,
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
        },
        {
          title: 'Operations Hub Weekly Briefing - Aug 2026',
          category: 'reports',
          type: 'internal',
          fileRef: 'https://docs.google.com/document/d/1_weekly_briefing_aug_2026',
          version: 1,
          ownerId: userId,
          createdBy: userId,
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
        }
      ];

      for (const d of defaultDocs) {
        await addDoc(collection(db, 'documents'), d);
      }
    }

    // 3. Check Projects
    const projectsSnap = await getDocs(collection(db, 'projects'));
    if (projectsSnap.empty) {
      console.log('Restoring workspace projects...');
      const defaultProjects: Omit<Project, 'id'>[] = [
        {
          name: 'Academic Portal Expansion 2026',
          description: 'Rollout of next-generation student progress dashboards and staff grading automation across 12 partner schools.',
          status: 'active',
          ownerId: userId,
          createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: 'Enterprise Client Success Onboarding',
          description: 'End-to-end framework for rapid integration, bespoke SLA workflows, and executive training.',
          status: 'active',
          ownerId: userId,
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          name: 'AI Operations & Shawn Integration',
          description: 'Deployment of bidirectional voice capabilities, biometric voiceprint isolation, and real-time task synthesis.',
          status: 'active',
          ownerId: userId,
          createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const p of defaultProjects) {
        await addDoc(collection(db, 'projects'), p);
      }
    }

    // 4. Check Clients
    const clientsSnap = await getDocs(collection(db, 'clients'));
    if (clientsSnap.empty) {
      const defaultClients: Omit<Client, 'id'>[] = [
        {
          name: 'St. Jude Regional Academy',
          type: 'school',
          phone: '+1 (555) 234-8901',
          email: 'admin@stjudeacademy.edu',
          address: '450 University Way, Suite 100',
          status: 'active',
          ownerId: userId,
          createdAt: new Date(Date.now() - 86400000 * 12).toISOString()
        },
        {
          name: 'Horizon STEM Partnerships',
          type: 'partner',
          phone: '+1 (555) 876-5432',
          email: 'partnerships@horizonstem.org',
          address: '100 Innovation Parkway',
          status: 'lead',
          ownerId: userId,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
        }
      ];

      for (const c of defaultClients) {
        await addDoc(collection(db, 'clients'), c);
      }
    }
  } catch (err) {
    console.warn('Auto seed workspace check completed with note:', err);
  }
}
