/* ch12-merge.js — 12장. 표를 합치기: concat 과 merge (교재 12장, pandas.md 4679~5083줄)
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수(각 시뮬레이터의 st 객체)에 둔다(API.md §1 ②).
 *
 * concat 은 "같은 모양의 표를 세로로 쌓는다", merge 는 "다른 표를 키로 옆에 잇는다" — 이 둘을
 * 구분하지 못하면 행이 왜 늘거나 줄었는지 설명할 수 없다. 표는 전부 UI.frameTable/UI.table 로
 * 그린다 — 직접 표를 그리지 않는다. 색은 API.md §1 ③ 대로 원본=파랑/사본=주황/결과=초록만 쓴다.
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────── 순수 도우미
  // (상태가 없는 계산·설정 자료만 모듈 스코프에 둔다. ch06-align.js 의 OPS 와 같은 패턴.)

  var HOW_OPTIONS = [
    { label: 'inner (기본)', value: 'inner' },
    { label: 'left', value: 'left' },
    { label: 'right', value: 'right' },
    { label: 'outer', value: 'outer' }
  ];

  /* merge 시뮬레이터 ②·③ 이 함께 쓰는 예제 모음. 교재 12.3절의 예제를 기본값으로 둔다. */
  var PRESETS_MERGE = [
    { label: '교재 예제 (a,b,c ↔ b,c,d)', leftKeys: ['a', 'b', 'c'], leftVals: [1, 2, 3], rightKeys: ['b', 'c', 'd'], rightVals: [20, 30, 40] },
    { label: '완전히 겹침 (a,b,c ↔ a,b,c)', leftKeys: ['a', 'b', 'c'], leftVals: [1, 2, 3], rightKeys: ['a', 'b', 'c'], rightVals: [10, 20, 30] },
    { label: '전혀 안 겹침 (a,b,c ↔ x,y,z)', leftKeys: ['a', 'b', 'c'], leftVals: [1, 2, 3], rightKeys: ['x', 'y', 'z'], rightVals: [10, 20, 30] },
    { label: '왼쪽이 더 좁음 (a,b ↔ a,b,c,d)', leftKeys: ['a', 'b'], leftVals: [1, 2], rightKeys: ['a', 'b', 'c', 'd'], rightVals: [10, 20, 30, 40] }
  ];

  /* how 네 가지를 전부 돌려서 결과 행 수를 계산한다. 순수 함수 — 새 merge 를 매번 새로 계산할 뿐
   * 어느 쪽도 바꾸지 않는다. HOW_OPTIONS 와 같은 순서로 반환해서 표 하이라이트 인덱스를 맞춘다. */
  function computeHowCounts(left, right, on) {
    return HOW_OPTIONS.map(function (h) {
      return { how: h.value, rows: left.merge(right, { on: on, how: h.value }).shape[0] };
    });
  }

  function makeKeyFrame(keys, vals, valCol) {
    var obj = {};
    obj.key = keys.slice();
    obj[valCol] = vals.slice();
    return DF.frame(obj, { columns: ['key', valCol] });
  }

  Lab.register({
    id: 'ch12-merge',
    num: 12,
    title: '표를 합치기 — concat 과 merge',
    subtitle: '같은 모양의 표는 세로로 쌓고(concat), 다른 표는 공통 열(키)로 옆에 잇는다(merge)',

    render: function (root) {
      root.appendChild(simConcat());
      root.appendChild(simMergeHow());
      root.appendChild(simMatchTrace());
      root.appendChild(simDuplicateKeys());
      root.appendChild(simCommonMistakes());
      root.appendChild(quizSection());
    }
  });

  // ───────────────────────────────── 시뮬레이터 ① concat — 세로로 쌓기

  function simConcat() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① concat — 세로로 쌓기' }));
    box.appendChild(UI.note(
      'titanic 데이터를 두 조각으로 잘라 train.csv/test.csv 두 파일을 흉내낸다. 두 조각 모두 자기 파일인 ' +
      '것처럼 인덱스를 0부터 다시 매겨서, 실제로 파일 두 개를 각각 읽었을 때와 같은 상황을 만든다.'
    ));

    var DROP_CHOICES = [
      { label: '컬럼 구성 그대로', value: null },
      { label: "조각 B 에서 'Survived' 빼기", value: 'Survived' },
      { label: "조각 B 에서 'Pclass' 빼기", value: 'Pclass' }
    ];

    var st = { n: 4, m: 4, dropCol: null, ignoreIndex: false, addSource: false };
    var body = UI.el('div');

    box.appendChild(UI.slider({
      label: '조각 A 행 수 (n)', min: 2, max: 8, value: st.n,
      onChange: function (v) { st.n = v; rebuild(); }
    }));
    box.appendChild(UI.slider({
      label: '조각 B 행 수 (m)', min: 2, max: 8, value: st.m,
      onChange: function (v) { st.m = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(
      DROP_CHOICES.map(function (d) { return { label: d.label, value: d.label }; }),
      { label: '조각 B 컬럼', selected: 0, onChange: function (v, i) { st.dropCol = DROP_CHOICES[i].value; rebuild(); } }
    ));
    box.appendChild(UI.toggle({
      label: 'ignore_index=True 사용', value: st.ignoreIndex,
      onChange: function (on) { st.ignoreIndex = on; rebuild(); }
    }));
    box.appendChild(UI.toggle({
      label: '출처 컬럼(source) 추가', value: st.addSource,
      onChange: function (on) { st.addSource = on; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var t = LabData.frame('titanic').cols(['PassengerId', 'Pclass', 'Name', 'Age', 'Survived']);
      var A = t.head(st.n);
      var B = t.islice(st.n, st.n + st.m).resetIndex({ drop: true });
      if (st.dropCol) B = B.drop(st.dropCol, { axis: 1 });
      if (st.addSource) {
        A.setCol('source', '조각A');
        B.setCol('source', '조각B');
      }

      body.appendChild(UI.frameTable(A, {
        frame: 'original', digits: 2,
        caption: '조각 A (train 역할) — ' + A.shape[0] + '행, 인덱스 0~' + (A.shape[0] - 1)
      }));
      body.appendChild(UI.frameTable(B, {
        frame: 'copy', digits: 2,
        caption: '조각 B (test 역할) — ' + B.shape[0] + '행, 인덱스 0~' + (B.shape[0] - 1) +
          (st.dropCol ? (", '" + st.dropCol + "' 컬럼 없음") : '')
      }));

      var combined = DF.concat([A, B], { ignoreIndex: st.ignoreIndex });
      body.appendChild(UI.code(
        'pd.concat([A, B]' + (st.ignoreIndex ? ', ignore_index=True' : '') + ')',
        { output: combined.toString(16) }
      ));
      body.appendChild(UI.frameTable(combined, {
        frame: 'result', digits: 2,
        caption: '결과 — ' + combined.shape[0] + '행 x ' + combined.shape[1] + '열'
      }));

      if (!st.ignoreIndex && combined.index.hasDuplicates()) {
        body.appendChild(UI.danger(
          '인덱스가 겹친다',
          '조각 A 와 조각 B 가 각자 0부터 인덱스를 다시 매겼기 때문에, 합친 표에도 같은 번호가 두 번 나온다. ' +
          '위의 ignore_index=True 토글을 켜서 비교해 보라.'
        ));
      } else if (st.ignoreIndex) {
        body.appendChild(UI.note('ignore_index=True 를 켜서 0부터 새로 번호를 매겼다. 인덱스가 겹치지 않는다.'));
      }

      if (st.dropCol) {
        var naCount = combined.col(st.dropCol).isna().sum();
        body.appendChild(UI.danger(
          "'" + st.dropCol + "' 열이 NaN 이 됐다",
          "조각 B 에는 '" + st.dropCol + "' 열이 아예 없었다. 합친 표에서 그 열의 결측 개수는 " + naCount +
          '개로, 정확히 조각 B 의 행 수(' + B.shape[0] + ')와 같다. 없는 열은 pandas 가 전부 NaN 으로 채운다.'
        ));
      }

      if (st.addSource) {
        body.appendChild(UI.note("source 열을 보면 각 행이 조각 A 에서 왔는지 B 에서 왔는지 바로 알 수 있다."));
      } else {
        body.appendChild(UI.note(
          '지금은 출처를 표시하는 열이 없다.' +
          (st.dropCol ? (" '" + st.dropCol + "' 열의 NaN 이 우연히 단서가 되지만, ") : ' ') +
          '두 조각의 컬럼 구성이 완전히 같았다면 어느 쪽에서 왔는지 합친 뒤에는 되돌릴 방법이 없다. ' +
          '위의 "출처 컬럼 추가" 토글을 켜서 비교해 보라.'
        ));
      }
    }

    rebuild();
    return box;
  }

  // ───────────────────────────────── 시뮬레이터 ② merge — how 네 가지

  function simMergeHow() {
    var st = { preset: 0, how: 'inner' };
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② merge — how 네 가지' }));
    box.appendChild(UI.note(
      '작은 표 두 개를 key 로 잇는다. 891행짜리 표로는 무슨 일이 일어나는지 안 보이니 3~4행짜리로 본다. ' +
      'how 를 바꾸며 결과 행 수가 어떻게 달라지는지 확인하라.'
    ));

    box.appendChild(UI.buttonGroup(
      PRESETS_MERGE.map(function (p) { return { label: p.label, value: p.label }; }),
      { label: '예제', selected: st.preset, onChange: function (v, i) { st.preset = i; rebuild(); } }
    ));
    box.appendChild(UI.buttonGroup(HOW_OPTIONS, {
      label: 'how', selected: 0, onChange: function (v) { st.how = v; rebuild(); }
    }));

    var body = UI.el('div');
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var p = PRESETS_MERGE[st.preset];
      var left = makeKeyFrame(p.leftKeys, p.leftVals, 'L');
      var right = makeKeyFrame(p.rightKeys, p.rightVals, 'R');
      var result = left.merge(right, { on: 'key', how: st.how });

      body.appendChild(UI.frameTable(left, { frame: 'original', caption: 'left — key [' + p.leftKeys.join(', ') + ']' }));
      body.appendChild(UI.frameTable(right, { frame: 'copy', caption: 'right — key [' + p.rightKeys.join(', ') + ']' }));
      body.appendChild(UI.code("left.merge(right, on='key', how='" + st.how + "')", { output: result.toString() }));
      body.appendChild(UI.frameTable(result, { frame: 'result', caption: '결과 — ' + result.shape[0] + '행' }));

      var counts = computeHowCounts(left, right, 'key');
      body.appendChild(UI.el('div.panel-title', { text: 'how 별 결과 행 수' }));
      body.appendChild(UI.table(
        [{ key: 'how', label: 'how' }, { key: 'rows', label: '행 수' }],
        counts,
        { hlRows: [HOW_OPTIONS.map(function (h) { return h.value; }).indexOf(st.how)] }
      ));

      var naCells = 0;
      result.columns.forEach(function (c) { naCells += result.col(c).isna().sum(); });
      if (naCells > 0) {
        body.appendChild(UI.danger(
          '매칭되지 않은 자리는 NaN',
          "how='" + st.how + "' 결과에는 상대 쪽에 짝이 없는 키 자리가 있어 NaN 이 " + naCells + '칸 있다.'
        ));
      } else {
        body.appendChild(UI.note("how='" + st.how + "' 에서는 모든 자리가 양쪽 다 채워져서 NaN 이 없다."));
      }
    }

    rebuild();
    return box;
  }

  // ───────────────────────────────── 시뮬레이터 ③ 키 매칭을 표로 잇기 (DF.trace)

  function simMatchTrace() {
    var st = { preset: 0, how: 'inner' };
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 키 매칭 들여다보기' }));
    box.appendChild(UI.note(
      'DF.trace 로 merge 가 실제로 어떤 왼쪽 행과 오른쪽 행을 짝지었는지 기록한다. -1 은 그 쪽에 짝이 ' +
      '없다는 뜻이다. how 를 바꾸며 짝의 수가 늘고 줄어드는 것을 보라.'
    ));

    box.appendChild(UI.buttonGroup(
      PRESETS_MERGE.map(function (p) { return { label: p.label, value: p.label }; }),
      { label: '예제', selected: st.preset, onChange: function (v, i) { st.preset = i; rebuild(); } }
    ));
    box.appendChild(UI.buttonGroup(HOW_OPTIONS, {
      label: 'how', selected: 0, onChange: function (v) { st.how = v; rebuild(); }
    }));

    var body = UI.el('div');
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var p = PRESETS_MERGE[st.preset];
      var left = makeKeyFrame(p.leftKeys, p.leftVals, 'L');
      var right = makeKeyFrame(p.rightKeys, p.rightVals, 'R');

      DF.trace.enable();
      left.merge(right, { on: 'key', how: st.how });
      var steps = DF.trace.get();
      DF.trace.disable();

      var mergeStep = null;
      steps.forEach(function (s) { if (s.kind === 'merge') mergeStep = s; });
      var matches = mergeStep ? mergeStep.detail.matches : [];

      body.appendChild(UI.frameTable(left, { frame: 'original', caption: 'left — key [' + p.leftKeys.join(', ') + ']' }));
      body.appendChild(UI.frameTable(right, { frame: 'copy', caption: 'right — key [' + p.rightKeys.join(', ') + ']' }));

      var rows = matches.map(function (pr, i) {
        return {
          order: i + 1,
          leftPos: pr[0] === -1 ? '—' : pr[0],
          leftKey: pr[0] === -1 ? 'NaN' : left.col('key').at(pr[0]),
          rightPos: pr[1] === -1 ? '—' : pr[1],
          rightKey: pr[1] === -1 ? 'NaN' : right.col('key').at(pr[1])
        };
      });
      body.appendChild(UI.table([
        { key: 'order', label: '순서' },
        { key: 'leftPos', label: '왼쪽 행 번호' },
        { key: 'leftKey', label: '왼쪽 key' },
        { key: 'rightPos', label: '오른쪽 행 번호' },
        { key: 'rightKey', label: '오른쪽 key' }
      ], rows, { frame: 'result', caption: "DF.trace 가 기록한 키 매칭 — " + matches.length + '쌍' }));

      body.appendChild(UI.note(
        '짝의 수(' + matches.length + '쌍)는 시뮬레이터 ②의 "how 별 결과 행 수" 표에서 how=' + "'" + st.how +
        "'" + ' 행과 같은 숫자다. how 를 바꿔 가며 표에서 짝이 늘고 줄어드는 것을 직접 세어 보라.'
      ));
    }

    rebuild();
    return box;
  }

  // ───────────────────────────────── 시뮬레이터 ④ ★ 키가 중복이면 행이 늘어난다

  function simDuplicateKeys() {
    var st = { leftDup: 2, rightDup: 2, how: 'inner' };
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ ★ 키가 중복이면 행이 늘어난다' }));
    box.appendChild(UI.note(
      "key='a' 가 왼쪽에 몇 개, 오른쪽에 몇 개 있는지 슬라이더로 조절해 보라. 겹치는 키는 곱집합으로 " +
      '전부 짝지어지므로 결과 행 수가 곱으로 늘어난다 — 6장의 인덱스 정렬과 완전히 같은 원리다.'
    ));

    box.appendChild(UI.slider({
      label: "왼쪽의 key='a' 개수", min: 1, max: 4, value: st.leftDup,
      onChange: function (v) { st.leftDup = v; rebuild(); }
    }));
    box.appendChild(UI.slider({
      label: "오른쪽의 key='a' 개수", min: 1, max: 4, value: st.rightDup,
      onChange: function (v) { st.rightDup = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(HOW_OPTIONS, {
      label: 'how', selected: 0, onChange: function (v) { st.how = v; rebuild(); }
    }));

    var body = UI.el('div');
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var leftKeys = [], leftVals = [], rightKeys = [], rightVals = [];
      for (var i = 0; i < st.leftDup; i++) { leftKeys.push('a'); leftVals.push(i + 1); }
      leftKeys.push('b'); leftVals.push(99);          // 왼쪽에만 있는 여분의 키
      for (var j = 0; j < st.rightDup; j++) { rightKeys.push('a'); rightVals.push((j + 1) * 10); }
      rightKeys.push('c'); rightVals.push(999);       // 오른쪽에만 있는 여분의 키

      var left = makeKeyFrame(leftKeys, leftVals, 'L');
      var right = makeKeyFrame(rightKeys, rightVals, 'R');
      var result = left.merge(right, { on: 'key', how: st.how });

      body.appendChild(UI.frameTable(left, { frame: 'original', caption: 'left — ' + left.shape[0] + '행' }));
      body.appendChild(UI.frameTable(right, { frame: 'copy', caption: 'right — ' + right.shape[0] + '행' }));
      body.appendChild(UI.code("left.merge(right, on='key', how='" + st.how + "')", { output: result.toString() }));
      body.appendChild(UI.frameTable(result, { frame: 'result', caption: '결과 — ' + result.shape[0] + '행' }));

      var expectedA = st.leftDup * st.rightDup;
      body.appendChild(UI.note(
        "key='a' 는 왼쪽 " + st.leftDup + '개 × 오른쪽 ' + st.rightDup + '개 = ' + expectedA + '쌍이 만들어진다. ' +
        '왼쪽이 바깥 루프, 오른쪽이 안쪽 루프를 돈다 — 6장의 곱집합과 같은 원리다.',
        '곱집합'
      ));

      if (result.shape[0] > Math.max(left.shape[0], right.shape[0])) {
        body.appendChild(UI.danger(
          '결과 행이 늘어났다',
          '왼쪽 ' + left.shape[0] + '행, 오른쪽 ' + right.shape[0] + '행인데 결과는 ' + result.shape[0] +
          "행이다. key='a' 가 중복된 자리에서 곱집합으로 짝지어졌기 때문이다. merge 후에는 항상 df.shape 로 " +
          '행 수를 확인하는 습관을 들여야 한다.'
        ));
      }
      if (st.how === 'left' && result.shape[0] > left.shape[0]) {
        body.appendChild(UI.danger(
          "how='left' 인데 늘었다",
          "how='left' 는 왼쪽 표를 다치지 않게 지킨다는 뜻이지 행 수를 그대로 지킨다는 뜻이 아니다. " +
          '오른쪽 key 가 중복되면 왼쪽의 그 행 하나가 여러 행으로 불어난다.'
        ));
      }
    }

    rebuild();
    return box;
  }

  // ───────────────────────────────── 흔한 실수

  function simCommonMistakes() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '흔한 실수' }));

    var c1 = DF.frame({ id: [1, 2], score: [10, 20] }, { columns: ['id', 'score'] });
    var c2 = DF.frame({ id: [1, 2], score: [100, 200] }, { columns: ['id', 'score'] });
    var merged = c1.merge(c2, { on: 'id', how: 'inner' });

    box.appendChild(UI.el('div.panel-title', { text: "① 같은 이름의 컬럼이 양쪽에 있으면" }));
    box.appendChild(UI.frameTable(c1, { frame: 'original', caption: "left — 컬럼 [id, score]" }));
    box.appendChild(UI.frameTable(c2, { frame: 'copy', caption: "right — 컬럼 [id, score] (이름이 겹친다)" }));
    box.appendChild(UI.code("c1.merge(c2, on='id', how='inner')", { output: merged.toString() }));
    box.appendChild(UI.frameTable(merged, { frame: 'result', caption: '결과 — 컬럼 [' + merged.columns.join(', ') + ']' }));
    box.appendChild(UI.note(
      "score 가 양쪽에 다 있어서 겹친다. 이 실습 엔진은 왼쪽 이름은 그대로 두고 겹치는 오른쪽 컬럼에만 " +
      "'_y' 를 붙인다(위 결과의 컬럼 이름에서 확인). 실제 pandas 의 기본 접미사는 ('_x','_y') 라서 왼쪽도 " +
      "'score_x' 처럼 바뀐다(교재 12.5절 예제 참고) — 어느 쪽이든 merge 뒤에는 결과의 컬럼 이름을 항상 확인해야 한다."
    ));

    box.appendChild(UI.el('div.panel-title', { text: "② how='left' 인데 행이 늘었다면" }));
    box.appendChild(UI.note(
      "how='left' 인데 결과 행 수가 왼쪽 표보다 많다면 오른쪽 key 가 중복됐다는 뜻이다. 위 시뮬레이터 ④에서 " +
      "how='left' 를 고르고 오른쪽 key='a' 개수를 2 이상으로 올려 직접 재현해 보라."
    ));

    return box;
  }

  // ───────────────────────────────── 확인 문제

  function quizSection() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: '확인 문제' }));

    // 12-1 concat — 없는 컬럼은 NaN
    var qA = DF.frame({ id: [1, 2, 3], score: [10, 20, 30] }, { columns: ['id', 'score'] });
    var qB = DF.frame({ id: [4, 5], grade: ['A', 'B'] }, { columns: ['id', 'grade'] });
    var qConcat = DF.concat([qA, qB], { ignoreIndex: true });
    var qNaScore = qConcat.col('score').isna().sum();

    wrap.appendChild(UI.quiz({
      title: '확인 문제 12-1',
      question:
        'qA(' + qA.shape[0] + "행, 컬럼 [id, score])와 qB(" + qB.shape[0] + "행, 컬럼 [id, grade])를 " +
        'pd.concat([qA, qB], ignore_index=True) 로 합치면 score 열의 결측 개수는 몇 개인가?',
      choices: [
        { label: '0개', why: '오답이다. qB 에는 애초에 score 열이 없다. 없는 열은 값이 있고 없고를 떠나 그 행에서는 전부 결측이 된다.' },
        { label: qNaScore + '개', correct: true,
          why: "qB 에는 score 열 자체가 없어서, qB 에서 온 행 전부(" + qB.shape[0] + '행)가 결측이 된다. 그래서 정확히 qB 의 행 수와 같다.' },
        { label: (qA.shape[0] + qB.shape[0]) + '개', why: '오답이다. 이건 그냥 두 표의 행 수를 더한 값이다 — score 가 있는 qA 쪽 행은 결측이 아니다.' }
      ]
    }));

    // 12-2 merge outer — 교재 12.3절과 같은 예제
    var qLeft2 = DF.frame({ key: ['a', 'b', 'c'], L: [1, 2, 3] }, { columns: ['key', 'L'] });
    var qRight2 = DF.frame({ key: ['b', 'c', 'd'], R: [20, 30, 40] }, { columns: ['key', 'R'] });
    var qOuter2 = qLeft2.merge(qRight2, { on: 'key', how: 'outer' });
    var qInner2 = qLeft2.merge(qRight2, { on: 'key', how: 'inner' });

    wrap.appendChild(UI.quiz({
      title: '확인 문제 12-2',
      question:
        "left 의 key 가 [a,b,c], right 의 key 가 [b,c,d] 일 때 left.merge(right, on='key', how='outer') 는 몇 행이 되는가?",
      choices: [
        { label: qInner2.shape[0] + '행', why: "오답이다. 이건 how='inner'(교집합)의 행 수다. outer 는 합집합이라 더 넓다." },
        { label: (qLeft2.shape[0] + qRight2.shape[0]) + '행', why: '오답이다. 이건 그냥 두 표의 길이를 더한 값이다 — 겹치는 키(b, c)를 두 번 세면 안 된다.' },
        { label: qOuter2.shape[0] + '행', correct: true,
          why: "양쪽 key 의 합집합 [a,b,c,d] 만큼 행이 생긴다. inner(교집합)가 " + qInner2.shape[0] + '행인 것과 비교해 보라.' }
      ]
    }));

    // 12-3 merge 중복 키 — 곱집합 (교재 12.4절과 같은 예제)
    var qL3 = DF.frame({ key: ['a', 'a'], L: [1, 2] }, { columns: ['key', 'L'] });
    var qR3 = DF.frame({ key: ['a', 'a', 'a'], R: [10, 20, 30] }, { columns: ['key', 'R'] });
    var qM3 = qL3.merge(qR3, { on: 'key', how: 'inner' });

    wrap.appendChild(UI.quiz({
      title: '확인 문제 12-3',
      question:
        "left 의 key 가 ['a','a'](2개), right 의 key 가 ['a','a','a'](3개)일 때 how='inner' 로 merge 하면 몇 행이 되는가?",
      choices: [
        { label: (qL3.shape[0] + qR3.shape[0]) + '행', why: '오답이다. 이건 그냥 두 표의 행 수를 더한 값이다 — 실제로는 겹치는 key 끼리 곱집합을 계산해야 한다.' },
        { label: qM3.shape[0] + '행', correct: true,
          why: 'key=a 가 왼쪽 2개 × 오른쪽 3개 = ' + qM3.shape[0] + '쌍으로 짝지어진다. 6장에서 본 인덱스 정렬의 곱집합과 같은 규칙이다.' },
        { label: (qM3.shape[0] + 2) + '행', why: '오답이다.' }
      ]
    }));

    // 12-4 how=left 인데 행이 늘어난 경우 — 개념 확인 (교재 12.5절 ④)
    wrap.appendChild(UI.quiz({
      title: '확인 문제 12-4',
      question:
        "how='left' 로 merge 했는데 결과 행 수가 왼쪽 표보다 많이 나왔다. 무엇을 의심해야 하는가?",
      choices: [
        { label: '오른쪽 표의 key 가 중복됐다', correct: true,
          why: "how='left' 는 왼쪽의 key 를 전부 보존한다는 뜻이지 행 수를 유지한다는 뜻이 아니다. 왼쪽의 key 하나가 오른쪽에서 여러 번 매칭되면 그 하나가 여러 행으로 불어난다." },
        { label: '왼쪽 표의 key 가 중복됐다', why: "오답이다. 왼쪽 key 가 중복돼도 이미 왼쪽 표 자체에 그만큼의 행이 있었던 것이다 — 새로 늘어난 원인은 오른쪽의 중복이다." },
        { label: '이런 일은 일어날 수 없다 — 계산이 잘못된 것이다', why: 'how=left 라도 오른쪽 key 가 중복되면 행이 느는 것은 정상 동작이다. validate="many_to_one" 등으로 미리 확인하는 습관이 필요하다.' }
      ]
    }));

    return wrap;
  }
})();
