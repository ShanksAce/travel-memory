import { db, identity, failure } from '../../../lib/server';
export async function GET() {
    try {
        const u = await identity();
        const result = await db().batch([
            db().prepare('SELECT id,title,country,city,start_date,end_date,description,created_at FROM trips WHERE user_id=? ORDER BY start_date DESC').bind(u.userId),
            ...['places', 'diaries', 'itinerary', 'tasks', 'photos'].map(table => db().prepare('SELECT c.* FROM ' + table + ' c JOIN trips t ON c.trip_id=t.id WHERE t.user_id=?').bind(u.userId))
        ]);
        const [trips, places, diaries, itinerary, tasks, photos] = result.map(x => x.results);
        return Response.json({ trips, places, diaries, itinerary, tasks, photos: photos.map((row: any) => { const { object_key, ...p } = row; return p; }) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        return failure(e);
    }
}
