'use client';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Compass, Globe2, Plane, MapPin, Camera, BookOpen, Plus, ArrowUpRight, ArrowLeft, CalendarDays, ChevronRight, Check, CheckCircle2, Trash2, Pencil, X, Download, Search, Heart, LoaderCircle, ListChecks, LogOut, Upload, ArrowRight } from 'lucide-react';
import WorldMap from './world-map';
import { type Data, type Trip, type Photo, emptyData, daysBetween, status, stats, today } from '../lib/model';
import { cities, nearestCity } from '../lib/cities';
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
const navs = [{ id: 'world', name: '我的世界', icon: Globe2 }, { id: 'trips', name: '我的旅行', icon: Plane }, { id: 'photos', name: '旅行相簿', icon: Camera }, { id: 'diaries', name: '心情日記', icon: BookOpen }] as const;
async function request(url: string, init?: RequestInit) { const r = await fetch(url, init); const d: any = await r.json(); if (!r.ok)
    throw Error(d.error || '操作失敗，請稍後重試。'); return d; }
export default function TravelApp({ user }: {
    user: {
        name: string;
        email: string;
    } | null;
}) {
    const [data, setData] = useState<Data>(emptyData), [view, setView] = useState<View>('world'), [selected, setSelected] = useState<string | null>(null), [detailTab, setDetailTab] = useState('plan'), [loading, setLoading] = useState(!!user), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [modal, setModal] = useState<Modal>(null), [search, setSearch] = useState(''), [filter, setFilter] = useState('全部'), [albumTrip, setAlbumTrip] = useState(''), [group, setGroup] = useState('date'), [photo, setPhoto] = useState<Photo | null>(null), [clock, setClock] = useState(today()), [uploadProgress, setUploadProgress] = useState('');
    const fileInput = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null), lightbox = useRef<HTMLDialogElement>(null), confirmDialog = useRef<HTMLDialogElement>(null), [pendingDelete, setPendingDelete] = useState<{
        entity: Entity;
        record: any;
    } | null>(null);
    const trip = data.trips.find(t => t.id === selected), summary = stats(data, clock);
    const next = data.trips.filter(t => t.end_date >= clock).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    const load = async () => { if (!user)
        return; setError(''); try {
        setData(await request('/api/data'));
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } };
    useEffect(() => { void load(); const timer = setInterval(() => setClock(today()), 60000); return () => clearInterval(timer); }, []);
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
    function navigate(v: View) { setView(v); setSelected(null); setSearch(''); setFilter('全部'); }
    function openTrip(id: string) { setSelected(id); setDetailTab('plan'); setView('trips'); setSearch(''); setError(''); }
    function requireLogin() { if (!user) {
        window.location.href = '/signin-with-chatgpt?return_to=/';
        return false;
    } return true; }
    function create(entity: Entity, tripId = selected || data.trips[0]?.id, extra: Partial<NonNullable<Modal>> = {}) { if (!requireLogin())
        return; if (entity !== 'trip' && !tripId) {
        setMessage('先建立一趟旅行，再加入紀錄。');
        setModal({ entity: 'trip' });
        return;
    } setError(''); setModal({ entity, tripId, ...extra }); }
    async function action(payload: unknown) { return request('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
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
            values.lat = Number(values.lat);
            values.lng = Number(values.lng);
        }
        if (modal.entity === 'itinerary')
            values.cost = Number(values.cost || 0);
        if (modal.entity === 'task')
            values.done = modal.record?.done || 0;
        setBusy(true);
        setError('');
        try {
            const result = await action({ action: 'save', entity: modal.entity, id: modal.record?.id, trip_id: tripId, data: values });
            await load();
            setModal(null);
            setMessage('已儲存到你的旅途手帳。');
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
    async function upload(files: FileList | null) { if (!files?.length)
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
            form.set('trip_id', target);
            const t = data.trips.find(x => x.id === target)!;
            form.set('date', t.start_date);
            form.set('city', t.city);
            await request('/api/photos', { method: 'POST', body: form });
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
    function uploadClick() { if (!requireLogin())
        return; if (!data.trips.length) {
        create('trip');
        return;
    } fileInput.current?.click(); }
    function exportData() { const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), note: '照片檔案請另外下載；本檔案包含所有文字紀錄及照片索引。', ...data }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'travel-memory-' + clock + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    const matchingTrips = data.trips.filter(t => (t.title + t.country + t.city).toLowerCase().includes(search.toLowerCase()) && (filter === '全部' || status(t, clock) === filter));
    const tripPhotos = data.photos.filter(p => p.trip_id === (trip?.id || albumTrip) || (!trip && !albumTrip));
    const filteredPhotos = tripPhotos.filter(p => (p.city + p.caption + p.filename + p.date).toLowerCase().includes(search.toLowerCase()));
    const photoGroups = Object.groupBy(filteredPhotos.sort((a, b) => b.date.localeCompare(a.date)), p => group === 'city' ? p.city : p.date);
    const visibleDiaries = data.diaries.filter(d => (!trip || d.trip_id === trip.id) && (d.title + d.body).includes(search)).sort((a, b) => b.date.localeCompare(a.date));
    const tripTasks = data.tasks.filter(t => t.trip_id === (trip?.id || next?.id));
    function photoGallery() { return <><div className="toolbar"><div className="segmented"><button className={group === 'date' ? 'on' : ''} onClick={() => setGroup('date')}>依日期</button><button className={group === 'city' ? 'on' : ''} onClick={() => setGroup('city')}>依城市</button></div>{!trip && <select aria-label="相簿旅行" value={albumTrip} onChange={e => setAlbumTrip(e.target.value)}><option value="">所有旅行</option>{data.trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}<button className="button primary" disabled={busy} onClick={uploadClick}><Upload size={16}/>上傳照片</button></div><p className="helper">每張上限 12 MB，支援 JPEG／PNG／WebP。自動讀取拍攝日期與 GPS；缺少資訊時使用旅行日期與城市，可隨時修正。{!trip && !albumTrip && data.trips.length > 0 && ' 上傳到：' + data.trips[0].title}</p>{Object.entries(photoGroups).map(([label, items]) => <section key={label}><div className="section-heading"><h3>{label}</h3><span className="muted">{items?.length} 張照片</span></div><div className="photo-grid">{items?.map(p => <button key={p.id} className="photo-card" onClick={() => setPhoto(p)}><img src={'/api/photos/' + p.id} alt={p.caption || p.filename} loading="lazy"/><div><span>{p.city}</span><small>{p.date}</small></div></button>)}</div></section>)}{!filteredPhotos.length && <Empty icon={Camera} title="把旅行的瞬間，留在這裡" text="選擇旅行並上傳照片，系統會依日期與城市整理相簿。" action="上傳第一張照片" onClick={uploadClick}/>}</>; }
    function diaryList() { return <><div className="toolbar"><p>有些風景，值得用文字再走一次。</p><button className="button primary" onClick={() => create('diary')}><Plus size={16}/>寫一篇日記</button></div><div className="diary-grid">{visibleDiaries.map(d => <article className="diary-card" key={d.id}><div className="diary-meta"><span>{moods[d.mood]} {d.mood}</span><time>{d.date}</time></div><h3>{d.title}</h3><p className="diary-body">{d.body}</p><footer><button className="text-button" onClick={() => openTrip(d.trip_id)}><MapPin size={14}/>{data.trips.find(t => t.id === d.trip_id)?.title}</button><Actions onEdit={() => create('diary', d.trip_id, { record: d })} onDelete={() => setPendingDelete({ entity: 'diary', record: d })}/></footer></article>)}</div>{!visibleDiaries.length && <Empty icon={BookOpen} title="今天的心情是什麼顏色？" text="記下途中遇見的人、風景，或一個讓你微笑的瞬間。" action="開始寫日記" onClick={() => create('diary')}/>}</>; }
    function tripCards(items: Trip[]) { return <div className="trip-grid">{items.map((t, i) => { const pic = data.photos.find(p => p.trip_id === t.id); return <button className="trip-card" key={t.id} onClick={() => openTrip(t.id)}><div className={'trip-cover cover-' + (i % 3)}>{pic ? <img src={'/api/photos/' + pic.id} alt={t.title}/> : t.country === '日本' ? <img src={cover} alt="東京新宿天際線與富士山" referrerPolicy="no-referrer"/> : <div className="destination-type"><span>{t.country}</span><strong>{t.city}</strong><Compass size={96} strokeWidth={.5}/></div>}<span className={'status ' + (status(t, clock) === '即將出發' ? 'future' : '')}>{status(t, clock)}</span></div><div className="trip-info"><div><h3>{t.title}</h3><ArrowUpRight size={20}/></div><p><MapPin size={14}/>{t.country}・{t.city}</p><footer><span>{t.start_date.replaceAll('-', '.')} — {t.end_date.slice(5).replace('-', '.')}</span><span>{daysBetween(t.start_date, t.end_date) + 1} 天</span></footer></div></button>; })}<button className="new-trip-card" onClick={() => create('trip')}><span><Plus size={25}/></span><h3>下一段故事</h3><p>從一個想去的地方開始</p></button></div>; }
    return <div className="shell"><aside className="sidebar"><a className="brand" href="/"><Compass size={32}/><span>Travel Memory<small>旅途手帳</small></span></a><nav>{navs.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><n.icon />{n.name}</button>)}</nav><div className="side-note"><p>把走過的路，<br />變成值得收藏的故事。</p><div className="side-divider"/><span className="mini-label">MY TRAVEL JOURNAL</span><p>過去的回憶，未來的期待。</p></div>{user ? <div className="account"><span className="avatar">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><small>我的私人手帳</small></div><a href="/signout-with-chatgpt?return_to=/" target="_top" aria-label="登出"><LogOut size={17}/></a></div> : <a className="button primary" href="/signin-with-chatgpt?return_to=/" target="_top">登入我的手帳</a>}</aside><main className="main"><header className="topbar"><span>我的旅行空間{trip && ' / ' + trip.title}</span><div className="top-actions">{user && <a className="icon-button mobile-signout" href="/signout-with-chatgpt?return_to=/" target="_top" aria-label="登出"><LogOut size={17}/></a>}{user && <button className="icon-button" title="匯出旅行文字紀錄" aria-label="匯出旅行文字紀錄" onClick={exportData}><Download size={18}/></button>}<button className="button primary" onClick={() => create('trip')}><Plus size={18}/>建立旅行</button></div></header>
    {error && !modal && !pendingDelete && <div className="error-banner" role="alert">{error}<button onClick={() => void load()}>重新載入</button></div>}
        {loading ? <div className="loading"><LoaderCircle className="spin"/>正在打開你的旅途手帳…</div> : <>
        {!trip && <section className="page-heading"><span className="eyebrow">{view === 'world' ? 'YOUR WORLD, YOUR STORIES' : view === 'trips' ? 'COLLECT MOMENTS, NOT THINGS' : view === 'photos' ? 'LITTLE MOMENTS, BIG MEMORIES' : 'WORDS FROM THE ROAD'}</span><h1>{view === 'world' ? '世界很大，慢慢收藏。' : view === 'trips' ? '每趟旅行，都有一段故事。' : view === 'photos' ? '把瞬間，變成永遠。' : '寫給路上的自己。'}</h1><p>{view === 'world' ? '回頭看看走過的路，也期待下一次出發。' : view === 'trips' ? '從第一個計畫，到最後一張照片，都放在這裡。' : view === 'photos' ? '依日期和城市，翻閱那些值得記住的風景。' : '不只記錄去哪裡，也記得當時的心情。'}</p></section>}
        {view === 'world' && !trip && <><div className="stats">{[{ n: summary.countries, l: '去過的國家／地區', i: Globe2 }, { n: summary.cities, l: '留下足跡的城市', i: MapPin }, { n: summary.days, l: '已走過的旅行天數', i: CalendarDays }, { n: summary.photos, l: '收藏的旅行照片', i: Camera }].map(s => <div key={s.l}><s.i size={22}/><div><strong>{s.n}</strong><span>{s.l}</span></div></div>)}</div><div className="dashboard-grid"><section className="panel map-panel"><div className="panel-head"><h2>我的世界足跡</h2><span className="pill"><span className="dot"/> 已到訪</span></div><WorldMap places={data.places.filter(p => p.date <= clock)} onPick={(lat, lng) => create('place', undefined, { lat, lng })} onSelect={openTrip}/><div className="map-footer"><MapPin size={15}/><span>點選地圖留下足跡；點選標記，重溫旅行。</span></div></section><section className="countdown"><Plane className="countdown-plane" size={38} strokeWidth={1}/><span className="eyebrow">THE NEXT CHAPTER</span>{next ? <><span className="countdown-destination">{next.country} · {next.city}</span><h2>{next.title}</h2><div className="count-number">{Math.max(0, daysBetween(clock, next.start_date))}<span>天</span></div><p>{status(next, clock) === '旅行中' ? '正在旅途中，記得收藏今天。' : '距離下一次出發'}</p><div className="countdown-bottom"><span>{next.start_date.replaceAll('-', '.')} 出發</span><button onClick={() => openTrip(next.id)}>繼續規劃 <ArrowRight size={15}/></button></div></> : <><h2>下一站，<br />你想去哪裡？</h2><p>把期待變成計畫。</p><button className="button light" onClick={() => create('trip')}>開始我的旅途 <ArrowRight size={17}/></button></>}</section></div>{data.places.length > 0 && <div className="place-chips">{data.places.filter(p => p.date <= clock).map(p => <button key={p.id} onClick={() => openTrip(p.trip_id)}><MapPin size={14}/>{p.city} · {p.name}</button>)}</div>}<div className="section-heading"><h2>我的旅行收藏 <span className="count-badge">{data.trips.length}</span></h2><button className="text-button" onClick={() => navigate('trips')}>全部旅行 <ChevronRight size={16}/></button></div>{data.trips.length ? tripCards(data.trips.slice(0, 2)) : <div className="first-story"><img src={cover} alt="東京新宿天際線與富士山" referrerPolicy="no-referrer"/><div><span className="eyebrow">START YOUR COLLECTION</span><h2>還沒出發，也能先開始期待。</h2><p>建立旅行、安排每天的行程，再把路上的照片與心情收藏起來。</p><div className="row"><button className="button primary" onClick={() => create('trip')}><Plus size={16}/>建立第一趟旅行</button><button className="text-button" onClick={seed} disabled={busy}>載入示範旅行 <ArrowUpRight size={16}/></button></div></div></div>}</>}
        {view === 'trips' && !trip && <><div className="toolbar"><div className="segmented">{['全部', '即將出發', '旅行中', '回憶收藏'].map(f => <button className={filter === f ? 'on' : ''} key={f} onClick={() => setFilter(f)}>{f}</button>)}</div><SearchBox value={search} set={setSearch} placeholder="搜尋旅行、城市…"/></div>{tripCards(matchingTrips)}{data.trips.length === 0 && <button className="text-button demo-button" disabled={busy} onClick={seed}>載入示範旅行，試試完整流程</button>}</>}
        {view === 'photos' && !trip && <><SearchBox value={search} set={setSearch} placeholder="搜尋城市、日期、照片說明…"/>{photoGallery()}</>}
        {view === 'diaries' && !trip && <><SearchBox value={search} set={setSearch} placeholder="搜尋日記內容…"/>{diaryList()}</>}
            {trip && <><div className="detail-heading"><button className="text-button" onClick={() => setSelected(null)}><ArrowLeft size={16}/>返回所有旅行</button><div className="detail-title"><div><span className="pill">{status(trip, clock)}</span><h1>{trip.title}</h1><p><MapPin size={16}/>{trip.country} · {trip.city}<span>／</span>{trip.start_date} — {trip.end_date}<span>／</span>{daysBetween(trip.start_date, trip.end_date) + 1} 天</p></div><Actions onEdit={() => create('trip', trip.id, { record: trip })} onDelete={() => setPendingDelete({ entity: 'trip', record: trip })}/></div>{trip.description && <p className="trip-description">{trip.description}</p>}</div><div className="detail-tabs">{[['plan', '行程規劃', ListChecks], ['places', '旅行足跡', MapPin], ['photos', '旅行相簿', Camera], ['diaries', '心情日記', BookOpen]].map(([id, label, Icon]: any) => <button key={id} className={detailTab === id ? 'active' : ''} onClick={() => { setDetailTab(id); setSearch(''); }}><Icon size={18}/>{label}</button>)}</div>
            {detailTab === 'plan' && <div className="planner-layout"><section><div className="section-heading"><h2>每天，留一點驚喜</h2><button className="button primary" onClick={() => create('itinerary')}><Plus size={16}/>新增行程</button></div>{Array.from({ length: daysBetween(trip.start_date, trip.end_date) + 1 }, (_, i) => new Date(Date.parse(trip.start_date + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)).map((date, i) => <section className="day-card" key={date}><div className="day-header"><span>DAY {String(i + 1).padStart(2, '0')}</span><h3>{date}</h3><button className="icon-button" aria-label={'新增 ' + date + ' 行程'} onClick={() => create('itinerary', trip.id, { record: { date } })}><Plus size={17}/></button></div>{data.itinerary.filter(p => p.trip_id === trip.id && p.date === date).sort((a, b) => a.time.localeCompare(b.time)).map(p => <div key={p.id} className="plan-row"><time>{p.time || '彈性'}</time><div><span className="category">{p.category}</span><h3>{p.title}</h3>{p.note && <p>{p.note}</p>}{p.cost > 0 && <small>預估 NT$ {p.cost.toLocaleString()}</small>}</div><Actions onEdit={() => create('itinerary', trip.id, { record: p })} onDelete={() => setPendingDelete({ entity: 'itinerary', record: p })}/></div>)}{!data.itinerary.some(p => p.trip_id === trip.id && p.date === date) && <button className="blank-day" onClick={() => create('itinerary', trip.id, { record: { date } })}>＋ 這一天想去哪裡？</button>}</section>)}</section><aside><section className="panel prep-card"><h2><ListChecks size={19}/>出發準備</h2><div className="prep-number">{tripTasks.length ? Math.round(tripTasks.filter(t => t.done).length / tripTasks.length * 100) : 0}<span>%</span></div><progress max={tripTasks.length || 1} value={tripTasks.filter(t => t.done).length}/><p>{tripTasks.filter(t => t.done).length} / {tripTasks.length} 項準備完成</p>{tripTasks.map(t => <div className="task-row" key={t.id}><button className={t.done ? 'task checked' : 'task'} disabled={busy} onClick={() => toggleTask(t)}><span className="checkbox">{!!t.done && <Check size={13}/>}</span>{t.title}</button><button className="icon-button" aria-label={'刪除準備項目 ' + t.title} onClick={() => setPendingDelete({ entity: 'task', record: t })}><X size={14}/></button></div>)}<button className="text-button" onClick={() => create('task')}><Plus size={16}/>新增準備項目</button></section><section className="budget-card"><span>旅行預估花費</span><strong>NT$ {data.itinerary.filter(p => p.trip_id === trip.id).reduce((n, p) => n + p.cost, 0).toLocaleString()}</strong><p>加總行程中的預算，以新台幣記錄。</p></section></aside></div>}
            {detailTab === 'places' && <><div className="toolbar"><p>點選地圖，記下你到過的地方。</p><button className="button primary" onClick={() => create('place')}><Plus size={16}/>新增足跡</button></div><div className="panel"><WorldMap places={data.places.filter(p => p.trip_id === trip.id)} onPick={(lat, lng) => create('place', trip.id, { lat, lng })}/></div><div className="places-list">{data.places.filter(p => p.trip_id === trip.id).map(p => <div key={p.id} className="place-row"><MapPin /><div><h3>{p.name}</h3><p>{p.country} · {p.city} ／ {p.date}</p><small>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</small></div><Actions onEdit={() => create('place', trip.id, { record: p })} onDelete={() => setPendingDelete({ entity: 'place', record: p })}/></div>)}</div></>}
            {detailTab === 'photos' && photoGallery()}{detailTab === 'diaries' && diaryList()}</>}
        </>}
    <footer className="app-footer"><span>Travel Memory · 旅途手帳</span><a href="https://commons.wikimedia.org/wiki/File:Skyscrapers_of_Shinjuku_2009_January_(revised).jpg" target="_blank" rel="noreferrer">東京照片：Morio / Wikimedia Commons · CC BY-SA 3.0（版面裁切）</a></footer></main>
    <input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" ref={fileInput} onChange={e => void upload(e.target.files)}/>
    {(message || uploadProgress) && <div className="toast" role="status">{busy ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>} {uploadProgress || message}</div>}
    <dialog ref={dialog} className="form-dialog" onCancel={e => { if (busy)
        e.preventDefault();
    else
        setModal(null); }}>{modal && <><div className="dialog-header"><div><span className="eyebrow">A NEW PIECE OF YOUR JOURNEY</span><h2>{modal.record?.id ? '編輯' : '新增'}{({ trip: '旅行', place: '旅行足跡', diary: '心情日記', itinerary: '行程', task: '準備項目', photo: '照片資訊' })[modal.entity]}</h2></div><button className="icon-button" aria-label="關閉" disabled={busy} onClick={() => setModal(null)}><X /></button></div><form key={modal.entity + (modal.record?.id || 'new') + String(modal.lat)} onSubmit={save}><Fields modal={modal} trips={data.trips}/>{error && <div className="form-error" role="alert">{error}</div>}<div className="dialog-footer"><button type="button" className="button" disabled={busy} onClick={() => setModal(null)}>取消</button><button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>}儲存{modal.entity === 'trip' ? '旅行' : '紀錄'}</button></div></form></>}</dialog>
    <dialog ref={confirmDialog} className="form-dialog small-dialog" onCancel={() => { if (!busy)
        setPendingDelete(null); }}>{pendingDelete && <><h2>確定刪除{pendingDelete.entity === 'trip' ? '這趟旅行' : '這筆紀錄'}？</h2><p className="confirm-text">{pendingDelete.entity === 'trip' ? '此旅行的照片、日記、行程與足跡也會一併刪除。' : '刪除後無法復原。'}</p>{error && <div className="form-error">{error}</div>}<div className="dialog-footer"><button className="button" disabled={busy} onClick={() => setPendingDelete(null)}>保留</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? '刪除中…' : '確定刪除'}</button></div></>}</dialog>
    <dialog ref={lightbox} className="photo-dialog" onCancel={() => setPhoto(null)}>{photo && <><button className="photo-close icon-button" aria-label="關閉照片" onClick={() => setPhoto(null)}><X /></button><img className="lightbox-img" src={'/api/photos/' + photo.id} alt={photo.caption || photo.filename}/><div className="photo-detail"><h3>{photo.caption || photo.filename}</h3><p>{photo.date} · {photo.city}</p><p className="helper">{photo.source}</p>{photo.lat !== null && photo.lng !== null && <p className="helper">GPS：{photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}</p>}<div className="row"><a className="button" href={'/api/photos/' + photo.id} download={photo.filename}><Download size={16}/>原始照片</a><button className="button" onClick={() => { setPhoto(null); create('photo', photo.trip_id, { record: photo }); }}><Pencil size={15}/>修正資訊</button><button className="icon-button" aria-label="刪除照片" onClick={() => { setPhoto(null); setPendingDelete({ entity: 'photo', record: photo }); }}><Trash2 size={17}/></button></div></div></>}</dialog>
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
    const t = trips.find(t => t.id === tripId), city = nearestCity(modal.lat || 0, modal.lng || 0);
    const field = (name: string, label: string, type = 'text', value: any = '', extra: any = {}) => <label key={name + tripId} className="field">{label}<input name={name} type={type} defaultValue={value} required maxLength={160} {...extra}/></label>;
    const date = () => field('date', '日期', 'date', r.date || t?.start_date || today(), modal.entity === 'photo' ? {} : { min: t?.start_date, max: t?.end_date });
    return <div className="fields">{modal.entity !== 'trip' && <label className="field">所屬旅行<select name="trip_id" value={tripId} onChange={e => setTripId(e.target.value)} disabled={!!r.id} required>{trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>{!!r.id && <input type="hidden" name="trip_id" value={tripId}/>}</label>}
    {modal.entity === 'trip' && <>{field('title', '旅行名稱', 'text', r.title || '', { placeholder: '例如：東京，慢慢走' })}<div className="field-pair">{field('country', '國家／地區', 'text', r.country || '', { placeholder: '日本', list: 'countries' })}{field('city', '主要城市', 'text', r.city || '', { placeholder: '東京', list: 'cities' })}</div><div className="field-pair">{field('start_date', '出發日期', 'date', r.start_date || today())}{field('end_date', '回程日期', 'date', r.end_date || today())}</div><label className="field">旅行備忘<textarea name="description" defaultValue={r.description || ''} rows={3} maxLength={3000} placeholder="這趟旅行，你最期待什麼？"/></label></>}
    {modal.entity === 'place' && <>{field('name', '地點名稱', 'text', r.name || '', { placeholder: '例如：淺草寺' })}<div className="field-pair">{field('country', '國家／地區', 'text', r.country || city?.country || t?.country || '', { list: 'countries' })}{field('city', '城市', 'text', r.city || city?.city || t?.city || '', { list: 'cities' })}</div>{date()}<div className="field-pair">{field('lat', '緯度', 'number', r.lat ?? modal.lat ?? '', { min: -85, max: 85, step: 'any' })}{field('lng', '經度', 'number', r.lng ?? modal.lng ?? '', { min: -180, max: 180, step: 'any' })}</div><label className="field">快速選擇城市中心（可再調整）<select defaultValue="" onChange={e => { const c = cities[Number(e.target.value)]; if (!c)
        return; const f = e.target.form!; for (const [k, v] of Object.entries({ city: c[0], country: c[1], lat: c[2], lng: c[3] })) {
        (f.elements.namedItem(k) as HTMLInputElement).value = String(v);
    } }}><option value="" disabled>選擇城市…</option>{cities.map((c, i) => <option key={c[0]} value={i}>{c[1]} · {c[0]}</option>)}</select></label><p className="helper">也可以關閉視窗，在地圖上點選精確位置。城市中心僅作為定位起點。</p></>}
    {modal.entity === 'diary' && <><div className="field-pair">{date()}<label className="field">今天的心情<select name="mood" defaultValue={r.mood || '開心'}>{Object.entries(moods).map(([m, i]) => <option key={m}>{m}</option>)}</select></label></div>{field('title', '日記標題', 'text', r.title || '', { placeholder: '一個想記住的瞬間' })}<label className="field">旅行心情<textarea name="body" defaultValue={r.body || ''} rows={7} required maxLength={12000} placeholder="今天的風景、遇見的人、心裡的小小感動…"/></label></>}
    {modal.entity === 'itinerary' && <><div className="field-pair">{date()}{field('time', '時間（選填）', 'time', r.time || '', { required: false })}</div><label className="field">類型<select name="category" defaultValue={r.category || '景點'}>{['景點', '交通', '住宿', '美食', '其他'].map(v => <option key={v}>{v}</option>)}</select></label>{field('title', '行程名稱', 'text', r.title || '', { placeholder: '例如：淺草散步' })}{field('cost', '預估花費（新台幣）', 'number', r.cost || 0, { min: 0, max: 10000000, step: 1 })}<label className="field">備忘<textarea name="note" defaultValue={r.note || ''} maxLength={3000} rows={3} placeholder="住宿地址、交通方式、訂位資訊…"/></label></>}
    {modal.entity === 'task' && field('title', '準備項目', 'text', r.title || '', { placeholder: '例如：訂機票、確認護照、買網卡' })}
    {modal.entity === 'photo' && <>{date()}{field('city', '城市／分類', 'text', r.city || '', { list: 'cities' })}<label className="field">照片說明<textarea name="caption" defaultValue={r.caption || ''} rows={3} maxLength={1000}/></label><p className="helper">原始拍攝資訊：{r.source}。修正分類不會改動原始照片。</p></>}
    <datalist id="cities">{cities.map(c => <option key={c[0]} value={c[0]}/>)}</datalist><datalist id="countries">{Array.from(new Set(cities.map(c => c[1]))).map(c => <option key={c} value={c}/>)}</datalist></div>;
}
