import { ApiError, bucket, checkOrigin, db, failure, identity } from '../../../lib/server';
import { backupSchema, decodeBackupPhoto, maxBackupBytes } from '../../../lib/backup';

export async function POST(request:Request) {
    const uploaded: string[]=[];
    let commitUncertain=false;
    try {
        checkOrigin(request);
        const user=await identity();
        if (Number(request.headers.get('content-length'))>maxBackupBytes) throw new ApiError(413,'單次還原上限 32 MB。');
        const reader=request.body?.getReader();
        if(!reader) throw new ApiError(400,'找不到備份內容。');
        const decoder=new TextDecoder();
        let size=0, raw='';
        while(true) {
            const {done,value}=await reader.read();
            if(done) break;
            size+=value.byteLength;
            if(size>maxBackupBytes){await reader.cancel();throw new ApiError(413,'單次還原上限 32 MB。');}
            raw+=decoder.decode(value,{stream:true});
        }
        raw+=decoder.decode();
        let json:unknown;
        try {json=JSON.parse(raw);} catch {throw new ApiError(400,'無法讀取備份 JSON。');}
        const parsed=backupSchema.safeParse(json);
        if(!parsed.success) throw new ApiError(400,'備份格式無效或缺少照片原始檔。');
        const data=parsed.data;
        let photos;
        try {photos=data.photos.map(photo=>({photo,bytes:decodeBackupPhoto(photo)}));}
        catch {throw new ApiError(400,'備份包含無效的照片。');}
        const digestBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
        const digest=Array.from(new Uint8Array(digestBytes),b=>b.toString(16).padStart(2,'0')).join('');
        const previous=()=>db().prepare('SELECT digest FROM backup_restores WHERE user_id=? AND digest=?').bind(user.userId,digest).first();
        if(await previous()) return Response.json({ok:true,duplicate:true});
        const statements=[db().prepare('INSERT INTO backup_restores(user_id,digest) VALUES(?,?)').bind(user.userId,digest)];
        const ids=new Map<string,string>();
        function insert(table:string, record:Record<string,string|number|null|undefined>) {
            const cols=Object.keys(record);
            statements.push(db().prepare('INSERT INTO '+table+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')')
                .bind(...Object.values(record).map(value=>value??null)));
        }
        for(const {id,...trip} of data.trips) {
            const newId=crypto.randomUUID();
            ids.set(id,newId);
            insert('trips',{...trip,id:newId,user_id:user.userId});
        }
        for(const table of ['places','diaries','itinerary','tasks'] as const)
            for(const row of data[table]) insert(table,{...row,id:crypto.randomUUID(),trip_id:ids.get(row.trip_id)!});
        for(const {photo,bytes} of photos) {
            const {base64,...row}=photo;
            const id=crypto.randomUUID(), key=user.userId+'/'+id;
            await bucket().put(key,bytes,{httpMetadata:{contentType:row.content_type}});
            uploaded.push(key);
            insert('photos',{...row,id,trip_id:ids.get(row.trip_id)!,object_key:key});
        }
        commitUncertain=true;
        try {await db().batch(statements);}
        catch(error) {
            // Leave blobs intact if their records were committed but the reply was lost.
            const exists=await db().prepare('SELECT id FROM trips WHERE id=?').bind(ids.values().next().value || '').first();
            if(exists) return Response.json({ok:true,trips:data.trips.length});
            const restored=await previous();
            commitUncertain=false;
            if(restored) {
                if(uploaded.length) await bucket().delete(uploaded);
                return Response.json({ok:true,duplicate:true});
            }
            throw error;
        }
        return Response.json({ok:true,trips:data.trips.length});
    } catch(error) {
        if(uploaded.length && !commitUncertain) await bucket().delete(uploaded).catch(()=>{});
        return failure(error);
    }
}
