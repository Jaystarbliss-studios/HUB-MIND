import {addDoc,collection,doc,getDocs,query,where} from 'firebase/firestore';
import {db} from '../firebaseConfig';
import {RecurringMeetingTemplate,RecurringTaskTemplate} from '../types';

export function shouldGenerate(date:Date,template:{active:boolean;startDate?:string;endDate?:string;frequency:string;daysOfWeek?:number[];dayOfWeek?:number;dayOfMonth?:number}){
 if(!template.active)return false; const day=date.getDay(); const dom=date.getDate(); const iso=date.toISOString().slice(0,10);
 if(template.startDate&&iso<template.startDate)return false; if(template.endDate&&iso>template.endDate)return false;
 if(template.frequency==='daily')return true; if(template.frequency==='weekly')return (template.daysOfWeek||[template.dayOfWeek]).includes(day); if(template.frequency==='monthly')return dom===template.dayOfMonth; return false;
}
export function occurrenceKey(templateId:string,date:Date){return `${templateId}_${date.toISOString().slice(0,10)}`;}
export async function materializeRecurringTasksForDate(date=new Date()){
 const snap=await getDocs(query(collection(db,'recurringTaskTemplates'),where('active','==',true))); const created:string[]=[];
 for(const d of snap.docs){const t=d.data() as RecurringTaskTemplate;if(!shouldGenerate(date,t))continue;const key=occurrenceKey(d.id,date);const existing=await getDocs(query(collection(db,'tasks'),where('recurrenceKey','==',key)));if(!existing.empty)continue;const ref=await addDoc(collection(db,'tasks'),{title:t.title,description:t.description,priority:t.priority,status:'assigned',assignedTo:t.assignedTo,createdBy:t.ownerId,ownerId:t.ownerId,visibility:'private',checklist:[],comments:[],createdAt:date.toISOString(),updatedAt:date.toISOString(),recurringTemplateId:d.id,recurrenceKey:key});created.push(ref.id);}
 return created;
}
export function getMeetingOccurrence(template:RecurringMeetingTemplate,date=new Date()){if(!shouldGenerate(date,template))return null;return{templateId:template.id,occurrenceKey:occurrenceKey(template.id,date),title:template.title,date:date.toISOString(),startTime:template.startTime,endTime:template.endTime,projectId:template.projectId,clientId:template.clientId,ownerId:template.ownerId,attendees:template.attendees||[]};}
