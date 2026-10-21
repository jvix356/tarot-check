// Pretendard(SIL OFL 1.1) 자체 호스팅 파일 만들기
// 사용: node scripts/build-fonts.mjs <pretendard 패키지 폴더> <라이선스 파일>
import fs from 'node:fs';
import path from 'node:path';

const pkg = process.argv[2];
const license = process.argv[3];
const WEIGHTS = { 400: 'Regular', 600: 'SemiBold', 700: 'Bold' };
const src = path.join(pkg, 'dist/web/static');
const out = 'fonts/pretendard';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'woff2'), { recursive: true });

const css = fs.readFileSync(path.join(src, 'pretendard-dynamic-subset.css'), 'utf8');
const blocks = css.split('@font-face').slice(1).map(b => '@font-face' + b.slice(0, b.indexOf('}') + 1));
let kept = [];
for (const b of blocks) {
  const w = (b.match(/font-weight:\s*(\d+)/) || [])[1];
  if (!WEIGHTS[w]) continue;
  const file = (b.match(/woff2-dynamic-subset\/([^)]+\.woff2)/) || [])[1];
  if (!file) continue;
  fs.copyFileSync(path.join(src, 'woff2-dynamic-subset', file), path.join(out, 'woff2', file));
  kept.push(b.replace(/src:[^;]+;/, `src: url(./woff2/${file}) format('woff2');`));
}
const header = `/* Pretendard v1.3.9 · Copyright (c) 2021 Kil Hyung-jin, with Reserved Font Name Pretendard.\n   SIL Open Font License 1.1 · https://github.com/orioncactus/pretendard · 라이선스 전문: ./LICENSE.txt */\n`;
fs.writeFileSync(path.join(out, 'pretendard.css'), header + kept.join('\n') + '\n');
fs.copyFileSync(license, path.join(out, 'LICENSE.txt'));
console.log('font-face blocks:', kept.length, 'files:', fs.readdirSync(path.join(out, 'woff2')).length);
