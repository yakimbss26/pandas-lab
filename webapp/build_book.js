/* build_book.js — 교재 파트 초고를 pandas.md 하나로 합친다.
 *
 *   node webapp/build_book.js          docs/draft/part*.md  ->  pandas.md
 *   npm run book
 *
 * 합칠 때 붙이는 것:
 *   · 문서 제목과 머리말
 *   · **표시 설정 절** — 파트마다 표 출력 폭 가정이 달라 검증이 어긋났다.
 *     교재가 설정을 명시하고, verify_md.py 가 같은 설정으로 검증한다.
 *   · 목차 (파트 파일의 `## N장.` / `### N.M` 을 읽어 만든다)
 *
 * 합친 뒤에는 반드시:
 *   python -X utf8 webapp/test/verify_md.py            (전체 코드 블록 실행)
 *   node webapp/test/check_licensing.js                (저작권·비밀)
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var DRAFT = path.join(ROOT, 'docs', 'draft');
var OUT = path.join(ROOT, 'pandas.md');

var PART_ORDER = [
  'part1-intro-loading.md',
  'part2-series-dataframe.md',
  'part3-loc-iloc.md',
  'part4-alignment-copy.md',
  'part5-missing-dtype.md',
  'part6-agg-groupby.md',
  'part7-merge-notebook.md',
  'part8-project-ml.md'
];

/* ★ 표시 설정 — 이 값이 교재의 모든 표 출력 기준이다.
 * verify_md.py 는 pandas 기본값으로 시작하므로, 교재 본문의 이 코드 블록이
 * 실행되면서 설정이 적용된다. 즉 학생이 따라 실행한 것과 검증이 같은 조건이 된다.
 * 값을 바꾸면 `verify_md.py --fix` 로 모든 출력을 다시 생성해야 한다. */
var DISPLAY_SETUP = [
  '```python',
  'import pandas as pd',
  '',
  "pd.set_option('display.max_columns', 30)   # 컬럼을 ... 로 줄이지 않는다",
  "pd.set_option('display.width', 200)        # 한 줄에 넓게 펼친다",
  "pd.set_option('display.max_colwidth', 40)  # 긴 문자열은 40자에서 줄인다",
  '```'
].join('\n');

// ─────────────────────────────────────────────── 머리말

function preamble() {
  return [
    '# pandas — 표로 생각하기',
    '',
    '> 데이터 분석 라이브러리 pandas 를 처음부터 익히는 교재다.',
    '> 파이썬 기본 문법과 넘파이를 한 번 본 사람을 대상으로 한다.',
    '',
    '---',
    '',
    '## 0장. 이 교재를 읽는 방법',
    '',
    '### 0.1 무엇이 필요한가',
    '',
    '파이썬과 pandas 가 설치된 환경이면 된다. Jupyter Notebook 이나 Google Colab 을 쓰면 가장 편하다.',
    '',
    '이 교재의 모든 코드는 아래 버전에서 **실제로 실행해 출력을 확인한 것**이다.',
    '',
    '| | 버전 |',
    '|:---|:---|',
    '| pandas | 3.0.5 |',
    '| numpy | 2.5.1 |',
    '| python | 3.13.12 |',
    '',
    'pandas 는 2.x 에서 3.0 으로 넘어오며 동작이 여럿 바뀌었다. 인터넷에서 찾은 옛 코드가',
    '이 교재와 다르게 동작하면 **부록**을 먼저 보라. 바뀐 것들을 표로 정리해 두었다.',
    '',
    '### 0.2 실습 데이터',
    '',
    '교재는 다음 파일을 쓴다. 코드는 파일이 **현재 폴더에 있다고** 가정한다.',
    '',
    '| 파일 | 내용 | 크기 |',
    '|:---|:---|:---|',
    '| `train.csv` | 타이타닉 승객 명단 | 891행 × 12열 |',
    '| `test.csv` | 타이타닉 (생존 여부 없음) | 418행 × 11열 |',
    '| `gender_submission.csv` | 타이타닉 제출 예시 | 418행 × 2열 |',
    '| `ramen-ratings.csv` | 라면 평점 | 2,580행 × 7열 |',
    '| `abalone.csv` | 전복 측정치 | 4,177행 × 8열 |',
    '| `housing.data` | 주택 가격 (헤더 없음) | 506행 × 14열 |',
    '| `lab_earthquake.csv` | 지진 관측 기록 (USGS) | 467행 × 22열 |',
    '',
    '### 0.3 표 출력 설정 — 먼저 이걸 실행하라',
    '',
    'pandas 는 표가 화면보다 넓으면 컬럼을 `...` 로 줄여서 보여 준다. 그러면 교재의 출력과',
    '여러분의 출력이 달라 보인다. **아래 세 줄을 맨 처음에 한 번 실행하면** 교재와 같은 표가 나온다.',
    '',
    DISPLAY_SETUP,
    '',
    '> 이 설정은 보기 방식만 바꾼다. 데이터나 계산 결과는 전혀 달라지지 않는다.',
    '> 실무에서도 노트북 첫 칸에 이런 설정을 두는 것이 보통이다.',
    '',
    '### 0.4 코드 블록에 붙은 표시',
    '',
    '| 표시 | 뜻 |',
    '|:---|:---|',
    '| (없음) | 정상 코드. 그대로 실행하면 된다 |',
    '| `# ✗` | **에러나 경고가 나는 코드.** 무엇이 잘못됐는지 보기 위해 일부러 실었다 |',
    '| `# ⚠` | **에러도 경고도 없는데 결과가 의도와 다른 코드.** 가장 위험한 종류다 |',
    '',
    '`# ⚠` 를 특히 조심해서 읽어라. 프로그램이 멈춰 주면 고칠 수 있지만, 조용히 틀린 답을',
    '내놓으면 틀린 줄도 모르고 넘어간다.',
    '',
    '---',
    ''
  ].join('\n');
}

