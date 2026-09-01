import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { RecurringTaskTemplate } from '../types';
import { format, startOfDay } from 'date-fns';

export async function processRecurringTasks() {
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const now = new Date();

  try {
    const q = query(collection(db, 'recurringTaskTemplates'), where('active', '==', true));
    const snapshot = await getDocs(q);
    
    for (const docSnapshot of snapshot.docs) {
      const template = { id: docSnapshot.id, ...docSnapshot.data() } as RecurringTaskTemplate;
      
      if (template.lastGeneratedDate === todayStr) {
        continue;
      }

      let shouldGenerate = false;

      if (template.frequency === 'daily') {
        shouldGenerate = true;
      } else if (template.frequency === 'weekly') {
        // dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        if (now.getDay() === template.dayOfWeek) {
          shouldGenerate = true;
        }
      } else if (template.frequency === 'monthly') {
        // dayOfMonth: 1-31
        if (now.getDate() === template.dayOfMonth) {
          shouldGenerate = true;
        }
      }

      if (shouldGenerate) {
        // Create the task
        await addDoc(collection(db, 'tasks'), {
          title: template.title,
          description: template.description,
          priority: template.priority,
          status: 'pending',
          assignedTo: template.assignedTo,
          createdBy: template.ownerId || template.assignedTo || 'system',
          checklist: [],
          comments: [],
          deadline: new Date().toISOString(), // due today
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurringTemplateId: template.id
        });

        // Update the template
        await updateDoc(doc(db, 'recurringTaskTemplates', template.id), {
          lastGeneratedDate: todayStr
        });
      }
    }
  } catch (err) {
    console.error('Error processing recurring tasks:', err);
  }
}
