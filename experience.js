(function(){
'use strict';
var out=document.getElementById('out'),input=document.getElementById('txt');if(!out||!input)return;
function el(tag,text){var n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
function panel(){
 if(!input.value.trim()||document.getElementById('experiencePanel'))return;
 var box=el('section');box.className='panel';box.id='experiencePanel';box.appendChild(el('h3','판독기가 도움이 되었나요?'));
 box.appendChild(el('p','도움이 된 점이나 아쉬운 점을 알려 주세요. 리딩 원문은 자동으로 첨부하지 않으며, 의견은 운영자만 확인해요. 참여하지 않아도 모든 기능을 이용할 수 있어요.'));
 var options=el('div');options.className='checks';
 [['helpful','도움이 됐어요'],['mixed','조금 도움이 됐어요'],['unhelpful','아쉬워요']].forEach(function(r){var label=el('label'),radio=el('input');radio.type='radio';radio.name='experienceRating';radio.value=r[0];label.append(radio,document.createTextNode(' '+r[1]));options.appendChild(label);});box.appendChild(options);
 var label=el('label','의견 (선택, 1,000자 이내)');label.className='f';var comment=el('textarea');comment.maxLength=1000;comment.setAttribute('aria-label','개선 의견');comment.placeholder='어느 부분이 도움이 됐거나 아쉬웠나요? 내 경험만 직접 적고, 개인정보·다른 사람의 리딩·사진은 포함하지 마세요.';label.appendChild(comment);box.appendChild(label);
 function check(text){var l=el('label'),c=el('input');l.className='check';c.type='checkbox';l.append(c,document.createTextNode(text));box.appendChild(l);return c;}
 var age=check('만 14세 이상이에요.'),rights=check('직접 작성한 의견이며 타인의 글·개인정보를 포함하지 않았어요.'),consent=check('의견 처리에 동의해요. 항목: 도움 여부·의견·작성 시각·중복 방지값·도배 방지용 IP 해시. 목적: 사용성 개선과 부정 이용 방지. 의견은 최대 180일, 요청 횟수 기록은 24시간 후 만료돼요.');
 var link=el('a','개인정보 처리방침');link.href='/privacy.html';box.appendChild(link);
 var b=el('button','의견 보내기');b.className='primary';b.type='button';var msg=el('p');msg.className='msg';msg.setAttribute('role','status');var nonce='';
 b.onclick=function(){
 var chosen=box.querySelector('input[name="experienceRating"]:checked');
 if(!chosen||!age.checked||!rights.checked||!consent.checked){msg.textContent='도움 여부와 아래 확인 항목을 선택해 주세요.';return;}
 if(!nonce)nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),function(x){return x.toString(16).padStart(2,'0');}).join('');
 b.disabled=true;msg.textContent='보내는 중…';
 fetch('/api/experience',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:nonce,rating:chosen.value,comment:comment.value,age14:age.checked,rights:rights.checked,consent:consent.checked})}).then(function(r){return r.json().then(function(j){j.ok=r.ok;return j;});}).then(function(j){msg.textContent=j.message||(j.ok?'접수했어요.':'보내지 못했어요.');if(j.ok){comment.value='';b.textContent='의견 전달 완료';if(j.id)msg.textContent+=' 접수번호: '+j.id;}else b.disabled=false;}).catch(function(){msg.textContent='인터넷 연결을 확인해 주세요.';b.disabled=false;});
 };box.append(b,msg);out.appendChild(box);held=box;
}
// 분석 결과가 새로 그려지면 입력 중인 의견은 보존해요.
var held=null;
input.addEventListener('input',function(){held=document.getElementById('experiencePanel');},true);
window.addEventListener('tc:analysis',function(){if(held && !held.isConnected){out.appendChild(held);}panel();});
if(window.__tcLast)panel();
})();
