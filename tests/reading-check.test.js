import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { checkReading } = await import('../reading-check-model.js');
const rws = JSON.parse(fs.readFileSync(new URL('../data/decks.json', import.meta.url), 'utf8')).decks.find(d => d.id === 'rws').cards;
const keys = t => checkReading(t, rws).map(x => x.key);

test('fear followed by a paid fix is flagged high, with the actual phrases as evidence', () => {
  const r = checkReading('지금 집안에 액운이 껴 있어요. 부적을 쓰시면 풀려요. 비용은 30만원입니다.', rws);
  assert.equal(r[0].key, 'fear_pay'); assert.equal(r[0].level, 'high');
  assert.ok(r[0].evidence.some(e => e.includes('액운')));
});

test('exact predictions, drip selling and Barnum statements are found', () => {
  const k = keys('겉으로는 밝아 보이지만 속으로는 남모를 고민이 많으시네요. 주변 사람을 잘 챙기는 분이에요.\n\n3일 안에 반드시 연락이 와요. 더 자세히 보려면 추가 리딩 5만원 입금해 주세요.');
  assert.ok(k.includes('exact')); assert.ok(k.includes('drip')); assert.ok(k.includes('barnum'));
});

test('an ordinary reading without money or fear talk raises nothing', () => {
  assert.deepEqual(keys('소드 3이 나와서 지난 이별의 아픔이 아직 남아 있는 것 같아요. 슬픔을 천천히 정리하는 시간이 필요해요. 컵 6은 추억과 지나간 행복을 돌아보게 해요.'), []);
});

test('a card paragraph unrelated to the Waite meanings is noted, short card names are skipped', () => {
  assert.ok(keys('완드 에이스 카드가 나왔어요. 이 카드는 이번 주 금전운이 폭발하고 로또 당첨처럼 큰돈이 들어온다는 뜻이에요. 지갑을 새로 사세요.').includes('card_mismatch'));
  assert.ok(!keys('탑 카드가 나왔어요. 이 카드는 이번 주 금전운이 폭발하고 로또 당첨처럼 큰돈이 들어온다는 뜻이에요.').includes('card_mismatch'));
});
