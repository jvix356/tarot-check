/* 타로 리딩 판독기 · 덱별 원전 해석
   - 이용자가 '사용한 덱 이름'을 넣으면, 출처가 확인된 자료(data/decks.json)가 있는 덱만 그 원전 해석을 보여줘요.
   - 자료가 없는 덱은 해석을 지어내지 않고 "등록된 자료가 없어요"라고 알려요.
   - 덱 이름과 카드명은 브라우저 안에서만 쓰고 서버로 보내지 않아요. */
(function () {
  'use strict';
  var out = document.getElementById('out');
  var deckInput = document.getElementById('deckName');
  if (!out || !deckInput) return;
  var data = null, loading = false, waiting = false;

  function load(cb) {
    if (data) return cb();
    waiting = true;
    if (loading) return;
    loading = true;
    fetch('/data/decks.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { data = j || { decks: [] }; loading = false; if (waiting) { waiting = false; cb(); } })
      .catch(function () { data = { decks: [] }; loading = false; });
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function key(s) { return String(s || '').toLowerCase().replace(/[\s\-_·.()（）]/g, ''); }
  function findDeck(name) {
    var k = key(name); if (!k) return null;
    var best = null;
    (data.decks || []).forEach(function (d) {
      [d.name].concat(d.aliases || []).forEach(function (a) {
        var ak = key(a);
        if (ak && (k === ak || (ak.length >= 3 && k.indexOf(ak) >= 0)) && (!best || ak.length > best.len)) best = { deck: d, len: ak.length };
      });
    });
    return best && best.deck;
  }
  function cardsShown() {
    return Array.prototype.map.call(out.querySelectorAll('.slot'), function (s) {
      var c = s.querySelector('.card'), p = s.querySelector('.pos');
      var full = c ? c.textContent.trim() : '';
      return { pos: p ? p.textContent.trim() : '', name: full.replace(/ (정|역)방향$/, ''), rev: / 역방향$/.test(full), guess: s.classList.contains('guess') };
    }).filter(function (x) { return x.name && x.name !== '추측 불가'; });
  }
  function meaningList(deck, cards) {
    var ul = el('ul', 'ev');
    cards.forEach(function (c) {
      var m = deck.cards[c.name]; if (!m) return;
      var li = el('li'), box = el('div');
      var h = el('p', null, (c.pos ? c.pos + ' · ' : '') + c.name + (c.rev ? ' 역방향' : '')); h.style.fontWeight = '600';
      if (c.guess) { var g = el('span', 'pill mid', '키워드 후보 카드'); g.style.marginLeft = '6px'; h.appendChild(g); }
      box.appendChild(h);
      box.appendChild(el('p', 'reason', (c.rev ? '역방향: ' + m[1] : '정방향: ' + m[0])));
      if (!c.rev) box.appendChild(el('p', 'note', '역방향일 때: ' + m[1]));
      li.appendChild(box); ul.appendChild(li);
    });
    return ul;
  }

  function render() {
    var old = document.getElementById('deckGuide'); if (old) old.remove();
    var name = deckInput.value.trim();
    if (!name) return;
    var cards = cardsShown();
    var deck = findDeck(name);
    var ref = (data.decks || []).filter(function (d) { return d.id === 'rws'; })[0];
    var sec = el('section', 'panel'); sec.id = 'deckGuide';
    sec.appendChild(el('h3', null, '덱별 원전 해석'));

    if (deck && deck.source && deck.cards) {
      sec.appendChild(el('p', null, '입력한 덱을 "' + deck.name + '"(으)로 인식했어요. 이 덱은 아래 원전에서 이런 뜻으로 해석해요.'));
      if (deck.aliasNote) sec.appendChild(el('p', 'note', deck.aliasNote));
      if (cards.length) sec.appendChild(meaningList(deck, cards));
      else sec.appendChild(el('p', 'note', '카드명을 알면 위 "카드 보기" 칸에 입력해 주세요. 입력한 카드의 원전 해석을 보여드려요.'));
      var src = el('p', 'note', '출처: ' + deck.source.title + ' · ' + deck.source.license + '. ' + deck.source.how + ' ');
      var a = el('a', null, '원문 보기'); a.href = deck.source.url; a.rel = 'noopener'; a.target = '_blank'; src.appendChild(a);
      sec.appendChild(src);
    } else {
      sec.appendChild(el('p', null, deck ? deck.missing : '"' + name + '" 덱은 출처를 확인한 해석 자료가 아직 등록되지 않았어요.'));
      sec.appendChild(el('p', 'note', '자료가 없는 덱의 해석은 지어내지 않아요. 덱에 들어 있는 설명서(가이드북)를 확인해 주세요. 공개된 자료 출처를 알면 게시판 피드백으로 알려 주세요. 확인한 뒤 등록할게요.'));
      if (ref && cards.length) {
        var d = el('details', 'more'), s = el('summary', null, '참고: 웨이트 원전의 일반 의미 보기 (이 덱의 해석이 아니에요)');
        d.appendChild(s); var body = el('div', 'body'); body.appendChild(meaningList(ref, cards));
        body.appendChild(el('p', 'note', '출처: ' + ref.source.title + ' · ' + ref.source.license));
        d.appendChild(body); sec.appendChild(d);
      }
    }
    sec.appendChild(el('p', 'note', '원전 해석은 카드의 전통적인 뜻을 소개한 것이에요. 상대가 실제로 이 카드를 뽑았는지, 리딩이 맞는지는 확인할 수 없어요.'));
    var cardSec = out.querySelector('#card-result-heading');
    cardSec = cardSec && cardSec.closest('section');
    if (cardSec && cardSec.nextSibling) out.insertBefore(sec, cardSec.nextSibling); else out.appendChild(sec);
  }

  window.addEventListener('tc:analysis', function () { load(render); });
  if (window.__tcLast && out.children.length) load(render);
})();
