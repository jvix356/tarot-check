import crypto from 'node:crypto';
import { readJSON, writeJSON, remove } from '../lib/store.js';
import { send, readBody, pseudo, signToken, sameOrigin, clientIp, clip } from '../lib/util.js';
import { mailConfigured, sendCode } from '../lib/mail.js';
import { currentAccount, maskEmail } from '../lib/accounts.js';
import { checkNickname } from '../lib/filter.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const HOUR = 36e5;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const acc = await currentAccount(req);
      if (!acc) return send(res, 401, { error: 'login_required' });
      return send(res, 200, { nickname: acc.nickname || '', email: maskEmail(acc.email), method: acc.method });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
    const b = await readBody(req);

    if (b.action === 'send') {
      if (!mailConfigured()) return send(res, 503, { error: 'mail_not_configured', message: '이메일 인증이 아직 준비 중이에요.' });
      const email = clip(b.email, 254).toLowerCase();
      if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'email', message: '이메일 주소를 확인해 주세요.' });
      const key = `otp/${pseudo('email', email)}.json`;
      const ipKey = `rl/otp-ip-${pseudo('ip', clientIp(req))}.json`;
      const now = Date.now();
      const prev = (await readJSON(key)) || { sends: [] };
      const ipRec = (await readJSON(ipKey)) || { t: [] };
      prev.sends = (prev.sends || []).filter(t => now - t < HOUR);
      ipRec.t = (ipRec.t || []).filter(t => now - t < HOUR);
      if (prev.sends.length >= 3 || ipRec.t.length >= 10) return send(res, 429, { error: 'rate', message: '인증 코드를 너무 자주 요청했어요. 1시간 뒤에 다시 시도해 주세요.' });
      const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
      await sendCode(email, code);
      prev.sends.push(now); ipRec.t.push(now);
      await writeJSON(key, { codeHash: pseudo('code', email + ':' + code), exp: now + 10 * 60e3, tries: 0, sends: prev.sends });
      await writeJSON(ipKey, ipRec);
      return send(res, 200, { ok: true });
    }

    if (b.action === 'verify') {
      const email = clip(b.email, 254).toLowerCase();
      const code = clip(b.code, 10).replace(/\D/g, '');
      const key = `otp/${pseudo('email', email)}.json`;
      const rec = await readJSON(key);
      if (!rec || !rec.codeHash || rec.exp < Date.now()) return send(res, 400, { error: 'expired', message: '코드가 만료됐어요. 다시 받아 주세요.' });
      if (rec.tries >= 5) return send(res, 429, { error: 'tries', message: '시도 횟수를 넘었어요. 코드를 다시 받아 주세요.' });
      if (rec.codeHash !== pseudo('code', email + ':' + code)) {
        rec.tries = (rec.tries || 0) + 1; await writeJSON(key, rec);
        return send(res, 400, { error: 'code', message: '코드가 맞지 않아요.' });
      }
      await remove(key);
      const uid = 'u' + pseudo('email', email).slice(0, 20);
      const path = `accounts/${uid}.json`;
      const acc = (await readJSON(path)) || { id: uid, email, method: 'email', createdAt: new Date().toISOString(), nickname: '', sessionVersion: 1, posts: [] };
      if (acc.disabled) return send(res, 403, { error: 'disabled', message: '이 계정은 운영 정책에 따라 이용이 제한됐어요.' });
      acc.verifiedAt = new Date().toISOString();
      await writeJSON(path, acc);
      return send(res, 200, { token: signToken({ uid, sv: acc.sessionVersion }), nickname: acc.nickname || '' });
    }

    if (b.action === 'nickname') {
      const acc = await currentAccount(req);
      if (!acc) return send(res, 401, { error: 'login_required' });
      const nick = clip(b.nickname, 20);
      const err = checkNickname(nick);
      if (err) return send(res, 400, { error: 'nickname', message: err });
      const nkey = `nick/${pseudo('nick', nick)}.json`;
      const owner = await readJSON(nkey);
      if (owner && owner.uid !== acc.id) return send(res, 409, { error: 'taken', message: '이미 쓰고 있는 닉네임이에요.' });
      if (acc.nickname && acc.nickname !== nick) await remove(`nick/${pseudo('nick', acc.nickname)}.json`);
      await writeJSON(nkey, { uid: acc.id });
      acc.nickname = nick; await writeJSON(`accounts/${acc.id}.json`, acc);
      return send(res, 200, { nickname: nick });
    }

    return send(res, 400, { error: 'action' });
  } catch (e) {
    return send(res, e.status || 500, { error: 'server', message: e.status === 503 ? '서버 설정이 아직 끝나지 않았어요.' : '잠시 후 다시 시도해 주세요.' });
  }
}
