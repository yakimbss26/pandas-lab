/* check_licensing.js — 배포 산출물에 원본 데이터·자격증명이 섞여 있는지 검사
 *
 * 플레이북 §10-3 이 "가장 놓치기 쉽다" 고 지목한 검사다.
 * `수업자료/` 를 .gitignore 로 제외해도 data.js 와 단일 파일 배포본에 값이 박혀 있으면 재배포가 된다.
 *
 *   node webapp/test/check_licensing.js
 *
 * ★ 공개 저장소를 만들기 전에 반드시 통과시킨다.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');

/* ★ 검사 기준을 두 층으로 나눈다. 무엇이 문제인지가 다르기 때문이다.
 *
 * 문제의 본질은 §10-2 의 "데이터셋 재배포" 다. 891행을 파일에 담아 배포하는 것은 재배포이고,
 * 교재 본문에서 `head()` 출력 5줄을 인용하는 것은 재배포가 아니다(설명을 위한 소량 인용).
 *
 *   STRICT   data.js · 단일 파일 배포본 — 데이터셋 자체를 담는 파일.
 *            원본 값이 한 건이라도 있으면 실패. 합성 데이터로 대체했어야 한다.
 *
 *   EXCERPT  pandas.md · README — 설명 문서.
 *            소량 인용은 허용한다. 대신 (a) 자격증명은 절대 금지,
 *            (b) 인용량이 예산을 넘으면 실패(사실상 데이터셋을 옮겨 적은 셈이 된다).
 *
 * 교재가 실제 출력을 실어야 하는 이유가 있다: 학생이 자기 `train.csv` 로 따라 실행했을 때
 * 교재의 출력과 같아야 한다. 합성 값을 실으면 교재가 학생의 화면과 어긋난다.
 */
var STRICT_TARGETS = [
  'webapp/src/core/data.js',
  'pandas-lab.html',
  'index.html'
];

var EXCERPT_TARGETS = [
  'pandas.md',
  'README.md'
];

/* 인자로 파일을 주면 그것들을 설명 문서로 검사한다.
 * pandas.md 로 합치기 전에 초고를 미리 검사할 때 쓴다:
 *   node webapp/test/check_licensing.js docs/draft/part1-intro-loading.md … */
var argFiles = process.argv.slice(2).filter(function (a) { return a.indexOf('--') !== 0; });
if (argFiles.length) EXCERPT_TARGETS = argFiles.map(function (a) { return a.replace(/\\/g, '/'); });

/* 교재의 인용량 기준.
 *
 * 처음에 40건으로 잡았는데 그건 근거 없는 숫자였다. 실제로 막아야 하는 것은
 * **"표 전체를 출력해 버리는 것"** 이다. 그래서 두 가지로 바꿨다.
 *
 *   ① 원본 값 등장 횟수 예산 — 타이타닉은 891행이다. 같은 head(5) 를 여러 장에서
 *      반복 인용하는 것은 재배포가 아니므로 넉넉히 두되, 데이터셋을 옮겨 적는 수준
 *      (수백 건)은 잡아낸다.
 *   ② 큰 출력 블록 금지 — 한 코드 블록의 출력이 이 줄 수를 넘으면 실패.
 *      `print(df)` 로 891행을 쏟아 놓는 것이 진짜 재배포다. 이 검사가 본체다.
 */
var EXCERPT_BUDGET = 150;
var MAX_OUTPUT_LINES = 40;

