'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { Place } from '../lib/model';

type Vector = [number, number, number];
type View = { lng: number; lat: number; zoom: number };


type Marker = { place: Place; vector: Vector };
const initial: View = { lng: 115, lat: 23, zoom: 1 };
const radians = Math.PI / 180;

function vector(lng: number, lat: number): Vector {
    const x = lng * radians, y = lat * radians;
    return [Math.cos(y) * Math.sin(x), Math.sin(y), Math.cos(y) * Math.cos(x)];
}

const grid: Vector[][] = [];
for (let lat = -60; lat <= 60; lat += 30)
    grid.push(Array.from({ length: 121 }, (_, i) => vector(i * 3 - 180, lat)));
for (let lng = -180; lng < 180; lng += 30)
    grid.push(Array.from({ length: 61 }, (_, i) => vector(lng, i * 3 - 90)));

export default function WorldGlobe({ places, onSelect, flightTarget }: { places: Place[]; onSelect: (tripId: string) => void; flightTarget?: {lat:number;lng:number} }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const view = useRef(initial);
    const points = useRef<Marker[]>([]);
    const land = useRef<{ dots: Vector[]; coasts: Vector[][] } | null>(null);
    const visible = useRef<{ x: number; y: number; place: Place }[]>([]);
    const drag = useRef<{ id: number; x: number; y: number; distance: number } | null>(null);
    const flying = useRef(false);
    const [dragging, setDragging] = useState(false);
    const [failed, setFailed] = useState(false);
    const repaint = useRef<() => void>(() => {});
    const move = useCallback((lng: number, lat: number, zoom = 0) => {
        const old = view.current;
        view.current = { lng: (old.lng+lng)%360, lat: Math.max(-90,Math.min(90,old.lat+lat)), zoom: Math.max(.7,Math.min(4,old.zoom*Math.exp(zoom))) };
        repaint.current();
    }, []);
    useEffect(() => {
        points.current = places.map(place => ({ place, vector: vector(place.lng, place.lat) }));
        repaint.current();
    }, [places]);

    useEffect(() => {
        const node = canvas.current;
        const context = node?.getContext('2d');
        if (!node || !context) { setFailed(true); return; }
        const controller = new AbortController();
        const surface = document.createElement('canvas');
        const surfaceContext = surface.getContext('2d');
        let surfaceFrame: ImageData | undefined;
        let texture: ImageData | undefined;
        let frame = 0;

        function paintSurface(a: number, b: number, c: number, d: number, w: number, h: number, radius: number, dpr: number) {
            if (!texture || !surfaceContext) return;
            // Render only the visible viewport, even when zoomed deep into the globe.
            const density = Math.min(dpr, (drag.current || flying.current ? 640 : 1280) / Math.max(w,h));
            const columns = Math.max(1, Math.round(w*density));
            const rows = Math.max(1, Math.round(h*density));
            if (surface.width !== columns || surface.height !== rows || !surfaceFrame) {
                surface.width = columns;
                surface.height = rows;
                surfaceFrame = surfaceContext.createImageData(columns,rows);
            }
            const {width, height, data} = texture;
            const pixels = surfaceFrame.data;
            for (let row = 0; row < rows; row++) {
                const up = (.5 - (row + .5)/rows)*h/radius;
                for (let col = 0; col < columns; col++) {
                    const right = ((col + .5)/columns - .5)*w/radius;
                    const length = right * right + up * up;
                    const i = (row*columns+col)*4;
                    if (length >= 1) { pixels[i+3] = 0; continue; }
                    const depth = Math.sqrt(1 - length);
                    const north = up*c + depth*d;
                    const forward = depth*c - up*d;
                    const longitude = Math.atan2(right*a + forward*b, forward*a - right*b);
                    const tx = Math.floor((longitude/(2*Math.PI) + .5)*width) % width;
                    const ty = Math.min(height-1, Math.floor((.5-Math.asin(Math.max(-1, Math.min(1,north)))/Math.PI)*height));
                    const offset = (ty*width+tx)*4;
                    const light = .59 + .48*Math.max(0, depth*.87 + up*.31 - right*.32);
                    const haze = Math.pow(1-depth, 3);
                    pixels[i] = data[offset]*light + 13*haze;
                    pixels[i+1] = data[offset+1]*light + 41*haze;
                    pixels[i+2] = data[offset+2]*light + 65*haze + 10;
                    pixels[i+3] = Math.min(255, (1-length)*radius*density*255);
                }
            }
            surfaceContext.putImageData(surfaceFrame,0,0);
        }
        function draw() {
            if (!node || !context) return;
            const w = node.clientWidth, h = node.clientHeight;
            if (!w || !h) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (node.width !== Math.round(w * dpr)) node.width = Math.round(w * dpr);
            if (node.height !== Math.round(h * dpr)) node.height = Math.round(h * dpr);
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
            context.clearRect(0, 0, w, h);
            const { lng, lat, zoom } = view.current;
            const cx = w / 2, cy = h / 2, radius = Math.min(w, h) * .41 * zoom;
            const a = Math.cos(lng*radians), b = Math.sin(lng*radians);
            const c = Math.cos(lat*radians), d = Math.sin(lat*radians);
            function project([x,y,z]: Vector) {
                const forward = x*b + z*a;
                return { x: cx + radius*(x*a-z*b), y: cy - radius*(y*c-forward*d), depth: y*d+forward*c };
            }
            const halo = context.createRadialGradient(cx,cy,radius*.92,cx,cy,radius*1.17);
            halo.addColorStop(0,'#39eaff00'); halo.addColorStop(.34,'#4198e857'); halo.addColorStop(1,'#39eaff00');
            context.fillStyle = halo; context.fillRect(0,0,w,h);
            const ocean = context.createRadialGradient(cx-radius*.35,cy-radius*.4,0,cx,cy,radius*1.16);
            ocean.addColorStop(0,'#16465b'); ocean.addColorStop(.65,'#0a2339'); ocean.addColorStop(1,'#081322');
            context.beginPath(); context.arc(cx,cy,radius,0,2*Math.PI);
            context.fillStyle = ocean; context.fill();
            context.save(); context.clip();
            function trace(lines: Vector[][], color: string, width: number) {
                if (!context) return;
                context.beginPath();
                for (const line of lines) {
                    let started = false;
                    for (const point of line) {
                        const p = project(point);
                        if (p.depth < 0) { started = false; continue; }
                        if (started) context.lineTo(p.x,p.y); else context.moveTo(p.x,p.y);
                        started = true;
                    }
                }
                context.lineWidth = width; context.strokeStyle = color; context.stroke();
            }
            if (texture && surfaceContext) {
                paintSurface(a,b,c,d,w,h,radius,dpr);
                context.drawImage(surface,0,0,w,h);
            } else trace(grid,'#51dbff35',.75);
            if (!texture && land.current) {
                context.fillStyle = '#75efe0a6';
                for (const point of land.current.dots) {
                    const p = project(point);
                    if (p.depth > 0) {
                        const size = .65 + p.depth*.8;
                        context.fillRect(p.x-size/2,p.y-size/2,size,size);
                    }
                }
                trace(land.current.coasts,'#64ffdfa9',.8);
            }
            context.restore();
            context.beginPath(); context.arc(cx,cy,radius,0,2*Math.PI);
            context.strokeStyle = '#89cbfab0'; context.lineWidth = 1.25; context.stroke();
            visible.current = [];
            const labelBounds: {left:number; right:number; y:number}[] = [];
            context.font = '600 12px system-ui, sans-serif';
            context.textBaseline = 'middle';
            for (const marker of points.current) {
                const p = project(marker.vector);
                if (p.depth < .08) continue;
                visible.current.push({ ...p, place: marker.place });
                context.beginPath(); context.arc(p.x,p.y,7,0,2*Math.PI);
                context.fillStyle = '#ffb86d50'; context.fill();
                context.beginPath(); context.arc(p.x,p.y,3.5,0,2*Math.PI);
                context.fillStyle = '#ffd096'; context.fill();
                if (p.depth < .24 || p.y<37 || p.y>h-46) continue;
                const name = marker.place.city;
                const width = context.measureText(name).width;
                const x = p.x+10+width < w-8 ? p.x+10 : p.x-10-width;
                if (x<8 || labelBounds.some(l=>Math.abs(l.y-p.y)<17 && l.left<x+width+5 && l.right>x-5)) continue;
                labelBounds.push({left:x,right:x+width,y:p.y});
                context.strokeStyle='#07182b'; context.lineWidth=3; context.lineJoin='round';
                context.strokeText(name,x,p.y);
                context.fillStyle='#f1f7ff'; context.fillText(name,x,p.y);
            }
        }
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
        repaint.current = schedule;
        const observer = new ResizeObserver(schedule);
        observer.observe(node);
        function wheel(event: WheelEvent) {
            if (!event.deltaY || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            event.preventDefault();
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node!.clientHeight : 1;
            const delta = Math.max(-140, Math.min(140, event.deltaY * unit));
            move(0, 0, -delta * .002);
        }
        node.addEventListener('wheel', wheel, { passive: false });
        const image = new Image();
        image.onload = () => {
            const bitmap = document.createElement('canvas');
            bitmap.width = image.naturalWidth; bitmap.height = image.naturalHeight;
            const pixels = bitmap.getContext('2d');
            if (!pixels || !surfaceContext) return;
            pixels.drawImage(image,0,0);
            texture = pixels.getImageData(0,0,bitmap.width,bitmap.height);
            setFailed(false);
            schedule();
        };
        image.onerror = () => { if (!land.current) setFailed(true); };
        image.src = '/images/earth-blue-marble.jpg';
        fetch('/globe-land.json', { signal: controller.signal }).then(response => {
            if (!response.ok) throw Error('Geography unavailable');
            return response.json() as Promise<{dots: [number,number][]; coasts: [number,number][][]}>;
        }).then(data => {
            land.current = { dots: data.dots.map(([x,y])=>vector(x,y)), coasts: data.coasts.map(line=>line.map(([x,y])=>vector(x,y))) };
            setFailed(false);
            schedule();
        }).catch(() => { if (!controller.signal.aborted && !texture) setFailed(true); });
        schedule();
        return () => { node.removeEventListener('wheel', wheel); observer.disconnect(); controller.abort(); image.onload = image.onerror = null; cancelAnimationFrame(frame); repaint.current = () => {}; };
    }, [move]);

    const targetLng = flightTarget?.lng, targetLat = flightTarget?.lat;
    useEffect(() => {
        if (targetLng === undefined || targetLat === undefined) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce') return;
        const start = view.current;
        const delta = ((targetLng-start.lng+540)%360)-180;
        const begin = performance.now();
        let frame = 0;
        flying.current = true;
        function fly(now: number) {
            const progress = Math.min(1,(now-begin)/1350);
            const eased = progress*progress*(3-2*progress);
            view.current = {lng:start.lng+delta*eased,lat:start.lat+(targetLat!-start.lat)*eased,zoom:1+.9*eased};
            flying.current = progress<1;
            repaint.current();
            if (flying.current) frame=requestAnimationFrame(fly);
        }
        frame=requestAnimationFrame(fly);
        return () => { flying.current=false; cancelAnimationFrame(frame); };
    }, [targetLng,targetLat]);

    return <div className="world-globe">
        <canvas ref={canvas} className={dragging?'is-dragging':undefined} tabIndex={0}
            aria-label="互動三維地球。方向鍵旋轉，加號與減號縮放。"
            onKeyDown={e=>{
                const keys: Record<string, [number,number,number?]> = { ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,12],ArrowDown:[0,-12],'+':[0,0,.26],'=':[0,0,.26],'-':[0,0,-.26] };
                const action=keys[e.key]; if(action){e.preventDefault();move(...action);}
            }}
            onPointerDown={e=>{
                if (!e.isPrimary || e.button !== 0) return;
                drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0};
                e.currentTarget.setPointerCapture(e.pointerId); setDragging(true);
            }}
            onPointerMove={e=>{
                const start=drag.current; if(start?.id!==e.pointerId)return;
                const dx=e.clientX-start.x, dy=e.clientY-start.y;
                start.distance+=Math.hypot(dx,dy); start.x=e.clientX; start.y=e.clientY;
                move(-dx*.42/view.current.zoom,dy*.42/view.current.zoom);
            }}
            onPointerUp={e=>{
                const start=drag.current; if(start?.id!==e.pointerId)return;
                drag.current=null; setDragging(false); repaint.current();
                if(start.distance>5)return;
                const box=e.currentTarget.getBoundingClientRect();
                let nearest: Place | undefined, distance=13;
                for(const marker of visible.current) {
                    const gap=Math.hypot(e.clientX-box.left-marker.x,e.clientY-box.top-marker.y);
                    if(gap<distance){nearest=marker.place;distance=gap;}
                }
                if(nearest)onSelect(nearest.trip_id);
            }}
            onLostPointerCapture={()=>{drag.current=null;setDragging(false);repaint.current();}}
        />
        <a className="flight-map-credit" href="https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/" target="_blank" rel="noreferrer">NASA · Blue Marble</a>
        <div className="globe-controls" aria-label="地球控制">
            <button type="button" aria-label="放大地球" onClick={()=>move(0,0,.26)}><Plus size={17}/></button>
            <button type="button" aria-label="縮小地球" onClick={()=>move(0,0,-.26)}><Minus size={17}/></button>
            <button type="button" aria-label="重設地球視角" onClick={()=>{view.current=initial;repaint.current();}}><RotateCcw size={16}/></button>
        </div>
        {failed && <p className="globe-warning">地球圖資暫時無法顯示，你仍可從下方開啟旅行紀錄。</p>}
    </div>;
}
