/* cross.test.js — 미니 엔진 ↔ 실제 pandas 교차 검증
 *
 * 검증 4중 구조의 2단계이고 **가장 강한 보증**이다.
 * expected.json 의 기대값은 손계산이 아니라 실제 pandas 3.0.5 가 낸 출력이다.
 *
 *   1) gen_expected.py 가 케이스와 fixture, 그리고 pandas 의 답을 expected.json 에 쓴다
 *   2) 이 파일이 같은 fixture 로 미니 엔진을 돌려 답을 대조한다
 *
 * 실행:
 *   C:\Users\user\...\Python313\python.exe -X utf8 webapp/test/gen_expected.py
 *   node webapp/test/cross.test.js
 *
 * ★ 실패했을 때 expected.json 을 고쳐서 맞추지 마라. 그건 검증을 없애는 것이다.
 *   엔진을 고치거나, 기대값이 정말 이상하면 pandas 로 다시 확인하라.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var DF = require('../src/core/df.js');

var EXPECTED = path.join(__dirname, 'expected.json');
if (!fs.existsSync(EXPECTED)) {
  console.log('');
  console.log('  expected.json 이 없다. 먼저 실제 pandas 로 기대값을 만들어라:');
  console.log('    C:\\Users\\user\\AppData\\Local\\Programs\\Python\\Python313\\python.exe' +
    ' -X utf8 webapp/test/gen_expected.py');
  console.log('');
  process.exit(1);
}

var payload = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));
var FX = payload.fixtures;

// ─────────────────────────────────────────────── 비교

var TOL = 1e-9;
var passed = 0, failures = [];

function num(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'number' || typeof b !== 'number') return a === b;
  if (!isFinite(a) && !isFinite(b)) return true;
  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));
}

function arrEq(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    var x = a[i], y = b[i];
    if (typeof x === 'number' || typeof y === 'number') { if (!num(x, y)) return false; }
    else if (DF.isNA(x) && DF.isNA(y)) continue;
    else if (x !== y) return false;
  }
  return true;
}

/* 엔진의 dtype 이름을 pandas 것과 맞춘다.
 * pandas 3.0 의 문자열 dtype 은 `str`, 이전에는 `object` 였다. 엔진은 `str` 로 맞췄다. */
function dtypeEq(mine, theirs) {
  if (mine === theirs) return true;
  // pandas 는 bool 컬럼에 결측이 들어가면 object 라고 한다. 엔진도 object 다.
  if (mine === 'object' && theirs === 'object') return true;
  return false;
}

function check(id, ok, detail) {
  if (ok) { passed++; return; }
  failures.push({ id: id, detail: detail });
}

function cmpSeries(id, got, want) {
  var bad = [];
  if (!arrEq(got.labels(), want.index)) {
    bad.push('index\n        기대: ' + JSON.stringify(want.index) +
      '\n        실제: ' + JSON.stringify(got.labels()));
  }
  if (!arrEq(got.toArray(), want.values)) {
    bad.push('values\n        기대: ' + JSON.stringify(want.values) +
      '\n        실제: ' + JSON.stringify(got.toArray()));
  }
  if (want.dtype && !dtypeEq(got.dtype, want.dtype)) {
    bad.push('dtype  기대: ' + want.dtype + '  실제: ' + got.dtype);
  }
  check(id, bad.length === 0, bad.join('\n      '));
}

function cmpValue(id, got, want) {
  if (want.error) {
    check(id, false, '예외가 나야 하는데 값이 나왔다: ' + JSON.stringify(got));
    return;
  }
  check(id, num(got === undefined ? null : got, want.value),
    '기대: ' + JSON.stringify(want.value) + '  실제: ' + JSON.stringify(got));
}

function cmpFrame(id, got, want) {
  var bad = [];
  if (!arrEq(got.columns, want.columns)) {
    bad.push('columns  기대: ' + JSON.stringify(want.columns) +
      '  실제: ' + JSON.stringify(got.columns));
  }
  if (!arrEq(got.index.labels, want.index)) {
    bad.push('index\n        기대: ' + JSON.stringify(want.index) +
      '\n        실제: ' + JSON.stringify(got.index.labels));
  }
  want.columns.forEach(function (c) {
    if (got.columns.indexOf(c) === -1) return;
    // JSON 의 key 는 항상 문자열이므로 data 조회는 String(c) 로 한다.
    // columns 자체는 타입을 보존한다(정수 컬럼 0 과 문자열 "0" 은 다르다).
    var wantCol = want.data[String(c)];
    if (!arrEq(got.col(c).toArray(), wantCol)) {
      bad.push("컬럼 '" + c + "'\n        기대: " + JSON.stringify(wantCol) +
        '\n        실제: ' + JSON.stringify(got.col(c).toArray()));
    }
  });
  check(id, bad.length === 0, bad.join('\n      '));
}