/* 하나라도 나오면 실패. 원본에만 있는 특징적인 값들이다. */
var FORBIDDEN = [
  // 타이타닉 (Kaggle 대회 데이터)
  { s: 'Braund', why: '타이타닉 승객 이름' },
  { s: 'Heikkinen', why: '타이타닉 승객 이름' },
  { s: 'Cumings', why: '타이타닉 승객 이름' },
  { s: 'Futrelle', why: '타이타닉 승객 이름' },
  { s: 'Montvila', why: '타이타닉 승객 이름' },
  { s: 'A/5 21171', why: '타이타닉 티켓 번호' },
  { s: 'STON/O2.', why: '타이타닉 티켓 번호' },
  // 라멘 (Kaggle 재업로드)
  { s: 'New Touch', why: '라멘 브랜드명' },
  { s: 'Kamfen', why: '라멘 브랜드명' },
  { s: 'Wei Lih', why: '라멘 브랜드명' },
  { s: 'Nissin', why: '라멘 브랜드명' },
  { s: "Ching's Secret", why: '라멘 브랜드명' },
  { s: 'MyKuali', why: '라멘 브랜드명' },
  // 출판 교재 예제
  { s: 'Chulmin', why: '출판 교재의 예제 이름' },
  { s: 'Eunkyung', why: '출판 교재의 예제 이름' },
  { s: 'Jinwoong', why: '출판 교재의 예제 이름' },
  { s: 'Soobeom', why: '출판 교재의 예제 이름' },
  // 실존 인물 (원본 예제)
  { s: '흥민', why: '원본 예제의 실존 인물' },
  { s: '현진', why: '원본 예제의 실존 인물' },
  { s: 'Tottenham', why: '원본 예제의 실존 구단' }
];

/* ★ 자격증명 — 어느 파일에서든 한 건이라도 나오면 실패. 예산도 예외도 없다. */
var SECRETS = [
  { s: 'youngakim', why: '★ Kaggle 사용자명' },
  { s: 'f04ca881', why: '★ Kaggle API 키' },
  { s: 'kaggle.json', why: '★ 자격증명 파일 이름' },
  { s: 'files.upload()', why: '★ 자격증명을 출력에 남긴 셀의 흔적' }
];

/* 나와도 되는 것 — 이유를 반드시 적는다. 이유 없이 여기 추가하지 마라. */
var ALLOWED = [
  {
    s: 'Unrated',
    why: '라멘 데이터의 범주 이름. 교재 9장이 "숫자가 아닌 값이 섞인 컬럼" 을 가르치는 데 이 값이 필요하다. ' +
      '개별 데이터가 아니라 범주 어휘(스키마 요소)이므로 재배포에 해당하지 않는다. 합성 데이터에 의도적으로 3건 넣었다.'
  },
  {
    s: 'USA',
    why: '라멘 데이터에 USA(323건)와 United States(1건)가 공존하는 데이터 품질 문제를 교재가 가르친다. ' +
      '국가명은 사실이며 저작 대상이 아니다.'
  },
  {
    s: 'earthquake',
    why: 'USGS 지진 데이터는 미국 정부 저작물 = 퍼블릭 도메인. 실데이터를 그대로 쓴다.'
  }
];

// ─────────────────────────────────────────────────────────────

