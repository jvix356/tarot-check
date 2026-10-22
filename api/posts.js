import { readJSON, writeJSON } from '../lib/store.js';
import { send, readBody, newId, sameOrigin, clip } from '../lib/util.js';
import { currentAccount } from '../lib/accounts.js';
import { checkText, checkPrivate, checkNickname } from '../lib/filter.js';
import { TYPES, publicIndex, rebuildIndex } from '../lib/board.js';
import { authorKey, blockState } from '../lib/moderation.js';

// 후기·피드백·댓글은 닉네임만으로 쓰고 바로 공개돼요. 제보는 이메일 인증 후 운영자 확인을 거쳐 공개돼요.
const OPEN_TYPES = ['review', 'feedback', 'comment'];

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
      return send(res, 200, publicIndex(idx));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
    const acc = await currentAccount(req);
    const b = await readBody(req);
    const type = String(b.type || '');
    if (!TYPES[type]) return send(res, 400, { error: 'type' });
    if (!acc && !OPEN_TYPES.includes(type)) return send(res, 401, { error: 'login_required', message: '제보는 이메일 인증 후에 쓸 수 있어요.' });
    let nickname = acc && acc.nickname;
    if (!acc) {
      nickname = clip(b.nickname, 12);
      const bad = checkNickname(nickname);
      if (bad) return send(res, 400, { error: 'nickname', message: bad });
    } else if (!nickname) return send(res, 400, { error: 'nickname_required', message: '먼저 닉네임을 정해 주세요.' });

    const key = authorKey(req, acc);
    const blocked = await blockState(key);
    if (blocked) return send(res, 403, { error: 'blocked', message: '운영 원칙 위반이 반복돼 ' + blocked.until.slice(0, 10) + '까지 글을 쓸 수 없어요. 문의는 각 글의 정정 요청으로 보내 주세요.' });

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
      message: `공개 글에 쓸 수 없는 내용이 있어요: ${chk.blocked.join(', ')}. 고쳐서 다시 올려 주세요.${type === 'report' ? ' 계정 아이디·링크·계좌·연락처 같은 정보는 아래 "운영자에게만 전달" 칸에 적어 주세요.' : ''}` });
    const noteBad = note ? checkPrivate(note) : [];
    if (noteBad.length) return send(res, 400, { error: 'filtered', blocked: noteBad, message: `운영자 전달 내용에 쓸 수 없는 표현이 있어요: ${noteBad.join(', ')}` });

    const now = Date.now();
    const rlPath = acc ? `accounts/${acc.id}.json` : `rl/post-${key}.json`;
    const rl = acc || (await readJSON(rlPath)) || {};
    rl.recent = (rl.recent || []).filter(t => now - t < DAY);
    if (rl.recent.length >= (acc ? 10 : 5)) return send(res, 429, { error: 'rate', message: '하루에 쓸 수 있는 글 수를 넘었어요. 내일 다시 써 주세요.' });

    // 특정인을 사기꾼으로 단정하는 표현 등 검토 표시가 있거나 제보면 운영자 확인 뒤 공개
    const review = type === 'report' || chk.flags.length > 0;
    const id = newId();
    const post = {
      id, type, parentId, title, body, privateNote: note,
      nickname, authorId: acc ? acc.id : null, authorKey: key,
      status: review ? 'pending' : 'published', publishedAt: review ? null : new Date(now).toISOString(),
      progress: type === 'feedback' || type === 'report' ? '접수' : null,
      flags: chk.flags, createdAt: new Date(now).toISOString(), reply: null, history: [], reporters: [],
    };
    await writeJSON(`posts/${id}.json`, post);
    rl.recent.push(now);
    if (acc) { acc.posts = [...(acc.posts || []), id].slice(-200); }
    await writeJSON(rlPath, rl);
    if (!review) await rebuildIndex();
    const message = !review ? '바로 공개됐어요. 문제가 있는 글은 신고가 쌓이면 자동으로 숨겨져요.'
      : type === 'report' ? '접수됐어요. 제보는 운영자가 확인한 뒤 공개돼요.'
      : '특정인을 단정하는 표현(' + chk.flags.join(', ') + ')이 있어 운영자가 확인한 뒤 공개돼요.';
    return send(res, 200, { ok: true, id, state: post.status, message });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: '잠시 후 다시 시도해 주세요.' });
  }
}