// ─────────────────────────────────────────────── 목차

function buildToc(sections) {
  var lines = ['## 목차', ''];
  sections.forEach(function (s) {
    if (s.level === 2) {
      lines.push('- **' + s.title + '**');
    } else if (s.level === 3 && !/^확인 문제|^🧪/.test(s.title)) {
      lines.push('  - ' + s.title);
    }
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────── main

function main() {
  var missing = PART_ORDER.filter(function (f) { return !fs.existsSync(path.join(DRAFT, f)); });
  if (missing.length) {
    console.log('! 없는 파트: ' + missing.join(', '));
    console.log('  합치기를 멈춘다. 모든 파트가 있어야 목차와 장 번호가 맞는다.');
    process.exit(1);
  }

  var bodies = [];
  var sections = [];
  var stats = [];

  PART_ORDER.forEach(function (f) {
    var text = fs.readFileSync(path.join(DRAFT, f), 'utf8').replace(/\r\n/g, '\n').trim();

    // 코드 블록 안의 `##` 를 목차로 잘못 읽지 않도록 펜스를 추적한다
    var inFence = false;
    text.split('\n').forEach(function (line) {
      if (/^```/.test(line)) { inFence = !inFence; return; }
      if (inFence) return;
      var m = /^(#{2,3})\s+(.*)$/.exec(line);
      if (m) sections.push({ level: m[1].length, title: m[2].trim() });
    });

    stats.push({
      file: f,
      lines: text.split('\n').length,
      blocks: (text.match(/^```python$/gm) || []).length
    });
    bodies.push(text);
  });

  var out = preamble() + buildToc(sections) + bodies.join('\n\n---\n\n') + '\n';

  // ★ 이미 검증을 통과한 pandas.md 를 덮어쓰려 하면 경고한다.
  //   합본 후 `verify_md.py --fix` 로 재생성한 출력이 pandas.md 에만 있기 때문에
  //   무심코 다시 합치면 그 결과가 날아간다 (docs/draft/CLAUDE.md 참조).
  if (fs.existsSync(OUT) && process.argv.indexOf('--force') === -1) {
    var cur = fs.readFileSync(OUT, 'utf8');
    if (cur !== out) {
      console.log('! pandas.md 가 이미 있고 내용이 다르다.');
      console.log('  합본 후 verify_md.py --fix 로 재생성한 출력이 거기에만 있을 수 있다.');
      console.log('  덮어쓰려면 --force 를 붙여라. 덮어쓴 뒤에는 반드시:');
      console.log('    python -X utf8 webapp/test/verify_md.py --fix');
      console.log('    python -X utf8 webapp/test/verify_md.py');
      process.exit(1);
    }
  }

  fs.writeFileSync(OUT, out, 'utf8');

  console.log('교재 합치기');
  stats.forEach(function (s) {
    console.log('  ' + s.file.padEnd(34) + s.lines.toString().padStart(5) + '줄  코드블록 ' +
      s.blocks.toString().padStart(3) + '개');
  });
  var totalLines = out.split('\n').length;
  var totalBlocks = (out.match(/^```python$/gm) || []).length;
  console.log('  ' + '-'.repeat(60));
  console.log('  -> pandas.md  ' + totalLines + '줄, ' + (out.length / 1024).toFixed(0) +
    ' KB, 코드블록 ' + totalBlocks + '개');
  console.log('     장 ' + sections.filter(function (s) { return s.level === 2; }).length +
    '개, 절 ' + sections.filter(function (s) { return s.level === 3; }).length + '개');
  console.log('');
  console.log('  다음에 반드시 할 것:');
  console.log('    python -X utf8 webapp/test/verify_md.py        전체 코드 블록 실행');
  console.log('    node webapp/test/check_licensing.js           저작권·비밀 검사');
}

main();
