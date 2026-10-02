import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ResourceType } from '../types';

export interface SearchResult { type:ResourceType; id:string; title:string; subtitle?:string; path:string; }
const collections:Record<ResourceType,string>={document:'documents',task:'tasks',project:'projects',meeting:'meetings',client:'clients',followUp:'followUps',knowledge:'knowledge',report:'reports'};
const routes:Record<ResourceType,string>={document:'documents',task:'tasks',project:'projects',meeting:'meetings',client:'clients',followUp:'follow-ups',knowledge:'knowledge',report:'reports'};

async function getVisibleDocs(collectionName:string, userId:string, max:number) {
  const sharedField=`sharedWith.${userId}`;
  const [owned,workspace,shared]=await Promise.all([
    getDocs(query(collection(db,collectionName),where('ownerId','==',userId),limit(max))),
    getDocs(query(collection(db,collectionName),where('visibility','==','workspace'),limit(max))),
    getDocs(query(collection(db,collectionName),where(sharedField,'in',['read','write']),limit(max))),
  ]);
  const map=new Map<string,any>();
  for(const snap of [owned,workspace,shared]) for(const d of snap.docs) map.set(d.id,{id:d.id,...d.data()});
  return [...map.values()].slice(0,max);
}

export async function globalSearch(term:string,userId:string,maxPerType=8):Promise<SearchResult[]> {
  const needle=term.trim().toLowerCase();
  if(!needle||!userId)return[];
  const results:SearchResult[]=[];
  for(const type of Object.keys(collections) as ResourceType[]){
    const docs=await getVisibleDocs(collections[type],userId,maxPerType);
    for(const x of docs){
      const searchable=[x.title,x.name,x.description,x.content,x.email,x.phone].filter(Boolean).join(' ').toLowerCase();
      if(!searchable.includes(needle))continue;
      const title=String(x.title||x.name||x.description||x.id);
      results.push({type,id:x.id,title,subtitle:x.description?String(x.description):undefined,path:`/${routes[type]}/${x.id}`});
    }
  }
  return results.slice(0,50);
}
