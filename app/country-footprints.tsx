'use client';

import { useState } from 'react';
import type { Data } from '../lib/model';

export default function CountryFootprints({data, today, openTrip}: {
    data:Data; today:string; openTrip:(id:string, tab?:'photos'|'diaries')=>void;
}) {
    const [selected,setSelected]=useState('');
    const groups=new Map<string,typeof data.places>();
    for (const place of data.places) {
        if (place.date>today) continue;
        const country=place.country.trim();
        const places=groups.get(country) || [];
        places.push(place);groups.set(country,places);
    }
    if (!groups.size) return null;
    const countries=[...groups.keys()].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    const active=groups.has(selected)?selected:countries[0];
    const records=groups.get(active)!;
    const visits=new Set(records.map(place=>place.trip_id));
    const cities=[...new Set(records.map(place=>place.city))];
    return <section className="panel country-footprints">
        <div className="country-heading"><h2>國家足跡</h2><label className="field">選擇國家或地區
            <select value={active} onChange={event=>setSelected(event.target.value)}>
                {countries.map(country=><option key={country}>{country}</option>)}
            </select></label></div>
        <p>{visits.size} 趟旅行 · {cities.length} 座城市</p>
        <p>{cities.join('、')}</p>
        {data.trips.filter(trip=>visits.has(trip.id)).map(trip=><div className="country-trip" key={trip.id}>
            <button className="text-button" onClick={()=>openTrip(trip.id)}>{trip.title}</button>
            <time dateTime={trip.start_date}>{trip.start_date}</time>
            <button className="text-button" onClick={()=>openTrip(trip.id,'photos')}>{data.photos.filter(p=>p.trip_id===trip.id).length} 張照片</button>
            <button className="text-button" onClick={()=>openTrip(trip.id,'diaries')}>{data.diaries.filter(d=>d.trip_id===trip.id).length} 則日記</button>
        </div>)}
    </section>;
}
