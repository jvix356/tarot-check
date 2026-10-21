/* 타로 리딩 판독기 · 익명 통계 참여 (선택)
   - 판독 결과 아래에 "통계 참여" 칸을 붙여요. 이용자가 직접 동의하고 버튼을 눌렀을 때만 보내요.
   - 보내는 것: 관찰 항목 이름, 주의 표현 종류, 카드 칸 수, 글 길이 구간, 스프레드 이름, 이용자가 고른 결과
   - 보내지 않는 것: 리딩 본문, 질문, 평소 말투, 아이디·계좌·연락처, 계정 정보. 서버는 IP도 저장하지 않아요. */
(function () {
  'use strict';
  var out = document.getElementById('out');
  if (!out) return;
  var last = null, pub = null, pubLoading = false, sentKeys = {};
  var OUT = [['normal', '일반 리더였어요'], ['harm', '돈·피해 문제가 있었어요'], ['unknown', '아직 모르겠어요']];

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function throttled() {
    try {
      var a = JSON.parse(localStorage.getItem('tc_stats_sent') || '[]').filter(function (t) { return Date.now() - t < 3600e3; });
      return a.length >= 5;
    } catch (e) { return false; }
  }
  function markSent() {
    try {
      var a = JSON.parse(localStorage.getItem('tc_stats_sent') || '[]').filter(function (t) { return Date.now() - t < 3600e3; });
      a.push(Date.now()); localStorage.setItem('tc_stats_sent', JSON.stringify(a));
    } catch (e) {}
  }
  function loadPublic(cb) {
    if (pub || pubLoading) return cb && pub && cb();
    pubLoading = true;
    fetch('/api/stats').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { pub = j; pubLoading = false; if (cb) cb(); })
      .catch(function () { pubLoading = false; });
  }

  function statsNote(d) {
    var box = el('div', { class: 'stats-note' });
    if (!pub || !pub.n) { box.appendChild(el('p', { class: 'note', text: '아직 모인 통계가 적어요. 참여가 쌓이면 "일반 리더의 글에서도 이 표현이 얼마나 나오는지"를 여기에 보여드려요.' })); return box; }
    var rows = (d.signals || []).map(function (l) { return (pub.signals || []).filter(function (s) { return s.label === l; })[0]; }).filter(Boolean);
    box.appendChild(el('p', { class: 'note', text: '지금까지 ' + pub.n + '건이 익명 통계에 참여했어요. (일반 리더 응답 ' + pub.outcome.normal + '건 · 피해 응답 ' + pub.outcome.harm + '건)' }));
    if (!rows.length) return box;
    var tb = el('tbody');
    rows.forEach(function (s) {
      tb.appendChild(el('tr', null, [el('td', { text: s.label }),
        el('td', { class: 'n', text: s.inNormal == null ? '응답 부족' : s.inNormal + '%' }),
        el('td', { class: 'n', text: s.inHarm == null ? '응답 부족' : s.inHarm + '%' })]));
    });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'sig' }, [
      el('thead', null, [el('tr', null, [el('td', { class: 'note', text: '이번 글에서 보인 표현' }), el('td', { class: 'note', text: '일반 리더 글에서도' }), el('td', { class: 'note', text: '피해 사례 글에서' })])]), tb])]));
    box.appendChild(el('p', { class: 'note', text: '숫자는 참여자가 고른 결과를 그대로 합산한 거라 검증된 값이 아니에요. 일반 리더 글에서도 자주 보이는 표현이라면, 그 표현만으로 의심하지 마세요. 응답이 ' + pub.minPublic + '건 미만인 항목은 숨겨요.' }));
    return box;
  }

  function panel(d) {
    var key = JSON.stringify([d.signals, d.flags, d.cards, d.len]);
    var radios = OUT.map(function (o, i) {
      var r = el('input', { type: 'radio', name: 'tcOutcome', value: o[0] }); if (i === 2) r.checked = true;
      return el('label', null, [r, ' ' + o[1]]);
    });
    var consent = el('input', { type: 'checkbox', id: 'tcConsent' });
    var msg = el('p', { class: 'msg note', role: 'status' });
    var btn = el('button', { class: 'ghost', type: 'button', text: '익명 통계 보내기', disabled: '' });
    consent.addEventListener('change', function () { btn.disabled = !consent.checked || !!sentKeys[key]; });
    btn.addEventListener('click', function () {
      if (!consent.checked) return;
      if (throttled()) { msg.textContent = '짧은 시간에 너무 많이 보냈어요. 잠시 후 다시 시도해 주세요.'; return; }
      var o = (document.querySelector('input[name="tcOutcome"]:checked') || {}).value || 'unknown';
      btn.disabled = true; msg.textContent = '보내는 중…';
      fetch('/api/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        consent: true, outcome: o, signals: d.signals, flags: d.flags, cards: d.cards, len: d.len, spread: d.spread }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          msg.textContent = x.ok ? (x.j.message || '보냈어요.') : (x.j.message || '보내지 못했어요.');
          if (x.ok) { sentKeys[key] = true; markSent(); } else btn.disabled = false;
        })
        .catch(function () { msg.textContent = '인터넷 연결을 확인해 주세요.'; btn.disabled = false; });
    });
    if (sentKeys[key]) msg.textContent = '이 결과는 이미 통계에 보냈어요.';
    var noteSlot = el('div');
    var p = el('section', { class: 'panel', id: 'statsPanel', 'aria-labelledby': 'stats-h' }, [
      el('h3', { id: 'stats-h', text: '익명 통계 참여 (선택)' }),
      el('p', { class: 'note', text: '평범하게 리딩하는 분들이 억울하게 의심받지 않도록, 어떤 표현이 일반 리더와 피해 사례에서 각각 얼마나 나오는지 모으고 있어요. 참여는 선택이에요.' }),
      el('details', { class: 'more' }, [el('summary', { text: '보내는 것과 보내지 않는 것' }), el('div', { class: 'body' }, [
        el('p', { class: 'note', text: '보내는 것: 위에서 찾은 표현 항목의 이름, 주의 표현 종류, 카드 칸 수, 글 길이 구간(300자 미만 등), 스프레드 이름, 아래에서 고른 결과.' }),
        el('p', { class: 'note', text: '보내지 않는 것: 리딩 본문, 내 질문, 평소 말투, 아이디·계좌·연락처, 로그인 정보. 서버는 IP 주소도 저장하지 않아요.' }),
        el('p', { class: 'note', text: '보낸 통계는 날짜별 합계로만 남고 개별 기록으로 되돌릴 수 없어요. 그래서 보낸 뒤에는 개별 삭제가 어려워요. 합계는 판독 기준을 고치는 데만 써요.' })])]),
      el('p', { class: 'note', style: 'font-weight:600;color:var(--ink);margin:0', text: '이 리더와의 상담은 어땠나요?' }),
      el('div', { class: 'checks' }, radios),
      el('label', { class: 'check' }, [consent, el('span', { text: ' 위 항목을 익명 통계로 보내는 데 동의해요.' })]),
      el('div', { class: 'btns' }, [btn]), msg, noteSlot]);
    loadPublic(function () { noteSlot.textContent = ''; noteSlot.appendChild(statsNote(d)); });
    return p;
  }

  function show(d) {
    last = d || {};
    var old = document.getElementById('statsPanel'); if (old) old.remove();
    out.appendChild(panel(last));
  }
  window.addEventListener('tc:analysis', function (e) { show(e.detail); });
  // app.js가 먼저 실행돼 첫 결과를 이미 그렸다면 그 결과로 바로 표시해요
  if (window.__tcLast && out.children.length) show(window.__tcLast);
})();
