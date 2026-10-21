/* 타로 리딩 판독기 · 자체 제작 타로카드 그림 78장 (SVG 생성)
   특정 덱의 그림을 따라 그리지 않은 기하학 도안이에요. 라이선스: 사이트와 동일(자체 제작). */
(function (global) {
  'use strict';
  var MAJORS = ['바보', '마법사', '여사제', '여황제', '황제', '교황', '연인', '전차', '힘', '은둔자', '운명의 수레바퀴', '정의', '매달린 사람', '죽음', '절제', '악마', '탑', '별', '달', '태양', '심판', '세계'];
  var ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  var SUITS = { '완드': { c1: '#7A2E12', c2: '#C2562A', ink: '#FFE3C2' }, '컵': { c1: '#123B6B', c2: '#2F6FAE', ink: '#DDEBFF' }, '소드': { c1: '#2B3340', c2: '#5B6B80', ink: '#E8EEF6' }, '펜타클': { c1: '#2E4A1E', c2: '#6B8A2E', ink: '#F3F0C8' } };
  var MAJOR_COL = { c1: '#241A4A', c2: '#4B3A8C', ink: '#F4E9C8' };
  var RANKS = ['에이스', '2', '3', '4', '5', '6', '7', '8', '9', '10', '페이지', '나이트', '퀸', '킹'];

  function star(cx, cy, r1, r2, n, rot) {
    var p = [];
    for (var i = 0; i < n * 2; i++) {
      var a = (rot || -Math.PI / 2) + i * Math.PI / n, r = i % 2 ? r2 : r1;
      p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return '<polygon points="' + p.join(' ') + '"/>';
  }
  function rays(cx, cy, r1, r2, n) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var a = i * 2 * Math.PI / n;
      s += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (cx + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r2 * Math.sin(a)).toFixed(1) + '"/>';
    }
    return s;
  }

  // 메이저 아르카나 상징 (중심 60,96 기준)
  var MAJOR_ART = [
    function () { return '<circle cx="84" cy="66" r="9"/><path d="M30 130 L48 104 L62 118 L80 90 L94 100" fill="none" stroke-width="3"/><circle cx="36" cy="128" r="3"/>'; },
    function () { return '<path d="M60 96 C48 80 30 80 30 96 C30 112 48 112 60 96 C72 80 90 80 90 96 C90 112 72 112 60 96 Z" fill="none" stroke-width="4"/><line x1="60" y1="60" x2="60" y2="74" stroke-width="3"/>'; },
    function () { return '<rect x="30" y="66" width="10" height="64" rx="2"/><rect x="80" y="66" width="10" height="64" rx="2"/><path d="M68 80 A18 18 0 1 0 68 112 A13 13 0 1 1 68 80 Z"/>'; },
    function () { return '<circle cx="60" cy="96" r="14"/><ellipse cx="60" cy="68" rx="6" ry="12"/><ellipse cx="60" cy="124" rx="6" ry="12"/><ellipse cx="32" cy="96" rx="12" ry="6"/><ellipse cx="88" cy="96" rx="12" ry="6"/>'; },
    function () { return '<rect x="36" y="92" width="48" height="36" rx="2" fill="none" stroke-width="4"/><path d="M36 92 L36 70 L48 82 L60 64 L72 82 L84 70 L84 92 Z"/>'; },
    function () { return '<line x1="60" y1="62" x2="60" y2="132" stroke-width="4"/><line x1="48" y1="76" x2="72" y2="76" stroke-width="4"/><line x1="44" y1="90" x2="76" y2="90" stroke-width="4"/><line x1="40" y1="104" x2="80" y2="104" stroke-width="4"/>'; },
    function () { return '<circle cx="48" cy="96" r="20" fill="none" stroke-width="4"/><circle cx="72" cy="96" r="20" fill="none" stroke-width="4"/><path d="M60 70 l4 -6 l4 6 l-4 4 z"/>'; },
    function () { return '<rect x="34" y="74" width="52" height="34" rx="3" fill="none" stroke-width="4"/><circle cx="42" cy="118" r="10" fill="none" stroke-width="4"/><circle cx="78" cy="118" r="10" fill="none" stroke-width="4"/>' + star(60, 91, 8, 3.5, 5); },
    function () { return '<path d="M60 84 C52 74 40 74 40 84 C40 94 52 94 60 84 C68 74 80 74 80 84 C80 94 68 94 60 84 Z" fill="none" stroke-width="3"/><path d="M60 132 C40 120 42 104 60 98 C78 104 80 120 60 132 Z"/>'; },
    function () { return '<line x1="60" y1="60" x2="60" y2="74" stroke-width="3"/><polygon points="60,74 76,84 76,110 60,120 44,110 44,84" fill="none" stroke-width="4"/>' + star(60, 97, 9, 4, 6); },
    function () { return '<circle cx="60" cy="96" r="30" fill="none" stroke-width="4"/><circle cx="60" cy="96" r="8"/>' + rays(60, 96, 8, 30, 8); },
    function () { return '<line x1="60" y1="64" x2="60" y2="130" stroke-width="4"/><line x1="32" y1="78" x2="88" y2="78" stroke-width="4"/><path d="M24 104 L32 80 L40 104 Z" fill="none" stroke-width="3"/><path d="M80 104 L88 80 L96 104 Z" fill="none" stroke-width="3"/><path d="M22 104 A10 6 0 0 0 42 104 Z"/><path d="M78 104 A10 6 0 0 0 98 104 Z"/>'; },
    function () { return '<line x1="30" y1="66" x2="90" y2="66" stroke-width="4"/><line x1="60" y1="66" x2="60" y2="84" stroke-width="3"/><polygon points="60,130 40,94 80,94" fill="none" stroke-width="4"/><circle cx="60" cy="134" r="6"/>'; },
    function () { return '<line x1="26" y1="118" x2="94" y2="118" stroke-width="4"/><path d="M38 118 A22 22 0 0 1 82 118 Z"/>' + rays(60, 118, 28, 38, 12).replace(/<line/g, '<line opacity=".55"'); },
    function () { return '<path d="M30 76 h20 l-4 22 h-12 z"/><path d="M70 100 h20 l-4 22 h-12 z"/><path d="M42 98 C46 116 64 104 76 100" fill="none" stroke-width="3" stroke-dasharray="4 4"/><polygon points="60,62 66,74 54,74"/>'; },
    function () { return '<g transform="rotate(180 60 96)">' + star(60, 96, 30, 12, 5).replace('/>', ' fill="none" stroke-width="4"/>') + '</g><line x1="40" y1="134" x2="80" y2="134" stroke-width="4"/>'; },
    function () { return '<rect x="44" y="70" width="32" height="60" fill="none" stroke-width="4"/><path d="M40 70 L60 58 L80 70" fill="none" stroke-width="4"/><path d="M86 56 L72 82 L82 82 L66 108" fill="none" stroke-width="4"/><rect x="54" y="88" width="12" height="14"/>'; },
    function () { return star(60, 92, 30, 12, 8) + star(32, 128, 6, 2.5, 8) + star(88, 128, 6, 2.5, 8); },
    function () { return '<path d="M70 66 A30 30 0 1 0 70 126 A23 23 0 1 1 70 66 Z"/><circle cx="84" cy="80" r="3"/><circle cx="90" cy="96" r="2.5"/><circle cx="84" cy="112" r="2"/>'; },
    function () { return '<circle cx="60" cy="96" r="18"/>' + rays(60, 96, 24, 36, 16); },
    function () { return '<path d="M28 132 L60 118 L92 132" fill="none" stroke-width="3"/><path d="M40 100 L80 70 L84 78 L48 106 Z"/><circle cx="84" cy="70" r="7" fill="none" stroke-width="3"/>'; },
    function () { return '<ellipse cx="60" cy="96" rx="26" ry="38" fill="none" stroke-width="5" stroke-dasharray="3 3"/>' + star(60, 96, 11, 5, 5) + '<circle cx="26" cy="62" r="4"/><circle cx="94" cy="62" r="4"/><circle cx="26" cy="130" r="4"/><circle cx="94" cy="130" r="4"/>'; },
  ];

  function suitIcon(suit, x, y, s) {
    var t = 'translate(' + x + ' ' + y + ') scale(' + s + ')';
    switch (suit) {
      case '완드': return '<g transform="' + t + '"><rect x="-1.6" y="-11" width="3.2" height="22" rx="1.6"/><ellipse cx="-4" cy="-5" rx="3" ry="1.6" transform="rotate(-30 -4 -5)"/><ellipse cx="4" cy="1" rx="3" ry="1.6" transform="rotate(30 4 1)"/></g>';
      case '컵': return '<g transform="' + t + '"><path d="M-8 -9 H8 Q8 3 0 4 Q-8 3 -8 -9 Z"/><rect x="-1.2" y="4" width="2.4" height="5"/><rect x="-5" y="8.5" width="10" height="2.2" rx="1"/></g>';
      case '소드': return '<g transform="' + t + '"><path d="M0 -12 L2 -9 L2 5 L-2 5 L-2 -9 Z"/><rect x="-6" y="5" width="12" height="2.2" rx="1"/><rect x="-1.2" y="7" width="2.4" height="4"/><circle cx="0" cy="12" r="1.6"/></g>';
      default: return '<g transform="' + t + '"><circle r="9.5" fill="none" stroke-width="1.6"/>' + star(0, 0, 8, 3.2, 5) + '</g>';
    }
  }
  // 숫자 카드 배치 (가로 3열 기준 좌표)
  var LAYOUT = {
    1: [[60, 96]], 2: [[60, 74], [60, 118]], 3: [[60, 66], [60, 96], [60, 126]], 4: [[42, 74], [78, 74], [42, 118], [78, 118]],
    5: [[42, 70], [78, 70], [60, 96], [42, 122], [78, 122]], 6: [[42, 68], [78, 68], [42, 96], [78, 96], [42, 124], [78, 124]],
    7: [[42, 66], [78, 66], [60, 82], [42, 100], [78, 100], [42, 128], [78, 128]],
    8: [[42, 64], [78, 64], [42, 86], [78, 86], [42, 108], [78, 108], [42, 130], [78, 130]],
    9: [[36, 66], [60, 66], [84, 66], [36, 96], [60, 96], [84, 96], [36, 126], [60, 126], [84, 126]],
    10: [[36, 62], [60, 62], [84, 62], [42, 86], [78, 86], [42, 108], [78, 108], [36, 130], [60, 130], [84, 130]],
  };
  var COURT = {
    '페이지': '<circle cx="60" cy="74" r="7" fill="none" stroke-width="3"/>',
    '나이트': '<path d="M44 80 L60 68 L76 80" fill="none" stroke-width="4"/>',
    '퀸': '<path d="M42 82 L42 66 L51 74 L60 62 L69 74 L78 66 L78 82 Z"/>',
    '킹': '<path d="M40 82 L40 62 L48 72 L54 60 L60 70 L66 60 L72 72 L80 62 L80 82 Z"/>',
  };

  function frame(col, top, label, inner) {
    var id = 'g' + Math.random().toString(36).slice(2, 8);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" role="img" aria-label="' + label + ' 카드">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col.c2 + '"/><stop offset="1" stop-color="' + col.c1 + '"/></linearGradient></defs>' +
      '<rect x="1" y="1" width="118" height="198" rx="9" fill="url(#' + id + ')" stroke="' + col.ink + '" stroke-opacity=".5"/>' +
      '<rect x="7" y="7" width="106" height="186" rx="6" fill="none" stroke="' + col.ink + '" stroke-opacity=".6"/>' +
      '<text x="60" y="30" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="' + col.ink + '">' + top + '</text>' +
      '<g fill="' + col.ink + '" stroke="' + col.ink + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g>' +
      '<line x1="22" y1="160" x2="98" y2="160" stroke="' + col.ink + '" stroke-opacity=".45"/>' +
      '<text x="60" y="180" text-anchor="middle" font-size="' + (label.length > 6 ? 10.5 : 13) + '" font-weight="700" fill="' + col.ink + '" font-family="Pretendard,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif">' + label + '</text></svg>';
  }

  function cardSvg(name) {
    var n = String(name || '').replace(/\s*(정|역)방향$/, '').trim();
    var mi = MAJORS.indexOf(n);
    if (mi >= 0) return frame(MAJOR_COL, ROMAN[mi], n, MAJOR_ART[mi]());
    var m = n.match(/^(완드|컵|소드|펜타클)\s+(.+)$/);
    if (!m || RANKS.indexOf(m[2]) < 0) return '';
    var suit = m[1], rank = m[2], col = SUITS[suit], inner = '';
    if (rank === '에이스') inner = suitIcon(suit, 60, 98, 2.6);
    else if (COURT[rank]) inner = COURT[rank] + suitIcon(suit, 60, 112, 2.1);
    else { var pts = LAYOUT[+rank]; var sc = +rank >= 9 ? 0.85 : +rank >= 7 ? 0.92 : 1.15; for (var i = 0; i < pts.length; i++) inner += suitIcon(suit, pts[i][0], pts[i][1], sc); }
    var top = rank === '에이스' ? 'A' : COURT[rank] ? rank : rank;
    return frame(col, top, suit + ' ' + rank, inner);
  }

  function allNames() {
    var out = MAJORS.slice();
    ['완드', '컵', '소드', '펜타클'].forEach(function (s) { RANKS.forEach(function (r) { out.push(s + ' ' + r); }); });
    return out;
  }

  // 일러스트 파일 이름 규칙 (cards/ 폴더): major-00 ~ major-21, wands-01 ~ wands-14 (01=에이스, 11=페이지, 12=나이트, 13=퀸, 14=킹)
  var SUIT_EN = { '완드': 'wands', '컵': 'cups', '소드': 'swords', '펜타클': 'pentacles' };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function cardSlug(name) {
    var n = String(name || '').replace(/\s*(정|역)방향$/, '').trim();
    var mi = MAJORS.indexOf(n);
    if (mi >= 0) return 'major-' + pad(mi);
    var m = n.match(/^(완드|컵|소드|펜타클)\s+(.+)$/);
    if (!m || RANKS.indexOf(m[2]) < 0) return '';
    return SUIT_EN[m[1]] + '-' + pad(RANKS.indexOf(m[2]) + 1);
  }

  global.TarotCards = { svg: cardSvg, names: allNames, slug: cardSlug };
})(typeof window !== 'undefined' ? window : globalThis);
