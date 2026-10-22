import test from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, buildLearned, weightOf, lean } from '../lib/learn.js';
const enough = { normal: 30, harm: 30 };
test('tiers need enough answers and follow ratios', () => {
  assert.equal(tierOf({ inNormal: 50, inHarm: 50 }, { normal: 5, harm: 30 }), 'collecting');
  assert.equal(tierOf({ inNormal: 50, inHarm: 55 }, enough), 'common');
  assert.equal(tierOf({ inNormal: 10, inHarm: 40 }, enough), 'harm');
  assert.equal(tierOf({ inNormal: 20, inHarm: 25 }, enough), 'neutral');
  assert.equal(tierOf({ inNormal: null, inHarm: 40 }, enough), 'collecting');
});
test('buildLearned only reports changes and keeps public fields only', () => {
  const pub = { n: 70, outcome: { normal: 30, harm: 30, unknown: 10 }, signals: [{ label: '요약 구문', inNormal: 50, inHarm: 50, secret: 'x' }] };
  const a = buildLearned(pub, null);
  assert.equal(a.changed, true); assert.equal(a.json.signals[0].tier, 'common');
  assert.ok(!JSON.stringify(a.json).includes('secret'));
  const b = buildLearned(pub, a.json);
  assert.equal(b.changed, false); assert.equal(b.json.updatedAt, a.json.updatedAt);
});
test('weights learn from public ratios and lean needs two learned items', () => {
  assert.equal(weightOf({ inNormal: 10, inHarm: 40 }, { normal: 5, harm: 30 }), null);
  const w = weightOf({ inNormal: 10, inHarm: 40 }, enough); assert.ok(w > 1);
  assert.ok(weightOf({ inNormal: 60, inHarm: 20 }, enough) < 0);
  const model = { signals: [{ label: 'a', weight: 1 }, { label: 'b', weight: 0.5 }, { label: 'c', weight: -1.5 }] };
  assert.equal(lean(['a'], model).level, 'none');
  assert.equal(lean(['a', 'b'], model).level, 'harm');
  assert.equal(lean(['b', 'c'], model).level, 'normal');
});
test('deck data covers all 78 cards with sources, and missing decks have no invented meanings', async () => {
  const fs = await import('node:fs');
  const d = JSON.parse(fs.readFileSync(new URL('../data/decks.json', import.meta.url), 'utf8'));
  const rws = d.decks.find(x => x.id === 'rws');
  assert.equal(Object.keys(rws.cards).length, 78); assert.ok(rws.source.url);
  for (const x of d.decks) if (!x.source) assert.ok(!x.cards && x.missing);
});
