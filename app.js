(function(){
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const debounce = (fn, ms=180) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

/* ================= 카드 사전: [이름, 영문, 정방향 키워드, 역방향 키워드, 부정 카드 여부, 별칭] ================= */
const DECK = [
 ["바보","Fool","새로운 출발|모험|자유로|순수|무계획|즉흥|두려움 없이|여행","무모|경솔|방황|철없",0,"광대"],
 ["마법사","Magician","능력|의지|실행력|창조|재능|주도적|원하는 것을 이룰|기술","속임수|잔꾀|미숙|사기",0,"마술사"],
 ["여사제","High Priestess","직관|비밀|내면의 목소리|신비|침묵|드러나지 않|조용히 지켜","숨겨진 감정|억압|비밀이 드러",0,"여교황|고위 여사제"],
 ["여황제","Empress","풍요|모성|아름다움|결실|임신|따뜻한 사랑|보살핌|넉넉","의존|과잉보호|정체|게으름",0,""],
 ["황제","Emperor","권위|안정감|리더십|통제|책임감|구조|체계|아버지","독단|고집|지배|권위적",0,""],
 ["교황","Hierophant","전통|가르침|조언자|규칙|신뢰|결혼|제도|정석","관습을 벗어|반항|형식적",0,"사제"],
 ["연인","Lovers","사랑의 결합|선택|조화|감정적인 연결|끌림|서로의 마음|운명적인 만남","갈등|잘못된 선택|불화|엇갈",0,"연인들"],
 ["전차","Chariot","전진|승리|의지력|추진력|극복|돌파|밀고 나가|목표를 향해","방향을 잃|통제 불능|좌절",0,""],
 ["힘","Strength","용기|인내|부드러운 힘|자제력|내면의 힘|다정함으로|길들","자신감 부족|나약|두려움에",0,""],
 ["은둔자","Hermit","고독|성찰|내면 탐구|혼자만의 시간|지혜|홀로|거리를 두","고립|외로움|단절",0,""],
 ["운명의 수레바퀴","Wheel of Fortune","운명|전환점|행운|타이밍|흐름이 바뀌|기회가 찾아|순환","불운|지연|악순환",0,"수레바퀴"],
 ["정의","Justice","공정|판단|진실|결과에 책임|합리적|계약|법적","불공정|편견|불리한",0,""],
 ["매달린 사람","Hanged Man","희생|기다림|관점|보류|멈춤|다른 시각|인내하며","헛된 희생|지연|정체",0,"행드맨"],
 ["죽음","Death","끝|종결|마무리|이별|끝내고 새로|정리|변화의 시기","변화 거부|미련|집착",1,""],
 ["절제","Temperance","조화|절제|치유|회복|중용|천천히|균형을 맞","불균형|과잉|극단",0,""],
 ["악마","Devil","집착|유혹|속박|중독|욕망|얽매|벗어나기 어려","해방|벗어남|끊어",1,""],
 ["탑","Tower","붕괴|충격|갑작스러운|무너|파괴|예상치 못한|뒤흔","위기를 모면|서서히 무너",1,"타워"],
 ["별","Star","희망|치유|영감|소망|긍정적인 미래|빛|회복의","실망|희망을 잃|비관",0,"스타"],
 ["달","Moon","불안|혼란|환상|두려움|착각|불확실|오해|속마음을 알 수 없","진실이 드러|오해가 풀|혼란이 걷",1,""],
 ["태양","Sun","성공|기쁨|밝은 미래|활력|행복|좋은 결과|환하|자신감","일시적인|늦어지는 성공",0,"썬"],
 ["심판","Judgement","부활|재회|각성|다시 시작|결단|부름|되살아","후회|자기 의심|미루",0,"Judgment"],
 ["세계","World","완성|성취|완결|통합|목표 달성|마무리|완벽한","미완성|마무리 부족|아쉬운 끝",0,"월드"],
];
const SUITS = [["완드","Wands","지팡이|막대"],["컵","Cups","성배"],["소드","Swords","검"],["펜타클","Pentacles","펜타클스|동전"]];
const RANKS = [["에이스","Ace"],["2","Two"],["3","Three"],["4","Four"],["5","Five"],["6","Six"],["7","Seven"],["8","Eight"],["9","Nine"],["10","Ten"],["페이지","Page"],["나이트","Knight"],["퀸","Queen"],["킹","King"]];
const MINOR_KW = {
 "완드":[["새로운 열정|영감|의욕|새로운 기회|시작의 불꽃","의욕 상실|지연"],["계획|미래를 구상|결정 앞|선택의 기로|넓은 세상","두려움에 머뭇|계획 차질"],["확장|새로운 가능성|전망|해외|멀리 내다|기다리던","지연|기대 이하"],["축하|화합|결혼|안정된 관계|집|기쁜 소식","불안정|축하가 미뤄"],["경쟁|갈등|다툼|의견 충돌|부딪","갈등 회피|내부 갈등"],["승리|인정|성공|자신감|칭찬","인정받지 못|교만"],["방어|버티|도전에 맞서|입장을 지키|맞서","포기|지침"],["빠른|소식|연락|속도|급진전|빠르게 진행","지연|엇갈린 소식"],["경계|인내|지침|마지막 고비|상처받은 경험","방어적|피로"],["부담|과중|무거운 짐|과로|혼자 다 짊어","내려놓|번아웃"],["열정적인 소식|호기심|새로운 아이디어|설레는 시작","미숙|산만"],["충동|모험|빠른 행동|열정적으로 다가","성급|변덕"],["매력|따뜻함|독립적|자신감 넘치|당당","질투|예민"],["리더십|비전|카리스마|사업|추진","독선|성급한 결정"]],
 "컵":[["새로운 사랑|감정의 시작|충만|사랑이 시작|마음이 열리","감정이 막힘|공허"],["교감|파트너십|서로 끌림|마음이 통|상호|두 사람","엇갈림|불균형한 관계"],["우정|축하|모임|즐거움|친구","과음|삼각관계"],["권태|무관심|불만족|놓친 기회|지루","새로운 관심|무기력에서"],["상실|후회|슬픔|아쉬움|실망|잃어버린","회복|상실에서 벗어"],["추억|그리움|순수|어린 시절|옛|향수","과거에 갇|추억에 집착"],["환상|선택지|혼란|망상|현실성|여러 가능성","현실을 직시|정신 차리"],["떠남|포기|더 나은 것을 찾|등을 돌|미련 없이","떠나지 못|방황"],["소원 성취|만족|소망이 이루|원하던","욕심|만족하지 못"],["가족|화목|완전한 사랑|행복한 결말|평화","가정 불화|깨진"],["감정 표현|고백|설렘|연락|귀여운","미숙한 감정|감정 기복"],["로맨스|제안|프러포즈|다가오|매력적인","변덕|허황"],["공감|배려|감수성|따뜻한 마음|이해","감정적|의존"],["감정 조절|포용|성숙한|너그러","감정 억압|조종"]],
 "소드":[["명확|결단|진실|돌파|생각이 정리","혼란|잘못된 판단"],["고민|결정 회피|교착|망설임|마음을 닫","결정을 내리|혼란"],["상처|이별|슬픔|배신|마음 아픔|아픈 진실|마음이 많이 아팠","상처 회복|치유"],["휴식|회복|재충전|멈춰|쉬어","휴식 끝|소진"],["갈등|패배|이기적|다툼 후|상처뿐인","화해|후회"],["이동|떠나|회복 중|안정으로|나아지","정체|떠나지 못"],["속임수|거짓|몰래|비밀|뒤에서","들통|양심"],["갇힘|무력감|제약|스스로 묶|벗어날 수 없","해방|스스로 풀"],["불안|걱정|악몽|잠 못|자책","불안이 줄|최악은 지나"],["바닥|최악|고통의 끝|끝장|완전히 끝","회복의 시작|바닥을 치고"],["경계|정보|감시|탐색|눈치","험담|가십"],["성급|돌진|직설|공격적|급하게","무모|충돌"],["냉철|독립|이성적|단호|냉정","차가움|날카로움"],["이성|판단력|논리|권위|객관적","냉혹|독단"]],
 "펜타클":[["금전|수입|새로운 기회|현실적인 시작|물질","기회를 놓|금전 손실"],["균형 잡|저글링|유연|바쁨|여러 일을","과부하|균형을 잃"],["협력|팀워크|기술|전문성|인정받","협력 부족|평범"],["소유|집착|절약|지키려|움켜","인색|욕심"],["결핍|어려움|소외|경제적 어려움|추위","회복|도움을 받"],["나눔|도움|베풂|지원|후원","불공평한|빚"],["기다림|인내|투자|결과를 기다|수확","조급|성과 부족"],["노력|성실|숙련|꾸준|쌓아온 경험","게으름|반복에 지침"],["풍요|자립|여유|독립|우아","의존|과시"],["부|가족|유산|안정|오래가는","가족 문제|재정 불안"],["배움|계획|성실한 시작|공부","게으름|비현실적"],["꾸준함|신중|책임감|느리지만|묵묵","정체|지루"],["현실적|돌봄|풍요로운|살림|안정적인","일 중독|불안정"],["성공|재력|안정|사업|부유","탐욕|물질주의"]],
};
const NEG_MINOR = new Set(["완드 10","컵 5","컵 8","소드 3","소드 5","소드 7","소드 8","소드 9","소드 10","펜타클 5"]);
const CARDS = [];
DECK.forEach(([ko,en,up,rv,neg,alias])=>CARDS.push({name:ko, en, up:up.split("|"), rv:rv.split("|"), neg:!!neg, alias:alias?alias.split("|"):[]}));
SUITS.forEach(([s,se,salt])=>RANKS.forEach(([r,re_],i)=>{
  const kw = MINOR_KW[s][i];
  CARDS.push({name:`${s} ${r}`, en:`${re_} of ${se}`, suit:s, rank:r, up:kw[0].split("|"), rv:kw[1].split("|"), neg:NEG_MINOR.has(`${s} ${r}`), alias:[]});
}));
const SUIT_ALT = {"지팡이":"완드","막대":"완드","성배":"컵","검":"소드","펜타클스":"펜타클","동전":"펜타클"};
const RANK_ALT = {"1":"에이스","ace":"에이스","시종":"페이지","기사":"나이트","여왕":"퀸","왕":"킹"};

/* ================= 카드 이름 찾기 ================= */
const KO_SUIT = "완드|지팡이|막대|컵|성배|소드|검|펜타클스|펜타클|동전", KO_RANK = "에이스|10|[1-9]|페이지|시종|나이트|기사|퀸|여왕|킹|왕";
function normSuit(s){ return SUIT_ALT[s] || s; }
function normRank(r){ return RANK_ALT[r.toLowerCase?.()||r] || RANK_ALT[r] || r; }
function oriAfter(text, idx){ const a = text.slice(idx, idx+22); return /역방향|\(역\)|역위|reversed/i.test(a) ? "역방향" : /정방향|\(정\)|정위|upright/i.test(a) ? "정방향" : ""; }
function namesIn(text){
  const found = []; let m;
  const push = (i, name, len) => found.push({i, name, ori:oriAfter(text, i+len)});
  const enMinor = /\b(Ace|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Page|Knight|Queen|King) of (Wands|Cups|Swords|Pentacles)\b/gi;
  while ((m = enMinor.exec(text))){ const c = CARDS.find(c=>c.en.toLowerCase()===m[0].toLowerCase()); if (c) push(m.index, c.name, m[0].length); }
  const a = new RegExp(`(${KO_SUIT})(?:의)?\\s*(${KO_RANK})(?![0-9가-힣])`, "g");
  while ((m = a.exec(text))) push(m.index, `${normSuit(m[1])} ${normRank(m[2])}`, m[0].length);
  const b = new RegExp(`(?<![0-9가-힣])(${KO_RANK})\\s*(?:번\\s*)?(?:의\\s*)?(${KO_SUIT})(?![가-힣])`, "g");
  while ((m = b.exec(text))) push(m.index, `${normSuit(m[2])} ${normRank(m[1])}`, m[0].length);
  CARDS.slice(0,22).forEach(c=>{
    const er = new RegExp(`\\bThe\\s+${c.en}\\b` + (["Strength","Justice","Death","Temperance","Judgement"].includes(c.en)?`|\\b${c.en}\\b`:""), "gi");
    while ((m = er.exec(text))) push(m.index, c.name, m[0].length);
    for (const k of [c.name, ...c.alias]){
      const re = new RegExp(`(?:^|[\\s:：–\\-·(（\\["'“])(${k})(?=\\s*(?:카드|\\(|（|정방향|역방향|$|,|\\s[–\\-:]))`, "gm");
      while ((m = re.exec(text))) push(m.index + m[0].indexOf(k), c.name, k.length);
    }
  });
  found.sort((x,y)=>x.i-y.i);
  const out = [];
  for (const f of found){
    const prev = out.find(o=>o.name===f.name && Math.abs(o.i-f.i) < 40);
    if (prev){ if (!prev.ori && f.ori) prev.ori = f.ori; continue; }
    out.push(f);
  }
  return out;
}

/* ================= 포지션 · 스프레드 ================= */
const POS = [
 ["과거",/과거|지난/], ["현재",/현재|지금 상황|현 상황/], ["미래",/미래|앞으로|가까운 미래/],
 ["장애물",/장애물|방해|도전 과제|걸림돌/], ["조언",/조언|해결책|어드바이스/], ["결과",/결과|최종|결말|결론 카드/],
 ["나의 마음",/나의 마음|내 마음|본인의 마음|질문자/], ["상대의 마음",/상대(?:방)?(?:의)? ?(?:마음|속마음|입장)|그 사람의 마음/], ["관계",/관계(?:의)? ?(?:현재|흐름|상태)?/],
 ["근원",/근원|기반|무의식|뿌리/], ["가능성",/가능성 카드|목표|의식/], ["자신",/자기 자신|본인 상태/], ["환경",/환경|주변|외부 요인/], ["희망과 두려움",/희망과 두려움|기대와 걱정/],
 ["선택 A",/선택 ?A|A ?선택|1번 선택|첫 번째 선택/], ["선택 B",/선택 ?B|B ?선택|2번 선택|두 번째 선택/],
];
const isHeader = l => { const t = l.trim(); if (!t || t.length > 60) return false;
  return /^(?:[\u{1F300}-\u{1FAFF}]|[☀-➿]|\d+[.)]|[①-⑩]|\[|【|<|#|\*\*|-\s)/u.test(t) || /카드\s*[–\-:：]|번째 카드|^(?:과거|현재|미래|조언|결과|장애물)\s*[:：–\-]?\s*$/.test(t) || (POS.some(([,re])=>re.test(t)) && t.length < 30 && !/(?:다|요|죠|네)\s*[.!~]*\s*$/.test(t)); };
const SUM_START = /^\s*(?:[\u{1F300}-\u{1FAFF}]|[☀-➿])?️?\s*(?:종합|총평|결론적으로|정리하면|전체적으로|한 ?줄 요약)/u;
const SUMMARY_RE = /종합|총평|결론적으로|정리하면|전체적으로|한 ?줄 요약|마무리/;
const TAIL_RE = /원하시면|더 궁금|추가로|필요하시면|문의|디엠|DM|후기/;
function segment(text){
  const lines = text.split("\n"); const segs = []; let cur = null;
  const flush = () => { if (cur && (cur.head || cur.body.trim())) segs.push(cur); cur = null; };
  for (const l of lines){
    if (SUM_START.test(l)){ flush(); cur = {head:"", body:l+"\n", sum:true}; }
    else if (isHeader(l)){ flush(); cur = {head:l.trim(), body:""}; }
    else { if (!cur) cur = {head:"", body:""}; cur.body += l + "\n"; }
  }
  flush();
  // 헤더가 거의 없으면 문단 단위로
  if (segs.filter(s=>s.head).length < 2){
    return text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean).map(p=>{ const ls = p.split("\n"); return ls.length>1 && ls[0].length<50 ? {head:ls[0], body:ls.slice(1).join("\n")} : {head:"", body:p}; });
  }
  return segs;
}
function analyzeSpread(text){
  const segs = segment(text).map(s=>{
    const all = s.head + "\n" + s.body;
    const pos = POS.find(([,re])=>re.test(s.head))?.[0] || "";
    const isSum = s.sum || SUMMARY_RE.test(s.head) || (!s.head && SUMMARY_RE.test(s.body.slice(0,30)));
    const isTail = !s.head && TAIL_RE.test(s.body) && s.body.length < 160;
    const isQ = /질문\s*[:：]|^\s*🔮?\s*[^\n]{0,40}\?\s*$/.test(s.head || s.body.trim()) && s.body.trim().length < 5;
    const names = namesIn(all);
    return {...s, pos, isSum, isTail, isQ, names};
  });
  const cardSegs = segs.filter(s=>!s.isSum && !s.isTail && !s.isQ && (s.names.length || s.pos || (s.body.trim().length > 30 && s.head)));
  return {segs, cardSegs};
}
function guessSpreadName(cardSegs){
  const P = cardSegs.map(s=>s.pos).filter(Boolean); const has = p => P.includes(p); const n = cardSegs.length;
  const cc = ["현재","장애물","근원","과거","가능성","미래","자신","환경","희망과 두려움","결과"].filter(has).length;
  if (cc >= 5 || n >= 9) return ["켈틱 크로스 (10장)", "현재·장애물·근원·과거·목표·가까운 미래·자신·환경·희망과 두려움·결과 순서로 놓는 가장 유명한 스프레드예요."];
  if (has("선택 A") && has("선택 B")) return ["양자택일 스프레드", "두 가지 선택지의 흐름과 결과를 나란히 비교하는 배열이에요."];
  if (has("나의 마음") || has("상대의 마음")) return [`연애·관계 스프레드 (${n}장)`, "나의 마음·상대의 마음·관계의 흐름(·조언/미래)을 보는 배열이에요. 연애 질문에 가장 흔하게 써요."];
  if (has("과거") && has("현재") && has("미래")) return ["쓰리카드 · 과거·현재·미래", "카드 3장을 시간 순서로 놓는 가장 기본 배열이에요. AI 타로 프롬프트에서도 제일 많이 쓰여요."];
  if (has("장애물") || (has("현재") && (has("조언") || has("결과")))) return [`상황·장애물·조언/결과 (${n}장)`, "지금 상황, 막고 있는 것, 해결 방향을 보는 문제 해결형 배열이에요."];
  if (n === 1) return ["원카드", "카드 한 장으로 오늘의 메시지나 짧은 답을 보는 방식이에요."];
  if (n === 3) return ["쓰리카드 (위치 이름 없음)", "카드 3장을 뽑아 순서대로 해석한 것으로 보여요."];
  if (n === 7) return ["호스슈 (말굽, 7장)", "과거부터 결과까지 7단계로 보는 배열일 수 있어요."];
  if (n >= 2) return [`${n}장 스프레드`, "위치 이름 없이 카드 여러 장을 차례로 해석한 것으로 보여요."];
  return ["알 수 없음", "카드별 구분이 보이지 않아요. 한 문단으로 쓴 리딩이거나 카드 없이 쓴 글일 수 있어요."];
}
function scoreCards(body){
  const t = body;
  const res = CARDS.map(c=>{
    let s = 0, hits = [], rvHits = 0;
    c.up.forEach(k=>{ if (k && t.includes(k)){ s += 1 + k.length*0.25; hits.push(k); } });
    c.rv.forEach(k=>{ if (k && t.includes(k)){ s += .8 + k.length*0.2; hits.push(k); rvHits++; } });
    return {c, s, hits, rv: rvHits > 0 && rvHits >= hits.length/2};
  }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  return res;
}

/* ================= 문체 지문 ================= */
const SIGNALS = [
 {label:"마크다운 흔적 (**굵게**, ## 제목)", re:/\*\*[^*\n]{1,40}\*\*|^#{1,4}\s/gm, w:2.5, cap:2},
 {label:"줄 머리 이모지 소제목 (🔮 ✨ 💫 등)", re:/^[ \t]*(?:[\u{1F300}-\u{1FAFF}]|[☀-➿])️?[ \t]*\S/gmu, w:1.1, cap:4},
 {label:"글머리표·번호 목록 구조", re:/^[ \t]*(?:[-•·▪]|\d+[.)])[ \t]+/gmu, w:.6, cap:5},
 {label:"긴 대시(—, –) · 폰 타이핑으론 드묾", re:/[—–]/g, w:1.4, cap:2},
 {label:"영문 카드명 병기 (The Star 등)", re:/\bThe (?:Fool|Magician|High Priestess|Empress|Emperor|Hierophant|Lovers|Chariot|Hermit|Wheel of Fortune|Hanged Man|Devil|Tower|Star|Moon|Sun|World)\b|\b(?:Ace|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Page|Knight|Queen|King) of (?:Wands|Cups|Swords|Pentacles)\b/gi, w:1, cap:2},
 {label:"해설서 어미 (상징·의미·나타·암시합니다)", re:/상징(?:합니다|해요|하며|하는)|의미(?:합니다|해요|하며)|나타(?:냅니다|내요|내는 카드)|시사(?:합니다|해요)|암시(?:합니다|해요)/g, w:.7, cap:5},
 {label:"추상어 반복 (에너지·흐름·내면·균형·성장)", re:/에너지|흐름|내면|균형|성장|변화의 시기|새로운 시작|우주의/g, w:.35, cap:8},
 {label:"코칭식 다독임 (기억하세요·스스로를 믿으세요)", re:/기억하세요|잊지 마세요|(?:자신|스스로)을 믿|당신은 충분히|응원(?:합니다|할게요)/g, w:1.2, cap:3},
 {label:"요약 구문 (종합적으로·결론적으로·한 줄 요약)", re:/결론적으로|종합(?:해 ?보면|하면|적으로)|한 ?줄 요약|핵심 메시지|정리하자면|전반적으로/g, w:1.5, cap:3},
 {label:"추가 제안 꼬리말 (원하시면 ~도 봐드릴게요)", re:/원하시면|더 궁금한|필요하시면|추가로 (?:봐|알려|리딩)|말씀해 ?주시면/g, w:2.2, cap:2},
 {label:"면책 문구 (참고용·최종 선택은 당신)", re:/참고(?:용|로만)|최종 (?:선택|결정)은|미래를 (?:확정|단정)|정해진 (?:미래|운명)은 없/g, w:1.3, cap:2},
 {label:"양면 균형 화법 (다만 이는·하지만 동시에)", re:/하지만 동시에|한편으로는|다만 이는|그렇다고 해서/g, w:.6, cap:3},
 {label:"사람 신호 · 구어·감정 (ㅋㅋ ㅠㅠ ~~ 헐)", re:/ㅋㅋ|ㅎㅎ|ㅠㅠ|ㅜㅜ|~~+|헐|대박/g, w:-1.2, cap:4, human:true},
 {label:"사람 신호 · 카드끼리 엮은 해석 (조합·같이 나온)", re:/조합|같이 나온|함께 나온|옆(?:에|의) 카드|앞 카드|뒤 카드|연결해서 보면/g, w:-.9, cap:3, human:true},
 {label:"사람 신호 · 직접 뽑은 경험 (섞을 때, 튀어나온 카드)", re:/제가 (?:뽑|섞|봤|느끼)|뽑(?:는|을) 때|섞(?:는|을) 때|튀어나온|떨어진 카드|점프 ?카드|느낌이 (?:와|들)/g, w:-1.5, cap:3, human:true},
];
function styleAnalyze(t){
  const rows = []; let raw = 0;
  for (const s of SIGNALS){ const m = t.match(s.re)||[]; if (!m.length) continue; const pts = Math.min(m.length, s.cap)*s.w; raw += pts;
    rows.push({label:s.label, n:m.length+"회", pts, ex:[...new Set(m.map(x=>x.trim()))].slice(0,3).join(" · "), human:!!s.human}); }
  const sents = t.split(/(?<=[.!?。])\s+|\n+/).map(x=>x.trim()).filter(x=>x.length>6);
  if (sents.length >= 6){ const L = sents.map(x=>x.length), mean = L.reduce((a,b)=>a+b,0)/L.length; const cv = Math.sqrt(L.reduce((a,b)=>a+(b-mean)**2,0)/L.length)/mean;
    if (cv < .38){ raw += 1.4; rows.push({label:"문장 길이가 지나치게 고름", n:"CV "+cv.toFixed(2), pts:1.4, ex:"사람 글은 보통 0.5 이상"}); }
    else if (cv > .85){ raw -= .8; rows.push({label:"사람 신호 · 문장 길이 들쭉날쭉", n:"CV "+cv.toFixed(2), pts:-.8, ex:"", human:true}); } }
  const mins = parseFloat($("#mins").value); let fast = false;
  if (mins > 0 && t.length > 150){ const cpm = t.length/mins;
    if (cpm > 250){ fast = true; raw += 2.2; rows.push({label:"답장 속도 대비 글이 너무 김", n:Math.round(cpm)+"자/분", pts:2.2, ex:"폰 타이핑은 보통 분당 100~200자"}); }
    else if (cpm > 130){ raw += 1; rows.push({label:"답장 속도가 빠른 편", n:Math.round(cpm)+"자/분", pts:1, ex:""}); } }
  const q = $("#myq").value.trim(); let lowFit = false;
  if (q){ const ws = (q.match(/[가-힣A-Za-z]{2,}/g)||[]).filter(w=>!/(까요|나요|할까|인가요|있을|어떻게)$/.test(w)); const hit = ws.filter(w=>t.includes(w.slice(0,2)));
    if (ws.length >= 2 && hit.length/ws.length < .3){ lowFit = true; raw += .8; rows.push({label:"내 질문의 구체적 내용이 거의 반영 안 됨", n:hit.length+"/"+ws.length, pts:.8, ex:"아무 질문에나 붙일 수 있는 일반론"}); } }
  let gap = null; const nm = $("#normal").value.trim();
  if (nm.length >= 40 && t.length >= 60){
    const feat = s => { const ss = s.split(/(?<=[.!?~])\s+|\n+/).filter(x=>x.trim().length>3);
      return {formal:(s.match(/니다/g)||[]).length/Math.max(1,ss.length), slang:(s.match(/ㅋ|ㅎㅎ|ㅠ|ㅜ|~~|용[.~!]?(?:\s|$)/g)||[]).length/Math.max(1,s.length)*100, dash:/[—–]/.test(s)}; };
    const a = feat(nm), b = feat(t); gap = 0; const why = [];
    if (a.slang > .4 && b.slang < a.slang*.25){ gap += 1.6; why.push("평소엔 ㅋㅋ·ㅠㅠ·~~ 쓰는데 리딩엔 거의 없음"); }
    if (b.formal - a.formal > .35){ gap += 1.2; why.push("리딩에서만 '~니다' 문어체 급증"); }
    if (b.dash && !a.dash){ gap += .8; why.push("리딩에서만 긴 대시(—)"); }
    if (gap){ raw += gap; rows.push({label:"평소 말투와 리딩 말투가 다름", n:"차이 "+gap.toFixed(1), pts:gap, ex:why.join(" · ")}); }
    else { raw -= 1; rows.push({label:"사람 신호 · 평소 말투와 리딩 말투가 비슷함", n:"일치", pts:-1, ex:"", human:true}); }
  }
  return {rows, raw, gap, fast, lowFit, score: t.length < 60 ? null : Math.round(100/(1+Math.exp(-(raw-3)/2.6)))};
}

/* ================= 화면 그리기 ================= */
function level(p, label){
  const n = p>=70?3:p>=50?2:p>=30?1:0;
  return `<div class="level ${n>=3?"hi":""}" role="img" aria-label="${label} ${["적음","조금","보통","많음"][n]}">${[1,2,3].map(i=>`<i class="${i<=n?"on":""}"></i>`).join("")}<span class="note" style="margin-left:6px">${label}: ${["적음","조금 있음","보통","많음"][n]}</span></div>`;
}
const SCAM = {pay:["선입금 요구","돈을 먼저 보내기 전에 입금 계좌·전화번호가 피해 신고된 적 있는지 조회해 보세요.",0],
  upsell:["추가 결제 유도","처음 리딩 뒤에 불안을 키우며 더 비싼 리딩을 권하는지 살펴보세요.",1],
  goods:["부적·기도비","리딩 결과를 이유로 물건이나 기도비 결제를 권한다면 바로 결정하지 말고 주변과 상의해 보세요.",1],
  fear:["겁주는 말","'살이 꼈다', '큰일 난다' 같은 말로 불안을 키운 뒤 결제를 권한다면 주의하세요.",1],
  pii:["개인정보 요구","타로 리딩에는 생년월일시·실명·사진이 꼭 필요하지 않아요. 보내기 전에 한 번 더 생각해 보세요.",0],
  move:["외부 메신저 유도","대화를 오픈채팅·텔레그램 등으로 옮기자고 하면, 기존 대화 캡처를 먼저 남겨 두세요.",0],
  shaman:["신내림·동자 등 영적 능력 내세우기","확인할 수 없는 능력을 내세운 뒤 굿·기도·부적 비용을 권한다면 결제 전에 신중하게 판단하세요.",1],
  rush:["결정 재촉","'오늘 안에', '지금 안 하면 늦는다'처럼 서두르게 한다면 결정을 미루고 생각할 시간을 가지세요.",1],
  guarantee:["결과 장담","'100%', '무조건 된다' 같은 장담은 타로 리딩으로 보장할 수 없는 내용이에요.",1],
  secret:["비밀 유지 요구","'주변에 말하면 효과가 없다'는 말이 있다면 오히려 믿을 만한 사람과 상의해 보세요.",1]};
const SCAM_TEXT = [[/선입금|입금 (?:후|확인)|계좌(?:로| 보내)/,"pay"],[/심화|추가 리딩|프리미엄|정밀 리딩|속마음 리딩도/,"upsell"],[/부적|기도비|액막이|액운|살(?:이|을) (?:껴|끼|풀)/,"goods"],[/큰일|위험(?:해|합니다)|안 좋은 일이 (?:생|일어)/,"fear"],[/오픈채팅|오픈톡|open\.kakao|텔레그램/i,"move"],
  [/동자|신내림|신빨|신령|신당|모시는 (?:신|분)|조상(?:님)?(?:이|께서)? ?(?:노하|화가)|원한|천도재|굿(?:을|하| 해)|살풀이|영가|빙의|퇴마/,"shaman"],
  [/오늘 ?안에|지금 (?:안 하면|바로)|늦기 전에|시간이 없|선착순/,"rush"],
  [/100 ?%|백 ?퍼|무조건 (?:돌아|이루|성공|됩)|반드시 (?:돌아|이루|성공)|장담/,"guarantee"],
  [/아무(?:한테|에게)도 말하지|비밀로 하|말하면 (?:효과|부정)|부정 ?타/,"secret"]];
function rang(w){ const ch = w.trim().slice(-1); let b;
  if (/\d/.test(ch)) b = "013678".includes(ch);
  else { const code = ch.charCodeAt(0) - 0xAC00; b = code >= 0 && code < 11172 ? code % 28 !== 0 : false; }
  return w + (b ? "이랑" : "랑"); }
const POSWORD =/긍정|희망|좋은|성공|행복|기회|밝은|연락이 올|가능성(?:이|은) (?:높|열려)|잘 될|이루어/;

function render(){
  const text = $("#txt").value.trim(), out = $("#out");
  if (text.length < 40){ out.innerHTML = `<div class="empty">받은 리딩을 위 칸에 붙여넣으면 바로 판독 결과가 나와요.</div>`; return; }
  const st = styleAnalyze(text);
  const {segs, cardSegs} = analyzeSpread(text);
  const [spreadName, spreadDesc] = guessSpreadName(cardSegs);

  // 카드 추측
  const slots = cardSegs.slice(0,10).map((s,i)=>{
    const named = s.names[0];
    const sc = scoreCards(s.body);
    const posLabel = s.pos || (s.head ? s.head.replace(/^[^\p{L}\p{N}]+/u,"").slice(0,18) : `${i+1}번째 카드`);
    if (named){
      const c = CARDS.find(x=>x.name===named.name);
      const own = sc.find(x=>x.c.name===named.name);
      const best = sc[0];
      let check = "", mismatch = false;
      if (own) check = `표준 뜻(${own.hits.slice(0,3).join(", ")})과 맞게 해석했어요.`;
      else if (best && best.s >= 3){ mismatch = true; check = `해석 내용은 오히려 ${best.c.name} 카드 뜻(${best.hits.slice(0,3).join(", ")})에 가까워요. 카드 이름과 설명이 안 맞아요.`; }
      else check = "표준 키워드는 적지만 자기 말로 풀어 썼을 수 있어요.";
      return {pos:posLabel, card:named.name + (named.ori?" "+named.ori:""), guess:false, alt:"", why:check, mismatch, neg:c?.neg};
    }
    if (!sc.length) return {pos:posLabel, card:"추측 불가", guess:true, alt:"", why:"카드 뜻을 짐작할 키워드가 부족해요.", neg:false};
    const top = sc.slice(0,3), conf = top[1] ? top[0].s/(top[0].s+top[1].s) : 1;
    const confTxt = top[0].s >= 4 && conf >= .6 ? "높음" : top[0].s >= 2.5 ? "중간" : "낮음";
    return {pos:posLabel, card:top[0].c.name + (top[0].rv?" 역방향":""), guess:true, conf:confTxt,
      alt: top.slice(1).length ? "다른 후보: " + top.slice(1).map(x=>x.c.name).join(", ") : "",
      why:`"${top[0].hits.slice(0,3).join('", "')}" 같은 표현은 ${top[0].c.name} 카드의 대표 뜻이에요.`, neg:top[0].c.neg};
  });
  const namedCount = slots.filter(s=>!s.guess).length;
  const mismatches = slots.filter(s=>s.mismatch).length;
  const textbook = slots.filter(s=>!s.guess && /표준 뜻/.test(s.why)).length;
  const sumSeg = segs.find(s=>s.isSum);
  const ending = (sumSeg ? sumSeg.head+sumSeg.body : segs.slice(-2).map(s=>s.head+s.body).join(" "));
  const hasNeg = slots.some(s=>s.neg);
  const sugarcoat = hasNeg && POSWORD.test(ending);
  const tail = SIGNALS[9].re.test(text); SIGNALS[9].re.lastIndex = 0;
  const emojiHead = /^[ \t]*(?:[\u{1F300}-\u{1FAFF}]|[☀-➿])/mu.test(text);
  const engNames = SIGNALS[4].re.test(text); SIGNALS[4].re.lastIndex = 0;

  // 판정
  const s = st.score ?? 0;
  const title = s>=70 ? "AI로 만든 글에서 자주 보이는 특징이 많아요" : s>=50 ? "AI 글의 특징이 꽤 보여요" : s>=30 ? "AI 글의 특징이 일부 보여요" : "AI 글의 특징이 적게 보여요";
  const method = s>=50 ? (namedCount || slots.length ? "카드 이름과 질문을 AI에 넣어 받은 해석을 그대로 보냈을 수도 있어요." : "카드 없이 AI에 질문만 넣어 받은 글일 수도 있어요.")
    : s>=30 ? "해설서나 AI 답을 참고해 고쳐 썼을 수도 있고, 직접 썼을 수도 있어요." : "AI 특징이 적다는 것만으로 사람이 직접 썼다고 볼 수는 없어요. AI 글을 고쳐 쓰면 특징이 거의 남지 않아요.";

  // 왜 이런 리딩이 나왔나
  const why = [];
  if (s >= 50) why.push(["ai", "챗봇이 자주 쓰는 구성이에요", `${emojiHead?"이모지 소제목, ":""}카드마다 뜻을 한 문단씩 풀고 마지막에 '종합'으로 묶는 틀은 AI 타로 답변에서 자주 보이는 형식이에요. 사람도 이렇게 쓸 수 있어요.`]);
  if (textbook >= 2 && textbook >= namedCount*0.6) why.push(["ai", "카드 뜻을 교과서 그대로 썼어요", "카드마다 해설서 대표 키워드가 그대로 들어 있어요. 카드끼리 엮어 읽은 흔적 없이 뜻만 나열돼 있다면 해설서나 AI를 참고했을 수 있어요."]);
  if (mismatches) why.push(["ai", "카드 이름과 해석이 안 맞는 곳이 있어요", `${mismatches}곳에서 카드 이름과 다른 카드의 뜻을 쓰고 있어요. 단순 실수일 수도 있지만, 카드를 보지 않고 썼거나 AI가 뜻을 섞었을 때도 생겨요.`]);
  if (sugarcoat) why.push(["warn", "부정적인 카드도 결국 좋게 포장했어요", "보통 힘든 의미의 카드가 나왔는데 결론은 희망적으로 끝나요. 듣기 좋은 결론으로 마무리하려는 리딩이나 AI 답에서 자주 보여요."]);
  if (st.lowFit) why.push(["warn", "내 질문이 거의 반영 안 됐어요", "질문의 구체적 내용 없이 일반론만 있어요. 아무 질문에나 붙일 수 있는 글이에요."]);
  if (st.gap) why.push(["ai", "평소 말투와 리딩 말투가 달라요", "평소 글과 리딩의 어미·말버릇이 크게 달라요. 카드는 직접 뽑았어도 해석은 AI를 참고했을 수 있어요."]);
  if (st.fast) why.push(["ai", "답장이 너무 빨라요", "이 길이를 그 시간에 직접 쓰기는 쉽지 않아요. 미리 써 둔 글이나 생성된 글을 붙여넣었을 수 있어요."]);
  if (tail) why.push(["warn", "추가 리딩을 권하며 끝나요", "'원하시면 ~도 봐드릴게요'는 ChatGPT가 답변 끝에 자주 붙이는 문장이기도 하고, 추가 결제로 이어가는 영업 멘트이기도 해요."]);
  if (s < 30) why.push(["", "AI 특징이 적게 보여요", "구어체나 카드끼리 엮은 해석 같은 표현이 보여요. 다만 이것만으로 사람이 직접 썼다고 판단할 수는 없어요."]);
  if (!why.length) why.push(["", "뚜렷한 패턴이 적어요", "판단할 근거가 부족해요. 아래 검증 질문을 보내 반응을 보세요."]);

  // 추정 프롬프트
  const q = $("#myq").value.trim() || (text.match(/질문\s*[:：]\s*([^\n]+)/)||[])[1] || (text.match(/^[^\n]{4,60}\?/m)||[])[0]?.replace(/^[^\p{L}]+/u,"") || "(내 질문)";
  const cardList = slots.map(x=>`${x.pos !== x.card ? x.pos+": " : ""}${x.card === "추측 불가" ? "?" : x.card}`).join(", ");
  const styleHints = [emojiHead && "이모지 넣어서", tail && "마지막에 추가 리딩 권유", engNames && "영문 카드명도 같이", /요\.|요!|요 /.test(text) && "친근한 존댓말로"].filter(Boolean);
  const prompt = `${q}\n${spreadName.split(" (")[0]}로 뽑았어. 카드: ${cardList || "(카드)"}\n타로 리딩해줘${styleHints.length ? " ("+styleHints.join(", ")+")" : ""}`;

  // 사기 신호
  const keys = new Set($$("#ctx input:checked").map(c=>c.value));
  const auto = new Set(); SCAM_TEXT.forEach(([re,k])=>{ if (re.test(text)) { auto.add(k); } });
  const flags = [...new Set([...keys, ...auto])];

  // 검증 질문
  const c1 = slots.find(x=>x.card!=="추측 불가")?.card.replace(/ (정|역)방향$/,"") || "첫 번째";
  const c2 = slots.filter(x=>x.card!=="추측 불가")[1]?.card.replace(/ (정|역)방향$/,"") || "두 번째";
  const vqs = [
    ["혹시 펼친 카드를 오늘 날짜랑 제 닉네임 적은 종이랑 같이 찍어서 보내주실 수 있을까요?", "실제로 카드를 뽑았는지 확인하는 데 도움이 돼요."],
    [`${c1} 카드는 그림에서 어떤 부분을 보고 그렇게 해석하신 거예요? 1~2분 안에 짧게만요!`, "그림의 구체적인 부분을 짚어 설명하는지 볼 수 있어요."],
    [`${rang(c1)} ${c2} 같이 놓고 보면 어떤 의미예요? 짧게요`, "카드끼리 엮어 읽을 수 있는지 볼 수 있어요."],
    ["아 참, 말 안 했는데 사실 그 사람이랑 연락은 이미 하고 있어요. 그럼 해석이 달라지나요?", "새 정보를 어떻게 반영하는지 볼 수 있어요."],
    ["어떤 덱 쓰세요? 스프레드는 뭐로 뽑으셨어요?", `이 판독기는 '${spreadName}'로 추측했어요. 답과 비교해 보세요.`],
  ];

  let h = `<section class="panel" aria-labelledby="r1"><div class="verdict nogauge"><div style="display:flex;flex-direction:column;gap:8px;min-width:0">
    <span class="pill mid" style="align-self:flex-start">참고용 · 확률이나 판정이 아니에요</span>
    <p class="vtitle" id="r1">${esc(title)}</p>${level(s,"AI 글 특징")}<p style="margin:0">${esc(method)}</p></div></div></section>`;

  const highFlags = flags.filter(k=>SCAM[k][2]);
  if (highFlags.length || flags.length >= 2) h += `<section class="panel danger"><h3>돈을 보내기 전에 확인이 필요해요</h3><p style="margin:0">${esc(flags.map(k=>SCAM[k][0]).join(", "))} 표현이 있어요. AI 사용 여부와 상관없이, 결제하기 전에 입금 계좌·전화번호를 더치트나 경찰청 사이버범죄 신고시스템에서 조회하고 주변과 상의해 보세요.</p></section>`;
  h += `<section class="panel"><h3>왜 이런 리딩이 나왔을까</h3><ul class="ev">${why.map(([c,t,d])=>`<li class="${c}"><div><p style="font-weight:600">${esc(t)}</p><p class="reason">${esc(d)}</p></div></li>`).join("")}</ul></section>`;

  h += `<section class="panel"><div class="btns" style="justify-content:space-between"><h3>사용한 스프레드 추측</h3><span class="pill mid">${esc(spreadName)}</span></div><p class="note">${esc(spreadDesc)}</p>
    ${slots.length ? `<div class="spread">${slots.map(x=>`<div class="slot ${x.guess?"guess":""}"><span class="pos">${esc(x.pos)}</span>${cardImg(x)}<p class="card">${esc(x.card)}</p>
      ${x.guess?`<span class="pill ${x.conf==="높음"?"human":"mid"}" style="align-self:flex-start">${x.card==="추측 불가"?"추측 불가":"예상 카드 · 단서 "+esc({"높음":"많음","중간":"보통","낮음":"적음"}[x.conf]||x.conf)}</span>`:`<span class="pill ${x.mismatch?"ai":"human"}" style="align-self:flex-start">${x.mismatch?"이름·해석 불일치":"글에 적힌 카드"}</span>`}
      <p class="why">${esc(x.why)}</p>${x.alt?`<p class="alt">${esc(x.alt)}</p>`:""}</div>`).join("")}</div>
      <p class="note">점선 칸은 카드 이름이 없어서 해석 내용으로 추측한 카드예요. 카드 뜻 키워드로 고른 거라 실제와 다를 수 있어요. 카드 그림은 이 사이트에서 직접 만든 도안이에요.</p>` : ""}</section>`;

  if (s >= 40) h += `<section class="panel"><h3>AI에 넣었다면 이런 질문이었을 수도 있어요 (추측)</h3><p class="note">직접 AI에 넣어 비교해 볼 수 있어요. 비슷하게 나와도 같은 방법으로 만들었다는 증거는 아니에요.</p>
    <div class="q"><pre class="prompt" id="pr">${esc(prompt)}</pre><button class="small" data-copy="pr">복사</button></div></section>`;

  h += `<section class="panel"><h3>돈을 보내기 전에 확인할 표현</h3>${flags.length ? `<ul class="ev">${flags.map(k=>`<li class="${SCAM[k][2]?"ai":"warn"}"><div><p style="font-weight:600">${esc(SCAM[k][0])} <span class="pill mid">주의</span>${auto.has(k)&&!keys.has(k)?` <span class="note">글에서 발견</span>`:""}</p><p class="reason">${esc(SCAM[k][1])}</p></div></li>`).join("")}</ul>`
    : `<p class="note">글에서 주의할 표현을 찾지 못했어요. 선입금·추가 결제 요구가 있었다면 위 '더 정확하게 보기'에서 체크하세요.</p>`}</section>`;

  h += `<section class="panel"><h3>상대에게 보내볼 확인 질문</h3><p class="note">직접 카드를 보고 해석했다면 어렵지 않게 답할 수 있는 질문이에요. 답을 못 한다고 해서 사기라는 뜻은 아니에요.</p>
    ${vqs.map((v,i)=>`<div class="q"><p id="vq${i}">${esc(v[0])}</p><button class="small" data-copy="vq${i}">복사</button><span class="purpose">${esc(v[1])}</span></div>`).join("")}</section>`;

  h += `<section class="panel"><details class="more" style="background:var(--paper)"><summary>판정 근거 자세히 보기 (문체 지문 ${st.rows.length}개)</summary><div class="body"><div class="tablewrap"><table class="sig"><tbody>${
    st.rows.length ? [...st.rows].sort((a,b)=>b.pts-a.pts).map(x=>`<tr><td><span style="color:${x.human?'var(--human)':'var(--ai)'};font-weight:600">${x.human?"사람":"AI"}</span> ${esc(x.label)}</td><td class="ex">${esc(x.ex)}</td><td class="n">${esc(x.n)}</td></tr>`).join("") : `<tr><td class="note">걸리는 지문이 없어요.</td></tr>`
  }</tbody></table></div></div></details></section>`;
  h += `<section class="panel"><h3>후기·피드백·제보</h3><p class="note">판독 결과가 맞았는지, 고쳤으면 하는 점, 겪은 사례를 게시판에 남겨 주세요. 판독기에 붙여넣은 리딩은 자동으로 전송되지 않아요. 게시판에는 직접 써서 제출한 내용만 저장돼요.</p><div class="btns"><a class="navbtn" href="/board.html">게시판으로 가기</a></div></section>`;
  out.innerHTML = h;
}

document.addEventListener("click", async e=>{
  const b = e.target.closest("[data-copy]"); if (!b) return;
  const el = document.getElementById(b.dataset.copy); if (!el) return;
  try{ await navigator.clipboard.writeText(el.textContent); b.textContent="복사됨"; }
  catch{ const r=document.createRange(); r.selectNodeContents(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent="선택됨"; }
  setTimeout(()=>b.textContent="복사",1500);
});

// 일러스트: cards/manifest.json 에 등록된 그림이 있으면 그걸 쓰고, 없으면 기본 SVG 도안을 보여줘요.
let ART = {};
fetch("/cards/manifest.json", {cache:"no-cache"}).then(r=>r.ok?r.json():null).then(j=>{
  const f = j && j.files; if (!f || typeof f !== "object") return;
  for (const [k,v] of Object.entries(f)) if (/^[a-z]+-\d{2}$/.test(k) && /^[a-z0-9-]+\.(webp|png|jpg|jpeg)$/.test(v)) ART[k] = v;
  if (Object.keys(ART).length) render();
}).catch(()=>{});
function cardImg(x){
  const name = String(x.card||"").replace(/ (정|역)방향$/,"");
  const T = window.TarotCards; if (!T) return "";
  const cls = `cardimg ${/역방향$/.test(x.card)?"rev":""} ${x.guess?"guess":""}`;
  const file = ART[T.slug(name)];
  if (file) return `<div class="${cls}"><img src="/cards/${esc(file)}" alt="${esc(name)} 카드" width="240" height="360" loading="lazy" decoding="async"></div>`;
  const svg = T.svg(name);
  return svg ? `<div class="${cls}">${svg}</div>` : "";
}

/* ================= 탭 ================= */
function showView(v){
  $$(".tabs button").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.v===v)));
  $("#readView").hidden = v!=="read"; $("#cmpView").hidden = v!=="compare";
  try{ history.replaceState(null,"","#"+v); }catch{}
}
$$(".tabs button").forEach(b=>b.onclick=()=>showView(b.dataset.v));
if (location.hash === "#compare") showView("compare");

/* ================= 같은 사람인지 비교 ================= */
function grams(s,n){ const t=s.replace(/https?:\/\/\S+/g,"").replace(/\s+/g,""); const m=new Map(); for(let i=0;i+n<=t.length;i++){const g=t.slice(i,i+n); m.set(g,(m.get(g)||0)+1);} return m; }
function cosM(a,b){ let d=0,na=0,nb=0; for(const [k,v] of a){na+=v*v; if(b.has(k)) d+=v*b.get(k);} for(const v of b.values()) nb+=v*v; return na&&nb ? d/Math.sqrt(na*nb) : 0; }
function cosV(a,b){ let d=0,na=0,nb=0; a.forEach((v,i)=>{d+=v*b[i];na+=v*v;nb+=b[i]*b[i];}); return na&&nb ? d/Math.sqrt(na*nb) : 0; }
const wordsOf = s => (s.match(/[가-힣A-Za-z0-9]+/g)||[]);
function sharedPhrases(a, b, n){
  const wa = wordsOf(a), wb = wordsOf(b), setB = new Set();
  for (let i=0;i+n<=wb.length;i++) setB.add(wb.slice(i,i+n).join(" "));
  const hits = []; let i = 0;
  while (i+n <= wa.length){
    if (setB.has(wa.slice(i,i+n).join(" "))){ let j = i+n; while (j < wa.length && setB.has(wa.slice(j-n+1,j+1).join(" "))) j++; hits.push(wa.slice(i,j).join(" ")); i = j; }
    else i++;
  }
  return [...new Set(hits)].filter(p=>p.replace(/\s/g,"").length>=5).sort((x,y)=>y.length-x.length);
}
function highlight(text, phrases){
  let h = esc(text);
  phrases.slice(0,25).forEach(p=>{ const re = new RegExp(p.split(" ").map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("[^가-힣A-Za-z0-9]+"), "g"); h = h.replace(re, m=>`<mark>${m}</mark>`); });
  return h;
}
const HABITS = [["물결(~)",/~/g],["말줄임(..)",/\.\.+/g],["느낌표 연속(!!)",/!{2,}/g],["물음표 버릇(?? ?!)",/\?{2,}|\?!/g],["ㅋ 웃음",/ㅋ+/g],["ㅎ 웃음",/ㅎ+/g],["ㅠ·ㅜ",/[ㅠㅜ]+/g],
 ["'~용' 어미",/용(?=[\s.~!?ㅎㅋ]|$)/gm],["'~당' 어미",/당(?=[\s.~!?ㅎㅋ]|$)/gm],["'~니다' 어미",/니다/g],["'~더라구요'",/더라구요/g],["'~느낌?' 물음",/느낌\?/g],
 ["이모지",/[\u{1F300}-\u{1FAFF}]/gu],["^^",/\^\^/g],[";;",/;{2,}/g],[":) 이모티콘",/:\)|:D/g],["긴 대시(—)",/[—–]/g],
 ["영적 표현(동자·신령·조상)",/동자|신령|조상|신당|모시는/g],["시간 압박 표현",/오늘 ?안에|지금 바로|늦기 전에|선착순/g],["장담 표현(무조건·100%)",/무조건|100 ?%|백 ?퍼|장담/g]];
function endings(s){ const m=new Map(); s.split(/[.!?~\n]+/).forEach(x=>{ const e=x.trim().match(/([가-힣]{1,2})[\sㅎㅋㅠㅜ^:)]*$/); if(e){const k=e[1].slice(-2); m.set(k,(m.get(k)||0)+1);} }); return m; }
function habitVec(s){ const L=Math.max(1,s.length)/100; return HABITS.map(([,re])=>((s.match(re)||[]).length)/L); }
function idsOf(s){
  const out=new Set();
  (s.match(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g)||[]).forEach(x=>out.add("전화 "+x.replace(/\D/g,"")));
  (s.match(/\d{2,6}[-\s]\d{2,6}[-\s]\d{2,8}(?:[-\s]\d{1,6})?/g)||[]).forEach(x=>{const d=x.replace(/\D/g,""); if(d.length>=10&&d.length<=16&&!/^01[016789]/.test(d)) out.add("계좌 "+d);});
  (s.match(/\b\d{11,14}\b/g)||[]).forEach(x=>{ if(!/^01[016789]/.test(x)) out.add("계좌 "+x); });
  (s.match(/open\.kakao\.com\/[^\s)]+/gi)||[]).forEach(x=>out.add("오픈채팅 "+x.toLowerCase()));
  (s.match(/[\w.+-]+@[\w-]+\.[\w.]+/g)||[]).forEach(x=>out.add("이메일 "+x.toLowerCase()));
  return out;
}
function pairCompare(A, B){
  const tri = cosM(grams(A,3),grams(B,3)), end = cosM(endings(A),endings(B));
  const ha = habitVec(A), hb = habitVec(B), hab = cosV(ha,hb);
  const ea = new Set(A.match(/[\u{1F300}-\u{1FAFF}]/gu)||[]), eb = new Set(B.match(/[\u{1F300}-\u{1FAFF}]/gu)||[]);
  const emo = (ea.size||eb.size) ? [...ea].filter(x=>eb.has(x)).length/new Set([...ea,...eb]).size : null;
  const sc = .35*tri + .3*end + .25*hab + .1*(emo ?? hab);
  const sharedH = HABITS.map(([n],i)=>({n,a:ha[i],b:hb[i]})).filter(h=>h.a>0&&h.b>0).sort((x,y)=>Math.min(y.a,y.b)-Math.min(x.a,x.b)).slice(0,6).map(h=>h.n);
  const ia = idsOf(A), ib = idsOf(B);
  return {tri,end,hab,score:Math.round(Math.max(0,Math.min(1,(sc-.2)/.5))*100),sharedH,same:[...ia].filter(x=>ib.has(x))};
}
let accts = [], cIsEx = true;
function acctBlock(key, isA){
  const div = document.createElement("div"); div.className="acct";
  div.innerHTML = `<h3><span class="tag">${key}</span> ${isA?"예전 계정 (문제가 됐던 계정)":"의심 가는 계정"} ${isA?"":`<button class="small rm" type="button">삭제</button>`}</h3>
    <input type="text" class="aid" placeholder="아이디·닉네임 (메모용, 비교에는 안 써요)" aria-label="${key} 아이디">
    <textarea class="atxt" spellcheck="false" aria-label="${key} 글"></textarea>
    <input type="text" class="aex" placeholder="입금 계좌·전화번호·오픈채팅 링크 (아는 것만)" aria-label="${key} 계좌·번호">`;
  const a = {key, el:div};
  const rm = div.querySelector(".rm"); if (rm) rm.onclick = ()=>{ accts = accts.filter(x=>x!==a); div.remove(); relabel(); renderC(); };
  div.querySelectorAll("input,textarea").forEach(i=>i.addEventListener("input",()=>{ if(cIsEx){cIsEx=false;$("#cExNote").hidden=true;} rcmp(); }));
  return a;
}
function relabel(){ accts.forEach((a,i)=>{ if(i===0) return; a.key="B"+i; a.el.querySelector(".tag").textContent=a.key; }); $("#addAcct").disabled = accts.length >= 4; }
function addAcct(text="", id=""){ if (accts.length >= 4) return; const isA = accts.length===0; const a = acctBlock(isA?"A":"B"+accts.length, isA);
  a.el.querySelector(".atxt").value = text; a.el.querySelector(".aid").value = id; accts.push(a); $("#acctList").append(a.el); relabel(); }
