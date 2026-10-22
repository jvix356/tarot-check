import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STORE = 'memory';
const {default: posts} = await import('../api/posts.js');
const {default: requests} = await import('../api/requests.js');
const {default: admin} = await import('../api/admin.js');
const {readJSON, writeJSON} = await import('../lib/store.js');
const {signToken} = await import('../lib/util.js');
const {addStrike, blockState, setBlock} = await import('../lib/moderation.js');
let n = 0;
async function call(fn, body, {method='POST', token='', ip='10.0.' + (++n) + '.1', origin='https://test.local', mine=false}={}) {
  const req = {method, body, headers:{host:'test.local', origin, 'x-forwarded-for':ip, authorization:'Bearer '+token}, query:mine?{mine:1}:{}, url:mine?'/?mine=1':'/'};
  const res = {setHeader(){}, end(x){this.data=JSON.parse(x);}};
  await fn(req,res); return {status:res.statusCode,...res.data};
}
const adm = body => call(admin, body, {token:'test-admin-token-1234'});
const make = opts => call(posts,{type:'review',nickname:'독자',title:'새 후기',body:'사용 경험을 남겨요.',agree:true},opts);
const appeal = p => ({kind:'appeal',postId:p.id,ownerToken:p.ownerToken,reason:'문제를 다시 검토해 주세요.'});
const lookup = p => call(posts,{action:'lookup',keys:[{id:p.id,token:p.ownerToken}]});

test('anonymous ownership uses a random per-post key, never nickname or IP; public/admin lists omit it', async()=>{
 const p=await make({ip:'8.8.8.8'}); assert.match(p.ownerToken,/^[a-f0-9]{64}$/);
 await adm({action:'hide',id:p.id});
 assert.equal((await lookup(p)).posts[0].status,'hidden');
 assert.equal((await lookup({...p,ownerToken:'0'.repeat(64)})).posts.length,0);
 assert.equal((await call(requests,{...appeal(p),ownerToken:''},{ip:'8.8.8.8'})).status,403);
 const stored=await readJSON(`posts/${p.id}.json`); assert.notEqual(stored.ownerHash,p.ownerToken);
 for(const result of [await call(posts,null,{method:'GET'}),await call(admin,null,{method:'GET',token:'test-admin-token-1234'})]) {
  assert.ok(!JSON.stringify(result).includes(p.ownerToken)); assert.ok(!JSON.stringify(result).includes('ownerHash'));
 }
 await writeJSON('posts/legacy.json',{...stored,id:'legacy',ownerHash:null});
 assert.equal((await call(requests,{...appeal(p),postId:'legacy'})).status,403);
});

test('blocked author appeals → review → restore; private result and linked strikes cleaned',async()=>{
 const p=await make(); await adm({action:'reject',id:p.id,reason:'확인이 필요해요.'});
 const post=await readJSON(`posts/${p.id}.json`);
 await addStrike(post.authorKey,'다른 글 위반','other-post'); assert.ok(await blockState(post.authorKey));
 const r=await call(requests,appeal(p)); assert.equal(r.status,200);
 assert.equal((await call(requests,appeal(p))).status,409);
 assert.equal((await adm({action:'publish',id:p.id})).status,409);
 assert.equal((await adm({action:'request_status',id:r.id,status:'검토 중'})).status,200);
 assert.equal((await lookup(p)).posts[0].appeal.status,'검토 중');
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'restore',answer:'사유를 재검토하여 복원했어요.'})).status,200);
 assert.equal((await lookup(p)).posts[0].status,'published');
 assert.equal((await lookup(p)).posts[0].appeal.status,'처리 완료');
 assert.equal(await blockState(post.authorKey),null);
 assert.equal((await readJSON(`blocks/${post.authorKey}.json`)).strikes.length,1);
 const pub=JSON.stringify(await call(posts,null,{method:'GET'})); assert.ok(!pub.includes(r.id)); assert.ok(!pub.includes('재검토하여'));
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'restore',answer:'다시 복원할게요.'})).status,409);
});

test('account ownership requires original account; uphold keeps post hidden and shows private answer',async()=>{
 await writeJSON('accounts/a.json',{id:'a',nickname:'계정독자',sessionVersion:1,posts:[]});
 await writeJSON('accounts/b.json',{id:'b',nickname:'다른독자',sessionVersion:1,posts:[]});
 const a=signToken({uid:'a',sv:1}), b=signToken({uid:'b',sv:1});
 const p=await make({token:a}); assert.equal(p.ownerToken,null); await adm({action:'hide',id:p.id});
 assert.equal((await call(requests,appeal(p),{token:b})).status,403);
 const r=await call(requests,appeal(p),{token:a}); assert.equal(r.status,200);
 assert.equal((await adm({action:'request_status',id:r.id,status:'처리 완료'})).status,400);
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'uphold',answer:'검토 결과 기존 조치를 유지해요.'})).status,200);
 const mine=await call(posts,null,{method:'GET',token:a,mine:true}); assert.equal(mine.posts[0].status,'hidden'); assert.equal(mine.posts[0].appeal.status,'반려');
});

test('restore cannot bypass privacy filter, requires reason and admin auth; cross-origin rejected',async()=>{
 const p=await make(); await adm({action:'hide',id:p.id}); const r=await call(requests,appeal(p));
 assert.equal((await call(admin,{action:'appeal_decision',id:r.id,decision:'restore',answer:'다시 확인했어요.'})).status,401);
 assert.equal((await call(requests,appeal(p),{origin:'https://evil.example'})).status,403);
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'restore',answer:''})).status,400);
 const post=await readJSON(`posts/${p.id}.json`); post.body='전화 010-1234-5678'; await writeJSON(`posts/${p.id}.json`,post);
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'restore',answer:'다시 확인했어요.'})).status,400);
 assert.equal((await readJSON(`posts/${p.id}.json`)).status,'hidden');
});

test('comment restore needs a public parent; manual block survives restoration',async()=>{
 const parent=await make();
 const p=await call(posts,{type:'comment',parentId:parent.id,nickname:'댓글독자',body:'댓글 테스트입니다.',agree:true});
 await adm({action:'hide',id:p.id}); const r=await call(requests,appeal(p));
 await adm({action:'hide',id:parent.id});
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'restore',answer:'댓글을 복원할게요.'})).status,409);
 await adm({action:'publish',id:parent.id});
 const post=await readJSON(`posts/${p.id}.json`); await setBlock(post.authorKey,true);
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'restore',answer:'댓글을 복원할게요.'})).status,200);
 assert.ok(await blockState(post.authorKey));
});

test('completed appeal private data expires after one year',async()=>{
 const p=await make(); await adm({action:'hide',id:p.id}); const r=await call(requests,appeal(p));
 await adm({action:'appeal_decision',id:r.id,decision:'uphold',answer:'기존 조치를 유지해요.'});
 const req=await readJSON(`requests/${r.id}.json`); req.updatedAt='2020-01-01T00:00:00Z'; await writeJSON(`requests/${r.id}.json`,req);
 await call(admin,null,{method:'GET',token:'test-admin-token-1234'});
 assert.equal(await readJSON(`requests/${r.id}.json`),null);
 const info=(await lookup(p)).posts[0].appeal; assert.ok(!info.reason); assert.ok(!info.answer);
});
