process.env.PUBLIC_COMMUNITY_WRITES='1';
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STORE='memory';
const {default:api}=await import('../api/teaching.js');
const {signals,teachingSummary,qualified}=await import('../lib/teaching.js');
const {readJSON}=await import('../lib/store.js');
let count=0;
async function call(body,token='',scope='',ip='192.0.'+(++count)+'.1',origin='https://test.local'){
 const req={method:body?'POST':'GET',body,headers:{host:'test.local',origin,authorization:'Bearer '+token,'x-forwarded-for':ip},query:{scope}};
 const res={setHeader(){},end(x){this.data=JSON.parse(x);}};await api(req,res);return {status:res.statusCode,...res.data};
}
async function join(nickname,listed=false){const r=await call({action:'register',nickname,listed,consent:true});assert.equal(r.status,200);return r.token;}
const admin='test-admin-token-1234';
const draft=(n='한 문장으로 모든 상황을 설명할 수는 없어요.')=>({action:'submit',signal:signals[0],kind:'overflag',example:n,explanation:'제가 직접 만든 문장이며 표현의 형식만으로 강조하는 안내를 완화해야 해요.',rights:true});
async function proposal(token,d=draft()){assert.equal((await call(d,token)).status,200);return (await call(null,token,'mine')).proposals[0];}
async function review(p,status){return call({action:'review',id:p.id,status,answer:'예시와 문맥 및 권리 안내를 확인했습니다.'},admin);}

test('registration, recovery proof, consent, unique nickname and origin guards',async()=>{
 assert.equal((await call({action:'register',nickname:'운영자',consent:true})).status,400);
 assert.equal((await call({action:'register',nickname:'동의없음'})).status,400);
 const token=await join('첫기여자');assert.equal((await call(null,token,'mine')).nickname,'첫기여자');
 assert.equal((await call({action:'register',nickname:'첫기여자',consent:true})).status,409);
 assert.equal((await call(null,'0'.repeat(64),'mine')).status,401);
 assert.equal((await call({action:'privacy',listed:true},token,'','ip','https://evil.example')).status,403);
 const pub=JSON.stringify(await call());assert.ok(!pub.includes(token));
});

test('proposals stay private, enforce fixed categories, original example consent and personal info filters',async()=>{
 const t=await join('안전기여자');
 assert.equal((await call({...draft(),rights:false},t)).status,400);
 assert.equal((await call({...draft(),signal:'새로운 무작위 항목'},t)).status,400);
 assert.equal((await call({...draft(),example:'연락은 010-1234-5678 번호로 주세요.'},t)).status,400);
 const p=await proposal(t,draft('정보를 확인하기 전에 결론을 정하지 마세요.'));
 assert.ok(!(await call()).proposals.some(x=>x.id===p.id));
 assert.equal((await call(null,'','admin')).status,401);
 assert.equal((await call({action:'vote',id:p.id,choice:'agree'},t)).status,409);
 assert.equal((await call({...draft('정보를 확인하기 전에 결론을 정하지 마세요.')},t)).status,409);
});

test('crowd review + admin approval required, self/repeated votes excluded, approved model & opt-in leaderboard only',async()=>{
 const author=await join('공동기여자',true),voters=await Promise.all(['검토가','검토나','검토다'].map(n=>join(n)));
 const p=await proposal(author);
 assert.equal((await review(p,'accepted')).status,409);
 assert.equal((await review(p,'voting')).status,200);
 assert.equal((await call({action:'vote',id:p.id,choice:'agree'},author)).status,403);
 assert.equal((await call({action:'review',id:p.id,status:'accepted',answer:'올바른 설명입니다.'},author)).status,401);
 for(const t of voters)await call({action:'vote',id:p.id,choice:'agree'},t);
 await call({action:'vote',id:p.id,choice:'agree'},voters[0]);
 const publicP=(await call()).proposals.find(x=>x.id===p.id);assert.equal(publicP.counts.agree,3);assert.ok(!('votes' in publicP));assert.ok(!('authorId' in publicP));
 assert.equal((await call()).adjustments.length,0);assert.equal((await call()).leaderboard.length,0);
 assert.equal((await review(p,'accepted')).status,200);
 const summary=await call();assert.ok(summary.adjustments.some(x=>x.signal===p.signal&&x.soften));assert.equal(summary.leaderboard.find(x=>x.nickname==='공동기여자').score,1);
 const model=await call(null,'','model');assert.ok(!('proposals' in model));assert.ok(!('leaderboard' in model));
 await call({action:'privacy',listed:false},author);assert.ok(!(await call()).leaderboard.some(x=>x.nickname==='공동기여자'));
 assert.equal((await review(p,'rejected')).status,200);assert.ok(!(await call()).proposals.some(x=>x.id===p.id));assert.equal((await call()).adjustments.length,0);
});

