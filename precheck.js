/* 타로 리딩 판독기 · 입금 전 확인 메뉴
   - 받은 계좌번호·전화번호·오픈채팅 링크를 정리하고, 공식 조회 서비스로 바로 확인할 수 있게 안내해요.
   - 입력한 번호는 이 브라우저 안에서만 쓰고 서버로 보내거나 저장하지 않아요.
   - 조회 사이트 주소에 번호를 붙여 보내지 않아요. 복사해서 직접 붙여넣는 방식이에요.
   - '동일인 의심 비교' 메뉴에 넣은 계정 글·계좌와 같은 번호가 있는지도 이 브라우저 안에서 대조해요. */
(function () {
  'use strict';
  var tabs = document.querySelector('nav.tabs[role="tablist"]');
  var read = document.getElementById('readView'), cmp = document.getElementById('cmpView');
  if (!tabs || !read || !cmp) return;

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

  /* ---------- 탭 ---------- */
  var tab = el('button', { role: 'tab', id: 'tab-pay', 'data-v': 'pay', 'aria-selected': 'false', 'aria-controls': 'payView', text: '입금 전 확인' });
  tabs.appendChild(tab);
  var view = el('div', { id: 'payView', role: 'tabpanel', 'aria-labelledby': 'tab-pay', style: 'display:flex;flex-direction:column;gap:20px' });
  view.hidden = true;
  cmp.parentNode.insertBefore(view, cmp.nextSibling);
  function show(on) {
    view.hidden = !on;
    if (on) {
      read.hidden = true; cmp.hidden = true;
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', String(b === tab)); });
      try { history.replaceState(null, '', '#pay'); } catch (e) {}
    }
  }
  tab.addEventListener('click', function () { show(true); });
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b !== tab) show(false); });
  // 판독 결과의 경고 칸 등에서 #pay 링크로 들어올 수 있게
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href="#pay"]'); if (a) { e.preventDefault(); show(true); window.scrollTo(0, tabs.offsetTop - 10); } });

  /* ---------- 번호 정리 ---------- */
  function extract(s) {
    var out = [], seen = {};
    function add(kind, v, shown) { var k = kind + v; if (seen[k]) return; seen[k] = 1; out.push({ kind: kind, v: v, shown: shown || v }); }
    (s.match(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g) || []).forEach(function (x) { var d = x.replace(/\D/g, ''); add('전화번호', d, d.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')); });
    (s.match(/\d[\d\s-]{8,22}\d/g) || []).forEach(function (x) { var d = x.replace(/\D/g, ''); if (d.length >= 10 && d.length <= 16 && !/^01[016789]/.test(d) && !/^(19|20)\d{6}$/.test(d)) add('계좌번호', d); });
    (s.match(/open\.kakao\.com\/[^\s)]+/gi) || []).forEach(function (x) { add('오픈채팅', x.toLowerCase()); });
    (s.match(/@[A-Za-z0-9._]{3,30}/g) || []).forEach(function (x) { add('SNS 아이디', x.toLowerCase()); });
    return out;
  }
  function compareTargets() {
    var list = [];
    Array.prototype.forEach.call(document.querySelectorAll('#acctList .acct'), function (d) {
      var tag = d.querySelector('.tag'), txt = ((d.querySelector('.atxt') || {}).value || '') + '\n' + ((d.querySelector('.aex') || {}).value || '') + '\n' + ((d.querySelector('.aid') || {}).value || '');
      if (/\(예시\)/.test((d.querySelector('.aid') || {}).value || '')) return; // 예시 글은 대조하지 않아요
      list.push({ key: tag ? tag.textContent : '?', ids: extract(txt).map(function (x) { return x.kind + x.v; }) });
    });
    return list;
  }

  var input = el('textarea', { id: 'payInput', class: 'short', spellcheck: 'false', maxlength: '2000', placeholder: '예: 국민 123456-78-901234 홍길동 / 010-1234-5678 / open.kakao.com/o/...', 'aria-label': '확인할 계좌·번호' });
  var bank = el('input', { type: 'text', id: 'payName', maxlength: '40', placeholder: '예금주 이름 (안내받은 대로, 선택)', 'aria-label': '예금주 이름' });
  var res = el('div');
  function copyBtn(text) {
    var b = el('button', { class: 'small', type: 'button', text: '복사' });
    b.addEventListener('click', function () {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { b.textContent = '복사됨'; }, function () { b.textContent = '직접 선택해 복사해 주세요'; });
      setTimeout(function () { b.textContent = '복사'; }, 1500);
    });
    return b;
  }
  function render() {
    res.textContent = '';
    var items = extract(input.value);
    if (!items.length) { res.appendChild(el('p', { class: 'note', text: '계좌번호·전화번호·오픈채팅 링크를 넣으면 조회할 번호를 정리해 드려요.' })); return; }
    var targets = compareTargets();
    var tb = el('tbody');
    items.forEach(function (it) {
      var hits = targets.filter(function (t) { return t.ids.indexOf(it.kind + it.v) >= 0; }).map(function (t) { return t.key; });
      tb.appendChild(el('tr', null, [el('td', { text: it.kind }), el('td', { class: 'ex', text: it.shown }), el('td', null, [copyBtn(it.v)]),
        el('td', { text: hits.length ? '비교 메뉴의 계정 ' + hits.join(', ') + '에도 있어요' : '' })]));
    });
    res.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'sig' }, [tb])]));
    if (items.some(function (it) { return targets.some(function (t) { return t.ids.indexOf(it.kind + it.v) >= 0; }); }))
      res.appendChild(el('p', { class: 'hit', text: '동일인 의심 비교에 넣은 다른 계정 글에도 같은 번호가 있어요. 계정 이름이 달라도 같은 계좌·번호를 쓰고 있다면 입금하기 전에 꼭 조회해 보세요.' }));
    var nm = bank.value.trim();
    if (nm) res.appendChild(el('p', { class: 'note', text: '상담하는 사람의 활동명과 예금주 이름(' + nm + ')이 다르거나, 입금할 때마다 계좌가 바뀐다면 더 주의하세요. 다른 사람 명의 계좌(대포통장)를 쓰는 경우가 있어요.' }));
  }
  input.addEventListener('input', render);
  bank.addEventListener('input', render);

  var link = function (href, text) { return el('a', { href: href, target: '_blank', rel: 'noopener noreferrer', class: 'navbtn', text: text }); };

  view.appendChild(el('section', { class: 'panel', 'aria-labelledby': 'pay-h' }, [
    el('h2', { id: 'pay-h', text: '입금하기 전에 꼭 확인하세요' }),
    el('p', { style: 'margin:0', text: '상담비·기도비·부적값을 보내기 전에, 받은 계좌번호와 전화번호가 사기 피해로 신고된 적 있는지 공식 서비스에서 먼저 조회해 보세요. 1분이면 돼요.' }),
    el('label', { class: 'f', for: 'payInput' }, ['받은 계좌·전화번호·오픈채팅 링크', el('small', { text: '대화에서 그대로 복사해 넣어도 돼요. 이 브라우저 안에서만 정리하고, 서버로 보내거나 저장하지 않아요.' }), input]),
    el('label', { class: 'f', for: 'payName' }, ['예금주 이름 (선택)', bank]),
    res,
    el('h3', { text: '조회하는 곳' }),
    el('ol', { class: 'steps' }, [
      el('li', null, [el('b', { text: '더치트' }), ' · 계좌번호·전화번호를 넣으면 사기 피해 신고 이력을 보여줘요. 위에서 복사한 번호를 붙여넣어 조회하세요. ', link('https://www.thecheat.co.kr', '더치트 열기')]),
      el('li', null, [el('b', { text: '경찰청' }), ' · 경찰청 사이버수사국 누리집과 사이버캅 앱에서 사기 의심 전화·계좌번호의 신고 이력을 조회할 수 있어요. 피해를 입었다면 같은 곳에서 신고해요. ', link('https://ecrm.police.go.kr', '경찰청 사이버범죄 신고시스템')]),
      el('li', null, [el('b', { text: '토스로 보낼 때' }), ' · 토스 송금 화면에서 받는 계좌·연락처를 입력하면 경찰청에 신고된 이력이 있는지 자동으로 확인하고, 의심되면 경고를 띄워요(사기의심 사이렌). 경고가 뜨면 보내지 마세요.']),
      el('li', null, [el('b', { text: '은행 앱' }), ' · 이용하는 은행 앱의 이체 화면에서도 사기 의심 계좌 경고가 뜨는지 확인하세요. 경고가 떴다면 이체를 멈추세요.'])]),
    el('p', { class: 'caveat', text: '조회에 나오지 않는다고 안전하다는 뜻은 아니에요. 새 계좌나 아직 신고되지 않은 계좌일 수 있어요. 반대로 조회에 나온 계좌라도 이 사이트가 사기라고 확정하는 건 아니에요. 확인된 결과는 각 조회 서비스의 기준을 따라요.' }),
    el('h3', { text: '이럴 땐 보내지 마세요' }),
    el('ul', { class: 'ev' }, [
      ['ai', '조회했더니 피해 신고 이력이 있다', '입금하지 말고 대화 캡처를 남겨 두세요.'],
      ['warn', '활동명과 예금주가 다르거나, 계좌가 자주 바뀐다', '다른 사람 명의 계좌를 쓰는 경우가 있어요.'],
      ['warn', '오늘 안에·지금 바로 보내라고 재촉한다', '서두르게 할수록 한 번 더 확인하세요.'],
      ['warn', '부적·기도·굿 비용을 따로 요구한다', '리딩 결과를 이유로 추가 결제를 권하면 주변과 상의하세요.']
    ].map(function (x) { return el('li', { class: x[0] }, [el('div', null, [el('p', { style: 'font-weight:600', text: x[1] }), el('p', { class: 'reason', text: x[2] })])]); })),
    el('h3', { text: '이미 보냈다면' }),
    el('p', { class: 'note', text: '바로 보낸 은행(또는 토스) 고객센터에 연락해 지급정지를 요청하고, 112나 경찰청 사이버범죄 신고시스템에 신고하세요. 입금 내역, 대화 캡처, 상대 계정 주소를 지우지 말고 모아 두세요.' }),
    el('p', { class: 'note', text: '받은 계좌번호를 게시판 공개 글에 쓰지 마세요. 제보할 때는 "운영자에게만 전달" 칸에 적어 주세요. 확인되지 않은 계좌를 공개하면 명예훼손 등 법적 문제가 생길 수 있어요.' })]));
  render();

  // 판독 결과에서 결제 관련 주의 표현이 나오면 이 메뉴로 안내해요
  function hint(d) {
    var f = (d && d.flags) || [];
    if (!f.length) return;
    var out = document.getElementById('out'); if (!out || document.getElementById('payHint')) return;
    out.insertBefore(el('section', { class: 'panel danger', id: 'payHint' }, [
      el('h3', { text: '입금하기 전에 계좌부터 조회해 보세요' }),
      el('p', { style: 'margin:0', text: '결제나 입금 이야기가 있는 리딩이에요. 보내기 전에 받은 계좌·번호를 공식 서비스에서 조회해 보세요.' }),
      el('div', { class: 'btns' }, [el('a', { href: '#pay', class: 'navbtn', text: '입금 전 확인하기' })])]), out.children[1] || null);
  }
  window.addEventListener('tc:analysis', function (e) { hint(e.detail); });
  if (window.__tcLast) hint(window.__tcLast);
  var st = document.createElement('style');
  st.textContent = '#payView td button{white-space:nowrap}#payView td.ex{word-break:break-all}';
  document.head.appendChild(st);
  if (location.hash === '#pay') show(true);
})();
