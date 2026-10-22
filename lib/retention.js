// 제보에 적힌 운영자 전달 메모(계좌·연락처·계정 등 개인정보가 들어갈 수 있음)는 접수 90일 뒤 자동으로 지워요.
import { readJSON, writeJSON, listPaths } from './store.js';
export const NOTE_DAYS = 90;
export async function purgeReportNotes(now = Date.now()) {
  let n = 0;
  for (const k of await listPaths('posts/')) {
    const p = await readJSON(k);
    if (p && p.privateNote && now - Date.parse(p.createdAt) > NOTE_DAYS * 864e5) {
      p.privateNote = ''; p.noteDeletedAt = new Date(now).toISOString(); await writeJSON(k, p); n++;
    }
  }
  return n;
}
