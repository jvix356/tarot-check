/* 타로 리딩 판독기 · 덱별 카드 학습 (오라클·일반 타로 등 어떤 덱이든)
   - 지어내지 않아요: 이용자가 넣은 "이 덱 카드 이름 목록"과, 리딩 본문에 실제로 적힌 카드 이름만 근거로 써요.
   - 카드 이름이 적힌 리딩을 "기억하기"로 저장하면, 그 카드 주변에 쓰인 표현(키워드)을 이 브라우저에만 저장해요.
   - 다음에 같은 덱 리딩에서 카드 이름이 빠져 있으면, 저장된 표현과 겹치는 정도로 "이 카드일 수 있어요"라고 후보만 보여줘요.
   - 그림은 덱 그림이 아니라 카드 이름만 적은 단순한 틀이에요(저작권 걱정 없음). 서버로 아무것도 보내지 않아요. */
(function () {
  'use strict';
  var out = document.getElementById('out');
  var txt = document.getElementById('txt');
  var deckInput = document.getElementById('deckName');
  if (!out || !txt || !deckInput) return;
  var KEY = 'tc_deck_learn_v1';

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
  function deckKey(n) { return String(n || '').toLowerCase().replace(/[\s\-_·.()]/g, '').slice(0, 40); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // 일반 타로 78장 이름(웨이트 계열)은 본 화면이 이미 처리하므로 여기서는 제외해요
  var TAROT = /^(바보|마법사|여사제|여황제|황제|교황|연인|전차|힘|은둔자|운명의 수레바퀴|정의|매달린 사람|죽음|절제|악마|탑|별|달|태양|심판|세계|(완드|컵|소드|펜타클)\s?(에이스|[2-9]|10|페이지|나이트|퀸|킹))$/;
  var GENERIC = /^(이|그|저|첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열|첫 번째|두 번째|세 번째|네 번째|마지막|다음|해당|오늘의|이번|타로|오라클|메이저|마이너|뽑은|나온|선택한|이번 주|조언|결과|과거|현재|미래)$/;
  var STOP = /^(그리고|하지만|그래서|지금|당신|당신의|이번|조금|많이|아주|정말|너무|이런|그런|저런|있어요|있습니다|합니다|해요|에요|이에요|입니다|것을|것이|것은|수도|있는|없는|카드|카드가|카드는|카드를|리딩|의미|상황|마음)$/;

  // 본문에서 "카드 이름"으로 적힌 것만 찾아요: 「이름」, '이름' 카드, 이름 카드가/는/를, 카드: 이름
  function namesIn(t) {
    var found = [], m, res = [
      /[「『“"‘']([^」』”"’'\n]{2,20})[」』”"’']\s*(?:카드)?/g,
      /(?:카드\s*(?:명|이름)?\s*[:：]\s*)([^\n,·/]{2,20})/g,
      /([가-힣A-Za-z0-9][가-힣A-Za-z0-9 ]{1,18}?)\s?카드(?:가|는|를|이|에서|의|로)\s/g,
    ];
    res.forEach(function (re) { while ((m = re.exec(t))) found.push(m[1].trim()); });
    return found.filter(function (n, i) { return n.length >= 2 && !TAROT.test(n) && !GENERIC.test(n) && found.indexOf(n) === i; });
  }
  function keywords(t) {
    var w = (t.replace(/[^가-힣A-Za-z0-9\s]/g, ' ').match(/[가-힣]{2,}|[A-Za-z]{3,}/g) || []).map(function (x) {
      return x.replace(/(으로|에서|에게|까지|부터|처럼|이라|이에|이고|하고|해요|했어요|합니다|입니다|이에요|예요|이며|은|는|이|가|을|를|의|에|도|와|과|로)$/, '');
    }).filter(function (x) { return x.length >= 2 && !STOP.test(x); });
    var c = {}; w.forEach(function (x) { c[x] = (c[x] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, 15);
  }
  // 문단·소제목 단위로 나눠요
  function segments(t) {
    return t.split(/\n\s*\n|\n(?=\s*(?:[0-9]+[.)]|[①-⑩]|[🔮✨💫🌙⭐️☀️🃏]|과거|현재|미래|첫|두|세|마지막))/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 15; });
  }

  function cardSvg(name) {
    var lines = [], s = name; while (s.length) { lines.push(s.slice(0, 6)); s = s.slice(6); }
    lines = lines.slice(0, 3);
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 120 190'); svg.setAttribute('width', '90'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', name + ' 카드 (단순 도안)');
    var r = document.createElementNS(ns, 'rect'); r.setAttribute('x', '3'); r.setAttribute('y', '3'); r.setAttribute('width', '114'); r.setAttribute('height', '184'); r.setAttribute('rx', '10');
    r.setAttribute('fill', 'var(--bg)'); r.setAttribute('stroke', 'currentColor'); r.setAttribute('stroke-width', '2'); svg.appendChild(r);
    var c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '60'); c.setAttribute('cy', '55'); c.setAttribute('r', '18'); c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'currentColor'); c.setAttribute('stroke-width', '1.5'); svg.appendChild(c);
    lines.forEach(function (l, i) {
      var tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', '60'); tx.setAttribute('y', String(110 + i * 20)); tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('font-size', '15'); tx.setAttribute('fill', 'currentColor'); tx.textContent = l; svg.appendChild(tx);
    });
    return svg;
  }

  function render() {
    var old = document.getElementById('deckLearn'); if (old) old.remove();
    var deck = deckInput.value.trim();
    if (!deck) return;
    var db = load(), dk = deckKey(deck), prof = db[dk] || { name: deck, cards: {}, listed: [] };
    var text = txt.value || '';
    var segs = segments(text);
    var rows = segs.map(function (s) {
      var named = namesIn(s);
      if (named.length) return { seg: s, name: named[0], how: 'named' };
      // 이름이 없으면: 이용자가 넣은 카드 목록에 있는 이름이 본문에 나오는지, 아니면 저장된 표현과 겹치는지
      var listed = (prof.listed || []).filter(function (n) { return n.length >= 2 && s.indexOf(n) >= 0; })[0];
      if (listed) return { seg: s, name: listed, how: 'listed' };
      var kw = keywords(s), best = null;
      Object.keys(prof.cards || {}).forEach(function (n) {
        var hit = (prof.cards[n].kw || []).filter(function (k) { return kw.indexOf(k) >= 0; });
        if (hit.length >= 2 && (!best || hit.length > best.hit.length)) best = { name: n, hit: hit };
      });
      return best ? { seg: s, name: best.name, how: 'learned', hit: best.hit } : null;
    }).filter(Boolean);

    var sec = el('section', 'panel'); sec.id = 'deckLearn';
    sec.appendChild(el('h3', null, '"' + deck + '" 덱 기준 카드 찾기'));
    sec.appendChild(el('p', 'note', '이 덱의 카드는 지어내지 않아요. 아래 카드 목록이나 리딩에 실제로 적힌 카드 이름, 이 브라우저에 기억해 둔 리딩만 근거로 써요. 그림은 덱 그림이 아니라 카드 이름만 적은 단순한 틀이에요.'));
    if (rows.length) {
      var wrap = el('div', 'spread');
      rows.forEach(function (r) {
        var slot = el('div', 'slot' + (r.how === 'learned' ? ' guess' : ''));
        slot.appendChild(cardSvg(r.name));
        slot.appendChild(el('p', 'card', r.name));
        var unv = (r.how === 'learned' && !(prof.cards[r.name] || {}).ok) || (r.how === 'listed' && !(prof.listSrc || {}).ok);
        slot.appendChild(el('span', 'pill mid', (r.how === 'named' ? '본문에 적힌 카드명' : r.how === 'listed' ? '카드 목록과 일치' : '기억한 표현과 비슷한 후보') + (unv ? ' · 미확인' : '')));
        slot.appendChild(el('p', 'why', r.how === 'learned' ? '겹치는 표현: ' + r.hit.slice(0, 4).join(', ') + '. 이 덱에서 전에 이 카드를 설명할 때 쓰인 표현과 비슷해요. 실제로 뽑은 카드인지는 알 수 없어요.' : '실제 추첨 여부는 확인하지 않았어요.'));
        wrap.appendChild(slot);
      });
      sec.appendChild(wrap);
    } else {
      sec.appendChild(el('p', 'note', '이 리딩에서 이 덱의 카드를 찾지 못했어요. 카드 이름이 적힌 리딩을 "기억하기"로 저장하거나, 아래에 카드 이름 목록을 넣으면 다음부터 찾을 수 있어요.'));
    }

    var known = Object.keys(prof.cards || {}).length, listedN = (prof.listed || []).length;
    sec.appendChild(el('p', 'note', '지금 이 브라우저에 기억한 카드: ' + known + '장 · 카드 목록: ' + listedN + '장'));
    var msg = el('p', 'msg note');
    // 잘못 가르쳐지지 않도록 저장 전에 근거를 물어봐요
    var askBox = el('div', 'inline-form');
    askBox.appendChild(el('p', 'note', '기억시키기 전에 확인해 주세요. 근거 없이 저장한 내용은 "미확인"으로 표시돼요.'));
    var srcSel = el('select'); srcSel.setAttribute('aria-label', '카드 이름 근거');
    [['', '카드 이름은 어디서 확인했나요? (필수)'], ['guide', '덱 설명서·카드에 적힌 이름이에요'], ['official', '출판사·제작자 공식 자료예요'], ['reader', '리더가 알려준 이름이에요'], ['guess', '확실하지 않아요']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; srcSel.appendChild(op); });
    var refIn = el('input'); refIn.type = 'text'; refIn.maxLength = 120; refIn.placeholder = '자료가 있으면 알려 주세요 (예: 설명서 12쪽, 제작사 홈페이지)';
    var chk = el('input'); chk.type = 'checkbox';
    var chkL = el('label', 'check'); chkL.appendChild(chk); chkL.appendChild(el('span', null, ' 카드 이름이 맞는지 다시 확인했어요.'));
    askBox.appendChild(srcSel); askBox.appendChild(refIn); askBox.appendChild(chkL);
    function source() {
      if (!srcSel.value) { msg.textContent = '카드 이름을 어디서 확인했는지 먼저 골라 주세요.'; return null; }
      return { src: srcSel.value, ref: refIn.value.trim().slice(0, 120), ok: srcSel.value !== 'guess' && chk.checked };
    }
    var namedNow = segs.map(function (s) { return [namesIn(s)[0], s]; }).filter(function (x) { return x[0]; });
    var learnBtn = el('button', 'small', '이 리딩의 카드 ' + namedNow.length + '장 기억하기');
    learnBtn.type = 'button'; learnBtn.hidden = !namedNow.length;
    learnBtn.addEventListener('click', function () {
      var so = source(); if (!so) return;
      var d = load(), p = d[dk] || { name: deck, cards: {}, listed: [] };
      namedNow.forEach(function (x) {
        var c = p.cards[x[0]] || { kw: [], seen: 0 };
        c.kw = keywords(x[1]).concat(c.kw).filter(function (k, i, a) { return a.indexOf(k) === i && k !== x[0]; }).slice(0, 30);
        c.seen++; c.src = so.src; c.ref = so.ref || c.ref || ''; c.ok = so.ok || !!c.ok; p.cards[x[0]] = c;
      });
      d[dk] = p; msg.textContent = save(d) ? '기억했어요. 리딩 본문은 저장하지 않고, 카드 이름과 주변 표현 몇 개만 이 브라우저에 저장했어요.' : '이 브라우저에서는 저장할 수 없어요.';
      setTimeout(render, 600);
    });
    var list = el('textarea', 'short'); list.placeholder = '이 덱 카드 이름을 알면 한 줄에 하나씩 넣어 주세요 (선택). 덱 설명서의 카드 이름만 넣고 해석 문장은 넣지 마세요.';
    list.setAttribute('aria-label', '덱 카드 이름 목록'); list.value = (prof.listed || []).join('\n');
    var listBtn = el('button', 'small', '카드 목록 저장'); listBtn.type = 'button';
    listBtn.addEventListener('click', function () {
      var so = source(); if (!so) return;
      var d = load(), p = d[dk] || { name: deck, cards: {}, listed: [] };
      p.listSrc = so;
      p.listed = list.value.split('\n').map(function (s) { return s.trim().slice(0, 30); }).filter(function (s, i, a) { return s.length >= 2 && a.indexOf(s) === i; }).slice(0, 200);
      d[dk] = p; msg.textContent = save(d) ? '카드 목록을 이 브라우저에 저장했어요.' : '이 브라우저에서는 저장할 수 없어요.'; setTimeout(render, 600);
    });
    var clearBtn = el('button', 'small', '이 덱 기억 지우기'); clearBtn.type = 'button';
    clearBtn.addEventListener('click', function () { var d = load(); delete d[dk]; save(d); msg.textContent = '지웠어요.'; setTimeout(render, 400); });
    var row = el('div', 'btns'); row.appendChild(learnBtn); row.appendChild(listBtn); row.appendChild(clearBtn);
    sec.appendChild(list); sec.appendChild(askBox); sec.appendChild(row); sec.appendChild(msg);

    var anchor = document.getElementById('deckGuide') || (out.querySelector('#card-result-heading') || {}).closest && out.querySelector('#card-result-heading').closest('section');
    if (anchor && anchor.nextSibling) out.insertBefore(sec, anchor.nextSibling); else out.appendChild(sec);
  }

  window.addEventListener('tc:analysis', function () { setTimeout(render, 50); });
  if (window.__tcLast && out.children.length) setTimeout(render, 50);
})();
