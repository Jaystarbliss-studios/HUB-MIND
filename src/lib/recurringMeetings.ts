import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { RecurringMeetingTemplate } from '../types';
import { addDays, format, startOfDay } from 'date-fns';

const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function getRecurringMeetingDateKey(templateId: string, date: Date) {
  return `recurring-meeting-${templateId}-${format(date, 'yyyy-MM-dd')}`;
}

export async function materializeRecurringMeetings(daysAhead = 90) {
  const templates = await getDocs(query(collection(db, 'recurringMeetingTemplates'), where('active', '==', true)));
  const now = new Date();
  const start = startOfDay(now);

  for (const snapshot of templates.docs) {
    const template = { id: snapshot.id, ...snapshot.data() } as RecurringMeetingTemplate;
    const until = template.endDate ? new Date(template.endDate) : addDays(start, daysAhead);

    for (let offset = 0; offset <= daysAhead; offset++) {
      const date = addDays(start, offset);
      if (date > until || date < new Date(template.startDate)) continue;

      const weekdayMatches = template.daysOfWeek?.includes(date.getDay());
      const monthlyMatches = template.frequency === 'monthly'
        ? date.getDate() === template.dayOfMonth
        : true;
      const dailyMatches = template.frequency === 'daily';
      const weeklyMatches = template.frequency === 'weekly' && weekdayMatches;

      if (!dailyMatches && !weeklyMatches && !monthlyMatches) continue;

      const [hours, minutes] = template.startTime.split(':').map(Number);
      const eventDate = new Date(date);
      eventDate.setHours(hours || 0, minutes || 0, 0, 0);

      const id = getRecurringMeetingDateKey(template.id, date);
      const ref = doc(db, 'meetings', id);

      await setDoc(ref, {
        notesRaw: template.title,
        date: eventDate.toISOString(),
        attendees: template.attendees || [],
        actionPoints: [],
        generatedDocs: [],
        ownerId: template.ownerId,
        clientId: template.clientId || null,
        projectId: template.projectId || null,
        status: 'scheduled',
        recurringTemplateId: template.id,
        recurringOccurrenceDate: format(date, 'yyyy-MM-dd'),
        recurringInstance: true,
        createdAt: template.createdAt
      }, { merge: true });
    }
  }
}

export function recurringMeetingSummary(template: RecurringMeetingTemplate) {
  if (template.frequency === 'daily') return 'Every day';
  if (template.frequency === 'monthly') return `Monthly on the ${template.dayOfMonth}${template.dayOfMonth === 1 ? 'st' : template.dayOfMonth === 2 ? 'nd' : template.dayOfMonth === 3 ? 'rd' : 'th'}`;
  return (template.daysOfWeek || []).sort().map(d => dayNames[d]).join(', ');
}
