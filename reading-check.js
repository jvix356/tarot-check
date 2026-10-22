// 판독 결과에 "AI 여부와 상관없이: 해석 방식 점검"을 붙여요. 모든 분석은 브라우저 안에서만 해요.
import { checkReading, EXPLAIN } from './reading-check-model.js';

const out = document.getElementById('out');
const txt = document.getElementById('txt');
let rws = null;
fetch('/data/decks.json').then(r => (r.ok ? r.json() : null)).then(j => { rws = j?.decks?.find(d => d.id === 'rws')?.cards || null; if (out?.children.length) render(); }).catch(() => {});

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

function render() {
  if (!out || !txt) return;
  document.getElementById('readingCheck')?.remove();
  const t = txt.value || '';
  if (t.trim().length < 20) return;
  const items = checkReading(t, rws);
  const sec = el('section', 'panel'); sec.id = 'readingCheck';
  sec.appendChild(el('h3', null, 'AI 여부와 상관없이: 해석 방식 점검'));
  sec.appendChild(el('p', 'note', '사람이 직접 썼어도 엉터리 해석으로 돈을 받는 경우가 있어요. 아래는 본문에서 실제로 찾은 표현을 근거로 한 점검 목록이에요. 판정이 아니며, 특정인을 사기꾼으로 지목하는 근거로 쓰지 마세요.'));
  if (!items.length) sec.appendChild(el('p', 'note', '점검 목록에 걸리는 표현을 찾지 못했어요. 그래도 선입금·추가 결제 요구가 있다면 계좌부터 조회해 보세요.'));
  else {
    const ul = el('ul', 'ev');
    for (const it of items) {
      const li = el('li', it.level === 'high' ? 'ai' : it.level === 'mid' ? 'warn' : ''), d = el('div');
      const h = el('p', null, it.title); h.style.fontWeight = '600';
      d.append(h, el('p', 'reason', (it.key === 'card_mismatch' ? '카드: ' : '발견한 표현: ') + it.evidence.join(' / ')), el('p', 'note', EXPLAIN[it.key]));
      li.appendChild(d); ul.appendChild(li);
    }
    sec.appendChild(ul);
  }
  const anchor = out.querySelector('section.danger') || out.querySelector('section');
  if (anchor?.nextSibling) out.insertBefore(sec, anchor.nextSibling); else out.appendChild(sec);
}

window.addEventListener('tc:analysis', () => setTimeout(render, 120));
if (window.__tcLast && out?.children.length) setTimeout(render, 300);
