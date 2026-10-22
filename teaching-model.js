// 검토를 통과한 교정만 서버에서 받아 참고 표시의 영향력을 완화해요.
// 원문 탐지, AI 확률, 모델 자체의 정답률을 계산하지 않아요.
export function correctedSignals(signals, corrections) {
  const norm = s => String(s || '').replace(/^사람 신호 · /,'').trim();
  const map = new Map((signals || []).map(s => [norm(s.label), {...s}]));
  for (const c of corrections || []) {
    const key = norm(c.signal);
    const s = map.get(key) || {label:c.signal,tier:'collecting',weight:null};
    s.teaching = c;
    // 같은 항목이 중복돼도 원래 가중치에서 한 번만 완화해요.
    const original = (signals || []).find(x => norm(x.label) === key);
    if (c.soften && original?.weight != null) s.weight = original.weight / 2;
    map.set(key,s);
  }
  return [...map.values()];
}
