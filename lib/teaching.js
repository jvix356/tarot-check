import signals from '../data/teach-signals.json' with { type: 'json' };
import { readJSON, listPaths } from './store.js';
export { signals };
export const KINDS = { overflag: '이 표현을 너무 강하게 다뤄요', context: '문맥을 더 살펴야 해요' };
export const CHOICES = ['agree', 'disagree', 'unsure'];
export function counts(p) {
  const c = { agree: 0, disagree: 0, unsure: 0 };
  for (const [id, choice] of Object.entries(p.votes || {})) if (id !== p.authorId && CHOICES.includes(choice)) c[choice]++;
  return c;
}
export function qualified(p) {
  const c = counts(p), total = c.agree + c.disagree + c.unsure;
  return total >= 3 && c.agree >= 3 && c.agree / total >= 2 / 3;
}
export async function allTeaching() {
  const out = [];
  for (const path of await listPaths('teaching/proposals/')) { const p = await readJSON(path); if (p) out.push(p); }
  return out.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export function proposalView(p) {
  return { id: p.id, signal: p.signal, kind: p.kind, example: p.example, explanation: p.explanation,
    status: p.status, createdAt: p.createdAt, counts: counts(p), qualified: qualified(p), answer: p.answer || '' };
}
export async function teachingSummary() {
  const proposals = await allTeaching();
  const approved = proposals.filter(p => p.status === 'accepted' && qualified(p));
  const grouped = {};
  for (const p of approved) { grouped[p.signal] ||= new Set(); grouped[p.signal].add(p.kind); }
  const adjustments = Object.entries(grouped).map(([signal,kinds]) => ({ signal, soften: kinds.has('overflag'), context: kinds.has('context') }));
  const profiles = [];
  for (const path of await listPaths('teaching/profiles/')) { const p = await readJSON(path); if (p && p.listed) profiles.push(p); }
  const scores = profiles.map(p => ({ nickname: p.nickname, score: new Set(approved.filter(x => x.authorId === p.id).map(x => x.signal+'|'+x.kind)).size })).filter(p => p.score > 0).sort((a,b) => b.score-a.score || a.nickname.localeCompare(b.nickname,'ko')).slice(0,30);
  let rank = 0, previous = null;
  const leaderboard = scores.map((p,i) => { if (p.score !== previous) rank = i+1; previous = p.score; return {rank,...p}; });
  return { proposals: proposals.filter(p => ['voting','accepted'].includes(p.status)).slice(0,100).map(proposalView), adjustments, leaderboard };
}
