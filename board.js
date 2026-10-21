(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var TYPE = { review: '후기', feedback: '피드백', report: '제보' };
  var KEY = 'tc_board_token';
  var token = ''; try { token = localStorage.getItem(KEY) || ''; } catch (e) {}
  var me = null, posts = [], filter = 'all';

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
    $('#writer').hidden = !me || !me.nickname;
    if (me && me.nickname) { $('#meNick').textContent = me.nickname; $('#meEmail').textContent = '(인증: ' + me.email + ' · 운영자만 볼 수 있음)'; loadMine(); }
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
    api('/api/auth', { method: 'POST', body: { action: 'send', email: $('#email').value } }).then(function (r) {
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

  /* ---------- 글쓰기 ---------- */
  $('#wType').addEventListener('change', function () { $('#noteWrap').hidden = this.value !== 'report'; });
  $('#submit').addEventListener('click', function () {
    var b = this; b.disabled = true;
    api('/api/posts', { method: 'POST', body: { type: $('#wType').value, title: $('#wTitle').value, body: $('#wBody').value, privateNote: $('#wNote').value, agree: $('#wAgree').checked } }).then(function (r) {
      b.disabled = false;
      if (r.__status !== 200) return say($('#writeMsg'), r.message || '제출하지 못했어요.');
      say($('#writeMsg'), r.message, true);
      $('#wTitle').value = ''; $('#wBody').value = ''; $('#wNote').value = ''; $('#wAgree').checked = false;
      loadMine();
    });
  });
  var STATUS = { pending: ['검토 대기', 'wait'], published: ['공개됨', 'ok'], rejected: ['반려', 'bad'], hidden: ['비공개', 'bad'] };
  function loadMine() {
    api('/api/posts?mine=1').then(function (r) {
      var box = $('#mine'); box.textContent = '';
      if (!r.posts || !r.posts.length) return box.appendChild(el('p', { class: 'note', text: '아직 쓴 글이 없어요.' }));
      r.posts.forEach(function (p) {
        var st = STATUS[p.status] || [p.status, ''];
        box.appendChild(el('div', { class: 'post' }, [
          el('div', { class: 'meta' }, [el('span', { class: 'pill type', text: p.type === 'comment' ? '댓글' : TYPE[p.type] }), el('span', { class: 'pill ' + st[1], text: st[0] }), progressPill(p.progress), el('span', { text: fmt(p.createdAt) })]),
          p.title ? el('b', { text: p.title }) : null,
          el('p', { class: 'note', text: p.body }),
          p.rejectReason ? el('p', { class: 'msg err', text: '반려 사유: ' + p.rejectReason }) : null,
        ]));
      });
    });
  }

  /* ---------- 공개 목록 ---------- */
  function loadList() {
    api('/api/posts').then(function (r) { posts = r.posts || []; render(); if (r.__status === 0) $('#list').textContent = '글을 불러오지 못했어요.'; });
  }
  $$('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { filter = b.getAttribute('data-t'); $$('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); render(); });
  });

  function requestForm(post, kind, label) {
    var reason = el('textarea', { class: 'short', maxlength: '1500', 'aria-label': label + ' 사유', placeholder: kind === 'correct' ? '어느 부분이 사실과 다른지, 어떻게 고쳐야 하는지 적어 주세요.' : kind === 'delete' ? '삭제가 필요한 이유를 적어 주세요. (예: 내 개인정보가 담겨 있어요)' : '신고 사유를 적어 주세요.' });
    var contact = el('input', { type: 'text', maxlength: '200', placeholder: '답변 받을 연락처 (선택, 운영자만 봐요)', 'aria-label': '연락처' });
    var msg = el('p', { class: 'msg', role: 'status' });
    var send = el('button', { class: 'primary small', text: label + ' 보내기', onclick: function () {
      send.disabled = true;
      api('/api/requests', { method: 'POST', body: { kind: kind, postId: post.id, reason: reason.value, contact: contact.value } }).then(function (r) {
        send.disabled = false;
        say(msg, r.message || (r.__status === 200 ? '접수됐어요.' : '보내지 못했어요.'), r.__status === 200);
        if (r.__status === 200) { reason.value = ''; contact.value = ''; }
      });
    } });
    return el('div', { class: 'inline-form' }, [reason, contact, el('div', { class: 'row' }, [send]), msg]);
  }

  function commentForm(post) {
    var t = el('textarea', { class: 'short', maxlength: '500', 'aria-label': '댓글', placeholder: '댓글은 운영자 확인 뒤 공개돼요.' });
    var agree = el('input', { type: 'checkbox' });
    var msg = el('p', { class: 'msg', role: 'status' });
    var b = el('button', { class: 'primary small', text: '댓글 제출', onclick: function () {
      b.disabled = true;
      api('/api/posts', { method: 'POST', body: { type: 'comment', parentId: post.id, body: t.value, agree: agree.checked } }).then(function (r) {
        b.disabled = false; say(msg, r.message || '제출하지 못했어요.', r.__status === 200);
        if (r.__status === 200) { t.value = ''; agree.checked = false; loadMine(); }
      });
    } });
    return el('div', { class: 'inline-form' }, [t, el('label', { class: 'check' }, [agree, el('span', { text: '사실대로 썼고 개인정보·권리 침해 내용이 없어요.' })]), el('div', { class: 'row' }, [b]), msg]);
  }

  function render() {
    var box = $('#list'); box.textContent = '';
    var list = posts.filter(function (p) { return filter === 'all' || p.type === filter; });
    if (!list.length) return box.appendChild(el('div', { class: 'empty', text: '아직 공개된 글이 없어요.' }));
    list.forEach(function (p) {
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
          me && me.nickname ? el('button', { class: 'small', text: '댓글 쓰기', onclick: toggle(mkC) }) : null,
          el('button', { class: 'small', text: '신고', onclick: toggle(mkR) }),
          el('button', { class: 'small', text: '삭제 요청', onclick: toggle(mkD) }),
          el('button', { class: 'small', text: '정정 요청', onclick: toggle(mkE) }),
        ]),
        slot,
      ]);
      box.appendChild(card);
    });
  }

  boot();
})();
