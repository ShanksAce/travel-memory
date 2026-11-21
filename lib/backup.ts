import { z } from 'zod';
import { day, tripInput, placeInput, diaryInput, itineraryInput, taskInput } from './model';

const id=z.string().min(1).max(150);
const child=z.object({id,trip_id:id});
export const backupSchema=z.object({
    format:z.enum(['travel-memory-backup-v1','travel-memory-guest-v1']),
    trips:tripInput.and(z.object({id,created_at:z.string().max(50)})).array().max(1000),
    places:child.merge(placeInput).array().max(10000),
    diaries:child.merge(diaryInput).array().max(10000),
    itinerary:child.merge(itineraryInput).array().max(10000),
    tasks:child.merge(taskInput).array().max(10000),
    photos:child.extend({
        filename:z.string().min(1).max(200), content_type:z.enum(['image/jpeg','image/png','image/webp']),
        size:z.number().int().positive().max(12*1024*1024), date:day, city:z.string().max(160),
        country:z.string().max(160).default(''), region:z.string().max(160).default(''),
        lat:z.number().min(-90).max(90).nullable(), lng:z.number().min(-180).max(180).nullable(),
        source:z.string().max(300),caption:z.string().max(1000),base64:z.string().max(16*1024*1024),
    }).array().max(1000),
}).superRefine((data,context)=>{
    const tripIds=new Set(data.trips.map(trip=>trip.id));
    for (const key of ['trips','places','diaries','itinerary','tasks','photos'] as const) {
        const seen=new Set<string>();
        for(const row of data[key]) {
            if(seen.has(row.id) || ('trip_id' in row && !tripIds.has(row.trip_id))) {
                context.addIssue({code:'custom',path:[key],message:'備份含重複紀錄或找不到所屬旅行。'});
                break;
            }
            seen.add(row.id);
        }
    }
});
export const maxBackupBytes=32*1024*1024;
export function typeOfPhoto(bytes:Uint8Array) {
    if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
    if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10') return 'image/png';
    if(String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'image/webp';
    return '';
}
export function decodeBackupPhoto(photo:z.infer<typeof backupSchema>['photos'][number]) {
    const bytes=Uint8Array.from(atob(photo.base64),c=>c.charCodeAt(0));
    if(bytes.length!==photo.size || typeOfPhoto(bytes)!==photo.content_type) throw Error('備份中的照片內容或大小不符。');
    return bytes;
}
