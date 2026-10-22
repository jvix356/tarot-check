(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var TYPE = { review: '후기', feedback: '피드백', report: '제보', comment: '댓글' };
  var STATUS = { private: '검토 완료·운영자 전용', pending: '검토 대기', published: '공개 중', rejected: '반려', hidden: '비공개' };
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
      el('div', { class: 'ops' }, [a ? ('작성 계정: ' + a.email + ' · 이메일 소유 확인(실명 확인 아님) ' + fmt(a.verifiedAt) + ' · 계정 ID ' + a.id + (a.disabled ? ' · 이용 제한 중' : '')) : '닉네임 작성 (이메일 인증 없음)',
        p.reportCount ? ' · 신고자 ' + p.reportCount + '명' : '', p.hiddenBy === 'reports' ? ' · 신고 누적 자동 숨김' : '',
        p.block && p.block.blockedUntil ? ' · 작성 제한 중(' + fmt(p.block.blockedUntil) + '까지)' : '']),
      p.flags && p.flags.length ? el('p', { class: 'flags', text: '확인 필요: ' + p.flags.join(', ') }) : null,
      parent ? el('p', { class: 'note', text: '원글: ' + (parent.title || parent.body.slice(0, 40)) }) : null,
      p.title ? el('h3', { text: p.title }) : null,
      el('p', { class: 'body', text: p.body }),
      p.privateNote ? el('div', { class: 'ops' }, ['운영자 전달 메모: ' + p.privateNote]) : null,
      el('div', { class: 'actions' }, [
        p.status !== 'published' ? el('button', { class: 'small primary', text: p.type === 'report' ? '검토 완료(비공개)' : '공개', onclick: function () { act({ action: 'publish', id: p.id }, msg); } }) : el('button', { class: 'small', text: '비공개로', onclick: function () { act({ action: 'hide', id: p.id }, msg); } }),
        p.status === 'pending' ? el('button', { class: 'small', text: '반려', onclick: function () { act({ action: 'reject', id: p.id, reason: reason.value }, msg); } }) : null,
        el('button', { class: 'small', text: '정정', onclick: function () { editBox.hidden = !editBox.hidden; } }),
        el('button', { class: 'small danger', text: '삭제', onclick: function () { delConfirm.hidden = false; } }), delConfirm,
        a ? el('button', { class: 'small', text: a.disabled ? '계정 제한 풀기' : '계정 이용 제한', onclick: function () { act({ action: 'disable_account', id: a.id, disabled: !a.disabled }, msg); } }) : null,
        p.block ? el('button', { class: 'small', text: p.block.blockedUntil ? '작성 제한 풀기' : '작성자 30일 작성 제한', onclick: function () { act({ action: 'block_author', key: p.block.key, blocked: !p.block.blockedUntil }, msg); } }) : null,
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
    var ans = el('textarea', { class: 'short', 'aria-label': r.kind === 'appeal' ? '작성자에게 전달할 결정 사유' : '처리 메모', placeholder: r.kind === 'appeal' ? '작성자에게 전달할 결정 사유 (5자 이상)' : '처리 내용 메모 (운영자용)' }); ans.value = r.answer || '';
    var KIND = { report: '신고', delete: '삭제 요청', correct: '정정 요청', appeal: '이의제기' };
    return el('article', { class: 'post' }, [
      el('div', { class: 'meta' }, [el('span', { class: 'pill bad', text: KIND[r.kind] }), el('span', { class: 'pill', text: r.status }), el('span', { text: fmt(r.createdAt) }), r.accountId ? el('span', { text: '로그인 계정 ' + r.accountId }) : el('span', { text: '비로그인' })]),
      el('p', { class: 'note', text: '대상 글: ' + (post ? (post.title || post.body.slice(0, 50)) + ' (' + (STATUS[post.status] || post.status) + ')' : '삭제된 글') }),
      el('p', { class: 'body', text: r.reason }),
      r.contact ? el('div', { class: 'ops' }, ['연락처: ' + r.contact]) : null,
      el('div', { class: 'row' }, [st, el('button', { class: 'small', text: '저장', onclick: function () { act({ action: 'request_status', id: r.id, status: st.value, answer: ans.value }, msg); } }),
        post && post.status === 'published' ? el('button', { class: 'small', text: '대상 글 비공개', onclick: function () { act({ action: 'hide', id: post.id }, msg); } }) : null]),
      r.kind === 'appeal' && post && ['접수', '검토 중'].indexOf(r.status) >= 0 ? el('div', { class: 'row' }, [
        el('button', { class: 'small primary', text: post && post.type === 'report' ? '운영자 전용으로 복원' : '재검토 후 복원', onclick: function () { act({ action: 'appeal_decision', id: r.id, decision: 'restore', answer: ans.value }, msg); } }),
        el('button', { class: 'small', text: '기존 조치 유지', onclick: function () { act({ action: 'appeal_decision', id: r.id, decision: 'uphold', answer: ans.value }, msg); } }),
      ]) : null,
      r.kind === 'appeal' && post ? el('details', null, [el('summary', { text: '대상 글·정정 도구 보기' }), postCard(post)]) : null,
      ans, msg,
    ]);
  }

  function render() {
    var v = $('#view'); v.textContent = '';
    var pend = data.posts.filter(function (p) { return p.status === 'pending' && p.type !== 'report'; });
    var openReq = data.requests.filter(function (r) { return r.status === '접수' || r.status === '검토 중'; });
    $('#cPending').textContent = pend.length ? '(' + pend.length + ')' : '';
    $('#cReq').textContent = openReq.length ? '(' + openReq.length + ')' : '';
    var list;
    if (view === 'teaching') return renderTeaching(v);
    if (view === 'stats') return renderStats(v);
    if (view === 'requests') {
      list = data.requests;
      if (!list.length) return v.appendChild(el('div', { class: 'empty', text: '받은 요청이 없어요.' }));
      return list.forEach(function (r) { v.appendChild(requestCard(r)); });
    }
    list = data.posts.filter(function (p) { return view === 'reports' ? p.type === 'report' : p.type === 'report' ? false : view === 'pending' ? p.status === 'pending' : view === 'published' ? p.status === 'published' : (p.status === 'rejected' || p.status === 'hidden'); });
    if (!list.length) return v.appendChild(el('div', { class: 'empty', text: '해당하는 글이 없어요.' }));
    list.forEach(function (p) { v.appendChild(postCard(p)); });
  }

  /* ---------- 이용 통계 ---------- */
  var OUTN = { normal: '일반 리더', harm: '피해 있음', unknown: '모름' };
  function renderStats(v) {
    v.appendChild(el('p', { class: 'note', text: '불러오는 중…' }));
    fetch('/api/stats?scope=report&days=365', { headers: { Authorization: 'Bearer ' + pw } })
      .then(function (r) { return r.json().then(function (j) { j.__status = r.status; return j; }); })
      .then(function (r) {
        v.textContent = '';
        if (r.__status !== 200) return v.appendChild(el('div', { class: 'empty', text: r.message || '통계를 불러오지 못했어요.' }));
        var s = r.stats, o = s.outcome || {}, b = r.board;
        v.appendChild(el('div', { class: 'post' }, [
          el('h3', { text: '최근 1년 익명 통계 참여 ' + s.n + '건' }),
          el('p', { text: '일반 리더 ' + (o.normal || 0) + ' · 피해 있음 ' + (o.harm || 0) + ' · 모름 ' + (o.unknown || 0) }),
          el('p', { class: 'note', text: '게시판: 검토 대기 ' + b.pending + ' · 이번 주 새 글 ' + b.newThisWeek + ' · 진행 중 피드백 ' + b.feedbackOpen + ' · 진행 중 제보 ' + b.reportsOpen + ' · 처리 대기 요청 ' + b.requestsOpen })]));
        var rows = Object.keys(s.signals).map(function (k) { var c = s.signals[k]; return { k: k, all: c.all || 0, n: c.normal || 0, h: c.harm || 0 }; })
          .sort(function (a, b2) { return b2.all - a.all; });
        var pct = function (x, base) { return base ? Math.round(x / base * 100) + '%' : '-'; };
        var tb = el('tbody');
        tb.appendChild(el('tr', null, ['표현 항목', '전체', '일반 리더 중', '피해 사례 중', '검토 제안'].map(function (t) { return el('td', { class: 'note', text: t }); })));
        rows.forEach(function (x) {
          var pn = o.normal ? x.n / o.normal : 0, ph = o.harm ? x.h / o.harm : 0, hint = '';
          if ((o.normal || 0) >= 20 && pn >= 0.4 && ph <= pn * 1.2) hint = '일반 리더에게도 흔함 · 안내 문구 완화 검토';
          else if ((o.harm || 0) >= 20 && ph >= 0.3 && ph >= pn * 2) hint = '피해 사례에서 더 자주 보임';
          tb.appendChild(el('tr', null, [el('td', { text: x.k }), el('td', { class: 'n', text: String(x.all) }), el('td', { class: 'n', text: pct(x.n, o.normal) }), el('td', { class: 'n', text: pct(x.h, o.harm) }), el('td', { class: 'note', text: hint })]));
        });
        v.appendChild(el('div', { class: 'post' }, [el('h3', { text: '표현 항목별 분포' }), el('div', { class: 'tablewrap' }, [el('table', { class: 'sig' }, [tb])]),
          el('p', { class: 'note', text: '참여자가 직접 고른 결과를 합산한 값이라 검증된 정답이 아니에요. 일부러 틀린 결과를 많이 보내는 경우도 있을 수 있으니, 기준을 바꿀 때는 게시판 피드백과 함께 판단하세요. 응답이 20건 미만이면 검토 제안을 표시하지 않아요.' })]));
        var fl = el('tbody');
        Object.keys(s.flags).forEach(function (k) { var c = s.flags[k]; fl.appendChild(el('tr', null, [el('td', { text: k }), el('td', { class: 'n', text: String(c.all || 0) }), el('td', { class: 'n', text: pct(c.normal || 0, o.normal) }), el('td', { class: 'n', text: pct(c.harm || 0, o.harm) })])); });
        v.appendChild(el('div', { class: 'post' }, [el('h3', { text: '주의 표현(결제·재촉 등)' }), el('div', { class: 'tablewrap' }, [el('table', { class: 'sig' }, [fl])])]));
        var days = Object.keys(s.byDay || {}).sort().slice(-30);
        v.appendChild(el('div', { class: 'post' }, [el('h3', { text: '최근 30일 날짜별 참여' }), el('p', { class: 'note', text: days.map(function (d) { return d.slice(5) + ' ' + s.byDay[d]; }).join(' · ') || '아직 없어요.' })]));
      });
  }

  function renderTeaching(v) {
    v.appendChild(el('p', {class:'note',text:'불러오는 중…'}));
    fetch('/api/teaching?scope=admin',{headers:{Authorization:'Bearer '+pw}}).then(function(r){return r.json().then(function(j){j.ok=r.ok;return j;});}).then(function(r){
      if(view !== 'teaching')return;
      v.textContent='';
      if(!r.ok)return v.appendChild(el('p',{text:r.message||'교정 제안을 불러오지 못했어요.'}));
      v.appendChild(el('p',{class:'note',text:'원문 진위는 투표로 확인되지 않아요. 개인정보·저작권·문맥과 반례를 확인하고 공동 검토를 연 뒤 최종 반영하세요. 동의 3개 이상·전체 검토 2/3 이상은 최소 조건이며 정확도를 보장하지 않아요. 반영 취소 시 가르치기 안내와 점수에서도 빠져요.'}));
      if(!r.proposals.length)v.appendChild(el('p',{text:'접수된 교정 제안이 없어요.'}));
      r.proposals.forEach(function(p){
        var status=el('p',{class:'msg',role:'status'}),answer=el('textarea',{'aria-label':'교정 검토 사유',maxlength:'500'});answer.value=p.answer||'';
        function decide(state){status.textContent='저장 중…';fetch('/api/teaching',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+pw},body:JSON.stringify({action:'review',id:p.id,status:state,answer:answer.value})}).then(function(res){return res.json().then(function(j){j.ok=res.ok;return j;});}).then(function(j){if(j.ok)renderTeaching(v);else status.textContent=j.message||'처리하지 못했어요.';}).catch(function(){status.textContent='연결 오류';});}
        var buttons=[];
        if(p.status==='pending')buttons.push(el('button',{text:'공동 검토 시작',onclick:function(){decide('voting');}}));
        if(p.status==='voting')buttons.push(el('button',{text:'교정 반영',onclick:function(){decide('accepted');}}));
        if(p.status!=='rejected')buttons.push(el('button',{text:'보류·반려 / 반영 취소',onclick:function(){decide('rejected');}}));
        v.appendChild(el('article',{class:'post'},[el('h3',{text:p.signal}),el('p',{text:'상태: '+p.status+' · 방향: '+p.kind}),el('p',{text:'예시: '+p.example}),el('p',{text:'설명: '+p.explanation}),el('p',{text:'동의 '+p.counts.agree+' · 반대 '+p.counts.disagree+' · 판단 어려움 '+p.counts.unsure+' · 최소 조건 '+(p.qualified?'충족':'미충족')}),answer,el('div',{class:'row'},buttons),status]));
      });
    }).catch(function(){v.textContent='교정 제안을 불러오지 못했어요.';});
  }
  if (pw) load();
})();
