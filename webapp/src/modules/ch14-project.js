/* ch14-project.js — 14장. 종합 실습 — 지진 데이터부터 머신러닝까지
 *
 * 교재 14장(pandas.md 5442~6006줄)의 짝. 새 pandas 문법은 나오지 않는다 — 1~13장의 도구를
 * 지진(earthquake) 데이터와 전복(abalone) 데이터에 모아 쓰는 장이다.
 *
 * earthquake 는 이 프로젝트 전체에서 유일한 실데이터다(USGS, 미국 정부 저작물 = 퍼블릭 도메인).
 * abalone 은 구조(행 수, 결측 개수, dtype)만 원본과 같은 합성 데이터이고, 컬럼 이름은 원본처럼
 * 한글이다(길이·직경·두께·전체무게·내장무게·껍질무게·나이테·순살무게). 두 사실 모두 화면에 밝힌다.
 *
 * 이 장의 심장은 "모델에 넣기 전에 확인할 것 세 가지" 다. 엔진에는 sklearn 이 없으므로
 *   ① 결측     — df.setLoc 로 한 칸을 실제로 비우고 isna().sum() 이 바뀌는 것을 보여준다.
 *   ② dtype    — Series.toNumeric() 이 문자열 컬럼에서 실제로 예외를 던지는 것을 try/catch 로 잡는다.
 *   ③ 데이터 누수 — 엔진에 회귀가 없으므로 단순 선형회귀(b=cov/var, a=mean(y)-b*mean(x), R²=corr²)를
 *     직접 계산한다. abalone 실제 값으로 scikit-learn 1.9.0 의 LinearRegression().score() 와
 *     8개 입력 열 전부 대조해 소수 10자리까지 일치를 확인했다(스크래치패드 reg_check.js/.py).
 * 를 실제로 재현한다. 화면의 숫자는 전부 DF 엔진이 LabData.frame(...) 을 그 자리에서 계산한
 * 값이다 — 손으로 적은 숫자는 없다.
 *
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다. IIFE 로 감싼다.
 */
