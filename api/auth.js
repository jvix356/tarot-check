import crypto from 'node:crypto';
import { readJSON, writeJSON, remove, listPaths } from '../lib/store.js';
import { send, readBody, pseudo, signToken, sameOrigin, clientIp, clip } from '../lib/util.js';
import { mailConfigured, sendCode } from '../lib/mail.js';
import { currentAccount, maskEmail } from '../lib/accounts.js';
import { checkNickname } from '../lib/filter.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const HOUR = 36e5;

export default async function handler(req, res) {
  try {
    const o=req.headers.origin;const allowed=['https://tarot-check.vercel.app','https://maeum-seorap.vercel.app','https://jvix356.github.io'];
    const local=process.env.STORE==='memory'&&o==='https://test.local';
    if(o&&!allowed.includes(o)&&!local)return send(res,403,{error:'origin'});
    if(o){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Vary','Origin');}
    res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
    if (req.method === 'GET') {
      const acc = await currentAccount(req);
      if (!acc) return send(res, 401, { error: 'login_required' });
      return send(res, 200, { subject: acc.id, nickname: acc.nickname || '', email: maskEmail(acc.email), method: acc.method });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    // Explicit community origins validated above; bearer tokens, no ambient cookies.
    const b = await readBody(req);

    if (b.action === 'send') {
      if (!mailConfigured()) return send(res, 503, { error: 'mail_not_configured', message: '이메일 인증이 아직 준비 중이에요.' });
      const email = clip(b.email, 254).toLowerCase();
      if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'email', message: '이메일 주소를 확인해 주세요.' });
      // 개인정보 보호법 제22조의2: 만 14세 미만은 이메일 인증(개인정보 수집)을 받지 않아요. 수집·이용 동의도 확인해요.
      if (b.age14 !== true) return send(res, 400, { error: 'age', message: '이메일 인증은 만 14세 이상만 할 수 있어요.' });
      if (b.privacy !== true) return send(res, 400, { error: 'privacy', message: '개인정보 수집·이용에 동의해야 인증할 수 있어요.' });
      if(process.env.COMMUNITY_PAUSED==='1' && !(await readJSON(`accounts/u${pseudo('email',email).slice(0,20)}.json`)))return send(res,403,{error:'paused'});
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

    if (b.action === 'withdraw') {
      // 탈퇴: 이메일 계정 정보를 지우고, 쓴 글에서는 계정 연결과 운영자 전달 메모를 지워요(공개 글 자체는 삭제 요청으로 따로 지울 수 있어요)
      const acc = await currentAccount(req);
      if (!acc) return send(res, 401, { error: 'login_required' });
      for (const path of await listPaths('posts/')) {
        const p = await readJSON(path);
        if (p && p.authorId === acc.id) { p.authorId = null; p.privateNote = ''; p.withdrawnAt = new Date().toISOString(); await writeJSON(path, p); }
      }
      if(acc.nickname)await remove(`nick/${pseudo('nick',acc.nickname)}.json`);
      await remove(`accounts/${acc.id}.json`);
      return send(res, 200, { ok: true, message: '탈퇴했어요. 이메일 정보를 삭제했어요.' });
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
      const existing=await readJSON(path);
      if(!existing && process.env.COMMUNITY_PAUSED==='1')return send(res,403,{error:'read_only',message:'신규 계정 접수는 중단했어요.'});
      const acc = existing || { id: uid, email, method: 'email', createdAt: new Date().toISOString(), nickname: '', sessionVersion: 1, posts: [] };
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
