// 게시판 자동 관리: 작성자 구분 키, 반복 위반 차단, 신고 누적 자동 숨김
// 작성자·신고자는 원래 IP나 이메일 대신 비밀키로 바꾼 값(pseudo)만 저장해요.
import { readJSON, writeJSON } from './store.js';
import { pseudo, clientIp } from './util.js';

export const HIDE_AFTER = 3;           // 서로 다른 신고자 3명이 신고하면 자동 숨김
export const STRIKES_TO_BLOCK = 2;     // 자동 숨김·반려가 2번 쌓이면 작성 제한
export const BLOCK_DAYS = 30;          // 작성 제한 기간

export function authorKey(req, acc) {
  return acc ? 'acc-' + acc.id : 'ip-' + pseudo('ip', clientIp(req));
}

export async function blockState(key) {
  const b = await readJSON(`blocks/${key}.json`);
  if (!b || !b.until) return null;
  if (Date.parse(b.until) < Date.now()) return null;
  return b;
}

// 위반 1회 기록. 쌓이면 일정 기간 작성 제한
export async function addStrike(key, reason, postId = null) {
  if (!key) return null;
  const path = `blocks/${key}.json`;
  const b = (await readJSON(path)) || { key, strikes: [], until: null };
  const now = Date.now();
  if (postId && (b.strikes || []).some(s => s.postId === postId)) return b;
  b.strikes = [...(b.strikes || []).filter(s => now - Date.parse(s.at) < 180 * 864e5), { postId, at: new Date(now).toISOString(), reason: String(reason).slice(0, 100) }];
  if (b.strikes.length >= STRIKES_TO_BLOCK && !(b.until && Date.parse(b.until) > now)) { b.until = new Date(now + BLOCK_DAYS * 864e5).toISOString(); applyEscalation(b, now); }
  await writeJSON(path, b);
  return b;
}

export async function setBlock(key, on) {
  const path = `blocks/${key}.json`;
  const b = (await readJSON(path)) || { key, strikes: [], until: null };
  b.manual = on;
  b.until = on ? new Date(Date.now() + BLOCK_DAYS * 864e5).toISOString() : null;
  if (on) applyEscalation(b); else { b.permanent = false; }
  if (!on) b.strikes = [];
  await writeJSON(path, b);
  return b;
}

// 신고 1건 반영. 같은 사람이 여러 번 신고해도 1명으로 세요. 3명이 되면 true
export function addReporter(post, reporterKey) {
  post.reporters = Array.isArray(post.reporters) ? post.reporters : [];
  if (!post.reporters.includes(reporterKey)) post.reporters.push(reporterKey);
  return post.reporters.length >= HIDE_AFTER;
}

// 복원한 글의 위반 기록만 취소해요. 수동 제한과 다른 글의 기록은 유지해요.
export async function clearPostStrike(key, postId) {
  if (!key) return;
  const path = `blocks/${key}.json`;
  const b = await readJSON(path);
  if (!b || !(b.strikes || []).some(s => s.postId === postId)) return;
  b.strikes = (b.strikes || []).filter(s => s.postId !== postId);
  if (b.strikes.length < STRIKES_TO_BLOCK && !b.manual) b.until = null;
  await writeJSON(path, b);
}

// 1인 여러 닉네임 방지: 접속 구분값(IP 변환값)과 브라우저 구분값마다 처음 쓴 닉네임을 30일 고정하고,
// 닉네임도 처음 쓴 사람에게 30일 묶어요. 원래 IP·기기 정보는 저장하지 않고 변환값만 저장해요.
// 한계: 다른 네트워크·다른 브라우저·데이터 삭제를 함께 쓰면 완전히 막을 수 없어요.
export const NICK_LOCK_DAYS = 30;
export async function checkNickLock(keys, nickname, now = Date.now()) {
  const nick = String(nickname || '').trim().toLowerCase();
  const until = now + NICK_LOCK_DAYS * 864e5;
  const owner = await readJSON(`nicklock/nick-${pseudo('nick', nick)}.json`);
  if (owner && owner.until > now && !keys.some(k => owner.keys.includes(k))) return '이미 다른 분이 쓰고 있는 닉네임이에요. 다른 닉네임을 정해 주세요.';
  for (const k of keys) {
    const l = await readJSON(`nicklock/key-${k}.json`);
    if (l && l.until > now && l.nick !== nick) return `한 사람이 여러 닉네임을 쓰지 못하게, 이 접속에서는 30일 동안 처음 쓴 닉네임 "${l.display}"로만 쓸 수 있어요.`;
  }
  for (const k of keys) await writeJSON(`nicklock/key-${k}.json`, { nick, display: String(nickname).trim(), until });
  await writeJSON(`nicklock/nick-${pseudo('nick', nick)}.json`, { keys: [...new Set([...(owner && owner.until > now ? owner.keys : []), ...keys])].slice(0, 6), until });
  return '';
}

// 작성 제한이 1년 안에 3번째가 되면 영구 정지해요(운영자 해제·이의제기 가능).
export const PERMANENT_AFTER = 3;
export function applyEscalation(b, now = Date.now()) {
  b.restrictions = (b.restrictions || []).filter(t => now - t < 365 * 864e5);
  b.restrictions.push(now);
  if (b.restrictions.length >= PERMANENT_AFTER) { b.until = '9999-12-31T00:00:00.000Z'; b.permanent = true; }
  return b;
}
