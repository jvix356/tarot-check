import { checkText } from '../lib/filter.js';
import { readJSON, writeJSON, listPaths, remove } from '../lib/store.js';
import { purgeReportNotes } from '../lib/retention.js';
import { send, readBody, bearer, safeEqual, clip, sameOrigin } from '../lib/util.js';
import { allPosts, rebuildIndex, PROGRESS } from '../lib/board.js';
import { clearPostStrike, addStrike, setBlock, blockState } from '../lib/moderation.js';

function adminSecret() {
  return process.env.ADMIN_TOKEN || (process.env.STORE === 'memory' ? 'test-admin-token-1234' : '');
}
function isAdmin(req) {
  const want = adminSecret();
  return want.length >= 16 && safeEqual(bearer(req), want);
}

// 처리방침의 보유 기간을 지키도록, 운영자 화면을 열 때 기간이 지난 기록을 지워요
// - 처리 끝난 신고·삭제·정정 요청: 처리 후 1년
// - 작성 제한 기록: 제한이 끝났고 마지막 위반이 180일 지난 것
// - 인증 코드·요청 횟수 기록: 하루 지난 것
async function purgeExpired(now = Date.now()) {
  await purgeReportNotes(now);
  for (const k of await listPaths('requests/')) {
    const r = await readJSON(k);
    if (r && ['처리 완료', '반려'].includes(r.status) && now - Date.parse(r.updatedAt || r.createdAt) > 365 * 864e5) {
      if (r.kind === 'appeal') {
        const p = await readJSON(`posts/${r.postId}.json`);
        if (p?.appeal?.id === r.id) { p.appeal = { id: r.id, status: r.status, createdAt: r.createdAt }; await writeJSON(`posts/${p.id}.json`, p); }
      }
      await remove(k);
    }
  }
  for (const k of await listPaths('blocks/')) {
    const b = await readJSON(k);
    const last = Math.max(0, ...((b && b.strikes) || []).map(s => Date.parse(s.at) || 0));
    if (b && (!b.until || Date.parse(b.until) < now) && now - last > 180 * 864e5) await remove(k);
  }
  for (const pre of ['otp/', 'rl/']) for (const k of await listPaths(pre)) {
    const r = await readJSON(k);
    const ts = [r && r.exp, ...((r && (r.t || r.recent || r.sends)) || [])].filter(Boolean);
    if (!ts.length || now - Math.max(...ts) > 864e5) await remove(k);
  }
}

