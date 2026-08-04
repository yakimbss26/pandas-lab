/* ch13-notebook.js — 노트북이 거짓말할 때: 실행 순서와 상태 (교재 13장)
 * 이 장은 pandas API 가 아니라 "노트북의 출력은 지금 보이는 코드가 아니라 실행 이력의 결과다" 를
 * 가르친다. 그래서 시뮬레이터도 진짜 셀을 눌러 실행하는 가짜 노트북이어야 한다 — 절대 가짜
 * 출력을 문자열로 적지 않는다. 전부 render 호출마다 DF 엔진을 실제로 돌려서 만든다.
 * IIFE 로 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로(재방문),
 * 이 장의 핵심인 "노트북 상태" 자체도 render 안의 지역 변수에 둔다(API.md §1 ②).
 * 재방문하면 노트북은 깨끗한 초기 상태(커널을 새로 켠 것)로 돌아가야 한다.
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════ 시뮬레이터 ① 가짜 노트북 — 셀 정의

  /* 5개 셀. 코드는 고정이지만 결과는 실행 순서(상태)에 따라 달라진다.
   * exec(nb) 는 매번 nb.t(현재 커널의 변수 t)를 실제로 읽고 쓴다. */
  var CELL_DEFS = [
    { code: "t = pd.read_csv('train.csv')", label: '데이터 불러오기' },
    { code: "t['Age'] = t['Age'].fillna(0)", label: "원본을 바꾼다" },
    { code: "t['Age'].mean()", label: '②를 실행했는지에 따라 값이 달라진다' },
    { code: "t = pd.read_csv('train.csv')  # 다시 불러오기", label: '상태를 되돌린다' },
    { code: "t.drop('Age', axis=1)", label: 'inplace 없음 — 반환만 되고 원본에 남는다' }
  ];

  /* 아직 t 를 불러오지 않고 ②③⑤ 를 누르면 실제 노트북처럼 NameError 가 난다. */
  function requireT(nb) {
    if (!nb.t) throw new Error("NameError: name 't' is not defined — 위쪽의 '불러오기' 셀을 먼저 실행해야 한다");
  }

  var CELL_EXEC = [
    function (nb) {
      nb.t = LabData.frame('titanic').cols(['Age', 'Cabin']);
      return 't 를 불러왔다. t.shape = (' + nb.t.shape[0] + ', ' + nb.t.shape[1] + ')';
    },
    function (nb) {
      requireT(nb);
      nb.t.setCol('Age', nb.t.col('Age').fillna(0));
      return "Age 의 결측을 0 으로 채웠다. 채운 뒤 남은 결측 수 = " + nb.t.col('Age').isna().sum();
    },
    function (nb) {
      requireT(nb);
      return "t['Age'].mean() = " + UI.fmt(nb.t.col('Age').mean(), 4);
    },
    function (nb) {
      nb.t = LabData.frame('titanic').cols(['Age', 'Cabin']);
      return 't 를 다시 불러왔다(원본 상태로 되돌아감). t.shape = (' + nb.t.shape[0] + ', ' + nb.t.shape[1] + ')';
    },
    function (nb) {
      requireT(nb);
      var d = nb.t.drop('Age', { axis: 1 });
      return '반환된 표의 컬럼: [' + d.columns.join(', ') + ']\n' +
        '원본 t 의 컬럼: [' + nb.t.columns.join(', ') + ']  (t = ... 재대입을 하지 않았다)';
    }
  ];

  /* 뒤섞어 실행 미리보기 — ①③②④⑤ 순서. ②(fillna)보다 ③(mean)을 먼저 눌러서
   * "화면 순서와 실행 순서가 다르면 무슨 일이 나는지" 를 한 번에 재현한다. */
  var SHUFFLE_ORDER = [0, 2, 1, 3, 4];

  function makeNotebook() {
    return {
      counter: 0,
      t: null,
      cells: CELL_DEFS.map(function () { return { runNo: null, output: null, error: null }; }),
      history: [],
      lastCheck: null
    };
  }

  function runCell(nb, i) {
    nb.counter++;
    var st = nb.cells[i];
    st.runNo = nb.counter;
    try {
      st.output = CELL_EXEC[i](nb);
      st.error = null;
    } catch (e) {
      st.output = null;
      st.error = e.message || String(e);
    }
    nb.history.push({ cell: i, runNo: st.runNo });
  }

  /* Restart & Run All — 커널을 완전히 비우고 ①→⑤ 를 한 번씩 순서대로 실행한다.
   * 실행 전에 화면에 떠 있던 값과 실행 후의 값을 비교해, 달라진 셀이 있으면 알려 준다. */
  function restartRunAll(nb) {
    var prev = nb.cells.map(function (c) { return { runNo: c.runNo, output: c.output, error: c.error }; });
    nb.counter = 0;
    nb.t = null;
    nb.cells = CELL_DEFS.map(function () { return { runNo: null, output: null, error: null }; });
    nb.history = [];
    for (var i = 0; i < CELL_DEFS.length; i++) runCell(nb, i);

    var hadPrevious = prev.some(function (p) { return p.runNo !== null; });
    var mismatches = [];
    if (hadPrevious) {
      for (var j = 0; j < CELL_DEFS.length; j++) {
        if (prev[j].runNo !== null &&
          (prev[j].output !== nb.cells[j].output || prev[j].error !== nb.cells[j].error)) {
          mismatches.push(j);
        }
      }
    }
    nb.lastCheck = { hadPrevious: hadPrevious, mismatches: mismatches };
  }

  function renderNotebook(nb, body) {
    UI.clear(body);

    CELL_DEFS.forEach(function (def, i) {
      var st = nb.cells[i];
      var box = UI.el('div', {
        style: { borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)', marginTop: 'var(--sp-3)' }
      });
      box.appendChild(UI.el('div.panel-title', {
        text: '셀 ' + (i + 1) + ' · ' + def.label + '   —   In [' + (st.runNo === null ? ' ' : st.runNo) + ']'
      }));
      box.appendChild(UI.code(def.code, {
        output: st.error ? undefined : (st.output === null ? '(아직 실행되지 않음)' : st.output)
      }));
      if (st.error) box.appendChild(UI.danger('실행 오류', st.error));
      box.appendChild(UI.el('button', {
        text: '실행 ▶',
        onclick: function () { runCell(nb, i); renderNotebook(nb, body); }
      }));
      body.appendChild(box);
    });

    if (nb.history.length) {
      var histRows = nb.history.map(function (h) {
        return { cell: '셀 ' + (h.cell + 1), inn: 'In [' + h.runNo + ']' };
      });
      body.appendChild(UI.table(
        [{ key: 'cell', label: '클릭한 셀' }, { key: 'inn', label: '실행 번호' }],
        histRows, { caption: '지금까지의 실행 이력(클릭 순서)' }
      ));
    }

    var actions = UI.el('div', { style: { marginTop: 'var(--sp-4)' } });
    actions.appendChild(UI.el('button', {
      text: '뒤섞어서 실행해보기 (셀 1 → 3 → 2 → 4 → 5 순서)',
      onclick: function () {
        SHUFFLE_ORDER.forEach(function (i) { runCell(nb, i); });
        renderNotebook(nb, body);
      }
    }));
    actions.appendChild(UI.el('button', {
      text: 'Restart & Run All',
      onclick: function () { restartRunAll(nb); renderNotebook(nb, body); }
    }));
    actions.appendChild(UI.el('button', {
      text: '커널 초기화',
      onclick: function () {
        var fresh = makeNotebook();
        nb.counter = fresh.counter; nb.t = fresh.t; nb.cells = fresh.cells;
        nb.history = fresh.history; nb.lastCheck = fresh.lastCheck;
        renderNotebook(nb, body);
      }
    }));
    body.appendChild(actions);

    if (nb.lastCheck) {
      if (!nb.lastCheck.hadPrevious) {
        body.appendChild(UI.note('처음부터 순서대로 실행돼서 비교할 이전 상태가 없다.', 'Restart & Run All'));
      } else if (nb.lastCheck.mismatches.length === 0) {
        body.appendChild(UI.note(
          '방금 전 화면에 떠 있던 값과 지금 다시 순서대로 실행한 값이 전부 같다 — 이 노트북은 재현된다.',
          'Restart & Run All 결과'
        ));
      } else {
        var names = nb.lastCheck.mismatches.map(function (i) { return '셀 ' + (i + 1); }).join(', ');
        body.appendChild(UI.danger(
          '이 노트북은 재현되지 않는다',
          names + '의 출력이 Restart & Run All 이후 달라졌다. 방금 전 화면에 보이던 값은 위에서 아래로 ' +
          '한 번씩 실행한 결과가 아니라, 클릭한 순서가 만든 값이었다.'
        ));
      }
    }
  }

  // ═══════════════════════════════════════════════════ 시뮬레이터 ② 실행 카운트 읽기

  /* 교재 13.2절 표. titanic.ipynb 를 열어 각 셀의 실행 번호를 위치 순서대로 옮겨 적은 것 —
   * 실제 있었던 한 개 노트북의 기록이므로 값 자체는 고정이다. 그러나 "어디서 역전이 일어나는가"
   * 는 손으로 세어 적지 않고, 아래에서 배열을 순회해 계산한다. */
  var EXEC_LOG = [
    { pos: 8, code: "t['Age'] = t['Age'].fillna('0')", n: 16 },
    { pos: 9, code: "t['Cabin'].replace('S','C001')", n: 24 },
    { pos: 10, code: "t['Embarkded'] = t['Embarked']...(오타)", n: 18 },
    { pos: 11, code: "t.drop('Embarkded', axis=1)", n: 27 },
    { pos: 12, code: 'Y = ...', n: 28 },
    { pos: 13, code: 'X = ...', n: 29 },
    { pos: 14, code: 'X.head(3)', n: 30 },
    { pos: 15, code: 'Y.head()', n: 31 },
    { pos: 16, code: 'from sklearn.model_selection import train_test_split', n: 34 },
    { pos: 17, code: 'x_train, x_test, y_train, y_test = train_test_split(...)', n: 60 },
    { pos: 18, code: 'X_train.head()', n: 36 },
    { pos: 19, code: 'X_train.shape', n: 40 },
    { pos: 21, code: 'from sklearn.tree import DecisionTreeClassifier', n: 61 },
    { pos: 22, code: 'dt = DecisionTreeClassifier()', n: 63 },
    { pos: 23, code: 'dt.fit(x_train, y_train)', n: 64 },
    { pos: 24, code: 'dt.fit(X_train, Y_train)', n: 49 }
  ];

  /* 바로 앞 순서보다 번호가 작아지는 위치를 계산한다 — 이게 "역전" 이다. */
  function findReversals(log) {
    var idx = [];
    for (var i = 1; i < log.length; i++) if (log[i].n < log[i - 1].n) idx.push(i);
    return idx;
  }

  function renderExecLog(root) {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 실행 카운트 읽기' }));
    box.appendChild(UI.note(
      "위에서 아래로 한 번씩만 실행했다면 In [ ] 번호는 항상 증가해야 한다. 아래 표는 교재가 " +
      "보여주는 titanic.ipynb 를 열어 위치 순서대로 번호를 옮겨 적은 것이다. 번호가 바로 앞보다 " +
      "작아지는 지점을 찾아보자 — 손으로 세지 않고 표에서 직접 계산한다."
    ));

    var reversals = findReversals(EXEC_LOG);
    var hlCells = [];
    reversals.forEach(function (i) {
      ['pos', 'code', 'n', 'flag'].forEach(function (k) { hlCells.push([i, k]); });
    });
    var rows = EXEC_LOG.map(function (e, i) {
      return {
        pos: e.pos + '번째 셀', code: e.code, n: e.n,
        flag: reversals.indexOf(i) !== -1 ? '◀ 역전 (바로 앞보다 번호가 작다)' : ''
      };
    });
    box.appendChild(UI.table(
      [{ key: 'pos', label: '노트북에서 위치' }, { key: 'code', label: '코드 요약' },
       { key: 'n', label: 'In [ ]' }, { key: 'flag', label: '비고' }],
      rows, { hlCells: hlCells, caption: 'titanic.ipynb 의 실행 번호(위치 순서대로)' }
    ));

    box.appendChild(UI.note(
      '번호가 거꾸로 간 지점은 계산해 보면 총 ' + reversals.length + '번이다(위 표에서 링으로 표시한 행). ' +
      '위에서 아래로 한 번씩만 실행됐다면 이런 역전은 있을 수 없다 — 이 노트북은 셀을 왔다 갔다 하며 ' +
      '고치고 다시 실행하기를 반복한 기록이고, 지금 화면에 남은 코드의 순서는 실행된 순서가 아니다.'
    ));
    root.appendChild(box);
  }

  // ═══════════════════════════════════════════════════ 시뮬레이터 ③ 유령 컬럼

  var GHOST_STEPS = [
    {
      label: "① t = 데이터 불러오기 (Embarked 컬럼만)",
      code: "t = pd.read_csv('train.csv')[['Embarked']]",
      run: function (st) {
        st.t = LabData.frame('titanic').cols(['Embarked']);
        return '불러왔다. t.columns = [' + st.t.columns.join(', ') + '],  결측 수 = ' + st.t.col('Embarked').isna().sum();
      }
    },
    {
      label: "② t['Embarkded'] = t['Embarked'].fillna('S')  — 오타",
      code: "t['Embarkded'] = t['Embarked'].fillna('S')   # Embarked 를 옮겨 적다가 오타",
      run: function (st) {
        st.t.setCol('Embarkded', st.t.col('Embarked').fillna('S'));
        return "오타 이름의 새 컬럼이 생겼다. t.columns = [" + st.t.columns.join(', ') + ']';
      }
    },
    {
      label: "③ t.drop('Embarkded', axis=1)  — 재대입 없음",
      code: "t.drop('Embarkded', axis=1)   # 반환값을 어디에도 담지 않았다 (inplace 도 없다)",
      run: function (st) {
        st.d = st.t.drop('Embarkded', { axis: 1 });
        return "반환된 표의 컬럼: [" + st.d.columns.join(', ') + ']\n' +
          '원본 t 의 컬럼: [' + st.t.columns.join(', ') + ']';
      }
    }
  ];

  function renderGhostColumn(root) {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 유령 컬럼' }));
    box.appendChild(UI.note(
      "Embarked 를 옮겨 적다가 손이 미끄러져 Embarkded 라는 오타 컬럼을 만들고, 그 오타 컬럼을 " +
      "drop() 했지만 반환값을 다시 담지 않은 상황을 그대로 눌러 재현해 보자."
    ));

    var st = { step: 0, t: null, d: null };
    var body = UI.el('div');

    function rebuild() {
      UI.clear(body);
      for (var i = 0; i < st.step; i++) {
        var def = GHOST_STEPS[i];
        var out = def.__output;
        body.appendChild(UI.el('div.panel-title', { text: def.label }));
        body.appendChild(UI.code(def.code, { output: out }));
      }
      if (st.step < GHOST_STEPS.length) {
        body.appendChild(UI.el('button', {
          text: GHOST_STEPS[st.step].label + ' 실행 ▶',
          onclick: function () {
            var def = GHOST_STEPS[st.step];
            def.__output = def.run(st);
            st.step++;
            rebuild();
          }
        }));
      } else {
        body.appendChild(UI.frameTable(st.t, {
          maxRows: 5, caption: "원본 t — Embarked 와 Embarkded 가 둘 다 남아 있다"
        }));
        body.appendChild(UI.note(
          "값은 서로 같아 보이지만(둘 다 같은 값에서 나왔으니까) 컬럼은 분명히 둘이다. drop() 이 " +
          '가상으로만 지운다는 오해가 아니라(그건 7장에서 이미 바로잡았다 — drop 은 항상 새 표를 ' +
          '반환한다), t = t.drop(...) 처럼 재대입하지 않아서 원본이 그대로 남은 것이다. 오타 컬럼은 ' +
          '이후의 모든 셀에서 계속 따라다닌다.'
        ));
        body.appendChild(UI.el('button', {
          text: '초기화',
          onclick: function () { st.step = 0; st.t = null; st.d = null; rebuild(); }
        }));
      }
    }
    rebuild();
    box.appendChild(body);
    root.appendChild(box);
  }

  // ═══════════════════════════════════════════════════ 시뮬레이터 ④ 조용히 오염된 상태

  function renderSilentContamination(root) {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ 조용히 오염된 상태' }));
    box.appendChild(UI.note(
      "8장에서 실제로 있었던 문제다 — 앞 절에서 t['Age'] = t['Age'].fillna(0) 을 이미 실행해 두고, " +
      "뒤 절에서 dropna() 로 결측을 걸러내면 몇 행이 남는지 세어 보자. 앞 절을 실행했는지 여부에 " +
      "따라 뒤 절의 결과가 조용히 달라진다."
    ));

    var st = { filledEarlier: false };
    var body = UI.el('div');

    function rebuild() {
      UI.clear(body);
      var t = LabData.frame('titanic').cols(['Age']);
      if (st.filledEarlier) t.setCol('Age', t.col('Age').fillna(0));
      var naBefore = t.col('Age').isna().sum();
      var after = t.dropna();

      body.appendChild(UI.toggle({
        label: "앞 절에서 t['Age'] = t['Age'].fillna(0) 을 이미 실행했다",
        value: st.filledEarlier,
        onChange: function (v) { st.filledEarlier = v; rebuild(); }
      }));
      body.appendChild(UI.code("t.dropna()", {
        output: "dropna() 를 부르기 전 Age 의 결측 수 = " + naBefore + '\n' +
          'dropna() 이후 남은 행 수 = ' + after.shape[0] + ' / 원래 ' + t.shape[0] + '행'
      }));
      body.appendChild(UI.note(
        st.filledEarlier
          ? "이미 채워 놓았으므로 결측이 0개다 — dropna() 는 한 행도 지우지 않는다. 결측이 '있었다는 " +
            '사실' + "' 자체가 앞 절 실행 여부에 가려 보이지 않는다."
          : "아직 채우지 않았으므로 Age 의 결측이 그대로 남아 있어 dropna() 가 그 행들을 실제로 지운다. " +
            '토글을 켜고 꺼 보면 같은 코드(dropna())의 결과가 이전 셀의 실행 여부만으로 달라지는 것을 볼 수 있다.'
      ));
    }
    rebuild();
    box.appendChild(body);
    root.appendChild(box);
  }

  // ═══════════════════════════════════════════════════ 등록

  Lab.register({
    id: 'ch13-notebook',
    num: 13,
    title: '노트북이 거짓말할 때 — 실행 순서와 상태',
    subtitle: '노트북의 출력은 지금 보이는 코드가 아니라 실행 이력의 결과라는 것을 셀을 직접 눌러 확인한다',

    render: function (root) {
      root.appendChild(UI.note(
        '노트북 커널은 냄비에 비유하면 이해가 빠르다. 셀은 레시피의 한 줄이고, 실행(run)은 그 줄의 ' +
        '재료를 냄비에 넣는 행위다. 레시피(코드)를 위에서 아래로 다시 읽어도, 이미 냄비에 들어간 ' +
        '재료는 셀을 실행하기 전까지 그대로 남아 있다. 아래 시뮬레이터에서 셀을 아무 순서로나 눌러 ' +
        '보면서, 화면에 보이는 코드 순서와 실제 실행된 순서가 다를 때 무슨 일이 나는지 직접 확인해 보자.'
      ));

      // ── 시뮬레이터 ① 가짜 노트북
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 가짜 노트북 — 셀을 아무 순서로나 실행해 보기' }));
      box1.appendChild(UI.note(
        "5개의 셀이 있다. 원하는 순서로 [실행] 버튼을 눌러 보라. 각 셀은 실제로 DF 엔진을 돌려 결과를 " +
        "낸다 — 셀 ③(t['Age'].mean())의 값은 셀 ②를 먼저 실행했는지에 따라 달라진다. 다 확인했으면 " +
        "Restart & Run All 을 눌러, 지금까지 눌러서 만든 화면과 위에서 아래로 다시 실행한 결과가 " +
        "같은지 비교해 보라."
      ));
      var nb = makeNotebook();
      var body1 = UI.el('div');
      box1.appendChild(body1);
      renderNotebook(nb, body1);
      root.appendChild(box1);

      // ── 시뮬레이터 ② 실행 카운트 읽기
      renderExecLog(root);

      // ── 시뮬레이터 ③ 유령 컬럼
      renderGhostColumn(root);

      // ── 시뮬레이터 ④ 조용히 오염된 상태
      renderSilentContamination(root);

      // ── 습관 카드
      var habitBox = UI.el('div.card');
      habitBox.appendChild(UI.el('div.panel-title', { text: '습관 — 노트북을 믿을 수 있게 만드는 다섯 가지' }));
      habitBox.appendChild(UI.note(
        '냄비를 완전히 비우고 레시피를 처음부터 끝까지 다시 끓여 보는 것과 같다. 제출하기 전에 반드시 ' +
        '한 번 돌려서, 지금 보이는 코드만으로 지금 보이는 출력이 전부 나오는지 확인한다.',
        '① Restart & Run All 로 재현되지 않으면 틀린 노트북이다'
      ));
      habitBox.appendChild(UI.note(
        '중간에 위로 올라가 코드를 고쳤다면, 그 아래 셀들도 전부 다시 실행한다. 그러지 않으면 실행 ' +
        '번호가 뒤섞이고, 아래 셀들은 고치기 전의 재료로 계속 요리한다.',
        '② 셀은 위에서 아래로만 실행한다'
      ));
      habitBox.appendChild(UI.note(
        "대소문자만 다른 이름(x_train 과 X_train 같은)을 같이 쓰면 어느 쪽이 최신 값인지 코드만 " +
        '보고는 알 수 없다. 이전 세션에서 남아 있던 변수를 우연히 이어받을 수 있다.',
        '③ 변수 이름을 재사용하지 않는다'
      ));
      habitBox.appendChild(UI.note(
        "pd.read_csv(...) 를 노트북 맨 위에 한 번 두면, 데이터가 오염됐을 때 그 셀부터 다시 돌려서 " +
        '깨끗한 상태로 되돌릴 수 있다.',
        '④ 원본을 다시 읽는 셀을 위쪽에 둔다'
      ));
      habitBox.appendChild(UI.note(
        "손으로 옮겨 적다 생기는 오타(시뮬레이터 ③의 Embarkded 처럼)는 t.columns 에서 복사해 쓰면 " +
        '원천적으로 사라진다.',
        '⑤ 열 이름을 직접 타이핑하지 않는다'
      ));
      root.appendChild(habitBox);

      // ── 확인 문제
      var reversals = findReversals(EXEC_LOG);

      var qFare = LabData.frame('titanic').cols(['Fare']);
      var meanFirst = qFare.col('Fare').mean();
      qFare.setCol('Fare', qFare.col('Fare').mul(2));
      var meanAfterDouble = qFare.col('Fare').mean();

      root.appendChild(UI.quiz({
        title: '확인 문제 13-1',
        question:
          '시뮬레이터 ②의 표에서, 실행 번호(In [ ])가 바로 앞 순서보다 작아지는 지점(역전)은 모두 몇 번 나타나는가?',
        choices: [
          { label: String(reversals.length), correct: true,
            why: '표를 앞에서부터 훑으며 바로 앞 값보다 작은 자리를 세면 ' + reversals.length + '번 나온다. ' +
              '위에서 아래로 한 번씩만 실행됐다면 이런 역전은 하나도 없어야 한다.' },
          { label: String(Math.max(0, reversals.length - 1)),
            why: '표를 다시 세어 보라. 바로 앞 값보다 작아지는 자리를 하나 놓쳤다.' },
          { label: String(reversals.length + 1),
            why: '표를 다시 세어 보라. 증가하는 자리를 역전으로 잘못 셌을 수 있다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 13-2 — 이 출력을 믿을 수 있는가',
        question:
          "어떤 노트북을 그대로 실행한 결과가 아래와 같다.\n\n" +
          "In [4]  t['Fare'].mean()\n        # " + UI.fmt(meanFirst, 2) + '\n\n' +
          "In [9]  t['Fare'] = t['Fare'] * 2\n\n" +
          "In [6]  t['Fare'].mean()\n        # " + UI.fmt(meanFirst, 2) + '\n\n' +
          '이 노트북의 In [6] 출력(' + UI.fmt(meanFirst, 2) + ')을 믿을 수 있는가?',
        choices: [
          { label: '믿을 수 있다 — 코드가 위아래로 보이는 순서라면 그 값이 맞다',
            why: "틀렸다. 실행 번호를 보면 Fare 를 두 배로 만든 셀(In[9])이 두 번째 mean() 셀(In[6])보다 " +
              '나중에 실행됐다. In[6] 은 아직 두 배가 되기 전 값을 계산한 것이다.' },
          { label: '믿을 수 없다 — Restart & Run All 로 다시 실행하면 값이 달라진다', correct: true,
            why: '실제로 위에서 아래로 다시 실행하면 두 번째 mean() 은 ' + UI.fmt(meanAfterDouble, 2) + ' 이 ' +
              '된다(방금 이 페이지의 데이터로 실제 계산한 값). 화면에 위아래로 나열된 순서가 아니라 ' +
              'In [ ] 번호가 실제로 벌어진 순서다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 13-3',
        question:
          "시뮬레이터 ③에서 t.drop('Embarkded', axis=1) 을 실행한 뒤에도 t.columns 에 'Embarkded' 가 " +
          '남아 있는 이유는?',
        choices: [
          { label: 'drop() 은 화면에서만 지우고 실제 데이터에서는 지우지 않기 때문이다',
            why: "틀렸다. drop() 은 항상 새로운 DataFrame 을 반환한다(7장) — '가상으로만 지운다'는 " +
              '오해다.' },
          { label: '반환값을 t 에 다시 담지 않았고 inplace 도 주지 않았기 때문이다', correct: true,
            why: "drop() 이 돌려준 새 표는 어디에도 저장되지 않고 버려졌다. t = t.drop(...) 처럼 " +
              '재대입하거나 inplace=True 를 줘야 원본에서도 사라진다.' },
          { label: "Embarkded 컬럼의 dtype 이 문자열이라 삭제가 안 됐기 때문이다",
            why: 'dtype 과 drop() 의 동작은 관련이 없다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 13-4',
        question:
          'dt = DecisionTreeClassifier (괄호 없음) 다음에 dt.fit(X, y) 를 실행하면 에러가 난다. ' +
          'type(dt) 를 찍어 보면 무엇이 나오는가?',
        choices: [
          { label: 'DecisionTreeClassifier 의 인스턴스 — self 가 자동으로 채워지므로 문제없다',
            why: '틀렸다. 괄호가 없으므로 dt 는 인스턴스가 아니다.' },
          { label: '그 클래스를 만드는 메타클래스(abc.ABCMeta) — dt 가 클래스 자체를 가리키기 때문이다',
            correct: true,
            why: "dt = DecisionTreeClassifier 는 '결정 트리 한 그루'가 아니라 '결정 트리라는 설계도' " +
              '자체를 가리킨다. 인스턴스 메서드는 첫 번째 자리에 self 가 자동으로 채워지는데, dt 가 ' +
              '인스턴스가 아니므로 self 가 채워지지 않고 X 가 그 자리를 대신 차지해 버린다. ' +
              'dt = DecisionTreeClassifier() 처럼 괄호를 붙여야 한다.' },
          { label: 'NoneType — 괄호가 없으면 아무 것도 대입되지 않는다',
            why: '틀렸다. dt 에는 클래스 자체가 대입된다. None 이 아니다.' }
        ]
      }));
    }
  });
})();
