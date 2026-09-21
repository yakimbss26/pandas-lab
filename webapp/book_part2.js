/* book_part2.js — 교재 2부(데이터 시각화)를 pandas.md 에 끼워 넣는다.
 *
 *   node webapp/book_part2.js            docs/draft/v*.md  ->  pandas.md 의 2부 자리
 *   node webapp/book_part2.js --check    바꾸지 않고 무엇이 바뀔지만 본다
 *   node webapp/book_part2.js --force    이미 들어 있는 2부가 초고와 달라도 덮어쓴다
 *
 * ★ 왜 build_book.js 로 다시 합치지 않는가
 *   pandas.md 가 정본이다(docs/draft/CLAUDE.md). 1부는 합본 뒤 verify_md.py --fix 로 고친 출력이
 *   pandas.md 에만 있어서, 초고에서 다시 합치면 그 수정이 사라진다. 그래서 2부는 표지 사이에만 넣는다.
 *
 * 하는 일
 *   1. `<!-- 2부 시작 -->` ~ `<!-- 2부 끝 -->` 사이를 초고로 채운다 (없으면 `## 부록` 바로 앞에 만든다)
 *   2. 1장 앞에 `## 1부. pandas` 표지를 한 번만 넣는다
 *   3. 목차를 다시 만든다 (본문 제목을 읽어서. build_book.js 와 같은 규칙)
 *   4. 0.1 버전 표에 matplotlib · seaborn, 0.2 데이터 표에 2부 파일 넷을 더한다 (없을 때만)
 *   5. 부록 끝의 버전 표 앞에 2부 정정 절(docs/draft/v-appendix.md)을 넣는다
 *      (`<!-- 2부 부록 시작 -->` ~ `<!-- 2부 부록 끝 -->`). 부록 버전 표의 seaborn 행도 고친다.
 *   6. 1부 연습 문제(docs/draft/drill-questions.md)를 2부 표지 앞에, 정답(drill-answers.md)을 책 맨 끝에 넣는다
 *      둘 다 docs/scripts/make_titanic_drill.py 가 원본·합성본에서 실제로 풀어 만든다
 *
 * 끼워 넣은 뒤에는 반드시:
 *   python -X utf8 webapp/test/verify_md.py                (0 실패 확인)
 *   node webapp/test/check_licensing.js
 *
 * ★ 2부는 초고가 정본이다(1부와 반대). 출력·그림은 초고에서 확정한다:
 *   python -X utf8 webapp/test/verify_md.py docs/draft/<초고> --fix --figs
 * 그다음 이 스크립트로 넣는다. pandas.md 에 --fix 를 걸어 2부를 고치지 마라 — 다음 삽입 때 사라진다.
 * 초고를 고친 뒤 다시 넣을 때는 --force (pandas.md 의 2부가 초고와 달라졌으므로).
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var DRAFT = path.join(ROOT, 'docs', 'draft');
var BOOK = path.join(ROOT, 'pandas.md');

var PARTS = [
  'v1-v2-strdate-reshape.md',
  'v3-v4-matplotlib-seaborn.md',
  'v5-v6-honest-eda.md'
];

var BEGIN = '<!-- 2부 시작 -->';
var END = '<!-- 2부 끝 -->';
var PART1_MARK = '<!-- 1부 표지 -->';
var APPX = 'v-appendix.md';
var APPX_BEGIN = '<!-- 2부 부록 시작 -->';
var APPX_END = '<!-- 2부 부록 끝 -->';
var APPX_BEFORE = /^### 이 교재를 만들 때 쓴 버전/m;

/* 1부 연습 문제 "타이타닉 데이터 다루기" — docs/scripts/make_titanic_drill.py 가 만든다(숫자는 실행 결과).
 * 문제는 1부 끝(2부 표지 바로 앞), 정답은 책 맨 끝. 초고가 없으면 건너뛴다. */
