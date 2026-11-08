import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { checkOrigin, identity, ApiError, failure } from '../../../lib/server';
import { routeModes, routeOptionSchema } from '../../../lib/transport';

const point = z.object({lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180)});
const input = z.object({ origin:point, destination:point, mode:z.enum(['DRIVE','WALK','BICYCLE','TRANSIT']).default('TRANSIT'), departureTime:z.string().datetime({offset:true}).optional() });
const minutes = (duration?:string) => {
    const n = duration && /^\d+(\.\d+)?s$/.test(duration) ? Math.round(Number(duration.slice(0,-1))/60) : null;
    return n !== null && n <= 1440 ? n : null;
};
type Step = {
    staticDuration?:string;
    navigationInstruction?:{instructions?:string};
    transitDetails?:{headsign?:string;transitLine?:{name?:string;nameShort?:string};
        stopDetails?:{departureStop?:{name?:string};arrivalStop?:{name?:string}};
        localizedValues?:{departureTime?:{time?:{text?:string}};arrivalTime?:{time?:{text?:string}}}};
};
type Route = {duration?:string;distanceMeters?:number;description?:string;warnings?:string[];localizedValues?:{transitFare?:{text?:string}};legs?:{steps?:Step[]}[]};

export async function POST(req:Request) {
    try {
        checkOrigin(req);
        await identity();
        if (!env.GOOGLE_ROUTES_API_KEY) throw new ApiError(503,'目前未啟用站內即時查詢，可使用 Google Maps 查詢。');
        if (Number(req.headers.get('content-length')) > 2048) throw new ApiError(413,'查詢資料過大。');
        const {origin,destination,departureTime,mode}=input.parse(await req.json());
        const waypoint=(p:z.infer<typeof point>)=>({location:{latLng:{latitude:p.lat,longitude:p.lng}}});
        const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
            method:'POST',signal:AbortSignal.timeout(10000),
            headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_ROUTES_API_KEY,
                'X-Goog-FieldMask':'routes.duration,routes.distanceMeters,routes.description,routes.warnings,routes.localizedValues.transitFare,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails'},
            body:JSON.stringify({origin:waypoint(origin),destination:waypoint(destination),travelMode:mode,computeAlternativeRoutes:mode!=='WALK'&&mode!=='BICYCLE',languageCode:'zh-TW',departureTime:mode==='TRANSIT'?departureTime:undefined}),
        });
        if(!response.ok) throw new ApiError(502,'即時交通查詢暫時失敗，請改用 Google Maps。');
        const body=await response.json() as {routes?:Route[]};
        const options=(body.routes||[]).slice(0,5).flatMap((route,index)=>{
            const legs=route.legs?.flatMap(leg=>leg.steps||[])||[];
            const names=legs.flatMap(s=>s.transitDetails?.transitLine?.name || s.transitDetails?.transitLine?.nameShort || []);
            const result=routeOptionSchema.safeParse({
                label:(names.join(' → ') || route.description || routeModes[mode]+'方案 '+(index+1)).slice(0,100), minutes:minutes(route.duration), distanceMeters:route.distanceMeters,
                fare:route.localizedValues?.transitFare?.text?.slice(0,50),
                steps:legs.slice(0,40).map(s=>{
                    const t=s.transitDetails;
                    if(!t) return {label:mode==='TRANSIT'?'步行':routeModes[mode],detail:(s.navigationInstruction?.instructions || '沿路線前進').slice(0,350),minutes:minutes(s.staticDuration)};
                    const from=t.stopDetails?.departureStop?.name, to=t.stopDetails?.arrivalStop?.name;
                    return {label:(t.transitLine?.name||t.transitLine?.nameShort||'搭乘大眾運輸').slice(0,250),
                        detail:[from,to].filter(Boolean).join(' → ').concat(t.headsign?' · 往 '+t.headsign:'',t.localizedValues?.departureTime?.time?.text?' · '+t.localizedValues.departureTime.time.text:'' ).slice(0,350),minutes:minutes(s.staticDuration)};
                }),
            });
            return result.success ? [result.data] : [];
        });
        return Response.json({options,warnings:[...new Set((body.routes||[]).flatMap(r=>r.warnings||[]))]},{headers:{'Cache-Control':'no-store'}});
    } catch(e) {
        if (e instanceof DOMException && (e.name==='TimeoutError'||e.name==='AbortError')) return failure(new ApiError(504,'查詢逾時，請稍後再試。'));
        return failure(e);
    }
}