// ─────────────────────────────────────────────── fixture -> 엔진 객체

function S(name) {
  var f = FX[name];
  return DF.series(f.values, { index: f.index });
}

function F(name) {
  var f = FX[name];
  var obj = {};
  f.columns.forEach(function (c) { obj[c] = f.data[c]; });
  return DF.frame(obj, { columns: f.columns });
}

// ─────────────────────────────────────────────── 케이스 실행

var HANDLERS = {
  series_binop: function (sp) {
    var opts = sp.fillValue === undefined ? undefined : { fillValue: sp.fillValue };
    return { series: S(sp.left)[sp.op](S(sp.right), opts) };
  },
  series_scalar_binop: function (sp) {
    return { series: S(sp.left)[sp.op](sp.value) };
  },
  series_agg: function (sp) {
    var s = S(sp.src);
    if (sp.agg === 'quantile') return { value: s.quantile(sp.q) };
    if (sp.agg === 'std') return { value: sp.ddof === undefined ? s.std() : s.std(sp.ddof) };
    return { value: s[sp.agg]() };
  },
  series_mode: function (sp) {
    return { series: S(sp.src).mode() };
  },
  series_isna_sum: function (sp) {
    return { value: S(sp.src).isna().sum() };
  },
  series_notna_sum: function (sp) {
    return { value: S(sp.src).notna().sum() };
  },
  series_valuecounts: function (sp) {
    return { series: S(sp.src).valueCounts({ dropna: sp.dropna }) };
  },
  series_sortvalues: function (sp) {
    return { series: S(sp.src).sortValues({ ascending: sp.ascending }) };
  },
  series_fillna: function (sp) {
    return { series: S(sp.src).fillna(sp.value) };
  },
  series_fillna_then_agg: function (sp) {
    return { value: S(sp.src).fillna(sp.value)[sp.agg]() };
  },
  series_tonumeric: function (sp) {
    return { series: S(sp.src).toNumeric(sp.errors) };
  },
  series_replace: function (sp) {
    return { series: S(sp.src).replace(sp.map) };
  },
  dtype_infer: function (sp) {
    return { dtype: DF.inferDtype(sp.values) };
  },
  frame_shape: function (sp) {
    return { shape: F(sp.src).shape };
  },
  frame_dtypes: function (sp) {
    return { dtypes: F(sp.src).dtypes() };
  },
  frame_isna_sum: function (sp) {
    return { series: F(sp.src).isna().sum() };
  },
  frame_count: function (sp) {
    return { series: F(sp.src).count() };
  },
  frame_dropna: function (sp) {
    return { rows: F(sp.src).dropna({ subset: sp.subset }).nrows() };
  },
  frame_col_agg: function (sp) {
    var s = F(sp.src).col(sp.col);
    if (sp.agg === 'quantile') return { value: s.quantile(sp.q) };
    return { value: s[sp.agg]() };
  },
  frame_describe_col: function (sp) {
    return { series: F(sp.src).describe().col(sp.col) };
  },
  frame_head: function (sp) {
    return { frame: F(sp.src).head(sp.n) };
  },
  frame_mask: function (sp) {
    var df = F(sp.src);
    var m = df.mask(df.col(sp.col)[sp.op](sp.value));
    return { rows: m.nrows(), index: m.index.labels.slice(0, 20) };
  },
  frame_sortvalues: function (sp) {
    return { frame: F(sp.src).sortValues(sp.by, { ascending: sp.ascending }).head(sp.head) };
  },
  frame_groupby_agg: function (sp) {
    return { series: F(sp.src).groupby(sp.keys).aggCol(sp.col, sp.agg) };
  },
  frame_groupby_size: function (sp) {
    return { series: F(sp.src).groupby(sp.keys).size() };
  },
  frame_groupby_multiagg: function (sp) {
    return { frame: F(sp.src).groupby(sp.keys).agg(sp.spec) };
  },
  frame_merge: function (sp) {
    var r = F(sp.left).merge(F(sp.right), { on: sp.on, how: sp.how });
    return { rows: r.nrows(), columns: r.columns, ids: r.col(sp.on).toArray() };
  },
  frame_series_binop: function (sp) {
    var s = DF.series(sp.series.values, { index: sp.series.index });
    var opts = sp.axis === undefined ? undefined : { axis: sp.axis };
    return { frame: F(sp.left)[sp.op](s, opts) };
  },
  frame_transpose: function (sp) {
    return { frame: F(sp.src).T };
  },
  // 엔진이 DataFrame 산술을 갖게 되어 하네스에서 직접 계산할 필요가 없어졌다.
  frame_binop: function (sp) {
    return { frame: F(sp.left)[sp.op](F(sp.right)) };
  }
};

