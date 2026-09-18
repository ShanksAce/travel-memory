import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
if(!existsSync('dist/server/wrangler.json'))throw Error('Run npm run build first.');
mkdirSync('.sites-runtime',{recursive:true});
const tracker='.sites-runtime/applied-local-migrations.json';
const applied=existsSync(tracker)?JSON.parse(readFileSync(tracker,'utf8')):[];
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
 if(applied.includes(file))continue;
 const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file','drizzle/'+file],{stdio:'inherit'});
 if(r.status!==0)process.exit(r.status||1);applied.push(file);writeFileSync(tracker,JSON.stringify(applied,null,2));
}
console.log('Local database ready.');

