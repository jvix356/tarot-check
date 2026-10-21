// 게시판 글 필터. block = 등록 자체를 막음, flag = 등록은 받되 운영자 검토 때 표시.
const squash = s => String(s).normalize('NFKC').toLowerCase().replace(/[\s._\-*~·ㆍ!?,'"`^()[\]{}|/\\]+/g, '');

const RULES = [
  { key: 'profanity', label: '욕설', block: true, on: 'squash',
    re: /씨발|시발|씨빨|씨팔|ㅅㅂ|ㅆㅂ|ㅅ1ㅂ|병신|ㅂㅅ|븅신|좆|ㅈ같|존나|졸라|개새|개색|개쌔|새끼|썅|지랄|ㅈㄹ|염병|꺼져|닥쳐|fuck|shit|bitch/ },
  { key: 'insult', label: '모욕·비하', block: true, on: 'squash',
    re: /미친(?:년|놈|것|새)|또라이|돌아이|쓰레기같|한남충|한녀|김치녀|틀딱|급식충|맘충|정신병자|장애인같|애미|애비|느금/ },
  { key: 'sexual', label: '음란', block: true, on: 'squash',
    re: /섹스|야동|자위|성기|보지|자지|따먹|조건만남|오피걸|풀싸롱|ㅅㅅ하자|몸매인증/ },
  { key: 'threat', label: '위협', block: true, on: 'squash',
    re: /죽여버|죽인다|죽일거|죽일꺼|찾아간다|찾아갈거|가만안둬|가만안둘|신상털|칼로|불질러|패버린|때려죽/ },
  { key: 'rrn', label: '주민등록번호', block: true, on: 'raw', re: /\b\d{6}\s*-\s*[1-4]\d{6}\b/ },
  { key: 'phone', label: '전화번호', block: true, on: 'raw', re: /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/ },
  { key: 'email', label: '이메일 주소', block: true, on: 'raw', re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/ },
  { key: 'account', label: '계좌번호로 보이는 숫자', block: true, on: 'raw', test: t => (t.match(/\d[\d\s-]{8,22}\d/g) || []).some(m => { const d = m.replace(/\D/g, ''); return d.length >= 10 && d.length <= 16 && !/^01[016789]/.test(d) && !/^(19|20)\d{6}$/.test(d); }) },
  { key: 'address', label: '상세 주소', block: true, on: 'raw', re: /\d+\s*동\s*\d+\s*호|[가-힣]+(?:시|구|군)\s+[가-힣0-9]+(?:로|길)\s*\d+/ },
  { key: 'spam', label: '광고·스팸', block: true, on: 'squash',
    re: /부업|수익보장|고수익|코인리딩|리딩방|대출|카지노|토토|바카라|홍보합니다|광고문의|텔레그램|텔레아이디|카톡아이디|오픈채팅방|선착순모집/ },
  { key: 'link', label: '외부 링크', block: false, on: 'raw', re: /https?:\/\/|www\.|open\.kakao/i },
  { key: 'handle', label: '특정 계정 언급(@아이디)', block: false, on: 'raw', re: /@[a-z0-9_.]{2,}/i },
  { key: 'accuse', label: '특정인을 사기꾼으로 단정하는 표현', block: false, on: 'raw', re: /사기꾼|사기 ?친|사기 ?당|고소|신고했/ },
];

export function checkText(text) {
  const raw = String(text || ''), sq = squash(raw);
  const blocked = [], flags = [];
  for (const r of RULES) {
    const t = r.on === 'raw' ? raw : sq;
    if (r.test ? r.test(t) : r.re.test(t)) (r.block ? blocked : flags).push(r.label);
  }
  if ((raw.match(/https?:\/\//g) || []).length > 2) blocked.push('링크가 너무 많음');
  if (/(.)\1{9,}/u.test(raw)) blocked.push('같은 글자 반복');
  return { blocked, flags };
}

// 운영자에게만 보이는 메모는 개인정보(계좌·번호 등)를 허용하되 욕설·위협·음란은 막아요
export function checkPrivate(text) {
  const sq = squash(text);
  return RULES.filter(r => ['profanity', 'sexual', 'threat'].includes(r.key) && r.re.test(sq)).map(r => r.label);
}

const RESERVED = /운영자|관리자|admin|operator|공식|official|판독기|tarot.?check/i;
export function checkNickname(n) {
  const nick = String(n || '').trim();
  if (nick.length < 2 || nick.length > 12) return '닉네임은 2~12자로 정해 주세요.';
  if (!/^[가-힣A-Za-z0-9_]+$/.test(nick)) return '닉네임은 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.';
  if (RESERVED.test(nick)) return '운영자로 오해될 수 있는 닉네임은 쓸 수 없어요.';
  const { blocked } = checkText(nick);
  if (blocked.length) return '쓸 수 없는 표현이 들어 있어요.';
  return '';
}
