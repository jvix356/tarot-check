import { send } from '../lib/util.js';
import { mailConfigured } from '../lib/mail.js';
import { storeConfigured } from '../lib/store.js';

// 화면이 기능 사용 가능 여부만 알 수 있게 (비밀값은 절대 내보내지 않음)
export default function handler(req, res) {
  send(res, 200, {
    store: storeConfigured(),
    emailAuth: mailConfigured(),
    admin: !!process.env.ADMIN_TOKEN || process.env.STORE === 'memory',
  });
}
