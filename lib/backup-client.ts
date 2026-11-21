'use client';

import type { Data } from './model';
import { backupSchema, maxBackupBytes } from './backup';

export async function exportAccountBackup(tripId?:string) {
    const response=await fetch('/api/data');
    if(!response.ok) throw Error('無法讀取旅行資料，請重新登入後再試。');
    const data=await response.json() as Data;
    if(tripId) {
        data.trips=data.trips.filter(trip=>trip.id===tripId);
        if(!data.trips.length) throw Error('找不到這趟旅行。');
        data.places=data.places.filter(row=>row.trip_id===tripId);
        data.diaries=data.diaries.filter(row=>row.trip_id===tripId);
        data.itinerary=data.itinerary.filter(row=>row.trip_id===tripId);
        data.tasks=data.tasks.filter(row=>row.trip_id===tripId);
        data.photos=data.photos.filter(row=>row.trip_id===tripId);
    }
    const photos=[];
    let total=0;
    for (const photo of data.photos) {
        const image=await fetch('/api/photos/'+encodeURIComponent(photo.id));
        if(!image.ok) throw Error('有照片無法下載，請稍後重新備份。');
        const bytes=new Uint8Array(await image.arrayBuffer());
        total+=bytes.length;
        if(total>maxBackupBytes*.75) throw Error('照片超過單份備份上限，可分趟備份，或匯出文字並另存原始照片。');
        let binary='';
        for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        photos.push({...photo,base64:btoa(binary)});
    }
    return {format:'travel-memory-backup-v1',exported_at:new Date().toISOString(),...data,photos};
}
export async function restoreAccountBackup(file:File) {
    if(file.size>maxBackupBytes) throw Error('單次還原上限 32 MB。');
    const result=backupSchema.safeParse(JSON.parse(await file.text()));
    if(!result.success) throw Error('備份格式無效或缺少照片原始檔。');
    const response=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:file});
    const data=await response.json() as {error?:string;duplicate?:boolean;trips?:number};
    if(!response.ok) throw Error(data.error||'無法還原備份。');
    return data;
}
