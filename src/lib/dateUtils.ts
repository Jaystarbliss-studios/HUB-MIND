import { parseISO as dateFnsParseISO, isValid, format } from 'date-fns';

export function safeParseISO(dateVal: any) {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'object' && dateVal.toDate) return dateVal.toDate(); // Firestore Timestamp
  if (typeof dateVal === 'object' && dateVal.seconds) return new Date(dateVal.seconds * 1000);
  try {
    const parsed = dateFnsParseISO(String(dateVal));
    if (isValid(parsed)) return parsed;
  } catch (e) {}
  return new Date();
}

export function safeFormat(dateVal: any, formatStr: string) {
  try {
    return format(safeParseISO(dateVal), formatStr);
  } catch (e) {
    return '';
  }
}
