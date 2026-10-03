'use client';
import { useEffect, useState } from 'react';
export default function Avatar({ name, version = 0, removed = false, large = false }: {
    name: string; version?: number; removed?: boolean; large?: boolean;
}) {
    const source = '/api/account/avatar?v=' + version;
    const [loadedSource, setLoadedSource] = useState('');
    useEffect(() => {
        if (removed) return;
        let active = true;
        const image = new Image();
        image.onload = () => { if (active) setLoadedSource(source); };
        image.onerror = () => { if (active) setLoadedSource(''); };
        image.src = source;
        return () => { active = false; image.onload = null; image.onerror = null; };
    }, [source, removed]);
    const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() || 'U';
    return <span className={'avatar' + (large ? ' settings-avatar' : '')} aria-label={name + '的頭貼'}>
        {initial}
        {!removed && loadedSource === source && <img src={source} alt="" onError={() => setLoadedSource('')}/>}
    </span>;
}
