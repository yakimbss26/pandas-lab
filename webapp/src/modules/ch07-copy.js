/* ch07-copy.js — 뷰와 복사, Copy-on-Write (교재 7장)
 * 학생이 가장 많이 틀리는 개념 1위. 미니 엔진(Block/ColRef/refs)이 존재하는 이유가 이 장이다.
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  /* 조건(불린 Series)에서 처음으로 true 인 위치. 조건에 맞는 행이 하나도 없으면 -1. */
  function firstTruePos(series) {
    for (var i = 0; i < series.length(); i++) if (series.at(i) === true) return i;
    return -1;
  }

  /* 시뮬레이터 ②·③ 이 공유하는 작은 titanic 부분표. 컬럼을 2개로 줄여 블록 상태 표가 한눈에 들어오게 한다. */
  function makeAgeFrame() {
    return LabData.frame('titanic').cols(['Name', 'Age']);
  }

  /* 교재 7.3절 ④(loc 연쇄)에 쓰는 표. 교재의 temp 예제와 값을 그대로 맞췄다. */
  function makeLabelFrame() {
    return DF.frame(
      { 이름: ['가온', '나연', '다인', '라온'], 점수: [88, 92, 75, 81] },
      { index: [55, 56, 1, 2] }
    );
  }

  /* DF.trace 의 kind 를 한국어 제목으로. */
  function stepTitle(kind) {
    return ({
      align: '인덱스 정렬', slice: '슬라이스 — 블록 공유', take: '테이크/마스크 — 새 블록',
      copy: '완전 복사 — 새 블록', cow: 'Copy-on-Write — 쓰기 시점 복사', 'block-copy': '블록 복제',
      setCol: '컬럼 대입', 'groupby-split': '그룹 분리', 'groupby-combine': '그룹 결합', merge: '병합'
    })[kind] || kind;
  }

  /* DF.trace 한 단계를 사람이 읽는 문장으로. */
  function stepSentence(step) {
    var d = step.detail || {};
    if (step.kind === 'slice') {
      return (d.shared ? '블록을 공유한다(shares_memory: true). ' : '새 블록을 만든다(복사). ') +
        '영향받은 행 수: ' + d.rows;
    }
    if (step.kind === 'cow') {
      return "컬럼 '" + d.column + "' 에 값을 쓰려는 순간, 블록 B" + d.from + ' 이 B' + d.to +
        ' 로 갈라져 나갔다. 이제부터 두 컬럼은 서로 다른 메모리를 본다.';
    }
    if (step.kind === 'block-copy') {
      return '블록 B' + d.from + ' → B' + d.to + ' 복제 (' + (d.reason || '') + ')';
    }
    return JSON.stringify(d);
  }

  function renderStep(step, i) {
    var box = UI.el('div');
    box.appendChild(UI.el('div.panel-title', { text: (i + 1) + '단계 — ' + stepTitle(step.kind) }));
    box.appendChild(UI.note(stepSentence(step)));
    return box;
  }

  /* 시뮬레이터 ③ 의 네 가지 패턴. run() 은 매번 새 프레임을 만들어 실행하고 실제 결과를 돌려준다.
   * 숫자·값은 전부 run() 안에서 DF 로 계산한다 — 화면에는 절대 하드코딩하지 않는다. */
  var PATTERNS = [
    {
      label: "① sub=df[조건] 후 sub['Age']=0",
      code: "sub = df[df['Age'] > 60]\nsub['Age'] = 0",
      warnNote: '실제 pandas 에서는 이 패턴에 경고조차 뜨지 않는다. 네 가지 중 가장 위험한 형태다 — ' +
        '"됐다" 고 믿기 가장 쉽다.',
      run: function () {
        var base = makeAgeFrame();
        var cond = base.col('Age').gt(60);
        var pos = firstTruePos(cond);
        var label = base.index.at(pos);
        var before = base.col('Age').at(pos);
        var sub = base.mask(cond);
        sub.setCol('Age', 0);
        var after = base.col('Age').at(pos);
        return {
          label: label, before: before, after: after, changed: before !== after,
          why: 'sub = df[조건] 이 원본과 독립된 새 DataFrame 을 만든 뒤였다. 그 뒤에 쓴 sub[\'Age\']=0 은 ' +
            '그 새 객체만 바꾼다.'
        };
      }
    },
    {
      label: "② df[조건]['Age']=0 (한 줄)",
      code: "df[df['Age'] > 60]['Age'] = 0",
      warnNote: '실제 pandas 라면 여기서는 ChainedAssignmentError 경고가 뜬다. 그래도 원본은 그대로다.',
      run: function () {
        var base = makeAgeFrame();
        var cond = base.col('Age').gt(60);
        var pos = firstTruePos(cond);
        var label = base.index.at(pos);
        var before = base.col('Age').at(pos);
        base.mask(cond).setCol('Age', 0); // 결과를 변수에 담지 않고 한 줄로 이어 쓴다
        var after = base.col('Age').at(pos);
        return {
          label: label, before: before, after: after, changed: before !== after,
          why: '한 줄로 썼어도 df[조건] 이 먼저 만드는 중간 객체는 그대로 생긴다. 겉모습만 한 줄일 뿐 ' +
            '패턴 ①과 구조가 같다.'
        };
      }
    },
    {
      label: "③ df.loc[라벨]['이름']='XXX'",
      code: "temp.loc[2]['이름']          # 읽기\ntemp.loc[2]['이름'] = 'XXX'  # 쓰기",
      warnNote: '실제 pandas 에서도 ChainedAssignmentError 경고가 뜬다. 읽기는 되고 쓰기만 반영되지 않는다.',
      run: function () {
        var temp = makeLabelFrame();
        var label = 2;
        var pos = temp.index.positions(label)[0];
        var before = temp.col('이름').at(pos);
        var row = temp.loc(label);       // 라벨이 2 인 행 하나 — 읽기용 중간 객체
        var readBack = row.col('이름').at(0);
        row.setCol('이름', 'XXX');        // 그 중간 객체에 쓰기 시도
        var after = temp.col('이름').at(pos);
        return {
          label: label, before: before, after: after, changed: before !== after,
          why: "temp.loc[2] 가 만든 중간 객체를 읽는 것(" + readBack + ")은 문제없이 된다. 하지만 그 " +
            '중간 객체에 쓰는 것은 이미 원본과 분리된 곳에 쓰는 것이라 닿지 않는다.'
        };
      }
    },
    {
      label: "바른 형태: df.setLoc(조건,'Age',0)",
      code: "df.loc[df['Age'] > 60, 'Age'] = 0",
      warnNote: '이번엔 경고가 뜨지 않고, 원본이 실제로 바뀐다. 행과 열을 대괄호 한 번에 함께 지정했기 때문이다.',
      run: function () {
        var base = makeAgeFrame();
        var cond = base.col('Age').gt(60);
        var pos = firstTruePos(cond);
        var label = base.index.at(pos);
        var before = base.col('Age').at(pos);
        base.setLoc(cond, 'Age', 0);
        var after = base.col('Age').at(pos);
        return {
          label: label, before: before, after: after, changed: before !== after,
          why: '조건과 열을 한 번의 대괄호(.loc[조건,\'Age\'])로 함께 넘겨서 중간 객체가 생기지 않았다.'
        };
      }
    }
  ];

  Lab.register({
    id: 'ch07-copy',
    num: 7,
    title: '뷰와 복사, Copy-on-Write',
    subtitle: '언제 메모리를 공유하고 언제 복사하는지, 그리고 쓰는 순간 무슨 일이 일어나는지 직접 본다',

    render: function (root) {
      root.appendChild(UI.note(
        '필터링한 결과에 값을 대입했는데 원본이 그대로인 경우가 있다. 아래 시뮬레이터로 pandas 가 ' +
        '언제 블록(메모리)을 공유하고 언제 복사하는지, 그리고 "연쇄 할당"이 왜 위험한지 직접 확인해 보자.'
      ));

      // ═══════════════════════════════ 시뮬레이터 ① 슬라이스는 공유, 마스크는 복사
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 슬라이스는 공유, 마스크는 복사' }));
      box1.appendChild(UI.note(
        'head(3) 과 islice(2, 5) 는 원본과 블록을 공유하고(파랑 원본과 메모리가 같다), ' +
        'mask(조건) 과 copy() 는 새 블록을 만든다. 넷을 눌러 비교해 보라 — 실제 pandas 도 이렇게 갈린다.'
      ));

      var t1 = LabData.frame('titanic').cols(['Age', 'Fare']);
      var OPS1 = [
        { label: 'head(3)', code: 'df.head(3)', run: function () { return t1.head(3); } },
        { label: 'islice(2, 5)', code: 'df.islice(2, 5)', run: function () { return t1.islice(2, 5); } },
        { label: 'mask(조건)', code: "df.mask(df['Age'] > 60)", run: function () { return t1.mask(t1.col('Age').gt(60)); } },
        { label: 'copy()', code: 'df.copy()', run: function () { return t1.copy(); } }
      ];
      var st1 = { op: 0 };
      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(body1);

        var overview = OPS1.map(function (o) {
          var r = o.run();
          return { code: o.code, shared: DF.sharesMemory(t1.col('Age'), r.col('Age')) ? '공유 (true)' : '복사 (false)' };
        });
        body1.appendChild(UI.table(
          [{ key: 'code', label: '연산' }, { key: 'shared', label: 'sharesMemory(원본, 결과)' }],
          overview, { caption: '넷을 한눈에 비교' }
        ));

        var op = OPS1[st1.op];
        var result = op.run();
        body1.appendChild(UI.frameTable(t1, { frame: 'original', maxRows: 5, caption: '원본 df' }));
        body1.appendChild(UI.frameTable(result, { frame: 'copy', maxRows: 5, caption: op.code + ' 의 결과' }));
        body1.appendChild(UI.shareBadge(t1.col('Age'), result.col('Age'), '원본 df', '결과'));
        body1.appendChild(UI.blockView(t1, { title: '원본 df 블록 상태' }));
        body1.appendChild(UI.blockView(result, { title: '결과 블록 상태' }));
      }

      box1.appendChild(UI.buttonGroup(
        OPS1.map(function (o, i) { return { label: o.label, value: i }; }),
        { label: '연산 선택', selected: st1.op, onChange: function (v) { st1.op = v; rebuild1(); } }
      ));
      box1.appendChild(body1);
      rebuild1();
      root.appendChild(box1);

      // ═══════════════════════════════ 시뮬레이터 ② 쓰는 순간 복사된다 (심장)
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 쓰는 순간 복사된다' }));
      box2.appendChild(UI.note(
        '원본 df 와 파생본 sub = df.islice(0, 5) 는 지금 같은 블록을 본다(참조 수가 1보다 크다). ' +
        '파생본에 값을 쓰는 순간 무슨 일이 일어나는지 DF.trace 로 한 단계씩 확인해 보라.'
      ));

      var body2 = UI.el('div');
      var st2 = {};

      function resetSim2() {
        DF.trace.enable();
        st2.base = makeAgeFrame();
        st2.derived = st2.base.islice(0, 5);
        st2.steps = DF.trace.get();
        DF.trace.disable();
        st2.written = false;
        st2.writeLabel = null;
        st2.writeVal = null;
      }

      function doWrite2() {
        if (st2.written) return;
        var label = st2.derived.index.at(0);
        var val = 999;
        DF.trace.enable();
        st2.derived.setLoc(label, 'Age', val);
        var newSteps = DF.trace.get();
        DF.trace.disable();
        st2.steps = st2.steps.concat(newSteps);
        st2.written = true;
        st2.writeLabel = label;
        st2.writeVal = val;
        rebuild2();
      }

      function rebuild2() {
        UI.clear(body2);
        body2.appendChild(UI.frameTable(st2.base, { frame: 'original', maxRows: 5, caption: '원본 df' }));
        body2.appendChild(UI.frameTable(st2.derived, { frame: 'copy', maxRows: 5, caption: 'sub = df.islice(0, 5)' }));
        body2.appendChild(UI.shareBadge(st2.base.col('Age'), st2.derived.col('Age'), '원본 df', '파생본 sub'));
        body2.appendChild(UI.blockView(st2.base, { title: '원본 df 블록 상태' }));
        body2.appendChild(UI.blockView(st2.derived, { title: '파생본 sub 블록 상태' }));

        if (!st2.written) {
          body2.appendChild(UI.el('button', {
            text: "sub.loc[..., 'Age'] = 999  (파생본에 값 쓰기)",
            onclick: doWrite2
          }));
        } else {
          body2.appendChild(UI.stepper(st2.steps, renderStep, { title: 'DF.trace 기록' }));
          var pos = st2.base.index.positions(st2.writeLabel)[0];
          body2.appendChild(UI.code(
            "sub.loc[" + JSON.stringify(st2.writeLabel) + ", 'Age'] = " + st2.writeVal,
            {
              output: '원본 df 의 Age: ' + UI.fmt(st2.base.col('Age').at(pos)) + ' (안 바뀜)\n' +
                '파생본 sub 의 Age: ' + UI.fmt(st2.derived.col('Age').at(0)) + ' (바뀜)'
            }
          ));
          body2.appendChild(UI.note(
            '블록 id 가 갈라지고 나면 두 컬럼은 완전히 다른 메모리를 본다 — 그래서 원본은 안전했다.'
          ));
        }
        body2.appendChild(UI.el('button', { text: '초기화', onclick: function () { resetSim2(); rebuild2(); } }));
      }

      resetSim2();
      box2.appendChild(body2);
      rebuild2();
      root.appendChild(box2);

      // ═══════════════════════════════ 시뮬레이터 ③ 연쇄 할당 함정 3종
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 연쇄 할당 함정 3종' }));
      box3.appendChild(UI.danger(
        'ChainedAssignmentError 는 예외가 아니라 경고다',
        '이름과 달리 예외(exception)가 아니라 경고(warning)다. 코드는 멈추지 않고 끝까지 실행되고 그 뒤의 ' +
        '출력도 정상적으로 나온다 — 다만 의도한 대입만 조용히 반영되지 않는다. 파이썬이 진짜 예외를 던져 ' +
        '멈춰 준다면 오히려 그 자리에서 문제를 알아챌 수 있어 안전하다. 경고만 뜨고 넘어가는 이쪽이 더 위험하다.'
      ));

      var st3 = { pick: 0 };
      var body3 = UI.el('div');

      function rebuild3() {
        UI.clear(body3);
        var p = PATTERNS[st3.pick];
        var r = p.run();
        body3.appendChild(UI.code(p.code, {
          output: '(라벨 ' + JSON.stringify(r.label) + ') 실행 전 값: ' + UI.fmt(r.before) +
            '   →   실행 후 원본의 값: ' + UI.fmt(r.after)
        }));
        if (r.changed) {
          body3.appendChild(UI.note(
            '원본이 실제로 바뀌었다 (' + UI.fmt(r.before) + ' → ' + UI.fmt(r.after) + '). ' + r.why, '결과 — 원본 변경됨'
          ));
        } else {
          body3.appendChild(UI.danger(
            '원본은 그대로다',
            r.why + ' 원본 값은 여전히 ' + UI.fmt(r.after) + ' 다.'
          ));
        }
        body3.appendChild(UI.note(p.warnNote, '실제 pandas 라면'));
      }

      box3.appendChild(UI.buttonGroup(
        PATTERNS.map(function (p, i) { return { label: p.label, value: i }; }),
        { label: '패턴 선택', selected: st3.pick, onChange: function (v) { st3.pick = v; rebuild3(); } }
      ));
      box3.appendChild(body3);
      rebuild3();
      root.appendChild(box3);

      // ═══════════════════════════════ 시뮬레이터 ④ drop 은 복사본이다 (4장 다시 확인, 짧게)
      var box4 = UI.el('div.card');
      box4.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ drop 은 복사본이다 (4장 다시 확인)' }));

      var st4 = { demo: null, written: false };
      var body4 = UI.el('div');

      function makeDrop4() {
        var t = LabData.frame('titanic').cols(['Age', 'Cabin']);
        return { t: t, d: t.drop('Cabin', { axis: 1 }) };
      }
      function resetSim4() { st4.demo = makeDrop4(); st4.written = false; }

      function rebuild4() {
        UI.clear(body4);
        var demo = st4.demo;
        body4.appendChild(UI.shareBadge(demo.t.col('Age'), demo.d.col('Age'), '원본 df', "d = df.drop('Cabin', axis=1)"));
        if (!st4.written) {
          body4.appendChild(UI.note(
            "원본 강의 자료의 'drop 은 view 에서만 삭제한다' 는 설명은 틀렸다(4장). d 는 drop() 이 돌려준 " +
            '새 DataFrame 이다 — 이 실습 엔진은 슬라이스와 같은 CoW 모델을 쓰므로 쓰기 전까지는 블록을 ' +
            '공유하지만, 값을 쓰면 즉시 갈라진다. 버튼으로 확인해 보라.'
          ));
          body4.appendChild(UI.el('button', {
            text: "d.loc[..., 'Age'] = 12345 (d 에 값 쓰기)",
            onclick: function () {
              var label = st4.demo.d.index.at(0);
              st4.demo.d.setLoc(label, 'Age', 12345);
              st4.written = true;
              rebuild4();
            }
          }));
        } else {
          body4.appendChild(UI.code("d.loc[" + JSON.stringify(demo.d.index.at(0)) + ", 'Age'] = 12345", {
            output: '원본 df 의 Age: ' + UI.fmt(demo.t.col('Age').at(0)) + ' (안 바뀜)\n' +
              'd 의 Age: ' + UI.fmt(demo.d.col('Age').at(0)) + ' (바뀜)'
          }));
          body4.appendChild(UI.note('drop() 이 돌려준 d 는 원본과 독립된 객체다 — 값을 써도 원본은 바뀌지 않는다.'));
        }
        body4.appendChild(UI.el('button', { text: '초기화', onclick: function () { resetSim4(); rebuild4(); } }));
      }

      resetSim4();
      box4.appendChild(body4);
      rebuild4();
      root.appendChild(box4);

      // ═══════════════════════════════ 판단 규칙 카드
      var ruleBox = UI.el('div.card');
      ruleBox.appendChild(UI.el('div.panel-title', { text: '판단 규칙 — 이 코드가 원본을 바꿀까?' }));
      ruleBox.appendChild(UI.note(
        "대입 왼쪽이 df.loc[조건, '열'] = 값 처럼 대괄호 한 번에 행과 열이 함께 있으면 원본이 바뀐다.", '①'
      ));
      ruleBox.appendChild(UI.note(
        "대괄호가 두 번 이상 이어지면(df[조건]['열']=값, df.loc[라벨]['열']=값) 그 사이에 중간 객체가 " +
        '생겨 원본이 바뀌지 않는다 — 경고가 뜨든 안 뜨든 결과는 같다.', '②'
      ));
      ruleBox.appendChild(UI.note(
        '필터링(df[조건])이나 drop() 의 결과를 변수에 먼저 담아 두고 나중에 그 변수에 쓰면, 그 변수는 ' +
        '이미 원본과 분리된 객체다. 원본까지 바꾸려면 .loc 를 쓰고, 사본임을 드러내려면 .copy() 를 쓴다.', '③'
      ));
      root.appendChild(ruleBox);

      // ═══════════════════════════════ 확인 문제
      var qDf = DF.frame({ x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      var qSlice = qDf.col('x').iloc({ slice: true, start: 2, stop: 5 });
      qSlice.setILoc(0, 999);
      var qAnswer = qDf.col('x').at(2);

      root.appendChild(UI.quiz({
        title: '확인 문제 7-1',
        question:
          "x 가 0부터 9까지인 df 에서 s = df.col('x') 의 [2:5] 슬라이스를 만든 뒤 s.iloc[0] = 999 를 " +
          "실행했다. sharesMemory(df.col('x'), s) 는 true 였다. 이제 df.col('x').at(2) 의 값은?",
        choices: [
          { label: String(qAnswer), correct: true,
            why: 's 는 슬라이스라 df 와 블록을 공유했지만(sharesMemory: true), 실제로 쓰는 순간 CoW 로 ' +
              's 만 자기 블록으로 갈라져 나갔다. 그래서 원본은 그대로 ' + qAnswer + '다. "메모리를 ' +
              '공유한다"와 "써도 반영된다"는 서로 다른 이야기다.' },
          { label: '999', why: '틀렸다. 공유하고 있어도 실제 쓰기는 그 순간 복사된 s 자신의 블록에만 들어간다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 7-2',
        question: "sub = df[df['Age'] > 60] 다음 sub['Age'] = 0 을 실행했다. 이 코드는 원본 df 를 바꾸는가?",
        choices: [
          { label: '바꾼다', why: '틀렸다. sub 는 이미 원본과 분리된 새 DataFrame 이다. 이 패턴은 경고조차 ' +
            '뜨지 않아 "됐다" 고 믿기 가장 쉽다 — 시뮬레이터 ③의 패턴 ①이다.' },
          { label: '바꾸지 않는다', correct: true,
            why: 'sub = df[조건] 이 독립된 객체를 만들고, sub[\'Age\']=0 은 그 객체만 바꾼다. 원본을 ' +
              "바꾸려면 df.loc[df['Age']>60, 'Age']=0 처럼 한 번에 써야 한다." }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 7-3',
        question:
          "df['Sex'].replace({'male':0,'female':1}, inplace=True) 를 실행했더니 df 의 값이 그대로다. " +
          '이 코드는 예외로 멈췄는가?',
        choices: [
          { label: '멈췄다 (예외)', why: "틀렸다. 'Error' 라는 이름이 붙어 있지만 이것은 예외가 아니다." },
          { label: '멈추지 않았다 (경고일 뿐)', correct: true,
            why: '코드는 끝까지 실행되고 df 도 정상 출력된다. 다만 대입만 반영되지 않는다 — 예외로 멈추는 ' +
              '것보다 조용히 넘어가는 이쪽이 더 위험하다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 7-4',
        question:
          "temp.loc[2]['이름'] 으로 값을 읽는 것과 temp.loc[2]['이름'] = 'XXX' 로 값을 쓰는 것 중 " +
          '어느 쪽이 되는가?',
        choices: [
          { label: '둘 다 된다', why: '틀렸다. 쓰기는 이미 분리된 중간 객체에만 적용되어 원본에 닿지 않는다.' },
          { label: '읽기만 된다', correct: true,
            why: 'temp.loc[2] 가 만든 중간 객체를 읽는 것은 문제없이 되지만, 그 중간 객체에 쓰는 것은 ' +
              "이미 원본과 분리된 곳에 쓰는 것이라 반영되지 않는다. 항상 temp.loc[2,'이름']='XXX' 처럼 " +
              '행과 열을 대괄호 하나에 함께 써야 한다.' },
          { label: '둘 다 안 된다', why: '틀렸다. 읽기는 정상적으로 된다.' }
        ]
      }));
    }
  });
})();
