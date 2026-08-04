/* ch06-align.js — 인덱스 정렬: 연산은 인덱스로 짝짓는다 (교재 6장)
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②).
 *
 * 이 장은 학생이 가장 많이 틀리는 개념 2위(인덱스 정렬)다. 표는 전부 UI.alignView 로 그린다 —
 * 직접 짝짓기 표를 그리지 않는다(API.md §4.4).
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────── 순수 도우미
  // (상태가 없는 계산 함수만 모듈 스코프에 둔다. ch04-frame.js 의 transpose() 와 같은 패턴.)

  /* 라벨별로 왼쪽/오른쪽에 몇 개씩 있는지 세어, 곱집합이 되는 라벨만 문장으로 만든다.
   * 인덱스가 완전히 같으면(정렬을 건너뛰는 경우) 이 함수를 부르지 않는다 — 그때는 곱집합이 생기지 않는다. */
  function dupDescriptions(left, right) {
    var union = DF.sortedUnion(left.index, right.index);
    var lines = [];
    union.forEach(function (label) {
      var lc = left.index.positions(label).length;
      var rc = right.index.positions(label).length;
      if (lc > 1 || rc > 1) {
        lines.push("'" + label + "' : 왼쪽 " + lc + '개 × 오른쪽 ' + rc + '개 = ' + (lc * rc) + '행');
      }
    });
    return lines;
  }

  /* DF 엔진에는 DataFrame.add 가 없다. Series 와 DataFrame 을 더할 때 pandas 가 하는 일
   * (컬럼 라벨 또는 행 라벨을 Series 인덱스와 정렬한 뒤 브로드캐스팅)을 공개 API(DF.alignIndexes,
   * DF.index, DF.frame)만으로 이 화면이 직접 계산한다. ch04-frame.js 의 transpose() 와 같은 접근이다. */
  function seriesBroadcastFrame(df, s, axis, opFn) {
    var baseIndex = axis === 'row' ? df.index : DF.index(df.columns.slice());
    var al = DF.alignIndexes(baseIndex, s.index);
    var resultCols = {};
    var orderLabels = al.pairs.map(function (p) { return p[2]; });
    if (axis === 'row') {
      df.columns.forEach(function (colName) {
        var vals = al.pairs.map(function (p) {
          var rp = p[0], sp = p[1];
          return (rp === -1 || sp === -1) ? null : opFn(df.col(colName).at(rp), s.at(sp));
        });
        resultCols[colName] = vals;
      });
      return DF.frame(resultCols, { columns: df.columns.slice(), index: orderLabels });
    }
    al.pairs.forEach(function (p) {
      var cp = p[0], sp = p[1], label = p[2];
      var vals = [];
      for (var r = 0; r < df.nrows(); r++) {
        vals.push((cp === -1 || sp === -1) ? null : opFn(df.col(df.columns[cp]).at(r), s.at(sp)));
      }
      resultCols[label] = vals;
    });
    return DF.frame(resultCols, { columns: orderLabels, index: df.index.labels.slice() });
  }

  /* 시뮬레이터 ④용 4x4 예제 프레임. np.arange(16).reshape(4,4) 와 같은 값을 반복문으로 만든다. */
  function buildBroadcastFrame() {
    var cols = ['a', 'b', 'c', 'd'];
    var colObj = {};
    cols.forEach(function (c, ci) {
      var vals = [];
      for (var r = 0; r < 4; r++) vals.push(r * cols.length + ci);
      colObj[c] = vals;
    });
    return DF.frame(colObj, { columns: cols });
  }

  var OPS = [
    { label: '더하기 · add', value: 'add' },
    { label: '빼기 · sub', value: 'sub' },
    { label: '곱하기 · mul', value: 'mul' },
    { label: '나누기 · div', value: 'div' }
  ];

  Lab.register({
    id: 'ch06-align',
    num: 6,
    title: '인덱스 정렬 — 연산은 인덱스로 짝짓는다',
    subtitle: 'pandas 는 위치가 아니라 라벨을 보고 값을 짝짓는다. 중복 라벨은 곱집합이 된다',

    render: function (root) {
      // ───────────────────────────────── 시뮬레이터 ① 정렬 짝짓기 실험실
      var PRESETS1 = [
        { label: '① 완전히 같은 인덱스', leftIndex: ['c', 'a'], leftValues: [1, 2], rightIndex: ['c', 'a'], rightValues: [10, 20] },
        { label: '② 다른 인덱스', leftIndex: ['c', 'a'], leftValues: [1, 2], rightIndex: ['b', 'a'], rightValues: [10, 20] },
        { label: '③ 오른쪽에만 중복', leftIndex: ['a', 'b', 'c', 'd', 'e'], leftValues: [1, 2, 3, 4, 5], rightIndex: ['e', 'b', 'c', 'd', 'e', 'f'], rightValues: [5, 6, 7, 8, 9, 10] },
        { label: '④ 양쪽에 중복', leftIndex: ['a', 'a'], leftValues: [1, 2], rightIndex: ['a', 'a', 'a'], rightValues: [10, 20, 30] },
        { label: '⑤ 완전히 겹치지 않음', leftIndex: ['a', 'b'], leftValues: [1, 2], rightIndex: ['x', 'y'], rightValues: [10, 20] }
      ];
      var st1 = { preset: 0, op: 'add', fillValue: false };

      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 정렬 짝짓기 실험실' }));
      box1.appendChild(UI.note(
        '왼쪽·오른쪽 인덱스 프리셋을 바꿔 가며 두 Series 를 연산해 보라. 인덱스가 어떻게 짝지어지는지는 ' +
        '아래 "인덱스 짝짓기" 표가 그대로 보여준다.'
      ));

      var presetGroup1 = UI.buttonGroup(
        PRESETS1.map(function (p) { return { label: p.label, value: p.label }; }),
        { label: '인덱스 프리셋', selected: st1.preset, onChange: function (v, i) { st1.preset = i; rebuild1(); } }
      );
      var opGroup1 = UI.buttonGroup(OPS, {
        label: '연산', selected: 0, onChange: function (v) { st1.op = v; rebuild1(); }
      });
      var fillToggle1 = UI.toggle({
        label: 'fillValue = 0 사용 (없는 자리를 0으로 채운 뒤 계산)', value: false,
        onChange: function (on) { st1.fillValue = on; rebuild1(); }
      });

      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(body1);
        var p = PRESETS1[st1.preset];
        var left = DF.series(p.leftValues.slice(), { index: p.leftIndex.slice(), name: 'left' });
        var right = DF.series(p.rightValues.slice(), { index: p.rightIndex.slice(), name: 'right' });
        var opts = st1.fillValue ? { fillValue: 0 } : {};
        var result = left[st1.op](right, opts);

        body1.appendChild(UI.seriesTable(left, { frame: 'original', caption: 'left — 인덱스 [' + left.labels().join(', ') + ']' }));
        body1.appendChild(UI.seriesTable(right, { frame: 'copy', caption: 'right — 인덱스 [' + right.labels().join(', ') + ']' }));
        body1.appendChild(UI.code(
          'left.' + st1.op + '(right' + (st1.fillValue ? ', fill_value=0' : '') + ')',
          { output: result.toString() }
        ));
        body1.appendChild(UI.seriesTable(result, { frame: 'result', caption: '결과' }));
        body1.appendChild(UI.alignView(left, right, result, { title: '인덱스 짝짓기' }));

        var maxIn = Math.max(left.length(), right.length());
        if (result.length() > maxIn) {
          body1.appendChild(UI.danger(
            '결과 행 수가 늘어났다',
            '입력은 왼쪽 ' + left.length() + '행, 오른쪽 ' + right.length() + '행인데 결과는 ' +
            result.length() + '행이다. 라벨이 겹치는 자리에서 중복된 라벨끼리 곱집합으로 짝지어졌기 때문이다.'
          ));
        }

        if (left.index.equals(right.index)) {
          body1.appendChild(UI.note(
            '두 인덱스가 길이·라벨·순서까지 완전히 같다. pandas 가 정렬을 건너뛰고 위치로 짝짓는다. ' +
            '결과 인덱스도 [' + result.labels().join(', ') + '] 로 정렬되지 않은 채 남았다.'
          ));
        } else {
          var dup = dupDescriptions(left, right);
          if (dup.length) {
            body1.appendChild(UI.note(dup.join(' · '), '라벨별 곱집합 계산'));
          } else {
            body1.appendChild(UI.note(
              '두 인덱스가 다르므로 합집합을 정렬해서 짝짓는다. 한쪽에만 있는 라벨은 짝이 없어 ' +
              (st1.fillValue ? 'fillValue 로 채운 값이 그대로 남는다.' : 'NaN 이 된다.')
            ));
          }
        }
      }

      root.appendChild(box1);
      box1.appendChild(presetGroup1);
      box1.appendChild(opGroup1);
      box1.appendChild(UI.el('div.control-row', null, [fillToggle1]));
      box1.appendChild(body1);
      rebuild1();

      // ───────────────────────────────── 시뮬레이터 ② 넘파이와 다르다
      var PERMS2 = [
        { label: '정렬된 순서 (a,b,c)', index: ['a', 'b', 'c'] },
        { label: '한 칸 돌림 (b,c,a)', index: ['b', 'c', 'a'] },
        { label: '두 칸 돌림 (c,a,b)', index: ['c', 'a', 'b'] },
        { label: '뒤집힘 (c,b,a)', index: ['c', 'b', 'a'] }
      ];
      var BASE2_INDEX = ['a', 'b', 'c'];
      var BASE2_LEFT = [1, 2, 3];
      var BASE2_RIGHT = [10, 20, 30];
      var st2 = { perm: 0 };

      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 넘파이와 다르다' }));
      box2.appendChild(UI.note(
        '같은 값을 (a) 위치로 더하기(넘파이 방식)와 (b) 인덱스로 더하기(pandas 방식)로 나란히 계산한다. ' +
        's2 의 인덱스 순서를 섞어 보면 두 결과가 갈라지는 것이 보인다.'
      ));

      var permGroup2 = UI.buttonGroup(
        PERMS2.map(function (p) { return { label: p.label, value: p.label }; }),
        { label: 's2 인덱스 순서', selected: st2.perm, onChange: function (v, i) { st2.perm = i; rebuild2(); } }
      );

      var body2 = UI.el('div');

      function rebuild2() {
        UI.clear(body2);
        var permIndex = PERMS2[st2.perm].index;
        var s1 = DF.series(BASE2_LEFT.slice(), { index: BASE2_INDEX.slice(), name: 's1' });
        var s2 = DF.series(BASE2_RIGHT.slice(), { index: permIndex.slice(), name: 's2' });

        body2.appendChild(UI.seriesTable(s1, { frame: 'original', caption: 's1 — 인덱스 [' + s1.labels().join(', ') + ']' }));
        body2.appendChild(UI.seriesTable(s2, { frame: 'copy', caption: 's2 — 인덱스 [' + s2.labels().join(', ') + ']' }));

        // (a) 넘파이 방식 — 라벨을 보지 않고 같은 자리(위치)끼리 더한다
        var posRows = [];
        for (var i = 0; i < s1.length(); i++) {
          posRows.push({ pos: i, lv: s1.at(i), rv: s2.at(i), sum: s1.at(i) + s2.at(i) });
        }
        body2.appendChild(UI.table(
          [{ key: 'pos', label: '위치' }, { key: 'lv', label: 's1 값' },
           { key: 'rv', label: 's2 값(같은 위치)' }, { key: 'sum', label: '위치로 더한 값' }],
          posRows, { frame: 'result', caption: '(a) 넘파이라면: 위치로 더하기' }
        ));

        // (b) pandas 방식 — 인덱스로 짝짓는다
        var result2 = s1.add(s2);
        body2.appendChild(UI.seriesTable(result2, { frame: 'result', caption: '(b) pandas: s1.add(s2) — 인덱스로 더하기' }));

        var same = true;
        for (var k = 0; k < s1.length(); k++) {
          var label = s1.index.at(k);
          if (result2.loc(label) !== posRows[k].sum) same = false;
        }
        if (!same) {
          body2.appendChild(UI.danger(
            '두 결과가 다르다',
            '넘파이라면 순서만 보고 같은 자리끼리 더하지만, pandas 는 라벨을 먼저 맞춘 뒤 더한다. ' +
            's2 의 인덱스 순서가 s1 과 달라지자 위치로 더한 값과 라벨로 더한 값이 갈라졌다.'
          ));
        } else {
          body2.appendChild(UI.note(
            '지금은 s2 의 인덱스가 s1 과 같은 순서라서 위치로 더한 값과 라벨로 더한 값이 우연히 같다. ' +
            '위에서 순서를 섞어 보라.'
          ));
        }
      }

      root.appendChild(box2);
      box2.appendChild(permGroup2);
      box2.appendChild(body2);
      rebuild2();

      // ───────────────────────────────── 시뮬레이터 ③ 중복이 곱집합이 되는 과정
      var PRESETS3 = [
        { label: '오른쪽에만 중복 (abcde + ebcdef)', leftIndex: ['a', 'b', 'c', 'd', 'e'], leftValues: [1, 2, 3, 4, 5], rightIndex: ['e', 'b', 'c', 'd', 'e', 'f'], rightValues: [5, 6, 7, 8, 9, 10] },
        { label: '양쪽에 중복 (a,a + a,a,a)', leftIndex: ['a', 'a'], leftValues: [1, 2], rightIndex: ['a', 'a', 'a'], rightValues: [10, 20, 30] }
      ];
      var st3 = { preset: 0 };

      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 중복이 곱집합이 되는 과정' }));
      box3.appendChild(UI.note(
        'DF.trace 로 실제 연산을 기록하고, 라벨마다 왼쪽 n개 × 오른쪽 m개가 어떻게 n×m 행이 되는지 ' +
        '한 단계씩 넘겨 본다. 왼쪽이 바깥 루프, 오른쪽이 안쪽 루프다.'
      ));

      var presetGroup3 = UI.buttonGroup(
        PRESETS3.map(function (p) { return { label: p.label, value: p.label }; }),
        { label: '예제', selected: st3.preset, onChange: function (v, i) { st3.preset = i; rebuild3(); } }
      );

      var body3 = UI.el('div');

      function rebuild3() {
        UI.clear(body3);
        var p = PRESETS3[st3.preset];
        var left = DF.series(p.leftValues.slice(), { index: p.leftIndex.slice(), name: 'left' });
        var right = DF.series(p.rightValues.slice(), { index: p.rightIndex.slice(), name: 'right' });

        DF.trace.enable();
        var result = left.add(right);
        var traceLog = DF.trace.get();
        DF.trace.disable();

        var al = DF.alignIndexes(left.index, right.index);
        var union = DF.sortedUnion(left.index, right.index);
        var dup = dupDescriptions(left, right);

        var steps = [];
        steps.push({ type: 'overview' });
        union.forEach(function (label) {
          var lc = left.index.positions(label).length;
          var rc = right.index.positions(label).length;
          var pairs = al.pairs.filter(function (pr) { return pr[2] === label; });
          steps.push({ type: 'label', label: label, lc: lc, rc: rc, pairs: pairs });
        });

        var traceEntry = traceLog.length ? traceLog[0] : null;

        body3.appendChild(UI.stepper(steps, function (step) {
          if (step.type === 'overview') {
            var ov = UI.el('div');
            ov.appendChild(UI.el('div.panel-title', { text: '개요 — DF.trace 기록' }));
            ov.appendChild(UI.note(
              'left 는 라벨 ' + left.length() + '개, right 는 라벨 ' + right.length() + '개다. ' +
              (traceEntry
                ? 'DF.trace.get() 이 기록한 정렬 방식은 "' + traceEntry.detail.mode + '", 결과 ' +
                  traceEntry.detail.rows + '행' + (traceEntry.detail.grew ? ' — 입력보다 늘어났다.' : '.')
                : '')
            ));
            if (dup.length) ov.appendChild(UI.note(dup.join(' · '), '이 예제에서 곱집합이 되는 라벨'));
            return ov;
          }
          var box = UI.el('div');
          box.appendChild(UI.el('div.panel-title', { text: "라벨 '" + step.label + "'" }));
          if (step.lc > 0 && step.rc > 0) {
            box.appendChild(UI.note(
              (step.lc > 1 && step.rc > 1)
                ? '왼쪽 ' + step.lc + '개 × 오른쪽 ' + step.rc + '개 = ' + (step.lc * step.rc) +
                  '행. 왼쪽이 바깥 루프를 돌고, 오른쪽이 안쪽 루프를 돈다.'
                : (step.lc * step.rc) + '행이 만들어진다(왼쪽 ' + step.lc + '개, 오른쪽 ' + step.rc + '개).'
            ));
            var rows = step.pairs.map(function (pr, k) {
              var lv = left.at(pr[0]), rv = right.at(pr[1]);
              return { order: k + 1, lv: lv, rv: rv, sum: lv + rv };
            });
            box.appendChild(UI.table(
              [{ key: 'order', label: '순서(왼쪽 바깥 × 오른쪽 안쪽)' }, { key: 'lv', label: '왼쪽 값' },
               { key: 'rv', label: '오른쪽 값' }, { key: 'sum', label: '결과' }],
              rows, { frame: 'result' }
            ));
          } else if (step.lc > 0) {
            box.appendChild(UI.note('오른쪽에 이 라벨이 없다. 왼쪽 ' + step.lc + '개가 전부 NaN 행이 된다.'));
          } else {
            box.appendChild(UI.note('왼쪽에 이 라벨이 없다. 오른쪽 ' + step.rc + '개가 전부 NaN 행이 된다.'));
          }
          return box;
        }, { title: '단계별로 보기 (' + (steps.length) + '단계)' }));

        body3.appendChild(UI.alignView(left, right, result, { title: '전체 결과' }));
      }

      root.appendChild(box3);
      box3.appendChild(presetGroup3);
      box3.appendChild(body3);
      rebuild3();

      // ───────────────────────────────── 시뮬레이터 ④ Series + DataFrame 브로드캐스팅
      var SERIES4 = [
        { label: '컬럼 이름과 일치 (a,b,c,d)', index: ['a', 'b', 'c', 'd'] },
        { label: '행 번호처럼 보이는 인덱스 (0,1,2,3)', index: [0, 1, 2, 3] }
      ];
      var AXIS4 = [
        { label: '컬럼 기준 (기본, axis=1)', value: 'col' },
        { label: '행 기준 (axis=0)', value: 'row' }
      ];
      var st4 = { seriesPreset: 0, axis: 'col' };

      var box4 = UI.el('div.card');
      box4.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ Series + DataFrame 브로드캐스팅' }));
      box4.appendChild(UI.note(
        'DataFrame 에 Series 를 더하면 기본은 컬럼 기준이다. Series 의 인덱스가 컬럼 이름과 겹치지 않으면 ' +
        '에러 없이 컬럼이 늘어나고 전부 NaN 이 된다 — 인덱스가 숫자로 보여도 마찬가지다.'
      ));

      var seriesGroup4 = UI.buttonGroup(
        SERIES4.map(function (s) { return { label: s.label, value: s.label }; }),
        { label: 'Series 인덱스', selected: st4.seriesPreset, onChange: function (v, i) { st4.seriesPreset = i; rebuild4(); } }
      );
      var axisGroup4 = UI.buttonGroup(AXIS4, {
        label: '맞출 축', selected: 0, onChange: function (v) { st4.axis = v; rebuild4(); }
      });

      var body4 = UI.el('div');

      function rebuild4() {
        UI.clear(body4);
        var df = buildBroadcastFrame();
        var sp = SERIES4[st4.seriesPreset];
        var svals = [];
        for (var i = 0; i < 4; i++) svals.push(10 + i);
        var s = DF.series(svals, { index: sp.index.slice(), name: 's' });

        var result = seriesBroadcastFrame(df, s, st4.axis, function (a, b) { return a + b; });

        body4.appendChild(UI.frameTable(df, { frame: 'original', caption: 'df' }));
        body4.appendChild(UI.seriesTable(s, { frame: 'copy', caption: 's — 인덱스 [' + s.labels().join(', ') + ']' }));
        body4.appendChild(UI.code(
          'df.add(s' + (st4.axis === 'row' ? ', axis=0' : '') + ')', {}
        ));
        body4.appendChild(UI.frameTable(result, { frame: 'result', caption: '결과' }));

        var colsBefore = df.ncols(), colsAfter = result.ncols();
        var rowsBefore = df.nrows(), rowsAfter = result.nrows();
        var totalCells = rowsAfter * colsAfter;
        var naCells = 0;
        result.columns.forEach(function (c) { naCells += result.col(c).isna().sum(); });
        var filled = totalCells - naCells;

        if (st4.axis === 'col' && colsAfter > colsBefore) {
          body4.appendChild(UI.danger(
            '컬럼이 늘어났다',
            '컬럼이 ' + colsBefore + '개에서 ' + colsAfter + '개로 늘었고, 값이 있는 칸은 ' +
            filled + '/' + totalCells + '개뿐이다(나머지는 NaN). Series 의 인덱스가 ' +
            (typeof sp.index[0] === 'number' ? '숫자라서 행 번호처럼 보이지만, ' : '') +
            '기본 축은 여전히 컬럼이라 df 의 컬럼 이름과 겹치지 않으면 새 컬럼 후보로 취급되기 때문이다.'
          ));
        } else if (st4.axis === 'row' && rowsAfter > rowsBefore) {
          body4.appendChild(UI.danger(
            '행이 늘어났다',
            '행이 ' + rowsBefore + '개에서 ' + rowsAfter + '개로 늘었고, 값이 있는 칸은 ' +
            filled + '/' + totalCells + '개뿐이다. axis=0 을 줬지만 Series 의 인덱스가 df 의 행 인덱스와 겹치지 않기 때문이다.'
          ));
        } else {
          body4.appendChild(UI.note(
            'Series 의 인덱스가 ' + (st4.axis === 'col' ? '컬럼 이름' : '행 인덱스') +
            '과 정확히 겹쳐서 정상적으로 브로드캐스팅됐다. 값이 있는 칸: ' + filled + '/' + totalCells + '.'
          ));
        }
      }

      root.appendChild(box4);
      box4.appendChild(seriesGroup4);
      box4.appendChild(axisGroup4);
      box4.appendChild(body4);
      rebuild4();

      // ───────────────────────────────── 확인 문제
      var qLeft1 = DF.series([1, 2, 3], { index: ['a', 'a', 'b'] });
      var qRight1 = DF.series([10, 20, 30], { index: ['a', 'b', 'b'] });
      var qResult1 = qLeft1.add(qRight1);
      var qN1 = qResult1.length();

      root.appendChild(UI.quiz({
        title: '확인 문제 6-1',
        question:
          "left = pd.Series([1,2,3], index=['a','a','b']) 와 right = pd.Series([10,20,30], index=['a','b','b']) 를 " +
          'left.add(right) 로 더하면 결과는 몇 행인가?',
        choices: [
          { label: (qN1 - 1) + '행', why: "오답이다. 'a' 와 'b' 각각에서 라벨별로 곱집합을 다시 세어 보라." },
          { label: (qLeft1.length() + qRight1.length()) + '행', why: '오답이다. 이건 그냥 두 Series 의 길이를 더한 값이다 — 실제로는 겹치는 라벨마다 곱집합을 계산해야 한다.' },
          { label: qN1 + '행', correct: true,
            why: "'a' 라벨은 왼쪽 2개 × 오른쪽 1개 = 2행, 'b' 라벨은 왼쪽 1개 × 오른쪽 2개 = 2행이 나와서 합쳐서 " + qN1 + '행이다.' },
          { label: (qN1 + 1) + '행', why: '오답이다.' }
        ]
      }));

      var qx2 = DF.series([1, 2], { index: ['c', 'a'] });
      var qy2 = DF.series([10, 20], { index: ['c', 'a'] });
      var qResult2 = qx2.add(qy2);

      root.appendChild(UI.quiz({
        title: '확인 문제 6-2',
        question:
          "x = pd.Series([1,2], index=['c','a']) 와 y = pd.Series([10,20], index=['c','a']) 를 x + y 로 더하면 " +
          '결과 인덱스의 순서는 어떻게 되는가?',
        choices: [
          { label: '[' + qResult2.labels().join(', ') + '] — 원래 순서 그대로', correct: true,
            why: '두 인덱스가 길이·라벨·순서까지 완전히 같으면 pandas 는 정렬 자체를 건너뛰고 위치로 짝짓는다.' },
          { label: "['a', 'c'] — 알파벳 순으로 정렬됨",
            why: '오답이다. 인덱스가 다를 때만 합집합을 만들어 정렬한다. 완전히 같을 때는 정렬하지 않는다.' }
        ]
      }));

      var qs1 = DF.series([100, 200, 300], { index: ['a', 'b', 'c'] });
      var qs2 = DF.series([1, 2, 3], { index: ['b', 'c', 'a'] });
      var qResult3 = qs1.add(qs2);
      var qAns3 = qResult3.loc('a');
      var qWrong3 = qs1.at(0) + qs2.at(0); // 넘파이처럼 위치로 더했을 때의 값(흔한 착각)

      root.appendChild(UI.quiz({
        title: '확인 문제 6-3',
        question:
          "s1 = pd.Series([100,200,300], index=['a','b','c']) 와 s2 = pd.Series([1,2,3], index=['b','c','a']) 를 " +
          "s1 + s2 로 더하면 라벨 'a' 의 값은 얼마인가?",
        choices: [
          { label: UI.fmt(qWrong3), why: '오답이다. 이건 두 Series 의 0번째 값끼리(위치로) 더한 값이다 — 넘파이라면 이렇게 되지만 pandas 는 라벨로 짝짓는다.' },
          { label: UI.fmt(qAns3), correct: true,
            why: "라벨로 짝짓기 때문에 s1 의 'a'(" + UI.fmt(qs1.loc('a')) + ")와 s2 의 'a'(" + UI.fmt(qs2.loc('a')) + ")가 더해져 " + UI.fmt(qAns3) + '이 나온다.' },
          { label: UI.fmt(qAns3 + 1), why: '오답이다.' }
        ]
      }));

      var qdf4 = buildBroadcastFrame();
      var qs4 = DF.series([10, 11, 12, 13], { index: [0, 1, 2, 3] });
      var qResult4 = seriesBroadcastFrame(qdf4, qs4, 'col', function (a, b) { return a + b; });

      root.appendChild(UI.quiz({
        title: '확인 문제 6-4',
        question:
          "df 의 컬럼이 ['a','b','c','d'] 이고 Series s 의 인덱스가 [0,1,2,3] 이다. " +
          'df.add(s) 를 axis 기본값으로 실행하면 어떻게 되는가?',
        choices: [
          { label: '각 행에 정상적으로 더해진다', why: '오답이다. 인덱스가 숫자라 행 번호처럼 보이지만, 지정한 축은 여전히 기본값인 컬럼이다.' },
          { label: 'ValueError 가 난다', why: '오답이다. 에러도 경고도 없이 조용히 실행된다 — 그래서 더 위험하다.' },
          { label: '컬럼이 ' + qResult4.ncols() + '개로 늘고 값이 전부 NaN 이 된다', correct: true,
            why: 'Series 의 인덱스 0,1,2,3 이 새 컬럼 이름 후보로 취급되어 기존 컬럼(a,b,c,d)과 합집합을 만든다. ' +
                 '어느 쪽 라벨도 상대에 없으니 늘어난 칸이 전부 NaN 이 된다.' }
        ]
      }));
    }
  });
})();