test('unsure and disagree count in threshold',()=>{
 assert.equal(qualified({authorId:'a',votes:{a:'agree',b:'agree',c:'agree'}}),false);
 assert.equal(qualified({authorId:'a',votes:{b:'agree',c:'agree',d:'agree',e:'unsure',f:'disagree'}}),false);
 assert.equal(qualified({authorId:'a',votes:{b:'agree',c:'agree',d:'agree',e:'unsure'}}),true);
});

test('daily signup throttle and withdrawal remove profile, proposals and votes',async()=>{
 for(const nickname of ['하루가','하루나','하루다'])assert.equal((await call({action:'register',nickname,consent:true},'','','7.7.7.7')).status,200);
 assert.equal((await call({action:'register',nickname:'하루라',consent:true},'','','7.7.7.7')).status,429);
 const t=await join('삭제기여자');const p=await proposal(t,draft('다른 사람이 판단할 수 있도록 예시를 작성합니다.'));
 assert.equal((await call({action:'withdraw'},t)).status,200);
 assert.equal((await call(null,t,'mine')).status,401);
 assert.equal(await readJSON(`teaching/proposals/${p.id}.json`),null);
});

test('approved correction model softens only its target, keeps the source model intact and does not compound',async()=>{
 const {correctedSignals}=await import('../teaching-model.js');
 const base=[{label:'관찰 가',weight:1.4,tier:'harm'},{label:'관찰 나',weight:-1,tier:'common'}];
 const corrections=[{signal:'관찰 가',soften:true},{signal:'관찰 가',soften:true},{signal:'관찰 다',context:true}];
 const result=correctedSignals(base,corrections);
 assert.equal(result[0].weight,0.7);assert.equal(base[0].weight,1.4);assert.equal(result[1].weight,-1);
 assert.equal(result[2].weight,null);assert.equal(result[2].teaching.context,true);
 assert.deepEqual(correctedSignals(base,corrections),result);
});

test('repeated accepted proposals earn one point per nickname + signal + direction and withdrawing a vote revokes unsupported learning',async()=>{
 const t=await join('점수기여자',true),voters=[];
 for (const nick of ['점수검토가','점수검토나','점수검토다'])voters.push(await join(nick));
 for (const example of ['두 가지 예시 중 첫 번째로 문맥의 중요성을 설명합니다.','두 가지 예시 중 두 번째로 문맥의 중요성을 설명합니다.']) {
  const p=await proposal(t,draft(example));await review(p,'voting');
  for (const v of voters)await call({action:'vote',id:p.id,choice:'agree'},v);
  assert.equal((await review(p,'accepted')).status,200);
 }
 const s=await teachingSummary();assert.equal(s.leaderboard.find(x=>x.nickname==='점수기여자').score,1);
 assert.ok(s.adjustments.some(x=>x.signal===signals[0]));
 await call({action:'withdraw'},voters[0]);
 assert.ok(!(await teachingSummary()).leaderboard.some(x=>x.nickname==='점수기여자'));
 assert.equal((await teachingSummary()).adjustments.length,0);
});
