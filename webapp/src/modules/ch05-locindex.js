/* ch05-locindex.js — 5장. loc 와 iloc: 라벨과 위치 (교재 5장, pandas.md 1549~2153줄)
 *
 * 학생이 가장 많이 틀리는 개념 3위. 이 장의 심장은 시뮬레이터 ①이다 —
 * 인덱스가 [55, 56, 1, 2] 인 DataFrame 에서 iloc(2) 와 loc(2) 가 다른 행을 가리키는 것을
 * 조작해서 직접 확인한다.
 *
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②).
 * UI.code 에 보여주는 코드 문자열은 교재와 같은 파이썬 표기(대괄호)를 쓴다 — 실제 계산은
 * DF 엔진의 JS 표기(API.md §4.5, 객체 인자)로 한다. 학생에게 파이썬 문법을 보여주는 것과
 * 엔진을 호출하는 것은 서로 다른 층이다.
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────── 순수 도우미(가변 상태 없음)

  var IDX_MODE_INFO = [
    { value: 'default', label: '기본 (0,1,2,3)' },
    { value: 'shuffled', label: '뒤섞인 ([55,56,1,2])' },
    { value: 'char', label: "문자 ('a','b','c','d')" }
  ];

  function idxLabelsFor(mode) {
    if (mode === 'shuffled') return [55, 56, 1, 2];
    if (mode === 'char') return ['a', 'b', 'c', 'd'];
    return [0, 1, 2, 3];
  }

  /* 교재 5.1 절의 temp 를 그대로 재현한다. 이름은 지어낸 것이다(실존 인물 아님). */
  function makeTemp(mode) {
    return DF.frame({
      '성': ['김', '이', '박', '최'],
      '이름': ['민준', '서연', '도윤', '하은'],
      '나이': [27, 19, 32, 31],
      '팀': ['탐구반', '실험반', '토론반', '발표반']
    }, { index: idxLabelsFor(mode) });
  }

  /* loc 라벨 버튼의 기본값. 라벨 2 가 있으면 그것을(교재 5.1 절 예제와 일치),
   * 없으면(문자 인덱스) 위치 2 자리의 라벨을 대신 쓴다. */
  function defaultLocLabel(mode) {
    var labels = idxLabelsFor(mode);
    var i = labels.indexOf(2);
    return i !== -1 ? labels[i] : labels[2];
  }

  /* 교재 코드 표시용 — 파이썬 리터럴로 찍는다(문자열엔 따옴표, 숫자는 그대로). */
  function pyLit(v) {
    return typeof v === 'string' ? "'" + v + "'" : String(v);
  }

  Lab.register({
    id: 'ch05-locindex',
    num: 5,
    title: 'loc 와 iloc — 라벨과 위치',
    subtitle: '같은 숫자 2 가 iloc 와 loc 에서 다른 행을 가리키는 이유',

    render: function (root) {
      var t = LabData.frame('titanic'); // LabData.frame() 은 render 안에서 부른다 (API.md §3)

      // ============================================================
      // 시뮬레이터 ① 라벨과 위치 나란히 보기 — 이 장의 심장
      // ============================================================
      var st1 = { mode: 'shuffled', ilocPos: 2, locLabel: defaultLocLabel('shuffled') };

      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 라벨과 위치 나란히 보기' }));
      box1.appendChild(UI.note(
        'DataFrame 의 행에는 좌표가 두 개 있다 — 몇 번째 줄인가(위치)와 이름표가 무엇인가(라벨). ' +
        'iloc(n) 은 위치 n 인 행을, loc(라벨) 은 그 라벨을 가진 행을 찾는다. 아래에서 위치 슬라이더와 ' +
        '라벨 버튼을 각각 움직여, 두 기준이 어떤 행을 가리키는지 표에서 링(is-focus)으로 확인해 보라.'
      ));

      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(body1);
        var df = makeTemp(st1.mode);
        var ilocPos = st1.ilocPos;
        var locLabel = st1.locLabel;
        var locPositions = df.index.positions(locLabel);
        var locPos = locPositions.length ? locPositions[0] : null;

        var keys = ['pos', 'label'].concat(df.columns);
        var cols = keys.map(function (k) {
          return { key: k, label: k === 'pos' ? '위치' : k === 'label' ? '라벨' : k };
        });
        var rows = [];
        for (var i = 0; i < df.nrows(); i++) {
          var r = { pos: i, label: df.index.at(i) };
          df.columns.forEach(function (c) { r[c] = df.col(c).at(i); });
          rows.push(r);
        }
        var hlCells = [];
        keys.forEach(function (k) { hlCells.push([ilocPos, k]); });
        if (locPos !== null) keys.forEach(function (k) { hlCells.push([locPos, k]); });

        body1.appendChild(UI.table(cols, rows, {
          hlCells: hlCells,
          caption: 'temp — index = [' + df.index.labels.join(', ') + ']'
        }));

        var ilocRow = df.iloc(ilocPos);
        var ilocName = ilocRow.col('이름').at(0);
        var ilocLabelAt = df.index.at(ilocPos);
        body1.appendChild(UI.code(
          'temp.iloc[' + ilocPos + "]['이름']",
          { output: "'" + ilocName + "'   (위치 " + ilocPos + "번째 줄, 라벨 " + UI.fmt(ilocLabelAt) + ')' }
        ));

        var locName = df.loc(locLabel).col('이름').at(0);
        body1.appendChild(UI.code(
          'temp.loc[' + pyLit(locLabel) + "]['이름']",
          { output: "'" + locName + "'   (라벨 " + UI.fmt(locLabel) + '인 행, 위치 ' + locPos + '번째)' }
        ));

        if (ilocPos === locPos) {
          var msg = 'iloc(' + ilocPos + ')와 loc(' + UI.fmt(locLabel) + ')가 같은 행(위치 ' + ilocPos + ')을 가리킨다.';
          if (st1.mode === 'default') {
            msg += ' 지금은 인덱스가 기본값(0,1,2,3)이라 위치와 라벨이 같은 숫자면 우연히 일치한다 — ' +
              '그래서 이 상태만 보면 iloc 와 loc 를 섞어 써도 문제가 드러나지 않는다. "뒤섞인" 버튼을 눌러 ' +
              '이 우연이 깨지는 것을 확인해 보라. 그게 바로 버그가 숨는 자리다.';
          }
          body1.appendChild(UI.note(msg));
        } else {
          body1.appendChild(UI.note(
            'iloc(' + ilocPos + ')는 위치 ' + ilocPos + '번째 줄(라벨 ' + UI.fmt(ilocLabelAt) + ')을, loc(' +
            UI.fmt(locLabel) + ')는 라벨이 ' + UI.fmt(locLabel) + '인 위치 ' + locPos + '번째 줄을 가리킨다. ' +
            '같은 숫자를 썼는데 다른 행이 나왔다 — 하나는 위치로, 하나는 이름표로 읽었기 때문이다.'
          ));
        }
      }

      var locGroupWrap = UI.el('div');
      function rebuildLocGroup() {
        UI.clear(locGroupWrap);
        var labels = idxLabelsFor(st1.mode);
        var sel = labels.indexOf(st1.locLabel);
        if (sel === -1) { st1.locLabel = labels[0]; sel = 0; }
        locGroupWrap.appendChild(UI.buttonGroup(
          labels.map(function (l) { return { label: String(l), value: l }; }),
          {
            label: 'loc 라벨 선택',
            selected: sel,
            onChange: function (v) { st1.locLabel = v; rebuild1(); }
          }
        ));
      }

      var modeGroup = UI.buttonGroup(
        IDX_MODE_INFO.map(function (m) { return { label: m.label, value: m.value }; }),
        {
          label: '인덱스',
          selected: IDX_MODE_INFO.map(function (m) { return m.value; }).indexOf(st1.mode),
          onChange: function (v) {
            st1.mode = v;
            st1.locLabel = defaultLocLabel(v);
            rebuildLocGroup();
            rebuild1();
          }
        }
      );
      var ilocSlider = UI.slider({
        label: 'iloc 위치 선택', min: 0, max: 3, step: 1, value: st1.ilocPos,
        onChange: function (v) { st1.ilocPos = v; rebuild1(); }
      });

      root.appendChild(box1);
      box1.appendChild(modeGroup);
      box1.appendChild(ilocSlider);
      box1.appendChild(locGroupWrap);
      box1.appendChild(body1);
      rebuildLocGroup();
      rebuild1();

      // ============================================================
      // 시뮬레이터 ② [] 연산자의 세 가지 의미
      // ============================================================
      var tSmall = t.cols(['Pclass', 'Name', 'Age']);

      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② [] 연산자의 세 가지 의미' }));
      box2.appendChild(UI.note(
        '같은 대괄호 df[...] 도 안에 무엇을 넣느냐에 따라 완전히 다른 일을 한다 — 열 이름 하나면 Series, ' +
        '리스트면 DataFrame, 슬라이스(콜론이 있는 형태)면 행 선택, 불린 배열이면 필터. 슬라이스가 아닌 ' +
        '정수 하나는 컬럼 이름으로 취급되어, 그런 이름의 컬럼이 없으면 KeyError 가 난다.'
      ));

      var seriesForm = tSmall.col('Name');
      var frameForm = tSmall.cols(['Name']);
      box2.appendChild(UI.table(
        [{ key: 'expr', label: '표현' }, { key: 'type', label: '타입' }, { key: 'shape', label: 'shape' }],
        [
          { expr: "t['Name']", type: 'Series', shape: '(' + seriesForm.length() + ',)' },
          { expr: "t[['Name']]", type: 'DataFrame', shape: '(' + frameForm.shape[0] + ', ' + frameForm.shape[1] + ')' }
        ],
        { caption: "t['Name'] 과 t[['Name']] — 대괄호 개수가 타입을 바꾼다" }
      ));

      var FORM_ITEMS = [
        { label: "t['Name']", value: 'col' },
        { label: "t[['Pclass','Name']]", value: 'cols' },
        { label: 't[0:2]', value: 'slice' },
        { label: "t[t['Pclass'] == 3]", value: 'bool' },
        { label: 't[0]  (에러)', value: 'intkey' }
      ];
      var EXPR_TEXT = {
        col: "t['Name']", cols: "t[['Pclass','Name']]", slice: 't[0:2]',
        bool: "t[t['Pclass'] == 3]", intkey: 't[0]'
      };
      var st2 = { form: 'col' };
      var body2 = UI.el('div');

      function rebuild2() {
        UI.clear(body2);
        body2.appendChild(UI.code(EXPR_TEXT[st2.form]));

        if (st2.form === 'col') {
          var s = tSmall.col('Name');
          body2.appendChild(UI.seriesTable(s, { maxRows: 5, frame: 'result' }));
          body2.appendChild(UI.note('타입: Series, shape: (' + s.length() + ',)'));
        } else if (st2.form === 'cols') {
          var f = tSmall.cols(['Pclass', 'Name']);
          body2.appendChild(UI.frameTable(f, { maxRows: 5, frame: 'result' }));
          body2.appendChild(UI.note('타입: DataFrame, shape: (' + f.shape[0] + ', ' + f.shape[1] + ')'));
        } else if (st2.form === 'slice') {
          var sl = tSmall.islice(0, 2);
          body2.appendChild(UI.frameTable(sl, { frame: 'result' }));
          body2.appendChild(UI.note(
            '정수 슬라이스는 행을 자른다. shape: (' + sl.shape[0] + ', ' + sl.shape[1] + ') — 위치 0, 1 두 행만.'
          ));
        } else if (st2.form === 'bool') {
          var mask = tSmall.col('Pclass').eq(3);
          var filtered = tSmall.mask(mask);
          body2.appendChild(UI.frameTable(filtered, { maxRows: 5, frame: 'result' }));
          body2.appendChild(UI.note(
            '불린 배열은 조건에 맞는 행만 남긴다. 전체 ' + tSmall.nrows() + '행 중 ' + filtered.nrows() + '행이 남았다.'
          ));
        } else {
          try {
            tSmall.col(0);
            body2.appendChild(UI.note('에러가 나지 않았다.'));
          } catch (e) {
            body2.appendChild(UI.danger('에러', e.message));
            body2.appendChild(UI.note(
              '0 은 슬라이스가 아니라서 컬럼 이름으로 해석됐다. 이름이 0 인 컬럼이 없어 KeyError 가 났다. ' +
              't[0:2] 는 슬라이스라서 되지만 t[0] 은 안 된다 — 안에 콜론이 있느냐 없느냐로 규칙이 갈린다.'
            ));
          }
        }
      }

      var formGroup = UI.buttonGroup(FORM_ITEMS, {
        label: '표현 선택', selected: 0,
        onChange: function (v) { st2.form = v; rebuild2(); }
      });

      root.appendChild(box2);
      box2.appendChild(formGroup);
      box2.appendChild(body2);
      rebuild2();

      // ============================================================
      // 시뮬레이터 ③ 슬라이스 — 끝을 포함하는가
      // ============================================================
      function makeSliceFrame() {
        return DF.frame({
          '이름': ['가온', '나래', '다솜', '라온', '마루'],
          '점수': [88, 92, 79, 95, 84]
        }, { index: ['p', 'q', 'r', 's', 't'] });
      }

      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 슬라이스 — 끝을 포함하는가' }));
      box3.appendChild(UI.note(
        'iloc 의 위치 슬라이스는 파이썬 리스트처럼 끝을 제외한다. loc 의 라벨 슬라이스는 끝을 포함한다. ' +
        '슬라이더로 시작·끝을 바꿔 가며 두 결과가 몇 행씩 잡히는지 비교해 보라.'
      ));

      var st3 = { start: 1, end: 3 };
      var body3 = UI.el('div');

      function ringTable(df, sel, caption) {
        var selPos = sel.index.labels.map(function (l) { return df.index.positions(l)[0]; });
        var keys = ['pos', 'label'].concat(df.columns);
        var hlCells = [];
        selPos.forEach(function (p) { keys.forEach(function (k) { hlCells.push([p, k]); }); });
        var cols = keys.map(function (k) {
          return { key: k, label: k === 'pos' ? '위치' : k === 'label' ? '라벨' : k };
        });
        var rows = [];
        for (var i = 0; i < df.nrows(); i++) {
          var r = { pos: i, label: df.index.at(i) };
          df.columns.forEach(function (c) { r[c] = df.col(c).at(i); });
          rows.push(r);
        }
        return UI.table(cols, rows, { hlCells: hlCells, caption: caption });
      }

      function rebuild3() {
        UI.clear(body3);
        var df = makeSliceFrame();
        var labels = df.index.labels;
        var start = st3.start, end = st3.end;

        var ilocSel = df.iloc({ slice: true, start: start, stop: end });
        var fromLabel = labels[start], toLabel = labels[end];
        var locSel = df.loc({ range: true, from: fromLabel, to: toLabel });

        body3.appendChild(UI.code('data_df.iloc[' + start + ':' + end + ']'));
        body3.appendChild(ringTable(df, ilocSel,
          'iloc[' + start + ':' + end + '] → ' + ilocSel.nrows() + '행 (위치 ' + end + ' 제외)'));

        body3.appendChild(UI.code('data_df.loc[' + pyLit(fromLabel) + ':' + pyLit(toLabel) + ']'));
        body3.appendChild(ringTable(df, locSel,
          'loc[' + pyLit(fromLabel) + ':' + pyLit(toLabel) + '] → ' + locSel.nrows() +
          '행 (라벨 ' + UI.fmt(toLabel) + ' 포함)'));

        body3.appendChild(UI.note(
          'iloc 슬라이스는 끝(위치 ' + end + ')을 제외해 ' + ilocSel.nrows() + '행이, loc 슬라이스는 끝 라벨(' +
          UI.fmt(toLabel) + ')을 포함해 ' + locSel.nrows() + '행이 잡혔다. loc 결과가 iloc 결과보다 ' +
          (locSel.nrows() - ilocSel.nrows()) + '행 더 많다 — 슬라이스 표기법의 "끝" 이 서로 다른 뜻이기 때문이다.'
        ));
      }

      var startSlider = UI.slider({
        label: '시작 위치', min: 0, max: 4, step: 1, value: st3.start,
        onChange: function (v) { st3.start = v; rebuild3(); }
      });
      var endSlider = UI.slider({
        label: '끝 위치', min: 0, max: 4, step: 1, value: st3.end,
        onChange: function (v) { st3.end = v; rebuild3(); }
      });

      root.appendChild(box3);
      box3.appendChild(startSlider);
      box3.appendChild(endSlider);
      box3.appendChild(body3);
      rebuild3();

      // ============================================================
      // 시뮬레이터 ④ 필터 뒤에는 위치와 라벨이 어긋난다
      // ============================================================
      var box4 = UI.el('div.card');
      box4.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ 필터 뒤에는 인덱스가 연속이 아니다' }));
      box4.appendChild(UI.note(
        '인덱스가 기본 RangeIndex 인 동안에는 위치와 라벨이 같아 loc 와 iloc 를 섞어 써도 문제가 안 보인다. ' +
        '필터링을 거치면 그 우연이 깨진다. 아래 기준을 바꿔 가며 old 의 인덱스가 어떻게 듬성듬성해지는지, ' +
        'old.loc(0) 이 언제 실패하는지 확인해 보라. (합성 데이터라 교재의 33, 54, 96 … 과 값은 다를 수 있다.)'
      ));

      var st4 = { threshold: 60 };
      var body4 = UI.el('div');

      function rebuild4() {
        UI.clear(body4);
        var mask = t.col('Age').gt(st4.threshold);
        var old = t.mask(mask);

        body4.appendChild(UI.code(
          "old = t[t['Age'] > " + st4.threshold + ']',
          { output: 'old.shape -> (' + old.shape[0] + ', ' + old.shape[1] + ')' }
        ));

        if (old.nrows() === 0) {
          body4.appendChild(UI.note('이 기준을 만족하는 행이 없다. 슬라이더를 낮춰 보라.'));
          return;
        }

        var previewLabels = old.index.labels.slice(0, 10);
        body4.appendChild(UI.table(
          [{ key: 'label', label: 'old.index.tolist() (앞 ' + previewLabels.length + '개)' }],
          previewLabels.map(function (l) { return { label: l }; }),
          {}
        ));
        body4.appendChild(UI.note(
          '라벨이 [' + previewLabels.join(', ') + (old.nrows() > previewLabels.length ? ', …' : '') +
          '] 로 듬성듬성하다. 위치(0,1,2,…)와 라벨이 더 이상 같지 않다.'
        ));

        var ilocName = old.iloc(0).col('Name').at(0);
        body4.appendChild(UI.code(
          'old.iloc[0]', { output: "Name: '" + ilocName + "'  (위치 0번째 줄, 라벨 " + UI.fmt(old.index.at(0)) + ')' }
        ));

        try {
          var locRow = old.loc(0);
          var locName = locRow.col('Name').at(0);
          body4.appendChild(UI.code('old.loc[0]', { output: "Name: '" + locName + "'" }));
          body4.appendChild(UI.note(
            'old.loc(0) 이 성공했다 — 라벨 0 인 행이 우연히 아직 old 에 남아 있다는 뜻이다. 기준을 더 올려서 ' +
            '그 행을 걸러내 보라. KeyError 로 바뀔 것이다.'
          ));
        } catch (e) {
          body4.appendChild(UI.danger('에러', e.message));
          body4.appendChild(UI.note(
            'old 에는 라벨 0 인 행이 없다(필터를 통과하지 못했다). old.iloc(0) 은 "위에서 첫 번째 줄" 이라는 ' +
            '뜻이라 여전히 되지만, old.loc(0) 은 라벨 0 을 찾다가 실패한다. 정수 인덱스라고 해서 loc 와 iloc 를 ' +
            '아무 데서나 바꿔 쓸 수 있는 게 아니다.'
          ));
        }
      }

      var thresholdSlider = UI.slider({
        label: 'Age > 기준', min: 0, max: 80, step: 5, value: st4.threshold,
        onChange: function (v) { st4.threshold = v; rebuild4(); }
      });

      root.appendChild(box4);
      box4.appendChild(thresholdSlider);
      box4.appendChild(body4);
      rebuild4();

      // ============================================================
      // 흔한 실수 — 연쇄 할당: 읽기는 되고 쓰기는 안 된다
      // ============================================================
      function makeChainDemo() {
        return DF.frame({
          '이름': ['민준', '서연', '도윤', '하은'],
          '나이': [27, 19, 32, 31]
        }, { index: [55, 56, 1, 2] });
      }

      var box5 = UI.el('div.card');
      box5.appendChild(UI.el('div.panel-title', { text: '흔한 실수 — 연쇄 할당(chained assignment)' }));
      box5.appendChild(UI.note(
        "temp.loc[2]['이름'] = 'X' 처럼 loc 를 두 번 걸어 쓰면, 읽을 때는 값이 잘 나오지만 쓸 때는 원본에 " +
        '반영되지 않는다. temp.loc[2] 가 그 순간 이미 원본과 분리된 새 결과를 만들기 때문이다 — 왜 그런지는 ' +
        '7장(뷰와 복사, Copy-on-Write)에서 다룬다. 여기서는 규칙과 증상만 확인한다.'
      ));

      var st5 = { demo: makeChainDemo(), chainTried: false, chainMidVal: null, fixedTried: false };
      var body5 = UI.el('div');

      function rebuild5() {
        UI.clear(body5);
        body5.appendChild(UI.frameTable(st5.demo, {
          frame: 'original', caption: 'temp — index = [' + st5.demo.index.labels.join(', ') + ']'
        }));

        body5.appendChild(UI.code("temp.loc[2]['이름'] = 'X'   # ✗ 연쇄 대입"));
        if (st5.chainTried) {
          var origVal = st5.demo.col('이름').at(st5.demo.index.positions(2)[0]);
          body5.appendChild(UI.code(
            "mid = temp.loc[2]\nmid['이름'] = 'X'   # 위 한 줄을 두 단계로 풀어 쓴 것",
            {
              output: "temp.loc[2]['이름']  -> '" + origVal + "'   (그대로다)\n" +
                      "mid['이름']            -> '" + st5.chainMidVal + "'   (바뀌었지만 mid 는 원본이 아니다)"
            }
          ));
          body5.appendChild(UI.note(
            'temp.loc[2] 는 그 순간 이미 원본과 분리된 새 결과(mid)를 만든다. mid 에 값을 써도 temp 는 모른다 — ' +
            '이게 "읽기는 되고 쓰기는 안 되는" 이유다.'
          ));
        }

        body5.appendChild(UI.code("temp.loc[2, '이름'] = 'FIXED'   # ✓ 올바른 방법 — 한 번에 지정"));
        if (st5.fixedTried) {
          body5.appendChild(UI.note(
            '행과 열을 대괄호 하나에 함께 써서 한 번에 지정하면 원본이 실제로 바뀐다 — 맨 위 표에서 확인하라.'
          ));
        }
      }

      var chainBtn = UI.el('button', {
        text: "temp.loc[2]['이름'] = 'X' 시도해 보기",
        onclick: function () {
          var mid = st5.demo.loc(2);
          mid.setLoc(2, '이름', 'X');
          st5.chainTried = true;
          st5.chainMidVal = mid.col('이름').at(0);
          rebuild5();
        }
      });
      var fixedBtn = UI.el('button', {
        text: "temp.loc[2, '이름'] = 'FIXED' 실행해 보기",
        onclick: function () {
          st5.demo.setLoc(2, '이름', 'FIXED');
          st5.fixedTried = true;
          rebuild5();
        }
      });
      var resetBtn5 = UI.el('button', {
        text: '초기화',
        onclick: function () {
          st5.demo = makeChainDemo();
          st5.chainTried = false; st5.chainMidVal = null; st5.fixedTried = false;
          rebuild5();
        }
      });

      root.appendChild(box5);
      box5.appendChild(UI.el('div.control-row', null, [chainBtn, fixedBtn, resetBtn5]));
      box5.appendChild(body5);
      rebuild5();

      // ============================================================
      // 확인 문제
      // ============================================================
      var qzTemp = makeTemp('shuffled');
      var qzIlocName = qzTemp.iloc(2).col('이름').at(0);
      var qzLocName = qzTemp.loc(2).col('이름').at(0);

      root.appendChild(UI.quiz({
        title: '확인 문제 5-1',
        question: "index=[55, 56, 1, 2] 인 DataFrame temp 에서 temp.loc[2]['이름'] 의 값은?",
        choices: [
          { label: "'" + qzIlocName + "'  (temp.iloc[2] 의 값)",
            why: '이건 temp.iloc[2] 의 값이다 — 위치 2번째 줄(라벨 1)을 가리킨다. loc[2] 는 위치가 아니라 ' +
                 '라벨을 본다.' },
          { label: "'" + qzLocName + "'", correct: true,
            why: 'loc[2] 는 라벨이 2 인 행을 찾는다. index=[55,56,1,2] 에서 라벨 2 는 맨 마지막(위치 3)에 있으므로 ' +
                 "그 행의 '이름' 값 '" + qzLocName + "' 이 나온다." },
          { label: 'KeyError 가 난다', why: '틀렸다. 라벨 2 는 실제로 index 안에 있으므로 정상 동작한다.' }
        ]
      }));

      var nameShape = tSmall.col('Name').length();
      var frameShapeQ = tSmall.cols(['Name']).shape;
      root.appendChild(UI.quiz({
        title: '확인 문제 5-2',
        question: "t['Name'] 과 t[['Name']] 의 shape 은 각각 무엇인가?",
        choices: [
          { label: '(' + nameShape + ',) 와 (' + frameShapeQ[0] + ', ' + frameShapeQ[1] + ')', correct: true,
            why: "대괄호 한 겹이면 Series(1차원, shape (n,)), 두 겹(리스트)이면 DataFrame(2차원, shape (n,1))이다. " +
                 '열이 하나뿐이어도 리스트로 감쌌다는 사실이 타입과 shape 을 바꾼다.' },
          { label: '둘 다 (' + nameShape + ',) 로 같다',
            why: "틀렸다. t['Name'] 은 Series 라 1차원이지만 t[['Name']] 은 리스트로 감쌌으므로 DataFrame(2차원)이다." },
          { label: '둘 다 (' + frameShapeQ[0] + ', ' + frameShapeQ[1] + ') 로 같다',
            why: "틀렸다. t['Name'] 은 대괄호가 한 겹이라 Series 다. 열 축이 없어 shape 이 (n,) 하나뿐이다." }
        ]
      }));

      var qzSlice = DF.frame({ '값': [1, 2, 3, 4, 5] }, { index: ['p', 'q', 'r', 's', 't'] });
      var qzIlocN = qzSlice.iloc({ slice: true, start: 1, stop: 4 }).nrows();
      var qzLocN = qzSlice.loc({ range: true, from: 'q', to: 't' }).nrows();
      root.appendChild(UI.quiz({
        title: '확인 문제 5-3',
        question:
          "index=['p','q','r','s','t'] 인 data_df 에서 data_df.iloc[1:4] 와 data_df.loc['q':'t'] 는 " +
          '각각 몇 행을 돌려주는가?',
        choices: [
          { label: qzIlocN + '행과 ' + qzLocN + '행', correct: true,
            why: 'iloc 슬라이스는 끝(위치 4)을 제외해 ' + qzIlocN + '행이, loc 슬라이스는 끝 라벨(t)을 포함해 ' +
                 qzLocN + '행이 나온다.' },
          { label: qzLocN + '행과 ' + qzLocN + '행',
            why: '틀렸다. iloc 는 끝을 제외하므로 loc 보다 한 행 적게 나온다.' },
          { label: qzIlocN + '행과 ' + qzIlocN + '행',
            why: '틀렸다. loc 는 끝 라벨을 포함하므로 iloc 보다 한 행 많이 나온다.' }
        ]
      }));

      var qzOldCheck = t.mask(t.col('Age').gt(60));
      var qzHasZero = qzOldCheck.index.positions(0).length > 0;
      root.appendChild(UI.quiz({
        title: '확인 문제 5-4',
        question:
          "old = t[t['Age'] > 60] 로 60세 초과 승객만 걸러냈다. old.loc(0) 을 실행하면 무슨 일이 일어나는가?",
        choices: qzHasZero ? [
          { label: '정상적으로 라벨 0 인 행을 돌려준다', correct: true,
            why: '이 합성 데이터에서는 라벨 0 인 승객의 Age 가 60 을 넘어 old 에 남아 있다 — 그래서 ' +
                 'old.loc(0) 이 성공한다. 시뮬레이터 ④ 에서 기준을 높이면 이 행도 걸러져 KeyError 로 바뀐다.' },
          { label: 'KeyError 가 난다',
            why: '틀렸다. 이 데이터에서는 라벨 0 인 행이 필터를 통과해 old 에 남아 있다.' },
          { label: '위치 0번째 줄을 돌려준다(iloc 와 항상 같은 결과)',
            why: '틀렸다. loc(0) 은 라벨로 찾는다. 우연히 지금은 라벨 0 인 행이 위치 0에 있어 iloc(0) 과 값이 ' +
                 '같아 보일 뿐, 필터 조건에 따라 서로 다른 행이 될 수도 있다.' }
        ] : [
          { label: 'KeyError 가 난다', correct: true,
            why: 'old 에는 라벨 0 인 행이 없다(필터를 통과하지 못했다). old.iloc(0) 은 위치 기준이라 여전히 ' +
                 '되지만, old.loc(0) 은 라벨 0 을 찾다가 실패한다.' },
          { label: '정상적으로 첫 번째 행을 돌려준다',
            why: '틀렸다. loc 는 라벨을 찾는데 old 의 인덱스에는 라벨 0 이 없다.' },
          { label: '경고만 뜨고 old.iloc(0) 과 같은 값을 돌려준다',
            why: '틀렸다. 라벨이 없으면 KeyError 로 멈춘다 — 경고가 아니라 예외다.' }
        ]
      }));
    }
  });
})();
