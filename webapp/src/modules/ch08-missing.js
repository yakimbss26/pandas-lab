/* ch08-missing.js — 결측 데이터 (교재 8장)
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  /* 최빈값. 엔진에 mode() 가 없으므로 valueCounts() 에서 가장 많이 등장한 값(첫 항목)을 쓴다.
   * (개수가 같으면 valueCounts 가 "먼저 나온 순서" 를 앞에 두므로 결정적이다.) */
  function modeValue(series) {
    var vc = series.dropna().valueCounts();
    return vc.length() ? vc.labels()[0] : null;
  }

  /* 결측이 하나라도 있는 행의 위치 배열. DF 엔진에 df.any(axis=1) 이 없어 공개 API 로 직접 센다. */
  function rowsWithAnyNA(df) {
    var isnaDf = df.isna();
    var cols = df.columns;
    var pos = [];
    for (var i = 0; i < df.nrows(); i++) {
      var bad = false;
      for (var c = 0; c < cols.length; c++) {
        if (isnaDf.col(cols[c]).at(i)) { bad = true; break; }
      }
      if (bad) pos.push(i);
    }
    return pos;
  }

  Lab.register({
    id: 'ch08-missing',
    num: 8,
    title: '결측 데이터',
    subtitle: '찾고(isna) · 채우고(fillna) · 버리는(dropna) 세 가지 방법, 그리고 문자 하나가 컬럼을 망치는 순간',

    render: function (root) {
      var t = LabData.frame('titanic');
      var age = t.col('Age');
      var ageMissing = age.length() - age.count();

      // ───────────────────────────────── 시뮬레이터 ① 결측 지도
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 결측 지도' }));
      box1.appendChild(UI.note(
        'isna()는 칸마다 결측 여부를 True/False로 돌려준다. 여기에 .sum()을 이으면 컬럼별 결측 ' +
        '개수가 나온다 — 파이썬에서 True는 1, False는 0으로 취급되기 때문이다. 전부 df.isna().sum() ' +
        '을 그 자리에서 계산한 값이다.'
      ));

      var isnaSum = t.isna().sum();      // Series: 컬럼 -> 결측 수
      var sumLabels = isnaSum.labels();
      var sumVals = isnaSum.toArray();

      box1.appendChild(UI.bar(
        sumLabels.map(function (c, i) { return { label: c, value: sumVals[i] }; }),
        { title: 't.isna().sum() — 컬럼별 결측 수', labelHeader: '컬럼', valueHeader: '결측 수', padLeft: 100 }
      ));

      box1.appendChild(UI.table(
        [
          { key: 'col', label: '컬럼' },
          { key: 'cnt', label: '결측 수' },
          { key: 'pct', label: '비율(%)', digits: 1 }
        ],
        sumLabels.map(function (c, i) {
          return { col: c, cnt: sumVals[i], pct: t.nrows() ? sumVals[i] / t.nrows() * 100 : 0 };
        }),
        { caption: '전체 ' + t.nrows() + '행 기준 비율' }
      ));

      // "True 가 1로 세어진다" 미니 데모 — 컬럼 선택 가능
      var missingCols = ['Age', 'Cabin', 'Embarked'];
      var st1 = { demoCol: 'Cabin' };
      var demoBody = UI.el('div');

      function rebuildDemo() {
        UI.clear(demoBody);
        var demoIsna = t.isna().col(st1.demoCol);
        var n = Math.min(5, demoIsna.length());
        var rows = [];
        for (var i = 0; i < n; i++) {
          var b = demoIsna.at(i);
          rows.push({ idx: t.index.at(i), bool: b, num: b ? 1 : 0 });
        }
        var totalForCol = sumVals[t.columns.indexOf(st1.demoCol)];
        demoBody.appendChild(UI.table(
          [
            { key: 'idx', label: '인덱스' },
            { key: 'bool', label: st1.demoCol + '.isna()' },
            { key: 'num', label: '숫자로 보면' }
          ],
          rows, { caption: '처음 ' + n + '행' }
        ));
        demoBody.appendChild(UI.note(
          '이 ' + n + '행만 숫자로 더해도 ' + rows.reduce(function (s, r) { return s + r.num; }, 0) +
          '이 나온다. ' + t.nrows() + '행 전체에서 True 만 더하면 위 막대그래프의 그 숫자, ' + totalForCol +
          '(= ' + st1.demoCol + ' 결측 수)이 나온다.'
        ));
      }

      box1.appendChild(UI.buttonGroup(
        missingCols.map(function (c) { return { label: c, value: c }; }),
        { label: '어느 컬럼으로 확인할까', selected: missingCols.indexOf(st1.demoCol),
          onChange: function (v) { st1.demoCol = v; rebuildDemo(); } }
      ));
      box1.appendChild(demoBody);
      rebuildDemo();

      // 결측이 있는 행을 실제로 보여준다
      var missingPos = rowsWithAnyNA(t);
      box1.appendChild(UI.note(
        t.nrows() + '행 중 ' + missingPos.length + '행은 (' + t.columns.length + '개 컬럼 중) 어딘가 하나라도 비어 있다 ' +
        '— t.isna().any(axis=1) 에 해당한다.'
      ));
      box1.appendChild(UI.frameTable(
        t.cols(['PassengerId', 'Name', 'Age', 'Cabin', 'Embarked']).take(missingPos),
        { maxRows: 6, caption: '결측이 있는 행 (결측 칸은 자동으로 회색이다)' }
      ));

      root.appendChild(box1);

      // ───────────────────────────────── 시뮬레이터 ② 채우는 방법 비교기
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 채우는 방법 비교기' }));
      box2.appendChild(UI.note(
        'Age 결측 ' + ageMissing + '개를 0 / 평균 / 중앙값 / 최빈값으로 채워 보고, 분포와 평균이 ' +
        '어떻게 달라지는지 비교한다. 전부 그 자리에서 DF 엔진으로 계산한 값이다.'
      ));

      var beforeMean = age.mean(), beforeStd = age.std();
      var st2 = { method: 'mean' };
      var body2 = UI.el('div');

      var METHODS = [
        { label: '0', value: 'zero' },
        { label: '평균', value: 'mean' },
        { label: '중앙값', value: 'median' },
        { label: '최빈값', value: 'mode' }
      ];

      function fillValueFor(method) {
        if (method === 'zero') return 0;
        if (method === 'mean') return age.mean();
        if (method === 'median') return age.median();
        return modeValue(age);
      }

      function rebuild2() {
        UI.clear(body2);
        var fv = fillValueFor(st2.method);
        var filled = age.fillna(fv);
        var afterMean = filled.mean(), afterStd = filled.std();

        body2.appendChild(UI.table(
          [
            { key: 'item', label: '항목' },
            { key: 'before', label: '채우기 전' },
            { key: 'after', label: '채운 뒤' }
          ],
          [
            { item: '채운 값', before: '—', after: UI.fmt(fv, 4) },
            { item: '평균', before: UI.fmt(beforeMean, 4), after: UI.fmt(afterMean, 4) },
            { item: '표준편차', before: UI.fmt(beforeStd, 4), after: UI.fmt(afterStd, 4) },
            { item: '결측 수', before: ageMissing, after: filled.length() - filled.count() }
          ]
        ));

        body2.appendChild(UI.hist(age.toArray(), { title: '채우기 전 분포 (결측 제외)', bins: 20 }));
        body2.appendChild(UI.hist(filled.toArray(), {
          title: '채운 뒤 분포', bins: 20, color: 'var(--c-result)'
        }));

        if (st2.method === 'zero') {
          body2.appendChild(UI.danger(
            '평균이 크게 내려간다',
            '결측 ' + ageMissing + '개를 0으로 채우면 평균이 ' + UI.fmt(beforeMean, 2) + '세에서 ' +
            UI.fmt(afterMean, 2) + '세로 내려간다(차이 ' + UI.fmt(beforeMean - afterMean, 2) + '세). ' +
            '실제로는 나이를 몰라서 못 채운 ' + ageMissing + '명인데, 0으로 채우면 "이 사람들이 0살" ' +
            '이라고 우기는 셈이다.'
          ));
        }
      }

      box2.appendChild(UI.buttonGroup(METHODS, {
        label: '채우는 방법', selected: 1,
        onChange: function (v) { st2.method = v; rebuild2(); }
      }));
      box2.appendChild(body2);
      rebuild2();

      root.appendChild(box2);

      // ───────────────────────────────── 시뮬레이터 ③ fillna('0') 이 컬럼을 망친다
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: "시뮬레이터 ③ ★★ fillna('0') 이 컬럼을 망친다" }));
      box3.appendChild(UI.note(
        '실제로 이 상태로 저장되어 있던 강의용 노트북의 사고를 재현한다. 숫자 0 대신 따옴표를 친 ' +
        "문자열 '0' 을 채우면 무슨 일이 일어나는지 본다."
      ));

      var fillnaZero = age.fillna(0);
      var fillnaStr = age.fillna('0');

      box3.appendChild(UI.table(
        [{ key: 'expr', label: '표현식' }, { key: 'dtype', label: 'dtype' }],
        [
          { expr: 'Age (원본)', dtype: age.dtype },
          { expr: 'Age.fillna(0)', dtype: fillnaZero.dtype },
          { expr: "Age.fillna('0')", dtype: fillnaStr.dtype }
        ]
      ));

      var isnaArr = age.isna().toArray();
      var firstNA = isnaArr.indexOf(true);
      var firstOK = isnaArr.indexOf(false);
      var sampleIdx = [firstOK, firstNA].filter(function (i) { return i !== -1; });

      box3.appendChild(UI.table(
        [
          { key: 'idx', label: '인덱스' },
          { key: 'orig', label: 'Age (원본)' },
          { key: 'fz', label: 'fillna(0)' },
          { key: 'fzType', label: 'fillna(0) 의 typeof' },
          { key: 'fs', label: "fillna('0')" },
          { key: 'fsType', label: "fillna('0') 의 typeof" }
        ],
        sampleIdx.map(function (i) {
          return {
            idx: t.index.at(i),
            orig: UI.fmt(age.at(i)),
            fz: UI.fmt(fillnaZero.at(i)),
            fzType: typeof fillnaZero.at(i),
            fs: UI.fmt(fillnaStr.at(i)),
            fsType: typeof fillnaStr.at(i)
          };
        }),
        { caption: '결측이었던 행과 원래 값이 있던 행을 하나씩 비교' }
      ));

      var zeroMean = fillnaZero.mean();
      box3.appendChild(UI.note(
        "fillna(0).mean() → " + UI.fmt(zeroMean, 6) + ' (dtype 이 float64 로 유지되어 계산이 된다. ' +
        '단, 이 값은 8.1절에서 본 것처럼 "' + ageMissing + '명이 0살"이라고 우기는 값이라 그럴듯해 보여도 위험하다.)'
      ));

      var strMeanMsg = null;
      try {
        fillnaStr.mean();
      } catch (e) {
        strMeanMsg = e.message;
      }
      box3.appendChild(UI.danger(
        "fillna('0').mean() 은 예외를 던진다",
        strMeanMsg || '(예외가 발생하지 않았다 — 데이터 상태를 확인하라)'
      ));

      box3.appendChild(UI.note(
        "문자열 '0' 하나가 dtype 을 object 로 승격시켰고, 그 순간부터 이 컬럼의 모든 산술이 막힌다. " +
        'dtype 이 왜 이렇게 정해지는지는 9장에서 자세히 다룬다.', '9장으로 이어지는 다리'
      ));

      root.appendChild(box3);

      // ───────────────────────────────── 시뮬레이터 ④ dropna 실험
      var box4 = UI.el('div.card');
      box4.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ dropna 실험' }));
      box4.appendChild(UI.note(
        '결측이 있는 컬럼(Age, Cabin, Embarked)을 subset 으로 골라 보라. 아무것도 고르지 않으면 ' +
        '(subset 없이) dropna() 를 부른 것과 같다 — Cabin 하나가 결측 ' +
        sumVals[t.columns.indexOf('Cabin')] + '개라 얼마나 크게 줄어드는지 보라.'
      ));

      var DROP_COLS = ['Age', 'Cabin', 'Embarked'];
      var st4 = { on: { Age: false, Cabin: false, Embarked: false } };
      var body4 = UI.el('div');

      function rebuild4() {
        UI.clear(body4);
        var subset = DROP_COLS.filter(function (c) { return st4.on[c]; });
        var result = subset.length ? t.dropna({ subset: subset }) : t.dropna();
        body4.appendChild(UI.note(
          (subset.length ? "subset=[" + subset.join(', ') + ']' : 'subset 없음 (전체 컬럼 기준)') +
          ' 으로 dropna() 한 결과: ' + t.nrows() + '행 → ' + result.nrows() + '행 (' +
          (t.nrows() - result.nrows()) + '행 제거)'
        ));
        body4.appendChild(UI.frameTable(
          result.cols(['PassengerId', 'Age', 'Cabin', 'Embarked']),
          { maxRows: 5, frame: 'result', caption: '남은 행' }
        ));
      }

      var toggles4 = DROP_COLS.map(function (c) {
        return UI.toggle({
          label: c + ' 을(를) subset 에 포함', value: false,
          onChange: function (on) { st4.on[c] = on; rebuild4(); }
        });
      });
      box4.appendChild(UI.el('div.control-row', null, toggles4));
      box4.appendChild(body4);
      rebuild4();

      root.appendChild(box4);

      // ───────────────────────────────── 확인 문제
      root.appendChild(UI.quiz({
        title: '확인 문제 8-1',
        question:
          't.isna().sum()' + ' 을 실행하면 Age 자리에 ' + ageMissing + '(지금 데이터 기준)이라는 ' +
          '값이 나온다. 이 값은 어떻게 계산되는가?',
        choices: [
          { label: 'True 가 1로 취급되어 결측 칸을 그대로 더한 값이다', correct: true,
            why: 'isna() 는 칸마다 True/False 표를 만들고, .sum() 이 True 를 1로 세어 더한다. ' +
                 '그래서 Age 컬럼의 결측 개수인 ' + ageMissing + '이 그대로 나온다.' },
          { label: 'pandas 가 파일을 읽을 때 결측 개수를 미리 저장해 둔다', why: '틀렸다. isna().sum() 은 그 자리에서 매번 다시 계산되는 값이다.' },
          { label: '전체 행 수에서 count() 를 뺀 값과는 무관하다', why: '틀렸다. 두 방법(불린 합, 행수-count) 은 같은 값을 주지만, isna().sum() 이 실제로 계산하는 방식은 불린 합이다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 8-2',
        question:
          "t4 = t.copy() 로 만든 뒤 t4['Age'].fillna(0, inplace=True) 를 실행했다. " +
          "그 다음 t4['Age'].isna().sum() 은 몇인가?",
        choices: [
          { label: '0 (전부 채워졌다)', why: '틀렸다. 컬럼 하나를 먼저 골라낸 뒤 inplace=True 를 쓰면 조용히 실패한다.' },
          { label: ageMissing + ' (원본과 같다, 그대로다)', correct: true,
            why: "t4['Age'] 는 컬럼 하나를 골라낸 결과다. 여기에 inplace=True 를 주는 것은 그 결과 자체를 " +
                 "고치라는 뜻이라 t4 에는 반영되지 않는다(ChainedAssignmentError 경고, 예외 아님). " +
                 "바른 형태는 t4['Age'] = t4['Age'].fillna(0) 처럼 컬럼을 다시 대입하는 것이다." },
          { label: '에러가 나서 코드가 멈춘다', why: '틀렸다. ChainedAssignmentError는 경고일 뿐 예외가 아니라서 코드는 끝까지 실행된다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 8-3',
        question:
          "titanic['Age'] = titanic['Age'].fillna('0') 을 실행한 다음 dtype 과 mean() 은 각각 어떻게 되는가?",
        choices: [
          { label: 'dtype 은 object 로 바뀌고 mean() 은 예외를 던진다', correct: true,
            why: "문자열 '0' 하나가 들어가면서 float64 였던 dtype 이 object 로 승격된다(방금 실습에서 " +
                 (fillnaStr.dtype === 'object' ? '실제로 object 가 나왔다' : '확인했다') + "). object 컬럼에 " +
                 '문자열과 실수가 섞여 있으면 mean() 은 실제로 "' + (strMeanMsg || 'TypeError') + '" 를 던진다.' },
          { label: 'dtype 은 그대로 float64 이고 mean() 도 잘 계산된다', why: "틀렸다. 숫자 0(따옴표 없이)을 채웠을 때만 float64 로 남는다." },
          { label: "dtype 은 str 로 바뀐다", why: "틀렸다. 문자열과 실수가 섞이면 전용 str 이 아니라 더 넓은 object 로 떨어진다." }
        ]
      }));
    }
  });
})();
