(function(){
'use strict';
var $=function(s){return document.querySelector(s);},token='',me=null,data=null;
try{token=localStorage.getItem('tc_contributor')||'';}catch(e){}
function el(tag,text){var n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
function msg(id,text){$(id).textContent=text||'';}
function api(body,scope){return fetch('/api/teaching'+(scope?'?scope='+scope:''),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:token?'Bearer '+token:''},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json().then(function(j){j.ok=r.ok;return j;});}).catch(function(){return {ok:false,message:'인터넷 연결을 확인해 주세요.'};});}
function save(t){token=t;try{t?localStorage.setItem('tc_contributor',t):localStorage.removeItem('tc_contributor');}catch(e){} }
var states={pending:'운영자 확인 대기',voting:'공동 검토 중',accepted:'반영됨',rejected:'보류·반려'};
function card(p,mine){var a=el('article');a.className='post';a.appendChild(el('h3',p.signal));a.appendChild(el('p',(data.kinds[p.kind]||p.kind)+' · '+states[p.status]));a.appendChild(el('p','예시: '+p.example));a.appendChild(el('p','교정 설명: '+p.explanation));a.appendChild(el('p','동의 '+p.counts.agree+' · 반대 '+p.counts.disagree+' · 판단 어려움 '+p.counts.unsure));if(p.answer)a.appendChild(el('p','운영자 검토: '+p.answer));
if(!mine&&p.status==='voting'){var group=el('div');group.className='row';[['agree','맞아요'],['disagree','아니에요'],['unsure','판단 어려워요']].forEach(function(c){var b=el('button',c[1]+(me&&me.votes[p.id]===c[0]?' (내 선택)':''));b.disabled=!me;b.onclick=function(){b.disabled=true;api({action:'vote',id:p.id,choice:c[0]}).then(function(r){if(!r.ok){b.disabled=false;status.textContent=r.message||'처리하지 못했어요.';}else load();});};group.appendChild(b);});var status=el('p');status.setAttribute('role','status');a.appendChild(group);a.appendChild(status);}return a;}
function load(){return api().then(function(r){if(!r.ok)return msg('#accountMsg',r.message||'불러오지 못했어요.');data=r;$('#signal').textContent='';r.signals.forEach(function(s){var o=el('option',s);o.value=s;$('#signal').appendChild(o);});return token?api(null,'mine'):null;}).then(function(r){me=r&&r.ok?r:null;if(r&&!r.ok)save('');render();});}
function render(){if(!data)return;$('#join').hidden=!!me;$('#member').hidden=!me;$('#proposalForm').hidden=!me;$('#minePanel').hidden=!me;
if(me){$('#who').textContent='참여 닉네임: '+me.nickname;$('#rankOpt').checked=me.listed;$('#mine').textContent='';me.proposals.forEach(function(p){$('#mine').appendChild(card(p,true));});if(!me.proposals.length)$('#mine').textContent='아직 제출한 제안이 없어요.';}
$('#proposals').textContent='';data.proposals.forEach(function(p){$('#proposals').appendChild(card(p,false));});if(!data.proposals.length)$('#proposals').textContent='아직 공동 검토에 올라온 제안이 없어요.';
$('#ranking').textContent='';data.leaderboard.forEach(function(p){$('#ranking').appendChild(el('p',p.rank+'위 · '+p.nickname+' · 반영 기여 '+p.score+'점'));});if(!data.leaderboard.length)$('#ranking').textContent='검토 반영된 기여가 쌓이면 순위가 표시돼요.';
}
$('#register').onclick=function(){var b=this;b.disabled=true;api({action:'register',nickname:$('#nickname').value,listed:$('#listed').checked,consent:$('#consent').checked}).then(function(r){b.disabled=false;if(!r.ok)return msg('#accountMsg',r.message);save(r.token);msg('#accountMsg','참여를 시작했어요. 필요한 경우 복구키를 별도로 보관해 주세요.');load();});};
$('#recover').onclick=function(){var candidate=$('#recovery').value.trim();if(!/^[a-f0-9]{64}$/.test(candidate))return msg('#accountMsg','복구키 형식을 확인해 주세요.');var old=token;token=candidate;api(null,'mine').then(function(r){if(!r.ok){token=old;return msg('#accountMsg','복구키를 확인하지 못했어요.');}save(candidate);$('#recovery').value='';load();});};
$('#submit').onclick=function(){var b=this;b.disabled=true;api({action:'submit',signal:$('#signal').value,kind:$('#kind').value,example:$('#example').value,explanation:$('#explanation').value,rights:$('#rights').checked}).then(function(r){b.disabled=false;msg('#submitMsg',r.message||'처리하지 못했어요.');if(r.ok){$('#example').value='';$('#explanation').value='';$('#rights').checked=false;load();}});};
$('#keyToggle').onclick=function(){var k=$('#ownKey');k.hidden=!k.hidden;k.type=k.hidden?'password':'text';k.value=k.hidden?'':token;};
$('#savePrivacy').onclick=function(){api({action:'privacy',listed:$('#rankOpt').checked}).then(function(r){msg('#accountMsg',r.ok?'순위 공개 설정을 저장했어요.':r.message);if(r.ok)load();});};
$('#logout').onclick=function(){save('');$('#ownKey').value='';$('#ownKey').hidden=true;load();};
$('#withdraw').onclick=function(){if(!window.confirm('내 닉네임·제안·투표를 모두 삭제할까요? 되돌릴 수 없어요.'))return;api({action:'withdraw'}).then(function(r){if(!r.ok)return msg('#accountMsg',r.message);save('');$('#ownKey').value='';$('#ownKey').hidden=true;msg('#accountMsg','내 참여 정보를 삭제했어요.');load();});};
$('#refresh').onclick=load;load();
})();
