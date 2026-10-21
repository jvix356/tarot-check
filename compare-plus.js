/* 타로 리딩 판독기 · 동일인 의심 비교 추가 기능
   1) 리딩 스타일 비교: 스프레드 구성, 카드 표기 방식, 소제목 꾸밈, 인사·마무리 문구, 가격·결제 안내 방식
   2) 사진 비교: 카드덱·스프레드 천·소품 사진의 색 분포와 무늬 비교
   모든 계산은 이 브라우저 안에서만 하고, 글과 사진을 서버로 보내지 않아요.
   손·얼굴 같은 신체 특징으로 사람을 식별하는 비교는 하지 않아요(생체정보). */
(function () {
  'use strict';
  var view = document.getElementById('cmpView');
  if (!view) return;

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
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /* ---------- 1) 리딩 스타일 ---------- */
  var POS = [['과거', /과거/], ['현재', /현재/], ['미래', /미래/], ['장애물', /장애물|걸림돌/], ['조언', /조언|어드바이스/], ['결과', /결과|결말/],
    ['내 마음', /나의 마음|내 마음|질문자/], ['상대 마음', /상대(?:방)?(?:의)? ?(?:마음|속마음)/], ['관계', /관계의? ?(?:흐름|현재)/], ['선택지 비교', /선택 ?[AB12]|양자택일/], ['켈틱 크로스', /켈틱|근원|희망과 두려움/]];
  var EMOJI = /^[ \t]*((?:[\u{1F300}-\u{1FAFF}]|[☀-➿])️?)/gmu;
  function lines(s) { return s.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function norm(s) { return s.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 14); }
  function money(s) {
    var o = [];
    (s.match(/\d{1,3}(?:,\d{3})+\s*원|\d+\s*(?:천|만)\s*원|\d{4,6}\s*원/g) || []).forEach(function (m) { o.push(m.replace(/\s/g, '')); });
    return o;
  }
  function profile(t) {
    var L = lines(t), f = {};
    f.positions = POS.filter(function (p) { return p[1].test(t); }).map(function (p) { return p[0]; });
    f.naming = [];
    if (/\bThe\s+[A-Z][a-z]+|\b(?:Ace|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Page|Knight|Queen|King) of\b/.test(t)) f.naming.push('영문 카드명');
    if (/역방향/.test(t)) f.naming.push('"역방향" 표기');
    if (/\(역\)|\[역\]/.test(t)) f.naming.push('"(역)" 표기');
    if (/역위/.test(t)) f.naming.push('"역위" 표기');
    if (/정방향/.test(t)) f.naming.push('"정방향"까지 표기');
    if (/(완드|컵|소드|펜타클)\s*(\d+)/.test(t)) f.naming.push('"슈트+숫자" 순서(컵 3)');
    if (/(\d+)\s*(완드|컵|소드|펜타클)/.test(t)) f.naming.push('"숫자+슈트" 순서(3컵)');
    if (/지팡이|성배|동전|검\s*\d/.test(t)) f.naming.push('우리말 슈트 이름');
    var em = {}; var m; EMOJI.lastIndex = 0; while ((m = EMOJI.exec(t))) em[m[1]] = 1;
    f.headEmoji = Object.keys(em);
    f.headStyle = [];
    if (/^\s*\d+[.)]/m.test(t)) f.headStyle.push('번호 목록');
    if (/^\s*[①-⑳]/m.test(t)) f.headStyle.push('원문자 번호(①)');
    if (/【|】/.test(t)) f.headStyle.push('겹낫표 【】');
    if (/^\s*\[[^\]]{1,20}\]/m.test(t)) f.headStyle.push('대괄호 소제목');
    if (/\*\*[^*]+\*\*/.test(t)) f.headStyle.push('**굵게**');
    if (/^[-─━=~]{3,}$/m.test(t)) f.headStyle.push('구분선');
    f.open = L.length ? [norm(L[0])] : [];
    f.close = L.length > 1 ? [norm(L[L.length - 1])] : [];
    f.pay = [];
    if (/선입금|입금 (?:후|확인)/.test(t)) f.pay.push('선입금 안내');
    if (/후기/.test(t)) f.pay.push('후기 요청');
    if (/오픈채팅|오픈톡|카톡|텔레그램|DM|디엠/i.test(t)) f.pay.push('외부 연락 유도');
    if (/1장|한 장|장당/.test(t) && money(t).length) f.pay.push('카드 장수별 가격');
    f.price = money(t);
    return f;
  }
  var FEAT = [['positions', '스프레드 위치 이름'], ['naming', '카드 이름 표기 방식'], ['headEmoji', '소제목 이모지'], ['headStyle', '소제목 꾸밈'],
    ['open', '첫 문장 시작'], ['close', '마지막 문장'], ['pay', '결제·연락 안내 방식'], ['price', '가격 표기']];
  function jac(a, b) {
    if (!a.length && !b.length) return null;
    var A = {}, B = {}, i = 0, u = 0; a.forEach(function (x) { A[x] = 1; }); b.forEach(function (x) { B[x] = 1; });
    Object.keys(A).forEach(function (k) { if (B[k]) i++; }); u = Object.keys(Object.assign({}, A, B)).length;
    return { r: i / u, shared: Object.keys(A).filter(function (k) { return B[k]; }) };
  }
  function accounts() {
    return Array.prototype.slice.call(document.querySelectorAll('#acctList .acct')).map(function (d) {
      var tag = d.querySelector('.tag'), tx = d.querySelector('.atxt'), id = d.querySelector('.aid');
      return { key: tag ? tag.textContent : '?', id: id ? id.value.trim() : '', text: tx ? tx.value.trim() : '' };
    }).filter(function (a) { return a.text.length; });
  }

  var styleOut = el('div');
  function renderStyle() {
    styleOut.textContent = '';
    var acc = accounts();
    if (acc.length < 2 || acc[0].text.length < 40) { styleOut.appendChild(el('p', { class: 'note', text: '위 칸에 계정 A와 의심 계정 글을 넣으면 리딩 스타일도 함께 비교해요.' })); return; }
    var A = acc[0], pa = profile(A.text);
    acc.slice(1).forEach(function (B) {
      var pb = profile(B.text), tb = el('tbody'), same = 0, known = 0;
      FEAT.forEach(function (f) {
        var j = jac(pa[f[0]], pb[f[0]]);
        var txt = j == null ? '두 글 모두 없음' : j.shared.length ? '겹침: ' + j.shared.join(', ').slice(0, 80) : '겹치지 않음';
        if (j != null) { known++; if (j.r >= 0.5) same++; }
        tb.appendChild(el('tr', null, [el('td', { text: f[1] }), el('td', { class: 'ex', text: txt }), el('td', { class: 'n', text: j == null ? '-' : Math.round(j.r * 100) + '%' })]));
      });
      styleOut.appendChild(el('div', { class: 'acct' }, [
        el('h3', { text: 'A와 ' + B.key + ' ' + (B.id ? '(' + B.id + ')' : '') + ' · 비슷한 리딩 스타일 ' + same + '/' + known + '개' }),
        el('div', { class: 'tablewrap' }, [el('table', { class: 'sig' }, [tb])])]));
    });
    styleOut.appendChild(el('p', { class: 'note', text: '같은 강의·템플릿·AI 프롬프트를 쓰면 다른 사람도 스타일이 비슷해질 수 있어요. 여러 항목이 함께 겹칠 때만 참고하세요.' }));
  }
  var rs = debounce(renderStyle, 250);
  var list = document.getElementById('acctList');
  if (list) list.addEventListener('input', rs);
  ['addAcct', 'cClear'].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener('click', function () { setTimeout(renderStyle, 50); }); });
  document.addEventListener('click', function (e) { if (e.target && e.target.classList && e.target.classList.contains('rm')) setTimeout(renderStyle, 50); });

  /* ---------- 2) 사진 비교 ---------- */
  var photos = [];
  var photoOut = el('div');
  var grid = el('div', { class: 'photo-grid' });

  function features(bmp) {
    var W = 96, H = 96, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    var s = Math.min(bmp.width, bmp.height), sx = (bmp.width - s) / 2, sy = (bmp.height - s) / 2;
    x.drawImage(bmp, sx, sy, s, s, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data, hist = new Float32Array(8 * 3 * 3), gray = new Float32Array(W * H);
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn, h = 0;
      if (dl) { h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h = (h * 60 + 360) % 360; }
      var sat = mx ? dl / mx : 0;
      hist[Math.min(7, Math.floor(h / 45)) * 9 + Math.min(2, Math.floor(sat * 3)) * 3 + Math.min(2, Math.floor(mx * 3))]++;
      gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    for (var k = 0; k < hist.length; k++) hist[k] /= W * H;
    // 차이 해시(dHash) 16x16
    var bits = [];
    for (var yy = 0; yy < 16; yy++) for (var xx = 0; xx < 16; xx++) {
      var a = gray[Math.floor((yy + 0.5) * H / 16) * W + Math.floor(xx * W / 17)], b2 = gray[Math.floor((yy + 0.5) * H / 16) * W + Math.floor((xx + 1) * W / 17)];
      bits.push(a > b2 ? 1 : 0);
    }
    var th = document.createElement('canvas'); th.width = 120; th.height = 120; th.getContext('2d').drawImage(bmp, sx, sy, s, s, 0, 0, 120, 120);
    return { hist: hist, bits: bits, thumb: th };
  }
  function simColor(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += Math.min(a[i], b[i]); return s; }
  function simPattern(a, b) { var same = 0; for (var i = 0; i < a.length; i++) if (a[i] === b[i]) same++; return Math.max(0, (same / a.length - 0.5) * 2); }

  function addFiles(files) {
    // 고른 순서대로 하나씩 처리해요
    Array.prototype.slice.call(files || []).slice(0, 8 - photos.length).reduce(function (chain, f) {
      return chain.then(function () {
        if (!/^image\//.test(f.type) || f.size > 15e6) return;
        return createImageBitmap(f).then(function (bmp) {
          var ft = features(bmp); if (bmp.close) bmp.close();
          photos.push({ name: f.name.slice(0, 40), group: '', ft: ft });
        }).catch(function () {});
      });
    }, Promise.resolve()).then(renderPhotos);
  }
  function renderPhotos() {
    grid.textContent = '';
    photos.forEach(function (p, i) {
      var sel = el('select', { 'aria-label': '사진 ' + (i + 1) + ' 계정' }, ['A', 'B1', 'B2', 'B3'].map(function (k) { var o = el('option', { text: '계정 ' + k }); o.value = k; if ((p.group || (i === 0 ? 'A' : 'B1')) === k) o.selected = true; return o; }));
      p.group = sel.value;
      sel.addEventListener('change', function () { p.group = sel.value; renderPhotoResult(); });
      var rm = el('button', { class: 'small', type: 'button', text: '빼기', onclick: function () { photos.splice(i, 1); renderPhotos(); } });
      grid.appendChild(el('div', { class: 'photo-item' }, [p.ft.thumb, el('span', { class: 'note', text: '사진 ' + (i + 1) }), sel, rm]));
    });
    renderPhotoResult();
  }
  function renderPhotoResult() {
    photoOut.textContent = '';
    var pairs = [];
    for (var i = 0; i < photos.length; i++) for (var j = i + 1; j < photos.length; j++) {
      if (photos[i].group === photos[j].group) continue;
      pairs.push({ a: i, b: j, c: simColor(photos[i].ft.hist, photos[j].ft.hist), p: simPattern(photos[i].ft.bits, photos[j].ft.bits) });
    }
    if (!pairs.length) { photoOut.appendChild(el('p', { class: 'note', text: '서로 다른 계정의 사진을 2장 이상 넣으면 비교해요.' })); return; }
    pairs.sort(function (x, y) { return (y.c + y.p) - (x.c + x.p); });
    var tb = el('tbody');
    pairs.forEach(function (q) {
      var lv = q.c >= 0.75 && q.p >= 0.6 ? '많이 비슷함' : q.c >= 0.6 || q.p >= 0.5 ? '조금 비슷함' : '다름';
      tb.appendChild(el('tr', null, [el('td', { text: '사진 ' + (q.a + 1) + '(' + photos[q.a].group + ') ↔ 사진 ' + (q.b + 1) + '(' + photos[q.b].group + ')' }),
        el('td', { class: 'n', text: Math.round(q.c * 100) + '%' }), el('td', { class: 'n', text: Math.round(q.p * 100) + '%' }), el('td', { text: lv })]));
    });
    photoOut.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'sig' }, [
      el('thead', null, [el('tr', null, [el('td', { class: 'note', text: '비교' }), el('td', { class: 'note', text: '색 분포' }), el('td', { class: 'note', text: '무늬·배치' }), el('td', { class: 'note', text: '정도' })])]), tb])]));
    photoOut.appendChild(el('p', { class: 'note', text: '시판 덱과 천은 많은 사람이 같은 제품을 써요. 같은 덱이나 천이 보여도 같은 사람이라는 뜻은 아니에요. 천의 얼룩·찢어진 곳·직접 만든 소품처럼 그 사람만 가진 흔적이 함께 겹칠 때 참고하세요.' }));
  }

  var file = el('input', { type: 'file', accept: 'image/*', multiple: '', 'aria-label': '비교할 사진 고르기' });
  file.addEventListener('change', function () { addFiles(file.files); file.value = ''; });

  var sec = el('section', { class: 'panel', 'aria-labelledby': 'cp-h' }, [
    el('h2', { id: 'cp-h', text: '리딩 스타일·사진으로 더 비교하기' }),
    el('p', { class: 'note', text: '말투 외에 리딩을 꾸미는 방식, 카드덱·스프레드 천 사진도 비교해요. 글과 사진은 이 브라우저 안에서만 처리하고 서버로 보내지 않아요.' }),
    el('h3', { text: '리딩 스타일' }), styleOut,
    el('h3', { text: '카드덱·스프레드 천·소품 사진' }),
    el('p', { class: 'note', text: '각 계정이 올린 리딩 사진에서 천이나 덱 부분이 잘 보이게 잘라서 넣으면 더 정확해요. 사진은 최대 8장까지 넣을 수 있어요.' }),
    el('p', { class: 'caveat', text: '손·얼굴·문신 같은 신체 특징으로 사람을 찾는 비교는 하지 않아요. 생체정보에 해당해 본인 동의 없이 쓰면 개인정보 문제가 생길 수 있어요. 다른 사람의 사진은 비교용으로만 쓰고 퍼뜨리지 마세요.' }),
    el('div', { class: 'btns' }, [file]), grid, photoOut]);
  var cOut = document.getElementById('cOut');
  if (cOut && cOut.parentNode === view) view.insertBefore(sec, cOut.nextSibling); else view.appendChild(sec);

  var st = document.createElement('style');
  st.textContent = '.photo-grid{display:flex;flex-wrap:wrap;gap:10px}.photo-item{display:flex;flex-direction:column;gap:4px;align-items:flex-start;width:130px}.photo-item canvas{width:120px;height:120px;border-radius:6px;border:1px solid var(--line)}.photo-item select{font:inherit;font-size:13px;width:120px}';
  document.head.appendChild(st);
  renderStyle(); renderPhotoResult();
})();