var DRILL_Q = 'drill-questions.md', DRILL_A = 'drill-answers.md';
var DQ_BEGIN = '<!-- 연습 문제 시작 -->', DQ_END = '<!-- 연습 문제 끝 -->';
var DA_BEGIN = '<!-- 연습 정답 시작 -->', DA_END = '<!-- 연습 정답 끝 -->';

/* begin~end 사이를 text 로 바꾼다. 없으면 at(book) 이 돌려준 자리에 새로 넣는다. */
function putBetween(book, begin, end, text, at) {
  var block = [begin, text, end].join('\n');
  var b = book.indexOf(begin), e = book.indexOf(end);
  if (b >= 0 && e > b) return book.slice(0, b) + block + book.slice(e + end.length);
  var pos = at(book);
  return book.slice(0, pos) + block + '\n\n---\n\n' + book.slice(pos);
}

var PART1_COVER = [
  PART1_MARK,
  '## 1부. pandas',
  '',
  '표를 읽고, 고르고, 고치고, 묶고, 합친다. 1장부터 14장까지다.',
  '',
  '---',
  ''
].join('\n');

var PART2_COVER = [
  '## 2부. 데이터 시각화',
  '',
  '1부에서 표를 다루는 법을 익혔다. 2부에서는 그 표를 **그림으로** 읽는다.',
  '',
  '순서가 있다. 받아 온 파일은 대개 그대로는 그릴 수 없다 — 날짜가 글자로 들어 있고, 숫자에 쉼표가',
  '박혀 있고, 표가 옆으로 310칸이나 늘어서 있다. 그래서 V1·V2 에서 **그릴 수 있는 표**를 먼저 만들고,',
  'V3·V4 에서 그리고, V5 에서 그림을 **의심하는 법**을 익히고, V6 에서 처음부터 끝까지 혼자 해 본다.',
  '',
  '| 장 | 제목 | 쓰는 데이터 |',
  '|:--|:---|:---|',
  '| V1 | 문자열과 날짜 | 서울 일별 기온 |',
  '| V2 | 넓은 표와 긴 표 | 시도별 인구 · 서울 기온 |',
  '| V3 | matplotlib — 그림의 구조 | 작은 리스트 · 서울 연별 기온 |',
  '| V4 | seaborn — 요약해서 그리기 | 서울 일별 기온 |',
  '| V5 | 그래프가 거짓말할 때 | 서울 기온 · 인구 |',
  '| V6 | EDA 실습 — 부산 강수량 118년 | 부산 일별 강수량 |',
  '',
  '> 2부의 데이터는 **실제 관측값**이다. 서울·부산 자료는 기상청 기상자료개방포털(공공누리 제1유형),',
  '> 인구 자료는 행정안전부 주민등록 인구통계에서 받았다. 1부의 타이타닉·라면·전복과 달리',
  '> 합성하지 않았다.',
  ''
].join('\n');

var VERSION_ROWS = [
  '| matplotlib | 3.11.1 |',
  '| seaborn | 0.13.2 |'
];

var DATA_ROWS = [
  '| `seoul_temp_day.csv` | 서울 일별 기온 (기상청) — 2부 | 42,397행 × 5열 |',
  '| `busan_rain_day.csv` | 부산 일별 강수량 (기상청) — 2부 | 43,100행 × 3열 |',
  '| `seoul_temp.csv` | 서울 연별 기온 (기상청) — 2부 | 112행 × 5열 |',
  '| `korea_pop.csv` | 시도별 연령별 인구 (행정안전부) — 2부 | 18행 × 310열 |',
  '| `titanic-synthetic.csv` | 타이타닉 합성본 — `train.csv` 가 없을 때 연습 문제용. 사이트 `data/` 에서 받는다 | 891행 × 12열 |'
];

