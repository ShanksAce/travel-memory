'use client';
import { useState } from 'react';
import { daysBetween, type Data, type Photo, type Trip } from '../lib/model';
import type { GuestPhoto } from '../lib/guest';
import { timelineDays } from '../lib/timeline';
import styles from './travel-timeline.module.css';

function hasMemory(day: ReturnType<typeof timelineDays>[number]) {
    return Boolean(day.photos.length || day.places.length || day.diaries.length || day.itinerary.length);
}

export default function TravelTimeline({ data, trip, onPhoto, onAddDiary }: {
    data: Data; trip: Trip; onPhoto: (photo: Photo) => void; onAddDiary: (date: string) => void;
}) {
    const [filledOnly, setFilledOnly] = useState(false);
    const days = timelineDays(data, trip).filter(day => !filledOnly || hasMemory(day));
    return <section className="memory-timeline">
        <div className={`toolbar ${styles.toolbar}`}>
            <div>
                <h2>旅行時間軸</h2>
                <p className="helper">依日期整理行程、足跡、照片與日記。</p>
            </div>
            <label className={styles.filter}>
                <input type="checkbox" checked={filledOnly} onChange={e => setFilledOnly(e.target.checked)}/>
                只看有紀錄的日子
            </label>
        </div>
        {!days.length && <p className="empty-state">還沒有紀錄。上傳照片或新增足跡、日記後，就會出現在這裡。</p>}
        {days.map(day => <article className={`memory-day panel ${styles.day}`} key={day.date}>
            <header className={`section-heading ${styles.dayHeader}`}>
                <div>
                    <span className="eyebrow">{day.outside ? '旅行日期範圍外' : `第 ${daysBetween(trip.start_date, day.date) + 1} 天`}</span>
                    <h3><time dateTime={day.date}>{day.date}</time></h3>
                </div>
                {!day.outside && <button type="button" className="text-button" onClick={() => onAddDiary(day.date)}>＋ 寫下這一天</button>}
            </header>
            {day.itinerary.length > 0 && <section>
                <h4>行程規劃</h4>
                <ol className={styles.schedule}>
                    {day.itinerary.map(item => <li key={item.id}>
                        <span className={styles.scheduleTime}>{item.time || '時間未定'}</span>
                        <span className={styles.stop}>{item.title}{item.note && <span className="muted"> — {item.note}</span>}</span>
                    </li>)}
                </ol>
            </section>}
            {day.places.length > 0 && <section>
                <h4>留下的足跡</h4>
                <div className="place-chips">{day.places.map(place => <span className="pill" key={place.id}>{place.country} · {place.city}</span>)}</div>
            </section>}
            {day.photos.length > 0 && <section>
                <h4>旅行照片 · {day.photos.length} 張</h4>
                <div className={`photo-grid ${styles.photos}`}>
                    {day.photos.map(photo => <button type="button" className={`photo-card ${styles.photo}`} key={photo.id} onClick={() => onPhoto(photo)}>
                        <img loading="lazy" src={(photo as GuestPhoto).local_url || '/api/photos/' + photo.id} alt=""/>
                        <span className={styles.caption}>{photo.caption || photo.filename}{photo.city && <small>{photo.city}</small>}</span>
                    </button>)}
                </div>
            </section>}
            {day.diaries.length > 0 && <section>
                <h4>當天的心情</h4>
                {day.diaries.map(diary => <div className={`memory-diary ${styles.diary}`} key={diary.id}>
                    <span className="pill">{diary.mood}</span>
                    <h5>{diary.title}</h5>
                    <p>{diary.body}</p>
                </div>)}
            </section>}
            {!hasMemory(day) && <p className="muted">這一天還沒有旅行紀錄。</p>}
        </article>)}
    </section>;
}
