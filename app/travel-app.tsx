'use client';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Compass, Plane, MapPin, Camera, BookOpen, Plus, ArrowUpRight, ArrowLeft, CalendarDays, ChevronRight, Check, CheckCircle2, Trash2, Pencil, X, Download, Search, Heart, LoaderCircle, ListChecks, LogOut, Settings2, Upload, ArrowRight } from 'lucide-react';
import WorldMap from './world-map';
import WorldGlobe from './world-globe';
import TripReplay from './trip-replay';
import CountryFootprints from './country-footprints';
import Avatar from './avatar';
import StopSearch from './stop-search';
import TransportSheet from './transport-sheet';
import { readTransport, routeEndpoint, formatRouteDistance } from '../lib/transport';
import { transportModes, type Itinerary, type Place } from '../lib/model';
import { timelineDays } from '../lib/timeline';
import {guestData, guestAction, guestUpload, exportGuest, importGuest, type GuestPhoto} from '../lib/guest';
import TravelTimeline from './travel-timeline';
import { photoNeedsReview } from '../lib/timeline';
import { type Data, type Trip, type Photo, emptyData, daysBetween, status, stats, today } from '../lib/model';
import { cities } from '../lib/cities';
const cover = 'https://upload.wikimedia.org/wikipedia/commons/d/dc/Skyscrapers_of_Shinjuku_2009_January_%28revised%29.jpg';
type View = 'world' | 'trips' | 'photos' | 'diaries';
type Entity = 'trip' | 'place' | 'diary' | 'itinerary' | 'task' | 'photo';
type Modal = {
    entity: Entity;
    record?: any;
    tripId?: string;
    lat?: number;
    lng?: number;
} | null;
const moods: Record<string, string> = { '開心': '☀️', '感動': '💛', '平靜': '🍃', '疲憊': '🌙', '驚喜': '✨' };
const navs = [
    { id: 'world', name: '我的世界' },
    { id: 'trips', name: '我的旅行' },
    { id: 'photos', name: '旅行相簿' },
    { id: 'diaries', name: '心情日記' },
] as const;
async function request(url: string, init?: RequestInit) { const r = await fetch(url, init); const d: any = await r.json(); if (!r.ok)
    throw Error(d.error || '操作失敗，請稍後重試。'); return d; }
