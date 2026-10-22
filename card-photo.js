/* 타로 리딩 판독기 · 뽑은 카드 사진으로 해석 확인
   - 사진은 이 브라우저 안에서만 처리해요. 서버로 보내지 않고, 사진 원본도 저장하지 않아요.
   - 카드 알아보기: 이용자가 "이 사진은 ○○ 카드"라고 가르쳐 준 사진의 특징(작은 색·무늬 요약값)만 이 브라우저에 저장하고,
     다음에 같은 덱 사진이 오면 가장 비슷한 카드를 "후보"로 보여줘요. 가르쳐 준 적 없는 카드는 알아보지 못해요(지어내지 않음).
   - 해석 확인: 카드가 정해지면, 리딩의 같은 순서 문단이 그 카드의 근거 자료와 얼마나 겹치는지 보여줘요.
     근거 = 웨이트 원전(퍼블릭 도메인, data/decks.json) 또는 이용자가 가르쳐 준 그 카드의 의미 키워드. 판정이 아니라 근거 비교예요. */
(function () {
  'use strict';
  var out = document.getElementById('out');
  var txt = document.getElementById('txt');
  var deckInput = document.getElementById('deckName');
  if (!out || !txt) return;
  var KEY = 'tc_card_photo_v1';
  var photos = []; // { feat, thumb, card, rev, cand }
  var decks = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
  function deckKey() { return String((deckInput && deckInput.value) || '기본').toLowerCase().replace(/[\s\-_·.()]/g, '').slice(0, 40) || '기본'; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  fetch('/data/decks.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { decks = j; }).catch(function () {});

  var TAROT = (function () {
    var M = ['바보', '마법사', '여사제', '여황제', '황제', '교황', '연인', '전차', '힘', '은둔자', '운명의 수레바퀴', '정의', '매달린 사람', '죽음', '절제', '악마', '탑', '별', '달', '태양', '심판', '세계'];
    ['완드', '컵', '소드', '펜타클'].forEach(function (s) { ['에이스', '2', '3', '4', '5', '6', '7', '8', '9', '10', '페이지', '나이트', '퀸', '킹'].forEach(function (r) { M.push(s + ' ' + r); }); });
    return M;
  })();

  /* ---------- 사진 특징 (색 분포 + 무늬 해시). 원본은 저장하지 않아요 ---------- */
  function features(bmp, sx, sw) {
    var W = 48, H = 80, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(bmp, sx, 0, sw, bmp.height, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data, hist = [], gray = [], i, p;
    for (i = 0; i < 48; i++) hist.push(0);
    for (i = 0, p = 0; i < d.length; i += 4, p++) {
      var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn, h = 0;
      if (dl) { h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h = (h * 60 + 360) % 360; }
      hist[Math.min(7, Math.floor(h / 45)) * 6 + Math.min(2, Math.floor((mx ? dl / mx : 0) * 3)) * 2 + (mx > 0.5 ? 1 : 0)]++;
      gray.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
    hist = hist.map(function (v) { return Math.round(v / (W * H) * 1000) / 1000; });
    var bits = '';
    for (var yy = 0; yy < 12; yy++) for (var xx = 0; xx < 8; xx++) {
      var a = gray[Math.floor((yy + 0.5) * H / 12) * W + Math.floor(xx * W / 9)], bb = gray[Math.floor((yy + 0.5) * H / 12) * W + Math.floor((xx + 1) * W / 9)];
      bits += a > bb ? '1' : '0';
    }
    var th = document.createElement('canvas'); th.width = 72; th.height = 120; th.getContext('2d').drawImage(bmp, sx, 0, sw, bmp.height, 0, 0, 72, 120);
    return { f: { h: hist, b: bits }, thumb: th };
  }
  function similarity(a, b) {
    var c = 0, i; for (i = 0; i < a.h.length; i++) c += Math.min(a.h[i], b.h[i]);
    var same = 0; for (i = 0; i < a.b.length; i++) if (a.b[i] === b.b[i]) same++;
    var pat = Math.max(0, (same / a.b.length - 0.5) * 2);
    // 같은 카드를 거꾸로 찍은 경우도 비교해요
    var rb = a.b.split('').reverse().join(''), same2 = 0; for (i = 0; i < rb.length; i++) if (rb[i] === b.b[i]) same2++;
    var pat2 = Math.max(0, (same2 / rb.length - 0.5) * 2);
    return { score: 0.5 * c + 0.5 * Math.max(pat, pat2), flipped: pat2 > pat };
  }
  function recognize(f) {
    var taught = (load()[deckKey()] || {}).samples || [];
    var best = {};
    taught.forEach(function (s) {
      var r = similarity(f, s.f);
      if (!best[s.card] || r.score > best[s.card].score) best[s.card] = { card: s.card, score: r.score, flipped: r.flipped, ok: s.ok !== false };
    });
    return Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
  }

  /* ---------- 해석 근거 비교 ---------- */
  function tokens(t) {
    return (String(t).replace(/[^가-힣A-Za-z0-9\s]/g, ' ').match(/[가-힣]{2,}/g) || []).map(function (x) {
      return x.replace(/(으로|에서|에게|까지|부터|처럼|하고|해요|했어요|합니다|입니다|이에요|예요|이며|함|은|는|이|가|을|를|의|에|도|와|과|로)$/, '');
    }).filter(function (x) { return x.length >= 2 && !/^(카드|리딩|의미|과거|현재|미래|흐름|당신|지금|이번|그리고|하지만|있어요|있습니다|같은|특히|다른|해석|정방향|역방향|나왔어요|나왔|있었어요)$/.test(x); });
  }
  function evidence(card, rev) {
    var tp = (load()[deckKey()] || {}).meanings || {};
    var own = tp[card] ? tp[card][rev ? 1 : 0] || '' : '';
    var ms = ((load()[deckKey()] || {}).meaningSrc || {})[card];
    var src = null, base = '';
    var rws = decks && decks.decks && decks.decks.filter(function (d) { return d.id === 'rws'; })[0];
    if (rws && rws.cards[card]) { base = rws.cards[card][rev ? 1 : 0]; src = '웨이트 원전(퍼블릭 도메인)'; }
    var parts = [];
    if (own) parts.push({ from: '내가 가르쳐 준 의미' + (ms && ms.ok ? ' (자료: ' + ms.ref + ')' : ' (미확인)'), text: own });
    if (base) parts.push({ from: src, text: base });
    return parts;
  }
  function segments(t) {
    return t.split(/\n\s*\n|\n(?=\s*(?:[0-9]+[.)]|[①-⑩]|[🔮✨💫🌙⭐️☀️🃏]|과거|현재|미래|첫|두|세|마지막))/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 15; });
  }
  function compare(seg, parts) {
    var segT = tokens(seg), hits = [], all = [];
    parts.forEach(function (p) { tokens(p.text).forEach(function (k) { if (all.indexOf(k) < 0) all.push(k); }); });
    all.forEach(function (k) { if (segT.some(function (s) { return s.indexOf(k) >= 0 || k.indexOf(s) >= 0 && s.length >= 2; })) hits.push(k); });
    return { hits: hits, total: all.length };
  }

  /* ---------- 화면 ---------- */
  var panel = el('section', 'panel'); panel.id = 'cardPhoto';
  panel.appendChild(el('h3', null, '뽑은 카드 사진으로 해석 확인 (선택)'));
  panel.appendChild(el('p', 'note', '상대가 보낸 카드 사진을 넣으면, 내가 전에 가르쳐 준 사진과 비교해 어떤 카드인지 후보를 보여주고, 리딩이 그 카드의 근거 자료와 맞는지 비교해요. 사진은 이 브라우저 안에서만 처리하고 서버로 보내지 않아요.'));
  var file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.setAttribute('aria-label', '카드 사진 고르기');
  var split = el('select'); split.setAttribute('aria-label', '사진 한 장에 카드가 몇 장 있나요');
  [1, 2, 3, 4, 5].forEach(function (n) { var o = el('option', null, n === 1 ? '사진 1장 = 카드 1장' : '사진 1장에 카드 ' + n + '장 (가로로 나란히)'); o.value = n; split.appendChild(o); });
  var row = el('div', 'btns'); row.appendChild(file); row.appendChild(split); panel.appendChild(row);
  var listBox = el('div'); panel.appendChild(listBox);
  var resBox = el('div'); panel.appendChild(resBox);
  var msg = el('p', 'msg note'); panel.appendChild(msg);

  file.addEventListener('change', function () {
    var fs = Array.prototype.slice.call(file.files || []), n = +split.value || 1;
    (function next(i) {
      if (i >= fs.length) { file.value = ''; return draw(); }
      createImageBitmap(fs[i]).then(function (bmp) {
        var w = bmp.width / n;
        for (var k = 0; k < n; k++) {
          var ft = features(bmp, w * k, w), cand = recognize(ft.f);
          var top = cand[0] && cand[0].score >= 0.6 ? cand[0] : null;
          photos.push({ feat: ft.f, thumb: ft.thumb, cand: cand, card: top ? top.card : '', rev: top ? top.flipped : false, taught: false });
        }
        next(i + 1);
      }).catch(function () { msg.textContent = '사진을 읽지 못했어요.'; next(i + 1); });
    })(0);
  });

  function cardOptions() {
    var db = load()[deckKey()] || {}, extra = Object.keys(db.meanings || {});
    try { var dl = JSON.parse(localStorage.getItem('tc_deck_learn_v1') || '{}')[deckKey()]; if (dl) extra = extra.concat(Object.keys(dl.cards || {}), dl.listed || []); } catch (e) {}
    return extra.filter(function (x, i, a) { return a.indexOf(x) === i && TAROT.indexOf(x) < 0; }).concat(TAROT);
  }

  function draw() {
    listBox.textContent = ''; resBox.textContent = '';
    if (!photos.length) return;
    var segs = segments(txt.value || ''), opts = cardOptions();
    var dlId = 'cardPhotoNames'; var dl = el('datalist'); dl.id = dlId; opts.forEach(function (o) { var op = el('option'); op.value = o; dl.appendChild(op); }); listBox.appendChild(dl);
    var grid = el('div', 'spread');
    photos.forEach(function (p, i) {
      var slot = el('div', 'slot');
      slot.appendChild(el('span', 'pos', (i + 1) + '번째 사진'));
      p.thumb.style.cssText = 'width:72px;height:120px;border-radius:6px;border:1px solid var(--line)';
      slot.appendChild(p.thumb);
      if (p.cand.length) slot.appendChild(el('p', 'why', '비슷한 카드 후보: ' + p.cand.map(function (c) { return c.card + ' (' + Math.round(c.score * 100) + '점' + (c.ok ? '' : ', 미확인 가르침') + ')'; }).join(', ') + '. 점수는 내가 가르쳐 준 사진과 비슷한 정도이며 확률이 아니에요.'));
      else slot.appendChild(el('p', 'why', '이 덱에서 가르쳐 준 사진이 없어 알아보지 못했어요. 아래에 카드 이름을 직접 골라 가르쳐 주세요.'));
      var inp = el('input'); inp.type = 'text'; inp.setAttribute('list', dlId); inp.placeholder = '이 사진의 카드 이름'; inp.value = p.card; inp.setAttribute('aria-label', (i + 1) + '번째 사진 카드 이름');
      inp.addEventListener('change', function () { p.card = inp.value.trim(); p.taught = false; result(); });
      var rv = el('input'); rv.type = 'checkbox'; rv.checked = p.rev; rv.addEventListener('change', function () { p.rev = rv.checked; result(); });
      var rl = el('label', 'check'); rl.appendChild(rv); rl.appendChild(el('span', null, ' 역방향'));
      var mean = el('input'); mean.type = 'text'; mean.placeholder = '이 카드 뜻 (선택, 예: 새 출발, 용기)'; mean.setAttribute('aria-label', '이 카드 뜻 가르쳐 주기');
      var db0 = load()[deckKey()] || {}; if (p.card && db0.meanings && db0.meanings[p.card]) mean.value = db0.meanings[p.card][p.rev ? 1 : 0] || '';
      var teach = el('button', 'small', '이 카드로 가르쳐 주기'); teach.type = 'button';
      var ask = el('div', 'inline-form'); ask.hidden = true;
      teach.addEventListener('click', function () {
        var name = inp.value.trim(); if (name.length < 1) { msg.textContent = '카드 이름을 먼저 적어 주세요.'; return; }
        ask.textContent = ''; ask.hidden = false;
        // 엉터리로 가르쳐지지 않도록 먼저 물어봐요: 근거가 무엇인지, 다시 확인했는지
        ask.appendChild(el('p', 'note', '잘못 가르쳐지는 걸 막기 위해 몇 가지만 확인할게요.'));
        var warn = [];
        var db = load(), d = db[deckKey()] || { samples: [] };
        (d.samples || []).forEach(function (sm) { if (sm.card !== name && similarity(p.feat, sm.f).score >= 0.9 && warn.indexOf(sm.card) < 0) warn.push(sm.card); });
        if (warn.length) ask.appendChild(el('p', 'msg err', '전에 아주 비슷한 사진을 "' + warn.join(', ') + '"(으)로 가르쳐 줬어요. 이번 카드가 정말 "' + name + '"가 맞나요? 맞다면 계속 진행해 주세요.'));
        var rws = decks && decks.decks && decks.decks.filter(function (x) { return x.id === 'rws'; })[0];
        if (mean.value.trim() && rws && rws.cards[name]) {
          var base = tokens(rws.cards[name][p.rev ? 1 : 0]), mine = tokens(mean.value);
          if (!mine.some(function (k) { return base.some(function (b2) { return b2.indexOf(k) >= 0 || k.indexOf(b2) >= 0; }); }))
            ask.appendChild(el('p', 'msg err', '적어 준 뜻이 웨이트 원전의 "' + name + (p.rev ? ' 역방향' : '') + '" 뜻(' + rws.cards[name][p.rev ? 1 : 0] + ')과 많이 달라요. 이 덱 설명서의 뜻이 맞나요?'));
        }
        var q1 = el('label', 'f', '카드 이름은 어떻게 확인했나요? (필수)');
        var src = el('select'); [['', '골라 주세요'], ['card', '카드에 이름이 적혀 있어요'], ['guide', '덱 설명서에서 확인했어요'], ['reader', '리더가 알려줬어요'], ['guess', '확실하지 않아요 (추측)']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; src.appendChild(op); });
        q1.appendChild(src); ask.appendChild(q1);
        var q2 = el('label', 'f', '뜻을 확인한 자료가 있나요? (선택: 설명서 쪽수, 출판사 공식 페이지 이름 등)');
        var ref = el('input'); ref.type = 'text'; ref.maxLength = 120; q2.appendChild(ref); ask.appendChild(q2);
        var okBox = el('input'); okBox.type = 'checkbox';
        var q3 = el('label', 'check'); q3.appendChild(okBox); q3.appendChild(el('span', null, mean.value.trim() ? ' 적은 뜻이 자료와 맞는지 다시 확인했어요.' : ' 카드 이름이 맞는지 다시 확인했어요.'));
        ask.appendChild(q3);
        ask.appendChild(el('p', 'note', '설명서 문장을 통째로 옮기지 말고 핵심 단어만 적어 주세요(저작권). 확인되지 않은 가르침은 "미확인"으로 표시돼요.'));
        var saveBtn = el('button', 'small', '저장하기'); saveBtn.type = 'button';
        saveBtn.addEventListener('click', function () {
          if (!src.value) { msg.textContent = '카드 이름을 어떻게 확인했는지 골라 주세요.'; return; }
          var verified = src.value !== 'guess' && okBox.checked;
          var db2 = load(), d2 = db2[deckKey()] || { samples: [], meanings: {} };
          d2.samples = (d2.samples || []).concat([{ card: name, f: p.feat, src: src.value, ok: verified }]).slice(-400);
          if (mean.value.trim()) {
            d2.meanings = d2.meanings || {}; d2.meaningSrc = d2.meaningSrc || {};
            var m = d2.meanings[name] || ['', '']; m[p.rev ? 1 : 0] = mean.value.trim().slice(0, 200); d2.meanings[name] = m;
            d2.meaningSrc[name] = { ref: ref.value.trim().slice(0, 120), ok: verified && !!ref.value.trim() };
          }
          db2[deckKey()] = d2; p.card = name; p.taught = true; ask.hidden = true;
          msg.textContent = save(db2) ? '"' + name + '" 카드로 기억했어요' + (verified ? '' : ' (미확인으로 표시)') + '. 사진 원본은 저장하지 않고 색·무늬 요약값만 이 브라우저에 저장했어요.' : '이 브라우저에서는 저장할 수 없어요.';
          result();
        });
        var cancel = el('button', 'small', '취소'); cancel.type = 'button'; cancel.addEventListener('click', function () { ask.hidden = true; });
        var br = el('div', 'btns'); br.appendChild(saveBtn); br.appendChild(cancel); ask.appendChild(br);
      });
      slot.appendChild(inp); slot.appendChild(rl); slot.appendChild(mean); slot.appendChild(teach); slot.appendChild(ask);
      grid.appendChild(slot);
    });
    listBox.appendChild(grid);
    var bar = el('div', 'btns');
    var clr = el('button', 'small', '사진 비우기'); clr.type = 'button'; clr.addEventListener('click', function () { photos = []; draw(); });
    var forget = el('button', 'small', '이 덱에 가르쳐 준 것 모두 지우기'); forget.type = 'button';
    forget.addEventListener('click', function () { var db = load(); delete db[deckKey()]; save(db); msg.textContent = '지웠어요.'; });
    bar.appendChild(clr); bar.appendChild(forget); listBox.appendChild(bar);
    result();
  }

  function result() {
    resBox.textContent = '';
    var segs = segments(txt.value || '');
    var named = photos.filter(function (p) { return p.card; });
    if (!named.length) return;
    resBox.appendChild(el('h3', null, '리딩과 카드 근거 비교'));
    resBox.appendChild(el('p', 'note', '사진 순서와 리딩 문단 순서가 같다고 보고 비교해요. 근거 자료와 겹치는 표현이 적다고 틀린 해석이라는 뜻은 아니에요. 리더마다 해석 방식이 다를 수 있어요.'));
    var ul = el('ul', 'ev');
    photos.forEach(function (p, i) {
      if (!p.card) return;
      var li = el('li'), box = el('div');
      var h = el('p', null, (i + 1) + '번째 · ' + p.card + (p.rev ? ' 역방향' : '')); h.style.fontWeight = '600'; box.appendChild(h);
      var parts = evidence(p.card, p.rev), seg = segs[i];
      if (!parts.length) {
        box.appendChild(el('p', 'reason', '이 카드의 근거 자료가 없어요. 위에서 "이 카드 뜻"을 적고 가르쳐 주면 다음부터 비교할 수 있어요. 자료 없이 해석을 지어내지 않아요.'));
      } else if (!seg) {
        box.appendChild(el('p', 'reason', '이 순서에 해당하는 리딩 문단을 찾지 못했어요.'));
      } else {
        var c = compare(seg, parts);
        var lv = c.hits.length >= 3 ? ['근거 자료와 겹치는 표현이 여러 개 있어요', 'human'] : c.hits.length >= 1 ? ['근거 자료와 일부 겹쳐요', 'mid'] : ['근거 자료와 겹치는 표현이 거의 없어요', 'ai'];
        var pl = el('span', 'pill ' + lv[1], lv[0]); pl.style.marginLeft = '6px'; h.appendChild(pl);
        box.appendChild(el('p', 'reason', '겹치는 표현: ' + (c.hits.length ? c.hits.slice(0, 6).join(', ') : '없음')));
        parts.forEach(function (pt) { box.appendChild(el('p', 'note', pt.from + ': ' + pt.text)); });
        box.appendChild(el('p', 'note', '비교한 리딩 문단: ' + seg.slice(0, 80) + (seg.length > 80 ? '…' : '')));
      }
      li.appendChild(box); ul.appendChild(li);
    });
    resBox.appendChild(ul);
  }

  function mount() {
    if (!document.getElementById('cardPhoto')) {
      var anchor = document.getElementById('deckLearn') || document.getElementById('deckGuide') || (out.querySelector('#card-result-heading') && out.querySelector('#card-result-heading').closest('section'));
      if (anchor && anchor.nextSibling) out.insertBefore(panel, anchor.nextSibling); else out.appendChild(panel);
    }
    if (photos.length) result();
  }
  window.addEventListener('tc:analysis', function () { setTimeout(mount, 80); });
  if (window.__tcLast && out.children.length) setTimeout(mount, 80);
})();
