'use client';
import { useEffect, useRef, useState } from 'react';
import type { Place } from '../lib/model';
import type * as Leaflet from 'leaflet';
export default function WorldMap({ places, onPick, onSelect, onSelectPlace, fit = false, focus, route, numbers, activeLeg }: {
    places: Place[];
    fit?: boolean;
    route?: (Place | null)[];
    activeLeg?: [Place,Place];
    numbers?: Record<string, number>;
    focus?: Place | null;
    onPick?: (lat: number, lng: number) => void;
    onSelectPlace?: (place: Place) => void;
    onSelect?: (trip: string) => void;
}) {
    const holder = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), layer = useRef<Leaflet.LayerGroup | null>(null), pick = useRef(onPick), select = useRef(onSelect), selectPlace = useRef(onSelectPlace);
    pick.current = onPick;
    select.current = onSelect;
    selectPlace.current = onSelectPlace;
    const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
    useEffect(() => {
        let disposed = false;
        import('leaflet').then(L => {
            if (disposed || !holder.current)
                return;
            const m = L.map(holder.current, { worldCopyJump: true, minZoom: 2, maxZoom: 18, scrollWheelZoom: false }).setView([25, 70], 2);
            map.current = m;
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).on('tileerror', () => setFailed(true)).addTo(m);
            layer.current = L.layerGroup().addTo(m);
            m.on('click', e => pick.current?.(Number(e.latlng.lat.toFixed(5)), Number(((e.latlng.lng + 540) % 360 - 180).toFixed(5))));
            setReady(true);
            const observer = new ResizeObserver(() => m.invalidateSize());
            observer.observe(holder.current);
            (m as any)._resizeObserver = observer;
        }).catch(() => setFailed(true));
        return () => { disposed = true; (map.current as any)?._resizeObserver?.disconnect(); map.current?.remove(); map.current = null; setReady(false); };
    }, []);
    useEffect(() => { if (!ready || !layer.current)
        return; import('leaflet').then(L => { if (!layer.current || !map.current)
        return; layer.current.clearLayers();
    for (let i = 1; i < (route?.length || 0); i++) {
        const a = route?.[i-1], b = route?.[i];
        if (a && b) {
            const active = a.id === activeLeg?.[0].id && b.id === activeLeg?.[1].id;
            L.polyline([[a.lat,a.lng],[b.lat,b.lng]], {color:active?'#1769aa':'#347878',weight:active?6:4,opacity:activeLeg&&!active?.35:1,dashArray:'7 6',interactive:false}).addTo(layer.current);
        }
    }
    for (const p of places) {
        const marker = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 3, fillColor: focus?.id === p.id ? '#347878' : '#e58d32', fillOpacity: 1 }).addTo(layer.current);
        const label = document.createElement('span');
        label.textContent = p.name + ' · ' + p.city;
        if (numbers?.[p.id]) marker.bindTooltip(String(numbers[p.id]), {permanent:true,direction:'center',className:'route-number'});
        if (!numbers?.[p.id]) marker.bindTooltip(label);
        marker.on('click', e => { L.DomEvent.stopPropagation(e); selectPlace.current?.(p); select.current?.(p.trip_id); });
    }
    if (activeLeg) map.current.fitBounds(activeLeg.map(p=>[p.lat,p.lng]),{padding:[35,35],maxZoom:15});
    else if (focus) map.current.setView([focus.lat, focus.lng], 15);
    else if (fit && places.length) map.current.fitBounds(L.latLngBounds(places.map(p => [p.lat, p.lng])), { padding: [24, 24], maxZoom: 14 });
    }); }, [ready, places, fit, focus, route, numbers]);
    return <div className="map-wrap"><div className="world-map" ref={holder} aria-label="互動世界地圖"/>{failed && <div className="map-warning">底圖暫時無法載入，已儲存的足跡仍可在下方查看。</div>}<button className="map-reset button" onClick={() => { if (fit && places.length && map.current) map.current.fitBounds(places.map(p => [p.lat,p.lng]), {padding:[24,24],maxZoom:14}); else map.current?.setView([25,70],2); }}>{fit && places.length ? '全部站點' : '世界全覽'}</button></div>;
}