export default async function handler(req, res) {
  try {
    if (adminSecret().length < 16) return send(res, 503, { error: 'admin_not_configured', message: '운영자 비밀번호(ADMIN_TOKEN, 16자 이상)가 아직 설정되지 않았어요.' });
    if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });

    if (req.method === 'GET') {
      await purgeExpired();
      const posts = await allPosts();
      const accCache = {};
      for (const p of posts) {
        if (!accCache[p.authorId]) accCache[p.authorId] = await readJSON(`accounts/${p.authorId}.json`);
        const a = accCache[p.authorId];
        p.author = a ? { id: a.id, email: a.email, method: a.method, verifiedAt: a.verifiedAt, disabled: !!a.disabled } : null;
        const key = p.authorKey || (p.authorId ? 'acc-' + p.authorId : '');
        const bl = key ? await blockState(key) : null;
        p.block = key ? { key, blockedUntil: bl ? bl.until : null } : null;
        p.reportCount = (p.reporters || []).length;
        delete p.reporters;
        delete p.ownerHash;
      }
      const requests = [];
      for (const k of await listPaths('requests/')) { const r = await readJSON(k); if (r) requests.push(r); }
      requests.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
      return send(res, 200, { posts, requests, progress: PROGRESS });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
    const b = await readBody(req);
    const id = clip(b.id, 40);

    if (b.action === 'request_status') {
      const r = await readJSON(`requests/${id}.json`);
      if (!r) return send(res, 404, { error: 'not_found' });
      if (r.kind === 'appeal') {
        if (!['접수', '검토 중'].includes(b.status)) return send(res, 400, { error: 'use_appeal_decision', message: '복원 또는 유지 버튼으로 결정해 주세요.' });
        const p = await readJSON(`posts/${r.postId}.json`);
        if (!p || p.appeal?.id !== r.id || !['접수', '검토 중'].includes(p.appeal.status)) return send(res, 409, { error: 'closed' });
        p.appeal.status = b.status;
        await writeJSON(`posts/${p.id}.json`, p);
      }
      r.status = ['접수', '검토 중', '처리 완료', '반려'].includes(b.status) ? b.status : r.status;
      r.answer = clip(b.answer ?? r.answer, 1000);
      r.updatedAt = new Date().toISOString();
      await writeJSON(`requests/${id}.json`, r);
      return send(res, 200, { ok: true });
    }

    if (b.action === 'appeal_decision') {
      const r = await readJSON(`requests/${id}.json`);
      const p = r && await readJSON(`posts/${r.postId}.json`);
      if (!r || r.kind !== 'appeal' || !p || p.appeal?.id !== id) return send(res, 404, { error: 'not_found' });
      if (!['접수', '검토 중'].includes(p.appeal.status) || !['hidden', 'rejected'].includes(p.status)) return send(res, 409, { error: 'closed', message: '이미 처리됐거나 글 상태가 변경됐어요.' });
      const answer = clip(b.answer, 1000);
      if (answer.length < 5 || !['restore', 'uphold'].includes(b.decision)) return send(res, 400, { error: 'decision', message: '결정과 사유를 5자 이상 적어 주세요.' });
      if (b.decision === 'restore') {
        const blocked = checkText([p.title, p.body, p.nickname, p.reply?.body].filter(Boolean).join('\n')).blocked;
        if (blocked.length) return send(res, 400, { error: 'filtered', message: '개인정보·금지 표현을 정정한 뒤 복원해 주세요.' });
        if (p.parentId) {
          const parent = await readJSON(`posts/${p.parentId}.json`);
          if (!parent || parent.status !== 'published') return send(res, 409, { error: 'parent', message: '원글을 먼저 복원해 주세요.' });
        }
        p.status = p.type === 'report' ? 'private' : 'published'; p.publishedAt = new Date().toISOString(); p.reporters = []; p.hiddenBy = null; p.rejectReason = '';
        await clearPostStrike(p.authorKey || (p.authorId ? 'acc-' + p.authorId : ''), p.id);
      }
      r.status = b.decision === 'restore' ? '처리 완료' : '반려'; r.answer = answer; r.updatedAt = new Date().toISOString();
      p.appeal = { ...p.appeal, status: r.status, answer, decision: b.decision, updatedAt: r.updatedAt };
      p.history = [...(p.history || []), { at: r.updatedAt, what: b.decision === 'restore' ? '이의제기 재검토 후 복원' : '이의제기 재검토 후 기존 조치 유지' }].slice(-30);
      await writeJSON(`posts/${p.id}.json`, p);
      await writeJSON(`requests/${id}.json`, r);
      await rebuildIndex();
      return send(res, 200, { ok: true });
    }

    if (b.action === 'block_author') {
      const key = clip(b.key, 80);
      if (!/^(acc|ip)-[\w-]+$/.test(key)) return send(res, 400, { error: 'key' });
      const r = await setBlock(key, !!b.blocked);
      return send(res, 200, { ok: true, blockedUntil: r.until });
    }

    if (b.action === 'disable_account') {
      const a = await readJSON(`accounts/${id}.json`);
      if (!a) return send(res, 404, { error: 'not_found' });
      a.disabled = !!b.disabled; a.sessionVersion = (a.sessionVersion || 1) + 1;
      await writeJSON(`accounts/${id}.json`, a);
      return send(res, 200, { ok: true });
    }

    const p = await readJSON(`posts/${id}.json`);
    if (!p) return send(res, 404, { error: 'not_found' });
    if (b.action === 'publish' && p.appeal && ['접수', '검토 중'].includes(p.appeal.status)) return send(res, 409, { error: 'appeal_open', message: '요청 목록의 이의제기에서 재검토 후 복원해 주세요.' });
    const now = new Date().toISOString();
    const log = (what) => { p.history = [...(p.history || []), { at: now, what }].slice(-30); };

    switch (b.action) {
      case 'publish': p.status = p.type === 'report' ? 'private' : 'published'; p.publishedAt = now; if (p.hiddenBy === 'reports') { p.reporters = []; p.hiddenBy = null; } log('공개'); break;
      case 'reject': p.status = 'rejected'; p.rejectReason = clip(b.reason, 300); log('반려');
        if (b.strike !== false) await addStrike(p.authorKey || (p.authorId ? 'acc-' + p.authorId : ''), '운영자 반려', p.id);
        if (b.strike !== false && p.devKey) await addStrike(p.devKey, '운영자 반려', p.id);
        break;
      case 'hide': p.rejectReason = clip(b.reason, 300) || '운영자 검토를 위해 비공개로 전환했어요.'; p.status = 'hidden'; log('비공개 전환'); break;
      case 'delete':
        await remove(`posts/${id}.json`);
        for (const k of await listPaths('posts/')) { const c = await readJSON(k); if (c && (c.parentId === id || c.rootId === id)) await remove(k); }
        await remove(`meta/${id}.json`);
        await rebuildIndex();
        return send(res, 200, { ok: true });
      case 'progress': if (!PROGRESS.includes(b.progress)) return send(res, 400, { error: 'progress' }); p.progress = b.progress; log('상태: ' + b.progress); break;
      case 'reply': {
        const body = clip(b.reply, 2000);
        p.reply = body ? { body, at: now } : null; log(body ? '운영자 답변' : '답변 삭제'); break;
      }
      case 'edit': {
        const body = clip(b.body, 3000); if (body.length < 5) return send(res, 400, { error: 'body' });
        p.body = body; if (b.title !== undefined) p.title = clip(b.title, 60); p.editedAt = now; log('운영자 정정'); break;
      }
      default: return send(res, 400, { error: 'action' });
    }
    if (['publish', 'edit', 'reply'].includes(b.action)) {
      const blocked = checkText([p.title, p.body, p.nickname, p.reply?.body].filter(Boolean).join('\n')).blocked;
      if (blocked.length) return send(res, 400, { error: 'filtered', blocked, message: '공개 내용에서 계정·링크·개인정보 또는 금지 표현을 제거해 주세요: ' + blocked.join(', ') });
    }
    p.updatedAt = now;
    await writeJSON(`posts/${id}.json`, p);
    await rebuildIndex();
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: String(e.message || e) });
  }
}
