/* 참여 통계 페이지: /data/stats.json(매일 자동 갱신)을 표로 보여줘요. */
(function () {
  'use strict';
  var TIER = { common: ['일반 리더 글에서도 흔함', 'ok'], harm: ['피해 응답에서 더 자주', 'bad'], neutral: ['차이 적음', ''], collecting: ['응답 모으는 중', 'wait'] };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function pct(v) { return v == null ? '응답 부족' : v + '%'; }
  var sum = document.getElementById('summary'), slot = document.getElementById('tableSlot');
  fetch('/data/stats.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.n) {
      sum.textContent = '아직 모인 통계가 없어요. 판독 결과 아래 "익명 통계 참여"로 함께해 주세요.';
      slot.appendChild(el('p', 'note', '참여가 쌓이면 여기에 표현별 통계가 나와요.'));
      return;
    }
    sum.textContent = '지금까지 ' + d.n + '건 참여 (일반 리더 ' + d.outcome.normal + ' · 피해 있음 ' + d.outcome.harm + ' · 모름 ' + d.outcome.unknown + ')' +
      (d.updatedAt ? ' · 마지막 학습 ' + d.updatedAt : '') + ' · 학습된 항목 ' + (d.learned || 0) + '개';
    if (!d.signals.length) { slot.appendChild(el('p', 'note', '공개할 만큼 쌓인 항목이 아직 없어요.')); return; }
    var table = el('table', 'sig'), head = el('tr');
    ['표현', '일반 리더', '피해 응답', '표시'].forEach(function (h) { head.appendChild(el('th', null, h)); });
    var thead = el('thead'); thead.appendChild(head); table.appendChild(thead);
    var tb = el('tbody');
    var order = { harm: 0, common: 1, neutral: 2, collecting: 3 };
    d.signals.slice().sort(function (a, b) { return order[a.tier] - order[b.tier]; }).forEach(function (s) {
      var tr = el('tr'), t = TIER[s.tier] || TIER.collecting;
      tr.appendChild(el('td', null, s.label));
      tr.appendChild(el('td', 'n', pct(s.inNormal)));
      tr.appendChild(el('td', 'n', pct(s.inHarm)));
      var td = el('td'); td.appendChild(el('span', 'pill ' + t[1], t[0])); tr.appendChild(td);
      tb.appendChild(tr);
    });
    table.appendChild(tb); slot.appendChild(table);
    var hs = document.getElementById('historySlot');
    if (hs && d.history && d.history.length) {
      hs.textContent = '';
      var ul = el('ul', 'plain');
      d.history.slice(-14).reverse().forEach(function (h) {
        ul.appendChild(el('li', null, h.day + ' · 참여 ' + h.n + '건 · 학습된 항목 ' + (h.learned || 0) + '개' + (h.changed ? ' · 바뀐 항목 ' + h.changed + '개' : '')));
      });
      hs.appendChild(ul);
    }
  }).catch(function () { sum.textContent = '통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'; });
})();
