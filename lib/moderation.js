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
  if (b.strikes.length >= STRIKES_TO_BLOCK) b.until = new Date(now + BLOCK_DAYS * 864e5).toISOString();
  await writeJSON(path, b);
  return b;
}

export async function setBlock(key, on) {
  const path = `blocks/${key}.json`;
  const b = (await readJSON(path)) || { key, strikes: [], until: null };
  b.manual = on;
  b.until = on ? new Date(Date.now() + BLOCK_DAYS * 864e5).toISOString() : null;
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
