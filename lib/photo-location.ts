export type PhotoLocation = {country:string;city:string;region:string};

export async function reversePhotoLocation(lat:number,lng:number):Promise<PhotoLocation|null> {
    try {
        const url=new URL('https://photon.komoot.io/reverse');
        url.search=new URLSearchParams({lat:lat.toFixed(2),lon:lng.toFixed(2),limit:'1',radius:'10'}).toString();
        const response=await fetch(url,{signal:AbortSignal.timeout(2500)});
        if(!response.ok) return null;
        const body=await response.json() as {features?:{properties?:Record<string,unknown>}[]};
        const p=body.features?.[0]?.properties;
        if(!p) return null;
        const label=(...keys:string[])=>keys.map(k=>p[k]).find((v):v is string=>typeof v==='string'&&!!v.trim())?.trim().slice(0,160)||'';
        const country=label('country'), city=label('city','town','village','municipality'), region=label('district','locality','county','state');
        return country && city ? {country,city,region} : null;
    } catch {return null;}
}
