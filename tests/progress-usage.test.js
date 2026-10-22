import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STORE='memory';
const {default:usage,usageDay,usageCount}=await import('../api/usage.js');
const {sampleProgress}=await import('../progress-model.js');
const {writeJSON,readJSON}=await import('../lib/store.js');
async function call(body,origin='https://test.local'){
 const req={method:body?'POST':'GET',body,headers:{host:'test.local',origin},query:{}};
 const res={setHeader(){},end(s){this.data=JSON.parse(s);}};await usage(req,res);return {status:res.statusCode,...res.data};
}
test('sample target progress requires both groups and is not boosted by one oversized group',()=>{
 assert.equal(sampleProgress({normal:1000,harm:0},20).percent,50);
 assert.equal(sampleProgress({normal:10,harm:10},20).percent,50);
 assert.equal(sampleProgress({normal:20,harm:20},20).percent,100);
 assert.equal(sampleProgress({normal:-10,harm:'bad'},20).percent,0);
});
test('usage is idempotent, ignores expired data, does not accept reading text, and rejects foreign origin',async()=>{
 assert.equal((await call({id:'a'.repeat(32)},'https://evil.example')).status,403);
 assert.equal((await call({id:'a'.repeat(32),reading:'PRIVATE READING'})).status,400);
 assert.equal((await call({id:'a'.repeat(32)})).status,200);
 assert.equal((await call({id:'a'.repeat(32)})).status,200);
 assert.equal((await call()).count,1);
 assert.equal((await call({id:'b'.repeat(32)})).status,200);
 assert.equal((await call()).count,2);
 const path='usage/events/2020-01-01-'+'c'.repeat(64)+'.json';await writeJSON(path,{day:'2020-01-01'});
 assert.equal((await call()).count,2);await call({id:'d'.repeat(32)});assert.equal(await readJSON(path),null);
});
test('30-day window uses Korea date and excludes future and malformed paths',()=>{
 const now=Date.parse('2026-10-22T15:30:00Z');assert.equal(usageDay(now),'2026-10-23');
 const path=d=>'usage/events/'+d+'-'+'a'.repeat(64)+'.json';
 assert.equal(usageCount([path('2026-10-23'),path('2026-09-24'),path('2026-09-23'),path('2026-10-24'),'bad'],now),2);
});
test('browser count needs separate consent and deduplicates across dates and sessions',async()=>{
 const {browserCount}=await import('../api/usage.js');
 assert.equal((await call({id:'e'.repeat(32),browser:'f'.repeat(32)})).status,400);
 for(const id of ['e','f'])assert.equal((await call({id:id.repeat(32),browser:'f'.repeat(32),browserConsent:true,age14:true})).status,200);
 assert.equal((await call()).browsers,1);
 const path=d=>'usage/browsers/'+d+'-'+'a'.repeat(64)+'.json';
 assert.equal(browserCount([path('2026-10-22'),path('2026-10-21'),path('2020-01-01')],Date.parse('2026-10-22T00:00Z')),1);
});
