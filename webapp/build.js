/* build.js — 빌드
 *
 *   1) 수업자료/*.csv  ->  src/core/data.js   (합성 데이터 생성. USGS 만 실데이터)
 *   2) src/* 를 인라인  ->  ../pandas-lab.html (단일 파일 배포본)
 *   3) 인덱스 생성      ->  ../index.html     (저장소 루트. Pages 가 이걸 서빙한다)
 *
 * ★ 원본이 없으면 기존 data.js 를 **보존**한다 (buildData 가 null 반환).
 *   그러지 않으면 저장소를 클론한 사람이 빌드하는 순간 데이터가 전부 날아간다.
 *   `node webapp/build.js` 를 수업자료 폴더를 숨긴 상태로 한 번 돌려서 실제로 시험하라.
 *
 * ★ 로드 순서는 df -> ui -> data -> app -> modules -> boot. 바꾸면 장이 하나도 등록되지 않는다.
 *
 * 사용법:
 *   node webapp/build.js            전체 빌드
 *   node webapp/build.js --data     data.js 만
 *   node webapp/build.js --html     html 만
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var WEBAPP = __dirname;
var SRC = path.join(WEBAPP, 'src');
/* 원본 폴더. PANDAS_LAB_SRC 로 덮어쓸 수 있다 —
 * "원본이 없을 때 기존 data.js 를 보존하는가" 를 폴더를 건드리지 않고 시험하기 위한 것이다. */
var SRC_DATA = process.env.PANDAS_LAB_SRC || path.join(ROOT, '수업자료');
var DATA_JS = path.join(SRC, 'core', 'data.js');

/* 로드 순서. 이 배열의 순서가 곧 index.html 과 단일 파일의 순서다. */
var CORE_ORDER = ['core/df.js', 'core/ui.js', 'core/data.js', 'core/app.js'];
var CSS_ORDER = ['theme.css', 'app.css'];

// ─────────────────────────────────────────────── CSV 읽기

/* 따옴표로 감싼 필드를 처리한다(타이타닉 Name 에 쉼표가 들어 있다). */
function parseCSV(text, sep) {
  sep = sep || ',';
  var rows = [], row = [], field = '', inQ = false;
  text = text.replace(/^﻿/, '');
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function (r) { return r.length > 1 || (r.length === 1 && r[0] !== ''); });
}

function toRecords(rows) {
  var head = rows[0];
  return rows.slice(1).map(function (r) {
    var o = {};
    head.forEach(function (h, i) {
      var v = r[i];
      o[h] = (v === undefined || v === '') ? null : v;
    });
    return o;
  });
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isNaN(n) ? v : n;
}

// ─────────────────────────────────────────────── 결정적 난수

/* Math.random 을 쓰지 않는다. 빌드를 두 번 돌리면 같은 결과가 나와야 한다
 * (그러지 않으면 data.js 가 매번 바뀌어 git diff 가 쓰레기가 된다). */
