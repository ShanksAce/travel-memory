'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Bike, CarFront, Footprints, TrainFront, X } from 'lucide-react';
import type { Place, Itinerary } from '../lib/model';
import { readTransport, routeEndpoint, tokyoRouteOptions, routeModes, formatRouteDistance, type RouteMode, type RouteOption, type SavedTransport } from '../lib/transport';
import { transitDirections } from '../lib/directions';

export default function TransportSheet({ from, to, stop, demo, canQuery, onClose, onSave }: {
    from:Place; to:Place; stop:Itinerary; demo:boolean; canQuery:boolean; onClose:()=>void;
    onSave:(mode:string, plan:SavedTransport)=>Promise<void>;
}) {
    const ref=useRef<HTMLDialogElement>(null);
    const stored=readTransport(stop.transport_plan);
    const saved=stored?.from===routeEndpoint(from)&&stored.to===routeEndpoint(to) ? stored : null;
    const isExample=demo&&from.name==='上野站'&&to.name==='淺草寺';
    const [tab,setTab]=useState<'routes'|'manual'>(saved?.source==='manual'?'manual':'routes');
    const initialMode = (Object.keys(routeModes) as RouteMode[]).find(key=>routeModes[key]===stop.transport_mode) || 'TRANSIT';
    const [mode,setMode]=useState<RouteMode>(initialMode);
    const [selected,setSelected]=useState(()=>Math.max(0,tokyoRouteOptions[initialMode].findIndex(p=>p.label===saved?.option.label)));
    const [warnings,setWarnings]=useState<string[]>([]);
    const icons = {DRIVE:CarFront,WALK:Footprints,BICYCLE:Bike,TRANSIT:TrainFront};
    const [live,setLive]=useState<RouteOption[]|null>(null);
    const [busy,setBusy]=useState(false), [message,setMessage]=useState('');
    const [departure,setDeparture]=useState('');
    const [preview,setPreview]=useState<number|null>(null);
    useEffect(()=>{ref.current?.showModal();},[]);
    async function query() {
        setBusy(true);setMessage('');setLive(null);setPreview(null);setWarnings([]);
        try {
            const response=await fetch('/api/transit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
                origin:{lat:from.lat,lng:from.lng},destination:{lat:to.lat,lng:to.lng},
                mode, departureTime:mode==='TRANSIT' && departure ? new Date(departure).toISOString() : undefined,
            })});
            const body=await response.json() as {options?:RouteOption[];warnings?:string[];error?:string};
            if(!response.ok) throw Error(body.error||'目前無法查詢。');
            setLive(body.options||[]);setWarnings(body.warnings||[]);if(!body.options?.length)setMessage('查不到這種交通方式的路線，可試其他方式或到 Google Maps 查看。');
        } catch(e) {setMessage((e as Error).message);}
        finally{setBusy(false);}
    }
    async function save(mode:string,option:RouteOption,source:SavedTransport['source']) {
        setBusy(true);setMessage('');
        try {await onSave(mode,{from:routeEndpoint(from),to:routeEndpoint(to),source,option});}
        catch(e){setMessage((e as Error).message);setBusy(false);}
    }
    function manual(e:FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form=new FormData(e.currentTarget);
        const mode=String(form.get('mode')), value=String(form.get('minutes')), detail=String(form.get('instructions')).trim();
        void save(mode,{label:mode,minutes:value===''?null:Number(value),distanceMeters:form.get('distance')!==''?Math.round(Number(form.get('distance'))*1000):undefined,steps:detail?[{label:'搭乘備註',detail,minutes:null}]:[]},'manual');
    }
    const options=live || (isExample?tokyoRouteOptions[mode]:[]);
    return <dialog ref={ref} className="transport-sheet" aria-labelledby="transport-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
        <header><h2 id="transport-title">交通方式</h2><button type="button" className="icon-button" aria-label="關閉交通方式" onClick={onClose} disabled={busy}><X size={20}/></button></header>
        <div className="transport-body">
            <div className="transport-endpoints"><strong>{from.name}</strong><ArrowRight size={16}/><strong>{to.name}</strong></div>
            <nav className="row" aria-label="交通面板"><button className={'button'+(tab==='routes'?' primary':'')} aria-pressed={tab==='routes'} disabled={busy} onClick={()=>setTab('routes')}>路線方案</button><button className={'button'+(tab==='manual'?' primary':'')} aria-pressed={tab==='manual'} disabled={busy} onClick={()=>setTab('manual')}>自行註記</button></nav>
            {message && <p role="status">{message}</p>}
            {tab==='routes' && <>
                <nav className="transport-modes" aria-label="選擇交通方式">{(Object.keys(routeModes) as RouteMode[]).map(key=>{const Icon=icons[key];return <button key={key} className={'button'+(mode===key?' primary':'')} aria-pressed={mode===key} disabled={busy} onClick={()=>{setMode(key);setLive(null);setMessage('');setWarnings([]);setSelected(Math.max(0,tokyoRouteOptions[key].findIndex(p=>p.label===saved?.option.label)));setPreview(null);}}><Icon size={16}/>{routeModes[key]}</button>;})}</nav>
                {isExample&&!live && <p className="helper">東京示範：時間與距離為示範估算，非即時查詢。可選一個方案存回行程。</p>}
                {canQuery && !isExample && <div className="transport-query">{mode==='TRANSIT' && <label className="field">出發時間（選填，依裝置時區）<input type="datetime-local" value={departure} onChange={e=>setDeparture(e.target.value)}/></label>}<button className="button" disabled={busy} onClick={()=>void query()}>{busy?'查詢中…':'查詢'+routeModes[mode]+'路線'}</button></div>}
                {!canQuery&&!isExample && <p>你可以開啟 Google Maps 查詢實際路線，再自行註記想搭的路線。</p>}
                {live && <p className="helper">路線資料：<span translate="no">Google Maps</span>。即時結果僅供查看；可在「自行註記」留下自己的安排。</p>}
                {warnings.map((warning,i)=><p className="helper" key={i}>{warning}</p>)}
                <div className="transport-options">{options.map((p,i)=><article className={'transport-option'+(!live&&selected===i?' is-selected':'')} key={i}>
                    {!live && <label><input type="radio" name="route-choice" checked={selected===i} onChange={()=>setSelected(i)} disabled={busy}/> 選擇這個方案</label>}
                    <button className="text-button transport-option-title" aria-expanded={preview===i} onClick={()=>setPreview(preview===i?null:i)}>
                        {(()=>{const Icon=icons[mode];return <Icon size={18}/>;})()} {p.label} · {p.minutes===null?'時間未提供':p.minutes+' 分鐘'}{p.distanceMeters!=null?' · '+formatRouteDistance(p.distanceMeters):''}{p.fare?' · '+p.fare:''}
                    </button>
                    {preview===i && <ol>{p.steps.map((step,j)=><li key={j}><strong>{step.label}{step.minutes!==null?' · '+step.minutes+' 分':''}</strong><p>{step.detail}</p></li>)}</ol>}
                </article>)}</div>
                {isExample&&!live && <button className="button primary" disabled={busy} onClick={()=>void save(routeModes[mode],options[selected],'demo')}>儲存所選方案</button>}
            </>}
            {tab==='manual' && <form className="transport-query" onSubmit={manual}>
                <label className="field">交通方式<select name="mode" defaultValue={stop.transport_mode || '大眾運輸'}>{['大眾運輸','步行','開車','計程車','單車','飛機','其他'].map(m=><option key={m}>{m}</option>)}</select></label>
                <label className="field">預估分鐘數<input name="minutes" type="number" min={0} max={1440} defaultValue={stop.transport_minutes ?? ''}/></label>
                <label className="field">距離（公里，選填）<input name="distance" type="number" min={0} max={40000} step="0.001" defaultValue={saved?.option.distanceMeters!=null?saved.option.distanceMeters/1000:''}/></label>
                <label className="field">上車、下車與轉乘備註<textarea name="instructions" rows={3} maxLength={350} defaultValue={saved?.source==='manual'?saved.option.steps[0]?.detail:''}/></label>
                <button className="button primary" disabled={busy}>儲存交通註記</button>
            </form>}
            <a className="text-button" href={transitDirections(from,to,mode)} target="_blank" rel="noreferrer">在 Google Maps 查看路線 ↗</a>
        </div>
    </dialog>;
}