const aText = a => a.el.querySelector(".atxt").value.trim();
const aFull = a => aText(a)+"\n"+a.el.querySelector(".aex").value;
const aId = a => a.el.querySelector(".aid").value.trim();
function renderC(){
  const out = $("#cOut"), A = accts[0], cands = accts.slice(1).filter(b=>aText(b).length);
  if (!A || aText(A).length < 40 || !cands.length){ out.innerHTML = `<div class="empty">계정 A와 의심 계정에 글을 넣으면 문체가 얼마나 비슷한지 바로 보여드려요.</div>`; return; }
  const ta = aText(A), fa = aFull(A);
  const rows = cands.map(b=>({b, key:b.key, id:aId(b), ...pairCompare(fa, aFull(b)), short: ta.length<120 || aText(b).length<120, ph: sharedPhrases(ta, aText(b), 2)}))
    .sort((x,y)=>(y.same.length*1000+y.score)-(x.same.length*1000+x.score));
  const top = rows[0], pct = v => Math.round(v*100)+"%";
  const title = top.same.length ? `${top.key}: A와 같은 계좌·번호·링크가 있어요` : top.score>=65 ? `${top.key}: A와 문체가 많이 비슷해요` : top.score>=40 ? `${top.key}: A와 비슷한 습관이 꽤 보여요` : "A와 뚜렷하게 닮은 계정은 없어요";
  const sum = top.same.length ? "같은 정보가 들어 있다면 신고할 때 캡처와 함께 제출해 보세요. 다만 이 결과만으로 같은 사람이라고 단정할 수는 없어요."
    : top.score>=40 ? `어미·말버릇이 겹쳐요${top.sharedH.length?" ("+top.sharedH.slice(0,3).join(", ")+")":""}. 문체가 비슷한 사람은 많아서 같은 사람이라는 증거는 아니에요.` : "글이 더 많으면 결과가 달라질 수 있어요. 계정마다 300자 이상 넣어보세요.";
  const sv = top.same.length ? 100 : top.score;
  let h = `<section class="panel"><div class="verdict nogauge"><div style="display:flex;flex-direction:column;gap:8px;min-width:0">
    <span class="pill mid" style="align-self:flex-start">${top.short?"글이 짧아 참고만":"참고용 · 같은 사람이라는 판정이 아니에요"}</span>${level(sv,"문체 유사도")}
    <p class="vtitle">${esc(title)}</p><p style="margin:0">${esc(sum)}</p></div></div>
    ${rows.filter(x=>x.same.length).map(x=>`<p class="hit">A와 ${esc(x.key)}에 같은 연결고리: ${x.same.map(esc).join(" · ")}</p>`).join("")}</section>`;
  h += `<section class="panel"><h3>의심 계정 순위</h3><div class="tablewrap"><table class="sig"><tbody><tr><td class="note">계정</td><td class="note">글자 조합</td><td class="note">어미</td><td class="note">말버릇</td><td class="note">유사도</td></tr>${
    rows.map(x=>`<tr><td><b>${esc(x.key)}</b> <span class="note">${esc(x.id)}</span></td><td class="n">${pct(x.tri)}</td><td class="n">${pct(x.end)}</td><td class="n">${pct(x.hab)}</td><td class="n"><b>${x.same.length?"일치":x.score}</b>${x.short?" *":""}</td></tr>`).join("")}</tbody></table></div>
    ${rows.some(x=>x.short)?`<p class="note">* 글이 120자 미만이라 수치가 불안정해요.</p>`:""}</section>`;
  h += rows.map((x,i)=>`<section class="panel"><details class="more" ${i===0?"open":""} style="background:var(--paper)"><summary>${esc(x.key)} ${esc(x.id)} · 근거 보기</summary><div class="body">
      <p style="margin:0"><b>똑같이 나오는 버릇</b> · ${esc(x.sharedH.join(", ")||"없음")}</p>
      <p style="margin:0"><b>같은 연결고리</b> · ${esc(x.same.join(", ")||"없음")}</p>
      <p class="note">노란색은 두 계정에서 똑같이 쓴 표현이에요. 영업 멘트까지 똑같다면 더 살펴볼 만하지만, 흔한 표현일 수도 있어요.</p>
      <div class="pair"><div><span class="who">계정 A</span><p class="side">${highlight(ta, x.ph)}</p></div><div><span class="who">계정 ${esc(x.key)}</span><p class="side">${highlight(aText(x.b), x.ph)}</p></div></div>
    </div></details></section>`).join("");
  h += `<div class="caveat">이 비교는 문체가 얼마나 비슷한지 보여주는 참고 자료이고, 같은 사람이라는 판정이 아니에요. 결과만으로 특정인을 공개적으로 지목하지 말고, 피해가 있다면 계좌·번호·캡처를 모아 공식 창구에 신고하세요.</div>`;
  out.innerHTML = h;
}
const rcmp = debounce(renderC, 200);
$("#addAcct").onclick = ()=>addAcct();
$("#cClear").onclick = ()=>{ accts.forEach(a=>a.el.remove()); accts=[]; addAcct(); addAcct(); cIsEx=false; $("#cExNote").hidden=true; renderC(); };
addAcct(`오늘도 봐드려용~~ 저는 애기동자님 모시고 있어서 다 보여용 ㅎㅎ\n재회 질문 많으신데 상대분 마음은 아직 정리가 덜 된 느낌? 근데 조상님이 막고 계셔서 기도 한번 올려야 풀려용..\n오늘 안에 기도비 입금하시면 이번 주 안에 연락 와용 ㅎㅎ 100% 장담해요`, "@moon_tarot (예시)");
addAcct(`안녕하세요 힐링 카드 리더예요 :) 신령님이 알려주시는 대로 봐드려용~~\n요즘 연락 기다리시는 분들 많으시더라구요ㅠㅠ 상대분 마음은 아직 정리가 덜 된 느낌? 조상님 쪽이 좀 막혀 있어용..\n지금 바로 기도 올리시면 무조건 풀려요 ㅎㅎ 선입금 확인 후 진행돼용`, "@healing_card (예시)");
renderC();

