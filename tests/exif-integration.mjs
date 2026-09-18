import sharp from 'sharp';
import exifr from 'exifr'; const {parse}=exifr;
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
// Deterministic synthetic JPEG. Coordinates are test data, not a user's location.
const plain=await sharp({create:{width:64,height:64,channels:3,background:'#146c79'}}).jpeg().toBuffer();
const tiff=Buffer.alloc(192);tiff.write('II',0);tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);tiff.writeUInt16LE(2,8);
function entry(offset,tag,type,count,value){tiff.writeUInt16LE(tag,offset);tiff.writeUInt16LE(type,offset+2);tiff.writeUInt32LE(count,offset+4);tiff.writeUInt32LE(value,offset+8)}
entry(10,0x8769,4,1,38);entry(22,0x8825,4,1,56);
tiff.writeUInt16LE(1,38);entry(40,0x9003,2,20,110);
tiff.writeUInt16LE(4,56);entry(58,1,2,2,78);entry(70,2,5,3,130);entry(82,3,2,2,69);entry(94,4,5,3,154);
tiff.write('2026:01:02 14:30:00\0',110,'ascii');
for(const [off,nums] of [[130,[35,40,30]],[154,[139,41,30]]])for(let i=0;i<3;i++){tiff.writeUInt32LE(nums[i],off+i*8);tiff.writeUInt32LE(1,off+i*8+4)}
const exif=Buffer.concat([Buffer.from('Exif\0\0'),tiff]),header=Buffer.alloc(4);header[0]=255;header[1]=225;header.writeUInt16BE(exif.length+2,2);
const jpeg=Buffer.concat([plain.subarray(0,2),header,exif,plain.subarray(2)]);
const parsed=await parse(jpeg,{pick:['DateTimeOriginal','CreateDate','GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef'],gps:true});
assert.ok(Math.abs(parsed.latitude-35.675)<.001);assert.ok(Math.abs(parsed.longitude-139.6916667)<.001);assert.equal(parsed.DateTimeOriginal.getFullYear(),2026);
await mkdir('tests/fixtures',{recursive:true});await writeFile('tests/fixtures/tokyo-exif.jpg',jpeg);
console.log('PASS JPEG EXIF fixture contains readable date and Tokyo GPS');
const base='http://127.0.0.1:5173';
const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=sign.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
const headers={Cookie:cookie,'Content-Type':'application/json',Origin:base};
let r=await fetch(base+'/api/actions',{method:'POST',headers,body:JSON.stringify({action:'save',entity:'trip',data:{title:'EXIF test',country:'日本',city:'大阪',start_date:'2026-01-01',end_date:'2026-01-03'}})});
const trip=await r.json();assert.ok(trip.id);
try{const form=new FormData();form.set('trip_id',trip.id);form.set('file',new Blob([jpeg],{type:'image/jpeg'}),'tokyo-exif.jpg');r=await fetch(base+'/api/photos',{method:'POST',headers:{Cookie:cookie,Origin:base},body:form});const p=await r.json();assert.equal(r.status,200);assert.equal(p.city,'東京');assert.equal(p.date,'2026-01-02');assert.match(p.source,/GPS/);console.log('PASS API classifies photo by actual EXIF date and GPS, overriding trip default city');}
finally{await fetch(base+'/api/actions',{method:'POST',headers,body:JSON.stringify({action:'delete',entity:'trip',id:trip.id})})}


