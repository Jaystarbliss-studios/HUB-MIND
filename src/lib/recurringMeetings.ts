import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { RecurringMeetingTemplate } from '../types';
import { addDays, format, startOfDay } from 'date-fns';

const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function getRecurringMeetingDateKey(templateId: string, date: Date) {
  return `recurring-meeting-${templateId}-${format(date, 'yyyy-MM-dd')}`;
}

/**
 * Materialize recurring templates into concrete calendar meetings.
 * This is intentionally idempotent: the deterministic meeting id means
 * running it repeatedly updates the same occurrence instead of duplicating it.
 */
export async function materializeRecurringMeetings(daysAhead = 90) {
  const templates = await getDocs(
    query(collection(db, 'recurringMeetingTemplates'), where('active', '==', true))
  );
  const now = new Date();
  const start = startOfDay(now);

  for (const snapshot of templates.docs) {
    const template = { id: snapshot.id, ...snapshot.data() } as RecurringMeetingTemplate;
    const templateStart = startOfDay(new Date(template.startDate));
    const horizon = addDays(start, daysAhead);
    const templateEnd = template.endDate ? startOfDay(new Date(template.endDate)) : horizon;
    const until = templateEnd < horizon ? templateEnd : horizon;

    for (let offset = 0; offset <= daysAhead; offset++) {
      const date = addDays(start, offset);
      if (date < templateStart || date > until) continue;

      const dailyMatches = template.frequency === 'daily';
      const weeklyMatches = template.frequency === 'weekly'
        && (template.daysOfWeek || []).includes(date.getDay());
      const monthlyMatches = template.frequency === 'monthly'
        && date.getDate() === template.dayOfMonth;

      // Exactly one recurrence rule must match this occurrence.
      if (!dailyMatches && !weeklyMatches && !monthlyMatches) continue;

      const [hours, minutes] = template.startTime.split(':').map(Number);
      const eventDate = new Date(date);
      eventDate.setHours(hours || 0, minutes || 0, 0, 0);

      const id = getRecurringMeetingDateKey(template.id, date);
      const ref = doc(db, 'meetings', id);

      await setDoc(ref, {
        title: template.title,
        notesRaw: template.description || template.title,
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
        location: template.location || null,
        meetingLink: template.meetingLink || null,
        createdAt: template.createdAt
      }, { merge: true });
    }
  }
}

export function recurringMeetingSummary(template: RecurringMeetingTemplate) {
  if (template.frequency === 'daily') return 'Every day';
  if (template.frequency === 'monthly') {
    const day = template.dayOfMonth ?? 1;
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    return `Monthly on the ${day}${suffix}`;
  }
  return (template.daysOfWeek || []).sort().map(d => dayNames[d]).join(', ');
}
