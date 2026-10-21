import { readJSON, writeJSON } from '../lib/store.js';
import { send, readBody, newId, sameOrigin, clip, pseudo, clientIp } from '../lib/util.js';
import { checkPrivate } from '../lib/filter.js';
import { currentAccount } from '../lib/accounts.js';

const KINDS = { report: '신고', delete: '삭제 요청', correct: '정정 요청' };
const DAY = 864e5;

// 공개된 글에 대한 신고·삭제·정정 요청. 글에 언급된 당사자도 쓸 수 있게 로그인 없이 받아요.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
    const b = await readBody(req);
    const kind = String(b.kind || '');
    if (!KINDS[kind]) return send(res, 400, { error: 'kind' });
    const postId = clip(b.postId, 40);
    const post = await readJSON(`posts/${postId}.json`);
    if (!post || post.status !== 'published') return send(res, 404, { error: 'post', message: '요청할 글을 찾지 못했어요.' });
    const reason = clip(b.reason, 1500);
    const contact = clip(b.contact, 200);
    if (reason.length < 5) return send(res, 400, { error: 'reason', message: '사유를 5자 이상 적어 주세요.' });
    const bad = checkPrivate(reason + '\n' + contact);
    if (bad.length) return send(res, 400, { error: 'filtered', message: `쓸 수 없는 표현이 있어요: ${bad.join(', ')}` });

    const ipKey = `rl/req-${pseudo('ip', clientIp(req))}.json`;
    const rl = (await readJSON(ipKey)) || { t: [] };
    const now = Date.now();
    rl.t = (rl.t || []).filter(t => now - t < DAY);
    if (rl.t.length >= 10) return send(res, 429, { error: 'rate', message: '오늘 보낼 수 있는 요청 수를 넘었어요.' });
    rl.t.push(now); await writeJSON(ipKey, rl);

    const acc = await currentAccount(req).catch(() => null);
    const id = newId();
    await writeJSON(`requests/${id}.json`, {
      id, kind, postId, reason, contact, accountId: acc ? acc.id : null,
      status: '접수', createdAt: new Date(now).toISOString(), answer: '',
    });
    return send(res, 200, { ok: true, id, message: `${KINDS[kind]}이 접수됐어요. 운영자가 확인할게요.` });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: '잠시 후 다시 시도해 주세요.' });
  }
}