function rng(seed) {
  var s = seed >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

/* 서로 다른 위치 k 개를 고른다.
 * 결측을 행마다 확률로 넣으면 개수가 매번 달라진다. 결측 개수는 교재가 가르치는 값이므로
 * (Age 177, Cabin 687, Embarked 2) 정확히 맞춰야 한다 — 개수는 집계값이라 저작권 문제도 없다. */
function pickIndices(rand, n, k) {
  var s = new Set();
  var guard = 0;
  while (s.size < Math.min(k, n) && guard++ < k * 50) s.add(Math.floor(rand() * n));
  for (var i = 0; s.size < Math.min(k, n) && i < n; i++) s.add(i);   // 못 채우면 앞에서 메운다
  return s;
}

/* 정규분포에 가까운 값 (Box-Muller) */
function gauss(rand, mean, sd) {
  var u = Math.max(1e-9, rand()), v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─────────────────────────────────────────────── 합성 데이터

/* 원본의 **구조와 통계 특성**만 남기고 값은 새로 만든다.
 * 저작권 때문이다(../CLAUDE.md §10). 결측 패턴과 dtype 은 반드시 보존해야
 * 교재가 가르치는 내용(결측 처리, dtype 승격)이 웹앱에서도 성립한다. */

var SYN_SURNAMES = ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Lim', 'Han', 'Oh',
  'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Ryu', 'Hong', 'Jeon', 'Ko'];
var SYN_GIVEN_M = ['Minsu', 'Jiho', 'Daniel', 'Junho', 'Sungmin', 'Taeyang', 'Hyun', 'Woojin'];
var SYN_GIVEN_F = ['Jiwoo', 'Seoyeon', 'Hana', 'Yuna', 'Sora', 'Minji', 'Eunbi', 'Chaewon'];

function synthTitanic(realRows, seed) {
  var rand = rng(seed);
  var n = realRows.length;                      // 행 수는 사실이므로 유지한다
  var out = [];
  /* 결측 개수를 원본과 정확히 맞춘다 (Age 177, Cabin 687, Embarked 2).
   * 교재가 이 숫자를 가르치므로 웹앱에서도 같아야 한다. */
  var naAge = pickIndices(rand, n, 177);
  var naCabin = pickIndices(rand, n, 687);
  var naEmb = pickIndices(rand, n, 2);
  for (var i = 0; i < n; i++) {
    var cls = rand() < 0.55 ? 3 : (rand() < 0.54 ? 1 : 2);
    var female = rand() < 0.35;
    var survived = female ? (rand() < 0.74 ? 1 : 0) : (rand() < 0.19 ? 1 : 0);
    var title = female ? (rand() < 0.5 ? 'Miss.' : 'Mrs.') : 'Mr.';
    var name = pick(rand, SYN_SURNAMES) + ', ' + title + ' ' +
      pick(rand, female ? SYN_GIVEN_F : SYN_GIVEN_M);
    var age = naAge.has(i) ? null : Math.max(0.5, Math.round(gauss(rand, 29.7, 14.5) * 10) / 10);
    var fare = cls === 1 ? Math.abs(gauss(rand, 84.2, 78)) :
      cls === 2 ? Math.abs(gauss(rand, 20.7, 13)) : Math.abs(gauss(rand, 13.7, 11));
    out.push({
      PassengerId: i + 1,
      Survived: survived,
      Pclass: cls,
      Name: name,
      Sex: female ? 'female' : 'male',
      Age: age,
      SibSp: rand() < 0.68 ? 0 : Math.floor(rand() * 4) + 1,
      Parch: rand() < 0.76 ? 0 : Math.floor(rand() * 3) + 1,
      Ticket: 'T' + (100000 + Math.floor(rand() * 899999)),
      Fare: Math.round(fare * 1e4) / 1e4,
      Cabin: naCabin.has(i) ? null : pick(rand, ['A', 'B', 'C', 'D', 'E', 'F']) + Math.floor(rand() * 140),
      Embarked: naEmb.has(i) ? null : (rand() < 0.72 ? 'S' : rand() < 0.68 ? 'C' : 'Q')
    });
  }
  return out;
}

var SYN_BRANDS = ['Noodle Star', 'Golden Bowl', 'Spicy House', 'Sunrise Foods', 'Blue Pot',
  'Mountain Mie', 'River Ramen', 'Happy Cup', 'Silver Wheat', 'Green Chili'];
var SYN_COUNTRIES = ['Korea', 'Japan', 'Taiwan', 'Thailand', 'Indonesia', 'Malaysia',
  'Singapore', 'Vietnam', 'China', 'USA', 'United States'];  // USA/United States 중복은 교육 재료라 유지
var SYN_STYLES = ['Pack', 'Bowl', 'Cup', 'Tray', 'Box'];

function synthRamen(realRows, seed) {
  var rand = rng(seed);
  var n = realRows.length;
  var out = [];
  for (var i = 0; i < n; i++) {
    // Style 결측 2건, Stars 에 'Unrated' 3건, Top Ten 대부분 결측 — 원본의 구조를 유지한다
    var style = (i === 2152 || i === 2442) ? null : pick(rand, SYN_STYLES);
    var stars;
    if (i === 32 || i === 122 || i === 993) stars = 'Unrated';
    else stars = String(Math.round(Math.min(5, Math.max(0, gauss(rand, 3.65, 1.0))) * 4) / 4);
    var country = rand() < 0.001 ? 'United States' : pick(rand, SYN_COUNTRIES.slice(0, 10));
    out.push({
      'Review #': n - i,
      Brand: pick(rand, SYN_BRANDS),
      Variety: 'Variety ' + (i + 1),
      Style: style,
      Country: country,
      Stars: stars,
      'Top Ten': rand() < 0.016 ? '2016 #' + (Math.floor(rand() * 10) + 1) : null
    });
  }
  return out;
}

function synthAbalone(realRows, seed) {
  var rand = rng(seed);
  var out = [];
  for (var i = 0; i < realRows.length; i++) {
    var len = Math.round(Math.min(0.82, Math.max(0.075, gauss(rand, 0.524, 0.12))) * 1e4) / 1e4;
    var dia = Math.round(len * (0.77 + rand() * 0.06) * 1e4) / 1e4;
    var hei = Math.round(len * (0.26 + rand() * 0.06) * 1e4) / 1e4;
    var whole = Math.round(Math.pow(len, 3) * 12.5 * (0.85 + rand() * 0.3) * 1e4) / 1e4;
    var shucked = Math.round(whole * (0.38 + rand() * 0.12) * 1e4) / 1e4;
    var viscera = Math.round(whole * (0.18 + rand() * 0.08) * 1e4) / 1e4;
    var shell = Math.round(whole * (0.26 + rand() * 0.10) * 1e4) / 1e4;
    out.push({
      '길이': len, '직경': dia, '두께': hei,
      '전체무게': whole, '내장무게': viscera, '껍질무게': shell,
      '나이테': Math.max(1, Math.round(gauss(rand, 9.9, 3.2))),
      '순살무게': shucked
    });
  }
  return out;
}

// ─────────────────────────────────────────────── dtype (엔진과 같은 규칙)

/* JS 는 1 과 1.0 을 구분하지 못하므로 컬럼 dtype 을 함께 실어 준다.
 * 그러지 않으면 엔진이 float 컬럼을 int64 로 추론한다(core/CLAUDE.md 참조). */
function inferCols(records) {
  if (!records.length) return {};
  var names = Object.keys(records[0]);
  var out = {};
  names.forEach(function (name) {
    var sawFloat = false, sawInt = false, sawStr = false, sawNA = false;
    for (var i = 0; i < records.length; i++) {
      var v = records[i][name];
      if (v === null || v === undefined) { sawNA = true; continue; }
      if (typeof v === 'number') { if (Number.isInteger(v)) sawInt = true; else sawFloat = true; }
      else sawStr = true;
    }
    if (sawStr && (sawInt || sawFloat)) out[name] = 'object';
    else if (sawStr) out[name] = 'str';
    else if (sawFloat || (sawInt && sawNA)) out[name] = 'float64';
    else if (sawInt) out[name] = 'int64';
    else out[name] = 'float64';
  });
  return out;
}

// ─────────────────────────────────────────────── data.js

function readCSV(file, sep) {
  var p = path.join(SRC_DATA, file);
  if (!fs.existsSync(p)) return null;
  return toRecords(parseCSV(fs.readFileSync(p, 'utf8'), sep));
}

/* 원본이 하나도 없으면 null 을 반환한다 = "기존 data.js 를 그대로 두라". */
function buildData() {
  if (!fs.existsSync(SRC_DATA)) {
    console.log('  수업자료/ 가 없다 -> 기존 data.js 를 보존한다');
    return null;
  }
  var titanicRaw = readCSV('train.csv');
  var ramenRaw = readCSV('ramen-ratings.csv');
  var abaloneRaw = readCSV('abalone.csv');
  var quakeRaw = readCSV('lab_earthquake.csv');

  if (!titanicRaw && !ramenRaw && !abaloneRaw && !quakeRaw) {
    console.log('  수업자료/ 에 읽을 csv 가 없다 -> 기존 data.js 를 보존한다');
    return null;
  }

  var sets = {};

  if (titanicRaw) {
    var t = synthTitanic(titanicRaw, 20260730);
    sets.titanic = { records: t, dtypes: inferCols(t), synthetic: true, label: '타이타닉 (합성)' };
  }
  if (ramenRaw) {
    var r = synthRamen(ramenRaw, 20260731);
    sets.ramen = { records: r, dtypes: inferCols(r), synthetic: true, label: '라멘 평점 (합성)' };
  }
  if (abaloneRaw) {
    var a = synthAbalone(abaloneRaw, 20260732);
    sets.abalone = { records: a, dtypes: inferCols(a), synthetic: true, label: '전복 (합성)' };
  }
  if (quakeRaw) {
    // USGS = 미국 정부 저작물 = 퍼블릭 도메인. 실데이터를 그대로 쓴다.
    var keep = ['time', 'latitude', 'longitude', 'depth', 'mag', 'magType', 'place', 'type'];
    var q = quakeRaw.map(function (row) {
      var o = {};
      keep.forEach(function (k) {
        o[k] = (k === 'latitude' || k === 'longitude' || k === 'depth' || k === 'mag')
          ? num(row[k]) : row[k];
      });
      return o;
    });
    sets.earthquake = {
      records: q, dtypes: inferCols(q), synthetic: false,
      label: '지진 (USGS 실데이터, 퍼블릭 도메인)'
    };
  }

  return sets;
}

/* 레코드 배열 -> 열 기준 저장.
 * 레코드로 담으면 행마다 컬럼 이름이 반복되어 파일이 3배로 커진다(1.5MB -> 0.5MB). */
function toColumnar(records) {
  if (!records.length) return { columns: [], data: {} };
  var names = Object.keys(records[0]);
  var data = {};
  names.forEach(function (n) {
    data[n] = records.map(function (r) {
      var v = r[n];
      return v === undefined ? null : v;
    });
  });
  return { columns: names, data: data };
}

function writeData(sets) {
  var anySynthetic = Object.keys(sets).some(function (k) { return sets[k].synthetic; });
  var payload = { synthetic: anySynthetic, sets: {} };
  Object.keys(sets).forEach(function (k) {
    var s = sets[k];
    var col = toColumnar(s.records);
    payload.sets[k] = {
      label: s.label,
      synthetic: s.synthetic,
      rows: s.records.length,
      columns: col.columns,
      dtypes: s.dtypes,
      data: col.data
    };
  });

  var body = [
    '/* data.js — 빌드가 생성한다. 손으로 고치지 마라.',
    ' * 생성: node webapp/build.js --data',
    ' * 합성 데이터는 원본과 구조·결측 패턴·dtype 만 같고 값은 새로 만든 것이다(저작권).',
    ' * 지진 데이터만 USGS 실데이터다(퍼블릭 도메인).',
    ' * 저장은 열 기준이다 — 레코드로 담으면 행마다 컬럼 이름이 반복되어 파일이 3배가 된다.',
    ' */',
    '(function () {',
    "  'use strict';",
    '  var LabData = ' + JSON.stringify(payload) + ';',
    '',
    '  /* 이름으로 DataFrame 을 만든다.',
    '   * dtype 을 함께 넘겨야 float 컬럼이 int64 로 잘못 추론되지 않는다',
    '   * (JS 는 1 과 1.0 을 구분하지 못한다 — core/CLAUDE.md 참조). */',
    '  LabData.frame = function (name) {',
    '    var s = LabData.sets[name];',
    '    if (!s) throw new Error("모르는 데이터: " + name);',
    '    return window.DF.frame(s.data, { columns: s.columns }).declareDtypes(s.dtypes);',
    '  };',
    '',
    '  /* 원본 레코드가 필요할 때 (표 위젯 등) */',
    '  LabData.records = function (name) { return LabData.frame(name).records(); };',
    '',
    '  if (typeof window !== "undefined") window.LabData = LabData;',
    '  if (typeof module !== "undefined" && module.exports) module.exports = LabData;',
    '})();',
    ''
  ].join('\n');
  fs.mkdirSync(path.dirname(DATA_JS), { recursive: true });
  fs.writeFileSync(DATA_JS, body, 'utf8');
  return body.length;
}

// ─────────────────────────────────────────────── HTML

function moduleFiles() {
  var dir = path.join(SRC, 'modules');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(function (f) { return f.endsWith('.js'); })
    .sort()                                    // 파일명 사전순 = 표시 순서
    .map(function (f) { return 'modules/' + f; });
}

function readSrc(rel) {
  var p = path.join(SRC, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

/* 저장소 루트의 index.html — 파일을 링크로 불러온다(웹서버·Pages 용) */
function buildIndex(mods) {
  var scripts = CORE_ORDER.concat(mods)
    .map(function (rel) { return '  <script src="webapp/src/' + rel + '"></script>'; })
    .join('\n');
  var links = CSS_ORDER
    .map(function (rel) { return '  <link rel="stylesheet" href="webapp/src/' + rel + '">'; })
    .join('\n');
  return [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>Pandas Lab</title>',
    links,
    '</head>',
    '<body>',
    '  <div id="lab-root"></div>',
    '  <!-- 로드 순서: df -> ui -> data -> app -> modules -> boot.',
    '       app.js 가 modules 보다 나중에 오면 장이 하나도 등록되지 않는다. -->',
    scripts,
    '  <script>Lab.boot({ title: "Pandas Lab", bookHref: "pandas.md" });</script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

/* 단일 파일 배포본 — 전부 인라인 */
function buildSingle(mods) {
  var css = CSS_ORDER.map(function (rel) {
    var s = readSrc(rel);
    return s === null ? '' : '/* ===== ' + rel + ' ===== */\n' + s;
  }).join('\n');

  var js = CORE_ORDER.concat(mods).map(function (rel) {
    var s = readSrc(rel);
    if (s === null) {
      console.log('  ! 없는 파일을 건너뛴다: ' + rel);
      return '';
    }
    // </script> 가 소스에 있으면 인라인이 깨진다
    return '/* ===== ' + rel + ' ===== */\n' + s.replace(/<\/script>/gi, '<\\/script>');
  }).join('\n');

  return [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>Pandas Lab (단일 파일)</title>',
    '  <style>',
    css,
    '  </style>',
    '</head>',
    '<body>',
    '  <div id="lab-root"></div>',
    '  <script>',
    js,
    '  </script>',
    '  <script>Lab.boot({ title: "Pandas Lab" });</script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

// ─────────────────────────────────────────────── main

function main() {
  var args = process.argv.slice(2);
  var doData = args.length === 0 || args.indexOf('--data') !== -1;
  var doHtml = args.length === 0 || args.indexOf('--html') !== -1;

  if (doData) {
    console.log('data.js 생성');
    var sets = buildData();
    if (sets === null) {
      if (fs.existsSync(DATA_JS)) console.log('  기존 data.js 유지 (' + fs.statSync(DATA_JS).size + ' bytes)');
      else console.log('  ! data.js 도 없다. 수업자료/ 없이는 첫 빌드를 할 수 없다');
    } else {
      var n = writeData(sets);
      Object.keys(sets).forEach(function (k) {
        console.log('  ' + k + ': ' + sets[k].records.length + '행 ' +
          Object.keys(sets[k].dtypes).length + '열 ' + (sets[k].synthetic ? '(합성)' : '(실데이터)'));
      });
      console.log('  -> ' + path.relative(ROOT, DATA_JS) + ' (' + n + ' bytes)');
    }
  }

  if (doHtml) {
    var mods = moduleFiles();
    console.log('html 생성 (화면 모듈 ' + mods.length + '개)');
    if (!mods.length) console.log('  ! modules/*.js 가 없다. 장이 하나도 없는 앱이 나온다');
    var idx = buildIndex(mods);
    fs.writeFileSync(path.join(ROOT, 'index.html'), idx, 'utf8');
    console.log('  -> index.html (' + idx.length + ' bytes)');
    var single = buildSingle(mods);
    fs.writeFileSync(path.join(ROOT, 'pandas-lab.html'), single, 'utf8');
    console.log('  -> pandas-lab.html (' + single.length + ' bytes)');
  }
}

main();
