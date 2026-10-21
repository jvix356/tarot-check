import { readJSON, writeJSON } from '../lib/store.js';
import { send, readBody, newId, sameOrigin, clip } from '../lib/util.js';
import { currentAccount } from '../lib/accounts.js';
import { checkText, checkPrivate } from '../lib/filter.js';
import { TYPES } from '../lib/board.js';

const DAY = 864e5;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (req.query?.mine || /[?&]mine=1/.test(req.url || '')) {
        const acc = await currentAccount(req);
        if (!acc) return send(res, 401, { error: 'login_required' });
        const mine = [];
        for (const id of (acc.posts || []).slice(-50).reverse()) {
          const p = await readJSON(`posts/${id}.json`);
          if (p) mine.push({ id: p.id, type: p.type, title: p.title, body: p.body.slice(0, 120), status: p.status, progress: p.progress, createdAt: p.createdAt, rejectReason: p.rejectReason || '' });
        }
        return send(res, 200, { posts: mine });
      }
      const idx = (await readJSON('index/public.json')) || { posts: [] };
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 200, idx);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
    const acc = await currentAccount(req);
    if (!acc) return send(res, 401, { error: 'login_required', message: '이메일 인증 후에 글을 쓸 수 있어요.' });
    if (!acc.nickname) return send(res, 400, { error: 'nickname_required', message: '먼저 닉네임을 정해 주세요.' });

    const b = await readBody(req);
    const type = String(b.type || '');
    if (!TYPES[type]) return send(res, 400, { error: 'type' });
    const title = type === 'comment' ? '' : clip(b.title, 60);
    const body = clip(b.body, type === 'comment' ? 500 : 3000);
    const note = type === 'report' ? clip(b.privateNote, 1500) : '';
    if (type !== 'comment' && title.length < 2) return send(res, 400, { error: 'title', message: '제목을 2자 이상 써 주세요.' });
    if (body.length < 5) return send(res, 400, { error: 'body', message: '내용을 5자 이상 써 주세요.' });
    if (!b.agree) return send(res, 400, { error: 'agree', message: '작성 안내에 동의해 주세요.' });

    let parentId = null;
    if (type === 'comment') {
      parentId = clip(b.parentId, 40);
      const parent = await readJSON(`posts/${parentId}.json`);
      if (!parent || parent.status !== 'published' || parent.type === 'comment') return send(res, 404, { error: 'parent', message: '댓글을 달 글을 찾지 못했어요.' });
    }

    const chk = checkText(title + '\n' + body);
    if (chk.blocked.length) return send(res, 400, { error: 'filtered', blocked: chk.blocked,
      message: `공개 글에 쓸 수 없는 내용이 있어요: ${chk.blocked.join(', ')}. 고쳐서 다시 올려 주세요.${type === 'report' ? ' 계좌·연락처 같은 정보는 아래 "운영자에게만 전달" 칸에 적어 주세요.' : ''}` });
    const noteBad = note ? checkPrivate(note) : [];
    if (noteBad.length) return send(res, 400, { error: 'filtered', blocked: noteBad, message: `운영자 전달 내용에 쓸 수 없는 표현이 있어요: ${noteBad.join(', ')}` });

    const now = Date.now();
    acc.recent = (acc.recent || []).filter(t => now - t < DAY);
    if (acc.recent.length >= 10) return send(res, 429, { error: 'rate', message: '하루에 쓸 수 있는 글 수를 넘었어요. 내일 다시 써 주세요.' });

    const id = newId();
    const post = {
      id, type, parentId, title, body, privateNote: note,
      nickname: acc.nickname, authorId: acc.id,
      status: 'pending', progress: type === 'feedback' || type === 'report' ? '접수' : null,
      flags: chk.flags, createdAt: new Date(now).toISOString(), reply: null, history: [],
    };
    await writeJSON(`posts/${id}.json`, post);
    acc.recent.push(now); acc.posts = [...(acc.posts || []), id].slice(-200);
    await writeJSON(`accounts/${acc.id}.json`, acc);
    return send(res, 200, { ok: true, id, message: '접수됐어요. 운영자가 확인한 뒤 공개돼요.' });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: '잠시 후 다시 시도해 주세요.' });
  }
}
