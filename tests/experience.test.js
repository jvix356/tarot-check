import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STORE='memory';
const {default:handler}=await import('../api/experience.js');
const {readJSON,writeJSON}=await import('../lib/store.js');
async function call(body,admin=false,origin='https://test.local'){
 const req={method:body?'POST':'GET',body,headers:{host:'test.local',origin,'x-forwarded-for':'192.0.2.211',...(admin?{authorization:'Bearer test-admin-token-1234'}:{})}};
 const res={setHeader(){},end(s){this.data=JSON.parse(s);}};await handler(req,res);return {status:res.statusCode,...res.data};
}
const body=n=>({nonce:n.toString(16).padStart(32,'0'),rating:'helpful',comment:'설명이 이해하기 쉬웠어요.',consent:true,age14:true,rights:true});
test('private opinions require consent, rights, age and safe content; raw reading is refused',async()=>{
 assert.equal((await call()).status,401);
 assert.equal((await call({...body(1),age14:false})).status,400);
 assert.equal((await call({...body(1),rights:false})).status,400);
 assert.equal((await call({...body(1),consent:false})).status,400);
 assert.equal((await call({...body(1),reading:'private'})).status,400);
 assert.equal((await call({...body(1),comment:'연락처 test@example.com'})).status,400);
 assert.equal((await call(body(1),false,'https://evil.example')).status,403);
});
test('private submit is idempotent; only admin can read, review and delete; expiry and rate limit',async()=>{
 const first=await call(body(1));assert.equal(first.status,200);assert.equal((await call(body(1))).id,first.id);
 const record=await readJSON('experience/'+first.id+'.json');assert.deepEqual(Object.keys(record).sort(),['id','rating','comment','createdAt','status'].sort());
 assert.equal((await call({action:'review',id:first.id,status:'done'})).status,401);
 assert.equal((await call({action:'review',id:first.id,status:'done'},true)).status,200);
 assert.equal((await call(undefined,true)).opinions[0].status,'done');
 await writeJSON('experience/old.json',{createdAt:'2020-01-01T00:00:00Z'});await call(undefined,true);assert.equal(await readJSON('experience/old.json'),null);
 for(let i=2;i<=5;i++)assert.equal((await call(body(i))).status,200);
 assert.equal((await call(body(6))).status,429);
 assert.equal((await call({action:'delete',id:first.id})).status,401);
 assert.equal((await call({action:'delete',id:first.id},true)).status,200);assert.equal(await readJSON('experience/'+first.id+'.json'),null);
});
