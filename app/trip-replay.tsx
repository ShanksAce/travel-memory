'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, X } from 'lucide-react';
import type { Data, Itinerary, Place, Trip } from '../lib/model';
import { cities } from '../lib/cities';
import { timelineDays } from '../lib/timeline';
import WorldGlobe from './world-globe';
import WorldMap from './world-map';

export default function TripReplay({ trip, data, onClose, onOpenDay }: {
    trip: Trip;
    data: Data;
    onClose: () => void;
    onOpenDay: (date: string, stopId?: string) => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [index, setIndex] = useState(0);
    const [intro, setIntro] = useState(true);
    const [playing, setPlaying] = useState(false);
    const frames = useMemo(() => {
        const days = timelineDays(data, trip).filter(day => !day.outside);
        const recorded = days.filter(day => day.itinerary.length || day.photos.length || day.diaries.length);
        return (recorded.length ? recorded : days.slice(0,1)).flatMap(day => {
            const stops: (Itinerary | null)[] = day.itinerary.length ? day.itinerary : [null];
            return stops.map(stop => ({ day, stop }));
        });
    }, [data, trip]);
    const toPoint = (stop: Itinerary | null): Place | null => stop && stop.lat != null && stop.lng != null ? {
        id:stop.id, trip_id:trip.id, date:stop.date, name:stop.title,
        country:trip.country, city:trip.city, lat:stop.lat, lng:stop.lng,
    } : null;
    const frame = frames[index];
    const first = frames.map(f => f.stop).find(stop => stop?.lat != null && stop.lng != null);
    const city = cities.find(c => c[0] === trip.city && c[1] === trip.country);
    const target = first ? { lat:first.lat!, lng:first.lng! } : city ? { lat:city[2], lng:city[3] } : undefined;
    const hasTarget = Boolean(target);
    const last = index >= frames.length-1;

    useEffect(() => {
        dialog.current?.showModal();
    }, []);
    useEffect(() => {
        if (!intro) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            || document.documentElement.dataset.motion === 'reduce';
        const timer = window.setTimeout(() => { setIntro(false); setPlaying(frames.length > 1 && !reduced); }, reduced || !hasTarget ? 0 : 1900);
        return () => window.clearTimeout(timer);
    }, [intro, frames.length, hasTarget]);
    useEffect(() => {
        if (!playing || intro || last) return;
        const timer = window.setTimeout(() => setIndex(index+1), 3000);
        return () => window.clearTimeout(timer);
    }, [index, intro, last, playing]);

    if (!frame) return null;
    const {day, stop} = frame;
    const route = frames.slice(0,index+1).filter(f=>f.day.date===day.date).map(f=>toPoint(f.stop));
    const points = route.filter((p):p is Place=>p!==null);
    const numbers = Object.fromEntries(route.flatMap((p,i)=>p?[[p.id,i+1]]:[]));
    function jump(next: number) {
        setIndex(Math.max(0, Math.min(frames.length-1,next)));
        setPlaying(false);
    }
    return <dialog ref={dialog} className="trip-replay" aria-labelledby="replay-title" onCancel={e=>{ e.preventDefault(); onClose(); }}>
        <header><div><p className="helper">旅程回放</p><h2 id="replay-title">{trip.title}</h2></div>
            <button className="icon-button" autoFocus aria-label="關閉旅程回放" onClick={onClose}><X size={20}/></button>
        </header>
        {intro ? <div className="replay-intro">
            <WorldGlobe places={[]} onSelect={()=>{}} flightTarget={target}/>
            <button className="button" onClick={()=>{setIntro(false);setPlaying(false);}}>跳過開場</button>
        </div> : <>
            <div className="replay-main">
                {points.length>0 ? <WorldMap key={day.date} places={points} numbers={numbers} route={route} fit/> :
                    <p className="replay-no-map">這個片段沒有已定位的站點。</p>}
                <section className="replay-memory" aria-live="polite">
                    <time dateTime={day.date}>{day.date}{stop?.time && ' · '+stop.time}</time>
                    <h3>{stop?.title || '當日回憶'}</h3>
                    {stop?.note && <p>{stop.note}</p>}
                    {day.photos[0] && <figure><img src={(day.photos[0] as {local_url?:string}).local_url || '/api/photos/'+day.photos[0].id} alt={day.photos[0].caption || day.photos[0].filename}/><figcaption>當日照片</figcaption></figure>}
                    {day.diaries[0] && <div><strong>{day.diaries[0].title}</strong><p>{day.diaries[0].body}</p></div>}
                    <button className="button" onClick={()=>onOpenDay(day.date,stop?.id)}>查看當日行程</button>
                </section>
            </div>
            <footer className="replay-controls">
                <button className="icon-button" aria-label="上一段" disabled={index===0} onClick={()=>jump(index-1)}><ArrowLeft size={18}/></button>
                <button className="button" onClick={()=>{if(last){setIndex(0);setPlaying(true);}else setPlaying(!playing);}}>
                    {!last && playing ? <Pause size={16}/> : <Play size={16}/>}
                    {last?'重新播放':playing?'暫停':'播放'}
                </button>
                <button className="icon-button" aria-label="下一段" disabled={last} onClick={()=>jump(index+1)}><ArrowRight size={18}/></button>
                <label>回放進度 <input type="range" min={0} max={frames.length-1} value={index} onChange={e=>jump(Number(e.target.value))}/></label>
                <span>{index+1}／{frames.length}</span>
            </footer>
        </>}
    </dialog>;
}
