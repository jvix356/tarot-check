// cards/ 폴더에 올린 일러스트를 정리해요.
// - 파일 이름: major-00.png 처럼 규칙 이름이거나, "바보.png" "컵 에이스.png" 처럼 카드 이름이면 돼요.
// - 480x720(2:3) WebP로 줄여 cards/<규칙이름>.webp 로 저장하고 원본은 지워요.
// - cards/manifest.json 을 다시 만들어요. 사이트는 이 목록에 있는 카드만 일러스트로 보여주고 나머지는 기본 도안을 써요.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'cards');
const g = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'cards.js'), 'utf8'))(g);
const T = g.TarotCards;
const VALID = new Set(T.names().map(T.slug));
const IMG = /\.(png|jpe?g|webp)$/i;

function slugFor(file) {
  const base = file.replace(IMG, '').normalize('NFC').trim();
  if (VALID.has(base.toLowerCase())) return base.toLowerCase();
  const s = T.slug(base.replace(/[_]+/g, ' '));
  return VALID.has(s) ? s : '';
}

fs.mkdirSync(DIR, { recursive: true });
const skipped = [];
for (const f of fs.readdirSync(DIR)) {
  if (!IMG.test(f)) continue;
  const slug = slugFor(f);
  if (!slug) { skipped.push(f); continue; }
  const out = slug + '.webp';
  if (f === out) continue;
  const src = path.join(DIR, f);
  await sharp(src).rotate().resize(480, 720, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).toFile(path.join(DIR, out + '.tmp'));
  fs.renameSync(path.join(DIR, out + '.tmp'), path.join(DIR, out));
  fs.unlinkSync(src);
  console.log(`${f} -> ${out}`);
}
const files = {};
for (const f of fs.readdirSync(DIR).sort()) {
  const m = f.match(/^([a-z]+-\d{2})\.webp$/);
  if (m && VALID.has(m[1])) files[m[1]] = f;
}
fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`일러스트 ${Object.keys(files).length}/78장 등록`);
if (skipped.length) console.log('이름을 알아볼 수 없어 건너뛴 파일:', skipped.join(', '));