// ─────────────────────────────────────────────── 실행

var skipped = [];

payload.cases.forEach(function (c) {
  var h = HANDLERS[c.kind];
  if (!h) { skipped.push(c.id + ' (kind: ' + c.kind + ')'); return; }
  var got;
  try {
    got = h(c.spec);
  } catch (e) {
    if (c.expect.error) { passed++; return; }   // 양쪽이 다 실패해야 하는 케이스
    check(c.id, false, '엔진에서 예외: ' + e.message);
    return;
  }
  if (c.expect.error) {
    check(c.id, false, 'pandas 는 ' + c.expect.error + ' 를 냈는데 엔진은 값을 냈다: ' +
      JSON.stringify(got.value !== undefined ? got.value : got));
    return;
  }
  if (got.series) cmpSeries(c.id, got.series, c.expect);
  else if (got.frame) cmpFrame(c.id, got.frame, c.expect);
  else if (got.dtype !== undefined) {
    check(c.id, dtypeEq(got.dtype, c.expect.dtype),
      '기대: ' + c.expect.dtype + '  실제: ' + got.dtype);
  } else if (got.shape) {
    check(c.id, arrEq(got.shape, c.expect.shape),
      '기대: ' + JSON.stringify(c.expect.shape) + '  실제: ' + JSON.stringify(got.shape));
  } else if (got.dtypes) {
    var bad = [];
    Object.keys(c.expect.dtypes).forEach(function (k) {
      if (!dtypeEq(got.dtypes[k], c.expect.dtypes[k])) {
        bad.push(k + ': 기대 ' + c.expect.dtypes[k] + ', 실제 ' + got.dtypes[k]);
      }
    });
    check(c.id, bad.length === 0, bad.join('; '));
  } else if (got.rows !== undefined) {
    var bad2 = [];
    if (got.rows !== c.expect.rows) {
      bad2.push('rows 기대 ' + c.expect.rows + ', 실제 ' + got.rows);
    }
    if (c.expect.columns && !arrEq(got.columns, c.expect.columns)) {
      bad2.push('columns 기대 ' + JSON.stringify(c.expect.columns) +
        ', 실제 ' + JSON.stringify(got.columns));
    }
    if (c.expect.ids && !arrEq(got.ids, c.expect.ids)) {
      bad2.push('키 기대 ' + JSON.stringify(c.expect.ids) + ', 실제 ' + JSON.stringify(got.ids));
    }
    if (c.expect.index && !arrEq(got.index, c.expect.index)) {
      bad2.push('index 기대 ' + JSON.stringify(c.expect.index) +
        ', 실제 ' + JSON.stringify(got.index));
    }
    check(c.id, bad2.length === 0, bad2.join('; '));
  } else {
    cmpValue(c.id, got.value, c.expect);
  }
});

// ─────────────────────────────────────────────── 결과

console.log('');
console.log('교차 검증 — 미니 엔진 ↔ 실제 pandas');
console.log('  기대값 생성: pandas ' + payload.meta.pandas +
  ' / numpy ' + payload.meta.numpy + ' / python ' + payload.meta.python);
console.log('  케이스 ' + payload.cases.length + '건');
console.log('');

if (skipped.length) {
  console.log('  처리기가 없어 건너뛴 케이스 ' + skipped.length + '건:');
  skipped.forEach(function (s) { console.log('    · ' + s); });
  console.log('');
}

if (failures.length) {
  failures.forEach(function (f) {
    console.log('  ✗ ' + f.id);
    if (f.detail) console.log('      ' + f.detail);
  });
  console.log('');
  console.log('  통과 ' + passed + ' / 실패 ' + failures.length +
    (skipped.length ? ' / 건너뜀 ' + skipped.length : ''));
  console.log('');
  console.log('  ★ expected.json 을 고쳐서 맞추지 마라. 엔진을 고쳐라.');
  console.log('');
  process.exit(1);
}

console.log('  통과 ' + passed + ' / 실패 0' + (skipped.length ? ' / 건너뜀 ' + skipped.length : ''));
if (!skipped.length) console.log('  ==> 미니 엔진이 실제 pandas 와 전부 일치한다.');
console.log('');
process.exit(0);
