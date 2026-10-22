// AI 여부와 상관없이 "엉터리 해석으로 돈 받기"를 점검하는 규칙 (브라우저·테스트 공용, 서버 전송 없음)
// 판정이 아니라 점검 목록이에요. 근거는 본문에서 실제로 찾은 표현만 써요.

// 누구에게나 들어맞는 말(바넘 효과로 알려진 유형)
const BARNUM = /겉으로는[^.\n]{0,20}(?:속으로|속은|안으로)|남모를 (?:고민|아픔|상처)|주변 사람(?:들)?을 (?:잘 )?챙기|혼자 (?:감당|삭이|견디)|상처(?:를)? ?받은 적이|생각이 많은 (?:편|타입)|정이 많|사람을 쉽게 믿지 못|마음이 여린|겉은 강해 보이지만|인정받고 싶|변화를 원하고 있|선택의 기로/g;
// 겁주는 말
const FEAR = /저주|액운|살(?:이|을)? ?(?:껴|끼|꼈|낀)|귀신|빙의|업보|원한|조상(?:님)?(?:의)? ?(?:노|화)|신벌|흉운|큰일 ?(?:나|날)|불행이 (?:닥|찾아)|가족(?:에게|한테)? ?(?:안 좋은|화가)|죽음의 기운|나쁜 기운이 (?:붙|따라)/g;
// 돈을 내면 해결된다는 말
const PAY_FIX = /(?:굿|부적|천도재|살풀이|퇴마|정화|액막이|기도(?:비)?|비방|입금|송금|결제|비용|만 ?원|\d+ ?원)[^.\n]{0,25}(?:하면|해야|하셔야|풀|막|사라|좋아|해결)|(?:풀려면|막으려면|없애려면|해결하려면)[^.\n]{0,25}(?:굿|부적|기도|비용|입금|결제|만 ?원|\d+ ?원)/g;
// 날짜·확률을 단정하는 예언
const EXACT = /\d+ ?(?:일|주|개월|달) ?(?:안에|이내에?|후에?) ?(?:반드시|꼭|무조건|확실히)?[^.\n]{0,15}(?:연락|재회|돌아|결혼|합격|성공)|(?:\d{1,3} ?%|백 ?퍼센트) ?(?:확률|가능성)/g;
// 리딩을 끊어 팔기
const DRIP = /(?:더|자세히|깊이|정확히) (?:보려면|알려면|알고 싶으시면)|나머지는 (?:유료|추가|결제)|(?:추가|심층|상세) ?(?:리딩|상담)[^.\n]{0,20}(?:원|결제|입금)|여기까지(?:만)? ?(?:무료|보여)/g;

const uniq = a => [...new Set(a.map(x => x.trim()).filter(Boolean))];
const find = (re, t) => uniq(t.match(re) || []);

export function tokens(t) {
  return (String(t).replace(/[^가-힣\s]/g, ' ').match(/[가-힣]{2,}/g) || [])
    .map(x => x.replace(/(으로|에서|에게|까지|부터|처럼|하고|해요|했어요|합니다|입니다|이에요|예요|이며|은|는|이|가|을|를|의|에|도|와|과|로)$/, ''))
    .filter(x => x.length >= 2);
}

// 카드 이름이 적힌 문단이 웨이트 원전 뜻(정·역 모두)과 하나도 겹치지 않으면 표시해요
export function cardMismatch(text, rwsCards) {
  if (!rwsCards) return [];
  const paras = String(text).split(/\n\s*\n/), res = [];
  // '힘'·'별'·'달'·'탑' 같은 한 글자 이름은 오탐이 많아 빼요
  const names = Object.keys(rwsCards).filter(n => n.length >= 2);
  for (const name of names) {
    for (const p of paras) {
      if (!p.includes(name) || p.length < 40) continue;
      // 한 문단에 카드가 여러 장이면 어느 문장이 어느 카드 해석인지 알 수 없어 비교하지 않아요
      if (names.filter(n => p.includes(n)).length > 1) continue;
      const mine = tokens(p), base = tokens(rwsCards[name].join(' '));
      if (!base.some(k => mine.some(m => m.includes(k) || (k.includes(m) && m.length >= 2)))) res.push(name);
    }
  }
  return uniq(res).slice(0, 4);
}

// 반환: [{ level: 'high'|'mid'|'low', title, evidence: [...] }]
export function checkReading(text, rwsCards) {
  const t = String(text || '');
  if (t.trim().length < 20) return [];
  const fear = find(FEAR, t), pay = find(PAY_FIX, t), exact = find(EXACT, t), drip = find(DRIP, t), barnum = find(BARNUM, t), mis = cardMismatch(t, rwsCards);
  const items = [];
  if (fear.length && pay.length) items.push({ level: 'high', key: 'fear_pay', title: '겁을 준 뒤 돈으로 해결하자는 흐름', evidence: [...fear.slice(0, 3), ...pay.slice(0, 2)] });
  else if (pay.length) items.push({ level: 'mid', key: 'pay_fix', title: '돈을 내면 해결된다는 말', evidence: pay.slice(0, 3) });
  else if (fear.length) items.push({ level: 'mid', key: 'fear', title: '겁주는 말', evidence: fear.slice(0, 4) });
  if (exact.length) items.push({ level: 'mid', key: 'exact', title: '날짜·확률을 단정하는 예언', evidence: exact.slice(0, 3) });
  if (drip.length) items.push({ level: 'mid', key: 'drip', title: '리딩을 끊어서 추가 결제로 유도', evidence: drip.slice(0, 3) });
  if (barnum.length >= 3) items.push({ level: 'low', key: 'barnum', title: '누구에게나 들어맞는 말이 많아요', evidence: barnum.slice(0, 4) });
  if (mis.length) items.push({ level: 'low', key: 'card_mismatch', title: '적힌 카드의 전통적인 뜻과 거의 관련 없는 해석', evidence: mis });
  return items;
}

export const EXPLAIN = {
  fear_pay: '사람이 썼든 AI가 썼든, 겁을 준 뒤 돈으로 해결하자는 흐름이면 결제 전에 꼭 멈추고 주변과 상의하세요.',
  pay_fix: '타로 리딩은 결제로 결과가 바뀐다고 보장할 수 없어요.',
  fear: '불안을 키운 뒤 추가 상담이나 결제를 권하는지 살펴보세요.',
  exact: '타로로 날짜나 확률을 보장할 수 없어요. 맞지 않을 때 "추가 리딩"을 권하는 경우가 있어요.',
  drip: '처음엔 일부만 보여주고 나머지를 유료로 파는 방식이에요. 결제 전 전체 비용을 먼저 물어보세요.',
  barnum: '이런 말은 대부분의 사람에게 맞게 느껴져요(바넘 효과). 내 상황에만 해당하는 구체적인 내용이 있는지 따져 보세요.',
  card_mismatch: '이 카드가 나온 문단에 웨이트 원전(퍼블릭 도메인)의 정방향·역방향 뜻과 겹치는 표현이 없어요. 덱마다 해석이 다를 수 있으니 어떤 덱의 어떤 뜻으로 읽었는지 물어보세요.',
};
