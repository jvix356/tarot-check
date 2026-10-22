import test from 'node:test';import assert from 'node:assert/strict';
process.env.STORE='memory';
const {default:posts}=await import('../api/posts.js');
async function call(body,ip){const req={method:'POST',body,query:{},headers:{host:'test.local',origin:'https://test.local','x-forwarded-for':ip}};const res={setHeader(){},end(s){this.data=JSON.parse(s);}};await posts(req,res);return {status:res.statusCode,...res.data};}
const post=(nickname,dev)=>({type:'review',nickname,title:'후기예요',body:'써 보니 괜찮았어요.',agree:true,dev});
test('one person cannot switch nicknames; a nickname cannot be taken by another person',async()=>{
 const d1='a'.repeat(32),d2='b'.repeat(32);
 assert.equal((await call(post('첫닉네임',d1),'7.7.7.1')).status,200);
 const r=await call(post('두번째닉',d1),'7.7.7.1');assert.equal(r.status,409);assert.ok(r.message.includes('첫닉네임'));
 assert.equal((await call(post('두번째닉',d1),'7.7.7.99')).status,409); // 네트워크를 바꿔도 같은 브라우저면 막힘
 assert.equal((await call(post('첫닉네임',d2),'7.7.7.2')).status,409); // 다른 사람이 같은 닉네임 사용 불가
 assert.equal((await call(post('다른사람',d2),'7.7.7.2')).status,200);
});
