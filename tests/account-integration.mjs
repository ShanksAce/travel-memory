import assert from 'node:assert/strict';
const base='http://localhost:5173';
const original='integration-test-password', changed='integration-updated-password';
async function login(password){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:'integration@travel-memory.test',password})});return {status:r.status,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')}}
let session=await login(original);assert.equal(session.status,200);
async function post(body,cookie=session.cookie,origin=base){return fetch(base+'/api/account',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)})}
assert.equal((await post({action:'name',name:'測試旅人'},'')).status,401);
assert.equal((await post({action:'name',name:'測試旅人'},session.cookie,'https://example.com')).status,403);
assert.equal((await post({action:'name',name:'  '})).status,400);
assert.equal((await post({action:'name',name:'測試旅人'})).status,200);
const html=await (await fetch(base+'/settings',{headers:{Cookie:session.cookie}})).text();assert.ok(html.includes('測試旅人'));
assert.equal((await post({action:'password',current:'incorrect',password:changed})).status,400);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXuoAAAAASUVORK5CYII=','base64');
const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),'avatar.png');
assert.equal((await fetch(base+'/api/account/avatar',{method:'POST',headers:{Origin:base,Cookie:session.cookie},body:form})).status,200);
assert.equal((await fetch(base+'/api/account/avatar')).status,401);
const image=await fetch(base+'/api/account/avatar',{headers:{Cookie:session.cookie}});assert.equal(Buffer.compare(Buffer.from(await image.arrayBuffer()),png),0);
assert.equal((await fetch(base+'/api/account/avatar',{method:'DELETE',headers:{Origin:base,Cookie:session.cookie}})).status,200);
assert.equal((await fetch(base+'/api/account/avatar',{headers:{Cookie:session.cookie}})).status,404);
try {
 assert.equal((await post({action:'password',current:original,password:changed})).status,200);
 assert.equal((await fetch(base+'/api/data',{headers:{Cookie:session.cookie}})).status,401);
 assert.equal((await login(original)).status,401);
 session=await login(changed);assert.equal(session.status,200);
} finally {
 session=await login(changed);
 if(session.status===200) assert.equal((await post({action:'password',current:changed,password:original})).status,200);
 session=await login(original);
 await post({action:'name',name:'Integration Tester'});
}
console.log('PASS account name persistence, validation, origin/auth protection, avatar upload/read/delete, password verification and session revocation; test credentials restored');
