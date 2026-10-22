process.env.PUBLIC_COMMUNITY_WRITES='1';
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STORE='memory';
const {publicIndex,rebuildIndex}=await import('../lib/board.js');
const {writeJSON,readJSON}=await import('../lib/store.js');
const {default:posts}=await import('../api/posts.js');
const {default:admin}=await import('../api/admin.js');
const {default:requests}=await import('../api/requests.js');
const {signToken}=await import('../lib/util.js');
async function call(fn,method,body,token='',mine=false){
 const req={method,body,headers:{host:'test.local',authorization:'Bearer '+token},query:mine?{mine:1}:{}};
 const res={setHeader(){},end(x){this.data=JSON.parse(x);}};await fn(req,res);return {status:res.statusCode,...res.data};
}
const adm=b=>call(admin,'POST',b,'test-admin-token-1234');
test('legacy published reports and attached comments are removed from cached and rebuilt public index',async()=>{
 const report={id:'legacy-report',type:'report',title:'비공개 제보',body:'비공개 내용입니다.',nickname:'작성자',status:'published',createdAt:new Date().toISOString(),comments:[{id:'child',type:'comment',body:'기존 댓글입니다.',nickname:'댓글'}]};
 assert.deepEqual(publicIndex({posts:[report]}).posts,[]);
 await writeJSON('posts/legacy-report.json',report);await rebuildIndex();
 assert.deepEqual((await call(posts,'GET')).posts,[]);
 assert.equal((await call(posts,'POST',{type:'comment',parentId:report.id,nickname:'독자',body:'댓글을 작성해요.',agree:true})).status,404);
});
test('report is admin-only through submission, review and appeal restoration; account owner can see status',async()=>{
 await writeJSON('accounts/private-user.json',{id:'private-user',nickname:'제보독자',sessionVersion:1,posts:[]});
 const token=signToken({uid:'private-user',sv:1});
 const p=await call(posts,'POST',{type:'report',title:'운영자에게 전달',body:'추가 결제 요청을 경험했어요.',agree:true},token);
 assert.equal(p.status,200);assert.ok(p.message.includes('공개되지 않아요'));
 assert.equal((await adm({action:'publish',id:p.id})).status,200);
 assert.equal((await readJSON(`posts/${p.id}.json`)).status,'private');
 const mine=await call(posts,'GET',null,token,true);assert.equal(mine.posts[0].id,p.id);
 assert.equal((await call(admin,'GET')).status,401);
 assert.ok((await call(admin,'GET',null,'test-admin-token-1234')).posts.some(x=>x.id===p.id));
 await adm({action:'hide',id:p.id});
 const r=await call(requests,'POST',{kind:'appeal',postId:p.id,reason:'다시 검토해 주세요.'},token);assert.equal(r.status,200);
 assert.equal((await adm({action:'appeal_decision',id:r.id,decision:'restore',answer:'검토를 완료하여 비공개로 복원합니다.'})).status,200);
 assert.equal((await readJSON(`posts/${p.id}.json`)).status,'private');
 assert.deepEqual((await call(posts,'GET')).posts,[]);
});
