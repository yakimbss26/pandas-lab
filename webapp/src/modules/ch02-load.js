/* ch02-load.js — 2장. 데이터를 불러오고 첫눈에 파악하기
 *
 * 교재 2장(pandas.md 471~893줄)의 짝.
 * read_csv 로 얻은 DataFrame 을 열어 보지 않고 head/shape/dtypes/info/describe/value_counts 로
 * 첫인상을 파악하는 법을 다룬다. 이 파일이 대신 파일을 읽지는 않는다 —
 * LabData.frame() 이 이미 읽어 둔 DataFrame 을 그 자리에서 요약해 보여준다.
 *
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다. IIFE 로 감싼다.
 */
(function () {
  'use strict';

  var DATASET_NAMES = ['titanic', 'ramen', 'abalone', 'earthquake'];
  var DATASET_LABEL = { titanic: '타이타닉', ramen: '라멘 평점', abalone: '전복', earthquake: '지진' };

  Lab.register({
    id: 'ch02-load',
    num: 2,
    title: '데이터를 불러오고 첫눈에 파악하기',
    subtitle: 'head · shape · dtypes · info() · describe() · value_counts() 로 파일을 열지 않고 파악한다',

    render: function (root) {
      root.appendChild(simDashboard());
      root.appendChild(simDescribe());
      root.appendChild(simCategory());
      root.appendChild(quizSection());
    }
  });

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ①

  /* 데이터 첫인상 대시보드 — shape/info()/head(n) 를 데이터를 바꿔가며 본다. */
  function simDashboard() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 데이터 첫인상 대시보드' }));

    var current = 'titanic';
    var n = 5;
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(
      DATASET_NAMES.map(function (name) { return { label: DATASET_LABEL[name], value: name }; }),
      { label: '데이터', selected: 0, onChange: function (v) { current = v; rebuild(); } }
    ));
    var sliderRow = UI.slider({
      label: 'head(n) 의 n', min: 1, max: 10, value: n,
      onChange: function (v) { n = v; rebuild(); }
    });
    box.appendChild(sliderRow);
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame(current);
      var meta = LabData.sets[current];
      var rows = df.shape[0], cols = df.shape[1];

      body.appendChild(UI.note(
        meta.synthetic
          ? '이 데이터는 원본과 구조(행·열 수, 결측 개수, dtype)만 같고 값은 새로 만든 합성 데이터다.'
          : '이 데이터는 USGS 가 공개한 실제 지진 관측값이다(퍼블릭 도메인). 값을 그대로 쓴다.',
        meta.label
      ));

      body.appendChild(UI.note('df.shape = (' + rows + ', ' + cols + ')  ->  ' + rows + '행, ' + cols + '열'));

      // info() — 컬럼 / dtype / non-null / 결측 수
      var info = df.info();
      var infoRows = info.columns.map(function (c) {
        return { name: c.name, dtype: c.dtype, nonNull: c.nonNull, missing: rows - c.nonNull };
      });
      var missingCols = infoRows.filter(function (r) { return r.missing > 0; }).map(function (r) { return r.name; });
      var infoHl = [];
      infoRows.forEach(function (r, i) {
        if (r.missing > 0) {
          ['name', 'dtype', 'nonNull', 'missing'].forEach(function (k) { infoHl.push([i, k]); });
        }
      });

      body.appendChild(UI.el('div.panel-title', { text: 'df.info() — ' + info.indexDesc }));
      body.appendChild(UI.table([
        { key: 'name', label: '컬럼' },
        { key: 'dtype', label: 'dtype' },
        { key: 'nonNull', label: 'non-null' },
        { key: 'missing', label: '결측 수' }
      ], infoRows, { hlCells: infoHl }));

      body.appendChild(UI.note(
        missingCols.length
          ? '결측이 있는 컬럼: ' + missingCols.join(', ') + ' — 위 표에서 링(is-focus)으로 강조했다.'
          : '이 데이터에는 결측이 있는 컬럼이 없다.'
      ));

      // head(n) — 결측이 있는 컬럼은 head 표에서도 같은 방식으로 강조한다
      var headDf = df.head(n);
      var headHl = [];
      for (var i = 0; i < headDf.shape[0]; i++) {
        missingCols.forEach(function (col) { headHl.push([i, col]); });
      }
      body.appendChild(UI.el('div.panel-title', { text: 'df.head(' + n + ')' }));
      body.appendChild(UI.frameTable(headDf, { digits: 2, hlCells: headHl }));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ②

  /* describe() 해부기 — 8줄이 각각 무엇인지, std 의 ddof 가 무엇인지 본다. */
  function simDescribe() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② describe() 해부하기' }));
    box.appendChild(UI.note('titanic 데이터는 원본과 구조만 같은 합성 데이터다.'));

    var NUM_COLS = [
      { label: '나이 (Age)', value: 'Age' },
      { label: '요금 (Fare)', value: 'Fare' },
      { label: '좌석 등급 (Pclass)', value: 'Pclass' },
      { label: '형제자매/배우자 수 (SibSp)', value: 'SibSp' },
      { label: '부모/자녀 수 (Parch)', value: 'Parch' }
    ];
    var current = 'Age';
    var body = UI.el('div');

    box.appendChild(UI.buttonGroup(NUM_COLS, {
      label: '숫자 컬럼', selected: 0, onChange: function (v) { current = v; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('titanic');
      var s = df.col(current);
      var desc = s.describe();

      body.appendChild(UI.el('div.panel-title', { text: "df.col('" + current + "').describe()" }));
      body.appendChild(UI.seriesTable(desc, { digits: 4 }));

      var nums = s.toArray().filter(function (v) { return typeof v === 'number' && !isNaN(v); });
      var bins = s.nunique() <= 10 ? Math.max(1, s.nunique()) : 20;
      body.appendChild(UI.hist(s.toArray(), { title: current + ' 의 분포', bins: bins }));

      // describe() 의 사분위수가 히스토그램의 어느 구간인지 연결해 보여준다
      var lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
      var step = (hi - lo) / bins || 1;
      function binRange(v) {
        var k = Math.min(bins - 1, Math.floor((v - lo) / step));
        return UI.fmt(lo + k * step, 2) + ' ~ ' + UI.fmt(lo + (k + 1) * step, 2);
      }
      var q25 = s.quantile(0.25), q50 = s.median(), q75 = s.quantile(0.75);
      body.appendChild(UI.note(
        '25% 지점(' + UI.fmt(q25, 3) + ')은 히스토그램의 ' + binRange(q25) + ' 구간에, ' +
        '중앙값 50%(' + UI.fmt(q50, 3) + ')는 ' + binRange(q50) + ' 구간에, ' +
        '75% 지점(' + UI.fmt(q75, 3) + ')은 ' + binRange(q75) + ' 구간에 있다.'
      ));

      // ★ std 는 ddof=1 이 pandas 기본이다. numpy 의 np.std 기본값(ddof=0)과 다르다.
      var std1 = s.std();
      var std0 = s.std(0);
      body.appendChild(UI.el('div.panel-title', { text: 'std 는 ddof 에 따라 달라진다' }));
      body.appendChild(UI.table([
        { key: 'which', label: '호출' },
        { key: 'value', label: '표준편차', digits: 6 }
      ], [
        { which: 's.std()  — ddof=1 (pandas 기본, 표본 표준편차)', value: std1 },
        { which: 's.std(0) — ddof=0 (numpy 의 np.std 기본값)', value: std0 }
      ], {}));
      body.appendChild(UI.note(
        'describe() 의 std 행은 s.std() 와 같은 값(ddof=1)이다. numpy 의 np.std 는 기본값이 ddof=0 이라 ' +
        's.std(0) 과 같은, 조금 더 작은 값을 준다. 같은 이야기가 교재 10장에서 다시 나온다.'
      ));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 시뮬레이터 ③

  /* 범주 확인기 — ramen.Country 로 'USA'/'United States' 분리 문제를 직접 본다. */
  function simCategory() {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: "시뮬레이터 ③ 범주 확인기 — ramen['Country']" }));
    box.appendChild(UI.note('ramen 데이터는 원본과 구조만 같은 합성 데이터라 개수는 교재와 다를 수 있다.'));

    var includeNA = false; // dropna=False 를 켰는가
    var body = UI.el('div');

    box.appendChild(UI.toggle({
      label: '결측도 세기 (dropna=False)', value: includeNA,
      onChange: function (on) { includeNA = on; rebuild(); }
    }));
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var df = LabData.frame('ramen');
      var country = df.col('Country');
      var vc = country.valueCounts({ dropna: !includeNA });

      body.appendChild(UI.note(
        "nunique() = " + country.nunique() + " — Country 열에는 서로 다른 문자열이 이만큼 있다는 뜻이다."
      ));

      var usaPos = vc.index.positions('USA');
      var usPos = vc.index.positions('United States');
      if (usaPos.length && usPos.length) {
        var usaCount = vc.at(usaPos[0]), usCount = vc.at(usPos[0]);
        body.appendChild(UI.danger('같은 나라, 다른 이름',
          "'USA' 는 " + usaCount + '건, ' + "'United States' 는 " + usCount + '건으로 따로 세어진다. ' +
          '실제로는 같은 나라의 데이터 ' + (usaCount + usCount) + '건인데 문자열이 달라 두 그룹으로 쪼개진다.'));
      }

      var items = [];
      for (var i = 0; i < Math.min(10, vc.length()); i++) {
        items.push({ label: vc.index.at(i) === null ? 'NaN' : String(vc.index.at(i)), value: vc.at(i) });
      }
      body.appendChild(UI.bar(items, { title: '상위 ' + items.length + '개국 — value_counts()', labelHeader: '국가', valueHeader: '건수' }));

      var hl = [];
      for (var j = 0; j < vc.length(); j++) {
        var lbl = vc.index.at(j);
        if (lbl === 'USA' || lbl === 'United States') { hl.push([j, 'idx']); hl.push([j, 'val']); }
      }
      body.appendChild(UI.el('div.panel-title', { text: '전체 value_counts()' }));
      body.appendChild(UI.seriesTable(vc, { hlCells: hl }));

      var styleMissing = df.col('Style').length() - df.col('Style').count();
      body.appendChild(UI.note(
        'Country 열에는 결측이 없다(count = ' + country.count() + ' / ' + country.length() + '). ' +
        '그래서 dropna 토글이 이 열의 결과를 바꾸지 않는다. 결측이 있는 열(Style, 결측 ' + styleMissing +
        '건)에서는 dropna=False 를 켜야 NaN 항목이 드러난다.'
      ));
    }

    rebuild();
    return box;
  }

  // ──────────────────────────────────────────────────────────── 확인 문제

  function quizSection() {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: '확인 문제' }));

    var titanic = LabData.frame('titanic');
    var ageCount = titanic.col('Age').count();
    var totalRows = titanic.shape[0];
    var embarkedMissing = titanic.col('Embarked').length() - titanic.col('Embarked').count();

    var ramen = LabData.frame('ramen');
    var country = ramen.col('Country');
    var nunique = country.nunique();
    var vc = country.valueCounts();
    var usaPos = vc.index.positions('USA');
    var usPos = vc.index.positions('United States');
    var usaCount = usaPos.length ? vc.at(usaPos[0]) : 0;
    var usCount = usPos.length ? vc.at(usPos[0]) : 0;

    wrap.appendChild(UI.quiz({
      question: "titanic 데이터에서 df.col('Age').count() 는 " + ageCount +
        '인데 df.shape[0] 은 ' + totalRows + '이다. 왜 두 값이 다른가?',
      choices: [
        {
          label: 'Age 열에 결측값이 있어서 count() 가 결측을 빼고 세기 때문이다', correct: true,
          why: 'Age 열은 ' + totalRows + '행 중 ' + (totalRows - ageCount) + '개가 결측이라 count() 는 ' +
            ageCount + '만 센다. shape[0] 은 결측 여부와 상관없이 전체 행 수다.'
        },
        {
          label: 'count() 는 열(컬럼)의 개수를 센다', correct: false,
          why: 'count() 는 한 컬럼(Series) 안에서 결측이 아닌 값의 개수를 센다. 열의 개수가 아니다.'
        },
        {
          label: '두 값은 원래 같아야 하는데 계산이 잘못됐다', correct: false,
          why: '계산은 정상이다. count() 와 shape[0] 이 다른 것은 버그가 아니라 결측값이 있다는 신호다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: 't.describe 를 괄호 없이 실행하면 어떤 일이 벌어지는가?',
      choices: [
        {
          label: '통계표 대신 "이 메서드를 가리키는 객체" 가 출력된다', correct: true,
          why: 'describe 는 메서드이므로 반드시 () 를 붙여야 실행된다. 괄호를 빼면 <bound method ...> 같은 객체가 나온다.'
        },
        {
          label: '에러가 발생하며 즉시 멈춘다', correct: false,
          why: '에러도 경고도 없이 조용히 다른 것(메서드 객체)이 출력된다. 그래서 더 위험하다.'
        },
        {
          label: 'describe() 와 완전히 같은 표가 나온다', correct: false,
          why: '괄호가 없으면 함수가 호출되지 않는다. 통계표가 아니라 메서드 자체를 가리키는 객체가 나온다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: 'value_counts() 의 기본값(dropna=True)으로 Embarked 열을 세면, 실제로 있는 결측 ' +
        embarkedMissing + '건은 결과에서 어떻게 되는가?',
      choices: [
        {
          label: '세지 않는다 — 결과에 아예 나타나지 않는다', correct: true,
          why: 'value_counts() 의 기본은 dropna=True 라서 결측은 처음부터 세지 않는다. dropna=False 를 줘야 ' +
            'NaN 이 ' + embarkedMissing + '건 있다는 게 드러난다.'
        },
        {
          label: 'NaN 이라는 이름의 항목으로 결과 맨 위에 나온다', correct: false,
          why: '기본값에서는 아예 나타나지 않는다. dropna=False 를 줘야 NaN 항목이 보이며, 위치도 개수 순서에 따른다.'
        },
        {
          label: '에러가 난다', correct: false,
          why: '에러 없이 조용히 빠진다. 그래서 기본값만 보고 "결측이 없다" 고 착각하기 쉽다.'
        }
      ]
    }));

    wrap.appendChild(UI.quiz({
      question: 'ramen 데이터의 Country 열에 nunique() 를 실행하면 ' + nunique + '가 나온다. 그런데 ' +
        "'USA'(" + usaCount + '건)와 ' + "'United States'(" + usCount + '건)는 사실 같은 나라다. ' +
        '이 상태로 나라별 통계를 내면 무슨 일이 생기는가?',
      choices: [
        {
          label: '같은 나라의 데이터가 두 그룹으로 쪼개진다', correct: true,
          why: '실제로는 ' + (usaCount + usCount) + '건의 같은 나라 데이터인데, 문자열이 다르다는 이유로 ' +
            usaCount + '건짜리와 ' + usCount + '건짜리 두 그룹으로 나뉜다.'
        },
        {
          label: 'pandas 가 알아서 같은 나라로 합쳐준다', correct: false,
          why: "pandas 는 문자열을 있는 그대로 비교한다. 'USA' 와 'United States' 는 전혀 다른 문자열이라 자동으로 합쳐지지 않는다."
        },
        {
          label: 'nunique() 결과가 잘못 계산된 것이다', correct: false,
          why: '계산은 정확하다. 열에 서로 다른 문자열이 ' + nunique + '가지 있다는 뜻이다. 문제는 그중 두 개가 사람 눈에는 같은 나라라는 점이다.'
        }
      ]
    }));

    return wrap;
  }
})();
