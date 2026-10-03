import type { Data, Photo, Trip } from './model';

export function photoNeedsReview(photo: Photo, trip?: Trip) {
    return !photo.source.includes('EXIF 拍攝日期') || photo.lat === null || photo.lng === null
        || photo.city === '待確認地點'
        || !!trip && (photo.date < trip.start_date || photo.date > trip.end_date);
}

export function timelineDays(data: Data, trip: Trip) {
    const dates = new Set<string>();
    for (let date = trip.start_date; date <= trip.end_date;
        date = new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)) dates.add(date);
    const photos = data.photos.filter(p => p.trip_id === trip.id);
    const places = data.places.filter(p => p.trip_id === trip.id);
    const diaries = data.diaries.filter(p => p.trip_id === trip.id);
    const itinerary = data.itinerary.filter(p => p.trip_id === trip.id);
    [...photos, ...places, ...diaries, ...itinerary].forEach(p => dates.add(p.date));
    return [...dates].sort().map(date => ({
        date, outside: date < trip.start_date || date > trip.end_date,
        photos: photos.filter(p => p.date === date),
        places: places.filter(p => p.date === date),
        diaries: diaries.filter(p => p.date === date),
        itinerary: itinerary.filter(p => p.date === date).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')),
    }));
}
