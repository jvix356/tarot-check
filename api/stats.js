// 익명 이용 통계 API
// POST  : 이용자가 동의하고 보낸 관찰 항목 이름·개수·결과 선택만 합산 (본문·IP·계정 저장 안 함)
// GET   : 공개 요약 (응답이 적은 항목은 숨김, CDN에 30분 캐시)
// GET ?scope=report : 운영자(ADMIN_TOKEN) 또는 주간 리포트(REPORT_TOKEN)용 전체 합계 + 게시판 처리 대기 건수
import { send, readBody, bearer, safeEqual, sameOrigin } from '../lib/util.js';
import { storeConfigured, listPaths, readJSON } from '../lib/store.js';
import { sanitizeEvent, addEvent, aggregate, publicSummary, OUTCOMES } from '../lib/stats.js';
import { allPosts } from '../lib/board.js';

function tokenOk(req) {
  const t = bearer(req);
  if (!t) return false;
  const admin = process.env.ADMIN_TOKEN || (process.env.STORE === 'memory' ? 'test-admin-token-1234' : '');
  const report = process.env.REPORT_TOKEN || '';
  return (admin.length >= 16 && safeEqual(t, admin)) || (report.length >= 16 && safeEqual(t, report));
}

export default async function handler(req, res) {
  try {
    if (!storeConfigured()) return send(res, 503, { error: 'store', message: '통계 저장소가 연결되지 않았어요.' });

    if (req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
      const b = await readBody(req);
      if (b.consent !== true) return send(res, 400, { error: 'consent', message: '통계 참여에 동의해야 보낼 수 있어요.' });
      if (JSON.stringify(b).length > 4000) return send(res, 413, { error: 'too_large' });
      await addEvent(sanitizeEvent(b));
      return send(res, 200, { ok: true, message: '익명 통계에 반영했어요. 고마워요!' });
    }

    if (req.method !== 'GET') return send(res, 405, { error: 'method' });

    if ((req.query && req.query.scope) === 'report') {
      if (!tokenOk(req)) return send(res, 401, { error: 'unauthorized' });
      const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 365));
      const total = await aggregate(days);
      const posts = await allPosts();
      const count = (f) => posts.filter(f).length;
      const reqs = [];
      for (const k of await listPaths('requests/')) { const r = await readJSON(k); if (r) reqs.push(r); }
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      return send(res, 200, {
        days, outcomes: OUTCOMES, stats: total, public: publicSummary(total),
        board: {
          pending: count(p => p.status === 'pending'),
          newThisWeek: count(p => p.createdAt >= weekAgo),
          feedbackOpen: count(p => p.type === 'feedback' && p.status === 'published' && p.progress !== '반영 완료' && p.progress !== '반영 안 함'),
          reportsOpen: count(p => p.type === 'report' && p.status === 'published' && p.progress !== '반영 완료' && p.progress !== '반영 안 함'),
          requestsOpen: reqs.filter(r => r.status === '접수' || r.status === '검토 중').length,
        },
      });
    }

    const total = await aggregate(365);
    res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=1800, stale-while-revalidate=600');
    return send(res, 200, publicSummary(total));
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: '잠시 후 다시 시도해 주세요.' });
  }
}
