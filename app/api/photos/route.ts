import { parse } from 'exifr';
import { db, bucket, identity, ownTrip, checkOrigin, failure, ApiError } from '../../../lib/server';
import { nearestCity } from '../../../lib/cities';
import { day } from '../../../lib/model';
export async function POST(req: Request) {
    try {
        checkOrigin(req);
        const user = await identity();
        if (Number(req.headers.get('content-length') || 0) > 13 * 1024 * 1024)
            throw new ApiError(413, '每張照片上限 12 MB。');
        const form = await req.formData();
        const tripId = String(form.get('trip_id') || '');
        const trip = await ownTrip(tripId, user.userId);
        const file = form.get('file');
        if (!(file instanceof File) || !file.size || file.size > 12 * 1024 * 1024)
            throw new ApiError(400, '請上傳 12 MB 以內的 JPEG、PNG 或 WebP 照片。');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let type = '';
        if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
            type = 'image/jpeg';
        else if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)
            type = 'image/png';
        else if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP')
            type = 'image/webp';
        if (!type)
            throw new ApiError(400, '檔案內容不是支援的照片格式。');
        let exif: Record<string, unknown> = {};
        try {
            exif = await parse(bytes, { pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'], gps: true }) || {};
        }
        catch { }
        const lat = typeof exif.latitude === 'number' && Number.isFinite(exif.latitude) && Math.abs(exif.latitude) <= 90 ? exif.latitude : null;
        const lng = typeof exif.longitude === 'number' && Number.isFinite(exif.longitude) && Math.abs(exif.longitude) <= 180 ? exif.longitude : null;
        const suggested = lat !== null && lng !== null ? nearestCity(lat, lng) : null;
        const taken = exif.DateTimeOriginal || exif.CreateDate;
        let date = String(form.get('date') || trip.start_date);
        let source = '手動日期／旅行地點';
        if (taken instanceof Date && !isNaN(taken.getTime())) {
            date = [taken.getFullYear(), String(taken.getMonth() + 1).padStart(2, '0'), String(taken.getDate()).padStart(2, '0')].join('-');
            source = 'EXIF 拍攝日期';
        }
        day.parse(date);
        const city = suggested ? suggested.city : lat !== null && lng !== null ? '待確認地點' : String(form.get('city') || trip.city);
        if (suggested)
            source += '・GPS 鄰近城市（約 ' + suggested.km + ' km）';
        else if (lat !== null && lng !== null)
            source += '・GPS 已保留';
        if (date < String(trip.start_date) || date > String(trip.end_date))
            source += '・拍攝日期在旅行範圍外';
        const id = crypto.randomUUID(), key = user.userId + '/' + id;
        await bucket().put(key, bytes, { httpMetadata: { contentType: type } });
        try {
            await db().prepare('INSERT INTO photos(id,trip_id,object_key,filename,content_type,size,date,city,lat,lng,source,caption) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, tripId, key, file.name.slice(0, 200), type, file.size, date, city.slice(0, 160), lat, lng, source, '').run();
        }
        catch (e) {
            await bucket().delete(key);
            throw e;
        }
        return Response.json({ ok: true, id, date, city, source });
    }
    catch (e) {
        return failure(e);
    }
}
