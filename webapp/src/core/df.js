/* df.js — 미니 DataFrame 엔진
 *
 * pandas 를 흉내내는 것이 목적이 아니다. 글로 전달되지 않는 것을 실행으로 보여주는 것이 목적이다.
 * 그래서 진짜 pandas 의 내부 모델을 그대로 옮겼다.
 *
 *   Block   컬럼 데이터의 실제 저장소. id 와 refs(참조 수)를 갖는다.
 *   ColRef  DataFrame 이 블록을 가리키는 방법. { block, slice }
 *   Index   중복 라벨을 허용한다. 정렬(alignment) 의 주인공.
 *
 * 재현해야 하는 핵심 비대칭 (실제 pandas 3.0.5 확인):
 *   슬라이싱은 블록을 공유한다  -> shares_memory True
 *   불린 마스크는 복사한다      -> shares_memory False
 *   공유 중인 컬럼에 쓰면 그 순간 복사한다 (Copy-on-Write)
 *
 * 정렬·dtype 규칙은 CLAUDE.md 의 "검증된 …" 절에 근거가 있다. 추측으로 고치지 마라.
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다.
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────── 결측·기본 유틸

  var NA = null; // 엔진 내부의 결측 표현. NaN 과 null/undefined 를 모두 NA 로 본다.

  function isNA(v) {
    return v === null || v === undefined || (typeof v === 'number' && isNaN(v));
  }

  function isNum(v) {
    return typeof v === 'number' && !isNaN(v);
  }

  /* 라벨 비교. 합집합을 정렬할 때 쓴다.
   * 숫자는 숫자끼리 크기 비교, 문자열은 사전순, 섞이면 숫자를 앞에 둔다. */
  function cmpLabel(a, b) {
    var an = typeof a === 'number', bn = typeof b === 'number';
    if (an && bn) return a < b ? -1 : a > b ? 1 : 0;
    if (an) return -1;
    if (bn) return 1;
    var as = String(a), bs = String(b);
    return as < bs ? -1 : as > bs ? 1 : 0;
  }

  function arrEq(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // ──────────────────────────────────────────────────────────── trace

  /* 단계 실행 시뮬레이터가 읽는 연산 기록.
   * 화면 모듈은 DF.trace.enable() 후 연산하고 DF.trace.get() 으로 단계를 받는다. */
  var _trace = { on: false, log: [] };
  var trace = {
    enable: function () { _trace.on = true; _trace.log = []; return trace; },
    disable: function () { _trace.on = false; return trace; },
    clear: function () { _trace.log = []; return trace; },
    get: function () { return _trace.log.slice(); },
    push: function (kind, detail) {
      if (_trace.on) _trace.log.push({ kind: kind, detail: detail });
    }
  };

  // ──────────────────────────────────────────────────────────── dtype

  /* 검증된 규칙(CLAUDE.md 참조):
   *   [1,2,3]        -> 'int64'
   *   [1,2.5],[1,NA] -> 'float64'
   *   ['a','b']      -> 'str'      (pandas 3.0 기본. 2.x 의 object 가 아니다)
   *   [1,'a']        -> 'object'
   *   [true,false]   -> 'bool'
   *   [true,1]       -> 'object'   (섞이면 object)
   */
  function inferDtype(values) {
    var sawInt = false, sawFloat = false, sawStr = false, sawBool = false, sawNA = false;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (isNA(v)) { sawNA = true; continue; }
      if (typeof v === 'boolean') sawBool = true;
      else if (typeof v === 'number') { if (Number.isInteger(v)) sawInt = true; else sawFloat = true; }
      else if (typeof v === 'string') sawStr = true;
      else return 'object';
    }
    var kinds = (sawInt || sawFloat ? 1 : 0) + (sawStr ? 1 : 0) + (sawBool ? 1 : 0);
    if (kinds > 1) return 'object';
    if (sawStr) return 'str';
    if (sawBool) return sawNA ? 'object' : 'bool';
    if (sawFloat) return 'float64';
    if (sawInt) return sawNA ? 'float64' : 'int64'; // int 에 결측이 들어오면 float 로 올라간다
    return sawNA ? 'float64' : 'object';            // 전부 결측이면 float64
  }

  function isNumericDtype(dt) { return dt === 'int64' || dt === 'float64'; }

  /* ★ `str` dtype 은 대입에 엄격하다 (실제 pandas 3.0.5 확인, 정정표 C-7).
   *   Series.loc[0] = 0        -> TypeError
   *   replace({'a': 0})        -> OK, object 로 승격
   *   fillna(0)                -> OK, object 로 승격
   * 대입은 막고 변환은 통과시키는 비대칭이다. 예전 `object` dtype 에서는 셋 다 조용히 통과했다.
   * 학생이 `df.loc[조건, '문자열컬럼'] = 0` 으로 인코딩하려 하면 여기서 막힌다. */
  function checkAssignable(dtype, value) {
    if (dtype !== 'str') return;
    if (isNA(value) || typeof value === 'string') return;
    throw new Error("TypeError: Invalid value '" + value + "' for dtype 'str'. " +
      "Value should be a string or missing value, got '" +
      (typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : typeof value) +
      "' instead.");
  }

  /* dtype 승격. fillna / replace 가 결과 dtype 을 정할 때 쓴다.
   * 값에서 다시 추론하면 안 된다 — pandas 는 원래 dtype 을 기억한다.
   *   float64 + 0     -> float64   ('int64' 로 내려가지 않는다)
   *   float64 + '0'   -> object
   *   str     + 'b'   -> str
   *   str     + 0     -> object
   * (실제 pandas 3.0.5 확인. CLAUDE.md "검증된 dtype 규칙" 참조) */
  function promoteDtype(a, b) {
    if (a === b) return a;
    if (a === 'object' || b === 'object') return 'object';
    var an = isNumericDtype(a), bn = isNumericDtype(b);
    if (an && bn) return (a === 'float64' || b === 'float64') ? 'float64' : 'int64';
    return 'object'; // 숫자와 문자열, 숫자와 불린, 문자열과 숫자 …
  }

  // ──────────────────────────────────────────────────────────── Block / ColRef

  var _blockSeq = 0;

  /* 컬럼 데이터의 실제 저장소. 화면은 이 id 와 refs 를 그린다. */
  function Block(data) {
    this.id = ++_blockSeq;
    this.data = data;
    this.refs = 0;
  }
  Block.prototype.retain = function () { this.refs++; return this; };
  Block.prototype.release = function () { if (this.refs > 0) this.refs--; return this; };
  Block.prototype.clone = function () {
    var b = new Block(this.data.slice());
    trace.push('block-copy', { from: this.id, to: b.id, reason: 'copy-on-write' });
    return b;
  };

  /* DataFrame/Series 가 블록을 가리키는 방법.
   * slice 가 null 이면 블록 전체. 아니면 [start, stop, step] 구간만 본다(= 뷰).
   *
   * ★ borrowed — "빌려 본다" 는 표시.
   *   `df.col('a')` 처럼 **읽기 위해 잠깐 꺼내는** 참조는 refs 를 올리지 않는다.
   *   그러지 않으면 표를 한 번 그릴 때마다(셀마다 col() 을 부르므로) refs 가 끝없이 누적되어
   *   CoW 시뮬레이터가 보여주는 참조 수가 의미 없는 숫자가 된다. (실제로 그랬다.)
   *   대신 borrowed 참조에 **쓰면 무조건 복사**한다 — 그게 연쇄 할당의 정확한 의미다. */
  function ColRef(block, slice, borrowed) {
    this.block = block;
    this.slice = slice || null;
    this.borrowed = !!borrowed;
    if (!this.borrowed) block.retain();
  }
  ColRef.prototype.length = function () {
    if (!this.slice) return this.block.data.length;
    var s = this.slice, n = 0;
    for (var i = s[0]; s[2] > 0 ? i < s[1] : i > s[1]; i += s[2]) n++;
    return n;
  };
  ColRef.prototype.at = function (i) {
    if (!this.slice) return this.block.data[i];
    return this.block.data[this.slice[0] + i * this.slice[2]];
  };
  ColRef.prototype.toArray = function () {
    if (!this.slice) return this.block.data.slice();
    var out = [], n = this.length();
    for (var i = 0; i < n; i++) out.push(this.at(i));
    return out;
  };
  /* 뷰를 잘라 또 다른 뷰를 만든다. 블록은 그대로 공유된다. */
  ColRef.prototype.sliceView = function (start, stop, step) {
    step = step || 1;
    if (!this.slice) return new ColRef(this.block, [start, stop, step]);
    var s = this.slice;
    return new ColRef(this.block, [s[0] + start * s[2], s[0] + stop * s[2], s[2] * step]);
  };
  /* 특정 행만 골라 가져온다 -> 새 블록(복사). 불린 마스크·정렬·groupby 가 이걸 쓴다. */
  ColRef.prototype.take = function (positions) {
    var out = [];
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      out.push(p === -1 ? NA : this.at(p));
    }
    return new ColRef(new Block(out), null);
  };
  /* 쓰기 직전에 부른다. 공유 중이거나 뷰이거나 빌린 참조면 복사해서 단독 소유로 만든다. */
  ColRef.prototype.ensureOwn = function () {
    if (!this.borrowed && this.block.refs <= 1 && !this.slice) return this;
    var copied = new ColRef(new Block(this.toArray()), null);
    if (!this.borrowed) this.block.release();   // 빌린 참조는 retain 하지 않았으니 release 하지 않는다
    return copied;
  };
  ColRef.prototype.release = function () {
    if (!this.borrowed) this.block.release();
  };

  /* 두 컬럼이 같은 블록을 보고 있는가. pandas 의 np.shares_memory 에 대응한다. */
  function sharesMemory(a, b) {
    var ba = a instanceof Series ? a._col.block : a instanceof ColRef ? a.block : null;
    var bb = b instanceof Series ? b._col.block : b instanceof ColRef ? b.block : null;
    return !!ba && ba === bb;
  }

  // ──────────────────────────────────────────────────────────── Index

  /* 중복 라벨을 허용한다. 정렬(alignment) 의 주인공이므로
   * 라벨 -> 위치 맵을 반드시 "배열" 로 담는다. 단일 값으로 담으면 중복이 조용히 틀린다. */
  function Index(labels, name) {
    this.labels = labels.slice();
    this.name = name === undefined ? null : name;
    this._map = null;
  }
  Index.prototype.length = function () { return this.labels.length; };
  Index.prototype.at = function (i) { return this.labels[i]; };
  Index.prototype.map = function () {
    if (!this._map) {
      var m = new Map();
      for (var i = 0; i < this.labels.length; i++) {
        var k = this.labels[i];
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(i);
      }
      this._map = m;
    }
    return this._map;
  };
  /* 라벨의 모든 위치. 중복이면 여러 개가 나온다. */
  Index.prototype.positions = function (label) {
    var p = this.map().get(label);
    return p ? p.slice() : [];
  };
  Index.prototype.has = function (label) { return this.map().has(label); };
  Index.prototype.hasDuplicates = function () {
    return this.map().size !== this.labels.length;
  };
  Index.prototype.equals = function (other) { return arrEq(this.labels, other.labels); };
  Index.prototype.copy = function () { return new Index(this.labels, this.name); };
  Index.prototype.take = function (positions) {
    var out = [];
    for (var i = 0; i < positions.length; i++) out.push(this.labels[positions[i]]);
    return new Index(out, this.name);
  };
  /* 정수 라벨의 기본 인덱스. pandas 의 RangeIndex. */
  Index.range = function (n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    var ix = new Index(a, null);
    ix.isRange = true;
    return ix;
  };
  /* 합집합을 정렬해서 만든다. 인덱스가 다를 때만 쓴다. */
  Index.sortedUnion = function (a, b) {
    var seen = new Set(), out = [];
    a.labels.concat(b.labels).forEach(function (l) {
      if (!seen.has(l)) { seen.add(l); out.push(l); }
    });
    out.sort(cmpLabel);
    return out;
  };

  // ──────────────────────────────────────────────────────────── 정렬(alignment)

  /* 두 인덱스를 짝지어 (왼쪽위치, 오른쪽위치, 라벨) 목록을 만든다.
   * 위치가 -1 이면 그 쪽에 라벨이 없다는 뜻(결과는 NaN).
   *
   * 검증된 규칙:
   *   ① 인덱스가 완전히 동일하면 정렬하지 않고 위치로 짝짓는다.
   *   ② 다르면 합집합을 정렬한다.
   *   ③ 중복 라벨은 곱집합. 왼쪽이 바깥 루프, 오른쪽이 안쪽 루프.
   */
  function alignIndexes(left, right) {
    if (left.equals(right)) {
      var pairs = [];
      for (var i = 0; i < left.labels.length; i++) pairs.push([i, i, left.labels[i]]);
      trace.push('align', { mode: 'identical', rows: pairs.length });
      return { pairs: pairs, labels: left.labels.slice(), name: left.name };
    }
    var union = Index.sortedUnion(left, right);
    var outPairs = [], outLabels = [];
    for (var u = 0; u < union.length; u++) {
      var L = union[u];
      var lp = left.positions(L), rp = right.positions(L);
      if (lp.length && rp.length) {
        for (var a = 0; a < lp.length; a++) {          // 왼쪽이 바깥
          for (var b = 0; b < rp.length; b++) {        // 오른쪽이 안쪽
            outPairs.push([lp[a], rp[b], L]);
            outLabels.push(L);
          }
        }
      } else if (lp.length) {
        for (var c = 0; c < lp.length; c++) { outPairs.push([lp[c], -1, L]); outLabels.push(L); }
      } else {
        for (var d = 0; d < rp.length; d++) { outPairs.push([-1, rp[d], L]); outLabels.push(L); }
      }
    }
    trace.push('align', {
      mode: 'union',
      union: union.slice(),
      rows: outPairs.length,
      grew: outPairs.length > Math.max(left.length(), right.length())
    });
    return { pairs: outPairs, labels: outLabels, name: left.name === right.name ? left.name : null };
  }

  // ──────────────────────────────────────────────────────────── Series

  function Series(values, opts) {
    opts = opts || {};
    if (values instanceof ColRef) {
      this._col = values;
    } else {
      this._col = new ColRef(new Block(values.slice()), null);
    }
    var n = this._col.length();
    this.index = opts.index instanceof Index ? opts.index
      : opts.index ? new Index(opts.index) : Index.range(n);
    if (this.index.length() !== n) {
      throw new Error('index 길이(' + this.index.length() + ')와 값 개수(' + n + ')가 다르다');
    }
    this.name = opts.name === undefined ? null : opts.name;
    this._dtype = opts.dtype || null;
  }

  Object.defineProperty(Series.prototype, 'dtype', {
    get: function () {
      if (!this._dtype) this._dtype = inferDtype(this._col.toArray());
      return this._dtype;
    }
  });

  Series.prototype.length = function () { return this._col.length(); };
  Series.prototype.at = function (i) { return this._col.at(i); };
  Series.prototype.toArray = function () { return this._col.toArray(); };
  Series.prototype.values = function () { return this._col.toArray(); };
  Series.prototype.labels = function () { return this.index.labels.slice(); };

  Series.prototype.copy = function () {
    return new Series(this._col.toArray(), { index: this.index.copy(), name: this.name });
  };

  /* 위치로 읽기. 정수 하나 / [start,stop] 슬라이스 / 정수 배열 / 불린 배열 */
  Series.prototype.iloc = function (sel) {
    if (typeof sel === 'number') return this.at(sel < 0 ? this.length() + sel : sel);
    if (sel && sel.slice === true) { // { slice:true, start, stop, step } — 블록을 공유한다
      var st = sel.start === undefined ? 0 : sel.start;
      var sp = sel.stop === undefined ? this.length() : sel.stop;
      var stp = sel.step || 1;
      var view = this._col.sliceView(st, sp, stp);
      var pos = [];
      for (var i = st; stp > 0 ? i < sp : i > sp; i += stp) pos.push(i);
      trace.push('slice', { shared: true, rows: pos.length });
      return new Series(view, { index: this.index.take(pos), name: this.name });
    }
    var positions = normalizeSelector(sel, this.length());
    trace.push('take', { shared: false, rows: positions.length });
    return new Series(this._col.take(positions), {
      index: this.index.take(positions), name: this.name
    });
  };

  /* 라벨로 읽기. 라벨 하나(중복이면 Series) / 라벨 배열 / 불린 배열 */
  Series.prototype.loc = function (sel) {
    if (Array.isArray(sel) && sel.length && typeof sel[0] === 'boolean') return this.iloc(sel);
    if (Array.isArray(sel)) {
      var pos = [];
      for (var i = 0; i < sel.length; i++) {
        var p = this.index.positions(sel[i]);
        if (!p.length) throw new Error('KeyError: ' + JSON.stringify(sel[i]));
        pos = pos.concat(p);
      }
      return this.iloc(pos);
    }
    var ps = this.index.positions(sel);
    if (!ps.length) throw new Error('KeyError: ' + JSON.stringify(sel));
    if (ps.length === 1) return this.at(ps[0]);
    return this.iloc(ps);
  };

  /* 라벨로 쓰기. 여기서 Copy-on-Write 가 일어난다. */
  Series.prototype.setLoc = function (label, value) {
    var ps = this.index.positions(label);
    if (!ps.length) throw new Error('KeyError: ' + JSON.stringify(label));
    checkAssignable(this.dtype, value);
    var before = this._col.block.id;
    this._col = this._col.ensureOwn();
    if (this._col.block.id !== before) {
      trace.push('cow', { where: 'Series.setLoc', from: before, to: this._col.block.id });
    }
    for (var i = 0; i < ps.length; i++) this._col.block.data[ps[i]] = value;
    this._dtype = null; // dtype 이 올라갈 수 있다
    return this;
  };

  Series.prototype.setILoc = function (i, value) {
    checkAssignable(this.dtype, value);
    var before = this._col.block.id;
    this._col = this._col.ensureOwn();
    if (this._col.block.id !== before) {
      trace.push('cow', { where: 'Series.setILoc', from: before, to: this._col.block.id });
    }
    this._col.block.data[i] = value;
    this._dtype = null;
    return this;
  };

  Series.prototype.head = function (n) {
    n = n === undefined ? 5 : n;
    return this.iloc({ slice: true, start: 0, stop: Math.min(n, this.length()) });
  };
  Series.prototype.tail = function (n) {
    n = n === undefined ? 5 : n;
    return this.iloc({ slice: true, start: Math.max(0, this.length() - n), stop: this.length() });
  };

  // 결측
  Series.prototype.isna = function () {
    return new Series(this.toArray().map(isNA), { index: this.index.copy(), name: this.name });
  };
  Series.prototype.notna = function () {
    return new Series(this.toArray().map(function (v) { return !isNA(v); }),
      { index: this.index.copy(), name: this.name });
  };
  /* 결과 dtype 은 값에서 다시 추론하지 않고 원래 dtype 과 채울 값을 승격시킨다.
   * 그래야 float64 컬럼이 fillna(0) 후에도 float64 로 남는다(pandas 와 동일). */
  Series.prototype.fillna = function (value) {
    var vals = this.toArray().map(function (v) { return isNA(v) ? value : v; });
    var dt = this.toArray().some(isNA)
      ? promoteDtype(this.dtype, inferDtype([value]))
      : this.dtype;
    return new Series(vals, { index: this.index.copy(), name: this.name, dtype: dt });
  };
  Series.prototype.dropna = function () {
    var pos = [];
    for (var i = 0; i < this.length(); i++) if (!isNA(this.at(i))) pos.push(i);
    return this.iloc(pos);
  };

  // 변환
  Series.prototype.replace = function (mapOrFrom, to) {
    var m = mapOrFrom;
    if (arguments.length === 2) { m = new Map(); m.set(mapOrFrom, to); }
    else if (!(m instanceof Map)) { var mm = new Map(); Object.keys(m).forEach(function (k) { mm.set(k, m[k]); }); m = mm; }
    var replaced = [];
    var vals = this.toArray().map(function (v) {
      if (m.has(v)) { replaced.push(m.get(v)); return m.get(v); }
      if (isNA(v) && m.has(null)) { replaced.push(m.get(null)); return m.get(null); }
      return v;
    });
    // pandas 는 원래 dtype 을 기억한다. 문자열 컬럼을 숫자로 replace 하면 str 이 아니라 object 가 된다.
    var dt = replaced.length ? promoteDtype(this.dtype, inferDtype(replaced)) : this.dtype;
    return new Series(vals, { index: this.index.copy(), name: this.name, dtype: dt });
  };

  Series.prototype.astype = function (dt) {
    var vals = this.toArray().map(function (v) {
      if (isNA(v)) return dt === 'str' ? 'nan' : NA;
      if (dt === 'int64') return Math.trunc(Number(v));
      if (dt === 'float64') return Number(v);
      if (dt === 'str') return String(v);
      if (dt === 'bool') return !!v;
      return v;
    });
    return new Series(vals, { index: this.index.copy(), name: this.name, dtype: dt });
  };

  /* pd.to_numeric 에 대응. 숫자로 못 바꾸면 errors 에 따라 처리한다. */
  Series.prototype.toNumeric = function (errors) {
    errors = errors || 'raise';
    var out = [];
    for (var i = 0; i < this.length(); i++) {
      var v = this.at(i);
      if (isNA(v)) { out.push(NA); continue; }
      var n = typeof v === 'number' ? v : Number(String(v).trim());
      if (isNaN(n)) {
        if (errors === 'coerce') { out.push(NA); continue; }
        throw new Error('ValueError: Unable to parse string ' + JSON.stringify(v));
      }
      out.push(n);
    }
    return new Series(out, { index: this.index.copy(), name: this.name });
  };

  Series.prototype.map = function (fn) {
    return new Series(this.toArray().map(function (v, i) { return fn(v, i); }),
      { index: this.index.copy(), name: this.name });
  };
  Series.prototype.apply = Series.prototype.map;

  // 집계
  Series.prototype.count = function () {
    var c = 0;
    for (var i = 0; i < this.length(); i++) if (!isNA(this.at(i))) c++;
    return c;
  };
  /* dtype 이 object 인데 문자열이 섞여 있으면 pandas 는 산술에서 죽는다.
   * 이건 버그가 아니라 재현해야 하는 동작이다 — 교재 8장의 fillna('0') 사례. */
  Series.prototype._requireNumeric = function () {
    if (this.dtype !== 'object') return;
    for (var i = 0; i < this.length(); i++) {
      var v = this.at(i);
      if (!isNA(v) && typeof v !== 'number' && typeof v !== 'boolean') {
        throw new Error("TypeError: unsupported operand type(s) for +: 'float' and '" +
          (typeof v === 'string' ? 'str' : typeof v) + "'");
      }
    }
  };
  /* ★ 불린은 숫자로 센다. pandas 와 같다.
   *   pd.Series([True,False,True]).sum()  -> 2
   *   pd.Series([True,False,True]).mean() -> 0.666…
   * 이게 없으면 **`s.isna().sum()` 이 0 을 반환한다** — 교재 8장이 가르치는
   * 가장 흔한 관용구가 조용히 틀린다. (실제로 그런 버그가 있었다.)
   * 참고: pandas 의 bool `min()/max()` 는 True/False 를 주지만 여기서는 1/0 을 준다.
   * 교재가 쓰지 않는 경로라 그대로 두었다. */
  Series.prototype._nums = function () {
    var a = [];
    for (var i = 0; i < this.length(); i++) {
      var v = this.at(i);
      if (typeof v === 'boolean') a.push(v ? 1 : 0);
      else if (isNum(v)) a.push(v);
    }
    return a;
  };
  Series.prototype.sum = function () {
    this._requireNumeric();
    return this._nums().reduce(function (s, v) { return s + v; }, 0);
  };
  Series.prototype.mean = function () {
    this._requireNumeric();
    var a = this._nums();
    return a.length ? this.sum() / a.length : NA;
  };
  /* pandas 기본은 ddof=1. numpy 의 np.std(기본 ddof=0)와 다르다. */
  Series.prototype.std = function (ddof) {
    ddof = ddof === undefined ? 1 : ddof;
    this._requireNumeric();
    var a = this._nums();
    if (a.length - ddof <= 0) return NA;
    var m = a.reduce(function (s, v) { return s + v; }, 0) / a.length;
    var ss = a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0);
    return Math.sqrt(ss / (a.length - ddof));
  };
  Series.prototype.min = function () { var a = this._nums(); return a.length ? Math.min.apply(null, a) : NA; };
  Series.prototype.max = function () { var a = this._nums(); return a.length ? Math.max.apply(null, a) : NA; };
  /* pandas 기본 보간법(linear). describe 의 25%/50%/75% 가 이걸 쓴다. */
  Series.prototype.quantile = function (q) {
    var a = this._nums().slice().sort(function (x, y) { return x - y; });
    if (!a.length) return NA;
    var pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return a[lo];
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  };
  Series.prototype.median = function () { return this.quantile(0.5); };

  /* 가장 많이 나온 값들. pandas 는 동률이면 정렬해서 여러 개를 준다. */
  Series.prototype.mode = function () {
    var vc = this.valueCounts();
    if (!vc.length()) return new Series([], { index: [] });
    var top = vc.at(0);
    var vals = [];
    for (var i = 0; i < vc.length(); i++) {
      if (vc.at(i) === top) vals.push(vc.index.at(i));
    }
    vals.sort(cmpLabel);
    // ★ 원본 dtype 을 물려준다. float64 Series 의 mode 는 float64 다(pandas 와 같다).
    //   값에서 다시 추론하면 [1.0] 이 int64 로 잘못 내려간다.
    return new Series(vals, {
      index: Index.range(vals.length).labels, name: this.name, dtype: this.dtype
    });
  };

  Series.prototype.unique = function () {
    var seen = new Set(), out = [];
    for (var i = 0; i < this.length(); i++) {
      var v = this.at(i), k = isNA(v) ? ' NA' : v;
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
    return out;
  };
  Series.prototype.nunique = function () {
    var s = new Set();
    for (var i = 0; i < this.length(); i++) { var v = this.at(i); if (!isNA(v)) s.add(v); }
    return s.size;
  };

  /* pandas 3.0: 결과 Series 의 name 은 'count', 인덱스 이름은 원래 컬럼명이다. */
  Series.prototype.valueCounts = function (opts) {
    opts = opts || {};
    var dropna = opts.dropna === undefined ? true : opts.dropna;
    /* ★ 결측을 셀 때(dropna:false) NaN 을 맨 뒤에 붙이면 안 된다.
     * pandas 는 NaN 도 다른 값과 똑같이 취급해 개수 내림차순으로 놓고,
     * 개수가 같으면 **처음 나온 순서**로 정렬한다.
     * ['S','C',NaN,'S','Q','S'] -> S(3), C(1), NaN(1), Q(1)  (Q 가 NaN 뒤다) */
    var NA_KEY = { na: true };            // Map 키로 쓸 고유 표식
    var counts = new Map();
    for (var i = 0; i < this.length(); i++) {
      var v = this.at(i);
      if (isNA(v)) {
        if (dropna) continue;
        counts.set(NA_KEY, (counts.get(NA_KEY) || 0) + 1);
        continue;
      }
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    // Map 은 삽입 순서를 유지하므로 안정 정렬만 하면 "처음 나온 순서" 가 보존된다
    var entries = Array.from(counts.entries()).map(function (e) {
      return [e[0] === NA_KEY ? NA : e[0], e[1]];
    });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    return new Series(entries.map(function (e) { return e[1]; }), {
      index: new Index(entries.map(function (e) { return e[0]; }), this.name),
      name: 'count'
    });
  };

  Series.prototype.sortValues = function (opts) {
    opts = opts || {};
    var asc = opts.ascending === undefined ? true : opts.ascending;
    var self = this, pos = [];
    for (var i = 0; i < this.length(); i++) pos.push(i);
    // 결측은 언제나 맨 뒤 (pandas na_position='last')
    pos.sort(function (a, b) {
      var va = self.at(a), vb = self.at(b);
      if (isNA(va) && isNA(vb)) return a - b;
      if (isNA(va)) return 1;
      if (isNA(vb)) return -1;
      var c = cmpLabel(va, vb);
      if (c === 0) return a - b;
      return asc ? c : -c;
    });
    return this.iloc(pos);
  };

  /* 산술 — 인덱스로 짝짓는다. 이 프로젝트의 6장이 여기서 나온다. */
  function binop(name, fn) {
    Series.prototype[name] = function (other, opts) {
      opts = opts || {};
      if (!(other instanceof Series)) { // 스칼라
        var self = this;
        return new Series(this.toArray().map(function (v) {
          return isNA(v) ? NA : fn(v, other);
        }), { index: this.index.copy(), name: this.name });
      }
      var al = alignIndexes(this.index, other.index);
      var out = [];
      var reindexed = false;   // 한쪽에 없는 라벨이 있었는가
      for (var i = 0; i < al.pairs.length; i++) {
        var lp = al.pairs[i][0], rp = al.pairs[i][1];
        if (lp === -1 || rp === -1) reindexed = true;
        var lv = lp === -1 ? NA : this.at(lp);
        var rv = rp === -1 ? NA : other.at(rp);
        if (isNA(lv) && opts.fillValue !== undefined) lv = opts.fillValue;
        if (isNA(rv) && opts.fillValue !== undefined) rv = opts.fillValue;
        out.push(isNA(lv) || isNA(rv) ? NA : fn(lv, rv));
      }
      /* ★ 정렬 과정에서 한쪽에 없는 라벨이 있었으면 pandas 는 결과를 float64 로 올린다.
       * fill_value 로 값이 채워져 결과가 전부 정수여도 그렇다 — 중간에 NaN 이 생기기 때문이다.
       * 값에서 dtype 을 다시 추론하면 int64 가 되어 pandas 와 어긋난다. */
      var dt = null;
      if (reindexed && isNumericDtype(this.dtype) && isNumericDtype(other.dtype)) dt = 'float64';
      return new Series(out, { index: new Index(al.labels, al.name), name: null, dtype: dt });
    };
  }
  binop('add', function (a, b) { return a + b; });
  binop('sub', function (a, b) { return a - b; });
  binop('mul', function (a, b) { return a * b; });
  binop('div', function (a, b) { return a / b; });

  /* 비교 — 불린 Series 를 만든다. 마스크의 재료. */
  function cmpop(name, fn) {
    Series.prototype[name] = function (other) {
      var isS = other instanceof Series;
      var out = [];
      for (var i = 0; i < this.length(); i++) {
        var lv = this.at(i), rv = isS ? other.at(i) : other;
        out.push(isNA(lv) || isNA(rv) ? false : fn(lv, rv));
      }
      return new Series(out, { index: this.index.copy(), name: this.name, dtype: 'bool' });
    };
  }
  cmpop('gt', function (a, b) { return a > b; });
  cmpop('ge', function (a, b) { return a >= b; });
  cmpop('lt', function (a, b) { return a < b; });
  cmpop('le', function (a, b) { return a <= b; });
  cmpop('eq', function (a, b) { return a === b; });
  cmpop('ne', function (a, b) { return a !== b; });

  Series.prototype.and = function (other) {
    var out = [];
    for (var i = 0; i < this.length(); i++) out.push(!!this.at(i) && !!other.at(i));
    return new Series(out, { index: this.index.copy(), dtype: 'bool' });
  };
  Series.prototype.or = function (other) {
    var out = [];
    for (var i = 0; i < this.length(); i++) out.push(!!this.at(i) || !!other.at(i));
    return new Series(out, { index: this.index.copy(), dtype: 'bool' });
  };
  Series.prototype.not = function () {
    return new Series(this.toArray().map(function (v) { return !v; }),
      { index: this.index.copy(), dtype: 'bool' });
  };

  Series.prototype.describe = function () {
    if (isNumericDtype(this.dtype)) {
      return new Series(
        [this.count(), this.mean(), this.std(), this.min(),
         this.quantile(0.25), this.median(), this.quantile(0.75), this.max()],
        { index: new Index(['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']), name: this.name }
      );
    }
    var vc = this.valueCounts();
    return new Series([this.count(), this.nunique(), vc.length() ? vc.index.at(0) : NA, vc.length() ? vc.at(0) : NA],
      { index: new Index(['count', 'unique', 'top', 'freq']), name: this.name });
  };

  Series.prototype.toString = function () {
    var lines = [];
    for (var i = 0; i < this.length(); i++) {
      lines.push(String(this.index.at(i)) + '    ' + fmt(this.at(i)));
    }
    if (this.name !== null) lines.push('Name: ' + this.name + ', dtype: ' + this.dtype);
    else lines.push('dtype: ' + this.dtype);
    return lines.join('\n');
  };

  // ──────────────────────────────────────────────────────────── 선택자 정규화

  /* 정수 배열 / 불린 배열 / Series(불린) 를 위치 배열로 바꾼다. */
  function normalizeSelector(sel, n) {
    if (sel instanceof Series) sel = sel.toArray();
    if (!Array.isArray(sel)) throw new Error('선택자를 이해할 수 없다: ' + sel);
    if (sel.length && typeof sel[0] === 'boolean') {
      if (sel.length !== n) {
        throw new Error('불린 마스크 길이(' + sel.length + ')가 행 수(' + n + ')와 다르다');
      }
      var pos = [];
      for (var i = 0; i < sel.length; i++) if (sel[i]) pos.push(i);
      return pos;
    }
    return sel.map(function (i) { return i < 0 ? n + i : i; });
  }

  function fmt(v) {
    if (isNA(v)) return 'NaN';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      return String(Math.round(v * 1e6) / 1e6);
    }
    return String(v);
  }

  // ──────────────────────────────────────────────────────────── DataFrame

  /* columns: 이름 배열, cols: 이름 -> ColRef */
  function DataFrame(columns, cols, index) {
    this.columns = columns.slice();
    this._cols = cols;
    this.index = index;
    this._dtypes = {};
  }

  /* { 컬럼명: 값배열 } 로 만든다. */
  DataFrame.fromColumns = function (obj, opts) {
    opts = opts || {};
    var names = opts.columns ? opts.columns.slice() : Object.keys(obj);
    var n = null, cols = {};
    names.forEach(function (name) {
      var vals = obj[name];
      if (vals === undefined) return;          // columns= 에만 있는 이름 -> 아래에서 NaN 컬럼
      if (n === null) n = vals.length;
      else if (vals.length !== n) throw new Error("컬럼 '" + name + "' 의 길이가 다르다");
    });
    if (n === null) n = 0;
    names.forEach(function (name) {
      var vals = obj[name];
      if (vals === undefined) { vals = new Array(n).fill(NA); } // pandas 와 같이 NaN 컬럼이 생긴다
      cols[name] = new ColRef(new Block(vals.slice()), null);
    });
    var index = opts.index instanceof Index ? opts.index
      : opts.index ? new Index(opts.index) : Index.range(n);
    return new DataFrame(names, cols, index);
  };

  /* [{a:1,b:2}, ...] 레코드 배열로 만든다. data.js 가 이 형태로 온다. */
  DataFrame.fromRecords = function (records, opts) {
    opts = opts || {};
    var names = opts.columns ? opts.columns.slice() : [];
    if (!names.length) {
      var seen = new Set();
      records.forEach(function (r) {
        Object.keys(r).forEach(function (k) { if (!seen.has(k)) { seen.add(k); names.push(k); } });
      });
    }
    var obj = {};
    names.forEach(function (name) {
      obj[name] = records.map(function (r) {
        var v = r[name];
        return v === undefined ? NA : v;
      });
    });
    return DataFrame.fromColumns(obj, { columns: names, index: opts.index });
  };

  DataFrame.prototype.nrows = function () { return this.index.length(); };
  DataFrame.prototype.ncols = function () { return this.columns.length; };
  Object.defineProperty(DataFrame.prototype, 'shape', {
    get: function () { return [this.nrows(), this.ncols()]; }
  });

  /* 선언된 dtype 을 파생 프레임에 물려준다.
   * JS 는 1 과 1.0 을 구분하지 못하므로 data.js 가 컬럼 dtype 을 함께 실어 준다.
   * 이걸 물려주지 않으면 float 컬럼이 파생 프레임에서 int64 로 되돌아간다. */
  DataFrame.prototype._inherit = function (child, names) {
    var self = this;
    (names || child.columns).forEach(function (n) {
      if (self._dtypes[n]) child._dtypes[n] = self._dtypes[n];
    });
    return child;
  };

  /* 컬럼별 dtype 을 명시한다. 빌드가 만든 data.js 가 부른다. */
  DataFrame.prototype.declareDtypes = function (map) {
    var self = this;
    Object.keys(map || {}).forEach(function (n) {
      if (self.columns.indexOf(n) !== -1) self._dtypes[n] = map[n];
    });
    return this;
  };

  /* 컬럼 하나를 Series 로 꺼낸다. 블록을 공유한다(진짜 pandas 도 그렇다). */
  DataFrame.prototype.col = function (name) {
    if (!(name in this._cols)) throw new Error('KeyError: ' + JSON.stringify(name));
    var ref = this._cols[name];
    // borrowed=true — 읽기용으로 빌린다. refs 를 올리지 않으므로 표를 여러 번 그려도
    // 참조 수가 누적되지 않는다. 여기에 쓰면 ensureOwn 이 무조건 복사한다(연쇄 할당).
    var shared = new ColRef(ref.block, ref.slice, true);
    return new Series(shared, {
      index: this.index.copy(), name: name, dtype: this._dtypes[name] || null
    });
  };

  /* 여러 컬럼 -> DataFrame. 역시 블록 공유. */
  DataFrame.prototype.cols = function (names) {
    var self = this, out = {};
    names.forEach(function (n) {
      if (!(n in self._cols)) throw new Error('KeyError: ' + JSON.stringify(n));
      var r = self._cols[n];
      out[n] = new ColRef(r.block, r.slice);
    });
    return this._inherit(new DataFrame(names, out, this.index.copy()), names);
  };

  DataFrame.prototype.dtypes = function () {
    var self = this, out = {};
    this.columns.forEach(function (n) { out[n] = self.col(n).dtype; });
    return out;
  };

  /* 컬럼 대입. 여기서 Copy-on-Write 가 일어난다. */
  DataFrame.prototype.setCol = function (name, values) {
    var vals;
    if (values instanceof Series) {
      // pandas 처럼 인덱스에 맞춰 재배치한다
      var self = this;
      vals = this.index.labels.map(function (L) {
        var p = values.index.positions(L);
        return p.length ? values.at(p[0]) : NA;
      });
    } else if (Array.isArray(values)) {
      if (values.length !== this.nrows()) {
        throw new Error('길이(' + values.length + ')가 행 수(' + this.nrows() + ')와 다르다');
      }
      vals = values.slice();
    } else {
      vals = new Array(this.nrows()).fill(values); // 스칼라 브로드캐스트
    }
    if (name in this._cols) this._cols[name].release();
    else this.columns.push(name);
    delete this._dtypes[name];      // 새 데이터이므로 선언된 dtype 은 무효다
    this._cols[name] = new ColRef(new Block(vals), null);
    trace.push('setCol', { name: name, block: this._cols[name].block.id });
    return this;
  };

  /* 셀 하나 또는 조건 대입. .loc[조건, '컬럼'] = 값 에 대응한다.
   * 이게 교재가 가르치는 "바른 형태" 다. */
  DataFrame.prototype.setLoc = function (rowSel, colName, value) {
    if (!(colName in this._cols)) throw new Error('KeyError: ' + JSON.stringify(colName));
    checkAssignable(this.col(colName).dtype, value);   // str 컬럼에 숫자 대입을 막는다 (정정표 C-7)
    var positions;
    if (rowSel instanceof Series || (Array.isArray(rowSel) && typeof rowSel[0] === 'boolean')) {
      positions = normalizeSelector(rowSel, this.nrows());
    } else if (Array.isArray(rowSel)) {
      positions = [];
      for (var i = 0; i < rowSel.length; i++) positions = positions.concat(this.index.positions(rowSel[i]));
    } else {
      positions = this.index.positions(rowSel);
      if (!positions.length) throw new Error('KeyError: ' + JSON.stringify(rowSel));
    }
    var before = this._cols[colName].block.id;
    this._cols[colName] = this._cols[colName].ensureOwn();
    if (this._cols[colName].block.id !== before) {
      trace.push('cow', { where: 'DataFrame.setLoc', column: colName, from: before, to: this._cols[colName].block.id });
    }
    for (var k = 0; k < positions.length; k++) this._cols[colName].block.data[positions[k]] = value;
    return this;
  };

  /* 행 슬라이싱 — 블록을 공유한다(shares_memory True). */
  DataFrame.prototype.islice = function (start, stop, step) {
    step = step || 1;
    start = start === undefined ? 0 : start;
    stop = stop === undefined ? this.nrows() : stop;
    if (start < 0) start += this.nrows();
    if (stop < 0) stop += this.nrows();
    var self = this, out = {}, pos = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) pos.push(i);
    this.columns.forEach(function (n) { out[n] = self._cols[n].sliceView(start, stop, step); });
    trace.push('slice', { shared: true, rows: pos.length });
    return this._inherit(new DataFrame(this.columns, out, this.index.take(pos)));
  };

  /* 불린 마스크 / 정수 배열 — 새 블록을 만든다(shares_memory False).
   * 이 비대칭이 학생이 겪는 혼란의 정체다. */
  DataFrame.prototype.take = function (sel) {
    var positions = normalizeSelector(sel, this.nrows());
    var self = this, out = {};
    this.columns.forEach(function (n) { out[n] = self._cols[n].take(positions); });
    trace.push('take', { shared: false, rows: positions.length });
    return this._inherit(new DataFrame(this.columns, out, this.index.take(positions)));
  };
  DataFrame.prototype.mask = DataFrame.prototype.take;

  /* iloc[행, 열] */
  DataFrame.prototype.iloc = function (rowSel, colSel) {
    var frame = this;
    if (rowSel !== undefined && rowSel !== null) {
      if (typeof rowSel === 'number') {
        var r = rowSel < 0 ? this.nrows() + rowSel : rowSel;
        frame = this.take([r]);
      } else if (rowSel && rowSel.slice === true) {
        frame = this.islice(rowSel.start, rowSel.stop, rowSel.step);
      } else {
        frame = this.take(rowSel);
      }
    }
    if (colSel === undefined || colSel === null) return frame;
    if (typeof colSel === 'string') {
      throw new Error(
        'ValueError: Location based indexing can only have [integer, integer slice, ' +
        'listlike of integers, boolean array] types'
      );
    }
    var names;
    if (typeof colSel === 'number') names = [frame.columns[colSel < 0 ? frame.columns.length + colSel : colSel]];
    else if (colSel && colSel.slice === true) {
      names = frame.columns.slice(colSel.start, colSel.stop === undefined ? undefined : colSel.stop);
    } else names = colSel.map(function (i) { return frame.columns[i < 0 ? frame.columns.length + i : i]; });
    return frame.cols(names);
  };

  /* loc[행, 열] — 라벨 기준. 슬라이스는 끝이 포함된다. */
  DataFrame.prototype.loc = function (rowSel, colSel) {
    var frame = this;
    if (rowSel !== undefined && rowSel !== null) {
      if (rowSel instanceof Series || (Array.isArray(rowSel) && typeof rowSel[0] === 'boolean')) {
        frame = this.take(rowSel);
      } else if (rowSel && rowSel.range === true) { // { range:true, from, to } — 끝 포함
        var fp = this.index.positions(rowSel.from), tp = this.index.positions(rowSel.to);
        if (!fp.length) throw new Error('KeyError: ' + JSON.stringify(rowSel.from));
        if (!tp.length) throw new Error('KeyError: ' + JSON.stringify(rowSel.to));
        var pos = [];
        for (var i = fp[0]; i <= tp[tp.length - 1]; i++) pos.push(i);
        frame = this.take(pos);
      } else if (Array.isArray(rowSel)) {
        var ps = [];
        for (var j = 0; j < rowSel.length; j++) {
          var p = this.index.positions(rowSel[j]);
          if (!p.length) throw new Error('KeyError: ' + JSON.stringify(rowSel[j]));
          ps = ps.concat(p);
        }
        frame = this.take(ps);
      } else {
        var single = this.index.positions(rowSel);
        if (!single.length) throw new Error('KeyError: ' + JSON.stringify(rowSel));
        frame = this.take(single);
      }
    }
    if (colSel === undefined || colSel === null) return frame;
    if (typeof colSel === 'string') return frame.col(colSel);
    if (colSel && colSel.range === true) {
      var a = frame.columns.indexOf(colSel.from), b = frame.columns.indexOf(colSel.to);
      if (a === -1) throw new Error('KeyError: ' + JSON.stringify(colSel.from));
      if (b === -1) throw new Error('KeyError: ' + JSON.stringify(colSel.to));
      return frame.cols(frame.columns.slice(a, b + 1));
    }
    return frame.cols(colSel);
  };

  DataFrame.prototype.head = function (n) {
    n = n === undefined ? 5 : n;
    return this.islice(0, Math.min(n, this.nrows()));
  };
  DataFrame.prototype.tail = function (n) {
    n = n === undefined ? 5 : n;
    return this.islice(Math.max(0, this.nrows() - n), this.nrows());
  };

  DataFrame.prototype.copy = function () {
    var self = this, out = {};
    this.columns.forEach(function (n) { out[n] = new ColRef(new Block(self._cols[n].toArray()), null); });
    trace.push('copy', { shared: false });
    return this._inherit(new DataFrame(this.columns, out, this.index.copy()));
  };

  DataFrame.prototype.drop = function (labels, opts) {
    opts = opts || {};
    var axis = opts.axis === undefined ? 0 : opts.axis;
    labels = Array.isArray(labels) ? labels : [labels];
    if (axis === 1) {
      var keep = this.columns.filter(function (c) { return labels.indexOf(c) === -1; });
      var missing = labels.filter(function (l) { return this.columns.indexOf(l) === -1; }, this);
      if (missing.length) throw new Error('KeyError: ' + JSON.stringify(missing));
      var res = this.cols(keep);
      if (opts.inplace) { this.columns = res.columns; this._cols = res._cols; return null; }
      return res;
    }
    var drop = new Set();
    labels.forEach(function (l) { this.index.positions(l).forEach(function (p) { drop.add(p); }); }, this);
    var pos = [];
    for (var i = 0; i < this.nrows(); i++) if (!drop.has(i)) pos.push(i);
    var r = this.take(pos);
    if (opts.inplace) { this._cols = r._cols; this.index = r.index; return null; }
    return r;
  };

  DataFrame.prototype.rename = function (mapping) {
    var self = this, out = {}, names = [];
    this.columns.forEach(function (n) {
      var nn = (mapping && mapping[n] !== undefined) ? mapping[n] : n;
      names.push(nn);
      var r = self._cols[n];
      out[nn] = new ColRef(r.block, r.slice);
    });
    return new DataFrame(names, out, this.index.copy());
  };

  /* 인덱스를 컬럼으로 내리고 0..n-1 로 새로 만든다. */
  DataFrame.prototype.resetIndex = function (opts) {
    opts = opts || {};
    var self = this, out = {}, names = [];
    if (!opts.drop) {
      var nm = this.index.name === null ? 'index' : this.index.name;
      names.push(nm);
      out[nm] = new ColRef(new Block(this.index.labels.slice()), null);
    }
    this.columns.forEach(function (n) {
      names.push(n);
      var r = self._cols[n];
      out[n] = new ColRef(r.block, r.slice);
    });
    return new DataFrame(names, out, Index.range(this.nrows()));
  };

  DataFrame.prototype.setIndex = function (name) {
    var newIndex = new Index(this.col(name).toArray(), name);
    var keep = this.columns.filter(function (c) { return c !== name; });
    var res = this.cols(keep);
    res.index = newIndex;
    return res;
  };

  /* 전치. 행과 열을 바꾼다.
   * ★ 컬럼 dtype 이 섞여 있으면 결과는 object 가 된다 — 한 행에 서로 다른 타입이 모이므로
   * 컬럼별 dtype 을 유지할 수 없다. pandas 도 그렇다. 교재 4장이 이걸 가르친다. */
  DataFrame.prototype.transpose = function () {
    var self = this;
    // ★ 라벨을 String 으로 바꾸지 않는다. 정수 인덱스 0,1,2 는 정수 컬럼 0,1,2 가 되어야 한다
    //   (pandas 와 같다). String 으로 바꾸면 "0" 이 되어 교차 검증이 불일치로 뜬다.
    var newCols = this.index.labels.slice();
    var out = {};
    newCols.forEach(function (label, i) {
      out[label] = self.columns.map(function (c) { return self._cols[c].at(i); });
    });
    var res = new DataFrame(newCols, {}, new Index(this.columns, null));
    // fromColumns 를 쓰면 컬럼 길이 검사를 다시 하므로 그쪽으로 만든다
    res = DataFrame.fromColumns(out, {
      columns: newCols, index: new Index(this.columns.slice(), null)
    });
    trace.push('transpose', { rows: res.nrows(), cols: res.ncols() });
    return res;
  };
  Object.defineProperty(DataFrame.prototype, 'T', {
    get: function () { return this.transpose(); }
  });

  DataFrame.prototype.isna = function () {
    var self = this, out = {};
    this.columns.forEach(function (n) {
      out[n] = new ColRef(new Block(self._cols[n].toArray().map(isNA)), null);
    });
    return new DataFrame(this.columns, out, this.index.copy());
  };

  /* isna().sum() 처럼 컬럼별 합. 결과는 Series. */
  DataFrame.prototype.sum = function () {
    var self = this, vals = [], names = [];
    this.columns.forEach(function (n) {
      var s = self.col(n);
      if (s.dtype === 'bool') {
        var c = 0;
        s.toArray().forEach(function (v) { if (v) c++; });
        vals.push(c); names.push(n);
      } else if (isNumericDtype(s.dtype)) { vals.push(s.sum()); names.push(n); }
    });
    return new Series(vals, { index: new Index(names) });
  };

  DataFrame.prototype.count = function () {
    var self = this;
    return new Series(this.columns.map(function (n) { return self.col(n).count(); }),
      { index: new Index(this.columns) });
  };
  DataFrame.prototype.mean = function () {
    var self = this, vals = [], names = [];
    this.columns.forEach(function (n) {
      var s = self.col(n);
      if (isNumericDtype(s.dtype)) { vals.push(s.mean()); names.push(n); }
    });
    return new Series(vals, { index: new Index(names) });
  };

  DataFrame.prototype.fillna = function (spec) {
    var self = this, out = {};
    this.columns.forEach(function (n) {
      var fill = (spec !== null && typeof spec === 'object') ? spec[n] : spec;
      var vals = self._cols[n].toArray();
      if (fill !== undefined) vals = vals.map(function (v) { return isNA(v) ? fill : v; });
      out[n] = new ColRef(new Block(vals), null);
    });
    return new DataFrame(this.columns, out, this.index.copy());
  };

  DataFrame.prototype.dropna = function (opts) {
    opts = opts || {};
    var subset = opts.subset || this.columns;
    var self = this, pos = [];
    for (var i = 0; i < this.nrows(); i++) {
      var bad = false;
      for (var k = 0; k < subset.length; k++) {
        if (isNA(self._cols[subset[k]].at(i))) { bad = true; break; }
      }
      if (!bad) pos.push(i);
    }
    return this.take(pos);
  };

  DataFrame.prototype.sortValues = function (by, opts) {
    opts = opts || {};
    var asc = opts.ascending === undefined ? true : opts.ascending;
    by = Array.isArray(by) ? by : [by];
    var self = this, pos = [];
    for (var i = 0; i < this.nrows(); i++) pos.push(i);
    pos.sort(function (a, b) {
      for (var k = 0; k < by.length; k++) {
        var va = self._cols[by[k]].at(a), vb = self._cols[by[k]].at(b);
        if (isNA(va) && isNA(vb)) continue;
        if (isNA(va)) return 1;
        if (isNA(vb)) return -1;
        var c = cmpLabel(va, vb);
        if (c !== 0) return asc ? c : -c;
      }
      return a - b;
    });
    return this.take(pos);
  };

  /* 숫자 컬럼만. include:'all' 이면 문자열 컬럼도. */
  DataFrame.prototype.describe = function (opts) {
    opts = opts || {};
    var self = this;
    var names = this.columns.filter(function (n) {
      var dt = self.col(n).dtype;
      return opts.include === 'all' ? true : isNumericDtype(dt);
    });
    var rows = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'];
    var cols = {};
    names.forEach(function (n) {
      var s = self.col(n);
      cols[n] = isNumericDtype(s.dtype)
        ? [s.count(), s.mean(), s.std(), s.min(), s.quantile(0.25), s.median(), s.quantile(0.75), s.max()]
        : [s.count(), NA, NA, NA, NA, NA, NA, NA];
    });
    return DataFrame.fromColumns(cols, { columns: names, index: new Index(rows) });
  };

  /* info() 를 화면에 그릴 재료. pandas 3.0 은 문자열 컬럼 dtype 이 str 이다. */
  DataFrame.prototype.info = function () {
    var self = this;
    return {
      className: 'pandas.DataFrame',
      indexDesc: this.index.isRange
        ? 'RangeIndex: ' + this.nrows() + ' entries, 0 to ' + Math.max(0, this.nrows() - 1)
        : 'Index: ' + this.nrows() + ' entries',
      columns: this.columns.map(function (n, i) {
        var s = self.col(n);
        return { pos: i, name: n, nonNull: s.count(), dtype: s.dtype };
      }),
      dtypeCounts: (function () {
        var m = {};
        self.columns.forEach(function (n) {
          var d = self.col(n).dtype;
          m[d] = (m[d] || 0) + 1;
        });
        return m;
      })()
    };
  };

  // ──────────────────────────────────────────────────────────── groupby

  /* split → apply → combine 세 단계를 눈에 보이게 남긴다.
   * groups() 가 실제 행 묶음을 주므로 화면이 그걸 그린다. */
  function GroupBy(frame, keys) {
    this.frame = frame;
    this.keys = Array.isArray(keys) ? keys : [keys];
    var groups = new Map(), order = [];
    for (var i = 0; i < frame.nrows(); i++) {
      var parts = [];
      for (var k = 0; k < this.keys.length; k++) parts.push(frame._cols[this.keys[k]].at(i));
      if (parts.some(isNA)) continue;              // pandas 는 NaN 키를 기본으로 버린다
      var kk = JSON.stringify(parts);
      if (!groups.has(kk)) { groups.set(kk, { key: parts, rows: [] }); order.push(kk); }
      groups.get(kk).rows.push(i);
    }
    // 키 순으로 정렬 (pandas sort=True 기본)
    order.sort(function (a, b) {
      var ka = groups.get(a).key, kb = groups.get(b).key;
      for (var i = 0; i < ka.length; i++) {
        var c = cmpLabel(ka[i], kb[i]);
        if (c !== 0) return c;
      }
      return 0;
    });
    this._order = order;
    this._groups = groups;
    trace.push('groupby-split', {
      keys: this.keys,
      groups: order.map(function (k) {
        return { key: groups.get(k).key, size: groups.get(k).rows.length };
      })
    });
  }
  GroupBy.prototype.groups = function () {
    var g = this._groups;
    return this._order.map(function (k) { return { key: g.get(k).key, rows: g.get(k).rows.slice() }; });
  };
  GroupBy.prototype.size = function () {
    var g = this._groups;
    return new Series(this._order.map(function (k) { return g.get(k).rows.length; }), {
      index: new Index(this._order.map(function (k) {
        var key = g.get(k).key;
        return key.length === 1 ? key[0] : key.join(' / ');
      }), this.keys.join(' / ')),
      name: 'size'
    });
  };
  /* agg({컬럼: '함수'}) 또는 agg(컬럼, '함수') */
  GroupBy.prototype.agg = function (spec) {
    var self = this, g = this._groups;
    var colNames = Object.keys(spec);
    var out = {};
    colNames.forEach(function (cn) { out[cn] = []; });
    this._order.forEach(function (k) {
      var rows = g.get(k).rows;
      colNames.forEach(function (cn) {
        var sub = new Series(self.frame._cols[cn].take(rows), { index: Index.range(rows.length) });
        out[cn].push(applyAgg(sub, spec[cn]));
      });
    });
    trace.push('groupby-combine', { columns: colNames, rows: this._order.length });
    return DataFrame.fromColumns(out, {
      columns: colNames,
      index: new Index(this._order.map(function (k) {
        var key = g.get(k).key;
        return key.length === 1 ? key[0] : key.join(' / ');
      }), this.keys.join(' / '))
    });
  };
  /* 컬럼 하나에 함수 하나 -> Series */
  GroupBy.prototype.aggCol = function (colName, how) {
    var d = {};
    d[colName] = how;
    var f = this.agg(d);
    return f.col(colName);
  };

  function applyAgg(series, how) {
    if (typeof how === 'function') return how(series);
    switch (how) {
      case 'mean': return series.mean();
      case 'sum': return series.sum();
      case 'min': return series.min();
      case 'max': return series.max();
      case 'std': return series.std();
      case 'median': return series.median();
      case 'count': return series.count();
      case 'nunique': return series.nunique();
      case 'first': return series.length() ? series.at(0) : NA;
      default: throw new Error('모르는 집계 함수: ' + how);
    }
  }

  DataFrame.prototype.groupby = function (keys) { return new GroupBy(this, keys); };

  // ─────────────────────────────────────────────────────────── DataFrame 산술

  /* 컬럼 합집합. ★ Series 인덱스 합집합과 규칙이 다르다 (실제 pandas 확인).
   *   · 라벨 타입이 모두 같으면 정렬한다        ['a','b'] ∪ ['b','c'] -> ['a','b','c']
   *   · 타입이 섞이면 정렬하지 않고 왼쪽→오른쪽  ['a'..'d'] ∪ [0..3]  -> ['a','b','c','d',0,1,2,3]
   * 두 번째가 교재 6.6절의 예제다. 정렬해 버리면 숫자가 앞으로 와서 교재와 어긋난다.
   * (Series 쪽은 섞여도 정렬된다 — alignIndexes 를 그대로 쓴다.) */
  function unionColumns(left, right) {
    var all = left.concat(right.filter(function (c) { return left.indexOf(c) === -1; }));
    var types = {};
    all.forEach(function (c) { types[typeof c] = 1; });
    if (Object.keys(types).length > 1) return all;    // 섞였다 -> 순서 유지
    return all.slice().sort(cmpLabel);
  }

  /* df.add(other) — other 는 DataFrame, Series, 스칼라.
   * Series 를 주면 기본은 **컬럼**에 맞춘다. axis:0 을 주면 행에 맞춘다. */
  function frameBinop(name) {
    DataFrame.prototype[name] = function (other, opts) {
      opts = opts || {};
      var self = this;

      if (other instanceof DataFrame) {
        var names = unionColumns(this.columns, other.columns);
        var out = {}, idx = null;
        names.forEach(function (c) {
          var ls = self.columns.indexOf(c) !== -1 ? self.col(c) : null;
          var rs = other.columns.indexOf(c) !== -1 ? other.col(c) : null;
          var res;
          if (ls && rs) res = ls[name](rs);
          else {
            // 한쪽에만 있는 컬럼은 전부 NaN 이 된다
            var base = ls || rs;
            var otherFrame = ls ? other : self;
            res = base[name](new Series(new Array(otherFrame.nrows()).fill(NA),
              { index: otherFrame.index.copy() }));
          }
          if (!idx) idx = res.index;
          out[c] = res.toArray();
        });
        trace.push('frame-binop', { op: name, columns: names.slice(), rows: idx ? idx.length() : 0 });
        return DataFrame.fromColumns(out, { columns: names, index: idx });
      }

      if (other instanceof Series) {
        if (opts.axis === 0) {
          // 행에 맞춘다 — 각 컬럼을 Series 와 인덱스로 짝짓는다
          var out0 = {};
          var idx0 = null;
          this.columns.forEach(function (c) {
            var res = self.col(c)[name](other);
            if (!idx0) idx0 = res.index;
            out0[c] = res.toArray();
          });
          trace.push('frame-binop', { op: name, axis: 0, rows: idx0 ? idx0.length() : 0 });
          return DataFrame.fromColumns(out0, { columns: this.columns.slice(), index: idx0 });
        }
        // 컬럼에 맞춘다 (기본)
        var cols = unionColumns(this.columns, other.index.labels);
        var outC = {};
        cols.forEach(function (c) {
          var here = self.columns.indexOf(c) !== -1;
          var ps = other.index.positions(c);
          if (here && ps.length) {
            var v = other.at(ps[0]);
            outC[c] = self.col(c).toArray().map(function (x) {
              return isNA(x) || isNA(v) ? NA : BINFN[name](x, v);
            });
          } else {
            outC[c] = new Array(self.nrows()).fill(NA);   // 한쪽에만 있으면 전부 NaN
          }
        });
        trace.push('frame-binop', { op: name, axis: 1, columns: cols.slice() });
        return DataFrame.fromColumns(outC, { columns: cols, index: this.index.copy() });
      }

      // 스칼라
      var outS = {};
      this.columns.forEach(function (c) {
        outS[c] = self.col(c).toArray().map(function (x) {
          return isNA(x) ? NA : BINFN[name](x, other);
        });
      });
      return DataFrame.fromColumns(outS, { columns: this.columns.slice(), index: this.index.copy() });
    };
  }

  var BINFN = {
    add: function (a, b) { return a + b; },
    sub: function (a, b) { return a - b; },
    mul: function (a, b) { return a * b; },
    div: function (a, b) { return a / b; }
  };
  ['add', 'sub', 'mul', 'div'].forEach(frameBinop);

  // ──────────────────────────────────────────────────────────── merge / concat

  /* 키를 선으로 잇는 것을 보여주기 위해 matches 를 함께 반환한다. */
  DataFrame.prototype.merge = function (other, opts) {
    opts = opts || {};
    var on = opts.on;
    var how = opts.how || 'inner';
    if (!on) throw new Error("merge 에는 on 이 필요하다");
    var leftIdx = new Map();
    for (var i = 0; i < this.nrows(); i++) {
      var lv = this._cols[on].at(i);
      if (!leftIdx.has(lv)) leftIdx.set(lv, []);
      leftIdx.get(lv).push(i);
    }
    var pairs = [], usedLeft = new Set();
    for (var j = 0; j < other.nrows(); j++) {
      var rv = other._cols[on].at(j);
      var ls = leftIdx.get(rv);
      if (ls) {
        ls.forEach(function (li) { pairs.push([li, j]); usedLeft.add(li); });
      } else if (how === 'right' || how === 'outer') {
        pairs.push([-1, j]);
      }
    }
    if (how === 'left' || how === 'outer') {
      for (var li2 = 0; li2 < this.nrows(); li2++) {
        if (!usedLeft.has(li2)) pairs.push([li2, -1]);
      }
      // left/outer 는 왼쪽 순서를 유지한다
      pairs.sort(function (a, b) {
        if (a[0] === -1 && b[0] === -1) return a[1] - b[1];
        if (a[0] === -1) return 1;
        if (b[0] === -1) return -1;
        return a[0] - b[0] || a[1] - b[1];
      });
    }
    /* ★ 겹치는 컬럼에는 **양쪽 모두** 접미사가 붙는다 (실제 pandas 3.0.5 확인).
     *   L(id,x,note) merge R(id,y,note) -> [id, x, note_x, y, note_y]
     *   · 키 컬럼(on)에는 붙지 않는다 — 하나로 합쳐지므로
     *   · 겹치는 컬럼이 없으면 접미사도 없다
     * 처음에는 오른쪽에만 `_y` 를 붙여서 교재 12.5절과 어긋났다. 화면 모듈 작성자가 지적해 고쳤다. */
    var suf = opts.suffixes || ['_x', '_y'];
    var overlap = {};
    this.columns.forEach(function (n) {
      if (n !== on && other.columns.indexOf(n) !== -1) overlap[n] = true;
    });

    var self = this, out = {}, names = [];
    this.columns.forEach(function (n) {
      var nn = overlap[n] ? n + suf[0] : n;
      names.push(nn);
      out[nn] = new ColRef(new Block(pairs.map(function (p) {
        return p[0] === -1 ? (n === on ? other._cols[on].at(p[1]) : NA) : self._cols[n].at(p[0]);
      })), null);
    });
    other.columns.forEach(function (n) {
      if (n === on) return;
      var nn = overlap[n] ? n + suf[1] : n;
      names.push(nn);
      out[nn] = new ColRef(new Block(pairs.map(function (p) {
        return p[1] === -1 ? NA : other._cols[n].at(p[1]);
      })), null);
    });
    trace.push('merge', { on: on, how: how, matches: pairs.slice(), rows: pairs.length });
    return new DataFrame(names, out, Index.range(pairs.length));
  };

  /* 세로로 이어붙인다. 한쪽에만 있는 컬럼은 NaN 이 된다. */
  DataFrame.concat = function (frames, opts) {
    opts = opts || {};
    var names = [];
    frames.forEach(function (f) {
      f.columns.forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });
    });
    var out = {}, labels = [];
    names.forEach(function (n) { out[n] = []; });
    frames.forEach(function (f) {
      for (var i = 0; i < f.nrows(); i++) {
        labels.push(f.index.at(i));
        names.forEach(function (n) {
          out[n].push(n in f._cols ? f._cols[n].at(i) : NA);
        });
      }
    });
    var index = opts.ignoreIndex ? Index.range(labels.length) : new Index(labels);
    return DataFrame.fromColumns(out, { columns: names, index: index });
  };

  /* 행을 배열로. head 표 위젯이 쓴다. */
  DataFrame.prototype.records = function () {
    var self = this, out = [];
    for (var i = 0; i < this.nrows(); i++) {
      var r = {};
      this.columns.forEach(function (n) { r[n] = self._cols[n].at(i); });
      out.push(r);
    }
    return out;
  };

  /* 블록 상태를 화면에 그릴 재료. CoW 시뮬레이터의 입력. */
  DataFrame.prototype.blockInfo = function () {
    var self = this;
    return this.columns.map(function (n) {
      var r = self._cols[n];
      return {
        column: n,
        blockId: r.block.id,
        refs: r.block.refs,
        isView: !!r.slice,
        blockLength: r.block.data.length,
        viewLength: r.length()
      };
    });
  };

  DataFrame.prototype.toString = function (maxRows) {
    maxRows = maxRows || 10;
    var self = this;
    var idxW = Math.max.apply(null, [0].concat(this.index.labels.map(function (l) { return String(l).length; })));
    var widths = this.columns.map(function (n) {
      var w = String(n).length;
      for (var i = 0; i < Math.min(self.nrows(), maxRows); i++) {
        w = Math.max(w, fmt(self._cols[n].at(i)).length);
      }
      return w;
    });
    var lines = [];
    lines.push(pad('', idxW) + ' ' + this.columns.map(function (n, i) { return pad(String(n), widths[i]); }).join(' '));
    for (var i = 0; i < Math.min(this.nrows(), maxRows); i++) {
      lines.push(pad(String(this.index.at(i)), idxW) + ' ' +
        this.columns.map(function (n, k) { return pad(fmt(self._cols[n].at(i)), widths[k]); }).join(' '));
    }
    if (this.nrows() > maxRows) {
      lines.push('...');
      lines.push('[' + this.nrows() + ' rows x ' + this.ncols() + ' columns]');
    }
    return lines.join('\n');
  };

  function pad(s, w) {
    s = String(s);
    while (s.length < w) s = ' ' + s;
    return s;
  }

  // ──────────────────────────────────────────────────────────── 공개 API

  var DF = {
    // 클래스
    Index: Index, Series: Series, DataFrame: DataFrame, GroupBy: GroupBy,
    Block: Block, ColRef: ColRef,

    // 생성 도우미
    index: function (labels, name) { return new Index(labels, name); },
    range: Index.range,
    series: function (values, opts) { return new Series(values, opts); },
    frame: DataFrame.fromColumns,
    fromRecords: DataFrame.fromRecords,
    concat: DataFrame.concat,

    // dtype / 결측
    inferDtype: inferDtype,
    isNumericDtype: isNumericDtype,
    isNA: isNA,
    NA: NA,

    // 정렬 규칙을 화면이 직접 쓸 수 있게 노출
    alignIndexes: alignIndexes,
    sortedUnion: Index.sortedUnion,
    cmpLabel: cmpLabel,

    // Copy-on-Write 관찰
    sharesMemory: sharesMemory,

    // 단계 실행
    trace: trace,

    // 표시
    fmt: fmt
  };

  if (typeof window !== 'undefined') window.DF = DF;
  if (typeof module !== 'undefined' && module.exports) module.exports = DF; // node 테스트용
})();
