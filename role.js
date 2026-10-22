// 이용자 유형(일반인·타로 리더·독학 중) 선택. 이 브라우저에 기억하고, 서버에는 임의 키와 유형만 보내 유형별 숫자를 세요.
const TIPS = {
  general: '일반인: 받은 리딩을 붙여넣으면 겁주기·돈 요구·단정 예언 같은 주의 표현을 짚어 드려요. 돈을 보내기 전엔 "입금 전 확인"도 꼭 봐 주세요.',
  reader: '타로 리더: 내가 쓴 리딩을 넣어 보면 오해받기 쉬운 표현(단정·겁주기·추가 결제 유도)이 있는지 점검할 수 있어요.',
  self: '독학 중: 카드 이름을 함께 적으면 웨이트 원전 뜻과 비교해 볼 수 있어요. 예시로 사용해 보기도 눌러 보세요.',
};
const btns = [...document.querySelectorAll('[data-role]')], tip = document.getElementById('roleTip');
function get(k) { try { return localStorage.getItem(k); } catch { return null; } }
function set(k, v) { try { localStorage.setItem(k, v); } catch {} }
function key() {
  let k = get('tc_role_key');
  if (!/^[a-f0-9]{32}$/.test(k || '')) { k = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join(''); set('tc_role_key', k); }
  return k;
}
function show(role) {
  btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === role)));
  if (role && TIPS[role] && tip) tip.textContent = TIPS[role] + ' (선택은 언제든 바꿀 수 있어요)';
}
btns.forEach(b => b.addEventListener('click', async () => {
  const role = b.dataset.role; set('tc_role', role); show(role);
  try { await fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: key(), role }) }); window.dispatchEvent(new Event('tc:stats-sent')); } catch {}
}));
show(get('tc_role'));
