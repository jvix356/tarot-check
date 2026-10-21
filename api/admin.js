import { readJSON, writeJSON, listPaths, remove } from '../lib/store.js';
import { send, readBody, bearer, safeEqual, clip } from '../lib/util.js';
import { allPosts, rebuildIndex, PROGRESS } from '../lib/board.js';

function adminSecret() {
  return process.env.ADMIN_TOKEN || (process.env.STORE === 'memory' ? 'test-admin-token-1234' : '');
}
function isAdmin(req) {
  const want = adminSecret();
  return want.length >= 16 && safeEqual(bearer(req), want);
}

export default async function handler(req, res) {
  try {
    if (adminSecret().length < 16) return send(res, 503, { error: 'admin_not_configured', message: '운영자 비밀번호(ADMIN_TOKEN, 16자 이상)가 아직 설정되지 않았어요.' });
    if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });

    if (req.method === 'GET') {
      const posts = await allPosts();
      const accCache = {};
      for (const p of posts) {
        if (!accCache[p.authorId]) accCache[p.authorId] = await readJSON(`accounts/${p.authorId}.json`);
        const a = accCache[p.authorId];
        p.author = a ? { id: a.id, email: a.email, method: a.method, verifiedAt: a.verifiedAt, disabled: !!a.disabled } : null;
      }
      const requests = [];
      for (const k of await listPaths('requests/')) { const r = await readJSON(k); if (r) requests.push(r); }
      requests.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
      return send(res, 200, { posts, requests, progress: PROGRESS });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    const b = await readBody(req);
    const id = clip(b.id, 40);

    if (b.action === 'request_status') {
      const r = await readJSON(`requests/${id}.json`);
      if (!r) return send(res, 404, { error: 'not_found' });
      r.status = ['접수', '검토 중', '처리 완료', '반려'].includes(b.status) ? b.status : r.status;
      r.answer = clip(b.answer ?? r.answer, 1000);
      r.updatedAt = new Date().toISOString();
      await writeJSON(`requests/${id}.json`, r);
      return send(res, 200, { ok: true });
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
    const now = new Date().toISOString();
    const log = (what) => { p.history = [...(p.history || []), { at: now, what }].slice(-30); };

    switch (b.action) {
      case 'publish': p.status = 'published'; p.publishedAt = now; log('공개'); break;
      case 'reject': p.status = 'rejected'; p.rejectReason = clip(b.reason, 300); log('반려'); break;
      case 'hide': p.status = 'hidden'; log('비공개 전환'); break;
      case 'delete':
        await remove(`posts/${id}.json`);
        if (p.type !== 'comment') for (const k of await listPaths('posts/')) { const c = await readJSON(k); if (c && c.parentId === id) await remove(k); }
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
    p.updatedAt = now;
    await writeJSON(`posts/${id}.json`, p);
    await rebuildIndex();
    return send(res, 200, { ok: true, post: p });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: String(e.message || e) });
  }
}
