import crypto from 'node:crypto';
import { readJSON, writeJSON, remove, listPaths } from '../lib/store.js';
import { send, readBody, bearer, safeEqual, pseudo, hmac, sameOrigin, clip, clientIp } from '../lib/util.js';
import { checkText, checkNickname } from '../lib/filter.js';
import { signals, KINDS, CHOICES, allTeaching, proposalView, qualified, teachingSummary } from '../lib/teaching.js';
const DAY = 864e5;
function admin(req) { const key = process.env.ADMIN_TOKEN || (process.env.STORE === 'memory' ? 'test-admin-token-1234' : ''); return key.length >= 16 && safeEqual(bearer(req),key); }
async function profile(req) {
  const token = bearer(req); if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return readJSON(`teaching/profiles/${pseudo('contributor',token)}.json`);
}
async function rate(req, suffix, max) {
  const key = `rl/teach-${pseudo('ip',clientIp(req))}-${suffix}.json`;
  const r = await readJSON(key) || {t:[]}; r.t = r.t.filter(t => Date.now()-t < DAY);
  if (r.t.length >= max) throw Object.assign(new Error('하루 이용 한도에 도달했어요. 내일 다시 시도해 주세요.'),{status:429});
  r.t.push(Date.now()); await writeJSON(key,r);
}
export default async function handler(req,res) {
 try {
  const scope = req.query?.scope || '';
  if (req.method === 'GET') {
    if (scope === 'admin') { if (!admin(req)) return send(res,401,{error:'unauthorized'}); return send(res,200,{proposals:(await allTeaching()).map(proposalView)}); }
    if (scope === 'mine') {
      const me = await profile(req); if (!me) return send(res,401,{error:'login'});
      const all = await allTeaching();
      return send(res,200,{nickname:me.nickname,listed:me.listed,proposals:all.filter(p=>p.authorId===me.id).map(proposalView),votes:Object.fromEntries(all.filter(p=>p.votes?.[me.id]).map(p=>[p.id,p.votes[me.id]]))});
    }
    const summary = await teachingSummary();
    if (scope === 'model') return send(res,200,{adjustments:summary.adjustments});
    return send(res,200,process.env.PUBLIC_COMMUNITY_WRITES==='1'?{signals,kinds:KINDS,...summary}:{signals,kinds:KINDS,proposals:[],ranking:[],closed:true});
  }
  if (req.method !== 'POST') return send(res,405,{error:'method'});
  if (!sameOrigin(req)) return send(res,403,{error:'origin'});
  const b = await readBody(req);
  if (JSON.stringify(b).length > 6000) return send(res,413,{error:'size'});
  if(process.env.PUBLIC_COMMUNITY_WRITES!=='1' && !['withdraw','privacy'].includes(b.action) && !(b.action==='review' && b.status==='rejected'))return send(res,403,{error:'read_only',message:'공동 교정·투표·순위 운영을 중단했어요. 기존 참여 정보 삭제와 공개 철회는 계속할 수 있어요.'});
  if (b.action === 'register') {
    const nickname = clip(b.nickname,12), bad = checkNickname(nickname);
    if (bad || b.consent !== true) return send(res,400,{message:bad || '닉네임·교정 정보 처리 안내에 동의해 주세요.'});
    await rate(req,'register',3);
    const nameId = pseudo('contributor-name',nickname);
    if (await readJSON(`teaching/names/${nameId}.json`)) return send(res,409,{message:'이미 사용 중인 닉네임이에요. 기존 기여자라면 보관한 복구키로 들어와 주세요.'});
    const token = crypto.randomBytes(32).toString('hex'), id = pseudo('contributor',token);
    await writeJSON(`teaching/profiles/${id}.json`,{id,nickname,listed:b.listed===true,createdAt:new Date().toISOString()});
    await writeJSON(`teaching/names/${nameId}.json`,{id});
    return send(res,200,{ok:true,token,nickname});
  }
  if (b.action === 'review') {
    if (!admin(req)) return send(res,401,{error:'unauthorized'});
    if (!/^[a-f0-9]{64}$/.test(String(b.id))) return send(res,400,{error:'id'});
    const path = `teaching/proposals/${b.id}.json`, p = await readJSON(path);
    if (!p) return send(res,404,{error:'not_found'});
    if (!['voting','accepted','rejected'].includes(b.status)) return send(res,400,{error:'status'});
    if (b.status==='accepted' && (p.status!=='voting' || !qualified(p))) return send(res,409,{message:'공개 검토 단계에서 다른 닉네임 3개 이상의 동의와 전체 검토의 2/3 이상 동의가 필요해요. 판단 어려움도 전체 검토에 포함해요.'});
    if (b.status==='voting' && p.status!=='pending') return send(res,409,{message:'새 제안만 공동 검토에 올릴 수 있어요.'});
    const answer = clip(b.answer,500), chk=checkText(p.example+'\n'+p.explanation+'\n'+answer);
    if (answer.length<5 || (b.status!=='rejected' && (chk.blocked.length || chk.flags.length))) return send(res,400,{message:'사유를 5자 이상 쓰고 개인정보·단정 표현을 제거해 주세요.'});
    p.status=b.status;p.answer=answer;p.updatedAt=new Date().toISOString();
    await writeJSON(path,p);return send(res,200,{ok:true});
  }
  const me = await profile(req); if (!me) return send(res,401,{message:'닉네임으로 참여를 시작하거나 복구키를 입력해 주세요.'});
  if (b.action==='privacy') { me.listed=process.env.PUBLIC_COMMUNITY_WRITES==='1' && b.listed===true;await writeJSON(`teaching/profiles/${me.id}.json`,me);return send(res,200,{ok:true}); }
  if (b.action==='withdraw') {
    for (const p of await allTeaching()) {
      if (p.authorId===me.id) await remove(`teaching/proposals/${p.id}.json`);
      else if (p.votes?.[me.id]) { delete p.votes[me.id];await writeJSON(`teaching/proposals/${p.id}.json`,p); }
    }
    await remove(`teaching/names/${pseudo('contributor-name',me.nickname)}.json`);
    await remove(`teaching/profiles/${me.id}.json`);
    return send(res,200,{ok:true});
  }
  if (b.action==='submit') {
    if (!signals.includes(b.signal) || !Object.hasOwn(KINDS,b.kind) || b.rights!==true) return send(res,400,{message:'관찰 항목·교정 방향과 직접 만든 예시임을 확인해 주세요.'});
    const example=clip(b.example,300),explanation=clip(b.explanation,500),chk=checkText(example+'\n'+explanation);
    if (example.length<10 || explanation.length<10 || chk.blocked.length || chk.flags.length) return send(res,400,{message:'예시와 설명을 각각 10자 이상 써 주세요. 개인정보·계정·링크·단정 표현은 제출할 수 없어요.'});
    await rate(req,'submit',5);
    const id=hmac('teach:'+JSON.stringify([b.signal,b.kind,example.replace(/\s/g,''),explanation.replace(/\s/g,'')]).normalize('NFKC'));
    if (await readJSON(`teaching/proposals/${id}.json`)) return send(res,409,{message:'이미 접수된 동일한 제안이에요.'});
    await writeJSON(`teaching/proposals/${id}.json`,{id,authorId:me.id,signal:b.signal,kind:b.kind,example,explanation,status:'pending',votes:{},createdAt:new Date().toISOString(),answer:''});
    return send(res,200,{ok:true,message:'비공개로 접수했어요. 운영자가 권리·내용을 확인한 뒤 공동 검토에 올려요.'});
  }
  if (b.action==='vote') {
    if (!/^[a-f0-9]{64}$/.test(String(b.id)) || !CHOICES.includes(b.choice)) return send(res,400,{error:'vote'});
    const path=`teaching/proposals/${b.id}.json`,p=await readJSON(path);
    if (!p || p.status!=='voting') return send(res,409,{message:'현재 공동 검토 중인 제안만 평가할 수 있어요.'});
    if (p.authorId===me.id) return send(res,403,{message:'자기 제안에는 투표할 수 없어요.'});
    await rate(req,'vote',30);
    p.votes[me.id]=b.choice;await writeJSON(path,p);return send(res,200,{ok:true});
  }
  return send(res,400,{error:'action'});
 } catch(e) { return send(res,e.status||500,{message:e.status===429?e.message:'잠시 후 다시 시도해 주세요.'}); }
}
