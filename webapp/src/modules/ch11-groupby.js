/* ch11-groupby.js — 11장. groupby — split · apply · combine (교재 11장)
 *
 * groupby 는 "무엇을 묶는지" 가 눈에 보이지 않아서 학생이 헤매는 개념이다. 이 장은
 * DF.GroupBy 가 실제로 들고 있는 행 묶음(g.groups())을 꺼내 보여주는 것이 전부다 —
 * 직접 표·차트를 새로 만들지 않고 UI.groupView 를 그대로 쓴다(API.md §5.3).
 *
 * IIFE 로 감싼다. ES 모듈 문법 금지. render 는 여러 번 호출되므로 가변 상태는
 * 전부 각 simXxx() 함수 안의 지역 변수에 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  var KEY_COLS = [
    { label: '좌석 등급 (Pclass)', value: 'Pclass' },
    { label: '성별 (Sex)', value: 'Sex' },
    { label: '승선 항구 (Embarked)', value: 'Embarked' }
  ];

  var AGG_FUNCS = [
    { label: 'mean (평균)', value: 'mean' },
    { label: 'sum (합계)', value: 'sum' },
    { label: 'max (최댓값)', value: 'max' },
    { label: 'min (최솟값)', value: 'min' },
    { label: 'count (개수)', value: 'count' },
    { label: 'median (중앙값)', value: 'median' },
    { label: 'nunique (고유값 수)', value: 'nunique' }
  ];

  var NUM_COLS = [
    { label: '나이 (Age)', value: 'Age' },
    { label: '요금 (Fare)', value: 'Fare' },
    { label: '형제자매/배우자 수 (SibSp)', value: 'SibSp' },
    { label: '부모/자녀 수 (Parch)', value: 'Parch' }
  ];

  Lab.register({
    id: 'ch11-groupby',
    num: 11,
    title: 'groupby — split · apply · combine',
    subtitle: '어떤 행이 어느 묶음에 들어갔는지 실제 행으로 확인하고, 집계를 붙였을 때만 계산이 일어나는 것을 본다',

    render: function (root) {
      root.appendChild(UI.note(
        '이 데이터는 원본과 구조(행·열 수, 결측 개수, dtype)만 같은 합성 데이터다. ' +
        'groupby(키) 는 "등급이 몇 개든, 항구가 몇 개든 상관없이 범주별로 나누고 계산하고 다시 모아라" ' +
        '를 한 번에 표현하는 방법이다. split → apply → combine 세 단계를 아래에서 직접 조작해 보라.'
      ));
      root.appendChild(simSplit());
      root.appendChild(simAggCombine());
      root.appendChild(simMultiKey());
      root.appendChild(simAggDict());
      root.appendChild(quizSection());
    }
  });

  // ──────────────────────────────────────────────────────────── 도우미

  /* 라벨 배열에서 중복을 없애고 DF.cmpLabel 로 정렬한다. 여러 키 표 재배치에 쓴다. */
  function uniqueSorted(arr) {
    var out = [];
    arr.forEach(function (v) { if (out.indexOf(v) === -1) out.push(v); });
    out.sort(DF.cmpLabel);
    return out;
  }

  /* 파이썬 딕셔너리처럼 찍어 보여준다. 학생은 Python 코드로 배우므로 JSON 이 아니라
   * {'key': 'value'} 표기로 보여준다 — 텍스트일 뿐 실제 계산은 DF 가 한다. */
  function pyDictRepr(obj) {
    return '{' + Object.keys(obj).map(function (k) {
      return "'" + k + "': '" + obj[k] + "'";
    }).join(', ') + '}';
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ①

  /* split 을 눈으로 — 이 장의 심장. groupby(키) 가 실제로 어떤 행을 어느 묶음에 넣었는지,
   * 그리고 아직 아무 계산도 하지 않았다는 것을 UI.groupView 로 그대로 보여준다. */
  function simSplit() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① split 을 눈으로 — groupby 는 무엇을 묶는가' }));
    box.appendChild(UI.note(
      "df.groupby(키) 를 부르는 순간에는 계산이 하나도 일어나지 않는다. 어떤 행을 어느 묶음에 넣을지 " +
      "'계획' 만 세울 뿐이다. 기준 컬럼을 바꿔가며 실제로 어떤 행들이 한 묶음이 되는지 확인해 보라."
    ));

    var key = 'Pclass';
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(KEY_COLS, {
      label: '기준 컬럼', selected: 0, onChange: function (v) { key = v; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var g = df.groupby(key);
      var groups = g.groups();

      body.appendChild(UI.note(
        "df.groupby('" + key + "') 는 " + groups.length + '개 묶음으로 나누는 계획만 세웠다. ' +
        '실제 pandas 에서도 이 시점에 화면에 찍어 보면 표도 숫자도 없이 DataFrameGroupBy 라는 ' +
        '객체를 가리키는 문구만 나온다 — 뒤에 mean()·count() 같은 집계를 붙여야 비로소 계산된다.'
      ));

      var sizeSeries = g.size();
      var items = [];
      for (var i = 0; i < sizeSeries.length(); i++) {
        items.push({ label: String(sizeSeries.index.at(i)), value: sizeSeries.at(i) });
      }
      body.appendChild(UI.bar(items, {
        title: "'" + key + "' 값별 행 수 — g.size()", labelHeader: key, valueHeader: '행 수'
      }));

      body.appendChild(UI.groupView(df, g, {
        maxRowsPerGroup: 4,
        title: "split → apply → combine — '" + key + "' 기준으로 나눈 실제 행"
      }));

      var total = groups.reduce(function (s, gr) { return s + gr.rows.length; }, 0);
      body.appendChild(UI.note(
        '묶음에 들어간 행을 모두 더하면 ' + total + '행이다(전체 ' + df.shape[0] + '행 중). ' +
        (total < df.shape[0]
          ? (df.shape[0] - total) + '행이 어느 묶음에도 들어가지 못했다 — ' + key + ' 값이 결측인 행은 ' +
            'groupby 가 기본값(dropna=True)으로 통째로 제외한다.'
          : '이 컬럼에는 결측이 없어 전체 행이 빠짐없이 어느 한 묶음에 들어갔다.')
      ));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ②

  /* apply → combine — 집계 함수를 붙이면 각 묶음이 값 하나로 접힌다.
   * ★ 결측은 집계에서 빠진다: Age 와 Fare 를 나란히 count() 하면 값이 다르게 나온다. */
  function simAggCombine() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② apply 로 각 묶음을 한 줄로 접기' }));
    box.appendChild(UI.note(
      '집계 함수를 고르는 순간 apply → combine 이 실행된다. 결과의 인덱스는 원래 컬럼이 아니라 ' +
      '그룹을 나눈 기준 값이 된다는 것을 눈여겨보라.'
    ));

    var key = 'Pclass';
    var agg = 'mean';
    var col = 'Age';
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(KEY_COLS, {
      label: '기준 컬럼', selected: 0, onChange: function (v) { key = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(AGG_FUNCS, {
      label: '집계 함수', selected: 0, onChange: function (v) { agg = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(NUM_COLS, {
      label: '대상 컬럼', selected: 0, onChange: function (v) { col = v; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var g = df.groupby(key);
      var result = g.aggCol(col, agg);

      body.appendChild(UI.el('div.panel-title', {
        text: "df.groupby('" + key + "')['" + col + "']." + agg + "()"
      }));
      body.appendChild(UI.seriesTable(result, { digits: 4 }));
      body.appendChild(UI.note(
        '결과의 인덱스(' + (result.index.name || key) + ')는 ' + key + ' 값 그 자체다. combine 이 끝나면 ' +
        '"무엇으로 나눴는가" 가 인덱스에, "그 그룹에 대해 계산한 값" 이 값 자리에 들어간다.'
      ));

      // ★ 결측은 집계에서 빠진다 — Age 와 Fare 를 함께 count 하면 값이 다르다
      var countBoth = g.agg({ Age: 'count', Fare: 'count' });
      body.appendChild(UI.el('div.panel-title', {
        text: "g.agg({Age: 'count', Fare: 'count'}) — 결측값은 세지 않는다"
      }));
      body.appendChild(UI.frameTable(countBoth, { digits: 0 }));

      var ageMissTotal = df.shape[0] - df.col('Age').count();
      var fareMissTotal = df.shape[0] - df.col('Fare').count();
      if (ageMissTotal !== fareMissTotal) {
        body.appendChild(UI.danger('Age 와 Fare 의 count() 가 다르다',
          'Fare 는 결측이 ' + fareMissTotal + '건이라 각 묶음의 count 가 그 묶음의 인원수(g.size())와 정확히 같지만, ' +
          'Age 는 결측이 ' + ageMissTotal + '건 있어 그보다 작게 나온다. count() 는 결측값을 세지 않기 때문이다 — ' +
          'groupby 뒤에서도 이 규칙은 그대로 적용된다.'));
      } else {
        body.appendChild(UI.note('이 컬럼 조합에서는 두 열의 결측 개수가 우연히 같다.'));
      }
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ③

  /* 여러 키로 묶기 — 키를 켜고 끄면 그룹 수가 곱해지는 것과, NaN 키를 가진 행이
   * 조용히 빠지는 것(그룹 크기의 합 < 전체 행 수)을 함께 보여준다. */
  function simMultiKey() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 여러 키로 묶기 — 그룹 수는 곱해진다' }));
    box.appendChild(UI.note(
      '키를 켜고 꺼서 몇 개의 기준으로 묶을지 정해 보라. 키를 하나 더 켤 때마다 그룹 수는 그 컬럼이 ' +
      '가진 값의 개수만큼 늘어난다(실제로 나타나는 조합만 그룹이 된다). 적어도 하나의 키는 켜져 있어야 한다.'
    ));

    var ORDER = ['Pclass', 'Sex', 'Embarked'];
    var LABELS = { Pclass: '좌석 등급 (Pclass)', Sex: '성별 (Sex)', Embarked: '승선 항구 (Embarked)' };
    var active = { Pclass: true, Sex: true, Embarked: false };
    var body = UI.el('div');

    ORDER.forEach(function (k) {
      var t = UI.toggle({
        label: LABELS[k], value: active[k],
        onChange: function (on) {
          if (!on) {
            var remaining = ORDER.filter(function (kk) { return kk === k ? false : active[kk]; });
            if (remaining.length === 0) {
              t.setAttribute('aria-pressed', 'true');   // 최소 1개는 켜져 있어야 한다 — 되돌린다
              return;
            }
          }
          active[k] = on;
          rebuild();
        }
      });
      box.appendChild(t);
    });
    box.appendChild(body);

    function pivotTable(df, groups, keys) {
      var rowVals = uniqueSorted(groups.map(function (gr) { return gr.key[0]; }));
      var colVals = uniqueSorted(groups.map(function (gr) { return gr.key[1]; }));
      var cellMap = {};
      groups.forEach(function (gr) {
        var sub = df.take(gr.rows);
        cellMap[gr.key[0] + '||' + gr.key[1]] = sub.col('Age').mean();
      });

      var cols = [{ key: 'row', label: keys[0] }];
      colVals.forEach(function (cv, i) {
        cols.push({ key: 'c' + i, label: keys[1] + ' = ' + String(cv), digits: 2 });
      });
      var rows = rowVals.map(function (rv) {
        var r = { row: rv };
        colVals.forEach(function (cv, i) {
          var v = cellMap[rv + '||' + cv];
          r['c' + i] = v === undefined ? NaN : v;
        });
        return r;
      });

      var wrap = UI.el('div');
      wrap.appendChild(UI.el('div.panel-title', {
        text: keys[0] + ' × ' + keys[1] + ' 별 Age 평균 — unstack() 이 하는 일을 표로 직접 재배치'
      }));
      wrap.appendChild(UI.table(cols, rows));
      wrap.appendChild(UI.note(
        '세로로 긴 groupby([' + keys.join(', ') + "])['Age'].mean() 결과를, 두 번째 키(" + keys[1] +
        ')를 열로 옮겨 익숙한 가로세로 표 모양으로 바꾼 것이다. 키가 정확히 2개일 때만 이렇게 2차원으로 펼 수 있다.'
      ));
      return wrap;
    }

    function flatTable(df, groups, keys) {
      var cols = keys.map(function (k, i) { return { key: 'k' + i, label: k }; });
      cols.push({ key: 'n', label: '행 수' });
      cols.push({ key: 'ageMean', label: 'Age 평균', digits: 2 });

      var rows = groups.map(function (gr) {
        var r = {};
        keys.forEach(function (k, i) { r['k' + i] = gr.key[i]; });
        r.n = gr.rows.length;
        r.ageMean = df.take(gr.rows).col('Age').mean();
        return r;
      });

      var wrap = UI.el('div');
      wrap.appendChild(UI.el('div.panel-title', { text: keys.join(' × ') + ' 조합별 그룹' }));
      wrap.appendChild(UI.table(cols, rows));
      wrap.appendChild(UI.note(
        keys.length === 1
          ? '키가 하나뿐이면 표를 재배치할 필요가 없다. 이 형태 그대로가 groupby 의 결과다.'
          : '키가 3개면 2차원 표 하나로는 다 담을 수 없어 조합을 한 줄씩 나열했다 ' +
            '(pandas 라면 세 단계짜리 MultiIndex Series 형태로 나온다).'
      ));
      return wrap;
    }

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var keys = ORDER.filter(function (k) { return active[k]; });
      var g = df.groupby(keys);
      var groups = g.groups();

      var theoretical = keys.reduce(function (p, k) { return p * df.col(k).nunique(); }, 1);
      body.appendChild(UI.note(
        '선택한 키: ' + keys.join(' × ') + '. 각 컬럼이 가질 수 있는 값의 개수를 곱하면 이론상 최대 ' +
        theoretical + '개 조합이 나올 수 있는데, 데이터에 실제로 나타난 조합은 ' + groups.length + '개다' +
        (groups.length < theoretical ? ' — 일부 조합은 이 데이터에 아예 존재하지 않는다.' : '.')
      ));

      var totalInGroups = groups.reduce(function (s, gr) { return s + gr.rows.length; }, 0);
      var totalRows = df.shape[0];
      if (totalInGroups < totalRows) {
        var naKeys = keys.filter(function (k) { return df.col(k).count() < totalRows; });
        body.appendChild(UI.danger('그룹 크기의 합이 전체 행 수보다 작다',
          '그룹에 들어간 행을 모두 더하면 ' + totalInGroups + '행인데 전체는 ' + totalRows + '행이다(차이 ' +
          (totalRows - totalInGroups) + '행). ' +
          (naKeys.length ? naKeys.join(', ') + ' 열에 결측값이 있는 행은 그룹을 나눌 키 자체가 없어 ' +
            '어느 그룹에도 들어가지 못했다.' : '선택한 키 중 결측이 있는 컬럼 때문이다.') +
          ' 이것이 "조용한 데이터 손실" 이다 — 그룹별 합계를 냈는데 전체 합과 안 맞으면 이 경우를 의심하라.'));
      } else {
        body.appendChild(UI.note('선택한 키에는 결측이 없어 전체 ' + totalRows + '행이 모두 그룹에 들어갔다.'));
      }

      body.appendChild(keys.length === 2 ? pivotTable(df, groups, keys) : flatTable(df, groups, keys));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ④

  /* agg 로 컬럼마다 다른 집계 — ★ 같은 컬럼을 딕셔너리(객체)에 두 번 키로 쓰면
   * 나중 값이 앞의 값을 덮어써서 하나가 조용히 사라진다. */
  function simAggDict() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ agg 로 컬럼마다 다른 집계' }));
    box.appendChild(UI.note(
      '컬럼마다 원하는 집계 함수를 골라 g.agg({...}) 에 한 번에 넘겨 보라. 컬럼 수만큼 다른 통계가 ' +
      '한 표에 나온다.'
    ));

    var key = 'Pclass';
    var aggAge = 'max', aggFare = 'mean', aggSibSp = 'sum';
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(KEY_COLS, {
      label: '기준 컬럼', selected: 0, onChange: function (v) { key = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(AGG_FUNCS, {
      label: 'Age 에 적용할 집계', selected: 2, onChange: function (v) { aggAge = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(AGG_FUNCS, {
      label: 'Fare 에 적용할 집계', selected: 0, onChange: function (v) { aggFare = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(AGG_FUNCS, {
      label: 'SibSp 에 적용할 집계', selected: 1, onChange: function (v) { aggSibSp = v; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var g = df.groupby(key);
      var spec = { Age: aggAge, Fare: aggFare, SibSp: aggSibSp };
      var result = g.agg(spec);

      body.appendChild(UI.el('div.panel-title', {
        text: "g.agg({Age: '" + aggAge + "', Fare: '" + aggFare + "', SibSp: '" + aggSibSp + "'})"
      }));
      body.appendChild(UI.frameTable(result, { digits: 4 }));
      body.appendChild(UI.note('세 컬럼에 서로 다른 집계를 한 번에 걸었다 — 컬럼마다 원하는 통계가 다를 때 쓰는 형태다.'));

      // ★ 같은 컬럼을 두 번 키로 쓰면 나중 값만 남는다 — 실제 자바스크립트 객체 리터럴로 재현
      var demoSpec = { Age: 'max', Age: 'mean', Fare: 'mean' };   // eslint-disable-line no-dupe-keys
      var demoResult = g.agg(demoSpec);

      body.appendChild(UI.el('div.panel-title', { text: '함정 — 같은 컬럼을 딕셔너리에 두 번 쓰면?' }));
      body.appendChild(UI.note(
        "agg_format2 = {'Age': 'max', 'Age': 'mean', 'Fare': 'mean'} 를 그대로 실행하면, groupby 가 보기도 " +
        '전에 딕셔너리 리터럴 자체가 같은 키를 나중 값으로 덮어써 버린다(자바스크립트 객체도 똑같다 — ' +
        '이 화면은 자바스크립트로 같은 상황을 그대로 재현했다). 지금 agg_format2 를 그대로 찍어 보면:'
      ));
      body.appendChild(UI.code(
        "agg_format2 = {'Age': 'max', 'Age': 'mean', 'Fare': 'mean'}\nagg_format2",
        { output: pyDictRepr(demoSpec) }
      ));
      body.appendChild(UI.danger("'Age: max' 가 흔적도 없이 사라졌다",
        "agg_format2 는 이미 {'Age': 'mean', 'Fare': 'mean'} 이 되어 있다. groupby(...).agg(agg_format2) 를 " +
        '실행하면 아래처럼 Age 최댓값은 어디에도 없고 평균만(그것도 한 번) 나온다. 에러도 경고도 없어서 ' +
        '딕셔너리를 다시 읽어 보지 않으면 최댓값이 빠졌다는 사실조차 알아채기 어렵다.'));
      body.appendChild(UI.frameTable(demoResult, { digits: 4 }));

      // 해결책 — 컬럼 이름을 나눠 따로따로 집계한 뒤 합친다 (pandas 의 키워드 인자 형태에 대응)
      var ageMax = g.aggCol('Age', 'max');
      var ageMean = g.aggCol('Age', 'mean');
      var fareMean = g.aggCol('Fare', 'mean');
      var fixed = DF.frame({
        age_max: ageMax.toArray(),
        age_mean: ageMean.toArray(),
        fare_mean: fareMean.toArray()
      }, { index: ageMax.labels() });

      body.appendChild(UI.el('div.panel-title', { text: '해결책 — 결과 컬럼 이름을 나눠서 각각 집계' }));
      body.appendChild(UI.note(
        '같은 원본 컬럼(Age)에 여러 집계를 걸고 싶다면 딕셔너리 키를 결과 컬럼 이름으로 바꿔 각각 ' +
        "집계한 뒤 합친다(age_max, age_mean). 키 충돌 자체가 일어날 수 없다."
      ));
      body.appendChild(UI.frameTable(fixed, { digits: 4 }));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 확인 문제

  function quizSection() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: '확인 문제' }));

    var df = LabData.frame('titanic');

    var gPclass = df.groupby('Pclass');
    var countBoth = gPclass.agg({ Age: 'count', Fare: 'count' });
    var ageCounts = countBoth.col('Age').toArray();
    var fareCounts = countBoth.col('Fare').toArray();

    var gEmb = df.groupby('Embarked');
    var embSizeSum = gEmb.size().toArray().reduce(function (a, b) { return a + b; }, 0);
    var totalRows = df.shape[0];
    var embMissing = totalRows - embSizeSum;

    wrap.appendChild(UI.quiz({
      question: "g = titanic.groupby('Pclass') 한 줄만 실행했다. 이 시점에 등급별 평균 나이 같은 숫자가 이미 계산되어 있는가?",
      choices: [
        {
          label: '아니다 — groupby() 는 어떻게 나눌지 계획만 세울 뿐, 집계 함수를 붙여야 계산된다', correct: true,
          why: 'g.groups() 로 어떤 행이 어느 묶음에 들어갔는지 미리 볼 수는 있지만, 그것도 분류 결과이지 계산 ' +
            '결과가 아니다. 실제 숫자는 .mean(), .count() 같은 apply 단계 메서드를 붙여야 나온다.'
        },
        {
          label: '그렇다 — groupby() 를 부르는 순간 모든 통계가 미리 계산된다', correct: false,
          why: 'groupby() 는 DataFrameGroupBy(이 엔진에서는 GroupBy) 객체만 돌려준다. 집계 메서드를 붙이기 전에는 값이 없다.'
        },
        {
          label: '등급이 3개뿐이라 계산이 빨라서 이미 끝나 있다', correct: false,
          why: '그룹 수와 상관없이 groupby() 자체는 계산을 하지 않는다. 계산은 그 뒤의 apply 단계에서 일어난다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: "titanic.groupby('Pclass').agg({Age: 'count', Fare: 'count'}) 를 실행하면 1등급의 Age 는 " +
        ageCounts[0] + ', Fare 는 ' + fareCounts[0] + '로 서로 다르게 나온다. 왜 그런가?',
      choices: [
        {
          label: 'count() 는 결측값을 세지 않는데, Age 에는 결측이 있고 Fare 에는 없기(또는 더 적기) 때문이다', correct: true,
          why: 'Fare 는 결측이 없어 등급별 인원수와 정확히 같지만, Age 는 등급마다 결측값이 섞여 있어 그보다 ' +
            '작게 나온다. groupby 뒤에서도 "결측값은 집계에서 빠진다" 는 규칙이 그대로 적용된다.'
        },
        {
          label: '같은 DataFrame 인데 Fare 열의 행 수가 Age 열보다 원래 더 많기 때문이다', correct: false,
          why: '같은 titanic DataFrame 의 두 열이므로 전체 행 수(길이)는 같다. count() 차이는 결측값 때문이다.'
        },
        {
          label: '두 컬럼을 서로 다른 기준으로 그룹 지었기 때문이다', correct: false,
          why: "같은 groupby('Pclass') 결과에 대해 두 컬럼을 나란히 집계한 것이다. 그룹 기준은 같다."
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: "titanic.groupby('Embarked').size() 의 합은 " + embSizeSum + '인데 titanic.shape[0] 은 ' +
        totalRows + '이다. ' + embMissing + '행이 차이 나는 이유는 무엇이며, 전체 행을 다 세려면 어떻게 해야 하는가?',
      choices: [
        {
          label: 'Embarked 가 결측인 행은 기본값(dropna=True) 때문에 그룹에서 통째로 빠진다. dropna=False 를 주면 NaN 그룹이 추가되어 합이 맞는다', correct: true,
          why: 'groupby() 의 기본값은 그룹을 나누는 기준 컬럼이 결측인 행을 제외한다. dropna=False 를 주면 ' +
            'NaN 이라는 별도 그룹이 생겨 합이 전체 행 수와 같아진다.'
        },
        {
          label: 'size() 계산이 잘못됐다', correct: false,
          why: '계산은 정확하다. 결측 키를 가진 행이 조용히 빠지는 것이 pandas groupby 의 기본 동작이다.'
        },
        {
          label: 'Embarked 열의 값 중 일부가 중복되어 있어서다', correct: false,
          why: '중복 값은 오히려 정상적으로 하나의 그룹으로 합쳐질 뿐 행이 사라지지 않는다. 행이 사라지는 이유는 결측(NaN) 키다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: "{Age: 'max', Age: 'mean', Fare: 'mean'} 처럼 딕셔너리(객체)에 같은 컬럼 이름을 키로 두 번 쓰면 " +
        '두 집계를 다 구할 수 있는가?',
      choices: [
        {
          label: "아니다 — groupby 가 보기도 전에 객체 리터럴 자체가 나중 값으로 덮어써서 'Age: max' 는 사라진다", correct: true,
          why: "객체(딕셔너리)가 만들어지는 순간 이미 {Age: 'mean', Fare: 'mean'} 이 되어 있다. groupby().agg() 는 " +
            '이 덮어써진 결과만 본다. 해결하려면 결과 컬럼 이름을 나눠(age_max, age_mean) 각각 집계해야 한다.'
        },
        {
          label: '그렇다 — groupby 가 같은 컬럼에 걸린 값을 배열로 알아서 모아 준다', correct: false,
          why: '모아주지 않는다. 나중에 쓴 값이 앞의 값을 그냥 지운다. 배열로 모으려면 애초에 같은 키를 두 번 쓰면 안 된다.'
        },
        {
          label: '에러가 나서 코드가 멈춘다', correct: false,
          why: '에러도 경고도 없다. 그래서 딕셔너리를 다시 확인해 보지 않으면 최댓값이 빠진 것을 알아채기 어렵다.'
        }
      ]
    }));

    return wrap;
  }
})();
