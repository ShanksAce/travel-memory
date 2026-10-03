import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineDays, photoNeedsReview } from '../lib/timeline.ts';
import { emptyData, type Trip, type Photo } from '../lib/model.ts';
const trip = { id:'one', start_date:'2026-01-01', end_date:'2026-01-03' } as Trip;
test('Timeline preserves empty days, isolates trips and includes outside photos', () => {
 const data = {...emptyData, photos:[{id:'p',trip_id:'one',date:'2025-12-31'}, {id:'other',trip_id:'two',date:'2026-02-01'}] as Photo[]};
 const days=timelineDays(data,trip);
 assert.deepEqual(days.map(d=>d.date), ['2025-12-31','2026-01-01','2026-01-02','2026-01-03']);
 assert.equal(days[0].outside,true); assert.equal(days[1].photos.length,0);
});
test('Timeline sorts timed plans before flexible plans without mutating input', () => {
 const itinerary=[{id:'a',trip_id:'one',date:'2026-01-01',time:''},{id:'b',trip_id:'one',date:'2026-01-01',time:'15:00'},{id:'c',trip_id:'one',date:'2026-01-01',time:'08:00'}] as any;
 assert.deepEqual(timelineDays({...emptyData,itinerary},trip)[0].itinerary.map(p=>p.id),['c','b','a']);
 assert.equal(itinerary[0].id,'a');
});
test('Photo review uses current dates and missing metadata including valid zero coordinates', () => {
 const photo={date:'2026-01-02',source:'EXIF 拍攝日期',city:'城市',lat:0,lng:0} as Photo;
 assert.equal(photoNeedsReview(photo,trip),false);
 assert.equal(photoNeedsReview({...photo,lat:null},trip),true);
 assert.equal(photoNeedsReview({...photo,date:'2026-01-04'},trip),true);
 assert.equal(photoNeedsReview({...photo,source:'旅行日期'},trip),true);
});
