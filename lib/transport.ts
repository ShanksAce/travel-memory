import { z } from 'zod';

export const routeModes = {DRIVE:'開車',WALK:'步行',BICYCLE:'單車',TRANSIT:'大眾運輸'} as const;
export type RouteMode = keyof typeof routeModes;
export const stepSchema = z.object({ label:z.string().max(250), detail:z.string().max(350), minutes:z.number().int().min(0).max(1440).nullable() });
export const routeOptionSchema = z.object({
    label:z.string().max(100), minutes:z.number().int().min(0).max(1440).nullable(),
    distanceMeters:z.number().int().min(0).max(40000000).optional(), fare:z.string().max(50).optional(), steps:z.array(stepSchema).max(40),
});
export const savedTransportSchema = z.object({
    from:z.string().max(230), to:z.string().max(230), source:z.enum(['demo','manual']), option:routeOptionSchema,
});
export type RouteOption = z.infer<typeof routeOptionSchema>;
export type SavedTransport = z.infer<typeof savedTransportSchema>;
export function routeEndpoint(stop:{name:string;lat:number;lng:number}) {return JSON.stringify([stop.name,stop.lat,stop.lng]);}
export function readTransport(value?:string) {
    try { const result=savedTransportSchema.safeParse(JSON.parse(value || '')); return result.success ? result.data : null; } catch { return null; }
}

export const tokyoTransitOptions: RouteOption[] = [
    {label:'東京 Metro 銀座線',minutes:20,distanceMeters:2400,steps:[
        {label:'步行至上野站月台',detail:'前往東京 Metro 銀座線月台。',minutes:5},
        {label:'搭銀座線往淺草',detail:'上野站上車 → 淺草站下車。',minutes:5},
        {label:'步行至淺草寺',detail:'經雷門與仲見世商店街前往淺草寺。',minutes:10},
    ]},
    {label:'銀座線・田原町下車',minutes:25,distanceMeters:2300,steps:[
        {label:'步行至上野站月台',detail:'前往東京 Metro 銀座線月台。',minutes:5},
        {label:'搭銀座線往淺草',detail:'上野站上車 → 田原町站下車。',minutes:4},
        {label:'步行至淺草寺',detail:'從田原町往雷門方向步行。',minutes:16},
    ]},
    {label:'全程步行',minutes:30,distanceMeters:2200,steps:[{label:'上野站 → 淺草寺',detail:'從上野往淺草方向走，沿途可經合羽橋一帶。',minutes:30}]},
];

export const tokyoRouteOptions: Record<RouteMode,RouteOption[]> = {
    TRANSIT:tokyoTransitOptions.slice(0,2),
    WALK:[tokyoTransitOptions[2]],
    DRIVE:[
        {label:'經淺草通',minutes:12,distanceMeters:2600,steps:[{label:'開車沿淺草通往淺草',detail:'接雷門通後步行進入寺院；估算不含停車時間。',minutes:12}]},
        {label:'經言問通',minutes:16,distanceMeters:3200,steps:[{label:'開車經言問通',detail:'從北側前往淺草寺周邊。',minutes:16}]},
    ],
    BICYCLE:[{label:'單車前往淺草',minutes:13,distanceMeters:2400,steps:[{label:'從上野騎至淺草',detail:'抵達後依現場指示停放單車。',minutes:13}]}],
};
export const formatRouteDistance = (meters:number) => meters < 1000 ? meters+' 公尺' : (meters/1000).toLocaleString('zh-TW',{maximumFractionDigits:1})+' 公里';
