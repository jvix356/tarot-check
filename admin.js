(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var TYPE = { review: '후기', feedback: '피드백', report: '제보', comment: '댓글' };
  var STATUS = { pending: '검토 대기', published: '공개 중', rejected: '반려', hidden: '비공개' };
  var KEY = 'tc_admin';
  var pw = ''; try { pw = sessionStorage.getItem(KEY) || ''; } catch (e) {}
  var data = { posts: [], requests: [], progress: [] }, view = 'pending';

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k === 'value') n.value = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function api(method, body) {
    return fetch('/api/admin', { method: method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pw }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; }); })
      .catch(function () { return { __status: 0, message: '연결 오류' }; });
  }
  function fmt(iso) { var d = new Date(iso); if (isNaN(d)) return ''; var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  function load() {
    return api('GET').then(function (r) {
      if (r.__status === 401) { $('#loginMsg').textContent = '비밀번호가 맞지 않아요.'; $('#loginMsg').className = 'msg err'; $('#main').hidden = true; $('#loginBox').hidden = false; return; }
      if (r.__status !== 200) { $('#loginMsg').textContent = r.message || '불러오지 못했어요.'; $('#loginMsg').className = 'msg err'; return; }
      try { sessionStorage.setItem(KEY, pw); } catch (e) {}
      data = r; $('#loginBox').hidden = true; $('#main').hidden = false; render();
    });
  }
  $('#enter').addEventListener('click', function () { pw = $('#adm').value; load(); });
  $('#adm').addEventListener('keydown', function (e) { if (e.key === 'Enter') { pw = this.value; load(); } });
  $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { view = b.getAttribute('data-v'); $$('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); render(); }); });

  function act(body, msgNode) {
    msgNode.textContent = '처리 중…'; msgNode.className = 'msg';
    return api('POST', body).then(function (r) {
      if (r.__status !== 200) { msgNode.textContent = r.message || ('실패 (' + r.__status + ')'); msgNode.className = 'msg err'; return; }
      return load();
    });
  }

  function postCard(p) {
    var msg = el('p', { class: 'msg', role: 'status' });
    var parent = p.parentId ? data.posts.filter(function (x) { return x.id === p.parentId; })[0] : null;
    var reply = el('textarea', { class: 'short', 'aria-label': '운영자 답변', placeholder: '공개 답변 (비우고 저장하면 삭제)' }); reply.value = p.reply ? p.reply.body : '';
    var reason = el('input', { type: 'text', placeholder: '반려 사유 (작성자에게만 보여요)', 'aria-label': '반려 사유' });
    var prog = el('select', { 'aria-label': '진행 상태' }, data.progress.map(function (x) { var o = el('option', { text: x }); o.value = x; if (x === p.progress) o.selected = true; return o; }));
    var editBody = el('textarea', { 'aria-label': '본문 정정' }); editBody.value = p.body;
    var editTitle = el('input', { type: 'text', 'aria-label': '제목 정정' }); editTitle.value = p.title || '';
    var editBox = el('div', { class: 'inline-form', hidden: '' }, [p.type !== 'comment' ? editTitle : null, editBody, el('div', { class: 'row' }, [el('button', { class: 'small primary', text: '정정 저장', onclick: function () { act({ action: 'edit', id: p.id, title: p.type !== 'comment' ? editTitle.value : undefined, body: editBody.value }, msg); } })])]);
    var delConfirm = el('button', { class: 'small danger', text: '정말 삭제', hidden: '', onclick: function () { act({ action: 'delete', id: p.id }, msg); } });
    var a = p.author;
    return el('article', { class: 'post' }, [
      el('div', { class: 'meta' }, [el('span', { class: 'pill type', text: TYPE[p.type] }), el('span', { class: 'pill ' + (p.status === 'published' ? 'ok' : p.status === 'pending' ? 'wait' : 'bad'), text: STATUS[p.status] || p.status }), p.progress ? el('span', { class: 'pill', text: p.progress }) : null, el('b', { text: p.nickname }), el('span', { text: fmt(p.createdAt) })]),
      el('div', { class: 'ops' }, [a ? ('작성 계정: ' + a.email + ' · 인증 ' + fmt(a.verifiedAt) + ' · 계정 ID ' + a.id + (a.disabled ? ' · 이용 제한 중' : '')) : '작성 계정 정보 없음']),
      p.flags && p.flags.length ? el('p', { class: 'flags', text: '확인 필요: ' + p.flags.join(', ') }) : null,
      parent ? el('p', { class: 'note', text: '원글: ' + (parent.title || parent.body.slice(0, 40)) }) : null,
      p.title ? el('h3', { text: p.title }) : null,
      el('p', { class: 'body', text: p.body }),
      p.privateNote ? el('div', { class: 'ops' }, ['운영자 전달 메모: ' + p.privateNote]) : null,
      el('div', { class: 'actions' }, [
        p.status !== 'published' ? el('button', { class: 'small primary', text: '공개', onclick: function () { act({ action: 'publish', id: p.id }, msg); } }) : el('button', { class: 'small', text: '비공개로', onclick: function () { act({ action: 'hide', id: p.id }, msg); } }),
        p.status === 'pending' ? el('button', { class: 'small', text: '반려', onclick: function () { act({ action: 'reject', id: p.id, reason: reason.value }, msg); } }) : null,
        el('button', { class: 'small', text: '정정', onclick: function () { editBox.hidden = !editBox.hidden; } }),
        el('button', { class: 'small danger', text: '삭제', onclick: function () { delConfirm.hidden = false; } }), delConfirm,
        a ? el('button', { class: 'small', text: a.disabled ? '계정 제한 풀기' : '계정 이용 제한', onclick: function () { act({ action: 'disable_account', id: a.id, disabled: !a.disabled }, msg); } }) : null,
      ]),
      p.status === 'pending' ? reason : null,
      editBox,
      p.type === 'feedback' || p.type === 'report' ? el('div', { class: 'row' }, [el('span', { class: 'note', text: '진행 상태' }), prog, el('button', { class: 'small', text: '상태 저장', onclick: function () { act({ action: 'progress', id: p.id, progress: prog.value }, msg); } })]) : null,
      el('div', { class: 'grid2' }, [reply, el('div', { class: 'row' }, [el('button', { class: 'small', text: '답변 저장', onclick: function () { act({ action: 'reply', id: p.id, reply: reply.value }, msg); } })])]),
      p.history && p.history.length ? el('p', { class: 'note', text: '기록: ' + p.history.map(function (h) { return fmt(h.at) + ' ' + h.what; }).join(' / ') }) : null,
      msg,
    ]);
  }

  function requestCard(r) {
    var msg = el('p', { class: 'msg', role: 'status' });
    var post = data.posts.filter(function (x) { return x.id === r.postId; })[0];
    var st = el('select', { 'aria-label': '처리 상태' }, ['접수', '검토 중', '처리 완료', '반려'].map(function (x) { var o = el('option', { text: x }); o.value = x; if (x === r.status) o.selected = true; return o; }));
    var ans = el('textarea', { class: 'short', 'aria-label': '처리 메모', placeholder: '처리 내용 메모 (운영자용)' }); ans.value = r.answer || '';
    var KIND = { report: '신고', delete: '삭제 요청', correct: '정정 요청' };
    return el('article', { class: 'post' }, [
      el('div', { class: 'meta' }, [el('span', { class: 'pill bad', text: KIND[r.kind] }), el('span', { class: 'pill', text: r.status }), el('span', { text: fmt(r.createdAt) }), r.accountId ? el('span', { text: '로그인 계정 ' + r.accountId }) : el('span', { text: '비로그인' })]),
      el('p', { class: 'note', text: '대상 글: ' + (post ? (post.title || post.body.slice(0, 50)) + ' (' + (STATUS[post.status] || post.status) + ')' : '삭제된 글') }),
      el('p', { class: 'body', text: r.reason }),
      r.contact ? el('div', { class: 'ops' }, ['연락처: ' + r.contact]) : null,
      el('div', { class: 'row' }, [st, el('button', { class: 'small', text: '저장', onclick: function () { act({ action: 'request_status', id: r.id, status: st.value, answer: ans.value }, msg); } }),
        post && post.status === 'published' ? el('button', { class: 'small', text: '대상 글 비공개', onclick: function () { act({ action: 'hide', id: post.id }, msg); } }) : null]),
      ans, msg,
    ]);
  }

  function render() {
    var v = $('#view'); v.textContent = '';
    var pend = data.posts.filter(function (p) { return p.status === 'pending'; });
    var openReq = data.requests.filter(function (r) { return r.status === '접수' || r.status === '검토 중'; });
    $('#cPending').textContent = pend.length ? '(' + pend.length + ')' : '';
    $('#cReq').textContent = openReq.length ? '(' + openReq.length + ')' : '';
    var list;
    if (view === 'requests') {
      list = data.requests;
      if (!list.length) return v.appendChild(el('div', { class: 'empty', text: '받은 요청이 없어요.' }));
      return list.forEach(function (r) { v.appendChild(requestCard(r)); });
    }
    list = data.posts.filter(function (p) { return view === 'pending' ? p.status === 'pending' : view === 'published' ? p.status === 'published' : (p.status === 'rejected' || p.status === 'hidden'); });
    if (!list.length) return v.appendChild(el('div', { class: 'empty', text: '해당하는 글이 없어요.' }));
    list.forEach(function (p) { v.appendChild(postCard(p)); });
  }

  if (pw) load();
})();
