import { sampleProgress } from './progress-model.js';
const box=document.getElementById('improvementProgress');
function el(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
function metric(title,value){const n=el('div');n.className='progress-metric';n.append(el('span',title),el('strong',value));return n;}
function get(url){return fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);}
async function render(){
 if(!box)return;
 const [usage,stats,model,teach]=await Promise.all([get('/api/usage'),get('/api/stats'),get('/data/stats.json'),get('/api/teaching?scope=model')]);
 box.textContent='';
 box.append(el('h2','함께 개선하는 판독기'));
 box.append(el('p','익명 통계와 교정 의견으로 함께해 주시는 모든 분께 감사드려요. 여러분의 참여는 잘못된 안내를 줄이고 판독 기준을 다듬는 데 도움이 돼요.'));
 const grid=el('div');grid.className='progress-grid';
 grid.append(metric('최근 30일 집계 참여 브라우저',usage?(usage.browsers||0).toLocaleString()+'개':'불러오기 실패'),metric('최근 30일 분석 이용',usage?usage.count.toLocaleString()+'회':'불러오기 실패'),metric('최근 1년 익명 통계 참여',stats?stats.n.toLocaleString()+'건':'불러오기 실패'),metric('교정 반영 관찰 항목',teach?teach.adjustments.length+'개':'불러오기 실패'),metric('통계로 학습된 항목',model?(model.learned||0)+'개':'불러오기 실패'));
 box.append(grid);
 if(stats){
 const p=sampleProgress(stats.outcome,model?.minAnswers||20);
 box.append(el('h3','학습용 최소 표본 모집 '+p.percent+'%'));
 const bar=el('progress');bar.max=100;bar.value=p.percent;bar.setAttribute('aria-label','학습용 최소 표본 모집 진행률');box.append(bar);
 box.append(el('p','일반 리더 응답 '+p.normal+' / '+p.target+'건 · 피해 응답 '+p.harm+' / '+p.target+'건 (각 그룹 목표는 '+p.target+'건, 초과 응답은 계속 쌓여요)'));
 box.append(el('p','100%는 두 응답 그룹의 최소 표본 조건을 채웠다는 뜻이에요. 항목별 표본이 부족하면 아직 학습되지 않을 수 있어요. 정답 검증이나 정확도 100%를 뜻하지 않아요.'));
 }
 const note=el('p','정확도 향상률: 아직 측정하지 않았어요. 같은 정답 자료로 개선 전후를 비교해야 계산할 수 있어요. 이용 횟수는 집계 시작(2026.10.22) 이후 최근 30일의 기록이며, 방문자 수·서로 다른 사람 수가 아니에요. 브라우저 수는 별도로 동의하고 분석한 브라우저만 세요. 같은 사람의 다른 기기·브라우저, 비공개 모드, 저장 정보 삭제는 중복 집계될 수 있어요. 동일 탭의 30분 내 반복 분석과 처음 보이는 예시는 제외해요. 통계 참여 건수도 전체 사용 횟수와 다르고, 최대 30분 늦게 갱신될 수 있어요.');note.className='note';box.append(note);
 const link=el('a','자세한 통계·학습 기록 보기');link.href='/stats.html';box.append(link);
}
if(box)render();
window.addEventListener('tc:stats-sent',render);
// 본문·질문·결과·IP를 전송하지 않아요. 로컬 입력이 있었던 탭만 무작위 중복방지키를 전송해요.
const txt=document.getElementById('txt');
let timer,dirty=false,inFlight=false,localEvent=null;
const pref=document.getElementById('usageOptOut');
try{if(pref)pref.checked=localStorage.getItem('tc_usage_off')==='1';}catch(e){}
if(pref)pref.addEventListener('change',()=>{try{localStorage.setItem('tc_usage_off',pref.checked?'1':'0');}catch(e){}clearTimeout(timer);});
const browserPref=document.getElementById('browserCountOptIn');
try{if(browserPref)browserPref.checked=localStorage.getItem('tc_browser_opt_in')==='1';}catch(e){}
if(browserPref)browserPref.addEventListener('change',()=>{try{localStorage.setItem('tc_browser_opt_in',browserPref.checked?'1':'0');if(!browserPref.checked)localStorage.removeItem('tc_browser_key');}catch(e){}if(browserPref.checked)record();});
function browserEvent(){
 let consent=false;try{consent=localStorage.getItem('tc_browser_opt_in')==='1';}catch(e){}
 if(!consent)return {};
 let b=null;try{b=JSON.parse(localStorage.getItem('tc_browser_key')||'null');}catch(e){}
 if(!b || Date.now()-b.at>=30*864e5)b={id:Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join(''),at:Date.now()};
 try{localStorage.setItem('tc_browser_key',JSON.stringify(b));}catch(e){return {};}
 return {browser:b.id,browserConsent:true,age14:true};
}
function disabled(){try{return localStorage.getItem('tc_usage_off')==='1';}catch(e){return false;}}
async function record(){
 if(!dirty || !txt?.value.trim() || inFlight || disabled())return;
 let event=localEvent;try{event=JSON.parse(sessionStorage.getItem('tc_usage_session')||'null')||event;}catch(e){}
 const browser=browserEvent();
 if(event && Date.now()-event.at<30*60e3 && event.sent && (!browser.browser || event.browserSent===browser.browser))return;
 if(!event || Date.now()-event.at>=30*60e3)event={id:Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join(''),at:Date.now(),sent:false};
 localEvent=event;try{sessionStorage.setItem('tc_usage_session',JSON.stringify(event));}catch(e){}
 inFlight=true;
 try{const r=await fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({id:event.id},browser))});if(r.ok){event.sent=true;if(browser.browser)event.browserSent=browser.browser;localEvent=event;try{sessionStorage.setItem('tc_usage_session',JSON.stringify(event));}catch(e){}render();}}catch(e){}finally{inFlight=false;}
}

if(txt){txt.addEventListener('input',()=>{dirty=true;clearTimeout(timer);},true);window.addEventListener('tc:analysis',()=>{if(dirty){clearTimeout(timer);timer=setTimeout(record,2000);}});}
