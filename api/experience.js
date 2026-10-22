import { readJSON,writeJSON,listPaths,remove } from '../lib/store.js';
import { send,readBody,sameOrigin,bearer,safeEqual,clip,pseudo,clientIp,hmac } from '../lib/util.js';
import { checkText } from '../lib/filter.js';
const DAY=864e5;
function admin(req){const key=process.env.ADMIN_TOKEN||(process.env.STORE==='memory'?'test-admin-token-1234':'');return key.length>=16&&safeEqual(bearer(req),key);}
async function expired(){for(const k of await listPaths('experience/')){const r=await readJSON(k);if(r && Date.now()-Date.parse(r.createdAt)>180*DAY)await remove(k);}}
export default async function handler(req,res){
 try{
  if(req.method==='GET'){
   if(!admin(req))return send(res,401,{error:'unauthorized'});
   await expired();const opinions=[];for(const k of await listPaths('experience/')){const r=await readJSON(k);if(r)opinions.push(r);}
   return send(res,200,{opinions:opinions.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
  }
  if(req.method!=='POST')return send(res,405,{error:'method'});
  if(!sameOrigin(req))return send(res,403,{error:'origin'});
  const b=await readBody(req);
  if(b.action==='review'||b.action==='delete'){
   if(!admin(req))return send(res,401,{error:'unauthorized'});
   if(!/^[a-f0-9]{64}$/.test(String(b.id))||(b.action==='review'&&!['new','reviewing','done'].includes(b.status)))return send(res,400,{error:'status'});
   const path=`experience/${b.id}.json`,r=await readJSON(path);if(!r)return send(res,404,{error:'not_found'});
   if(b.action==='delete'){await remove(path);return send(res,200,{ok:true});}
   r.status=b.status;await writeJSON(path,r);return send(res,200,{ok:true});
  }
  if(Object.keys(b).some(k=>!['nonce','rating','comment','consent','age14','rights'].includes(k)))return send(res,400,{message:'허용되지 않은 항목이에요.'});
  if(b.consent!==true||b.age14!==true||b.rights!==true)return send(res,400,{message:'만 14세 이상, 개인정보 처리 안내 및 직접 작성한 의견임을 확인해 주세요.'});
  if(!['helpful','mixed','unhelpful'].includes(b.rating)||!/^[a-f0-9]{32}$/.test(String(b.nonce)))return send(res,400,{message:'도움 여부를 선택해 주세요.'});
  const comment=clip(b.comment,1000),chk=checkText(comment);
  if(chk.blocked.length||chk.flags.length)return send(res,400,{message:'의견에 개인정보·계정·링크·욕설·단정 표현을 포함하지 마세요. 사용하면서 아쉬웠던 점만 직접 적어 주세요.'});
  const id=hmac('experience:'+b.nonce),path=`experience/${id}.json`;
  if(await readJSON(path))return send(res,200,{ok:true,id,message:'이미 접수된 의견이에요. 참여해 주셔서 고마워요.'});
  await expired();
  if((await listPaths('experience/')).length>=200)return send(res,429,{message:'의견 보관함이 차서 접수를 잠시 쉬고 있어요. 판독기는 계속 이용할 수 있어요.'});
  const ratePath=`rl/experience-${pseudo('ip',clientIp(req))}.json`,r=await readJSON(ratePath)||{t:[]};r.t=r.t.filter(t=>Date.now()-t<DAY);
  if(r.t.length>=5)return send(res,429,{message:'오늘 보낼 수 있는 의견 수를 넘었어요. 내일 다시 남겨 주세요.'});
  r.t.push(Date.now());await writeJSON(ratePath,r);
  await writeJSON(path,{id,rating:b.rating,comment,createdAt:new Date().toISOString(),status:'new'});
  return send(res,200,{ok:true,id,message:'의견 고마워요! 운영자에게만 전달했어요. 나눠 주신 의견은 판독기 개선에 참고할게요.'});
 }catch(e){return send(res,e.status||500,{message:'잠시 후 다시 시도해 주세요.'});}
}
