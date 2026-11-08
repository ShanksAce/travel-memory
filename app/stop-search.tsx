'use client';

import { useState } from 'react';
import { cities } from '../lib/cities';

type Result = { name: string; address: string; lat: number; lng: number };
type Feature = { properties?: Record<string, string>; geometry?: { coordinates?: number[] } };

export default function StopSearch({ city, lat, lng, address }: {
    city?: string; lat?: number | null; lng?: number | null; address?: string;
}) {
    const [query, setQuery] = useState(''), [results, setResults] = useState<Result[]>([]);
    const [selected, setSelected] = useState<Result | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    async function search() {
        if (busy || query.trim().length < 2) return;
        setBusy(true); setResults([]); setMessage('');
        try {
            const url = new URL('https://photon.komoot.io/api/');
            url.search = new URLSearchParams({ q: query.trim(), limit: '7' }).toString();
            const center = cities.find(c => c[0] === city);
            if (center) { url.searchParams.set('lat', String(center[2])); url.searchParams.set('lon', String(center[3])); }
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) throw Error();
            const body = await response.json() as { features?: Feature[] };
            const matches = (body.features || []).flatMap(({properties:p,geometry}) => {
                const [lng,lat] = geometry?.coordinates || [];
                if (!p || !Number.isFinite(lat) || Math.abs(lat)>85 || !Number.isFinite(lng) || Math.abs(lng)>180) return [];
                const street = [p.street,p.housenumber].filter(Boolean).join(' ');
                const name = p.name || street || p.city;
                return name ? [{name,address:[street,p.district,p.city || p.town,p.state,p.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · '),lat,lng}] : [];
            });
            setResults(matches); if (!matches.length) setMessage('找不到地點，試試當地語言店名、完整地址，或到地圖上選點。');
        } catch { setMessage('地點搜尋暫時無法使用，仍可在地圖上選點。'); }
        finally { setBusy(false); }
    }
    return <div className="stop-search">
        <label className="field">搜尋店家、景點或地址<input value={query} maxLength={150} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}} placeholder="例如：清水寺、咖啡店名"/></label>
        <button className="button" type="button" onClick={()=>void search()} disabled={busy || query.trim().length<2}>{busy?'搜尋中…':'搜尋地點'}</button>
        <div role="status">{message}</div>
        {results.length>0 && <ul>{results.map((p,i)=><li key={i}><button type="button" className="button" onClick={e=>{
            setSelected(p);setResults([]);
            const title=e.currentTarget.form?.elements.namedItem('title');
            if(title instanceof HTMLInputElement) title.value=p.name.slice(0,160);
        }}><strong>{p.name}</strong><small>{p.address}</small></button></li>)}</ul>}
        <input type="hidden" name="lat" value={selected?.lat ?? lat ?? ''}/>
        <input type="hidden" name="lng" value={selected?.lng ?? lng ?? ''}/>
        <input type="hidden" name="address" value={(selected?.address ?? address ?? '').slice(0,500)}/>
        {(selected || lat != null && lng != null) && <p className="helper">已定位{(selected?.address || address) ? '：'+(selected?.address || address) : ''}</p>}
        <small className="helper">地點資料：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 貢獻者</a></small>
    </div>;
}
