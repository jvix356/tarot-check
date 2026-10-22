import { readJSON, writeJSON } from '../lib/store.js';
import { send, readBody, newId, sameOrigin, clip } from '../lib/util.js';
import { currentAccount } from '../lib/accounts.js';
import { checkText, checkPrivate, checkNickname, maskPrivate } from '../lib/filter.js';
import { TYPES, publicIndex, rebuildIndex } from '../lib/board.js';
import { authorKey, blockState, checkNickLock } from '../lib/moderation.js';
import { pseudo } from '../lib/util.js';
import { purgeReportNotes, NOTE_DAYS } from '../lib/retention.js';

// 후기·피드백·댓글은 닉네임만으로 쓰고 바로 공개돼요. 제보는 이메일 인증 후 운영자 전용으로 접수돼요.
const OPEN_TYPES = ['review', 'feedback', 'comment'];

import { newOwnerToken, ownerHash, ownsPost, ownerView } from '../lib/ownership.js';

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
          if (p && p.authorId === acc.id) mine.push(ownerView(p));
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
    if (b.action === 'lookup') {
      const mine = [];
      for (const item of (Array.isArray(b.keys) ? b.keys : []).slice(0, 50)) {
        if (!/^[a-z0-9]{10,40}$/.test(String(item.id || ''))) continue;
        const p = await readJSON(`posts/${item.id}.json`);
        if (p && ownsPost(p, acc, item.token)) mine.push(ownerView(p));
      }
      return send(res, 200, { posts: mine });
    }
    // 예전처럼 후기·피드백·댓글은 닉네임만으로 열어 두고, 개수 제한으로 관리해요. 비상시 COMMUNITY_PAUSED=1 또는 PUBLIC_COMMUNITY_WRITES=0으로 닫아요.
    if (process.env.COMMUNITY_PAUSED === '1' || (process.env.PUBLIC_COMMUNITY_WRITES === '0' && b.type !== 'report')) return send(res, 403, { error: 'read_only', message: '지금은 새 글 접수를 잠시 쉬고 있어요. 조금 뒤에 다시 와 주세요.' });
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
    const dev = /^[a-f0-9]{32}$/.test(String(b.dev || '')) ? 'dev-' + pseudo('dev', b.dev) : null;
    const blocked = (await blockState(key)) || (dev ? await blockState(dev) : null);
    if (blocked) return send(res, 403, { error: 'blocked', message: (blocked.permanent ? '운영 원칙 위반이 반복돼 영구 정지됐어요.' : '운영 원칙 위반이 반복돼 ' + blocked.until.slice(0, 10) + '까지 글을 쓸 수 없어요.') + ' 이의제기는 내 글 영역에서 할 수 있어요.' });

    if (!acc) { const lockMsg = await checkNickLock([key, dev].filter(Boolean), nickname); if (lockMsg) return send(res, 409, { error: 'nickname_locked', message: lockMsg }); }
    // 공개되는 제목·본문 속 전화번호·이메일·계좌·주소·링크 같은 개인정보는 저장 전에 자동으로 가려요(원문은 저장하지 않아요).
    const m1 = maskPrivate(type === 'comment' ? '' : clip(b.title, 60)), m2 = maskPrivate(clip(b.body, type === 'comment' ? 500 : 3000));
    const title = m1.text, body = m2.text, masked = [...new Set([...m1.masked, ...m2.masked])];
    const note = type === 'report' ? clip(b.privateNote, 1500) : '';
    if (type !== 'comment' && title.length < 2) return send(res, 400, { error: 'title', message: '제목을 2자 이상 써 주세요.' });
    if (body.length < 5) return send(res, 400, { error: 'body', message: '내용을 5자 이상 써 주세요.' });
    if (!b.agree) return send(res, 400, { error: 'agree', message: '작성 안내에 동의해 주세요.' });

    let parentId = null;
    if (type === 'comment') {
      parentId = clip(b.parentId, 40);
      const parent = await readJSON(`posts/${parentId}.json`);
      if (!parent || parent.status !== 'published' || ['comment', 'report'].includes(parent.type)) return send(res, 404, { error: 'parent', message: '댓글을 달 글을 찾지 못했어요.' });
    }

    const chk = checkText((title + '\n' + body).split('[가림]').join(' '));
    if (chk.blocked.length) return send(res, 400, { error: 'filtered', blocked: chk.blocked,
      message: `공개 글에 쓸 수 없는 내용이 있어요: ${chk.blocked.join(', ')}. 고쳐서 다시 올려 주세요.${type === 'report' ? ' 계정 아이디·링크·계좌·연락처 같은 정보는 아래 "운영자에게만 전달" 칸에 적어 주세요.' : ''}` });
    const noteBad = note ? checkPrivate(note) : [];
    if (noteBad.length) return send(res, 400, { error: 'filtered', blocked: noteBad, message: `운영자 전달 내용에 쓸 수 없는 표현이 있어요: ${noteBad.join(', ')}` });

    const now = Date.now();
    const rlPath = acc ? `accounts/${acc.id}.json` : `rl/post-${key}.json`;
    const rl = acc || (await readJSON(rlPath)) || {};
    rl.recent = (rl.recent || []).filter(t => now - t < DAY);
    if (rl.recent.length >= (acc ? 10 : 5)) return send(res, 429, { error: 'rate', message: '하루에 쓸 수 있는 글 수를 넘었어요. 내일 다시 써 주세요.' });

    const dayKey = new Date(now + 9 * 36e5).toISOString().slice(0, 10);
    const capPath = `rl/site-${dayKey}.json`, cap = (await readJSON(capPath)) || {};
    const CAPS = { review: 60, feedback: 60, comment: 200, report: 30 };
    if ((cap[type] || 0) >= CAPS[type]) return send(res, 429, { error: 'site_rate', message: '오늘 사이트 전체 접수 한도가 찼어요. 내일 다시 써 주세요.' });

    // 특정인을 사기꾼으로 단정하는 표현 등 검토 표시가 있거나 제보면 운영자 전용 검토
    const review = type === 'report' || chk.flags.length > 0;
    const id = newId();
    const ownerToken = acc ? null : newOwnerToken();
    const post = {
      id, type, parentId, title, body, privateNote: note,
      ownerHash: ownerToken ? ownerHash(ownerToken) : null,
      nickname, authorId: acc ? acc.id : null, authorKey: key, devKey: dev,
      status: review ? 'pending' : 'published', publishedAt: review ? null : new Date(now).toISOString(),
      progress: type === 'feedback' || type === 'report' ? '접수' : null,
      flags: chk.flags, createdAt: new Date(now).toISOString(), reply: null, history: [], reporters: [],
    };
    await writeJSON(`posts/${id}.json`, post);
    rl.recent.push(now);
    cap[type] = (cap[type] || 0) + 1; cap.exp = now; await writeJSON(capPath, cap);
    if (acc) { acc.posts = [...(acc.posts || []), id].slice(-200); }
    await writeJSON(rlPath, rl);
    if (!review) await rebuildIndex();
    if (type === 'report') { try { await purgeReportNotes(now); } catch (e) {} }
    const message = !review ? '바로 공개됐어요. 문제가 있는 글은 신고가 쌓이면 자동으로 숨겨져요.'
      : type === 'report' ? `접수됐어요. 제보는 운영자만 보고 공개되지 않아요. 운영자 전달 메모(개인정보)는 ${NOTE_DAYS}일 뒤 자동으로 삭제돼요.`
      : '특정인을 단정하는 표현(' + chk.flags.join(', ') + ')이 있어 운영자가 확인한 뒤 공개돼요.';
    const maskNote = masked.length ? ` 개인정보로 보이는 내용(${masked.join(', ')})은 자동으로 가렸어요.` : '';
    return send(res, 200, { ok: true, id, ownerToken, state: post.status, masked, message: message + maskNote });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: '잠시 후 다시 시도해 주세요.' });
  }
}
