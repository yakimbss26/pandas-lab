/* ch10-agg.js — 10장. 정렬과 집계
 *
 * 교재 10장(pandas.md 3927~4279줄)의 짝.
 * sort_values 로 순서를 바꾸되 인덱스는 값을 따라간다는 것, count/sum/mean/std 같은 집계
 * 함수가 결측을 어떻게 다루는지, describe() 의 8줄이 각각 무엇인지, 문자열 컬럼이 섞이면
 * corr() 이 죽는다는 것을 실행으로 보여준다. 이 파일이 화면에 내는 숫자는 전부 DF 엔진이
 * LabData.frame('titanic') 을 그 자리에서 계산한 값이다 — 손으로 적은 숫자는 없다.
 *
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다. IIFE 로 감싼다.
 */
(function () {
  'use strict';

  var SORT_COLS = [
    { label: '나이 (Age, 결측 있음)', value: 'Age' },
    { label: '선착장 (Embarked, 결측 있음)', value: 'Embarked' },
    { label: '요금 (Fare)', value: 'Fare' },
    { label: '좌석 등급 (Pclass)', value: 'Pclass' },
    { label: '이름 (Name)', value: 'Name' }
  ];

  var AGG_COLS = [
    { label: '나이 (Age)', value: 'Age' },
    { label: '요금 (Fare)', value: 'Fare' },
    { label: '좌석 등급 (Pclass)', value: 'Pclass' },
    { label: '형제자매/배우자 수 (SibSp)', value: 'SibSp' },
    { label: '부모/자녀 수 (Parch)', value: 'Parch' }
  ];

  var CORR_COLS = [
    { label: '좌석 등급 (Pclass)', value: 'Pclass' },
    { label: '나이 (Age)', value: 'Age' },
    { label: '형제자매/배우자 수 (SibSp)', value: 'SibSp' },
    { label: '부모/자녀 수 (Parch)', value: 'Parch' },
    { label: '요금 (Fare)', value: 'Fare' },
    { label: '생존 여부 (Survived)', value: 'Survived' },
    { label: '승객 번호 (PassengerId)', value: 'PassengerId' }
  ];

  Lab.register({
    id: 'ch10-agg',
    num: 10,
    title: '정렬과 집계',
    subtitle: 'sort_values 로 순서를 정하고, count·mean·std·describe·corr 로 수백 행을 숫자 몇 개로 요약한다',

    render: function (root) {
      root.appendChild(simSort());
      root.appendChild(simAggCalc());
      root.appendChild(simDescribeHist());
      root.appendChild(simCorr());
      root.appendChild(quizSection());
    }
  });

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ①

  /* 정렬 실험실 — sort_values 로 순서를 바꿔도 인덱스가 값을 따라가는 것,
   * 결측값은 오름차순·내림차순 상관없이 언제나 맨 뒤로 가는 것을 직접 본다. */
  function simSort() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 정렬 실험실 — sort_values' }));
    box.appendChild(UI.note('titanic 데이터는 원본과 구조(행 수, 결측 개수, dtype)만 같은 합성 데이터다.'));

    var col = 'Age';
    var asc = true;
    var multi = false;
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(SORT_COLS, {
      label: '정렬 기준', selected: 0, onChange: function (v) { col = v; rebuild(); }
    }));
    box.appendChild(UI.toggle({
      label: '내림차순 (ascending=False)', value: !asc,
      onChange: function (on) { asc = !on; rebuild(); }
    }));
    box.appendChild(UI.toggle({
      label: "여러 컬럼 정렬 — ['Pclass', 선택한 컬럼]", value: multi,
      onChange: function (on) { multi = on; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var by = multi ? ['Pclass', col] : col;
      var sorted = df.sortValues(by, { ascending: asc });

      body.appendChild(UI.el('div.panel-title', {
        text: "t.sort_values(" + JSON.stringify(by) + ", ascending=" + asc + ")"
      }));

      // ── 인덱스는 값을 따라간다 ──────────────────────────────────
      var origLabel0 = df.index.at(0);
      var sortedLabel0 = sorted.index.at(0);
      var sortedName0 = sorted.col('Name').at(0);
      var checkedName = df.loc(sortedLabel0, 'Name').at(0);
      var consistent = checkedName === sortedName0;

      var headHl = [];
      for (var i = 0; i < Math.min(6, sorted.shape[0]); i++) headHl.push([i, '__index__']);
      body.appendChild(UI.frameTable(sorted.head(6), { digits: 2, hlCells: headHl }));

      body.appendChild(UI.note(
        '정렬 전 df 의 맨 위 행(iloc 위치 0)은 인덱스 라벨 ' + origLabel0 + '를 갖고 있었다. 정렬 후 표의 맨 ' +
        '위 행은 위치는 바뀌었지만 인덱스 라벨 ' + sortedLabel0 + '(위 표에서 링으로 표시)를 그대로 갖고 있다. ' +
        "df.loc(" + sortedLabel0 + ", 'Name') 으로 원본에서 찾아도 같은 사람(" + checkedName + ")이 나온다(" +
        (consistent ? '일치' : '불일치') + ') — sort_values 는 행의 순서만 바꿀 뿐, 인덱스는 원래 행의 것을 ' +
        '그대로 들고 다닌다. 5장의 loc(라벨)·iloc(위치) 구분이 여기서도 그대로 유효하다.'
      ));

      if (!multi) {
        var total = df.col(col).length();
        var nonNull = df.col(col).count();
        var missing = total - nonNull;
        if (missing > 0) {
          var tailN = Math.min(6, missing);
          var tail = sorted.tail(tailN);
          var tailHl = [];
          for (var j = 0; j < tail.shape[0]; j++) tailHl.push([j, col]);
          body.appendChild(UI.el('div.panel-title', { text: col + ' 결측 ' + missing + '건 — 표의 맨 끝' }));
          body.appendChild(UI.frameTable(tail, { digits: 2, hlCells: tailHl }));
          var allNaAtTail = true;
          for (var k = 0; k < tailN; k++) { if (!DF.isNA(tail.col(col).at(k))) allNaAtTail = false; }
          body.appendChild(UI.danger(
            '결측은 언제나 맨 뒤',
            col + ' 열에는 결측이 ' + missing + '건 있다. 지금 ' + (asc ? '오름차순' : '내림차순') +
            '으로 정렬했는데도 맨 마지막 ' + tailN + '행이 ' + (allNaAtTail ? '전부 결측(NaN)이다' : '결측이 아니다') +
            '. 위 토글로 방향을 바꿔 봐도(오름↔내림) 결측은 항상 맨 뒤에 남는다 — na_position="last" 가 ' +
            '기본값이기 때문이다.'
          ));
        } else {
          body.appendChild(UI.note(col + ' 열에는 결측이 없어(count = ' + nonNull + ' / ' + total +
            ') 이 정렬에서는 결측이 맨 뒤로 가는 모습을 볼 수 없다. Age 나 Embarked 를 골라 보라.'));
        }
      } else {
        var firstPclass = sorted.col('Pclass').at(0);
        var lastPclass = sorted.col('Pclass').at(sorted.shape[0] - 1);
        body.appendChild(UI.note(
          "['Pclass', '" + col + "'] 로 정렬하면 Pclass 가 먼저 결정한다(" + (asc ? '오름차순' : '내림차순') +
          ' 이므로 맨 위는 Pclass=' + firstPclass + ', 맨 아래는 Pclass=' + lastPclass + '). Pclass 값이 같은 ' +
          '행끼리는 그 안에서 ' + col + ' 기준으로 다시 줄을 선다 — 앞 컬럼이 우선순위를 갖고, 값이 같을 때만 ' +
          '다음 컬럼으로 넘어간다.'
        ));
      }

      body.appendChild(UI.note(
        'sort_values() 도 원본을 바꾸지 않는다(4장의 drop() 과 같은 패턴). 반환값을 변수에 받지 않으면 ' +
        '정렬된 결과는 만들어졌다가 그대로 버려진다.'
      ));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ②

  /* 집계 함수 계산기 — count/sum/mean/min/max/median/std/nunique 를 한 번에.
   * count() 와 shape[0] 의 차이, std 의 ddof=1 기본값을 직접 대조한다. */
  function simAggCalc() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 집계 함수 계산기' }));

    var col = 'Age';
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(AGG_COLS, {
      label: '숫자 컬럼', selected: 0, onChange: function (v) { col = v; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var s = df.col(col);
      var totalRows = df.shape[0];
      var cnt = s.count();
      var missing = totalRows - cnt;

      body.appendChild(UI.el('div.panel-title', { text: "df.col('" + col + "') 의 집계값" }));
      body.appendChild(UI.table([
        { key: 'which', label: '집계 함수' },
        { key: 'value', label: '값', digits: 4 }
      ], [
        { which: 'count()', value: cnt },
        { which: 'sum()', value: s.sum() },
        { which: 'mean()', value: s.mean() },
        { which: 'min()', value: s.min() },
        { which: 'max()', value: s.max() },
        { which: 'median()', value: s.median() },
        { which: 'std()', value: s.std() },
        { which: 'nunique()', value: s.nunique() }
      ], { hlCells: missing > 0 ? [[0, 'which'], [0, 'value']] : [] }));

      body.appendChild(UI.el('div.panel-title', { text: 'count() 대 shape[0]' }));
      body.appendChild(UI.table([
        { key: 'which', label: '무엇' },
        { key: 'value', label: '값' }
      ], [
        { which: 'df.shape[0] — 전체 행 수', value: totalRows },
        { which: "df.col('" + col + "').count() — 결측이 아닌 값의 개수", value: cnt }
      ], {}));
      body.appendChild(missing > 0
        ? UI.danger(
            'count() != shape[0]',
            col + ' 열은 ' + totalRows + '행 중 ' + missing + '개가 결측이라 count() 는 ' + cnt +
            '만 센다. count() 는 "그 컬럼에 값이 몇 개 채워져 있는가" 를 답하고, shape[0] 은 "행이 ' +
            '몇 개인가" 를 답한다 — 질문 자체가 다르다.'
          )
        : UI.note(col + ' 열에는 결측이 없어 count()(' + cnt + ') 와 shape[0](' + totalRows + ') 가 같다.')
      );

      // ★ std 의 ddof 기본값
      var std1 = s.std(1);
      var std0 = s.std(0);
      body.appendChild(UI.el('div.panel-title', { text: 'std 는 ddof 에 따라 값이 달라진다' }));
      body.appendChild(UI.table([
        { key: 'which', label: '호출' },
        { key: 'value', label: '표준편차', digits: 6 }
      ], [
        { which: "s.std()  — ddof=1 (pandas 기본, 표본 표준편차)", value: std1 },
        { which: "s.std(0) — ddof=0 (numpy 의 np.std 기본값)", value: std0 }
      ], {}));
      body.appendChild(UI.note(
        '같은 ' + col + ' 열인데 ddof 기본값이 다르면 표준편차 값도 달라진다(' + UI.fmt(std1, 6) + ' 대 ' +
        UI.fmt(std0, 6) + '). pandas 와 numpy 를 섞어 쓰다가 표준편차가 다르게 나온다면 라이브러리가 아니라 ' +
        'ddof 기본값 차이를 먼저 의심한다.'
      ));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ③

  /* describe() 와 분포 잇기 — 8줄이 히스토그램의 어디를 가리키는지 연결한다. */
  function simDescribeHist() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ describe() 와 분포 잇기' }));

    var col = 'Age';
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(AGG_COLS, {
      label: '숫자 컬럼', selected: 0, onChange: function (v) { col = v; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var s = df.col(col);
      var desc = s.describe();

      body.appendChild(UI.el('div.panel-title', { text: "df.col('" + col + "').describe()" }));
      body.appendChild(UI.seriesTable(desc, { digits: 4 }));

      var bins = s.nunique() > 1 && s.nunique() <= 10 ? s.nunique() : 20;
      body.appendChild(UI.hist(s.toArray(), { title: col + ' 의 분포', bins: bins }));

      var nums = s.toArray().filter(function (v) { return typeof v === 'number' && !isNaN(v); });
      var lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
      var step = (hi - lo) / bins || 1;
      function binRange(v) {
        var k = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step)));
        return UI.fmt(lo + k * step, 2) + ' ~ ' + UI.fmt(lo + (k + 1) * step, 2);
      }
      var q25 = s.quantile(0.25), q50 = s.median(), q75 = s.quantile(0.75);
      body.appendChild(UI.note(
        '25% 지점(' + UI.fmt(q25, 3) + ')은 히스토그램의 ' + binRange(q25) + ' 구간에, ' +
        '중앙값 50%(' + UI.fmt(q50, 3) + ')는 ' + binRange(q50) + ' 구간에, ' +
        '75% 지점(' + UI.fmt(q75, 3) + ')은 ' + binRange(q75) + ' 구간에 있다. 값을 오름차순으로 늘어놓았을 ' +
        '때 그 비율 지점에 있는 값이 사분위수(quartile)다.'
      ));

      var medianVal = s.median();
      var describe50 = desc.loc('50%');
      var same = medianVal === describe50;
      body.appendChild(UI.note(
        's.median() = ' + UI.fmt(medianVal, 6) + ', describe()[\'50%\'] = ' + UI.fmt(describe50, 6) + ' — ' +
        (same ? '완전히 같은 값이다' : '값이 다르다(엔진 확인 필요)') +
        '. 50% 지점을 따로 중앙값(median)이라 부르는 것뿐, 계산은 하나다.'
      ));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ④

  /* 상관계수 — 문자열 컬럼이 섞이면 pandas 의 corr() 이 죽는 유일한 케이스.
   * 엔진에는 corr 이 없으므로 숫자 컬럼 두 개를 골라 피어슨 상관계수를 직접 계산한다. */
  function pearsonPairwise(df, xName, yName) {
    var xs = df.col(xName).toArray();
    var ys = df.col(yName).toArray();
    var px = [], py = [];
    for (var i = 0; i < xs.length; i++) {
      if (!DF.isNA(xs[i]) && !DF.isNA(ys[i]) && typeof xs[i] === 'number' && typeof ys[i] === 'number') {
        px.push(xs[i]); py.push(ys[i]);
      }
    }
    var n = px.length;
    if (n < 2) return { r: NaN, n: n, points: [] };
    var mx = px.reduce(function (a, b) { return a + b; }, 0) / n;
    var my = py.reduce(function (a, b) { return a + b; }, 0) / n;
    var num = 0, dx2 = 0, dy2 = 0;
    for (var j = 0; j < n; j++) {
      var dx = px[j] - mx, dy = py[j] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    var r = (dx2 === 0 || dy2 === 0) ? NaN : num / Math.sqrt(dx2 * dy2);
    var points = [];
    for (var k = 0; k < n; k++) points.push([px[k], py[k]]);
    return { r: r, n: n, points: points };
  }

  function simCorr() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ ★ 상관계수 — 여기서 실행이 멈춘다' }));

    var dfIntro = LabData.frame('titanic');
    var firstName = dfIntro.col('Name').at(0);
    box.appendChild(UI.danger(
      "t.corr() 는 ValueError 로 죽는다",
      "Name, Sex, Ticket, Cabin, Embarked 같은 문자열 컬럼이 섞인 채로 t.corr() 를 그대로 부르면 " +
      "pandas 는 문자열을 실수로 바꾸려다 실패한다. 예를 들어 titanic 의 첫 행 Name 값은 '" + firstName +
      "'인데, 이런 문자열은 애초에 숫자가 아니라서 상관계수를 계산할 수 없다. 숫자 컬럼만 쓰겠다는 뜻을 " +
      "numeric_only=True 로 직접 밝혀야 한다(t.corr(numeric_only=True))."
    ));
    box.appendChild(UI.code(
      "t.corr()",
      { title: '문자열 컬럼이 섞인 채로 corr() 을 부르면', output: "ValueError: could not convert string to float: '" + firstName + "'" }
    ));
    box.appendChild(UI.note(
      '엔진(DF)에는 corr() 이 없다. 아래 계산기는 숫자 컬럼 두 개를 골라 피어슨 상관계수를 직접 계산한다 ' +
      '(두 컬럼 모두 값이 있는 행만 골라 평균과 표준편차로 구한다) — pandas 의 corr(numeric_only=True) 와 ' +
      '같은 방식이다.'
    ));

    var xCol = 'Pclass';
    var yCol = 'Fare';
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(CORR_COLS, {
      label: 'x 축 컬럼', selected: 0, onChange: function (v) { xCol = v; rebuild(); }
    }));
    box.appendChild(UI.buttonGroup(CORR_COLS, {
      label: 'y 축 컬럼', selected: 4, onChange: function (v) { yCol = v; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');

      if (xCol === yCol) {
        body.appendChild(UI.note('같은 컬럼을 x, y 로 고르면 상관계수는 언제나 1이다(자기 자신과는 완전히 ' +
          '같이 움직인다). 서로 다른 두 컬럼을 골라 보라.'));
        return;
      }

      var result = pearsonPairwise(df, xCol, yCol);
      body.appendChild(UI.el('div.panel-title', {
        text: 'corr(' + xCol + ', ' + yCol + ') = ' + UI.fmt(result.r, 4) + '  (결측 없는 ' + result.n + '쌍으로 계산)'
      }));

      var abs = Math.abs(result.r);
      var strength = isNaN(abs) ? '계산할 수 없음' : abs >= 0.6 ? '뚜렷한' : abs >= 0.3 ? '약한' : '거의 없는';
      var direction = result.r > 0 ? '같은 방향으로(하나가 커지면 다른 하나도 커지는 쪽으로)'
        : result.r < 0 ? '반대 방향으로(하나가 커지면 다른 하나는 작아지는 쪽으로)' : '어느 쪽도 아니게';
      body.appendChild(UI.note(
        xCol + ' 와 ' + yCol + ' 는 ' + strength + ' 상관관계를 보인다(|r| = ' + UI.fmt(abs, 3) + '). ' +
        '부호가 ' + (result.r >= 0 ? '양수' : '음수') + '이므로 두 값은 ' + direction + ' 움직이는 경향이 있다.'
      ));

      // 산점도는 표시 목적으로 최대 300점만 그린다. r 값 자체는 결측 없는 전체 쌍으로 계산했다.
      var pts = result.points;
      if (pts.length > 300) {
        var step = Math.ceil(pts.length / 300);
        var sampled = [];
        for (var i = 0; i < pts.length; i += step) sampled.push(pts[i]);
        pts = sampled;
        body.appendChild(UI.note(
          '산점도에는 ' + result.n + '쌍 중 ' + pts.length + '개만 골라 그렸다(화면이 너무 빽빽해지지 않게). ' +
          '상관계수 값은 표시된 점이 아니라 결측 없는 ' + result.n + '쌍 전체로 계산한 값이다.'
        ));
      }
      body.appendChild(UI.scatter(
        [{ name: xCol + ' vs ' + yCol, points: pts }],
        { title: xCol + ' – ' + yCol + ' 산점도', xLabel: xCol, yLabel: yCol }
      ));

      body.appendChild(UI.note(
        '상관계수가 인과관계를 뜻하지는 않는다. 두 컬럼이 강하게 상관되어 있다고 해서 어느 하나가 다른 ' +
        '하나의 원인은 아니다. 둘 다 같은 원인(예: 좌석 등급)에서 갈라져 나온 결과일 수 있다. 상관계수는 ' +
        '"같이 움직이는 정도"만 알려 준다 — 왜 같이 움직이는지는 데이터 밖의 지식으로 판단해야 한다.',
        '상관은 인과가 아니다'
      ));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 확인 문제

  function quizSection() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: '확인 문제' }));

    var df = LabData.frame('titanic');
    var totalRows = df.shape[0];
    var ageCount = df.col('Age').count();
    var ageMissing = totalRows - ageCount;
    var embMissing = df.col('Embarked').length() - df.col('Embarked').count();

    var sample = DF.series([1, 2, 3, 4], { dtype: 'float64' });
    var std1 = sample.std();
    var std0 = sample.std(0);

    wrap.appendChild(UI.quiz({
      question: "titanic 데이터에서 t['Age'].count() 는 " + ageCount + '인데 t.shape[0] 은 ' + totalRows +
        '이다. 두 값이 다른 이유는 무엇인가?',
      choices: [
        {
          label: 'Age 열에 결측값이 있어서 count() 가 결측을 빼고 세기 때문이다', correct: true,
          why: 'Age 열은 ' + totalRows + '행 중 ' + ageMissing + '개가 결측이라 count() 는 ' + ageCount +
            '만 센다. shape[0] 은 결측 여부와 상관없이 전체 행 수를 답한다.'
        },
        {
          label: 'count() 는 열(컬럼)의 개수를 센다', correct: false,
          why: 'count() 는 한 컬럼(Series) 안에서 결측이 아닌 값의 개수를 센다. 열의 개수가 아니다.'
        },
        {
          label: 'shape[0] 이 결측값을 자동으로 빼고 계산한 것이다', correct: false,
          why: 'shape[0] 은 결측과 무관하게 전체 행 수를 그대로 답한다. 결측을 빼고 세는 쪽은 count() 다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: "t.sort_values('Embarked') 로 정렬하면 결측값 " + embMissing + '건은 표의 어디에 나오는가? ' +
        '내림차순으로 바꾸면 위치가 바뀌는가?',
      choices: [
        {
          label: '항상 맨 뒤에 나온다. 오름차순·내림차순 어느 쪽으로 정렬해도 마찬가지다', correct: true,
          why: 'pandas 의 sort_values 기본값은 na_position="last" 다. ascending 을 True/False 어느 쪽으로 ' +
            '둬도 결측은 항상 맨 뒤에 몰린다. 맨 앞으로 보내려면 na_position="first" 를 따로 줘야 한다.'
        },
        {
          label: '오름차순이면 맨 뒤, 내림차순이면 맨 앞으로 바뀐다', correct: false,
          why: 'na_position 의 기본값은 정렬 방향과 무관하게 항상 "last" 다. ascending 을 바꿔도 결측 위치는 ' +
            '그대로 맨 뒤다.'
        },
        {
          label: '결측값이 있으면 sort_values 자체가 에러를 낸다', correct: false,
          why: '에러 없이 정상적으로 정렬된다. 결측값은 그냥 맨 뒤로 밀려날 뿐이다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: 'pd.Series([1,2,3,4]).std() 는 ' + UI.fmt(std1, 4) + '인데, np.std(np.array([1,2,3,4])) 는 ' +
        UI.fmt(std0, 4) + '로 값이 다르다. 왜 다른가?',
      choices: [
        {
          label: 'pandas 의 std() 기본값은 ddof=1(표본 표준편차), numpy 의 np.std() 기본값은 ddof=0(모표준편차)이라서 다르다',
          correct: true,
          why: '분산을 구할 때 나누는 값이 n-1(ddof=1)이냐 n(ddof=0)이냐가 달라서 결과가 다르다. ddof 를 ' +
            '서로 맞추면(s.std(0) 또는 np.std(arr, ddof=1)) 같은 값이 나온다.'
        },
        {
          label: 'numpy 계산이 틀렸다', correct: false,
          why: '둘 다 정확한 계산이다. 다만 자유도 보정값(ddof) 의 기본값이 서로 다를 뿐이다.'
        },
        {
          label: 'Series 와 array 는 담긴 값이 이미 다르기 때문이다', correct: false,
          why: '같은 [1,2,3,4] 네 값이다. 값이 아니라 표준편차를 구하는 공식의 기본 ddof 가 다른 것이 원인이다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: 't.corr() 를 문자열 컬럼(Name, Sex, Ticket, Cabin, Embarked 등)이 섞인 채로 그대로 부르면 ' +
        '무슨 일이 벌어지는가?',
      choices: [
        {
          label: 'ValueError 를 내며 계산이 멈춘다', correct: true,
          why: '문자열을 실수로 바꾸려다 실패해서(could not convert string to float) 전체 계산이 멈춘다. ' +
            'numeric_only=True 를 줘서 숫자 컬럼만 쓰겠다고 밝혀야 한다.'
        },
        {
          label: '문자열 컬럼을 조용히 빼고 숫자 컬럼끼리만 계산한다', correct: false,
          why: '예전 pandas 버전의 동작이다. 지금 버전은 숫자가 아닌 컬럼이 하나라도 섞여 있으면 에러를 내며 ' +
            '멈춘다. numeric_only=True 로 직접 밝혀야 한다.'
        },
        {
          label: '문자열도 어떻게든 숫자로 바꿔 계산을 끝까지 마친다', correct: false,
          why: '사람 이름 같은 문자열은 애초에 숫자로 바꿀 방법이 없다. pandas 는 시도했다가 실패하면 ' +
            '에러를 내고 멈춘다.'
        }
      ]
    }));

    return wrap;
  }
})();
