// 공감(이모지)·조회수. 누른 사람은 원래 IP·기기 정보 대신 변환값으로만 구분해요.
import { readJSON, writeJSON } from './store.js';
export const EMOJIS = { heart: '❤️', empathy: '🤝', helpful: '💡', cheer: '👏' };
const day = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
const empty = () => ({ r: {}, v: 0, voters: {}, seenDay: '', seen: [] });
export async function react(id, emoji, key) {
  if (!EMOJIS[emoji]) return null;
  const path = `meta/${id}.json`, m = (await readJSON(path)) || empty();
  const mine = new Set(m.voters[key] || []);
  if (mine.has(emoji)) { mine.delete(emoji); m.r[emoji] = Math.max(0, (m.r[emoji] || 0) - 1); }
  else { mine.add(emoji); m.r[emoji] = (m.r[emoji] || 0) + 1; }
  if (mine.size) m.voters[key] = [...mine]; else delete m.voters[key];
  await writeJSON(path, m);
  return { r: m.r, mine: [...mine] };
}
// 같은 사람(변환값)은 하루 한 번만 조회수로 세요. 하루가 지나면 확인 목록을 비워요.
export async function view(id, key) {
  const path = `meta/${id}.json`, m = (await readJSON(path)) || empty(), today = day();
  if (m.seenDay !== today) { m.seenDay = today; m.seen = []; }
  if (!m.seen.includes(key)) { m.seen.push(key); m.v = (m.v || 0) + 1; await writeJSON(path, m); }
  return m.v;
}
export async function meta(ids, key) {
  const out = {};
  for (const id of ids) { const m = await readJSON(`meta/${id}.json`); out[id] = { r: (m && m.r) || {}, v: (m && m.v) || 0, mine: (m && m.voters && m.voters[key]) || [] }; }
  return out;
}