function countIn(text, needle) {
  var n = 0, i = 0;
  while ((i = text.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

function loadAll(list) {
  var out = [], missing = [];
  list.forEach(function (rel) {
    var p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) { missing.push(rel); return; }
    out.push({ rel: rel, text: fs.readFileSync(p, 'utf8') });
  });
  return { files: out, missing: missing };
}

var failures = [];
var strict = loadAll(STRICT_TARGETS);
var excerpt = loadAll(EXCERPT_TARGETS);

console.log('');
console.log('배포 산출물 저작권·비밀 검사');
console.log('');

if (!strict.files.length && !excerpt.files.length) {
  console.log('  ! 검사할 파일이 하나도 없다. 먼저 `npm run build` 를 돌려라.');
  process.exit(1);
}

// ── 1. 자격증명 — 모든 파일, 예외 없음
console.log('  [1] 자격증명 (모든 파일, 예외 없음)');
var allFiles = strict.files.concat(excerpt.files);
var secretHit = false;
SECRETS.forEach(function (item) {
  allFiles.forEach(function (f) {
    var c = countIn(f.text, item.s);
    if (c > 0) {
      secretHit = true;
      failures.push('자격증명 ' + item.s + ' -> ' + f.rel + ' × ' + c);
      console.log('      [FAIL] ' + JSON.stringify(item.s) + ' -> ' + f.rel + ' × ' + c + '  ' + item.why);
    }
  });
});
if (!secretHit) console.log('      [PASS] ' + SECRETS.length + '개 항목 전부 0건');

// ── 2. STRICT — 데이터셋을 담는 파일. 원본 값 0건이어야 한다
console.log('');
console.log('  [2] 데이터 파일 — 원본 값 0건이어야 한다');
strict.files.forEach(function (f) {
  console.log('      대상: ' + f.rel + '  (' + f.text.length.toLocaleString() + ' bytes)');
});
if (strict.missing.length) console.log('      (없어서 건너뜀: ' + strict.missing.join(', ') + ')');
var strictHit = false;
FORBIDDEN.forEach(function (item) {
  strict.files.forEach(function (f) {
    var c = countIn(f.text, item.s);
    if (c > 0) {
      strictHit = true;
      failures.push('원본 값 ' + item.s + ' -> ' + f.rel + ' × ' + c);
      console.log('      [FAIL] ' + JSON.stringify(item.s) + ' -> ' + f.rel + ' × ' + c + '  ' + item.why);
    }
  });
});
if (!strictHit) console.log('      [PASS] 금지 문자열 ' + FORBIDDEN.length + '개 전부 0건');

// ── 3. EXCERPT — 설명 문서. 소량 인용은 허용, 인용량 예산은 지킨다
console.log('');
console.log('  [3] 설명 문서 — 소량 인용 허용, 인용량 예산 ' + EXCERPT_BUDGET + '건');
if (!excerpt.files.length) {
  console.log('      (아직 없다: ' + excerpt.missing.join(', ') + ')');
} else {
  excerpt.files.forEach(function (f) {
    var total = 0, detail = [];
    FORBIDDEN.forEach(function (item) {
      var c = countIn(f.text, item.s);
      if (c > 0) { total += c; detail.push(item.s + '×' + c); }
    });
    var over = total > EXCERPT_BUDGET;
    console.log('      ' + (over ? '[FAIL] ' : '[PASS] ') + f.rel + ' — 원본 값 인용 ' +
      total + '건 / 예산 ' + EXCERPT_BUDGET);
    if (detail.length) console.log('             ' + detail.join(', '));
    if (over) {
      failures.push(f.rel + ' 의 원본 값 인용 ' + total + '건 (예산 ' + EXCERPT_BUDGET + ')');
      console.log('             예산을 넘었다. head()/tail() 예제를 줄이거나 작은 예제로 바꿔라.');
    }

    // ② 큰 출력 블록 — 표 전체를 쏟아 놓은 곳을 잡는다. 이게 본체 검사다.
    var big = [];
    var fence = /```(?:text|python)?\n([\s\S]*?)```/g, m, idx = 0;
    while ((m = fence.exec(f.text)) !== null) {
      idx++;
      var lines = m[1].split('\n').filter(function (l) { return l.trim() !== ''; });
      if (lines.length > MAX_OUTPUT_LINES) big.push('블록 #' + idx + ' (' + lines.length + '줄)');
    }
    if (big.length) {
      failures.push(f.rel + ' 에 ' + MAX_OUTPUT_LINES + '줄을 넘는 블록: ' + big.join(', '));
      console.log('      [FAIL] ' + f.rel + ' — ' + MAX_OUTPUT_LINES + '줄 초과 블록 ' +
        big.length + '개: ' + big.join(', '));
      console.log('             표 전체를 출력한 곳이 있다. head()/tail() 로 줄여라.');
    } else {
      console.log('      [PASS] ' + f.rel + ' — ' + MAX_OUTPUT_LINES + '줄 초과 블록 없음');
    }
  });
}

// ── 4. 허용 목록
console.log('');
console.log('  [4] 허용 목록 (이유가 기록된 것만)');
ALLOWED.forEach(function (item) {
  var total = allFiles.reduce(function (a, f) { return a + countIn(f.text, item.s); }, 0);
  console.log('      · ' + JSON.stringify(item.s) + ' × ' + total);
  console.log('        ' + item.why);
});

console.log('');
if (failures.length) {
  console.log('  ==> 실패 ' + failures.length + '건. 공개 저장소를 만들기 전에 처리하라.');
  process.exit(1);
}
console.log('  ==> 통과.');
process.exit(0);
