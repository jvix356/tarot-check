import { pageWindow } from './board-pagination.js';
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var TYPE = { review: '후기', feedback: '피드백', report: '제보' };
  var KEY = 'tc_board_token';
  var token = ''; try { token = localStorage.getItem(KEY) || ''; } catch (e) {}
  var ownerKeys = [];
  try { ownerKeys = JSON.parse(localStorage.getItem('tc_post_keys') || '[]'); if (!Array.isArray(ownerKeys)) ownerKeys = []; } catch (e) {}
  function remember(r) {
    if (!r.ownerToken) return;
    ownerKeys.push({ id: r.id, token: r.ownerToken }); ownerKeys = ownerKeys.slice(-50);
    try { localStorage.setItem('tc_post_keys', JSON.stringify(ownerKeys)); } catch (e) {}
    loadMine();
  }
  var me = null, posts = [], filter = 'all', page = 1;
  // 1인 여러 닉네임 방지용 브라우저 구분값(임의 값). 서버에는 변환값만 저장돼요.
  var dev = ''; try { dev = localStorage.getItem('tc_dev') || ''; if (!/^[a-f0-9]{32}$/.test(dev)) { dev = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); localStorage.setItem('tc_dev', dev); } } catch (e) { dev = ''; }
  var openPosts = new Set();

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
  function api(path, opts) {
    opts = opts || {};
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; }); })
      .catch(function () { return { __status: 0, message: '인터넷 연결을 확인해 주세요.' }; });
  }
  function say(node, text, ok) { node.textContent = text || ''; node.className = 'msg ' + (ok ? 'ok' : 'err'); }
  function fmt(iso) { var d = new Date(iso); if (isNaN(d)) return ''; var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()); }
  function progressPill(p) { if (!p) return null; var cls = p === '반영 완료' ? 'ok' : p === '반영 안 함' ? 'bad' : 'wait'; return el('span', { class: 'pill ' + cls, text: p }); }

  /* ---------- 로그인 상태 ---------- */
  function setToken(t) { token = t || ''; try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) {} }
  function showAuth(cfg) {
    $('#authOff').hidden = !!cfg.emailAuth;
    $('#login').hidden = !cfg.emailAuth || !!me;
    $('#nickBox').hidden = !me || !!me.nickname;
    // 후기·피드백·댓글은 로그인 없이 닉네임만으로 쓸 수 있어요
    $('#writer').hidden = !!(me && !me.nickname);
    $('#anonRow').hidden = !!me;
    $('#meRow').hidden = !me;
    $('#mineBox').hidden = false;
    loadMine();
    if (me) { $('#meNick').textContent = me.nickname || '기존 계정'; $('#meEmail').textContent = '(인증: ' + me.email + ' · 운영자만 볼 수 있음)'; }
    render();
  }
  var cfg = { emailAuth: false };
  function boot() {
    api('/api/config').then(function (c) {
      cfg = c || cfg;
      if (!token) return showAuth(cfg);
      api('/api/auth').then(function (r) {
        if (r.__status === 200) me = r; else setToken('');
        showAuth(cfg);
      });
    });
    loadList();
  }

  $('#sendCode').addEventListener('click', function () {
    var b = this; b.disabled = true;
    api('/api/auth', { method: 'POST', body: { action: 'send', email: $('#email').value, age14: $('#age14').checked, privacy: $('#privacyOk').checked } }).then(function (r) {
      b.disabled = false;
      if (r.__status === 200) { $('#codeRow').hidden = false; $('#code').focus(); say($('#loginMsg'), '메일로 인증 코드를 보냈어요. 10분 안에 입력해 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.', true); }
      else say($('#loginMsg'), r.message || '인증 코드를 보내지 못했어요.');
    });
  });
  $('#verify').addEventListener('click', function () {
    var b = this; b.disabled = true;
    api('/api/auth', { method: 'POST', body: { action: 'verify', email: $('#email').value, code: $('#code').value } }).then(function (r) {
      b.disabled = false;
      if (r.__status !== 200) return say($('#loginMsg'), r.message || '인증하지 못했어요.');
      setToken(r.token);
      api('/api/auth').then(function (m) { me = m.__status === 200 ? m : null; say($('#loginMsg'), ''); showAuth(cfg); });
    });
  });
  $('#saveNick').addEventListener('click', function () {
    var b = this; b.disabled = true;
    api('/api/auth', { method: 'POST', body: { action: 'nickname', nickname: $('#nick').value } }).then(function (r) {
      b.disabled = false;
      if (r.__status !== 200) return say($('#nickMsg'), r.message || '닉네임을 저장하지 못했어요.');
      me.nickname = r.nickname; say($('#nickMsg'), ''); showAuth(cfg);
    });
  });
  $('#changeNick').addEventListener('click', function () { $('#nick').value = me.nickname; $('#nickBox').hidden = false; $('#nick').focus(); });
  $('#logout').addEventListener('click', function () { setToken(''); me = null; showAuth(cfg); });
  var withdrawArmed = false;
  $('#withdraw').addEventListener('click', function () {
    var b = this;
    if (!withdrawArmed) { withdrawArmed = true; b.textContent = '정말 탈퇴할게요 (한 번 더 누르기)'; return; }
    b.disabled = true;
    api('/api/auth', { method: 'POST', body: { action: 'withdraw' } }).then(function (r) {
      b.disabled = false; withdrawArmed = false; b.textContent = '탈퇴(이메일 정보 삭제)';
      if (r.__status !== 200) return say($('#writeMsg'), r.message || '탈퇴하지 못했어요.');
      setToken(''); me = null; showAuth(cfg); say($('#loginMsg'), r.message, true);
    });
  });

  /* ---------- 글쓰기 ---------- */
  $('#wType').addEventListener('change', function () { $('#noteWrap').hidden = this.value !== 'report'; });
  $('#submit').addEventListener('click', function () {
    var b = this; b.disabled = true;
    if ($('#wType').value === 'report' && !me) { b.disabled = false; return say($('#writeMsg'), cfg.emailAuth ? '제보는 아래 "내가 쓴 글" 칸에서 이메일 인증을 한 뒤에 쓸 수 있어요.' : '제보에 필요한 이메일 인증은 준비 중이에요. 후기나 피드백으로 남겨 주세요.'); }
    api('/api/posts', { method: 'POST', body: { dev: dev || undefined, type: $('#wType').value, nickname: me ? undefined : $('#anonNick').value, title: $('#wTitle').value, body: $('#wBody').value, privateNote: $('#wNote').value, agree: $('#wAgree').checked } }).then(function (r) {
      b.disabled = false;
      if (r.__status !== 200) return say($('#writeMsg'), r.message || '제출하지 못했어요.');
      say($('#writeMsg'), r.message, true);
      $('#wTitle').value = ''; $('#wBody').value = ''; $('#wNote').value = ''; $('#wAgree').checked = false;
      remember(r);
      if (me) loadMine();
      if (r.state === 'published') loadList();
    });
  });
  var STATUS = { private: ['검토 완료·비공개 제보', 'ok'], pending: ['검토 대기', 'wait'], published: ['공개됨', 'ok'], rejected: ['반려', 'bad'], hidden: ['비공개', 'bad'] };
  function loadMine() {
    var accountPosts = me ? api('/api/posts?mine=1') : Promise.resolve({ posts: [] });
    Promise.all([accountPosts, api('/api/posts', { method: 'POST', body: { action: 'lookup', keys: ownerKeys } })]).then(function (results) {
      var r = { posts: [] };
      results.forEach(function (x) { (x.posts || []).forEach(function (p) { if (!r.posts.some(function (a) { return a.id === p.id; })) r.posts.push(p); }); });
      var box = $('#mine'); box.textContent = '';
      if (!r.posts || !r.posts.length) return box.appendChild(el('p', { class: 'note', text: '아직 쓴 글이 없어요.' }));
      r.posts.forEach(function (p) {
        var st = STATUS[p.status] || [p.status, ''];
        var card = el('div', { class: 'post' }, [
          el('div', { class: 'meta' }, [el('span', { class: 'pill type', text: p.type === 'comment' ? '댓글' : TYPE[p.type] }), el('span', { class: 'pill ' + st[1], text: st[0] }), progressPill(p.progress), el('span', { text: fmt(p.createdAt) })]),
          p.title ? el('b', { text: p.title }) : null,
          el('p', { class: 'note', text: p.body }),
          p.type === 'report' ? el('p', {class: 'note', text: '운영자 전용 제보 · 공개되지 않아요.'}) : null,
          p.rejectReason ? el('p', { class: 'msg err', text: '조치 사유: ' + p.rejectReason }) : null,
          p.appeal ? el('p', { class: 'note', text: '이의제기: ' + p.appeal.status + (p.appeal.reason ? ' · 제출 사유: ' + p.appeal.reason : ' · 보유 기간이 지나 사유와 답변이 삭제됐어요.') + (p.appeal.answer ? ' · 운영자 답변: ' + p.appeal.answer : '') }) : null,
        ]);
        if (['hidden', 'rejected'].indexOf(p.status) >= 0 && !p.appeal) card.appendChild(requestForm(p, 'appeal', '이의제기'));
        box.appendChild(card);
      });
    });
  }

  /* ---------- 공개 목록 ---------- */
  function loadList() {
    api('/api/posts').then(function (r) { if(r.__status !== 200){$('#list').textContent='글을 불러오지 못했어요. 새로고침해 주세요.';$('#boardCounts').textContent='공개 글 집계 불러오기 실패';return;} posts = (r.posts || []).filter(function(p){return p.type==='review'||p.type==='feedback';}); render(); });
  }
  $$('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { filter = b.getAttribute('data-t'); page=1; $$('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); render(); });
  });

  function requestForm(post, kind, label) {
    var reason = el('textarea', { class: 'short', maxlength: '1500', 'aria-label': label + ' 사유', placeholder: kind === 'correct' ? '어느 부분이 사실과 다른지, 어떻게 고쳐야 하는지 적어 주세요.' : kind === 'delete' ? '삭제가 필요한 이유를 적어 주세요. (예: 내 개인정보가 담겨 있어요)' : '신고 사유를 적어 주세요.' });
    var contact = kind === 'appeal' ? null : el('input', { type: 'text', maxlength: '200', placeholder: '답변 받을 연락처 (선택, 운영자만 봐요)', 'aria-label': '연락처' });
    var msg = el('p', { class: 'msg', role: 'status' });
    var send = el('button', { class: 'primary small', text: label + ' 보내기', onclick: function () {
      send.disabled = true;
      api('/api/requests', { method: 'POST', body: { kind: kind, postId: post.id, reason: reason.value, contact: contact ? contact.value : '', ownerToken: (ownerKeys.filter(function (k) { return k.id === post.id; })[0] || {}).token } }).then(function (r) {
        send.disabled = false;
        say(msg, r.message || (r.__status === 200 ? '접수됐어요.' : '보내지 못했어요.'), r.__status === 200);
        if (r.__status === 200) { reason.value = ''; if (contact) contact.value = ''; if (kind === 'appeal') loadMine(); if (r.hidden) setTimeout(loadList, 1500); }
      });
    } });
    return el('div', { class: 'inline-form' }, [reason, contact, el('div', { class: 'row' }, [send]), msg]);
  }

  function commentForm(post) {
    var t = el('textarea', { class: 'short', maxlength: '500', 'aria-label': '댓글', placeholder: '댓글은 바로 공개돼요. 특정인을 단정하는 표현이 있으면 운영자 확인 뒤 공개돼요.' });
    var nick = me ? null : el('input', { type: 'text', maxlength: '12', placeholder: '닉네임 (2~12자)', 'aria-label': '댓글 닉네임' });
    var agree = el('input', { type: 'checkbox' });
    var msg = el('p', { class: 'msg', role: 'status' });
    var b = el('button', { class: 'primary small', text: '댓글 제출', onclick: function () {
      b.disabled = true;
      api('/api/posts', { method: 'POST', body: { dev: dev || undefined, type: 'comment', parentId: post.id, nickname: nick ? nick.value : undefined, body: t.value, agree: agree.checked } }).then(function (r) {
        b.disabled = false; say(msg, r.message || '제출하지 못했어요.', r.__status === 200);
        if (r.__status === 200) { remember(r); t.value = ''; agree.checked = false; if (me) loadMine(); if (r.state === 'published') loadList(); }
      });
    } });
    return el('div', { class: 'inline-form' }, [nick, t, el('label', { class: 'check' }, [agree, el('span', { text: '사실대로 썼고 개인정보·권리 침해 내용이 없어요.' })]), el('div', { class: 'row' }, [b]), msg]);
  }

  function render() {
    var box = $('#list'); box.textContent = '';
    $('#boardCounts').textContent='공개 글 '+posts.length+'건 · 후기 '+posts.filter(function(p){return p.type==='review';}).length+'건 · 피드백 '+posts.filter(function(p){return p.type==='feedback';}).length+'건';
    $$('.tabs button').forEach(function(b){var t=b.getAttribute('data-t');b.textContent=({all:'전체',review:'후기',feedback:'피드백'})[t]+' '+posts.filter(function(p){return t==='all'||p.type===t;}).length;});
    var list = posts.filter(function (p) { return filter === 'all' || p.type === filter; });
    var state=pageWindow(list.length,page);page=state.page;
    $('#listCount').textContent='총 '+list.length+'건 · '+page+' / '+state.totalPages+'페이지 · 한 페이지 5개';
    pager($('#listPages'),state,function(n){page=n;render();$('#list-h').scrollIntoView({block:'start'});});
    if (!list.length) return box.appendChild(el('div', { class: 'empty', text: '아직 공개된 글이 없어요.' }));
    list.slice(state.start,state.end).forEach(function (p) {
      var slot = el('div');
      var toggle = function (make) { return function () { var open = slot.firstChild && slot.firstChild.__k === make; slot.textContent = ''; if (!open) { var f = make(); f.__k = make; slot.appendChild(f); } }; };
      var mkC = function () { return commentForm(p); }, mkR = function () { return requestForm(p, 'report', '신고'); },
          mkD = function () { return requestForm(p, 'delete', '삭제 요청'); }, mkE = function () { return requestForm(p, 'correct', '정정 요청'); };
      var card = el('article', { class: 'post' }, [
        el('div', { class: 'meta' }, [el('span', { class: 'pill type', text: TYPE[p.type] || p.type }), progressPill(p.progress), el('b', { text: p.nickname }), el('span', { text: fmt(p.createdAt) }), p.editedAt ? el('span', { text: '· 운영자 정정됨' }) : null]),
        el('h3', { text: p.title }),
        el('p', { class: 'body', text: p.body }),
        p.reply ? el('div', { class: 'reply' }, [el('b', { text: '운영자 답변 · ' + fmt(p.reply.at) }), p.reply.body]) : null,
        (p.comments && p.comments.length) ? el('div', { class: 'comments' }, p.comments.map(function (c) {
          return el('p', { class: 'comment' }, [el('span', { class: 'who', text: c.nickname }), c.body, c.reply ? el('span', { class: 'note', text: '  — 운영자: ' + c.reply.body }) : null]);
        })) : null,
        el('div', { class: 'actions' }, [
          el('button', { class: 'small', text: '댓글', onclick: toggle(mkC) }),
          el('button', { class: 'small', text: '신고', onclick: toggle(mkR) }),
          el('button', { class: 'small', text: '삭제 요청', onclick: toggle(mkD) }),
          el('button', { class: 'small', text: '정정 요청', onclick: toggle(mkE) }),
        ]),
        slot,
      ]);
      var details=el('details',{class:'board-entry'}),summary=el('summary',null,[el('span',{class:'pill type',text:TYPE[p.type]}),el('span',{class:'entry-title',text:p.title}),el('span',{class:'note',text:p.nickname+' · '+fmt(p.createdAt)+' · 댓글 '+(p.comments||[]).length})]);
      details.append(summary,card);details.open=openPosts.has(p.id);details.addEventListener('toggle',function(){if(details.open)openPosts.add(p.id);else openPosts.delete(p.id);});box.appendChild(details);
    });
  }

  function pager(node,state,change){
    node.textContent='';
    if(state.totalPages<=1)return;
    function button(text,n,current){var b=el('button',{text:text,onclick:function(){change(n);}});if(current){b.setAttribute('aria-current','page');b.setAttribute('aria-label',n+'페이지, 현재 페이지');}else b.setAttribute('aria-label',text.match(/^\d+$/)?n+'페이지':text);node.appendChild(b);}
    if(state.page>1)button('이전',state.page-1);
    if(state.groupStart>1)button('이전 5페이지',state.groupStart-1);
    state.pages.forEach(function(n){button(String(n),n,n===state.page);});
    if(state.groupEnd<state.totalPages)button('다음 5페이지',state.groupEnd+1);
    if(state.page<state.totalPages)button('다음',state.page+1);
  }
  function notices(){
    var host=$('#noticeList'),items=$$('article',host).map(function(article){var h=$('h3',article),d=el('details',{class:'board-entry'}),summary=el('summary',{text:h.textContent});h.remove();d.append(summary,article);return d;}),current=1;
    $('#noticeCount').textContent='('+items.length+'건)';
    function draw(){var state=pageWindow(items.length,current);current=state.page;host.replaceChildren.apply(host,items.slice(state.start,state.end));pager($('#noticePages'),state,function(n){current=n;draw();$('#notice-h').scrollIntoView({block:'start'});});}draw();
  }
  notices();
  api('/api/stats').then(function(s){$('#boardStats').textContent=s.__status===200?'최근 1년 익명 통계 참여 '+s.n+'건 (최대 30분 지연)':'익명 통계를 불러오지 못했어요.';});

  $('#restoreKey').addEventListener('click', function () {
    var item = { id: $('#postId').value.trim(), token: $('#postKey').value.trim() };
    api('/api/posts', { method: 'POST', body: { action: 'lookup', keys: [item] } }).then(function (r) {
      if (!r.posts || !r.posts.length) return say($('#keyMsg'), '글과 확인키가 일치하지 않아요. 기존 비로그인 글은 확인키가 없어 자동 확인할 수 없어요.');
      remember({ id: item.id, ownerToken: item.token }); $('#postKey').value = ''; say($('#keyMsg'), '작성한 글을 확인했어요.', true);
    });
  });
  $('#showKeys').addEventListener('click', function () {
    var box = $('#savedKeys'); box.hidden = !box.hidden;
    box.textContent = box.hidden ? '' : ownerKeys.map(function (k) { return '글 ID: ' + k.id + '\n확인키: ' + k.token; }).join('\n\n') || '저장된 확인키가 없어요.';
  });
  $('#refreshMine').addEventListener('click', loadMine);
  boot();
})();
