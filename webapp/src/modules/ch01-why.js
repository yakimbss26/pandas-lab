/* ch01-why.js — 1장. pandas 는 무엇을 해결하는가
 *
 * 교재 pandas.md 192~470줄(1장)의 짝.
 * 리스트 -> 넘파이 배열 -> DataFrame 으로 올라가며 무엇이 해결되는지 조작으로 보여준다.
 *
 * ES 모듈 문법 금지 — IIFE. render(root) 는 재방문 시 다시 불리므로
 * 모든 가변 상태는 render 안의 지역 변수로 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────── 순수 도우미(가변 상태 없음)

  /* 교재 1.3(1)의 학생 표. 열마다 dtype 이 다르다. */
  function buildStudentFrame() {
    var df = DF.frame({
      '이름': ['김민준', '이서연', '박도윤'],
      '나이': [32, 24, 38],
      '키': [183.0, 173.0, 180.0]
    });
    // JS 는 183.0 과 183 을 구분 못 한다 -> float64 를 명시로 선언한다
    df.declareDtypes({ '키': 'float64' });
    return df;
  }

  /* '+' 데모. 교재 1.1/1.2 의 a=[1,2,3], b=[4,5,6] 을 그대로 쓴다. */
  function computeAddDemo() {
    var a = [1, 2, 3];
    var b = [4, 5, 6];

    var listResult = a.concat(b); // 파이썬 리스트의 + = 이어붙이기

    // 넘파이 배열의 + = 자리별 덧셈. 엔진의 기본 RangeIndex 는 위치 그대로라
    // Series.add 가 위치로 짝짓는 것과 같은 결과를 낸다.
    var arrResult = DF.series(a).add(DF.series(b)).toArray();

    // DataFrame(Series): 이름표(인덱스)로 값을 저장한다.
    // b 쪽은 저장 순서를 일부러 뒤섞었다 — 그래도 이름으로 정확히 맞춰지는지 보기 위해서다.
    var labelsA = ['월', '화', '수'];
    var labelsB = ['수', '월', '화'];
    var valuesB = [6, 4, 5]; // '수'=6, '월'=4, '화'=5  (b 와 같은 값, 저장 순서만 다르다)
    var dfA = DF.series(a, { index: labelsA, name: '값' });
    var dfB = DF.series(valuesB, { index: labelsB, name: '값' });
    var dfResult = dfA.add(dfB);

    // 만약 이름을 무시하고 저장된 순서로만(배열처럼) 더했다면?
    var naive = [];
    for (var i = 0; i < a.length; i++) naive.push(dfA.at(i) + dfB.at(i));

    return {
      a: a, b: b, listResult: listResult, arrResult: arrResult,
      dfA: dfA, dfB: dfB, dfResult: dfResult, naive: naive
    };
  }

  /* '이름으로 열 찾기' 데모 */
  function computeColDemo(colName) {
    var df = buildStudentFrame();
    var rows = df.records().map(function (r) { return [r['이름'], r['나이'], r['키']]; });
    // 리스트/배열은 위치로만 저장되므로 문자열 키로 찾으면 (실제로) undefined 다
    var positional = rows.map(function (r) { return r[colName]; });
    var dfFound = df.col(colName); // 진짜로 이름으로 찾아진다
    return { df: df, rows: rows, positional: positional, dfFound: dfFound };
  }

  /* '열마다 다른 타입' 데모 — 교재 1.3(1) */
  function computeDtypeDemo() {
    var df = buildStudentFrame();
    var cols = df.columns; // ['이름', '나이', '키']
    var dtypes = df.dtypes(); // DataFrame 은 컬럼별 dtype 을 유지한다
    var rows = df.records().map(function (r) { return cols.map(function (c) { return r[c]; }); });

    var dtypeLabel = { 'str': 'str (문자열)', 'int64': 'int (정수)', 'float64': 'float (실수)' };
    // 리스트: 셀마다 원래 타입을 그대로 유지한다 (JS 는 183 과 183.0 을 구분 못 하므로
    // 컬럼에 선언된 dtype 을 그대로 라벨로 쓴다 — 값 자체가 아니라 "원래 무슨 타입이었나" 를 보여준다)
    var listTypes = cols.map(function (c) { return dtypeLabel[dtypes[c]] || dtypes[c]; });

    // 배열: numpy 처럼 전부 문자열로 강제 변환된다. float64 컬럼은 '183.0' 처럼 소수점을 남긴다
    // (JS 숫자는 183 과 183.0 을 구분 못 하므로, 원래 dtype 이 float64 였던 값만 .0 을 붙여 문자열로 만든다)
    function pyStr(v, dtype) {
      if (dtype === 'float64' && typeof v === 'number' && Number.isInteger(v)) return v + '.0';
      return String(v);
    }
    var stringified = [];
    rows.forEach(function (r) {
      r.forEach(function (v, i) { stringified.push(pyStr(v, dtypes[cols[i]])); });
    });
    var arrDtype = DF.inferDtype(stringified); // 실제로 'str' 이 나온다

    return { df: df, rows: rows, listTypes: listTypes, stringified: stringified, arrDtype: arrDtype, dtypes: dtypes };
  }

  /* '결측값 넣기' 데모 — 교재 1.3(3) */
  function computeNaDemo() {
    var withoutNA = [27, 19, 31];
    var withNA = [27, 19, NaN, 31]; // 진짜 NaN. null 은 JS 에서 산술 시 0 으로 취급돼 전파되지 않는다
    var arrDtypeBefore = DF.inferDtype(withoutNA);
    var arrDtypeAfter = DF.inferDtype(withNA);
    var naiveSum = withNA.reduce(function (s, v) { return s + v; }, 0); // NaN 이 전파된다
    var series = DF.series(withNA, { name: '나이' }); // dtype 은 자동으로 float64 로 올라간다
    return {
      withNA: withNA, arrDtypeBefore: arrDtypeBefore, arrDtypeAfter: arrDtypeAfter,
      naiveSum: naiveSum, series: series
    };
  }

  // ──────────────────────────────────────────── 공용 레이아웃 도우미
  // (색은 원본/사본/결과 세 역할로 고정돼 있어 리스트·배열·DataFrame 을 그 색으로
  //  구분하지 않는다. 여기서는 "DataFrame 이 낸 결과" 에만 --c-result 를 쓰고
  //  나머지는 중립 테두리 + 라벨로 구분한다.)

  function threeUp(children) {
    return UI.el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' } },
      children.map(function (c) {
        return UI.el('div', { style: { flex: '1 1 240px', minWidth: '220px' } }, c);
      })
    );
  }

  function neutralBox(label, node) {
    var box = UI.el('div', {
      style: {
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        padding: '12px', background: 'var(--surface-1)'
      }
    });
    box.appendChild(UI.el('div.panel-title', { text: label }));
    box.appendChild(node);
    return box;
  }

  Lab.register({
    id: 'ch01-why',
    num: 1,
    title: 'pandas 는 무엇을 해결하는가',
    subtitle: '리스트 → 배열 → DataFrame, 표 데이터가 막히는 지점을 하나씩 넘는다',

    render: function (root) {
      root.appendChild(UI.note(
        '파이썬 리스트는 "이어붙이기"만 안다. 넘파이 배열은 자리별 계산은 되지만 ' +
        '이름으로 열을 찾거나, 열마다 dtype 을 다르게 두거나, 결측값을 다루지 못한다. ' +
        'DataFrame(과 Series)이 이 세 가지를 어떻게 메우는지 아래에서 직접 눌러 확인한다.'
      ));

      // ══════════════════════════════════ 시뮬레이터 ① 세 가지 자료구조 비교기

      var sim1 = UI.el('div.card');
      sim1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① — 리스트 · 배열 · DataFrame 비교기' }));

      var op = 'add';       // 'add' | 'findcol' | 'dtype' | 'na'
      var col = '나이';      // findcol 에서 고른 열 이름
      var sim1Body = UI.el('div');

      function rebuildSim1() {
        UI.clear(sim1Body);

        if (op === 'add') {
          var d = computeAddDemo();
          sim1Body.appendChild(UI.note('같은 데이터: a = [' + d.a.join(', ') + '],  b = [' + d.b.join(', ') + ']'));
          sim1Body.appendChild(threeUp([
            neutralBox('① 파이썬 리스트 — a + b',
              UI.table([{ key: 'v', label: '값' }], d.listResult.map(function (v) { return { v: v }; }))),
            neutralBox('② 넘파이 배열 — a + b (자리별 덧셈)',
              UI.table([{ key: 'v', label: '값' }], d.arrResult.map(function (v) { return { v: v }; }))),
            neutralBox('③ DataFrame(Series) — a + b',
              UI.seriesTable(d.dfResult, { frame: 'result' }))
          ]));
          sim1Body.appendChild(UI.note(
            '왼쪽은 [' + d.dfA.labels().join(',') + '] 순서로, 오른쪽은 [' + d.dfB.labels().join(',') +
            '] 순서로 저장되어 있다(저장 순서가 다르다). 그래도 pandas 는 이름표(인덱스)를 보고 짝지어 ' +
            d.dfResult.labels().join(',') + ' 순서로 ' + d.dfResult.toArray().join(', ') + ' 를 낸다. ' +
            '만약 배열처럼 저장된 순서로만 더했다면 ' + d.naive.join(', ') + ' 이 됐을 것이다(틀렸다).',
            '인덱스로 짝짓기 — '
          ));
        } else if (op === 'findcol') {
          sim1Body.appendChild(UI.buttonGroup(
            [{ label: '이름', value: '이름' }, { label: '나이', value: '나이' }, { label: '키', value: '키' }],
            { label: '찾을 열', selected: ['이름', '나이', '키'].indexOf(col), onChange: function (v) { col = v; rebuildSim1(); } }
          ));
          var d2 = computeColDemo(col);
          sim1Body.appendChild(threeUp([
            neutralBox('① 파이썬 리스트 — 위치로만 접근',
              UI.danger('안 된다',
                "리스트는 이름이 아니라 위치(0,1,2…)로만 접근한다. row['" + col + "'] 를 실제로 해 보면 " +
                String(d2.positional[0]) + " 가 나온다 — 원하는 값이 아니다.")),
            neutralBox('② 넘파이 배열 — 위치로만 접근',
              UI.danger('안 된다',
                "배열도 열 이름이 없다. table['" + col + "'] 를 실제로 해 보면 마찬가지로 " +
                String(d2.positional[0]) + " 다. 파이썬(numpy)에서는 IndexError 가 난다.")),
            neutralBox('③ DataFrame — 이름으로 된다',
              UI.seriesTable(d2.dfFound, { frame: 'result' }))
          ]));
        } else if (op === 'dtype') {
          var d3 = computeDtypeDemo();
          sim1Body.appendChild(UI.note('표: 이름(문자열) · 나이(정수) · 키(실수)를 한 곳에 담아본다. (1행: ' +
            d3.rows[0].join(' / ') + ')'));
          sim1Body.appendChild(threeUp([
            neutralBox('① 파이썬 리스트 — 그대로 유지',
              UI.table([{ key: 'cell', label: '첫 행의 칸' }, { key: 't', label: '실제 타입' }],
                d3.rows[0].map(function (v, i) { return { cell: v, t: d3.listTypes[i] }; }))),
            neutralBox('② 넘파이 배열 — 문자열로 통일',
              UI.table([{ key: 'v', label: '값(문자열로 바뀜)' }],
                d3.stringified.slice(0, 3).map(function (v) { return { v: v }; }),
                { caption: '배열 전체의 dtype: ' + d3.arrDtype })),
            neutralBox('③ DataFrame — 컬럼별 dtype 유지',
              UI.table([{ key: 'c', label: '컬럼' }, { key: 'dt', label: 'dtype' }],
                Object.keys(d3.dtypes).map(function (k) { return { c: k, dt: d3.dtypes[k] }; }),
                { frame: 'result' }))
          ]));
        } else { // 'na'
          var d4 = computeNaDemo();
          sim1Body.appendChild(UI.note('나이 배열 [27, 19, 31] (dtype: ' + d4.arrDtypeBefore +
            ') 에 결측값을 하나 넣는다.'));
          sim1Body.appendChild(threeUp([
            neutralBox('① 파이썬 리스트 — dtype 개념이 없다',
              UI.table([{ key: 'v', label: '값' }], d4.withNA.map(function (v) { return { v: v }; }))),
            neutralBox('② 넘파이 배열 — dtype 이 바뀐다', UI.el('div', null, [
              UI.note(d4.arrDtypeBefore + ' → ' + d4.arrDtypeAfter + ' 로 바뀌었다'),
              UI.table([{ key: 'v', label: '값' }], d4.withNA.map(function (v) { return { v: v }; })),
              UI.danger('전파된다', '이대로 합을 구하면 ' + UI.fmt(d4.naiveSum) +
                ' 이 나온다 — NaN 이 하나만 섞여도 전체 계산이 못 쓰게 된다.')
            ])),
            neutralBox('③ DataFrame(Series) — NaN 을 다룰 수 있다', UI.el('div', null, [
              UI.seriesTable(d4.series, { frame: 'result' }),
              UI.note('결측을 자동으로 건너뛰고 계산한다: 평균 = ' + UI.fmt(d4.series.mean(), 2) +
                ', 개수(count) = ' + d4.series.count() + ' (전체 ' + d4.series.length() + '개 중)')
            ]))
          ]));
        }
      }

      sim1.appendChild(UI.buttonGroup([
        { label: '+', value: 'add' },
        { label: '이름으로 열 찾기', value: 'findcol' },
        { label: '열마다 다른 타입', value: 'dtype' },
        { label: '결측값 넣기', value: 'na' }
      ], { label: '연산', selected: 0, onChange: function (v) { op = v; col = '나이'; rebuildSim1(); } }));
      sim1.appendChild(sim1Body);
      rebuildSim1();
      root.appendChild(sim1);

      // ══════════════════════════════════ 시뮬레이터 ② Series 해부기

      var sim2 = UI.el('div.card');
      sim2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② — Series 해부기 (값 배열 + 인덱스)' }));

      var namesPool = ['김민준', '이서연', '박도윤', '최하은', '정우진', '한소율'];
      var agesPool = [32, 24, 38, 40, 26, 33];
      var n = 4;
      var useLabels = false;
      var sim2Body = UI.el('div');

      function rebuildSim2() {
        UI.clear(sim2Body);
        var count = Math.min(n, agesPool.length);
        var values = agesPool.slice(0, count);
        var idx = useLabels ? namesPool.slice(0, count) : undefined;
        var s = DF.series(values, { index: idx, name: '나이' });

        sim2Body.appendChild(UI.note('값 배열(values): [' + s.toArray().join(', ') + ']'));
        sim2Body.appendChild(UI.note('인덱스(index): [' + s.labels().join(', ') + ']'));
        sim2Body.appendChild(UI.seriesTable(s, { frame: 'result' }));
        sim2Body.appendChild(UI.note(
          '넘파이 배열은 이 인덱스가 없다 — 값만 있는 목록일 뿐이다: [' + s.toArray().join(', ') + ']. ' +
          '그래서 배열에서는 "몇 번째" 로만 꺼낼 수 있고, Series 에서는 "' +
          (useLabels ? s.index.at(0) : '0') + '" 같은 이름으로도 꺼낼 수 있다.'
        ));
      }

      sim2.appendChild(UI.slider({
        label: '원소 개수', min: 2, max: namesPool.length, step: 1, value: n,
        onChange: function (v) { n = v; rebuildSim2(); }
      }));
      sim2.appendChild(UI.toggle({
        label: '인덱스 라벨 바꾸기 (0,1,2… ↔ 이름)', value: useLabels,
        onChange: function (on) { useLabels = on; rebuildSim2(); }
      }));
      sim2.appendChild(sim2Body);
      rebuildSim2();
      root.appendChild(sim2);

      // ══════════════════════════════════ 확인 문제

      root.appendChild(UI.quiz({
        title: '확인 문제 1',
        question: 'a = [1, 2, 3], b = [4, 5, 6] 일 때 파이썬 리스트의 a + b 결과는?',
        choices: [
          { label: '[5, 7, 9]', correct: false, why: '그건 넘파이 배열의 자리별 덧셈 결과다. 리스트의 + 는 이어붙이기라 다르다.' },
          { label: '[1, 2, 3, 4, 5, 6]', correct: true, why: '리스트의 + 는 산술 덧셈이 아니라 두 시퀀스를 이어붙이는 연산이다.' },
          { label: '에러가 난다', correct: false, why: '리스트의 + 는 정의되어 있다. 다만 이어붙이기로 정의되어 있을 뿐이다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 2',
        question: '이름(문자열)·나이(정수)·키(실수)가 섞인 표를 하나의 numpy 배열에 담으면 32, 183.0 같은 숫자는 어떻게 되는가?',
        choices: [
          { label: '그대로 숫자로 남는다', correct: false, why: 'numpy 배열은 원소 전체가 하나의 dtype 을 공유해야 하므로 그럴 수 없다.' },
          { label: "'32', '183.0' 같은 문자열로 바뀐다", correct: true, why: '문자열과 숫자를 함께 담을 수 있는 공통 타입은 문자열뿐이라, 숫자 쪽이 문자열로 강제 변환된다.' },
          { label: '에러가 나서 배열을 만들 수 없다', correct: false, why: '에러 없이 조용히 문자열로 바뀐다. 그래서 알아채기 더 어렵다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 3',
        question: 'issubclass(pd.Series, np.ndarray) 를 실행하면 무엇이 나오며, 그 이유는?',
        choices: [
          { label: 'True — Series 는 ndarray 의 자식클래스다', correct: false, why: '틀렸다. 실제로는 False 다. Series 의 __mro__ 에는 ndarray 가 아예 등장하지 않는다.' },
          { label: 'False — Series 는 ndarray 를 상속하지 않고 내부에 담고 있을 뿐이다', correct: true, why: 'Series 는 ndarray 를 상속(is-a)하는 게 아니라 ndarray 와 인덱스를 함께 담은 합성(composition) 구조다. 그래서 진짜 배열이 필요하면 .values 나 .to_numpy() 로 꺼내야 한다.' },
          { label: '파이썬 버전에 따라 다르다', correct: false, why: '버전과 무관하게 항상 False 다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 4',
        question: '정수만 있던 나이 배열 [27, 19, 31] (dtype: int64) 에 결측값을 하나 추가하면 dtype 은 어떻게 되는가?',
        choices: [
          { label: 'int64 그대로다', correct: false, why: 'NaN 은 정수 dtype 에 담을 수 없다. dtype 이 올라간다.' },
          { label: 'float64 로 바뀐다', correct: true, why: '넘파이의 NaN 은 실수 전용 값이라서, 정수 배열 전체가 float64 로 승격된다.' },
          { label: 'object 로 바뀐다', correct: false, why: 'object 로 가는 것은 문자열처럼 완전히 다른 타입이 섞였을 때다. 숫자 + 결측은 float64 로 충분하다.' }
        ]
      }));
    }
  });
})();
