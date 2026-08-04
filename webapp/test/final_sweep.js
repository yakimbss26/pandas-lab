/* 공개 전 전수 검사 — 커밋될 **모든** 파일을 훑는다.
 * check_licensing.js 는 배포 산출물 몇 개만 본다. 이건 저장소 전체다.
 * 특히 자격증명은 어느 파일에서든 한 건이라도 나오면 배포를 멈춘다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP_DIRS = new Set(['수업자료', 'node_modules', '.git']);
const SKIP_REL = new Set([path.join('docs', 'draft')]);

/* 금지어 목록 자체를 담고 있는 파일들. 검사 대상에서 뺀다. */
const SELF = new Set([
  path.join('webapp', 'test', 'final_sweep.js'),
  path.join('webapp', 'test', 'check_licensing.js'),
]);

/* 어느 파일에서든 나오면 실패 */
const SECRETS = [
  ['youngakim', 'Kaggle 사용자명'],
  ['f04ca881', 'Kaggle API 키 앞부분'],
  ['kaggle.json', '자격증명 파일 이름'],
  ['"key":"', 'API 키 형태'],
  ['gho_', 'GitHub 토큰 형태'],
  ['ghp_', 'GitHub 토큰 형태'],
];

/* 데이터 파일·배포본에서 나오면 실패. 교재(pandas.md)는 소량 인용을 허용한다. */
const DATA_VALUES = [
  'Braund', 'Heikkinen', 'Cumings', 'Futrelle', 'Montvila', 'A/5 21171',
  'New Touch', 'Kamfen', 'Wei Lih', 'Nissin', "Ching's Secret", 'MyKuali',
  'Chulmin', 'Eunkyung', 'Jinwoong', 'Soobeom',
  '흥민', '현진', '강인', 'Tottenham', 'Valencia',
];
const EXCERPT_OK = new Set(['pandas.md', path.join('docs', '정정표.md'),
  path.join('docs', '정답표.md'), path.join('docs', '정답표.json'),
  path.join('docs', '수업자료-인벤토리.md'), path.join('docs', '정정표-실행기록.md'),
  path.join('docs', '집필규칙.md'), 'CLAUDE.md', 'README.md',
  path.join('webapp', 'test', 'check_licensing.js')]);

const BINARY = /\.(png|jpg|jpeg|gif|ico|zip|pdf|pickle|pkl)$/i;

function walk(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || SKIP_REL.has(r)) continue;
      out.push(...walk(path.join(dir, e.name), r));
    } else if (!BINARY.test(e.name)) {
      out.push(r);
    }
  }
  return out;
}

const files = walk(ROOT);
const secretHits = [];
const dataHits = [];
let bytes = 0;

for (const rel of files) {
  if (SELF.has(rel)) continue;             // 금지어 목록 자체를 담은 파일
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  bytes += text.length;
  for (const [s, why] of SECRETS) {
    let n = 0, i = 0;
    while ((i = text.indexOf(s, i)) !== -1) { n++; i += s.length; }
    if (n > 0) secretHits.push({ rel, s, why, n });
  }
  if (EXCERPT_OK.has(rel)) continue;
  for (const s of DATA_VALUES) {
    let n = 0, i = 0;
    while ((i = text.indexOf(s, i)) !== -1) { n++; i += s.length; }
    if (n > 0) dataHits.push({ rel, s, n });
  }
}

console.log('');
console.log('공개 전 전수 검사');
console.log('  검사 파일 ' + files.length + '개, ' + (bytes / 1024).toFixed(0) + ' KB');
console.log('  (제외: 수업자료/ · docs/draft/ · node_modules/ · .git/)');
console.log('');

if (secretHits.length) {
  console.log('  [FAIL] 자격증명 ' + secretHits.length + '건');
  secretHits.forEach(h => console.log('     ' + h.rel + '  "' + h.s + '" × ' + h.n + '  (' + h.why + ')'));
} else {
  console.log('  [PASS] 자격증명 0건 (' + SECRETS.length + '개 패턴)');
}

if (dataHits.length) {
  console.log('  [FAIL] 원본 데이터 값 ' + dataHits.length + '건');
  dataHits.forEach(h => console.log('     ' + h.rel + '  "' + h.s + '" × ' + h.n));
} else {
  console.log('  [PASS] 원본 데이터 값 0건 (교재·문서 제외, ' + DATA_VALUES.length + '개 문자열)');
}

console.log('');
const bad = secretHits.length + dataHits.length;
if (bad) {
  console.log('  ==> 실패 ' + bad + '건. 배포를 멈춘다.');
  process.exit(1);
}
console.log('  ==> 통과. 공개해도 된다.');
