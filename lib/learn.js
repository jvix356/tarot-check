// 익명 통계 → 판독 기준 자동 학습 (GitHub Actions 스크립트·테스트가 같은 규칙을 써요)
// 공개 요약(/api/stats)의 "항목별 비율"만으로 학습해요. 리딩 본문이나 개별 응답 기록은 쓰지 않아요.
// 학습 방식: 항목마다 "피해 응답 글에서 보인 비율 ÷ 일반 리더 글에서 보인 비율"을 가중치로 바꿔요(나이브 베이즈).
// 참여가 늘수록 비율이 안정되고 가중치가 매일 다시 계산돼요. 결과는 확률·정확도가 아니라 참고 표시예요.
export const MIN_ANSWERS = 20; // 일반·피해 응답이 각각 이만큼 쌓여야 학습·표시를 바꿔요
const CLIP = 2;

export function tierOf(s, outcome) {
  const okN = (outcome.normal || 0) >= MIN_ANSWERS && s.inNormal != null;
  const okH = (outcome.harm || 0) >= MIN_ANSWERS && s.inHarm != null;
  if (!okN || !okH) return 'collecting';
  if (s.inNormal >= 40 && s.inHarm <= s.inNormal * 1.2) return 'common';   // 일반 리더 글에서도 흔함 → 덜 강조
  if (s.inHarm >= 30 && s.inHarm >= s.inNormal * 2) return 'harm';         // 피해 응답에서 더 자주 보임 → 주의 강조
  return 'neutral';
}

// 항목 가중치: ln(피해 응답에서 보일 비율 / 일반 응답에서 보일 비율), 라플라스 보정·±2로 제한
export function weightOf(s, outcome) {
  const nN = outcome.normal || 0, nH = outcome.harm || 0;
  if (nN < MIN_ANSWERS || nH < MIN_ANSWERS || s.inNormal == null || s.inHarm == null) return null;
  const pH = ((s.inHarm / 100) * nH + 1) / (nH + 2);
  const pN = ((s.inNormal / 100) * nN + 1) / (nN + 2);
  const w = Math.log(pH / pN);
  return Math.round(Math.max(-CLIP, Math.min(CLIP, w)) * 100) / 100;
}

export function buildLearned(pub, prev) {
  const outcome = { normal: pub?.outcome?.normal || 0, harm: pub?.outcome?.harm || 0, unknown: pub?.outcome?.unknown || 0 };
  const signals = (pub?.signals || []).map(s => ({
    label: s.label, inNormal: s.inNormal ?? null, inHarm: s.inHarm ?? null,
    tier: tierOf(s, outcome), weight: weightOf(s, outcome),
  })).sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  const learned = signals.filter(s => s.weight != null).length;
  const data = { n: pub?.n || 0, outcome, minAnswers: MIN_ANSWERS, learned, signals };
  const pick = p => p && JSON.stringify({ n: p.n, outcome: p.outcome, minAnswers: p.minAnswers, learned: p.learned, signals: p.signals });
  const same = pick(prev) === JSON.stringify(data);
  const today = new Date().toISOString().slice(0, 10);
  const history = (prev?.history || []).filter(h => h.day !== today);
  if (!same) history.push({ day: today, n: data.n, learned, changed: diffCount(prev?.signals || [], signals) });
  return { changed: !same, json: { updatedAt: same ? prev.updatedAt : today, ...data, history: history.slice(-90) } };
}

function diffCount(a, b) {
  const m = new Map(a.map(s => [s.label, s.tier + '|' + s.weight]));
  return b.filter(s => m.get(s.label) !== s.tier + '|' + s.weight).length;
}

// 결과 화면용: 이번 글에서 보인 항목들의 가중치 합으로 "어느 쪽 응답 글과 표현 구성이 비슷한지" 3단계로만 보여줘요.
export function lean(labels, model) {
  const map = new Map((model?.signals || []).map(s => [s.label, s.weight]));
  let sum = 0, used = 0;
  for (const l of labels) { const w = map.get(l); if (w != null) { sum += w; used++; } }
  if (used < 2) return { level: 'none', used };
  return { level: sum >= 0.7 ? 'harm' : sum <= -0.7 ? 'normal' : 'mixed', used, sum: Math.round(sum * 100) / 100 };
}