(function () {
  'use strict';

  var DESC_COLS = [
    { label: '위도 (latitude)', value: 'latitude' },
    { label: '경도 (longitude)', value: 'longitude' },
    { label: '깊이 (depth)', value: 'depth' },
    { label: '규모 (mag)', value: 'mag' }
  ];

  var DTYPE_CHECK_COLS = [
    { label: 'mag — 숫자', value: 'mag' },
    { label: 'depth — 숫자', value: 'depth' },
    { label: 'magType — 문자열', value: 'magType' },
    { label: 'place — 문자열', value: 'place' }
  ];

  var X_CANDIDATES = [
    { label: '길이', value: '길이' },
    { label: '직경', value: '직경' },
    { label: '두께', value: '두께' },
    { label: '전체무게', value: '전체무게' },
    { label: '내장무게', value: '내장무게' },
    { label: '껍질무게', value: '껍질무게' },
    { label: '나이테', value: '나이테' },
    { label: '순살무게 (예측 대상 자신 — 누수)', value: '순살무게' }
  ];

  Lab.register({
    id: 'ch14-project',
    num: 14,
    title: '종합 실습 — 지진 데이터부터 머신러닝까지',
    subtitle: '13개 장의 도구를 지진 데이터로 모아 쓰고, 모델에 넣기 전 결측·dtype·데이터 누수를 확인한다',

    render: function (root) {
      root.appendChild(simDashboard());
      root.appendChild(simDistribution());
      root.appendChild(simMLChecklist());
      root.appendChild(simSummary());
      root.appendChild(quizSection());
    }
  });

  // ──────────────────────────────────────────────────────────── 단순 선형회귀

  /* 엔진에 회귀가 없으므로 한 변수 최소제곱을 직접 구현한다.
   *   b = cov(x,y) / var(x),  a = mean(y) - b * mean(x),  R² = corr(x,y)²
   * scikit-learn 1.9.0 의 LinearRegression().fit(X,y).score(X,y) 와 abalone 전체 값으로
   * 8개 컬럼 전부 대조해 소수 10자리까지 일치를 확인했다(스크래치패드 reg_check.js/.py). */
  function simpleLinReg(x, y) {
    var n = x.length;
    var mx = 0, my = 0;
    for (var i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n; my /= n;
    var covxy = 0, varx = 0, vary = 0;
    for (var j = 0; j < n; j++) {
      var dx = x[j] - mx, dy = y[j] - my;
      covxy += dx * dy; varx += dx * dx; vary += dy * dy;
    }
    covxy /= n; varx /= n; vary /= n;
    var b = covxy / varx;
    var a = my - b * mx;
    var r = covxy / Math.sqrt(varx * vary);
    return { a: a, b: b, r2: r * r, n: n };
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ①

  /* 지진 데이터 탐색 대시보드. 교재 14.2~14.8절을 한 화면에 모은다.
   * 각 부분 제목에 어느 장에서 배운 도구인지 적어 둔다. */
  function simDashboard() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 지진 데이터 탐색 대시보드' }));
    box.appendChild(UI.note(
      'lab_earthquake 데이터는 미국 지질조사국(USGS)이 2020년 1~2월에 실제로 관측한 규모 4.5 이상 ' +
      '지진 기록이다. 미국 연방정부 저작물이라 퍼블릭 도메인이며, 이 프로젝트에서 유일하게 실제 값을 ' +
      '그대로 쓰는 데이터다(다른 장의 titanic·ramen·abalone 은 구조만 같은 합성 데이터다).'
    ));

    var descCol = 'mag';
    var threshold = 6;
    var body = UI.el('div');
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var eq = LabData.frame('earthquake');

      // ── shape · 결측 (2장, 8장) ──────────────────────────────
      body.appendChild(UI.el('div.panel-title', { text: '① shape 와 결측 확인 — read_csv, isna().sum() (2장, 8장)' }));
      body.appendChild(UI.note(
        'eq.shape = [' + eq.shape[0] + ', ' + eq.shape[1] + '],  columns = ' + eq.columns.join(', ')
      ));
      var na = eq.isna().sum();
      var missing = [];
      eq.columns.forEach(function (c) { if (na.loc(c) > 0) missing.push(c + ': ' + na.loc(c) + '건'); });
      body.appendChild(missing.length
        ? UI.danger('결측 있는 컬럼', missing.join(', '))
        : UI.note(
            'isna().sum() 결과 이 ' + eq.shape[1] + '개 열에는 결측이 없다. 원본 USGS 파일(22열)에는 ' +
            '관측 정확도와 관련된 부가 열도 있었고 그중 일부는 결측이 많았지만(교재 14.3절 참고), 이 ' +
            '실습 데이터에는 분석에 바로 쓰는 핵심 열만 남겼다.'
          ));

      // ── describe (2장, 10장) ────────────────────────────────
      body.appendChild(UI.el('div.panel-title', { text: '② 통계로 요약 — describe() (2장, 10장)' }));
      body.appendChild(UI.buttonGroup(DESC_COLS, {
        label: '컬럼', selected: descColIndex(descCol), onChange: function (v) { descCol = v; rebuild(); }
      }));
      body.appendChild(UI.seriesTable(eq.col(descCol).describe(), { digits: 4 }));

      // ── sort_values top10 (10장) ────────────────────────────
      body.appendChild(UI.el('div.panel-title', { text: '③ 강도 top 10 — sort_values(...).head(10) (10장)' }));
      var top10 = eq.sortValues('mag', { ascending: false }).head(10);
      body.appendChild(UI.frameTable(top10.cols(['place', 'mag']), { digits: 1 }));
      body.appendChild(UI.note(
        '왼쪽 열의 숫자(맨 위 표의 인덱스)는 순서가 아니라 그 행이 원래 갖고 있던 인덱스 라벨이다 — ' +
        '정렬은 순서만 바꿀 뿐 인덱스는 값을 따라간다(5장·10장).'
      ));

      // ── place -> country (9장) ──────────────────────────────
      body.appendChild(UI.el('div.panel-title', { text: '④ place 에서 국가/주 뽑기 — map (9장)' }));
      var country = eq.col('place').map(function (s) { return String(s).split(',').pop().trim(); });
      eq.setCol('country', country);
      body.appendChild(UI.frameTable(eq.cols(['place', 'country']).head(5)));

      // ── value_counts top5 (10장, 11장) ──────────────────────
      body.appendChild(UI.el('div.panel-title', { text: '⑤ 지진이 많은 나라 top 5 — value_counts (10장, 11장)' }));
      var vc = country.valueCounts();
      var items = [];
      for (var i = 0; i < Math.min(5, vc.length()); i++) items.push({ label: vc.labels()[i], value: vc.at(i) });
      body.appendChild(UI.bar(items, { title: '국가별 지진 건수 top 5', labelHeader: '국가', valueHeader: '건수' }));
      body.appendChild(UI.note(
        items[0].label + '가 ' + items[0].value + '건으로 가장 많다. 여러 판이 만나는 환태평양 조산대 ' +
        '(불의 고리, Ring of Fire)에 걸쳐 있어 지진이 잦은 것으로 잘 알려진 나라다.'
      ));

      // ── 5장: mask + 슬라이더 ────────────────────────────────
      body.appendChild(UI.el('div.panel-title', { text: '⑥ 강도 기준으로 골라내기 — mask (5장)' }));
      var magMin = eq.col('mag').min(), magMax = eq.col('mag').max();
      body.appendChild(UI.slider({
        label: 'mag 기준', min: magMin, max: magMax, step: 0.1, value: threshold,
        onChange: function (v) { threshold = v; rebuild(); }
      }));
      var strong = eq.mask(eq.col('mag').gt(threshold));
      body.appendChild(UI.note(
        'mag > ' + UI.fmt(threshold, 1) + ' 인 지진은 전체 ' + eq.shape[0] + '건 중 ' + strong.shape[0] + '건이다.'
      ));
      if (strong.shape[0] > 0) body.appendChild(UI.frameTable(strong.cols(['place', 'mag']), { digits: 1, maxRows: 10 }));
    }

    function descColIndex(col) {
      for (var i = 0; i < DESC_COLS.length; i++) if (DESC_COLS[i].value === col) return i;
      return 0;
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ②

  /* 규모 분포 히스토그램 + 위경도 산점도. 계열은 규모 3구간으로 나눠 3개까지만 쓴다. */
  function simDistribution() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 규모 분포 + 위치 산점도 (14.8절, matplotlib)' }));

    var eq = LabData.frame('earthquake');
    var mags = eq.col('mag').toArray();
    box.appendChild(UI.hist(mags, { title: 'mag(규모) 분포', bins: 30 }));

    var q75 = eq.col('mag').quantile(0.75), magMax = eq.col('mag').max();
    box.appendChild(UI.note(
      '75% 지점이 ' + UI.fmt(q75, 2) + '이고 최댓값은 ' + UI.fmt(magMax, 1) +
      '이다 — 규모 낮은 지진이 압도적으로 많고 규모가 커질수록 급격히 드물어진다(14.4절 describe() 의 ' +
      '75% 값과 같은 이야기를 그림으로 다시 본 것이다).'
    ));

    var lat = eq.col('latitude').toArray();
    var lon = eq.col('longitude').toArray();
    var buckets = [
      { name: '규모 4.5~5', points: [] },
      { name: '규모 5~6', points: [] },
      { name: '규모 6 이상', points: [] }
    ];
    for (var i = 0; i < mags.length; i++) {
      var k = mags[i] < 5 ? 0 : mags[i] < 6 ? 1 : 2;
      buckets[k].points.push([lon[i], lat[i]]);
    }
    box.appendChild(UI.scatter(buckets, {
      title: '위경도 산점도 — x: 경도(longitude), y: 위도(latitude)',
      xLabel: '경도', yLabel: '위도'
    }));

    var country = eq.col('place').map(function (s) { return String(s).split(',').pop().trim(); });
    var vc = country.valueCounts();
    box.appendChild(UI.note(
      '점들이 고르게 퍼지지 않고 몇 개의 세로띠 모양으로 몰려 있다 — 태평양을 둘러싼 판의 경계(환태평양 ' +
      '조산대)를 따라 지진이 몰린다는 지질학적 사실이 좌표로 그대로 드러난다. 실제로 이 데이터에서 지진이 ' +
      '가장 많은 나라는 ' + vc.labels()[0] + '(' + vc.at(0) + '건)로, 환태평양 조산대에 걸쳐 있다.'
    ));

    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ③

  /* ★ 모델에 넣기 전에 확인할 것 세 가지 — 이 장의 심장(교재 14.13절). */
  function simMLChecklist() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ ★ 모델에 넣기 전에 확인할 것 세 가지' }));
    box.appendChild(UI.note(
      'abalone(전복) 데이터로 순살무게(껍질을 깐 살코기 무게)를 예측한다. 이 abalone.csv 는 구조(행 수, ' +
      '결측 개수, dtype)만 원본과 같은 합성 데이터다 — 컬럼 이름만 원본처럼 한글이다(길이·직경·두께· ' +
      '전체무게·내장무게·껍질무게·나이테·순살무게).'
    ));
    var abIntro = LabData.frame('abalone');
    var X0 = abIntro.drop('순살무게', { axis: 1 });
    var y0 = abIntro.col('순살무게');
    box.appendChild(UI.note(
      "X = df.drop('순살무게', axis=1) 은 " + X0.shape[0] + ' × ' + X0.shape[1] + ' DataFrame, ' +
      "y = df['순살무게'] 는 길이 " + y0.length() + '짜리 Series다(4장·5장) — 이 나누기는 사이킷런이 아니라 ' +
      'pandas 의 일이다.'
    ));

    box.appendChild(checkMissing());
    box.appendChild(checkDtype());
    box.appendChild(checkLeak());
    return box;
  }

  /* ① 결측이 남아 있는가 */
  function checkMissing() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: '① 결측이 남아 있는가 — isna().sum() (8장)' }));
    var injected = false;
    var body = UI.el('div');
    wrap.appendChild(UI.toggle({
      label: '한 칸에 결측 주입해 보기 (X_train.iloc[0,0] = NaN)', value: injected,
      onChange: function (on) { injected = on; rebuild(); }
    }));
    wrap.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var ab = LabData.frame('abalone');
      if (injected) ab.setLoc(ab.index.at(0), '전체무게', NaN);
      var totalNA = ab.isna().sum().toArray().reduce(function (s, v) { return s + v; }, 0);
      body.appendChild(UI.note(
        "ab.isna().sum().sum() = " + totalNA +
        (injected ? ' — 방금 첫 행의 전체무게 한 칸을 NaN 으로 바꿨다.' : ' — 지금은 결측이 없어 안전하다.')
      ));
      if (totalNA > 0) {
        body.appendChild(UI.danger(
          'sklearn 은 결측을 받아들이지 않는다',
          '이 상태로 LinearRegression().fit(X, y) 를 부르면 다음 예외가 난다: "ValueError: Input X ' +
          'contains NaN. LinearRegression does not accept missing values encoded as NaN natively. ..." ' +
          '8장에서 배운 fillna 나 dropna 로 결측을 먼저 정리해야 이 단계를 통과한다.'
        ));
      } else {
        body.appendChild(UI.note('위 토글을 켜서 결측을 하나 주입하면 sklearn 이 어떻게 반응하는지 볼 수 있다.'));
      }
    }
    rebuild();
    return wrap;
  }

  /* ② dtype이 전부 숫자인가 */
  function checkDtype() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: 'dtype 이 전부 숫자인가 — toNumeric() (9장)' }));
    var col = 'magType';
    var body = UI.el('div');
    wrap.appendChild(UI.buttonGroup(DTYPE_CHECK_COLS, {
      label: '컬럼 고르기', selected: 2, onChange: function (v) { col = v; rebuild(); }
    }));
    wrap.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var eq = LabData.frame('earthquake');
      var s = eq.col(col);
      body.appendChild(UI.note("eq.col('" + col + "').dtype = '" + s.dtype + "'"));
      try {
        var converted = s.toNumeric();
        body.appendChild(UI.note(
          "toNumeric() 이 문제없이 끝났다. 변환된 첫 값: " + UI.fmt(converted.at(0), 4) +
          ' — 이 컬럼은 그대로 회귀에 넣어도 안전하다.'
        ));
      } catch (e) {
        body.appendChild(UI.danger(
          '숫자로 바꿀 수 없다',
          e.message + '  ' + col + ' 열의 값이 문자열이라 실수로 바꿀 방법이 없어서 엔진이 그 자리에서 ' +
          '멈춘 것이다(재현: sklearn 의 LinearRegression() 도 문자열 컬럼을 만나면 "could not convert ' +
          'string to float" 로 똑같이 멈춘다 — 교재 14.13절 ②).'
        ));
      }
    }
    rebuild();
    return wrap;
  }

  /* ③ ★ 데이터 누수 — 이 장의 가장 인상적인 시연 */
  function checkLeak() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', {
      text: '★★ 예측할 값이 입력에 섞여 있지 않은가 — 데이터 누수 (14.13절 ③)'
    }));
    var xCol = '전체무게';
    var body = UI.el('div');
    wrap.appendChild(UI.buttonGroup(X_CANDIDATES, {
      label: 'X 로 쓸 컬럼 하나 (단순 선형회귀라 하나씩 시험한다)', selected: 3,
      onChange: function (v) { xCol = v; rebuild(); }
    }));
    wrap.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var ab = LabData.frame('abalone');
      var x = ab.col(xCol).toArray();
      var y = ab.col('순살무게').toArray();
      var res = simpleLinReg(x, y);

      body.appendChild(UI.el('div.panel-title', {
        text: '순살무게 ≈ ' + UI.fmt(res.a, 4) + ' + ' + UI.fmt(res.b, 4) + ' × ' + xCol
      }));
      body.appendChild(UI.table([
        { key: 'k', label: '값' },
        { key: 'v', label: '계산 결과', digits: 6 }
      ], [
        { k: '절편 a (mean(y) - b·mean(x))', v: res.a },
        { k: '기울기 b (cov(x,y) / var(x))', v: res.b },
        { k: 'R² (corr(x,y)²)', v: res.r2 },
        { k: '쓰인 행 수', v: res.n }
      ]));

      if (xCol === '순살무게') {
        body.appendChild(UI.danger(
          '데이터 누수 (data leakage)',
          'X 에 예측 대상인 순살무게 자신을 그대로 넣었다. R² = ' + UI.fmt(res.r2, 6) + ' — 정확히 1에 ' +
          '붙는다. 모델이 정답을 맞힌 게 아니라 그 열에 계수 1을 곱하는 것만으로 완벽한 답을 낸 것이다. ' +
          '실전에서는 열 이름이 이렇게 뻔하지 않으므로, R² 가 의심스러울 만큼 1에 가깝게 나오면 가장 먼저 ' +
          '입력 열 목록에 예측 대상이나 그 파생값이 섞여 있지 않은지 확인해야 한다.'
        ));
      } else {
        body.appendChild(UI.note(
          xCol + ' 하나만으로도 R² = ' + UI.fmt(res.r2, 4) + ' 로 순살무게 변화의 상당 부분을 설명한다. ' +
          '그래도 1.0 에는 못 미친다 — 위 버튼에서 "순살무게(누수)" 를 골라 무엇이 다른지 비교해 보라.'
        ));
      }

      // 산점도 — 실제 값(샘플)과 회귀선을 겹쳐 보여준다. 계열은 2개.
      var n = x.length;
      var step = Math.max(1, Math.floor(n / 200));
      var sampleIdx = [];
      for (var i = 0; i < n; i += step) sampleIdx.push(i);
      var actualPts = sampleIdx.map(function (idx) { return [x[idx], y[idx]]; });
      var lineXs = actualPts.map(function (p) { return p[0]; }).slice().sort(function (a, b) { return a - b; });
      var linePts = lineXs.map(function (xi) { return [xi, res.a + res.b * xi]; });
      body.appendChild(UI.note(
        '산점도에는 ' + n + '마리 중 ' + actualPts.length + '마리만 골라 그렸다(화면이 빽빽해지지 않게). ' +
        'a, b, R² 값 자체는 ' + n + '마리 전체로 계산한 값이다.'
      ));
      body.appendChild(UI.scatter([
        { name: '실제 값 (샘플)', points: actualPts },
        { name: '회귀선(예측값)', points: linePts }
      ], { title: xCol + ' 로 순살무게 예측', xLabel: xCol, yLabel: '순살무게' }));
    }
    rebuild();
    return wrap;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ④

  /* 배운 것 한 장 정리 — 장 목록은 Lab.chapters() 로 엔진에서 읽는다. 손으로 적지 않는다. */
  function simSummary() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ 배운 것 한 장 정리' }));

    var chapters = Lab.chapters()
      .filter(function (c) { return c.num !== 14; })
      .slice()
      .sort(function (a, b) { return a.num - b.num; });

    var rows = chapters.map(function (c) {
      return { num: c.num, title: c.title, subtitle: c.subtitle || '' };
    });
    box.appendChild(UI.table([
      { key: 'num', label: '장' },
      { key: 'title', label: '개념' },
      { key: 'subtitle', label: '한 줄 요약' }
    ], rows));

    box.appendChild(UI.note('이 표의 num · title · 한 줄 요약은 전부 Lab.chapters() 로 각 장이 스스로 등록한 값을 읽은 것이다.'));
    box.appendChild(UI.buttonGroup(
      chapters.map(function (c) { return { label: c.num + '장 · ' + c.title, value: c.id }; }),
      { label: '그 장으로 이동', selected: 0, onChange: function (id) { Lab.go(id); } }
    ));
    return box;
  }

  // ──────────────────────────────────────────────────────────── 확인 문제

  function quizSection() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: '확인 문제' }));

    var eq = LabData.frame('earthquake');
    var strong = eq.mask(eq.col('mag').gt(6));
    var abForLeak = LabData.frame('abalone');
    var xLeak = abForLeak.col('순살무게').toArray();
    var yLeak = abForLeak.col('순살무게').toArray();
    var leakRes = simpleLinReg(xLeak, yLeak);

    wrap.appendChild(UI.quiz({
      question: "strong = eq.mask(eq.col('mag').gt(6)) 로 강한 지진만 뽑아 새 프레임을 만든 뒤, " +
        "strong 의 값을 바꾸면 원본 eq 도 함께 바뀌는가?",
      choices: [
        {
          label: '아니다. mask() 는 항상 새 블록을 복사하므로 strong 을 바꿔도 eq 는 그대로다', correct: true,
          why: '7장에서 본 대로 mask()(불린 인덱싱)와 take() 는 항상 복사를 만든다. head()/islice() 같은 ' +
            '슬라이싱만 메모리를 공유한다 — 두 연산이 겉보기엔 비슷해 보여도 메모리 동작은 정반대다.'
        },
        {
          label: '그렇다. mask() 도 슬라이스처럼 메모리를 공유한다', correct: false,
          why: 'mask()(불린 조건)는 슬라이싱과 달리 항상 새 블록을 만든다. 슬라이싱(head, islice)만 공유한다.'
        },
        {
          label: '뽑힌 행 수가 원본의 절반을 넘으면 공유하고, 아니면 복사한다', correct: false,
          why: '행 수와 무관하다. mask() 는 조건 결과와 상관없이 항상 복사를, 슬라이싱은 항상 공유를 한다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: 'abalone 데이터의 학습용 입력(X_train) 한 칸을 df.setLoc(...) 로 NaN 으로 바꾼 뒤 ' +
        'LinearRegression().fit(X_train, y_train) 을 그대로 부르면 무슨 일이 일어나는가?',
      choices: [
        {
          label: 'ValueError 가 나며 학습이 시작되지도 못한다', correct: true,
          why: '사이킷런의 LinearRegression 은 NaN 을 만나면 "Input X contains NaN" 이라는 예외를 내며 ' +
            '그 자리에서 멈춘다. 8장에서 배운 fillna/dropna 로 결측을 먼저 정리해야 통과한다.'
        },
        {
          label: '결측이 있는 행만 자동으로 건너뛰고 학습이 끝까지 된다', correct: false,
          why: 'LinearRegression 은 결측을 자동으로 건너뛰지 않는다. 에러 없이 넘어가려면 미리 fillna 나 ' +
            'dropna 로 직접 정리해야 한다.'
        },
        {
          label: '결측을 0으로 자동으로 채우고 경고만 낸다', correct: false,
          why: '경고로 끝나지 않는다. NaN 을 스스로 처리하지 않는 모델(LinearRegression)은 예외를 내며 ' +
            '멈춘다. 경고만 내고 넘어가는 것은 이 장의 사례가 아니라 pandas 3.0 의 ChainedAssignmentError 쪽이다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: "eq.col('magType').toNumeric() 을 실행하면 무슨 일이 일어나는가? 원인은 무엇인가?",
      choices: [
        {
          label: 'ValueError 가 난다. magType 의 값이 문자열이라 숫자로 바꿀 방법이 없기 때문이다', correct: true,
          why: 'magType 은 dtype 이 str 인 컬럼이다. 문자열을 실수로 바꾸려는 시도가 실패하면 엔진은 ' +
            '"Unable to parse string" 예외를 던진다 — sklearn 이 "could not convert string to float" 로 ' +
            '멈추는 것과 같은 자리의 문제다.'
        },
        {
          label: '숫자로 바꿀 수 없는 값은 조용히 NaN 이 되고 나머지는 정상 변환된다', correct: false,
          why: '그렇게 동작하려면 toNumeric("coerce") 처럼 errors 를 직접 지정해야 한다. 기본값은 ' +
            '"raise" 라서 실패하면 예외를 던지고 멈춘다.'
        },
        {
          label: '아무 일도 일어나지 않고 원래 문자열이 그대로 반환된다', correct: false,
          why: 'toNumeric() 은 항상 숫자 Series 를 만들려고 시도한다. 실패하면(기본값 기준) 예외를 던지지, ' +
            '원래 값을 그대로 돌려주지 않는다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: '전복 데이터에서 순살무게를 예측하는 회귀에 X 로 순살무게 자기 자신을 넣으면 R² 는 ' +
        '얼마가 되며, 왜 그런 값이 나오는가?',
      choices: [
        {
          label: '정확히 1.0 이 된다. 모델이 정답을 그대로 베꼈기 때문이다', correct: true,
          why: '실제로 계산해 보면 R² = ' + UI.fmt(leakRes.r2, 6) + '이다. 예측 대상 자신이 입력에 들어 ' +
            '있으면 그 열에 계수 1을 곱하는 것만으로 완벽한 답을 낼 수 있다. 이런 상황을 데이터 누수 ' +
            '(data leakage)라고 부른다.'
        },
        {
          label: '오히려 0에 가까워진다. 같은 값을 두 번 쓰면 모델이 혼란스러워지기 때문이다', correct: false,
          why: '반대다. 예측 대상을 입력에 그대로 넣으면 R² 는 오히려 완벽한 값(1.0)에 붙는다 — 모델이 ' +
            '잘한 게 아니라 답을 베낀 것이라 문제다.'
        },
        {
          label: '입력과 출력이 같은 열이라 계산 자체가 에러를 내며 멈춘다', correct: false,
          why: '에러도 경고도 나지 않는다. 그래서 더 위험하다 — 코드는 끝까지 돌고 R² 만 의심스럽게 ' +
            '완벽해진다. 이 장이 "R² 가 1에 너무 가까우면 입력 열부터 의심하라"고 가르치는 이유다.'
        }
      ]
    }));

    return wrap;
  }
})();
