'use client';
import { useEffect, useRef, useState } from 'react';
import type { Place } from '../lib/model';
import type * as Leaflet from 'leaflet';
export default function WorldMap({ places, onPick, onSelect }: {
    places: Place[];
    onPick?: (lat: number, lng: number) => void;
    onSelect?: (trip: string) => void;
}) {
    const holder = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), layer = useRef<Leaflet.LayerGroup | null>(null), pick = useRef(onPick), select = useRef(onSelect);
    pick.current = onPick;
    select.current = onSelect;
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
        return; layer.current.clearLayers(); for (const p of places) {
        const marker = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#e58d32', fillOpacity: 1 }).addTo(layer.current);
        const label = document.createElement('span');
        label.textContent = p.name + ' · ' + p.city;
        marker.bindTooltip(label);
        marker.on('click', e => { L.DomEvent.stopPropagation(e); select.current?.(p.trip_id); });
    } }); }, [ready, places]);
    return <div className="map-wrap"><div className="world-map" ref={holder} aria-label="互動世界地圖"/>{failed && <div className="map-warning">底圖暫時無法載入，已儲存的足跡仍可在下方查看。</div>}<button className="map-reset button" onClick={() => map.current?.setView([25, 70], 2)}>世界全覽</button></div>;
}
