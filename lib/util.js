import crypto from 'node:crypto';

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(obj));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let d = '';
  for await (const c of req) { d += c; if (d.length > 60000) throw Object.assign(new Error('too_large'), { status: 413 }); }
  try { return d ? JSON.parse(d) : {}; } catch { return {}; }
}

function secret() {
  const s = process.env.AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN || (process.env.STORE === 'memory' ? 'test-secret' : '');
  if (!s) throw Object.assign(new Error('no_secret'), { status: 503 });
  return s;
}

const b64u = b => Buffer.from(b).toString('base64url');

export function hmac(text) {
  return crypto.createHmac('sha256', secret()).update(String(text)).digest('hex');
}

// 이메일·IP 같은 값은 원문 대신 비밀키로 해시한 값만 키로 써요
export const pseudo = (kind, v) => hmac(kind + ':' + String(v).trim().toLowerCase()).slice(0, 32);

export function signToken(payload, days = 30) {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + days * 864e5 }));
  return body + '.' + hmac('tok:' + body);
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const want = hmac('tok:' + body);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function bearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const newId = () => Date.now().toString(36) + crypto.randomBytes(5).toString('hex');

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
}

export function sameOrigin(req) {
  const o = req.headers['origin'];
  if (!o) return true;
  try { return new URL(o).host === req.headers['host']; } catch { return false; }
}

export const clip = (s, n) => String(s ?? '').replace(/\r\n?/g, '\n').trim().slice(0, n);
