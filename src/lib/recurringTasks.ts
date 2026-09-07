import { collection, query, where, getDocs, setDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { RecurringTaskTemplate } from '../types';
import { format, startOfDay } from 'date-fns';

/**
 * Materialize today's recurring tasks.
 *
 * The occurrence document ID is deterministic (template + date), so multiple
 * tabs/devices opening Hub-Mind at the same time cannot create duplicate tasks
 * for the same recurring template/day.
 */
export async function processRecurringTasks() {
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const now = new Date();

  try {
    const q = query(collection(db, 'recurringTaskTemplates'), where('active', '==', true));
    const snapshot = await getDocs(q);

    for (const docSnapshot of snapshot.docs) {
      const template = { id: docSnapshot.id, ...docSnapshot.data() } as RecurringTaskTemplate;

      if (template.lastGeneratedDate === todayStr) continue;

      let shouldGenerate = false;
      if (template.frequency === 'daily') {
        shouldGenerate = true;
      } else if (template.frequency === 'weekly') {
        shouldGenerate = now.getDay() === template.dayOfWeek;
      } else if (template.frequency === 'monthly') {
        shouldGenerate = now.getDate() === template.dayOfMonth;
      }

      if (!shouldGenerate) continue;

      const occurrenceId = `recurring-task-${template.id}-${todayStr}`;
      const occurrenceRef = doc(db, 'tasks', occurrenceId);
      const nowIso = new Date().toISOString();

      // Deterministic ID makes this safe to run from multiple tabs/devices.
      await setDoc(occurrenceRef, {
        title: template.title,
        description: template.description,
        priority: template.priority,
        status: 'pending',
        assignedTo: template.assignedTo,
        createdBy: template.ownerId || template.assignedTo,
        checklist: [],
        comments: [],
        deadline: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        recurringTemplateId: template.id,
        recurringOccurrenceDate: todayStr,
        recurringInstance: true,
      }, { merge: true });

      await updateDoc(doc(db, 'recurringTaskTemplates', template.id), {
        lastGeneratedDate: todayStr
      });
    }
  } catch (err) {
    console.error('Error processing recurring tasks:', err);
  }
}
