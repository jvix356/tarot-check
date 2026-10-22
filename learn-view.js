/* 타로 리딩 판독기 · 참여 통계로 다듬는 표시
   - GitHub Actions가 매일 만드는 /data/stats.json(공개 합계)을 읽어 결과 화면 표시를 조정해요.
   - 일반 리더 글에서도 흔한 표현 → 표시를 낮추고 목록 아래로, 피해 응답에서 더 자주 보인 표현 → 주의 표시.
   - 리딩 본문은 읽기만 하고 어디로도 보내지 않아요. 확률·정확도 표시가 아니에요. */
(function () {
  'use strict';
  var out = document.getElementById('out');
  if (!out) return;
  var data = null, loading = false, pending = false;

  function load(cb) {
    if (data) return cb();
    pending = true;
    if (loading) return;
    loading = true;
    fetch('/data/stats.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { data = j || { n: 0, signals: [] }; loading = false; if (pending) { pending = false; cb(); } })
      .catch(function () { data = { n: 0, signals: [] }; loading = false; });
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function norm(s) { return String(s || '').replace(/^사람 신호 · /, '').trim(); }

  function apply() {
    var old = document.getElementById('learnNote'); if (old) old.remove();
    var map = {};
    (data.signals || []).forEach(function (s) { map[norm(s.label)] = s; });
    var adjusted = 0;
    var lists = out.querySelectorAll('ul.ev');
    if (lists[0]) {
      var ul = lists[0], moveDown = [];
      Array.prototype.forEach.call(ul.children, function (li) {
        var t = li.querySelector('p');
        var s = t && map[norm(t.firstChild ? t.firstChild.textContent : t.textContent)];
        if (!s || (s.tier !== 'common' && s.tier !== 'harm')) return;
        adjusted++;
        var pill = el('span', 'pill ' + (s.tier === 'harm' ? 'ai' : 'human'),
          s.tier === 'harm' ? '피해 응답에서 더 자주 보였어요' : '일반 리더 글에서도 흔해요');
        pill.style.marginLeft = '6px';
        t.appendChild(pill);
        var why = el('p', 'reason', '참여 통계: 일반 리더 응답의 ' + s.inNormal + '% · 피해 응답의 ' + s.inHarm + '%에서 보였어요. 참여자가 고른 결과를 합산한 값이라 검증된 수치가 아니에요.');
        t.parentNode.appendChild(why);
        if (s.tier === 'common') { li.style.opacity = '.7'; moveDown.push(li); }
      });
      moveDown.forEach(function (li) { ul.appendChild(li); });
    }
    var box = el('section', 'panel'); box.id = 'learnNote';
    // 학습된 가중치로 본 참고 표시 (lib/learn.js의 lean과 같은 규칙)
    var labels = (window.__tcLast && window.__tcLast.signals) || [], sum = 0, used = 0;
    labels.forEach(function (l) { var s = map[norm(l)]; if (s && s.weight != null) { sum += s.weight; used++; } });
    if (used >= 2) {
      var lv = sum >= 0.7 ? ['피해 응답 글과 표현 구성이 더 비슷한 편이에요', 'ai'] : sum <= -0.7 ? ['일반 리더 글과 표현 구성이 더 비슷한 편이에요', 'human'] : ['어느 쪽과 비슷한지 뚜렷하지 않아요', 'mid'];
      box.appendChild(el('h3', null, '참여 데이터로 학습한 기준 (참고)'));
      var lp = el('p'); lp.appendChild(el('span', 'pill ' + lv[1], lv[0])); box.appendChild(lp);
      box.appendChild(el('p', 'note', '학습된 항목 ' + used + '개로 비교했어요. 참여자가 고른 결과를 바탕으로 매일 다시 학습하는 참고 표시이며, 확률이나 판정이 아니에요. 특정인이 AI를 썼거나 사기라는 근거로 쓰지 마세요.'));
    }
    var p = el('p', 'note');
    if (data.n) {
      p.appendChild(document.createTextNode('익명 통계 참여 ' + data.n + '건을 바탕으로 표시를 다듬고 있어요' +
        (data.updatedAt ? ' (' + data.updatedAt + ' 갱신)' : '') + '. ' + (adjusted ? '이번 결과에서 ' + adjusted + '개 항목 표시가 통계로 조정됐어요. ' : '') +
        '참여가 쌓일수록 매일 자동으로 다시 학습하고 기준을 업데이트해요. '));
    } else {
      p.appendChild(document.createTextNode('익명 통계가 쌓이면 매일 자동으로 학습해 표시 기준이 업데이트돼요. 결과 아래에서 참여할 수 있어요. '));
    }
    var a = el('a', null, '통계 보기'); a.href = '/stats.html'; p.appendChild(a);
    box.appendChild(p);
    var first = out.querySelector('section');
    if (first && first.nextSibling) out.insertBefore(box, first.nextSibling); else out.appendChild(box);
  }

  window.addEventListener('tc:analysis', function () { load(apply); });
  if (window.__tcLast && out.children.length) load(apply);
})();
