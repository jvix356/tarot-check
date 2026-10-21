// Vercel Private Blob 저장소 래퍼. STORE=memory 이면 테스트용 메모리 저장소를 써요.
import { put, get, list, del } from '@vercel/blob';

const mem = globalThis.__tcMem || (globalThis.__tcMem = new Map());
const memory = () => process.env.STORE === 'memory';

export async function readJSON(path) {
  if (memory()) { const v = mem.get(path); return v ? JSON.parse(v) : null; }
  let r;
  try { r = await get(path, { access: 'private', useCache: false }); }
  catch (e) { if (/not.?found|404/i.test(String(e && (e.name + e.message)))) return null; throw e; }
  if (!r || !r.stream) return null;
  const txt = await new Response(r.stream).text();
  return txt ? JSON.parse(txt) : null;
}

export async function writeJSON(path, obj) {
  const body = JSON.stringify(obj);
  if (memory()) { mem.set(path, body); return; }
  await put(path, body, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
}

export async function remove(path) {
  if (memory()) { mem.delete(path); return; }
  try { await del(path); } catch (e) { if (!/not.?found|404/i.test(String(e && e.message))) throw e; }
}

export async function listPaths(prefix) {
  if (memory()) return [...mem.keys()].filter(k => k.startsWith(prefix)).sort();
  const out = []; let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs.map(b => b.pathname));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort();
}

export function storeConfigured() {
  return memory() || !!process.env.BLOB_READ_WRITE_TOKEN;
}
