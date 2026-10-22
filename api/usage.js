import { readJSON, writeJSON, listPaths, remove } from '../lib/store.js';
import { send, readBody, sameOrigin, hmac } from '../lib/util.js';
const DAY = 864e5;
export function usageDay(now=Date.now()) { return new Date(now+9*3600e3).toISOString().slice(0,10); }
export function usageCount(paths, now=Date.now()) {
  const today=usageDay(now),first=usageDay(now-29*DAY);
  return paths.filter(p=>/^usage\/events\/\d{4}-\d{2}-\d{2}-[a-f0-9]{64}\.json$/.test(p) && p.slice(13,23)>=first && p.slice(13,23)<=today).length;
}
export default async function handler(req,res) {
 try {
  if(req.method==='GET')return send(res,200,{count:usageCount(await listPaths('usage/events/')),days:30,definition:'동일 탭에서 30분 내 반복 분석은 1회, 예시 제외',since:'2026-10-22'});
  if(req.method!=='POST')return send(res,405,{error:'method'});
  if(!sameOrigin(req))return send(res,403,{error:'origin'});
  const b=await readBody(req);
  if(!/^[a-f0-9]{32}$/.test(String(b.id||'')) || Object.keys(b).some(k=>k!=='id'))return send(res,400,{error:'event'});
  const key=hmac('usage:'+b.id),today=usageDay(),path=`usage/events/${today}-${key}.json`;
  // 동일 이벤트 재전송은 같은 경로에 기록하므로 동시 재시도에도 한 번만 세요.
  await writeJSON(path,{day:today});
  const first=usageDay(Date.now()-29*DAY);
  for(const p of await listPaths('usage/events/')) if(/^usage\/events\/\d{4}-\d{2}-\d{2}-[a-f0-9]{64}\.json$/.test(p) && p.slice(13,23)<first)await remove(p);
  return send(res,200,{ok:true});
 } catch(e){return send(res,e.status||500,{error:'server'});}
}
