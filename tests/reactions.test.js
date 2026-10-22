import test from 'node:test';import assert from 'node:assert/strict';
process.env.STORE='memory';
const {default:posts}=await import('../api/posts.js');
const {readJSON}=await import('../lib/store.js');
async function call(body,ip='5.5.5.5'){const req={method:body?'POST':'GET',body,query:{},url:'/',headers:{host:'test.local',origin:'https://test.local','x-forwarded-for':ip}};const res={setHeader(){},end(s){this.data=JSON.parse(s);}};await posts(req,res);return {status:res.statusCode,...res.data};}
test('reactions toggle per person, views count once per day, nested replies attach under comments',async()=>{
 const p=await call({type:'review',nickname:'공감테스트',title:'후기예요',body:'좋았어요 정말로.',agree:true,dev:'c'.repeat(32)},'5.5.5.1');assert.equal(p.status,200);
 let r=await call({action:'react',id:p.id,emoji:'heart',dev:'d'.repeat(32)});assert.equal(r.r.heart,1);assert.deepEqual(r.mine,['heart']);
 r=await call({action:'react',id:p.id,emoji:'heart',dev:'d'.repeat(32)});assert.equal(r.r.heart,0);
 await call({action:'react',id:p.id,emoji:'cheer',dev:'e'.repeat(32)},'5.5.5.9');
 assert.equal((await call({action:'react',id:p.id,emoji:'bomb'})).status,400);
 await call({action:'view',id:p.id,dev:'d'.repeat(32)});await call({action:'view',id:p.id,dev:'d'.repeat(32)});await call({action:'view',id:p.id,dev:'e'.repeat(32)},'5.5.5.9');
 const m=(await call({action:'meta',ids:[p.id],dev:'d'.repeat(32)})).meta[p.id];assert.equal(m.v,2);assert.equal(m.r.cheer,1);
 const c=await call({type:'comment',parentId:p.id,nickname:'댓글러',body:'저도 좋았어요',agree:true,dev:'f'.repeat(32)},'5.5.5.2');assert.equal(c.status,200);
 const n=await call({type:'comment',parentId:c.id,nickname:'답글러',body:'맞아요 동감해요',agree:true,dev:'1'.repeat(32)},'5.5.5.3');assert.equal(n.status,200);
 const n2=await call({type:'comment',parentId:n.id,nickname:'또답글',body:'저도 그래요 ㅎㅎ',agree:true,dev:'2'.repeat(32)},'5.5.5.4');assert.equal(n2.status,200);
 assert.equal((await readJSON(`posts/${n2.id}.json`)).parentId,c.id); // 대댓글의 대댓글은 원 댓글 아래로
 const list=await call(null);const top=list.posts.find(x=>x.id===p.id);assert.equal(top.comments.length,1);assert.equal(top.comments[0].replies.length,2);
});