function readParts() {
  var missing = PARTS.filter(function (f) { return !fs.existsSync(path.join(DRAFT, f)); });
  if (missing.length) {
    console.log('! 없는 초고: ' + missing.join(', '));
    console.log('  2부는 V1~V6 이 모두 있어야 넣는다(목차와 장 번호가 맞아야 한다).');
    process.exit(1);
  }
  return PARTS.map(function (f) {
    return fs.readFileSync(path.join(DRAFT, f), 'utf8').replace(/\r\n/g, '\n').trim();
  });
}

/* 목차 — build_book.js 의 buildToc 와 같은 규칙. 본문(목차 뒤)의 제목만 읽는다. */
function headingsOf(text) {
  var out = [];
  var inFence = false;
  text.split('\n').forEach(function (line) {
    if (/^```/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    var m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (m) out.push({ level: m[1].length, title: m[2].trim() });
  });
  return out;
}
function buildToc(sections) {
  var lines = ['## 목차', ''];
  sections.forEach(function (s) {
    if (s.level === 2) lines.push('- **' + s.title + '**');
    else if (s.level === 3 && !/^확인 문제|^🧪/.test(s.title)) lines.push('  - ' + s.title);
  });
  lines.push('', '---', '');
  return lines.join('\n');
}

function addRowsAfterTable(text, headerRe, rows) {
  /* headerRe 로 찾은 표의 마지막 행 뒤에, 아직 없는 행만 더한다 */
  var lines = text.split('\n');
  var h = lines.findIndex(function (l) { return headerRe.test(l); });
  if (h < 0) return { text: text, added: 0 };
  var k = h + 2;                                   // 헤더, 구분선 다음부터
  while (k < lines.length && /^\|/.test(lines[k])) k++;
  var existing = lines.slice(h, k).join('\n');
  var fresh = rows.filter(function (r) { return existing.indexOf(r.split('|')[1].trim()) < 0; });
  if (!fresh.length) return { text: text, added: 0 };
  lines.splice.apply(lines, [k, 0].concat(fresh));
  return { text: lines.join('\n'), added: fresh.length };
}

function main() {
  var CHECK = process.argv.indexOf('--check') >= 0;
  var FORCE = process.argv.indexOf('--force') >= 0;

  var book = fs.readFileSync(BOOK, 'utf8').replace(/\r\n/g, '\n');
  var parts = readParts();
  var block = [BEGIN, PART2_COVER, '---', '', parts.join('\n\n---\n\n'), '', END].join('\n');

  // ── 1. 2부 자리
  var b = book.indexOf(BEGIN), e = book.indexOf(END);
  if (b >= 0 && e > b) {
    var current = book.slice(b, e + END.length);
    if (current === block) {
      console.log('2부: 초고와 같다 — 바꿀 것 없음');
    } else if (!FORCE) {
      console.log('! pandas.md 의 2부가 초고와 다르다.');
      console.log('  verify_md.py --fix 로 고친 출력이 pandas.md 에만 있을 수 있다.');
      console.log('  초고로 덮어쓰려면 --force. 덮어쓴 뒤 --fix --figs 를 다시 돌린다.');
      process.exit(1);
    }
    book = book.slice(0, b) + block + book.slice(e + END.length);
  } else {
    var at = book.search(/^## 부록/m);
    if (at < 0) { console.log('! `## 부록` 을 찾지 못했다 — 넣을 자리를 모른다.'); process.exit(1); }
    book = book.slice(0, at) + block + '\n\n---\n\n' + book.slice(at);
  }

  // ── 2. 1부 표지
  if (book.indexOf(PART1_MARK) < 0) {
    var ch1 = book.search(/^## 1장\./m);
    if (ch1 < 0) { console.log('! `## 1장.` 을 찾지 못했다.'); process.exit(1); }
    book = book.slice(0, ch1) + PART1_COVER + '\n' + book.slice(ch1);
  }

  // ── 2-1. 부록의 2부 절 (목차보다 먼저 넣어야 목차에 잡힌다) + 부록 버전 표
  var appx = fs.readFileSync(path.join(DRAFT, APPX), 'utf8').replace(/\r\n/g, '\n').trim();
  var appxBlock = [APPX_BEGIN, appx, APPX_END, ''].join('\n');
  var ab = book.indexOf(APPX_BEGIN), ae = book.indexOf(APPX_END);
  if (ab >= 0 && ae > ab) {
    book = book.slice(0, ab) + appxBlock + book.slice(ae + APPX_END.length).replace(/^\n+/, '\n');
  } else {
    var ap = book.search(APPX_BEFORE);
    if (ap < 0) { console.log('! 부록의 버전 표 제목을 찾지 못했다.'); process.exit(1); }
    book = book.slice(0, ap) + appxBlock + '\n' + book.slice(ap);
  }
  book = book.replace('| seaborn | 설치되어 있지 않음 |', '| seaborn | 0.13.2 (2부) |');

  // ── 2-2. 1부 연습 문제(2부 표지 앞)와 그 정답(책 맨 끝)
  if (fs.existsSync(path.join(DRAFT, DRILL_Q)) && fs.existsSync(path.join(DRAFT, DRILL_A))) {
    var dq = fs.readFileSync(path.join(DRAFT, DRILL_Q), 'utf8').replace(/\r\n/g, '\n').trim();
    var da = fs.readFileSync(path.join(DRAFT, DRILL_A), 'utf8').replace(/\r\n/g, '\n').trim();
    book = putBetween(book, DQ_BEGIN, DQ_END, dq, function (bk) { return bk.indexOf(BEGIN); });
    if (book.indexOf(DA_BEGIN) < 0) {
      book = book.replace(/\s*$/, '') + '\n\n---\n\n' + [DA_BEGIN, da, DA_END].join('\n') + '\n';
    } else {
      book = putBetween(book, DA_BEGIN, DA_END, da, null);
    }
    console.log('  연습 문제: 1부 끝에 문제, 책 끝에 정답');
  }

  // ── 3. 목차
  var t0 = book.indexOf('## 목차');
  var t1 = book.indexOf('\n---\n', t0);
  if (t0 < 0 || t1 < 0) { console.log('! 목차 자리를 찾지 못했다.'); process.exit(1); }
  var after = book.slice(t1 + 5);
  book = book.slice(0, t0) + buildToc(headingsOf(after)) + after.replace(/^\n+/, '');

  // ── 4. 0장 표
  var v = addRowsAfterTable(book, /^\|\s*\|\s*버전\s*\|/, VERSION_ROWS);
  book = v.text;
  var d = addRowsAfterTable(book, /^\|\s*파일\s*\|\s*내용\s*\|\s*크기\s*\|/, DATA_ROWS);
  book = d.text;

  var stats = parts.map(function (p, i) {
    return PARTS[i].padEnd(34) + String(p.split('\n').length).padStart(5) + '줄  코드블록 ' +
      String((p.match(/^```python$/gm) || []).length).padStart(3) + '개  그림 ' +
      String((p.match(/^#\s*그림:/gm) || []).length).padStart(3) + '개';
  });
  console.log('2부 끼워 넣기' + (CHECK ? ' (--check: 쓰지 않음)' : ''));
  stats.forEach(function (s) { console.log('  ' + s); });
  console.log('  0.1 버전 표 +' + v.added + '행, 0.2 데이터 표 +' + d.added + '행');
  console.log('  -> pandas.md ' + book.split('\n').length + '줄, ' + (book.length / 1024).toFixed(0) + ' KB');

  if (!CHECK) {
    fs.writeFileSync(BOOK, book, 'utf8');
    console.log('');
    console.log('다음:');
    console.log('  python -X utf8 webapp/test/verify_md.py --fix --figs');
    console.log('  python -X utf8 webapp/test/verify_md.py');
    console.log('  node webapp/test/check_licensing.js');
  }
}

main();
