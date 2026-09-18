import { z } from 'zod';
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + 'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, '日期無效');
const required = z.string().trim().min(1, '請填寫必要欄位').max(160);
export const tripInput = z.object({ title: required, country: required, city: required, start_date: day, end_date: day, description: z.string().max(3000).default('') }).refine(x => x.end_date >= x.start_date, '回程日期不能早於出發日期').refine(x => (Date.parse(x.end_date) - Date.parse(x.start_date)) / 86400000 <= 365, '每趟旅行最多 366 天');
export const placeInput = z.object({ name: required, country: required, city: required, lat: z.number().finite().min(-85).max(85), lng: z.number().finite().min(-180).max(180), date: day });
export const diaryInput = z.object({ date: day, mood: z.enum(['開心', '感動', '平靜', '疲憊', '驚喜']), title: required, body: z.string().trim().min(1).max(12000) });
export const itineraryInput = z.object({ date: day, time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/), category: z.enum(['景點', '交通', '住宿', '美食', '其他']), title: required, note: z.string().max(3000).default(''), cost: z.number().finite().min(0).max(10000000).default(0) });
export const taskInput = z.object({ title: required, done: z.number().int().min(0).max(1).default(0) });
export type Trip = {
    id: string;
    title: string;
    country: string;
    city: string;
    start_date: string;
    end_date: string;
    description: string;
    created_at: string;
};
export type Place = {
    id: string;
    trip_id: string;
    name: string;
    country: string;
    city: string;
    lat: number;
    lng: number;
    date: string;
};
export type Diary = {
    id: string;
    trip_id: string;
    date: string;
    mood: string;
    title: string;
    body: string;
};
export type Itinerary = {
    id: string;
    trip_id: string;
    date: string;
    time: string;
    category: string;
    title: string;
    note: string;
    cost: number;
};
export type Task = {
    id: string;
    trip_id: string;
    title: string;
    done: number;
};
export type Photo = {
    id: string;
    trip_id: string;
    filename: string;
    content_type: string;
    size: number;
    date: string;
    city: string;
    lat: number | null;
    lng: number | null;
    source: string;
    caption: string;
};
export type Data = {
    trips: Trip[];
    places: Place[];
    diaries: Diary[];
    itinerary: Itinerary[];
    tasks: Task[];
    photos: Photo[];
};
export const emptyData: Data = { trips: [], places: [], diaries: [], itinerary: [], tasks: [], photos: [] };
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
export function status(t: Trip, now = today()) { return now < t.start_date ? '即將出發' : now > t.end_date ? '回憶收藏' : '旅行中'; }
export function travelDays(trips: Trip[], now = today()) { const dates = new Set<string>(); for (const t of trips)
    for (let d = t.start_date; d <= t.end_date && d <= now; d = new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10))
        dates.add(d); return dates.size; }
export function stats(data: Data, now = today()) { const visited = data.places.filter(p => p.date <= now); return { countries: new Set(visited.map(p => p.country.trim())).size, cities: new Set(visited.map(p => p.country.trim() + '/' + p.city.trim())).size, days: travelDays(data.trips, now), photos: data.photos.length }; }
