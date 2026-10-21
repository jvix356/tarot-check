// 익명 이용 통계. 리딩 본문·IP·계정은 저장하지 않고, 이용자가 동의해 보낸 "관찰 항목 이름과 개수"만 날짜별로 합산해요.
import { readJSON, writeJSON, listPaths } from './store.js';

export const OUTCOMES = { normal: '일반 리더였어요', harm: '돈·피해 문제가 있었어요', unknown: '아직 모르겠어요' };
const FLAG_KEYS = ['pay', 'upsell', 'goods', 'fear', 'pii', 'move', 'shaman', 'rush', 'guarantee', 'secret'];
const SHARDS = 4;

// 관찰 항목 이름은 사이트 코드가 정한 고정 문구예요. 혹시 모를 개인정보 유입을 막으려고 형식을 좁혀요.
function cleanLabel(s) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!t) return '';
  if ((t.match(/\d/g) || []).length >= 5 || /@|https?:|www\.|\.com|\.kr|open\.kakao/i.test(t)) return '';
  return t;
}

export function sanitizeEvent(b) {
  const outcome = Object.prototype.hasOwnProperty.call(OUTCOMES, b.outcome) ? b.outcome : 'unknown';
  const labels = [...new Set((Array.isArray(b.signals) ? b.signals : []).map(cleanLabel).filter(Boolean))].slice(0, 30);
  const flags = [...new Set((Array.isArray(b.flags) ? b.flags : []).filter(k => FLAG_KEYS.includes(k)))];
  const cards = Math.max(0, Math.min(10, parseInt(b.cards, 10) || 0));
  const lenB = ['<300', '300-999', '1000+'][b.len >= 1000 ? 2 : b.len >= 300 ? 1 : 0];
  const spread = cleanLabel(String(b.spread || '').replace(/\(\d+장\)/, '').trim()).slice(0, 30) || '알 수 없음';
  return { outcome, labels, flags, cards, lenB, spread };
}

const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

export async function addEvent(ev, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const path = `stats/day/${day}-${Math.floor(Math.random() * SHARDS)}.json`;
  const s = (await readJSON(path)) || { day, n: 0, outcome: {}, signals: {}, flags: {}, cards: {}, len: {}, spread: {} };
  s.n++;
  inc(s.outcome, ev.outcome);
  for (const l of ev.labels) { s.signals[l] = s.signals[l] || {}; inc(s.signals[l], 'all'); inc(s.signals[l], ev.outcome); }
  for (const f of ev.flags) { s.flags[f] = s.flags[f] || {}; inc(s.flags[f], 'all'); inc(s.flags[f], ev.outcome); }
  inc(s.cards, String(ev.cards));
  inc(s.len, ev.lenB);
  inc(s.spread, ev.spread);
  await writeJSON(path, s);
}

function merge(into, s) {
  into.n += s.n || 0;
  for (const [k, v] of Object.entries(s.outcome || {})) inc(into.outcome, k, v);
  for (const key of ['signals', 'flags']) {
    for (const [l, c] of Object.entries(s[key] || {})) { into[key][l] = into[key][l] || {}; for (const [k, v] of Object.entries(c)) inc(into[key][l], k, v); }
  }
  for (const key of ['cards', 'len', 'spread']) for (const [k, v] of Object.entries(s[key] || {})) inc(into[key], k, v);
}

export async function aggregate(days = 365) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const total = { n: 0, outcome: {}, signals: {}, flags: {}, cards: {}, len: {}, spread: {}, byDay: {} };
  for (const p of await listPaths('stats/day/')) {
    const day = p.slice(10, 20);
    if (day < since) continue;
    const s = await readJSON(p);
    if (!s) continue;
    merge(total, s);
    inc(total.byDay, day, s.n || 0);
  }
  return total;
}

// 공개용 요약: 응답 수가 적은 항목은 숨겨요(소수 응답으로 특정 사례가 드러나지 않게).
export const MIN_PUBLIC = 20;
export function publicSummary(t) {
  const normal = t.outcome.normal || 0, harm = t.outcome.harm || 0;
  const rate = (c, k, base) => (base >= MIN_PUBLIC ? Math.round(((c[k] || 0) / base) * 100) : null);
  const signals = Object.entries(t.signals)
    .filter(([, c]) => (c.all || 0) >= 5)
    .map(([label, c]) => ({ label, inNormal: rate(c, 'normal', normal), inHarm: rate(c, 'harm', harm) }))
    .sort((a, b) => (b.inNormal ?? -1) - (a.inNormal ?? -1));
  const flags = Object.fromEntries(Object.entries(t.flags).map(([k, c]) => [k, { inNormal: rate(c, 'normal', normal), inHarm: rate(c, 'harm', harm) }]));
  return { n: t.n, outcome: { normal, harm, unknown: t.outcome.unknown || 0 }, minPublic: MIN_PUBLIC, signals, flags };
}
