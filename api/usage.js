import { readJSON, writeJSON, listPaths, remove } from '../lib/store.js';
import { send, readBody, sameOrigin, hmac } from '../lib/util.js';
const DAY = 864e5;
export function usageDay(now=Date.now()) { return new Date(now+9*3600e3).toISOString().slice(0,10); }
export function usageCount(paths, now=Date.now()) {
  const today=usageDay(now),first=usageDay(now-29*DAY);
  return paths.filter(p=>/^usage\/events\/\d{4}-\d{2}-\d{2}-[a-f0-9]{64}\.json$/.test(p) && p.slice(13,23)>=first && p.slice(13,23)<=today).length;
}
export function browserCount(paths, now=Date.now()) {
 const today=usageDay(now),first=usageDay(now-29*DAY),ids=new Set();
 for(const path of paths){const m=/^usage\/browsers\/(\d{4}-\d{2}-\d{2})-([a-f0-9]{64})\.json$/.exec(path);if(m && m[1]>=first && m[1]<=today)ids.add(m[2]);}
 return ids.size;
}
export const ROLES=['general','reader','self'];
export function roleCounts(paths){const out={general:0,reader:0,self:0};for(const p of paths){const m=/^usage\/roles\/(general|reader|self)-[a-f0-9]{64}\.json$/.exec(p);if(m)out[m[1]]++;}return out;}
export default async function handler(req,res) {
 try {
  if(req.method==='GET'){const [events,browsers,total,roles]=await Promise.all([listPaths('usage/events/'),listPaths('usage/browsers/'),readJSON('usage/total.json'),listPaths('usage/roles/')]);return send(res,200,{count:usageCount(events),browsers:browserCount(browsers),days:30,total:Math.max(total?.count||0,usageCount(events)),roles:roleCounts(roles),definition:'분석 이용은 동일 탭 30분 내 1회; 누적은 집계 시작 이후 전체; 이용자 유형은 브라우저별 1회 선택한 것만',since:'2026-10-22'});}
  if(req.method!=='POST')return send(res,405,{error:'method'});
  if(!sameOrigin(req))return send(res,403,{error:'origin'});
  const b=await readBody(req);
  // 이용자 유형(일반인·타로 리더·독학 중)은 이름·본문 없이 브라우저 임의키당 한 번만 세요. 바꾸면 이전 선택을 대체해요.
  if(b.role!==undefined){
   if(!ROLES.includes(b.role)||!/^[a-f0-9]{32}$/.test(String(b.id||''))||Object.keys(b).some(k=>!['id','role'].includes(k)))return send(res,400,{error:'role'});
   const key=hmac('usage-role:'+b.id);
   for(const r of ROLES)if(r!==b.role)await remove(`usage/roles/${r}-${key}.json`);
   await writeJSON(`usage/roles/${b.role}-${key}.json`,{at:usageDay()});
   return send(res,200,{ok:true});
  }
  if(!/^[a-f0-9]{32}$/.test(String(b.id||'')) || Object.keys(b).some(k=>!['id','browser','browserConsent','age14'].includes(k)))return send(res,400,{error:'event'});
  if(b.browser!==undefined && (!/^[a-f0-9]{32}$/.test(String(b.browser)) || b.browserConsent!==true || b.age14!==true))return send(res,400,{error:'browser_consent'});
  const key=hmac('usage:'+b.id),today=usageDay(),path=`usage/events/${today}-${key}.json`;
  // 동일 이벤트 재전송은 같은 경로에 기록하므로 동시 재시도에도 한 번만 세요.
  const isNew=!(await readJSON(path));
  await writeJSON(path,{day:today});
  if(isNew){const t=(await readJSON('usage/total.json'))||{count:0,since:'2026-10-22'};t.count++;await writeJSON('usage/total.json',t);}
  if(b.browser)await writeJSON(`usage/browsers/${today}-${hmac('usage-browser:'+b.browser)}.json`,{day:today});
  const first=usageDay(Date.now()-29*DAY);
  for(const p of await listPaths('usage/events/')) if(/^usage\/events\/\d{4}-\d{2}-\d{2}-[a-f0-9]{64}\.json$/.test(p) && p.slice(13,23)<first)await remove(p);
  for(const p of await listPaths('usage/browsers/'))if(/^usage\/browsers\/\d{4}-\d{2}-\d{2}-[a-f0-9]{64}\.json$/.test(p) && p.slice(15,25)<first)await remove(p);
  return send(res,200,{ok:true});
 } catch(e){return send(res,e.status||500,{error:'server'});}
}
