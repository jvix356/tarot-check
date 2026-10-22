export function sampleProgress(outcome={}, minAnswers=20) {
  const clean = n => Number.isFinite(Number(n)) ? Math.max(0,Math.floor(Number(n))) : 0;
  const target = Math.max(1,clean(minAnswers));
  const normal=clean(outcome.normal), harm=clean(outcome.harm);
  return {normal,harm,target,percent:Math.floor((Math.min(normal,target)+Math.min(harm,target))/(2*target)*100)};
}
