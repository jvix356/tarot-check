// 선택 기능: 덱 자동 검색 (Google Cloud Vision 웹 검색)
// - 이용자가 화면에서 직접 동의하고 버튼을 누른 경우에만 호출돼요.
// - 받은 사진(축소본)은 Google로 전달만 하고 저장·기록하지 않아요. 결과(추정 이름·찾은 페이지 주소)만 돌려줘요.
// - GOOGLE_VISION_API_KEY 환경변수가 없으면 꺼져 있어요.
import { send, sameOrigin, pseudo, clientIp } from '../lib/util.js';
import { readJSON, writeJSON, storeConfigured } from '../lib/store.js';

const MAX = 600000; // base64 약 450KB
const DAY = 864e5;

async function readRaw(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let d = '';
  for await (const c of req) { d += c; if (d.length > MAX) throw Object.assign(new Error('too_large'), { status: 413 }); }
  try { return d ? JSON.parse(d) : {}; } catch { return {}; }
}
const clean = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

export default async function handler(req, res) {
  try {
    const key = process.env.GOOGLE_VISION_API_KEY || '';
    if (!key) return send(res, 503, { error: 'off', message: '덱 자동 검색은 아직 켜져 있지 않아요.' });
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
    const b = await readRaw(req);
    if (b.consent !== true) return send(res, 400, { error: 'consent', message: '사진을 외부 검색 서비스로 보내는 데 동의해야 해요.' });
    const img = String(b.image || '').replace(/^data:image\/\w+;base64,/, '');
    if (!img || img.length > MAX || !/^[A-Za-z0-9+/=]+$/.test(img)) return send(res, 400, { error: 'image', message: '사진을 읽지 못했어요.' });

    // 하루 20번까지 (IP는 알아볼 수 없게 바꾼 값으로만 세요)
    if (storeConfigured()) {
      const rk = `rl/vision-${pseudo('ip', clientIp(req))}.json`, now = Date.now();
      const rl = (await readJSON(rk)) || { t: [] };
      rl.t = (rl.t || []).filter(t => now - t < DAY);
      if (rl.t.length >= 20) return send(res, 429, { error: 'rate', message: '오늘 검색 횟수를 다 썼어요. 내일 다시 해 주세요.' });
      rl.t.push(now); await writeJSON(rk, rl);
    }

    const r = await fetch('https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: img }, features: [{ type: 'WEB_DETECTION', maxResults: 10 }] }] }),
    });
    if (!r.ok) return send(res, 502, { error: 'upstream', message: '외부 검색이 응답하지 않았어요.' });
    const w = ((await r.json()).responses || [{}])[0].webDetection || {};
    return send(res, 200, {
      labels: (w.bestGuessLabels || []).map(x => clean(x.label)).filter(Boolean).slice(0, 3),
      entities: (w.webEntities || []).filter(x => x.description).slice(0, 6).map(x => ({ name: clean(x.description), score: Math.round((x.score || 0) * 100) / 100 })),
      pages: (w.pagesWithMatchingImages || []).filter(p => /^https:\/\//.test(p.url || '')).slice(0, 6).map(p => ({ title: clean(p.pageTitle) || '제목 없음', url: String(p.url).slice(0, 300) })),
    });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: '잠시 후 다시 시도해 주세요.' });
  }
}
