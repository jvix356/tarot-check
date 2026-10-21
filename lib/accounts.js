import { readJSON } from './store.js';
import { bearer, verifyToken } from './util.js';

// 로그인한 작성 계정 불러오기 (없으면 null)
export async function currentAccount(req) {
  const p = verifyToken(bearer(req));
  if (!p || !p.uid) return null;
  const acc = await readJSON(`accounts/${p.uid}.json`);
  if (!acc || acc.disabled || acc.sessionVersion !== p.sv) return null;
  return acc;
}

export const maskEmail = e => { const [u, d] = String(e).split('@'); return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '***') + '@' + d; };
