import {currentAccount} from '../lib/accounts.js';
import core from '../lib/information-core.cjs';
import {readJSON,writeJSON,listPaths,remove} from '../lib/store.js';
import {send,readBody,pseudo,clientIp,sameOrigin,bearer,safeEqual} from '../lib/util.js';
import {checkText,checkNickname} from '../lib/filter.js';
export default core({account:currentAccount,read:readJSON,write:writeJSON,list:listPaths,remove,send,body:r=>r.method==='POST'?readBody(r):{},hash:s=>pseudo('information',s),who:r=>clientIp(r),origin:sameOrigin,admin:r=>{const k=process.env.ADMIN_TOKEN||(process.env.STORE==='memory'?'test-admin-token-1234':'');return k.length>=16&&safeEqual(bearer(r),k);},filter:s=>{const c=checkText(s);return c.blocked.length||c.flags.length;},nick:n=>!checkNickname(n),topic:'카드 해석 공부법과 도구 사용 팁. 특정인 AI 사용 제보나 타인의 상담 원문은 금지.'});
