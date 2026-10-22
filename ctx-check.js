/* 타로 리딩 판독기 · 후기·정황 점검
   - 어떻게 알게 됐는지, 어떤 점이 의심되는지, 후기 글·대화·사진을 넣고 스스로 따져 볼 수 있게 도와줘요.
   - 넣은 글·사진은 이 브라우저 메모리에서만 처리해요. 서버로 보내지 않고, 저장(localStorage 등)하지 않아요. 새로고침하면 사라져요.
   - 결과는 판단을 돕는 참고 질문이에요. 조작·바이럴·사기를 확정하지 않아요. */
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
  var tab = el('button', { role: 'tab', id: 'tab-ctx', 'data-v': 'ctx', 'aria-selected': 'false', 'aria-controls': 'ctxView', text: '후기·정황 점검' });
  tabs.appendChild(tab);
  var view = el('div', { id: 'ctxView', role: 'tabpanel', 'aria-labelledby': 'tab-ctx', style: 'display:flex;flex-direction:column;gap:20px' });
  view.hidden = true;
  cmp.parentNode.insertBefore(view, cmp.nextSibling);
  function show(on) {
    view.hidden = !on;
    if (on) {
      read.hidden = true; cmp.hidden = true;
      var pay = document.getElementById('payView'); if (pay) pay.hidden = true;
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', String(b === tab)); });
      try { history.replaceState(null, '', '#ctx'); } catch (e) {}
    }
  }
  tab.addEventListener('click', function () { show(true); });
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b !== tab) show(false); });

  /* ---------- 화면 ---------- */
  var HOW = [['', '선택해 주세요'], ['dm', '상대가 먼저 DM·댓글로 연락해 왔어요'], ['feed', '스레드·인스타 추천 피드에서 봤어요'], ['review', '후기 글을 보고 찾아갔어요'], ['ad', '광고·이벤트(무료 리딩 등)를 보고'], ['friend', '아는 사람 소개'], ['search', '검색해서 찾았어요'], ['etc', '기타']];
  var SUS = [
    ['prepay', '선입금부터 요구해요'], ['extra', '기도비·부적·추가 리딩 결제를 권해요'], ['fear', '겁주는 말(액운·조상·저주)을 해요'],
    ['sure', '100%·무조건 같은 장담을 해요'], ['fast', '긴 리딩이 너무 빨리 와요(몇 초~1분)'], ['same', '다른 사람이 받은 리딩과 내용이 비슷해요'],
    ['reviews', '후기가 너무 비슷하거나 한꺼번에 올라와요'], ['newacc', '후기 계정이 새로 만든 계정 같아요'], ['photo', '후기 캡처 사진이 이상해 보여요'],
    ['none', '특별히 의심되지는 않아요 · 그냥 확인해 보고 싶어요'],
  ];
  var how = el('select', { id: 'ctxHow', 'aria-label': '어떻게 알게 됐나요' }, HOW.map(function (h) { return el('option', { value: h[0], text: h[1] }); }));
  var sus = SUS.map(function (s) { return el('label', { class: 'check' }, [el('input', { type: 'checkbox', value: s[0] }), ' ' + s[1]]); });
  var conv = el('textarea', { id: 'ctxConv', spellcheck: 'false', placeholder: '받은 리딩·대화 내용을 붙여넣으세요 (이름·연락처는 지워 주세요)' });
  var reviews = el('textarea', { id: 'ctxReviews', spellcheck: 'false', placeholder: '후기 글을 여러 개 붙여넣고, 후기 사이는 빈 줄 한 줄로 나눠 주세요' });
  var photos = el('input', { type: 'file', accept: 'image/*', multiple: 'multiple', 'aria-label': '후기·대화 캡처 사진' });
  var out = el('div', { id: 'ctxOut', 'aria-live': 'polite' });

  view.appendChild(el('section', { class: 'panel' }, [
    el('h2', { text: '후기·정황 점검' }),
    el('p', { class: 'note' }, [el('b', { text: '여기에 넣은 글과 사진은 이 브라우저 안에서만 살펴보고, 서버로 보내거나 저장하지 않아요. ' }), '새로고침하거나 창을 닫으면 사라져요. 결과는 스스로 따져 볼 수 있게 돕는 참고 질문이고, 조작·바이럴·사기를 확정하지 않아요.']),
    el('label', { class: 'f' }, ['1. 이 리더를 어떻게 알게 됐나요?', how]),
    el('fieldset', { class: 'f' }, [el('legend', { text: '2. 어떤 점이 의심되나요? (여러 개 선택)' })].concat(sus)),
    el('label', { class: 'f' }, ['3. 받은 리딩·대화 (선택)', conv]),
    el('label', { class: 'f' }, ['4. 후기 글 여러 개 (선택) — 같은 사람이 여러 계정으로 쓴 것처럼 비슷한지 봐요', reviews]),
    el('label', { class: 'f' }, ['5. 후기·대화 캡처 사진 (선택, 여러 장) — 같은 사진 재사용·편집 앱 흔적을 이 기기에서만 확인해요', photos]),
    el('div', { class: 'btns' }, [el('button', { type: 'button', class: 'primary', text: '점검하기', onclick: run }), el('button', { type: 'button', class: 'ghost', text: '모두 지우기', onclick: wipe })]),
    out,
    el('p', { class: 'note' }, ['특정인을 공개적으로 지목하지 마세요. 의심 사례를 운영자에게 알리고 싶다면 ', el('a', { href: '/board.html#private-inbox', text: '비공개 제보' }), '로 보내 주세요(사진은 제보에 첨부되지 않아요). ', el('b', { text: '허위 사실로 제보하거나 퍼뜨리면 명예훼손·업무방해 등으로 처벌받을 수 있어요.' }), ' 돈 피해가 있다면 캡처·입금 내역을 보관하고 경찰(사이버범죄 신고시스템)에 신고하세요.']),
  ]));

  function wipe() {
    how.value = ''; sus.forEach(function (l) { l.querySelector('input').checked = false; });
    conv.value = ''; reviews.value = ''; photos.value = ''; out.textContent = '';
  }

  /* ---------- 후기 유사도 ---------- */
  function grams(s) { var t = s.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').toLowerCase(), g = new Set(); for (var i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3)); return g; }
  function jac(a, b) { var i = 0; a.forEach(function (x) { if (b.has(x)) i++; }); return a.size + b.size - i ? i / (a.size + b.size - i) : 0; }
  function endings(s) { return (s.match(/(?:[가-힣]{1,2})(?=[.!~ㅎㅋ\u2661\u2665\u{1F60A}\u{1F970}\u{1F64F}\u2728]*\s*$)/gmu) || []).join(','); }
  function sharedPhrase(a, b) {
    var wa = a.split(/\s+/), best = '';
    for (var i = 0; i < wa.length; i++) for (var j = i + 3; j <= Math.min(wa.length, i + 10); j++) { var p = wa.slice(i, j).join(' '); if (p.length > best.length && b.indexOf(p) >= 0) best = p; }
    return best;
  }
  function reviewCheck(text) {
    var list = text.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 10; }).slice(0, 30);
    if (list.length < 2) return null;
    var g = list.map(grams), pairs = [];
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
      var sim = jac(g[i], g[j]), ph = sharedPhrase(list[i], list[j]);
      if (sim >= 0.35 || ph.length >= 12) pairs.push({ a: i + 1, b: j + 1, sim: sim, ph: ph });
    }
    var emo = list.map(function (s) { return (s.match(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2661\u2665]/gu) || []).join(''); });
    var sameEmo = emo.filter(function (e, i) { return e && emo.indexOf(e) !== i; }).length;
    var lens = list.map(function (s) { return s.length; }), avg = lens.reduce(function (x, y) { return x + y; }, 0) / lens.length;
    var even = lens.every(function (l) { return Math.abs(l - avg) < avg * 0.2; });
    return { n: list.length, pairs: pairs, sameEmo: sameEmo, even: even, endings: endings(list.join('\n')) };
  }

  /* ---------- 사진 (이 기기 메모리에서만) ---------- */
  function readBytes(file) { return file.slice(0, 131072).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function exifInfo(u) {
    var txt = ''; for (var i = 0; i < u.length; i++) { var c = u[i]; txt += c >= 32 && c < 127 ? String.fromCharCode(c) : ' '; }
    var tools = (txt.match(/Photoshop|Lightroom|Snapseed|PicsArt|Picsart|Meitu|SNOW|B612|Canva|GIMP|Pixelmator|VSCO|Polarr|Fotor|Ulike|PhotoDirector|Remini|Illustrator/g) || []);
    var hasExif = /Exif/.test(txt);
    return { tools: Array.from(new Set(tools)), hasExif: hasExif, png: u[0] === 0x89 && u[1] === 0x50 };
  }
  function aHash(file) {
    return createImageBitmap(file).then(function (bmp) {
      var c = document.createElement('canvas'); c.width = 16; c.height = 16;
      var x = c.getContext('2d'); x.drawImage(bmp, 0, 0, 16, 16);
      var d = x.getImageData(0, 0, 16, 16).data, v = [], s = 0;
      for (var i = 0; i < d.length; i += 4) { var y = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; v.push(y); s += y; }
      var m = s / v.length, bits = v.map(function (y) { return y > m ? 1 : 0; });
      var info = { w: bmp.width, h: bmp.height, bits: bits }; bmp.close && bmp.close(); return info;
    });
  }
  function ham(a, b) { var n = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }

  function li(t, strong) { return el('li', null, strong ? [el('b', { text: strong }), ' ' + t] : [t]); }

  async function run() {
    out.textContent = '점검하는 중…';
    var picked = sus.filter(function (l) { return l.querySelector('input').checked; }).map(function (l) { return l.querySelector('input').value; });
    var qs = [];
    if (how.value === 'dm') qs.push(['먼저 연락해 오는 리더는 주의가 필요해요. 내가 신청한 적 없는데 무료 리딩·특가를 권했나요?', '먼저 연락']);
    if (how.value === 'ad') qs.push(['무료·이벤트 리딩 뒤에 유료 결제로 이어지는 경우가 많아요. 무료 리딩 끝에 결제 유도가 있었나요?', '광고·이벤트']);
    if (how.value === 'review') qs.push(['후기만 보고 찾아갔다면 아래 4번에 후기 여러 개를 넣어 비슷한지 확인해 보세요.', '후기 경로']);
    if (picked.indexOf('prepay') >= 0 || picked.indexOf('extra') >= 0) qs.push(['돈을 보내기 전에 "입금 전 확인" 탭에서 계좌·번호를 더치트·경찰청 조회로 확인해 보세요.', '결제']);
    if (picked.indexOf('fear') >= 0 && (picked.indexOf('extra') >= 0 || picked.indexOf('prepay') >= 0)) qs.push(['겁을 준 뒤 돈으로 해결하자고 하는 건 대표적인 피해 유형이에요. 결정을 미루고 주변에 물어보세요.', '겁주기+돈']);
    if (picked.indexOf('fast') >= 0) qs.push(['긴 리딩이 아주 빨리 왔다면, 리딩 판독 탭에 원문을 넣어 문체 특징도 함께 보세요. 빠르다는 것만으로 AI라고 단정할 수는 없어요.', '속도']);
    if (picked.indexOf('same') >= 0) qs.push(['다른 사람이 받은 리딩과 비교하려면 "동일인 의심 비교" 탭을 써 보세요.', '내용 반복']);
    if (picked.indexOf('none') >= 0 && picked.length === 1) qs.push(['특별히 의심되지 않아도 괜찮아요. 결제 전 조회, 환불 조건 확인만 챙겨 두세요.', '확인']);

    var res = el('div', { class: 'panel' }, [el('h3', { text: '스스로 확인해 볼 점' })]);
    res.appendChild(qs.length ? el('ul', null, qs.map(function (q) { return li(q[0], q[1]); })) : el('p', { class: 'note', text: '1·2번을 고르면 상황에 맞는 확인 질문을 보여 드려요.' }));

    if (conv.value.trim().length >= 40) res.appendChild(el('p', { class: 'note' }, ['받은 리딩·대화는 ', el('a', { href: '#read', text: '리딩 판독 탭' }), '에 붙여넣으면 문체·주의 표현을 자세히 볼 수 있어요. (여기 넣은 글은 자동으로 옮기지 않아요)']));

    var rv = reviewCheck(reviews.value);
    if (rv) {
      var ul = el('ul');
      if (rv.pairs.length) rv.pairs.slice(0, 8).forEach(function (p) { ul.appendChild(li('후기 ' + p.a + '번과 ' + p.b + '번이 많이 비슷해요(겹침 ' + Math.round(p.sim * 100) + '%)' + (p.ph ? ' · 똑같은 문장: "' + p.ph.slice(0, 40) + '"' : ''), '비슷함')); });
      else ul.appendChild(li('눈에 띄게 비슷한 후기 쌍은 없었어요.'));
      if (rv.sameEmo) ul.appendChild(li('이모지 조합이 똑같은 후기가 ' + (rv.sameEmo + 1) + '개 이상 있어요.', '이모지'));
      if (rv.even && rv.n >= 4) ul.appendChild(li('후기 길이가 거의 같아요. 한 사람이 틀에 맞춰 쓴 것일 수도 있어요.', '길이'));
      res.appendChild(el('h3', { text: '후기 ' + rv.n + '개 비교' })); res.appendChild(ul);
      res.appendChild(el('p', { class: 'note', text: '비슷하다고 같은 사람이 썼다고 확정할 수 없어요. 후기 계정의 가입 시기, 다른 글이 있는지, 후기가 한꺼번에 올라왔는지도 직접 살펴보세요.' }));
    } else if (reviews.value.trim()) res.appendChild(el('p', { class: 'note', text: '후기 비교는 10자 이상 후기 2개 이상이 필요해요. 후기 사이는 빈 줄로 나눠 주세요.' }));

    var files = Array.prototype.slice.call(photos.files || [], 0, 12);
    if (files.length) {
      var ul2 = el('ul'), hashes = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i], ex = null, h = null;
        try { ex = exifInfo(await readBytes(f)); h = await aHash(f); } catch (e) {}
        var bits = [];
        if (h) bits.push(h.w + '×' + h.h);
        if (ex && ex.tools.length) bits.push('편집 앱 흔적: ' + ex.tools.join(', '));
        else if (ex && !ex.png && !ex.hasExif) bits.push('촬영 정보 없음(캡처·전송 과정에서 흔히 지워져요)');
        ul2.appendChild(li(bits.join(' · ') || '정보를 읽지 못했어요', '사진 ' + (i + 1)));
        if (h) hashes.push({ i: i + 1, bits: h.bits });
      }
      for (var a = 0; a < hashes.length; a++) for (var b = a + 1; b < hashes.length; b++) {
        var d = ham(hashes[a].bits, hashes[b].bits);
        if (d <= 12) ul2.appendChild(li('사진 ' + hashes[a].i + '번과 ' + hashes[b].i + '번이 거의 같은 사진이에요. 같은 후기를 다른 사람 것처럼 다시 쓴 건 아닌지 살펴보세요.', '재사용 의심'));
      }
      res.appendChild(el('h3', { text: '사진 ' + files.length + '장' })); res.appendChild(ul2);
      res.appendChild(el('p', { class: 'note', text: '편집 앱 흔적은 모자이크·자르기만 해도 남을 수 있어서 조작의 증거가 아니에요. 사진 속 시간·이름·말투가 모두 똑같은지, 대화 상대 이름이 잘려 있는지, 다른 후기와 배경이 같은지 직접 비교해 보세요. 사진은 이 기기 메모리에서만 읽고 저장·전송하지 않아요.' }));
    }
    out.textContent = ''; out.appendChild(res);
  }

  if (location.hash === '#ctx') show(true);
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href="#read"]'); if (a) { e.preventDefault(); var r = document.getElementById('tab-read'); if (r) r.click(); window.scrollTo(0, tabs.offsetTop - 10); } });
})();
