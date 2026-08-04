/* ch04-frame.js — DataFrame: 여러 Series 의 집합 (교재 4장)
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  /* .T 전치. DF 엔진에 .T 메서드가 없으므로 공개된 DF API 만으로 화면이 직접 계산한다. */
  function transpose(df) {
    var newCols = {}, newNames = [];
    var rowLabels = df.index.labels.map(function (l) { return String(l); });
    rowLabels.forEach(function (rl, i) {
      var col = [];
      df.columns.forEach(function (c) { col.push(df.col(c).at(i)); });
      newCols[rl] = col;
      newNames.push(rl);
    });
    return DF.frame(newCols, { columns: newNames, index: df.columns.slice() });
  }

  /* Copy-on-Write 시연에 쓸 컬럼/값을 고른다. 나이 처럼 숫자 컬럼이 남아있으면 그걸 쓴다. */
  function pickWriteCol(df) {
    return df.columns.indexOf('나이') !== -1 ? '나이' : df.columns[0];
  }
  function pickWriteValue(df, col) {
    return DF.isNumericDtype(df.col(col).dtype) ? 999 : '변경됨';
  }

  Lab.register({
    id: 'ch04-frame',
    num: 4,
    title: 'DataFrame — 여러 Series 의 집합',
    subtitle: '컬럼을 조립하고, drop 이 실제로 복사본을 반환하는지 확인한다',

    render: function (root) {
      // ───────────────────────────────── 시뮬레이터 ① DataFrame 조립기
      var POOL = [
        { name: '이름', values: ['학생A', '학생B', '학생C', '학생D'] },
        { name: '나이', values: [16, 17, 16, 17] },
        { name: '키', values: [162.5, 170.1, 158.4, 175.0] },
        { name: '재학', values: [true, true, false, true] }
      ];
      var st1 = { activeCount: 2, includeGrade: false, showT: false };

      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① DataFrame 조립기' }));
      box1.appendChild(UI.note(
        '컬럼을 하나씩 추가/삭제해 표를 키워 보고, columns= 에 없는 이름을 끼워 넣으면 ' +
        '무슨 일이 벌어지는지, .T 로 뒤집으면 dtype 이 어떻게 되는지 확인해 보라.'
      ));

      var body1 = UI.el('div');

      function buildFrame1() {
        var obj = {}, names = [];
        for (var i = 0; i < st1.activeCount; i++) {
          obj[POOL[i].name] = POOL[i].values.slice();
          names.push(POOL[i].name);
        }
        var columnsOpt = names.slice();
        if (st1.includeGrade) columnsOpt.push('성적');
        return DF.frame(obj, { columns: columnsOpt });
      }

      function rebuild1() {
        UI.clear(body1);
        var df = buildFrame1();
        var showDf = st1.showT ? transpose(df) : df;
        body1.appendChild(UI.frameTable(showDf, {
          frame: 'result', caption: st1.showT ? 'df.T (전치)' : 'df'
        }));

        if (!st1.showT) {
          var dtRows = df.columns.map(function (n) { return { col: n, dtype: df.col(n).dtype }; });
          body1.appendChild(UI.table(
            [{ key: 'col', label: '컬럼' }, { key: 'dtype', label: 'dtype' }],
            dtRows, { caption: 'df.dtypes()' }
          ));
        } else {
          var dt2 = showDf.dtypes();
          var kinds = {};
          Object.keys(dt2).forEach(function (k) { kinds[dt2[k]] = true; });
          body1.appendChild(UI.note(
            '전치 후 모든 컬럼(원래는 행)의 dtype 이 ' + Object.keys(kinds).join(', ') +
            ' 로 바뀌었다. 서로 다른 타입의 값들이 한 컬럼(원래는 한 행)에 같이 들어가야 하기 때문이다.'
          ));
        }

        if (st1.includeGrade) {
          var s = df.col('성적');
          body1.appendChild(UI.danger(
            "'성적' 컬럼",
            "obj 에 없는 이름을 columns= 에 넣었다. 에러 없이 실행되지만, 전체 " + df.nrows() +
            '행 중 값이 있는 행은 ' + s.count() + '개뿐이다(전부 NaN). 오타를 내도 알아채기 어렵다.'
          ));
        }
      }

      var addBtn1 = UI.el('button', {
        text: '컬럼 추가',
        onclick: function () { if (st1.activeCount < POOL.length) st1.activeCount++; rebuild1(); }
      });
      var delBtn1 = UI.el('button', {
        text: '컬럼 삭제',
        onclick: function () { if (st1.activeCount > 1) st1.activeCount--; rebuild1(); }
      });
      var gradeToggle = UI.toggle({
        label: "columns= 에 '성적' 끼워넣기(없는 이름)", value: false,
        onChange: function (on) { st1.includeGrade = on; rebuild1(); }
      });
      var tToggle = UI.toggle({
        label: '.T 전치', value: false,
        onChange: function (on) { st1.showT = on; rebuild1(); }
      });

      root.appendChild(box1);
      box1.appendChild(UI.el('div.control-row', null, [addBtn1, delBtn1]));
      box1.appendChild(UI.el('div.control-row', null, [gradeToggle, tToggle]));
      box1.appendChild(body1);
      rebuild1();

      // ───────────────────────────────── 시뮬레이터 ② drop 은 복사본을 반환한다
      var COLS2 = ['이름', '나이', '학교'];
      function makeDemoFrame() {
        return DF.frame({
          '이름': ['학생1', '학생2', '학생3', '학생4'],
          '나이': [16, 17, 16, 17],
          '학교': ['가온고', '나래고', '다솜고', '라온고']
        });
      }

      var st2 = { original: makeDemoFrame(), dropCol: '학교', inplace: false, result: undefined, wrote: false, writeCol: null };

      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② drop 은 복사본을 반환한다' }));
      box2.appendChild(UI.danger(
        '정정 — 원본 강의자료 오류',
        "원본 자료는 'drop() 은 view 에서만 삭제하고 실제로 삭제하지 않는다' 라고 설명했지만 틀렸다. " +
        'pandas 에서 view(뷰)는 메모리 공유를 뜻하는 별개 용어다. drop() 은 뷰가 아니라 새 ' +
        'DataFrame(복사본)을 반환한다.'
      ));

      var body2 = UI.el('div');

      function resetDemo() {
        st2.original = makeDemoFrame();
        st2.result = undefined;
        st2.wrote = false;
        st2.writeCol = null;
        draw2();
      }

      function doDrop() {
        var r = st2.original.drop(st2.dropCol, { axis: 1, inplace: st2.inplace });
        st2.result = r;
        st2.wrote = false;
        st2.writeCol = null;
        draw2();
      }

      function doWrite() {
        if (!(st2.result instanceof DF.DataFrame) || st2.wrote) return;
        var col = pickWriteCol(st2.result);
        var val = pickWriteValue(st2.result, col);
        var rowLabel = st2.result.index.at(0);
        st2.result.setLoc(rowLabel, col, val);
        st2.wrote = true;
        st2.writeCol = col;
        draw2();
      }

      function draw2() {
        UI.clear(body2);
        if (st2.result === undefined) {
          body2.appendChild(UI.frameTable(st2.original, { frame: 'original', caption: '원본 df' }));
          body2.appendChild(UI.note('아직 drop 을 실행하지 않았다. 위 버튼을 눌러 보라.'));
          return;
        }
        if (st2.result === null) {
          body2.appendChild(UI.frameTable(st2.original, { frame: 'original', caption: '원본 df (inplace 로 바뀐 뒤)' }));
          body2.appendChild(UI.code(
            "result = df.drop('" + st2.dropCol + "', axis=1, inplace=True)",
            { output: 'result -> None\ndf.columns -> [' + st2.original.columns.join(', ') + ']' }
          ));
          body2.appendChild(UI.note('inplace=True 를 주면 원본이 즉시 바뀌고, drop() 의 반환값은 null(파이썬에서는 None)이다.'));
          return;
        }

        body2.appendChild(UI.frameTable(st2.original, { frame: 'original', caption: '원본 df' }));
        body2.appendChild(UI.frameTable(st2.result, { frame: 'copy', caption: "반환본 d = df.drop('" + st2.dropCol + "', axis=1)" }));

        var demoCol = st2.writeCol || pickWriteCol(st2.result);
        body2.appendChild(UI.shareBadge(st2.original.col(demoCol), st2.result.col(demoCol), '원본 df', '반환본 d'));

        if (!st2.wrote) {
          body2.appendChild(UI.note(
            '지금은 "' + demoCol + '" 컬럼이 아직 같은 블록을 보고 있다 — drop() 이 새 DataFrame(d) 을 ' +
            '만들었어도 실제 값 복제는 쓰기 순간에 일어나기 때문이다(Copy-on-Write, 7장에서 자세히 다룬다).'
          ));
          body2.appendChild(UI.el('button', {
            text: "d 에 값 쓰기 — d.loc[..., '" + demoCol + "'] = " + JSON.stringify(pickWriteValue(st2.result, demoCol)),
            onclick: doWrite
          }));
        } else {
          body2.appendChild(UI.code(
            "d.loc[" + JSON.stringify(st2.result.index.at(0)) + ", '" + demoCol + "'] = " +
            JSON.stringify(pickWriteValue(st2.result, demoCol)),
            {
              output: '원본 df 의 값: ' + UI.fmt(st2.original.col(demoCol).at(0)) + ' (안 바뀜)\n' +
                      '반환본 d 의 값: ' + UI.fmt(st2.result.col(demoCol).at(0)) + ' (바뀜)'
            }
          ));
          body2.appendChild(UI.note('값을 쓴 순간 블록이 복제되어, 이제 두 컬럼은 서로 다른 메모리를 본다.'));
        }

        body2.appendChild(UI.blockView(st2.original, { title: '원본 df 블록 상태' }));
        body2.appendChild(UI.blockView(st2.result, { title: '반환본 d 블록 상태' }));
      }

      var dropColGroup = UI.buttonGroup(
        COLS2.map(function (c) { return { label: c, value: c }; }),
        {
          label: '지울 컬럼',
          selected: COLS2.indexOf(st2.dropCol),
          onChange: function (v) { st2.dropCol = v; resetDemo(); }
        }
      );
      var inplaceToggle2 = UI.toggle({
        label: 'inplace', value: false,
        onChange: function (on) { st2.inplace = on; resetDemo(); }
      });
      var dropBtn = UI.el('button', { text: 'drop(axis=1) 실행', onclick: doDrop });
      var resetBtn2 = UI.el('button', { text: '초기화', onclick: resetDemo });

      root.appendChild(box2);
      box2.appendChild(dropColGroup);
      box2.appendChild(UI.el('div.control-row', null, [inplaceToggle2, dropBtn, resetBtn2]));
      box2.appendChild(body2);
      draw2();

      // ───────────────────────────────── 시뮬레이터 ③ reset_index / rename 의 함정
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ reset_index / rename 의 함정' }));

      var t = LabData.frame('titanic');
      var vc = t.col('Pclass').valueCounts(); // name:'count', index.name:'Pclass'
      var vcFrame = DF.frame((function () {
        var o = {}; o[vc.name] = vc.toArray(); return o;
      })(), { index: vc.index });
      var vcReset = vcFrame.resetIndex(); // 컬럼: ['Pclass', 'count'] — 엔진이 직접 계산한 이름

      var st3 = { renamed: false };
      var body3 = UI.el('div');

      function draw3() {
        UI.clear(body3);
        body3.appendChild(UI.el('div.panel-title', { text: "t['Pclass'].value_counts()" }));
        body3.appendChild(UI.seriesTable(vc, { frame: 'result' }));
        body3.appendChild(UI.el('div.panel-title', { text: '.reset_index()' }));
        body3.appendChild(UI.frameTable(vcReset, {
          frame: 'result', caption: '컬럼: [' + vcReset.columns.join(', ') + ']'
        }));

        if (st3.renamed) {
          var hadIndexCol = vcReset.columns.indexOf('index') !== -1;
          var hadPclassCol = vcReset.columns.indexOf('Pclass') !== -1;
          var renamed = vcReset.rename({ index: 'Pclass', Pclass: 'Pclass_count' });
          body3.appendChild(UI.frameTable(renamed, {
            frame: 'copy',
            caption: "rename(columns={'index':'Pclass','Pclass':'Pclass_count'}) 결과: [" + renamed.columns.join(', ') + ']'
          }));
          body3.appendChild(UI.danger(
            '에러도 경고도 없다',
            "'index':'Pclass' 는 " + (hadIndexCol ? '실제 컬럼이라 적용됐지만' : '그런 컬럼이 없어 조용히 무시됐고') + ', ' +
            "'Pclass':'Pclass_count' 는 " + (hadPclassCol ? '실제 컬럼이라 그대로 적용되어' : '없어서 무시되어') +
            ' 등급 라벨이 든 컬럼 이름이 Pclass_count 로 바뀌었다. 이름이 내용과 반대로 보인다.'
          ));

          var fixed = vcReset.rename({ count: '건수' });
          body3.appendChild(UI.note(
            '실제로 있는 이름을 보고 지정하면 이렇게 안전하다.', 'rename 을 올바르게 쓰면'
          ));
          body3.appendChild(UI.frameTable(fixed, {
            frame: 'result', caption: "rename(columns={'count':'건수'}) 결과: [" + fixed.columns.join(', ') + ']'
          }));
        }
      }

      var renameBtn = UI.el('button', {
        text: "rename(columns={'index':'Pclass','Pclass':'Pclass_count'}) 적용해보기",
        onclick: function () { st3.renamed = true; draw3(); }
      });
      var undoBtn3 = UI.el('button', {
        text: '되돌리기', onclick: function () { st3.renamed = false; draw3(); }
      });

      root.appendChild(box3);
      box3.appendChild(UI.el('div.control-row', null, [renameBtn, undoBtn3]));
      box3.appendChild(body3);
      draw3();

      // ───────────────────────────────── 확인 문제
      root.appendChild(UI.quiz({
        title: '확인 문제 4-1',
        question:
          "df = pd.DataFrame({'a':[1,2],'b':[3,4]}) 다음 한 줄만 실행했다. " +
          "df.drop('b', axis=1) — 이제 df 에 'b' 컬럼이 남아 있는가?",
        choices: [
          { label: '남아 있다', correct: true,
            why: 'drop() 은 결과만 반환하고 원본은 바꾸지 않는다. 반환값을 변수에 받지 않았으니 그 결과는 만들어졌다가 버려졌다.' },
          { label: '사라진다', why: '틀렸다. 원본을 실제로 바꾸려면 df = df.drop(...) 로 다시 대입하거나 inplace=True 를 써야 한다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 4-2',
        question:
          "t['Pclass'].value_counts().reset_index() 의 컬럼은 ['Pclass','count'] 다. 여기에 " +
          "rename(columns={'index':'Pclass','Pclass':'Pclass_count'}) 를 이어 붙이면 어떻게 되는가?",
        choices: [
          { label: "'index' 컬럼이 없어서 통째로 에러가 난다", why: "틀렸다. 없는 키를 rename 에 주면 에러 없이 조용히 무시될 뿐이다." },
          { label: "아무 일도 일어나지 않는다", why: "틀렸다. 'Pclass' 는 실제로 있는 컬럼이라 그대로 적용된다." },
          { label: "'index':'Pclass' 는 무시되고 'Pclass' 가 'Pclass_count' 로 바뀐다", correct: true,
            why: '실제로 있는 컬럼(Pclass)에 대한 매핑만 적용된다. 그 결과 등급 라벨이 든 컬럼 이름이 ' +
                 'Pclass_count 로 바뀌어, 이름과 내용이 반대가 된다. 에러가 없어서 더 위험하다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 4-3',
        question: "pd.DataFrame({'a':[1,2]}, columns=['a','연봉']) 을 실행하면 '연봉' 컬럼은 어떻게 되는가?",
        choices: [
          { label: 'KeyError 가 난다', why: '틀렸다. 에러 없이 실행된다.' },
          { label: '전부 NaN 인 컬럼이 생긴다', correct: true,
            why: '딕셔너리에 없는 이름을 columns= 에 넣으면 에러 없이 그 컬럼 전체가 NaN 이 된다. 오타를 내도 알아채기 어렵다.' },
          { label: '자동으로 0 으로 채워진다', why: '틀렸다. 0 이 아니라 NaN 으로 채워진다.' }
        ]
      }));
    }
  });
})();
