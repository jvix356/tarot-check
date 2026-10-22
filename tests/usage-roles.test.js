import test from 'node:test';import assert from 'node:assert/strict';
process.env.STORE='memory';
const {default:usage}=await import('../api/usage.js');
async function call(body){const req={method:body?'POST':'GET',body,query:{},headers:{host:'test.local',origin:'https://test.local'}};const res={setHeader(){},end(s){this.data=JSON.parse(s);}};await usage(req,res);return {status:res.statusCode,...res.data};}
const id=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
test('user type counted once per browser key and replaced on change; cumulative total grows',async()=>{
 const k=id();assert.equal((await call({id:k,role:'reader'})).status,200);await call({id:k,role:'self'});await call({id:id(),role:'general'});
 assert.equal((await call({id:k,role:'admin'})).status,400);
 let g=await call();assert.deepEqual(g.roles,{general:1,reader:0,self:1});
 const e=id();await call({id:e});await call({id:e});await call({id:id()});
 g=await call();assert.equal(g.total,2);
});
