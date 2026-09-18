import { z } from 'zod';
import { db, bucket, identity, ownTrip, checkOrigin, failure, ApiError } from '../../../lib/server';
import { tripInput, placeInput, diaryInput, itineraryInput, taskInput, day } from '../../../lib/model';
const envelope = z.object({ action: z.enum(['save', 'delete', 'seed']), entity: z.enum(['trip', 'place', 'diary', 'itinerary', 'task', 'photo']).optional(), id: z.string().max(100).optional(), trip_id: z.string().max(100).optional(), data: z.unknown().optional() });
const tables = { place: 'places', diary: 'diaries', itinerary: 'itinerary', task: 'tasks', photo: 'photos' } as const;
export async function POST(req: Request) {
    try {
        checkOrigin(req);
        const user = await identity();
        if (Number(req.headers.get('content-length') || 0) > 50000)
            throw new ApiError(413, '文字資料過大。');
        const input = envelope.parse(await req.json());
        const id = input.id || crypto.randomUUID();
        if (input.action === 'seed') {
            const prefix = 'demo-' + user.userId + '-';
            const exists = await db().prepare('SELECT id FROM trips WHERE id=? AND user_id=?').bind(prefix + 'tokyo', user.userId).first();
            if (exists)
                return Response.json({ ok: true });
            const upcoming = new Date();
            upcoming.setUTCDate(upcoming.getUTCDate() + 45);
            const start = upcoming.toISOString().slice(0, 10);
            upcoming.setUTCDate(upcoming.getUTCDate() + 4);
            const end = upcoming.toISOString().slice(0, 10);
            await db().batch([
                db().prepare('INSERT OR IGNORE INTO trips(id,user_id,title,country,city,start_date,end_date,description,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(prefix + 'tokyo', user.userId, '東京，慢慢走', '日本', '東京', start, end, '示範旅行｜把想去的地方，一站一站放進口袋。', new Date().toISOString()),
                db().prepare('INSERT OR IGNORE INTO trips(id,user_id,title,country,city,start_date,end_date,description,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(prefix + 'tainan', user.userId, '台南的午後時光', '台灣', '台南', '2026-07-10', '2026-07-12', '示範旅行｜巷弄、小吃與沒有目的的散步。', new Date().toISOString()),
                db().prepare('INSERT OR IGNORE INTO places(id,trip_id,name,country,city,lat,lng,date) VALUES(?,?,?,?,?,?,?,?)').bind(prefix + 'place', prefix + 'tainan', '神農街', '台灣', '台南', 22.9976, 120.1964, '2026-07-11'),
                db().prepare('INSERT OR IGNORE INTO diaries(id,trip_id,date,mood,title,body) VALUES(?,?,?,?,?,?)').bind(prefix + 'diary', prefix + 'tainan', '2026-07-11', '平靜', '把步調慢下來', '這是示範日記。午後在巷子裡散步，找到一家小小的咖啡店。旅行不一定要排滿行程，留白也很美。'),
                db().prepare('INSERT OR IGNORE INTO itinerary(id,trip_id,date,time,category,title,note,cost) VALUES(?,?,?,?,?,?,?,?)').bind(prefix + 'plan', prefix + 'tokyo', start, '14:00', '景點', '淺草散步', '先到飯店寄放行李，再慢慢逛。預算以新台幣估算。', 500),
                ...['機票', '住宿', '旅遊保險', '網路／SIM 卡', '行李清單'].map((title, i) => db().prepare('INSERT OR IGNORE INTO tasks(id,trip_id,title,done) VALUES(?,?,?,?)').bind(prefix + 'task' + i, prefix + 'tokyo', title, i < 2 ? 1 : 0))
            ]);
            return Response.json({ ok: true });
        }
        if (!input.entity)
            throw new ApiError(400, '缺少操作類型。');
        if (input.entity === 'trip') {
            if (input.id)
                await ownTrip(id, user.userId);
            if (input.action === 'delete') {
                if (!input.id)
                    throw new ApiError(400, '缺少旅行 ID。');
                const keys = await db().prepare('SELECT object_key FROM photos WHERE trip_id=?').bind(id).all<{
                    object_key: string;
                }>();
                if (keys.results.length)
                    await bucket().delete(keys.results.map(x => x.object_key));
                await db().prepare('DELETE FROM trips WHERE id=? AND user_id=?').bind(id, user.userId).run();
                return Response.json({ ok: true });
            }
            const t = tripInput.parse(input.data);
            if (input.id) {
                const dates = await db().batch(['places', 'diaries', 'itinerary'].map(table => db().prepare('SELECT date FROM ' + table + ' WHERE trip_id=? AND (date<? OR date>?) LIMIT 1').bind(id, t.start_date, t.end_date)));
                if (dates.some(x => x.results.length))
                    throw new ApiError(400, '新日期範圍未涵蓋現有打卡、日記或行程，請先調整這些紀錄。');
                await db().prepare('UPDATE trips SET title=?,country=?,city=?,start_date=?,end_date=?,description=? WHERE id=? AND user_id=?').bind(t.title, t.country, t.city, t.start_date, t.end_date, t.description, id, user.userId).run();
            }
            else
                await db().prepare('INSERT INTO trips(id,user_id,title,country,city,start_date,end_date,description,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, user.userId, t.title, t.country, t.city, t.start_date, t.end_date, t.description, new Date().toISOString()).run();
            return Response.json({ ok: true, id });
        }
        if (!input.trip_id)
            throw new ApiError(400, '請先選擇旅行。');
        const trip = await ownTrip(input.trip_id, user.userId);
        const table = tables[input.entity];
        if (input.id) {
            const found = await db().prepare('SELECT id FROM ' + table + ' WHERE id=? AND trip_id=?').bind(id, input.trip_id).first();
            if (!found)
                throw new ApiError(404, '找不到這筆紀錄。');
        }
        if (input.action === 'delete') {
            if (!input.id)
                throw new ApiError(400, '缺少紀錄 ID。');
            if (input.entity === 'photo') {
                const p = await db().prepare('SELECT object_key FROM photos WHERE id=? AND trip_id=?').bind(id, input.trip_id).first<{
                    object_key: string;
                }>();
                if (p)
                    await bucket().delete(p.object_key);
            }
            await db().prepare('DELETE FROM ' + table + ' WHERE id=? AND trip_id=?').bind(id, input.trip_id).run();
            return Response.json({ ok: true });
        }
        const schemas = { place: placeInput, diary: diaryInput, itinerary: itineraryInput, task: taskInput, photo: z.object({ date: day, city: z.string().trim().min(1).max(160), caption: z.string().max(1000) }) };
        if (input.entity === 'photo' && !input.id)
            throw new ApiError(400, '請使用相片上傳功能。');
        const data = schemas[input.entity].parse(input.data) as Record<string, string | number>;
        if (data.date && input.entity !== 'photo' && (data.date < String(trip.start_date) || data.date > String(trip.end_date)))
            throw new ApiError(400, '日期必須在旅行日期範圍內。');
        const cols = Object.keys(data), values = Object.values(data);
        if (input.id)
            await db().prepare('UPDATE ' + table + ' SET ' + cols.map(k => k + '=?').join(',') + ' WHERE id=? AND trip_id=?').bind(...values, id, input.trip_id).run();
        else
            await db().prepare('INSERT INTO ' + table + '(id,trip_id,' + cols.join(',') + ') VALUES(' + Array(cols.length + 2).fill('?').join(',') + ')').bind(id, input.trip_id, ...values).run();
        return Response.json({ ok: true, id });
    }
    catch (e) {
        return failure(e);
    }
}