export default function TravelApp({ user, showTokyoDemo = false }: {
    showTokyoDemo?: boolean;
    user: {
        name: string;
        email: string;
    } | null;
}) {
    const [data, setData] = useState<Data>(emptyData), [view, setView] = useState<View>('world'), [selected, setSelected] = useState<string | null>(null), [detailTab, setDetailTab] = useState('plan'), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [modal, setModal] = useState<Modal>(null), [search, setSearch] = useState(''), [filter, setFilter] = useState('全部'), [albumTrip, setAlbumTrip] = useState(''), [group, setGroup] = useState('date'), [photo, setPhoto] = useState<Photo | null>(null), [clock, setClock] = useState(today()), [uploadProgress, setUploadProgress] = useState('');
    const [guestCount, setGuestCount] = useState(0);
    useEffect(()=>{if(user) void guestData().then(d=>setGuestCount(d.trips.length)).catch(()=>{});},[user]);
    const [reviewOnly, setReviewOnly] = useState(false);
    const [planDate, setPlanDate] = useState(''), [pinItem, setPinItem] = useState<Itinerary | null>(null), [focusedPlace, setFocusedPlace] = useState<string | null>(null);
    const [transportStop, setTransportStop] = useState<string | null>(null);
    const [worldView, setWorldView] = useState<'2d'|'3d'>('3d');
    const [replayOpen, setReplayOpen] = useState(false);
    const dailyMap = useRef<HTMLDivElement>(null);
    const photoDay = useRef<string | undefined>(undefined);
    const [lookupRegion,setLookupRegion]=useState(false);
    const fileInput = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null), lightbox = useRef<HTMLDialogElement>(null), confirmDialog = useRef<HTMLDialogElement>(null), [pendingDelete, setPendingDelete] = useState<{
        entity: Entity;
        record: any;
    } | null>(null);
    const trip = data.trips.find(t => t.id === selected), summary = stats(data, clock);
    const next = data.trips.filter(t => t.end_date >= clock).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    const load = async () => { setError(''); try {
        setData(user ? await request('/api/data') : await guestData());
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } };
    useEffect(() => { if(showTokyoDemo && !user) { void guestAction({action:'seed'}).then(result=>{openTrip(result.id!);return load();}).catch(e=>{setError((e as Error).message);setLoading(false);}); } else void load(); const timer = setInterval(() => setClock(today()), 60000); return () => clearInterval(timer); }, []);
    useEffect(() => { if (message) {
        const t = setTimeout(() => setMessage(''), 4500);
        return () => clearTimeout(t);
    } }, [message]);
    useEffect(() => { if (modal)
        dialog.current?.showModal();
    else
        dialog.current?.close(); }, [modal]);
    useEffect(() => { if (photo)
        lightbox.current?.showModal();
    else
        lightbox.current?.close(); }, [photo]);
    useEffect(() => { if (pendingDelete)
        confirmDialog.current?.showModal();
    else
        confirmDialog.current?.close(); }, [pendingDelete]);
    const dataRef = useRef(data);
    dataRef.current = data;
    useEffect(() => { const context = (document as any).modelContext; if (!context?.registerTool)
        return; const controller = new AbortController(); const register = async () => { try {
        await context.registerTool({ name: 'list_travel_memories', title: '查看旅行手帳', description: 'Read the signed-in user’s saved trips and visit statistics. This does not modify records.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input: unknown) { if (input === null || typeof input !== 'object' || Object.keys(input).length)
                throw Error('Expected empty object'); return { trips: dataRef.current.trips, statistics: stats(dataRef.current) }; } }, { signal: controller.signal });
        await context.registerTool({ name: 'start_trip_creation', title: '開啟新增旅行', description: 'Open the visible new trip form. Does not save a trip.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input: unknown) { if (input === null || typeof input !== 'object' || Object.keys(input).length)
                throw Error('Expected empty object'); if (!user)
                throw Error('Sign in required'); setModal({ entity: 'trip' }); return { opened: true }; } }, { signal: controller.signal });
    }
    catch (e) {
        console.info('Optional browser tool unavailable', e);
    } }; void register(); return () => controller.abort(); }, [user]);
    function navigate(v: View) { setView(v); setSelected(null); setSearch(''); setFilter('全部'); window.scrollTo(0, 0); }
    function openTrip(id: string, tab: 'plan'|'photos'|'diaries' = 'plan') { setSelected(id); setDetailTab(tab); setPlanDate(''); setPinItem(null); setFocusedPlace(null); setView('trips'); setSearch(''); setError(''); window.scrollTo(0, 0); }
    function requireLogin() { return true; }
    function create(entity: Entity, tripId = selected || data.trips[0]?.id, extra: Partial<NonNullable<Modal>> = {}) { if (!requireLogin())
        return; if (entity !== 'trip' && !tripId) {
        setMessage('先建立一趟旅行，再加入紀錄。');
        setModal({ entity: 'trip' });
        return;
    } setError(''); setModal({ entity, tripId, ...extra }); }
    async function action(payload: unknown) { if (!user) return guestAction(payload); return request('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
    async function seed() { if (!requireLogin())
        return; setBusy(true); try {
        await action({ action: 'seed' });
        await load();
        setMessage('示範旅行已加入，可以自由編輯或刪除。');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!modal || busy)
            return;
        const fields = Object.fromEntries(new FormData(e.currentTarget));
        const tripId = String(fields.trip_id || modal.tripId || '');
        delete fields.trip_id;
        const values: any = { ...fields };
        if (modal.entity === 'place') {
            const city = cities.find(c => c[0] === String(values.city).trim() && c[1] === String(values.country).trim());
            values.name = values.city;
            values.lat = city?.[2] ?? 0;
            values.lng = city?.[3] ?? 0;
        }
        if (modal.entity === 'itinerary') {
            values.cost = Number(values.cost || 0);
            for (const key of ['lat','lng','transport_minutes']) values[key] = values[key] === '' ? null : Number(values[key]);
            if ((values.lat === null) !== (values.lng === null)) { setError('請一併填寫經度與緯度。'); return; }
        }
        if (modal.entity === 'task')
            values.done = modal.record?.done || 0;
        setBusy(true);
        setError('');
        try {
            const result = await action({ action: 'save', entity: modal.entity, id: modal.record?.id, trip_id: tripId, data: values });
            await load();
            setModal(null);
            setMessage('已儲存到你的行旅錄。');
            if (modal.entity === 'trip')
                openTrip(result.id);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function remove() { if (!pendingDelete || busy)
        return; setBusy(true); setError(''); try {
        const { entity, record } = pendingDelete;
        await action({ action: 'delete', entity, id: record.id, trip_id: record.trip_id });
        if (entity === 'trip' && selected === record.id)
            setSelected(null);
        setPhoto(null);
        setPendingDelete(null);
        await load();
        setMessage('已刪除紀錄。');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function toggleTask(task: any) { if (busy)
        return; setBusy(true); try {
        await action({ action: 'save', entity: 'task', id: task.id, trip_id: task.trip_id, data: { title: task.title, done: task.done ? 0 : 1 } });
        await load();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function upload(files: FileList | null) { const selectedDate = photoDay.current; photoDay.current = undefined; if (!files?.length)
        return; const target = trip?.id || albumTrip || data.trips[0]?.id; if (!target) {
        create('trip');
        return;
    } if (files.length > 20) {
        setError('每次最多上傳 20 張照片。');
        return;
    } setBusy(true); setError(''); let saved = 0; const failures: string[] = []; for (const file of Array.from(files)) {
        setUploadProgress('正在整理 ' + (saved + failures.length + 1) + ' / ' + files.length + ' 張照片');
        try {
            const form = new FormData();
            form.set('file', file);
            if(lookupRegion) form.set('lookup_region','1');
            form.set('trip_id', target);
            const t = data.trips.find(x => x.id === target)!;
            form.set('date', selectedDate || t.start_date);
            if (selectedDate) form.set('use_selected_date', '1');
            form.set('city', t.city);
            if (user) await request('/api/photos', { method: 'POST', body: form }); else await guestUpload(form);
            saved++;
        }
        catch (e) {
            failures.push(file.name + '：' + (e as Error).message);
        }
    } await load(); setBusy(false); setUploadProgress(''); if (fileInput.current)
        fileInput.current.value = ''; if (failures.length)
        setError('已儲存 ' + saved + ' 張；' + failures.join('；'));
    else
        setMessage(saved + ' 張照片已整理完成。'); }
    function uploadClick(date?: string) { if (!requireLogin())
        return; if (!data.trips.length) {
        create('trip');
        return;
    } photoDay.current = date; fileInput.current?.click(); }
    async function exportData() { if (!user) { try { const blob=new Blob([JSON.stringify(await exportGuest())],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="guest-travel-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); } catch(e){setError((e as Error).message);} return; } const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), note: '照片檔案請另外下載；本檔案包含所有文字紀錄及照片索引。', ...data }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'travel-memory-' + clock + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    const matchingTrips = data.trips.filter(t => (t.title + t.country + t.city).toLowerCase().includes(search.toLowerCase()) && (filter === '全部' || status(t, clock) === filter));
    const tripPhotos = data.photos.filter(p => p.trip_id === (trip?.id || albumTrip) || (!trip && !albumTrip));
    const filteredPhotos = tripPhotos.filter(p => (!reviewOnly || photoNeedsReview(p, data.trips.find(t => t.id === p.trip_id))) && ((p.country || '') + (p.region || '') + p.city + p.caption + p.filename + p.date).toLowerCase().includes(search.toLowerCase()));
    const photoGroups = Object.groupBy(filteredPhotos.sort((a, b) => b.date.localeCompare(a.date)), p => group === 'city' ? p.city : group === 'region' ? [p.country,p.region].filter(Boolean).join(' · ') || '地區未設定' : p.date);
    const visibleDiaries = data.diaries.filter(d => (!trip || d.trip_id === trip.id) && (d.title + d.body).includes(search)).sort((a, b) => b.date.localeCompare(a.date));
    const tripTasks = data.tasks.filter(t => t.trip_id === (trip?.id || next?.id));
    function photoGallery() { return <><div className="toolbar"><div className="segmented"><button className={group === 'date' ? 'on' : ''} onClick={() => setGroup('date')}>依日期</button><button className={group === 'city' ? 'on' : ''} onClick={() => setGroup('city')}>依城市</button><button className={group === 'region' ? 'on' : ''} onClick={() => setGroup('region')}>依地區</button></div>{!trip && <select aria-label="相簿旅行" value={albumTrip} onChange={e => setAlbumTrip(e.target.value)}><option value="">所有旅行</option>{data.trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}<button className={reviewOnly ? "button primary" : "button"} aria-pressed={reviewOnly} onClick={() => setReviewOnly(!reviewOnly)}>待確認照片 {tripPhotos.filter(p => photoNeedsReview(p, data.trips.find(t => t.id === p.trip_id))).length}</button><button className="button primary" disabled={busy} onClick={() => uploadClick()}><Upload size={16}/>上傳照片</button></div><label className="photo-lookup"><input type="checkbox" checked={lookupRegion} onChange={e=>setLookupRegion(e.target.checked)}/> 自動查國家與地區（上傳時將約略 GPS 座標送往 Photon）</label><p className="helper">待確認包含缺少拍攝日期、缺少 GPS、地點未辨識或日期超出旅行範圍的照片；修正後仍會保留原始資訊提示。每張上限 12 MB，支援 JPEG／PNG／WebP。自動讀取拍攝日期與 GPS；缺少資訊時使用旅行日期與城市，可隨時修正。{!trip && !albumTrip && data.trips.length > 0 && ' 上傳到：' + data.trips[0].title}</p>{Object.entries(photoGroups).map(([label, items]) => <section key={label}><div className="section-heading"><h3>{label}</h3><span className="muted">{items?.length} 張照片</span></div><div className="photo-grid">{items?.map(p => <button key={p.id} className="photo-card" onClick={() => setPhoto(p)}><img src={(p as GuestPhoto).local_url || '/api/photos/' + p.id} alt={p.caption || p.filename} loading="lazy"/><div className="photo-caption"><span>{p.caption || p.city}</span><small>{p.caption ? p.city + " · " : ""}{p.date}</small></div></button>)}</div></section>)}{!filteredPhotos.length && <Empty icon={Camera} title="把旅行的瞬間，留在這裡" text="選擇旅行並上傳照片，系統會依日期與城市整理相簿。" action="上傳第一張照片" onClick={() => uploadClick()}/>}</>; }
    const planDays = trip ? timelineDays(data, trip).filter(day => !day.outside) : [];
    const activeDay = planDays.find(day => day.date === planDate) || planDays.find(day => day.date === clock) || planDays[0];
    const route = activeDay?.itinerary.map((item): Place | null => {
        const point = item.lat != null && item.lng != null ? {lat:item.lat,lng:item.lng} : null;
        return trip && point ? { id:item.id, trip_id:trip.id, date:item.date, name:item.title, country:trip.country, city:trip.city, lat:point.lat, lng:point.lng } : null;
    }) || [];
    const transportIndex = activeDay?.itinerary.findIndex(item=>item.id===transportStop) ?? -1;
    const fromStop = route[transportIndex-1], toStop = route[transportIndex];
    const selectedTransportStop = activeDay?.itinerary[transportIndex];
    const visitedCities = data.places.flatMap(p => {
        const city = cities.find(c => c[0] === p.city && c[1] === p.country);
        return city ? [{...p,name:p.city,lat:city[2],lng:city[3]}] : [];
    });
    const routePoints = route.filter((point): point is Place => point !== null);
    const numbers = Object.fromEntries(route.flatMap((point,i) => point ? [[point.id,i+1]] : []));
    function diaryList() { return <><div className="toolbar"><p>有些風景，值得用文字再走一次。</p><button className="button primary" onClick={() => create('diary')}><Plus size={16}/>寫一篇日記</button></div><div className="diary-grid">{visibleDiaries.map(d => <article className="diary-card" key={d.id}><div className="diary-meta"><span>{moods[d.mood]} {d.mood}</span><time>{d.date}</time></div><h3>{d.title}</h3><p className="diary-body">{d.body}</p><footer><button className="text-button" onClick={() => openTrip(d.trip_id)}><MapPin size={14}/>{data.trips.find(t => t.id === d.trip_id)?.title}</button><Actions onEdit={() => create('diary', d.trip_id, { record: d })} onDelete={() => setPendingDelete({ entity: 'diary', record: d })}/></footer></article>)}</div>{!visibleDiaries.length && <Empty icon={BookOpen} title="今天的心情是什麼顏色？" text="記下途中遇見的人、風景，或一個讓你微笑的瞬間。" action="開始寫日記" onClick={() => create('diary')}/>}</>; }
    function tripCards(items: Trip[], showCreate = true) {
        return <div className={showCreate ? "trip-grid" : "trip-grid recent-trip-grid"}>
            {items.map(t => {
                const picture = data.photos.find(p => p.trip_id === t.id);
                const tripStatus = status(t, clock);
                return <button className="trip-card" key={t.id} onClick={() => openTrip(t.id)}>
                    <div className="trip-cover">
                        {picture ? <img src={(picture as GuestPhoto).local_url || '/api/photos/' + picture.id} alt="" loading="lazy"/>
                            : t.city === '東京' ? <img src={cover} alt="東京新宿天際線與富士山" loading="lazy" referrerPolicy="no-referrer"/>
                            : <div className="destination-type" aria-hidden="true"><span>{t.country}</span><strong>{t.city}</strong><Compass size={124} strokeWidth={.6}/></div>}
                    </div>
                    <div className="trip-info">
                        <span className={tripStatus === '即將出發' ? 'status future' : 'status'}>{tripStatus}</span>
                        <div><h3>{t.title}</h3><ArrowUpRight size={19} aria-hidden="true"/></div>
                        <p><MapPin size={15} aria-hidden="true"/>{t.country}・{t.city}</p>
                        <footer><span>{t.start_date.replaceAll('-', '.')} — {t.end_date.slice(5).replace('-', '.')}</span><span>{daysBetween(t.start_date, t.end_date) + 1} 天</span></footer>
                    </div>
                </button>;
            })}
            {showCreate && <button className="new-trip-card" onClick={() => create('trip')}>
                <span><Plus size={23} aria-hidden="true"/></span><h3>建立旅行</h3>
            </button>}
        </div>;
    }

    const isWorld = view === 'world' && !trip;
    const datedVisits = data.places.filter(p => p.date <= clock);
    const mapPlaces = visitedCities.filter(p => p.date <= clock);

    return <div className="shell">
        <header className="site-header">
            <div className="content-frame site-nav">
                <a className="site-brand" href="/" aria-label="行旅錄首頁"><Compass size={21} strokeWidth={1.8} aria-hidden="true"/>行旅錄</a>
                <nav className="site-links" aria-label="主要導覽">
                    {navs.map(n => <button type="button" key={n.id} aria-current={view === n.id ? 'page' : undefined} onClick={() => navigate(n.id)}>{n.name}</button>)}
                </nav>
                <div className="site-actions">
                    {user ? <>
                        <a className="account-profile" href="/settings" aria-label="開啟設定"><Avatar name={user.name}/><span>{user.name}</span></a>
                        <a className="icon-button" href="/signout-with-chatgpt?return_to=/" target="_top" aria-label="登出" title="登出"><LogOut size={17}/></a>
                    </> : <>
                        <a className="icon-button" href="/settings" aria-label="設定" title="設定"><Settings2 size={17}/></a>
                        <a className="button" href="/signin-with-chatgpt?return_to=/" target="_top">登入</a>
                    </>}
                    <button className="button primary" onClick={() => create('trip')}><Plus size={15} aria-hidden="true"/>建立旅行</button>
                </div>
            </div>
        </header>
        <main className={isWorld ? 'main world-main' : 'main content-frame'}>
            {user && guestCount > 0 && <div className="guest-banner">
                <span>此瀏覽器有 {guestCount} 趟訪客旅行。</span>
                <button className="text-button" disabled={busy} onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                        const count = await importGuest(user.email);
                        setGuestCount(0);
                        await load();
                        setMessage(count + ' 趟訪客旅行已匯入帳號。');
                    } catch (e) {
                        setError((e as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}>匯入我的帳號</button>
            </div>}
            {!user && <div className="guest-banner">
                <span><strong>訪客模式</strong> · 紀錄僅儲存在此瀏覽器。</span>
                <button className="text-button" onClick={() => void exportData()}>匯出備份</button>
            </div>}
            {error && !modal && !pendingDelete && <div className="error-banner" role="alert">{error}<button onClick={() => void load()}>重新載入</button></div>}
            {loading ? <div className="loading"><LoaderCircle className="spin"/>正在打開你的行旅錄…</div> : <>
                {!isWorld && !trip && <header className="page-heading"><h1>{navs.find(item => item.id === view)?.name}</h1></header>}
                {isWorld && <>
                    <section className="content-frame world-hero" aria-labelledby="world-title">
                        <header className="hero-copy">
                            <p className="hero-kicker">我的世界足跡</p>
                            <h1 id="world-title">世界很大，慢慢收藏。</h1>
                            <p>回頭看看走過的路，也期待下一次出發。</p>
                        </header>
                        <div className="segmented world-map-switch" role="group" aria-label="世界地圖顯示方式">
                            <button type="button" aria-pressed={worldView === '2d'} className={worldView === '2d' ? 'on' : ''} onClick={() => setWorldView('2d')}>2D</button>
                            <button type="button" aria-pressed={worldView === '3d'} className={worldView === '3d' ? 'on' : ''} onClick={() => setWorldView('3d')}>3D</button>
                        </div>
                        <div className={'world-visual world-visual-' + worldView}>
                            {worldView === '3d' ? <WorldGlobe places={mapPlaces} onSelect={openTrip} presentation="gallery"/>
                                : <WorldMap places={mapPlaces} onSelect={openTrip}/>}
                        </div>
                        {datedVisits.length > 0 && <div className="place-chips" aria-label="到訪足跡">
                            {datedVisits.map(p => <button key={p.id} onClick={() => openTrip(p.trip_id)}>
                                <MapPin size={14} aria-hidden="true"/>{p.country} · {p.city}
                            </button>)}
                        </div>}
                        <dl className="world-stats" aria-label="旅行統計">
                            {[
                                { value: summary.countries, label: '到訪國家／地區' },
                                { value: summary.cities, label: '到訪城市' },
                                { value: summary.days, label: '旅行天數' },
                                { value: summary.photos, label: '旅行照片' },
                            ].map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
                        </dl>
                    </section>

                    <section className="world-highlights" aria-labelledby="highlights-title">
                        <div className="content-frame highlights-content">
                            {next && <div className="next-travel">
                                <Plane size={21} strokeWidth={1.8} aria-hidden="true"/>
                                <div>
                                    <span>{status(next, clock) === '旅行中' ? '旅行中' : '下一趟旅行'}</span>
                                    <strong>{next.title}</strong>
                                </div>
                                <p>{next.city} · {next.start_date.replaceAll('-', '.')} 出發
                                    {next.start_date > clock && ' · 還有 ' + daysBetween(clock, next.start_date) + ' 天'}
                                </p>
                                <button className="button" onClick={() => openTrip(next.id)}>繼續規劃 <ArrowRight size={15}/></button>
                            </div>}
                            <div className="section-heading">
                                <h2 id="highlights-title">我的旅行收藏</h2>
                                {data.trips.length > 0 && <button className="text-button" onClick={() => navigate('trips')}>全部旅行 <ChevronRight size={16}/></button>}
                            </div>
                            {data.trips.length > 0 ? tripCards(data.trips.slice(0, 2), false) : <article className="first-story">
                                <img src={cover} alt="東京新宿天際線與富士山" loading="lazy" referrerPolicy="no-referrer"/>
                                <div>
                                    <h3>從第一趟旅行開始。</h3>
                                    <p>安排行程，把走過的地方、照片與日記收藏在一起。</p>
                                    <div className="row">
                                        <button className="button primary" onClick={() => create('trip')}>建立第一趟旅行</button>
                                        <button className="text-button" onClick={seed} disabled={busy}>載入東京範本 <ChevronRight size={16}/></button>
                                    </div>
                                </div>
                            </article>}
                        </div>
                    </section>
                    <CountryFootprints data={data} today={clock} openTrip={openTrip}/>
                </>}
        {view === 'trips' && !trip && <><div className="toolbar"><div className="segmented">{['全部', '即將出發', '旅行中', '回憶收藏'].map(f => <button className={filter === f ? 'on' : ''} key={f} onClick={() => setFilter(f)}>{f}</button>)}</div><SearchBox value={search} set={setSearch} placeholder="搜尋旅行、城市…"/></div>{tripCards(matchingTrips)}{data.trips.length === 0 && <button className="text-button demo-button" disabled={busy} onClick={seed}>載入示範旅行，試試完整流程</button>}</>}
        {view === 'photos' && !trip && <><SearchBox value={search} set={setSearch} placeholder="搜尋城市、日期、照片說明…"/>{photoGallery()}</>}
        {view === 'diaries' && !trip && <><SearchBox value={search} set={setSearch} placeholder="搜尋日記內容…"/>{diaryList()}</>}
            {trip && <><div className="detail-heading"><button className="text-button" onClick={() => navigate('trips')}><ArrowLeft size={16}/>返回所有旅行</button><div className="detail-title"><div><span className="pill">{status(trip, clock)}</span><h1>{trip.title}</h1><p><MapPin size={16}/>{trip.country} · {trip.city}<span>／</span>{trip.start_date} — {trip.end_date}<span>／</span>{daysBetween(trip.start_date, trip.end_date) + 1} 天</p></div><div className="row"><button className="button" onClick={()=>setReplayOpen(true)}>回放旅程</button><Actions onEdit={() => create('trip', trip.id, { record: trip })} onDelete={() => setPendingDelete({ entity: 'trip', record: trip })}/></div></div>{trip.description && <p className="trip-description">{trip.description}</p>}</div><div className="detail-tabs">{[['timeline', '旅行時間軸', CalendarDays], ['plan', '每日行程', ListChecks], ['places', '旅行足跡', MapPin], ['photos', '旅行相簿', Camera], ['diaries', '心情日記', BookOpen]].map(([id, label, Icon]: any) => <button key={id} className={detailTab === id ? 'active' : ''} onClick={() => { setDetailTab(id); setSearch(''); }}><Icon size={18}/>{label}</button>)}</div>
            {detailTab === 'timeline' && <TravelTimeline data={data} trip={trip} onPhoto={setPhoto} onAddDiary={date => create('diary', trip.id, { record: { date } })}/>}
            {detailTab === 'plan' && activeDay && <div className="planner-layout route-planner"><section className="daily-plan">
                <div className="section-heading"><h2>每日行程</h2><button className="button primary" onClick={() => create('itinerary', trip.id, { record: { date: activeDay.date } })}><Plus size={16}/>新增行程</button></div>
                <label className="field daily-date">查看哪一天<select value={activeDay.date} onChange={e => { setPlanDate(e.target.value); setPinItem(null); setFocusedPlace(null); }}>{planDays.map((day, i) => <option key={day.date} value={day.date}>第 {i+1} 天 · {day.date}{day.date===clock?'（今天）':''}</option>)}</select></label>
                <div className="route-workspace">
                <div className="panel route-map-panel" ref={dailyMap}><div className="route-map-heading"><h3>當日路線地圖</h3><span className="pill">{routePoints.length} 個已定位站點</span></div><WorldMap key={activeDay.date} places={routePoints} route={route} numbers={numbers} activeLeg={fromStop&&toStop?[fromStop,toStop]:undefined} fit onSelectPlace={point => {
                    setFocusedPlace(point.id); setPinItem(null);
                    document.getElementById('route-stop-'+point.id)?.scrollIntoView({block:'nearest'});
                }} focus={routePoints.find(p => p.id === focusedPlace)} onPick={(lat,lng) => { create('itinerary', trip.id, {lat,lng,record:{...pinItem,date:activeDay.date,lat,lng}}); setPinItem(null); }}/>
                <p className="helper" aria-live="polite">{pinItem ? '請在地圖點選「'+pinItem.title+'」的位置。' : '點地圖可加入新站。虛線表示站點順序，交通時間由你填寫。'}</p></div>
                <section className="day-card route-stop-list" aria-label="當日站點">{activeDay.itinerary.map((item,index) => {
                    const place = route[index], previous = route[index-1];
                    return <div key={item.id}>{index>0 && <div className="route-leg-links"><button className="route-leg text-button" onClick={()=>{if(previous && place)setTransportStop(item.id);else create('itinerary',trip.id,{record:item});}}>↓ {item.transport_mode || '選擇交通方案'}{item.transport_minutes != null ? ' · '+item.transport_minutes+' 分鐘' : ' · 時間未填'} ›</button>{previous&&place&&(()=>{const saved=readTransport(item.transport_plan);return saved?.from===routeEndpoint(previous)&&saved.to===routeEndpoint(place)?<small>{saved.option.label}{saved.option.distanceMeters!=null?' · '+formatRouteDistance(saved.option.distanceMeters):''}{saved.source==='demo'?'（示範）':''}</small>:null;})()}</div>}<div id={'route-stop-'+item.id} className={'plan-row'+(focusedPlace===item.id?' route-stop-active':'')}><time>{item.time || '彈性'}</time><div><span className="category">{item.category}</span><h3><span className="route-stop-number">{index+1}</span> {item.title}</h3>{item.address && <p className="helper">{item.address}</p>}{item.note && <p>{item.note}</p>}{item.cost > 0 && <small>預估 NT$ {item.cost.toLocaleString()}</small>}
                        <div className="row daily-actions"><button className="text-button" onClick={() => create('diary', trip.id, {record:{date:item.date,title:item.title}})}>記下這一站</button><button className="text-button" disabled={busy} onClick={() => uploadClick(item.date)}>加照片</button><button className="text-button" onClick={() => { if (place) { setFocusedPlace(place.id); setPinItem(null); } else setPinItem(item); dailyMap.current?.scrollIntoView({block:'nearest'}); }}>{place ? '地圖定位' : '在地圖標記'}</button></div>
                    </div><Actions onEdit={() => create('itinerary', trip.id, {record:item})} onDelete={() => setPendingDelete({entity:'itinerary',record:item})}/></div></div>;
                })}{<button className="blank-day" onClick={() => create('itinerary', trip.id, {record:{date:activeDay.date}})}>＋ 新增一站</button>}</section></div>
                <section className="panel daily-memories"><h3>當天的回憶</h3>{activeDay.diaries.map(d => <div className="memory-diary" key={d.id}><strong>{d.title}</strong><p>{d.body}</p></div>)}
                {activeDay.photos.length > 0 && <div className="photo-grid">{activeDay.photos.map(p => <button key={p.id} className="photo-card" onClick={() => setPhoto(p)}><img loading="lazy" src={(p as GuestPhoto).local_url || '/api/photos/'+p.id} alt={p.caption || p.filename}/></button>)}</div>}
                {!activeDay.diaries.length && !activeDay.photos.length && <p>還沒有照片或日記，可以從行程卡開始記錄。</p>}</section>
            </section><aside><section className="panel prep-card"><h2><ListChecks size={19}/>出發準備</h2><div className="prep-number">{tripTasks.length ? Math.round(tripTasks.filter(t => t.done).length / tripTasks.length * 100) : 0}<span>%</span></div><progress max={tripTasks.length || 1} value={tripTasks.filter(t => t.done).length}/><p>{tripTasks.filter(t => t.done).length} / {tripTasks.length} 項準備完成</p>{tripTasks.map(t => <div className="task-row" key={t.id}><button className={t.done ? 'task checked' : 'task'} disabled={busy} onClick={() => toggleTask(t)}><span className="checkbox">{!!t.done && <Check size={13}/>}</span>{t.title}</button><button className="icon-button" aria-label={'刪除準備項目 ' + t.title} onClick={() => setPendingDelete({ entity: 'task', record: t })}><X size={14}/></button></div>)}<button className="text-button" onClick={() => create('task')}><Plus size={16}/>新增準備項目</button></section><section className="budget-card"><span>旅行預估花費</span><strong>NT$ {data.itinerary.filter(p => p.trip_id === trip.id).reduce((n, p) => n + p.cost, 0).toLocaleString()}</strong><p>加總行程中的預算，以新台幣記錄。</p></section></aside></div>}
            {detailTab === 'places' && <><div className="toolbar"><p>記下哪一天到訪哪個國家或城市。店家和景點請放在每日行程。</p><button className="button primary" onClick={() => create('place')}><Plus size={16}/>新增足跡</button></div><div className="panel"><WorldMap places={visitedCities.filter(p => p.trip_id === trip.id)} fit/></div><div className="places-list">{data.places.filter(p => p.trip_id === trip.id).map(p => <div key={p.id} className="place-row"><MapPin /><div><h3>{p.country} · {p.city}</h3><p>{p.date}</p></div><Actions onEdit={() => create('place', trip.id, { record: p })} onDelete={() => setPendingDelete({ entity: 'place', record: p })}/></div>)}</div></>}
            {detailTab === 'photos' && photoGallery()}{detailTab === 'diaries' && diaryList()}</>}
        </>}
    <footer className="app-footer"><span>行旅錄 · 記所行，藏所感</span><a href="https://commons.wikimedia.org/wiki/File:Skyscrapers_of_Shinjuku_2009_January_(revised).jpg" target="_blank" rel="noreferrer">東京照片：Morio / Wikimedia Commons · CC BY-SA 3.0（版面裁切）</a></footer></main>
    {trip && fromStop && toStop && selectedTransportStop && <TransportSheet key={selectedTransportStop.id} from={fromStop} to={toStop} stop={selectedTransportStop} demo={showTokyoDemo || trip.id === 'demo-tokyo-route-2026'} canQuery={!!user} onClose={()=>setTransportStop(null)} onSave={async(mode,plan)=>{
        await action({action:'save',entity:'itinerary',id:selectedTransportStop.id,trip_id:trip.id,data:{...selectedTransportStop,transport_mode:mode,transport_minutes:plan.option.minutes,transport_plan:JSON.stringify(plan)}});
        setTransportStop(null); await load(); setMessage('已儲存站間交通。');
    }}/>}
    {trip && replayOpen && <TripReplay key={trip.id} trip={trip} data={data} onClose={()=>setReplayOpen(false)} onOpenDay={(date,stopId)=>{
        setReplayOpen(false);setPlanDate(date);setPinItem(null);setFocusedPlace(stopId || null);setDetailTab('plan');
        if(stopId) requestAnimationFrame(()=>document.getElementById('route-stop-'+stopId)?.scrollIntoView({block:'nearest'}));
    }}/>}
    <input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" ref={fileInput} onChange={e => void upload(e.target.files)}/>
    {(message || uploadProgress) && <div className="toast" role="status">{busy ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>} {uploadProgress || message}</div>}
    <dialog ref={dialog} className="form-dialog" onCancel={e => { if (busy)
        e.preventDefault();
    else
        setModal(null); }}>{modal && <><div className="dialog-header"><div><h2>{modal.record?.id ? '編輯' : '新增'}{({ trip: '旅行', place: '旅行足跡', diary: '心情日記', itinerary: '行程', task: '準備項目', photo: '照片資訊' })[modal.entity]}</h2></div><button className="icon-button" aria-label="關閉" disabled={busy} onClick={() => setModal(null)}><X /></button></div><form key={modal.entity + (modal.record?.id || 'new') + String(modal.lat)} onSubmit={save}><Fields modal={modal} trips={data.trips}/>{error && <div className="form-error" role="alert">{error}</div>}<div className="dialog-footer"><button type="button" className="button" disabled={busy} onClick={() => setModal(null)}>取消</button><button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>}儲存{modal.entity === 'trip' ? '旅行' : '紀錄'}</button></div></form></>}</dialog>
    <dialog ref={confirmDialog} className="form-dialog small-dialog" onCancel={() => { if (!busy)
        setPendingDelete(null); }}>{pendingDelete && <><h2>確定刪除{pendingDelete.entity === 'trip' ? '這趟旅行' : '這筆紀錄'}？</h2><p className="confirm-text">{pendingDelete.entity === 'trip' ? '此旅行的照片、日記、行程與足跡也會一併刪除。' : '刪除後無法復原。'}</p>{error && <div className="form-error">{error}</div>}<div className="dialog-footer"><button className="button" disabled={busy} onClick={() => setPendingDelete(null)}>保留</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? '刪除中…' : '確定刪除'}</button></div></>}</dialog>
    <dialog ref={lightbox} className="photo-dialog" onCancel={() => setPhoto(null)}>{photo && <><button className="photo-close icon-button" aria-label="關閉照片" onClick={() => setPhoto(null)}><X /></button><img className="lightbox-img" src={(photo as GuestPhoto).local_url || '/api/photos/' + photo.id} alt={photo.caption || photo.filename}/><div className="photo-detail"><h3>{photo.caption || photo.filename}</h3><p>{photo.date} · {photo.city}</p><p className="helper">{photo.source}</p>{photo.lat !== null && photo.lng !== null && <p className="helper">GPS：{photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}</p>}<div className="row"><a className="button" href={(photo as GuestPhoto).local_url || '/api/photos/' + photo.id} download={photo.filename}><Download size={16}/>原始照片</a><button className="button" onClick={() => { setPhoto(null); create('photo', photo.trip_id, { record: photo }); }}><Pencil size={15}/>修正資訊</button><button className="icon-button" aria-label="刪除照片" onClick={() => { setPhoto(null); setPendingDelete({ entity: 'photo', record: photo }); }}><Trash2 size={17}/></button></div></div></>}</dialog>
    </div>;
}
function SearchBox({ value, set, placeholder }: {
    value: string;
    set: (s: string) => void;
    placeholder: string;
}) { return <label className="search-box"><Search size={17}/><input value={value} onChange={e => set(e.target.value)} placeholder={placeholder} aria-label={placeholder}/></label>; }
function Actions({ onEdit, onDelete }: {
    onEdit: () => void;
    onDelete: () => void;
}) { return <div className="actions"><button className="icon-button" aria-label="編輯紀錄" onClick={onEdit}><Pencil size={16}/></button><button className="icon-button" aria-label="刪除紀錄" onClick={onDelete}><Trash2 size={16}/></button></div>; }
function Empty({ icon: Icon, title, text, action, onClick }: any) { return <div className="empty-state"><Icon size={40} strokeWidth={1.3}/><h3>{title}</h3><p>{text}</p><button className="button primary" onClick={onClick}>{action}</button></div>; }
function Fields({ modal, trips }: {
    modal: NonNullable<Modal>;
    trips: Trip[];
}) {
    const r = modal.record || {}, [tripId, setTripId] = useState(modal.tripId || trips[0]?.id || '');
    const t = trips.find(t => t.id === tripId);
    const field = (name: string, label: string, type = 'text', value: any = '', extra: any = {}) => <label key={name + tripId} className="field">{label}<input name={name} type={type} defaultValue={value} required maxLength={160} {...extra}/></label>;
    const date = () => field('date', '日期', 'date', r.date || t?.start_date || today(), modal.entity === 'photo' ? {} : { min: t?.start_date, max: t?.end_date });
    return <div className="fields">{modal.entity !== 'trip' && <label className="field">所屬旅行<select name="trip_id" value={tripId} onChange={e => setTripId(e.target.value)} disabled={!!r.id} required>{trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>{!!r.id && <input type="hidden" name="trip_id" value={tripId}/>}</label>}
    {modal.entity === 'trip' && <>{field('title', '旅行名稱', 'text', r.title || '', { placeholder: '例如：東京，慢慢走' })}<div className="field-pair">{field('country', '國家／地區', 'text', r.country || '', { placeholder: '日本', list: 'countries' })}{field('city', '主要城市', 'text', r.city || '', { placeholder: '東京', list: 'cities' })}</div><div className="field-pair">{field('start_date', '出發日期', 'date', r.start_date || today())}{field('end_date', '回程日期', 'date', r.end_date || today())}</div><label className="field">旅行備忘<textarea name="description" defaultValue={r.description || ''} rows={3} maxLength={3000} placeholder="這趟旅行，你最期待什麼？"/></label></>}
    {modal.entity === 'place' && <><div className="field-pair">{field('country', '國家／地區', 'text', r.country || t?.country || '', { list: 'countries' })}{field('city', '城市', 'text', r.city || t?.city || '', { list: 'cities' })}</div>{date()}</>}
    {modal.entity === 'diary' && <><div className="field-pair">{date()}<label className="field">今天的心情<select name="mood" defaultValue={r.mood || '開心'}>{Object.entries(moods).map(([m, i]) => <option key={m}>{m}</option>)}</select></label></div>{field('title', '日記標題', 'text', r.title || '', { placeholder: '一個想記住的瞬間' })}<label className="field">旅行心情<textarea name="body" defaultValue={r.body || ''} rows={7} required maxLength={12000} placeholder="今天的風景、遇見的人、心裡的小小感動…"/></label></>}
    {modal.entity === 'itinerary' && <><div className="field-pair">{date()}{field('time', '時間（選填）', 'time', r.time || '', { required: false })}</div><label className="field">類型<select name="category" defaultValue={r.category || '景點'}>{['景點', '交通', '住宿', '美食', '其他'].map(v => <option key={v}>{v}</option>)}</select></label>{field('title', '行程名稱', 'text', r.title || '', { placeholder: '例如：淺草散步' })}<StopSearch key={tripId} city={t?.city} lat={r.lat} lng={r.lng} address={r.address}/><div className="field-pair"><label className="field">從上一站的交通方式<select name="transport_mode" defaultValue={r.transport_mode || ''}><option value="">未指定</option>{transportModes.map(mode=><option key={mode}>{mode}</option>)}</select></label>{field('transport_minutes','從上一站的預估時間（分鐘）','number',r.transport_minutes ?? '',{required:false,min:0,max:1440,step:1})}</div>{field('cost', '預估花費（新台幣）', 'number', r.cost || 0, { min: 0, max: 10000000, step: 1 })}<label className="field">備忘<textarea name="note" defaultValue={r.note || ''} maxLength={3000} rows={3} placeholder="住宿地址、交通方式、訂位資訊…"/></label></>}
    {modal.entity === 'task' && field('title', '準備項目', 'text', r.title || '', { placeholder: '例如：訂機票、確認護照、買網卡' })}
    {modal.entity === 'photo' && <>{date()}{field('city', '城市／分類', 'text', r.city || '', { list: 'cities' })}{field('country','國家／地區（選填）','text',r.country || '',{required:false})}{field('region','行政區（選填）','text',r.region || '',{required:false})}<label className="field">照片說明<textarea name="caption" defaultValue={r.caption || ''} rows={3} maxLength={1000}/></label><p className="helper">原始拍攝資訊：{r.source}。修正分類不會改動原始照片。</p></>}
    <datalist id="cities">{cities.map(c => <option key={c[0]} value={c[0]}/>)}</datalist><datalist id="countries">{Array.from(new Set(cities.map(c => c[1]))).map(c => <option key={c} value={c}/>)}</datalist></div>;
}
