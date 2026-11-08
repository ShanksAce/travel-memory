import type { RouteMode } from './transport';

export function transitDirections(origin: {lat:number;lng:number}, destination: {lat:number;lng:number}, mode:RouteMode='TRANSIT') {
    return 'https://www.google.com/maps/dir/?' + new URLSearchParams({
        api:'1', origin:origin.lat+','+origin.lng, destination:destination.lat+','+destination.lng, travelmode:{TRANSIT:'transit',DRIVE:'driving',WALK:'walking',BICYCLE:'bicycling'}[mode]
    });
}
