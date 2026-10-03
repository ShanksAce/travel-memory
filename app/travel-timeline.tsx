'use client';
import { useState } from 'react';
import type { Data, Photo, Trip } from '../lib/model';
import { daysBetween } from '../lib/model';
import { timelineDays } from '../lib/timeline';

export default function TravelTimeline({ data, trip, onPhoto, onAddDiary }: {
    data: Data; trip: Trip; onPhoto: (photo: Photo) => void; onAddDiary: (date: string) => void;
}) {
    const [filledOnly, setFilledOnly] = useState(false);
    const days = timelineDays(data, trip).filter(day => !filledOnly || day.photos.length + day.places.length + day.diaries.length + day.itinerary.length > 0);
    return <section className="memory-timeline">
        <div className="toolbar"><div><h2>把每一天，串成回憶</h2><p className="helper">依日期整合照片、足跡、日記與規劃。照片目前依拍攝日期整理，不推測當天的先後順序。</p></div>
            <label><input type="checkbox" checked={filledOnly} onChange={e => setFilledOnly(e.target.checked)}/> 只看有紀錄的日子</label></div>
        {!days.length && <p className="empty-state">還沒有紀錄。上傳照片或新增足跡、日記後，就會出現在這裡。</p>}
        {days.map(day => <article className="memory-day panel" key={day.date}>
            <div className="section-heading"><div><span className="eyebrow">{day.outside ? '旅行日期範圍外' : 'DAY ' + (daysBetween(trip.start_date, day.date) + 1)}</span><h3><time dateTime={day.date}>{day.date}</time></h3></div>
                {!day.outside && <button className="text-button" onClick={() => onAddDiary(day.date)}>＋ 寫下這一天</button>}</div>
            {day.itinerary.length > 0 && <section><h4>行程規劃</h4>{day.itinerary.map(item => <p key={item.id}><time>{item.time || '時間未定'}</time> · {item.title}{item.note && <span className="muted"> — {item.note}</span>}</p>)}</section>}
            {day.places.length > 0 && <section><h4>留下的足跡</h4><div className="place-chips">{day.places.map(place => <span className="pill" key={place.id}>{place.city} · {place.name}</span>)}</div></section>}
            {day.photos.length > 0 && <section><h4>旅行照片 · {day.photos.length} 張</h4><div className="photo-grid">{day.photos.map(photo => <button className="photo-card" key={photo.id} onClick={() => onPhoto(photo)}><img loading="lazy" src={'/api/photos/' + photo.id} alt={photo.caption || photo.filename}/><span>{photo.city} · {photo.caption || photo.filename}</span></button>)}</div></section>}
            {day.diaries.length > 0 && <section><h4>當天的心情</h4>{day.diaries.map(diary => <div className="memory-diary" key={diary.id}><span className="pill">{diary.mood}</span><h3>{diary.title}</h3><p>{diary.body}</p></div>)}</section>}
            {!day.photos.length && !day.places.length && !day.diaries.length && !day.itinerary.length && <p className="muted">這一天還沒有紀錄，留一點空間給新的故事。</p>}
        </article>)}
    </section>;
}
