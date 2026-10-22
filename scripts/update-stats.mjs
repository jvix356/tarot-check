// 매일 GitHub Actions가 실행: 공개 통계 요약을 받아 data/stats.json으로 저장해요.
// 저장소에 커밋되면 Vercel이 다시 배포하고, 이용자는 결과 화면·통계 페이지에서 바뀐 기준을 봐요.
// 공개 요약만 쓰므로 토큰이 필요 없고, 본문·이메일·IP는 들어가지 않아요.
import fs from 'node:fs';
import { buildLearned } from '../lib/learn.js';

const SITE = process.env.SITE_URL || 'https://tarot-check.vercel.app';
const FILE = new URL('../data/stats.json', import.meta.url);

const r = await fetch(`${SITE}/api/stats`);
if (!r.ok) { console.log(`통계를 받지 못했어요 (${r.status}). 이번에는 건너뛰어요.`); process.exit(0); }
const pub = await r.json();
let prev = null;
try { prev = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
const { changed, json } = buildLearned(pub, prev);
if (!changed) { console.log('바뀐 통계가 없어요.'); process.exit(0); }
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(FILE, JSON.stringify(json, null, 2) + '\n');
console.log(`통계 갱신: 참여 ${json.n}건, 항목 ${json.signals.length}개`);
