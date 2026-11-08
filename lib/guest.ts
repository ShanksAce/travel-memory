'use client';
import { parse } from 'exifr';
import { emptyData, tripInput, placeInput, diaryInput, itineraryInput, taskInput, day, type Data } from './model';
import { nearestCity } from './cities';
import { tokyoTrip, tokyoStops } from './tokyo-demo';
const tables = {trip:'trips',place:'places',diary:'diaries',itinerary:'itinerary',task:'tasks',photo:'photos'} as const;
export type GuestPhoto = Data['photos'][number] & { local_url?: string };
function openStore(): Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const r=indexedDB.open('travel-memory-guest',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('無法開啟瀏覽器儲存空間。'));}); }
async function store(write?: {data:Data; files:Record<string,Blob>}) {
 const db=await openStore();
 try { return await new Promise<{data:Data;files:Record<string,Blob>}>((resolve,reject)=>{const tx=db.transaction('state',write?'readwrite':'readonly'), s=tx.objectStore('state');let value={data:structuredClone(emptyData),files:{}} as {data:Data;files:Record<string,Blob>};const r=write?s.put(write,'journal'):s.get('journal');r.onsuccess=()=>{value=write||r.result||value;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(Error('瀏覽器儲存失敗，可能空間不足。請先匯出備份。'));tx.onabort=()=>reject(Error('瀏覽器儲存失敗。'));}); } finally {db.close();}
}
export async function guestData() {const state=await store();const data=state.data;data.photos=data.photos.map(p=>({...p,local_url:state.files[p.id]?URL.createObjectURL(state.files[p.id]):''}));return data;}
export async function guestAction(input: any) {
 const state=await store(), data=state.data;
 if(input.action==='seed') {if(!data.trips.some(t=>t.id===tokyoTrip.id)){data.trips.push(tokyoTrip);data.itinerary.push(...tokyoStops);await store(state);}return {ok:true,id:tokyoTrip.id};}
 const table=tables[input.entity as keyof typeof tables];if(!table)throw Error('操作無效。');
 const records=data[table] as any[],existing=records.find(p=>p.id===input.id);
 if(input.action==='delete') {if(!existing)throw Error('找不到紀錄。');if(table==='trips'){for(const key of Object.values(tables)) {if(key==='trips')continue;(data[key] as any)=(data[key] as any[]).filter(p=>{if(p.trip_id!==input.id)return true;if(key==='photos')delete state.files[p.id];return false;});}}if(table==='photos')delete state.files[input.id];(data[table] as any)=records.filter(p=>p.id!==input.id);await store(state);return {ok:true};}
 let values:any;
 if(table==='trips'){values=tripInput.parse(input.data);if(existing && ['places','diaries','itinerary'].some(key=>(data[key as 'places'] as any[]).some(p=>p.trip_id===existing.id&&(p.date<values.start_date||p.date>values.end_date))))throw Error('旅行日期需包含已有的足跡、日記與行程。');}
 else {const trip=data.trips.find(t=>t.id===input.trip_id);if(!trip)throw Error('請先建立旅行。');const schemas={place:placeInput,diary:diaryInput,itinerary:itineraryInput,task:taskInput};values=input.entity==='photo'?{date:day.parse(input.data.date),city:String(input.data.city).trim(),caption:String(input.data.caption||'')}:schemas[input.entity as keyof typeof schemas].parse(input.data);if(values.date && input.entity!=='photo'&&(values.date<trip.start_date||values.date>trip.end_date))throw Error('日期需在旅行範圍內。');}
 const id=input.id||crypto.randomUUID();if(input.id&&!existing)throw Error('找不到紀錄。');
 if(existing)Object.assign(existing,values);else records.push({id,trip_id:input.trip_id,created_at:new Date().toISOString(),...values});
 await store(state);return {ok:true,id};
}
export async function guestUpload(form:FormData){const state=await store(),file=form.get('file'),trip=state.data.trips.find(t=>t.id===form.get('trip_id'));if(!trip||!(file instanceof File))throw Error('請先建立旅行並選擇照片。');if(file.size>12*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('請上傳 12 MB 以內的 JPEG、PNG 或 WebP。');let exif:any={};try{exif=await parse(await file.arrayBuffer(),{gps:true})||{};}catch{}
 const taken=exif.DateTimeOriginal||exif.CreateDate, date=form.get('use_selected_date')==='1'?day.parse(form.get('date')):taken instanceof Date&&!isNaN(taken.getTime())?[taken.getFullYear(),String(taken.getMonth()+1).padStart(2,'0'),String(taken.getDate()).padStart(2,'0')].join('-'):trip.start_date;
 const lat=Number.isFinite(exif.latitude)&&Math.abs(exif.latitude)<=90?exif.latitude:null,lng=Number.isFinite(exif.longitude)&&Math.abs(exif.longitude)<=180?exif.longitude:null;
 const city=lat!==null&&lng!==null?nearestCity(lat,lng)?.city||'待確認地點':trip.city,id=crypto.randomUUID();state.files[id]=file;state.data.photos.push({id,trip_id:trip.id,filename:file.name,content_type:file.type,size:file.size,date,city,lat,lng,source:form.get('use_selected_date')!=='1'&&taken instanceof Date?'EXIF 拍攝日期':'旅行日期／旅行地點',caption:''});await store(state);return {ok:true,id};}
export async function exportGuest(){const state=await store();const photos=await Promise.all(state.data.photos.map(async p=>{const blob=state.files[p.id];const bytes=blob?new Uint8Array(await blob.arrayBuffer()):null;let binary='';if(bytes)for(const byte of bytes)binary+=String.fromCharCode(byte);return {...p,base64:bytes?btoa(binary):null};}));return {format:'travel-memory-guest-v1',exported_at:new Date().toISOString(),...state.data,photos};}

export async function importGuest(email:string) {
 const state=await store();
 const key='travel-guest-import-'+email;
 const mapping:Record<string,string>=JSON.parse(localStorage.getItem(key)||'{}');
 async function api(url:string,init:RequestInit){const r=await fetch(url,init);const result=await r.json() as any;if(!r.ok)throw Error(result.error||'匯入失敗，已完成的項目會保留，可重試。');return result;}
 const send=(body:any)=>api('/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 let count=0;
 for(const trip of state.data.trips){
  if(!mapping[trip.id]){const result=await send({action:'save',entity:'trip',data:trip});mapping[trip.id]=result.id;localStorage.setItem(key,JSON.stringify(mapping));}
  for(const entity of ['place','diary','itinerary','task','photo'] as const){
   for(const item of state.data[tables[entity]].filter(p=>p.trip_id===trip.id)){
    if(mapping[item.id]){if(entity==='photo') await send({action:'save',entity:'photo',id:mapping[item.id],trip_id:mapping[trip.id],data:item});continue;}
    let result:any;
    if(entity==='photo') {const form=new FormData();const blob=state.files[item.id];if(!blob)throw Error('照片檔案遺失，請先檢查訪客備份。');form.set('trip_id',mapping[trip.id]);form.set('file',blob,(item as GuestPhoto).filename);result=await api('/api/photos',{method:'POST',body:form});
     mapping[item.id]=result.id;localStorage.setItem(key,JSON.stringify(mapping));
     await send({action:'save',entity:'photo',id:result.id,trip_id:mapping[trip.id],data:item});
    }else {result=await send({action:'save',entity,trip_id:mapping[trip.id],data:item});mapping[item.id]=result.id;localStorage.setItem(key,JSON.stringify(mapping));}
   }
  }
  count++;
 }
 await store({data:structuredClone(emptyData),files:{}});localStorage.removeItem(key);return count;
}
