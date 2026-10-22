process.env.PUBLIC_COMMUNITY_WRITES='1';
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STORE = 'memory';
const { default: posts } = await import('../api/posts.js');
const { default: requests } = await import('../api/requests.js');
const { default: admin } = await import('../api/admin.js');
const { readJSON, writeJSON } = await import('../lib/store.js');
const { signToken } = await import('../lib/util.js');

async function call(handler, method, body, { ip = '1.1.1.1', token = '' } = {}) {
  const headers = { host: 'test.local', 'x-forwarded-for': ip };
  if (token) headers.authorization = 'Bearer ' + token;
  const req = { method, body, headers, query: {}, url: '/' };
  const res = { setHeader() {}, end(x) { this.data = JSON.parse(x); } };
  await handler(req, res); return { status: res.statusCode, ...res.data };
}
const review = (o = {}) => ({ type: 'review', nickname: '독자1', title: '써 본 후기', body: '문체 관찰이 도움이 됐어요.', agree: true, ...o });

test('nickname-only review is published immediately and appears in public list', async () => {
  const r = await call(posts, 'POST', review());
  assert.equal(r.status, 200); assert.equal((await readJSON(`posts/${r.id}.json`)).status, 'published');
  const list = await call(posts, 'GET');
  assert.ok(list.posts.some(p => p.id === r.id));
  assert.ok(!JSON.stringify(list).includes('authorKey'));
});

test('bad nickname, profanity and personal info are refused', async () => {
  assert.equal((await call(posts, 'POST', review({ nickname: '운영자' }))).status, 400);
  assert.equal((await call(posts, 'POST', review({ body: 'ㅈㄴ 별로예요 진짜' }))).status, 400);
  assert.equal((await call(posts, 'POST', review({ body: '실명은 김철수 입니다' }))).status, 400);
});

test('accusing expressions wait for operator review; reports need email login', async () => {
  const r = await call(posts, 'POST', review({ body: '그 리더 먹튀했어요 조심하세요', ip: '2.2.2.2' }), { ip: '2.2.2.2' });
  assert.equal(r.status, 200); assert.equal((await readJSON(`posts/${r.id}.json`)).status, 'pending');
  assert.equal((await call(posts, 'POST', review({ type: 'report' }))).status, 401);
  await writeJSON('accounts/v.json', { id: 'v', nickname: '인증회원', sessionVersion: 1, posts: [] });
  const rep = await call(posts, 'POST', review({ type: 'report', title: '결제 유도 수법', body: '추가 결제를 요구하는 수법을 경험했어요.' }), { token: signToken({ uid: 'v', sv: 1 }) });
  assert.equal(rep.status, 200); assert.equal((await readJSON(`posts/${rep.id}.json`)).status, 'pending');
});

test('three different reporters hide a post; same reporter counts once; repeat offender is blocked', async () => {
  const author = '9.9.9.9';
  const p1 = await call(posts, 'POST', review({ title: '첫 글입니다', body: '평범한 후기예요.' }), { ip: author });
  const send = ip => call(requests, 'POST', { kind: 'report', postId: p1.id, reason: '부적절한 내용이에요' }, { ip });
  await send('3.3.3.1'); await send('3.3.3.1'); await send('3.3.3.2');
  assert.equal((await readJSON(`posts/${p1.id}.json`)).status, 'published');
  const third = await send('3.3.3.3');
  assert.equal(third.hidden, true);
  assert.equal((await readJSON(`posts/${p1.id}.json`)).status, 'hidden');
  assert.ok(!(await call(posts, 'GET')).posts.some(p => p.id === p1.id));
  // 두 번째 위반(운영자 반려) → 작성 제한
  const p2 = await call(posts, 'POST', review({ title: '두번째 글', body: '그 사람 사기꾼이에요' }), { ip: author });
  assert.equal((await call(admin, 'POST', { action: 'reject', id: p2.id, reason: '단정 표현' }, { token: 'test-admin-token-1234' })).status, 200);
  const blocked = await call(posts, 'POST', review({ title: '세번째 글', body: '다시 써 봐요.' }), { ip: author });
  assert.equal(blocked.status, 403);
  // 운영자가 제한을 풀 수 있어요
  const key = (await readJSON(`posts/${p2.id}.json`)).authorKey;
  assert.equal((await call(admin, 'POST', { action: 'block_author', key, blocked: false }, { token: 'test-admin-token-1234' })).status, 200);
  assert.equal((await call(posts, 'POST', review({ title: '네번째 글', body: '다시 써 봐요.' }), { ip: author })).status, 200);
});

test('anonymous comments publish under a published post', async () => {
  const top = await call(posts, 'POST', review({ title: '댓글 받을 글', body: '댓글 테스트용 글이에요.' }), { ip: '5.5.5.5' });
  const c = await call(posts, 'POST', { type: 'comment', parentId: top.id, nickname: '지나가던', body: '저도 도움이 됐어요.', agree: true }, { ip: '6.6.6.6' });
  assert.equal(c.status, 200);
  const list = await call(posts, 'GET');
  assert.ok(list.posts.find(p => p.id === top.id).comments.some(x => x.id === c.id));
});

test('email auth needs age 14+ and consent; deck search is off without a key', async () => {
  const { default: auth } = await import('../api/auth.js');
  const { default: deck } = await import('../api/deck-search.js');
  assert.equal((await call(auth, 'POST', { action: 'send', email: 'a@example.com' })).status, 400);
  assert.equal((await call(auth, 'POST', { action: 'send', email: 'a@example.com', age14: true })).status, 400);
  assert.equal((await call(auth, 'POST', { action: 'send', email: 'a@example.com', age14: true, privacy: true })).status, 200);
  assert.equal((await call(deck, 'POST', { consent: true, image: 'AAAA' })).status, 503);
});
