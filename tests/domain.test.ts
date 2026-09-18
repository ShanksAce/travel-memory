import test from 'node:test';
import assert from 'node:assert/strict';
import {tripInput,day,daysBetween,travelDays,stats,emptyData,status} from '../lib/model.ts';
import {nearestCity} from '../lib/cities.ts';
test('Leap day validation',()=>{assert.ok(day.safeParse('2028-02-29').success);assert.ok(!day.safeParse('2026-02-29').success)});
test('Date arithmetic ignores local DST',()=>{assert.equal(daysBetween('2026-03-07','2026-03-09'),2)});
test('Trip status includes departure and return dates',()=>{const t:any={start_date:'2026-01-01',end_date:'2026-01-03'};assert.equal(status(t,'2026-01-01'),'旅行中');assert.equal(status(t,'2026-01-03'),'旅行中');assert.equal(status(t,'2026-01-04'),'回憶收藏')});
test('Travel statistics de-duplicate overlapping days and exclude future days',()=>{assert.equal(travelDays([{start_date:'2026-01-01',end_date:'2026-01-03'},{start_date:'2026-01-03',end_date:'2026-01-05'}] as any,'2026-01-04'),4)});
test('Future check-ins do not count as visited cities',()=>{assert.equal(stats({...emptyData,places:[{country:'日本',city:'東京',date:'2030-01-01'}] as any},'2026-01-01').cities,0)});
test('GPS near Tokyo suggests Tokyo',()=>{assert.equal(nearestCity(35.68,139.69)?.city,'東京')});
test('GPS away from supported cities remains unclassified',()=>{assert.equal(nearestCity(0,0),null)});
test('Trips have bounded duration',()=>{assert.ok(!tripInput.safeParse({title:'long',country:'a',city:'b',start_date:'2026-01-01',end_date:'2028-01-01'}).success)});