const EXAMPLE = `🔮 그 사람과 다시 연락이 될까요?

✨ 과거
두 분은 서로에게 상처를 주고받으며 이별의 슬픔을 겪으셨어요. 마음이 많이 아팠던 시기를 상징합니다.

✨ 현재
지금은 서로를 그리워하며 함께했던 추억을 떠올리고 있는 흐름이에요. 순수했던 시절에 대한 그리움이 느껴집니다.

✨ 미래
가까운 시일 내에 빠른 소식이나 연락이 찾아올 가능성이 높습니다. 상황이 빠르게 진행될 거예요.

💫 종합적으로 보면, 재회의 가능성은 열려 있어요. 기억하세요, 최종 선택은 당신에게 달려 있어요. 원하시면 상대방 속마음 리딩도 추가로 봐드릴게요 🌙`;
const txt = $("#txt"); txt.value = EXAMPLE; let isEx = true;
const r = debounce(render);
txt.addEventListener("input",()=>{ if(isEx){ isEx=false; $("#exNote").hidden=true; } r(); });
["#myq","#mins","#normal"].forEach(s=>$(s).addEventListener("input", r));
$$("#ctx input").forEach(c=>c.addEventListener("change", render));
$("#clear").onclick = ()=>{ ["#txt","#myq","#mins","#normal"].forEach(s=>$(s).value=""); $$("#ctx input").forEach(c=>c.checked=false); isEx=false; $("#exNote").hidden=true; render(); txt.focus(); };
render();
})();
