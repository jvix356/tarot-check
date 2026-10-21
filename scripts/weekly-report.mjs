// 주간 리포트: 익명 통계와 게시판 처리 대기 건수를 모아 GitHub 이슈로 올려요.
// 이슈가 생기면 GitHub가 저장소 주인에게 알림(메일·앱)을 보내요.
// 공개 저장소이므로 글 내용·이메일은 넣지 않고 숫자만 넣어요.
const SITE = process.env.SITE_URL || 'https://tarot-check.vercel.app';
const TOKEN = process.env.REPORT_TOKEN || '';
const GH = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPOSITORY || 'jvix356/tarot-check';

async function get(days) {
  const r = await fetch(`${SITE}/api/stats?scope=report&days=${days}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) throw new Error(`stats ${r.status}`);
  return r.json();
}
const pct = (x, b) => (b ? Math.round((x / b) * 100) + '%' : '-');

function suggestions(s) {
  const o = s.outcome || {}, out = [];
  for (const [k, c] of Object.entries(s.signals || {})) {
    const pn = o.normal ? (c.normal || 0) / o.normal : 0, ph = o.harm ? (c.harm || 0) / o.harm : 0;
    if ((o.normal || 0) >= 20 && pn >= 0.4 && ph <= pn * 1.2) out.push(`- **${k}**: 일반 리더 응답의 ${pct(c.normal || 0, o.normal)}에서도 보여요. 결과 화면 안내를 더 조심스럽게 바꾸는 걸 검토해 주세요.`);
    if ((o.harm || 0) >= 20 && ph >= 0.3 && ph >= pn * 2) out.push(`- **${k}**: 피해 응답의 ${pct(c.harm || 0, o.harm)}에서 보이고 일반 리더보다 2배 이상 많아요. 주의 안내에 추가할지 검토해 주세요.`);
  }
  return out;
}

async function main() {
  if (!TOKEN) { console.log('REPORT_TOKEN 시크릿이 없어 리포트를 건너뛰어요.'); return; }
  const week = await get(7), year = await get(365);
  const w = week.stats, y = year.stats, b = year.board, sg = suggestions(y);
  const top = Object.entries(y.signals || {}).sort((a, c) => (c[1].all || 0) - (a[1].all || 0)).slice(0, 12);
  const body = [
    `## 이번 주 요약`,
    `- 익명 통계 참여: 이번 주 ${w.n}건 / 최근 1년 ${y.n}건`,
    `- 결과 응답(1년): 일반 리더 ${y.outcome.normal || 0} · 피해 있음 ${y.outcome.harm || 0} · 모름 ${y.outcome.unknown || 0}`,
    `- 게시판: 검토 대기 **${b.pending}** · 이번 주 새 글 ${b.newThisWeek} · 진행 중 피드백 ${b.feedbackOpen} · 진행 중 제보 ${b.reportsOpen} · 처리 대기 요청 **${b.requestsOpen}**`,
    b.pending || b.requestsOpen ? `- 👉 운영자 화면(${SITE}/admin.html)에서 검토 대기 글과 요청을 처리해 주세요.` : '',
    ``,
    `## 판독 기준 검토 제안`,
    sg.length ? sg.join('\n') : '- 이번 주에는 바꿀 근거가 충분하지 않아요. (결과 응답이 20건 이상 쌓여야 제안해요)',
    ``,
    `제안은 자동으로 반영하지 않아요. 반영하려면 이 이슈에 댓글로 남기고 Claude에게 "주간 리포트 제안 반영해줘"라고 요청해 주세요.`,
    ``,
    `## 많이 보인 표현 항목 (최근 1년)`,
    `| 항목 | 전체 | 일반 리더 중 | 피해 사례 중 |`, `|---|---:|---:|---:|`,
    ...top.map(([k, c]) => `| ${k.replace(/\|/g, '/')} | ${c.all || 0} | ${pct(c.normal || 0, y.outcome.normal)} | ${pct(c.harm || 0, y.outcome.harm)} |`),
    ``,
    `> 참여자가 고른 결과를 합산한 값이라 검증된 정답이 아니에요. 리딩 본문·IP·계정 정보는 저장하지 않아요.`,
  ].filter(x => x !== '').join('\n');
  const title = `주간 리포트 ${new Date().toISOString().slice(0, 10)}${sg.length || b.pending || b.requestsOpen ? ' · 확인 필요' : ''}`;
  if (!GH) { console.log(title + '\n' + body); return; }
  const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GH}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels: ['weekly-report'] }),
  });
  console.log('issue', r.status);
  if (!r.ok) process.exit(1);
}
main().catch(e => { console.error(e.message); process.exit(1); });
