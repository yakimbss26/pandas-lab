/* v6-eda.js — V6장. EDA 실습: 부산 강수량 118년 (2부)
 * 지금까지 배운 것(문자열·날짜, melt/pivot_table, matplotlib, seaborn)을 혼자 써서 처음 보는
 * 자료를 끝까지 탐색한다. 이 장의 핵심 판단은 "결측 63.8%가 무엇을 뜻하는가"이고, 그 판단에
 * 따라 합계·평균 같은 값이 실제로 어떻게 갈라지는지 데이터로 확인한다. IIFE 로 감싸고, render 는
 * 여러 번 호출되므로 가변 상태는 전부 render 안의 지역 변수 + rebuild() 에 둔다(API.md §1 ②).
 * 데이터는 busan_rain — 2부는 실데이터다. dataset:'busan_rain' 은 복사할 때 rain 변수와
 * 년·월 열을 만드는 머리말까지 붙여 준다.
 */
(function () {
  'use strict';

  /* 복사용 코드의 공통 앞부분. 'busan_rain' 머리말은 파일을 읽기만 하므로(rain.shape 가 (43100, 3) 이어야
   * 화면과 같다) 년·월 열이 필요한 블록은 이 줄들을 앞에 붙여 혼자서도 돌게 한다. 바뀌지 않는 문자열이라
   * 모듈 전역에 둬도 된다(render 재호출과 무관). */
  var YM = "rain['날짜'] = pd.to_datetime(rain['날짜'])\n" +
    "rain['년'] = rain['날짜'].dt.year\nrain['월'] = rain['날짜'].dt.month\n\n";
  var MONTH_SUM = "연도별월합계 = rain.groupby(['년', '월'])['강수량'].sum(min_count=1).reset_index()\n";

  var MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var SEASON_ORDER = ['봄', '여름', '가을', '겨울'];
  function seasonOf(m) {
    if (m === 3 || m === 4 || m === 5) return '봄';
    if (m === 6 || m === 7 || m === 8) return '여름';
    if (m === 9 || m === 10 || m === 11) return '가을';
    return '겨울';
  }
  function maxMinBy(items) {
    var max = null, min = null;
    items.forEach(function (it) {
      if (DF.isNA(it.value)) return;
      if (max === null || it.value > max.value) max = it;
      if (min === null || it.value < min.value) min = it;
    });
    return { max: max, min: min };
  }

  Lab.register({
    id: 'v6-eda',
    part: 2,
    num: 6,
    title: 'EDA 실습 — 부산 강수량 118년',
    subtitle: '결측 63.8%가 무엇을 뜻하는지 스스로 판단하고, 그 판단에 따라 숫자가 어떻게 갈라지는지 끝까지 확인한다',
    sim: '결측 판단 실험실 · 연·월 집계 탐색기 · 극값 찾기',

    render: function (root) {
      // ═══════════════════════════ 데이터 준비 (한 번만 — 이후는 이 값들로만 그린다)
      var df = LabData.frame('busan_rain');                 // 43,100 × 3, 실데이터
      var origColCount = df.shape[1];                       // 년·월을 더하기 전 열 수 (dropna 예시용)
      df.setCol('년', df.col('날짜').dt.year);
      df.setCol('월', df.col('날짜').dt.month);

      var dateArr = df.col('날짜').toArray();
      var yearArr = df.col('년').toArray();
      var monthArr = df.col('월').toArray();
      var rainArr = df.col('강수량').toArray();
      var nRows = rainArr.length;
      var i;

      var naCount = 0, zeroCount = 0, posCount = 0;
      for (i = 0; i < nRows; i++) {
        var v0 = rainArr[i];
        if (DF.isNA(v0)) naCount++;
        else if (v0 === 0) zeroCount++;
        else if (v0 > 0) posCount++;
      }
      var naRate = naCount / nRows;

      // 연도별 · 월별로 결측과 값을 모은다 (증거 ①·②의 재료)
      var byYear = {}, byMonth = {};
      for (i = 0; i < nRows; i++) {
        var y = yearArr[i], m = monthArr[i], v = rainArr[i];
        if (!byYear[y]) byYear[y] = { total: 0, na: 0, vals: [] };
        byYear[y].total++;
        if (DF.isNA(v)) byYear[y].na++; else byYear[y].vals.push(v);
        if (!byMonth[m]) byMonth[m] = { total: 0, na: 0, vals: [] };
        byMonth[m].total++;
        if (DF.isNA(v)) byMonth[m].na++; else byMonth[m].vals.push(v);
      }
      var years = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });

      var yearMissRates = years.map(function (yy) { return byYear[yy].na / byYear[yy].total; });
      var minYearMissRate = Math.min.apply(null, yearMissRates);
      var maxYearMissRate = Math.max.apply(null, yearMissRates);
      var allYearWhole = years.every(function (yy) { return byYear[yy].vals.length > 0; });

      var monthMissRate = {}, monthMean = {};
      MONTHS.forEach(function (mm) {
        monthMissRate[mm] = byMonth[mm].na / byMonth[mm].total;
        monthMean[mm] = byMonth[mm].vals.length ? DF.series(byMonth[mm].vals).mean() : NaN;
      });

      // 결측 두 가지 판단 — 그대로(NaN 건너뜀) vs 0으로 채움
      var rainCol = df.col('강수량');
      var sumOrig = rainCol.sum(), sumFill0 = rainCol.fillna(0).sum();
      var meanOrig = rainCol.mean(), meanFill0 = rainCol.fillna(0).mean();
      var medianOrig = rainCol.median(), medianFill0 = rainCol.fillna(0).median();
      var countOrig = rainCol.count();               // 강수량 값이 있는 날수
      var meanRatio = meanOrig / meanFill0;

      var droppedShape = [countOrig, origColCount];         // rain.dropna() — 열 3개뿐일 때 기준

      // 연강수량 — sum(min_count=1) 의미: 그 해에 값이 하나도 없으면 NaN
      var annualSum = {};
      years.forEach(function (yy) {
        var vals = byYear[yy].vals;
        annualSum[yy] = vals.length ? DF.series(vals).sum() : NaN;
      });
      var annualItems = years.map(function (yy) { return { label: String(yy), value: annualSum[yy] }; });
      var annualExtreme = maxMinBy(annualItems);

      var normalYears = years.filter(function (yy) { return yy >= 1991 && yy <= 2020; });
      var normalAvg = DF.series(normalYears.map(function (yy) { return annualSum[yy]; })).mean();

      // 해마다 (년, 월) 합계. 월별 평균은 sum(min_count=1) 처럼 기록이 하나도 없는 달(1987년 12월)을
      // NaN 으로 빼고 평균 낸다 — 0 으로 넣으면 이 장이 경고하는 바로 그 실수가 된다(12월 30.9 → 31.2).
      // 계절별은 교재 코드처럼 계절 합계를 햇수로 나누므로 빈 달이 0 으로 들어가는 것이 코드와 같다.
      var yearMonthSum = {};
      for (i = 0; i < nRows; i++) {
        var key = yearArr[i] + '-' + monthArr[i];
        if (!yearMonthSum[key]) yearMonthSum[key] = { sum: 0, valid: 0 };
        var v2 = rainArr[i];
        if (!DF.isNA(v2)) { yearMonthSum[key].sum += v2; yearMonthSum[key].valid++; }
      }
      function ymSum(yy, mm) { var k = yy + '-' + mm; return yearMonthSum[k] ? yearMonthSum[k].sum : 0; }
      function ymValid(yy, mm) { var k = yy + '-' + mm; return yearMonthSum[k] ? yearMonthSum[k].valid : 0; }

      var monthlyAvg = {};
      MONTHS.forEach(function (mm) {
        monthlyAvg[mm] = DF.series(years.map(function (yy) {
          return ymValid(yy, mm) ? ymSum(yy, mm) : NaN;
        }), { dtype: 'float64' }).mean();
      });
      var seasonalAvg = {};
      SEASON_ORDER.forEach(function (s) {
        var inSeason = MONTHS.filter(function (mm) { return seasonOf(mm) === s; });
        seasonalAvg[s] = DF.series(years.map(function (yy) {
          return inSeason.reduce(function (acc, mm) { return acc + ymSum(yy, mm); }, 0);
        })).mean();
      });

      // 최다 강수일 (전체 118년 중)
      var validDayIdx = [];
      for (i = 0; i < nRows; i++) if (!DF.isNA(rainArr[i])) validDayIdx.push(i);
      var byRainDesc = validDayIdx.slice().sort(function (a, b) { return rainArr[b] - rainArr[a]; });
      var topDayIdx = byRainDesc[0];

      // ═══════════════════════════════ 도입 — 63.8%가 비어 있는 자료
      root.appendChild(UI.note(
        '부산의 일별 강수량 43,100일 가운데 ' + naCount + '일(' + UI.fmt(naRate * 100, 1) +
        '%)이 결측이다. 결측인 행을 그냥 지우면 어떻게 되는지 먼저 확인하자.'
      ));
      root.appendChild(UI.code(
        "print(rain.shape)\nprint(rain['강수량'].isna().sum())",
        { title: '결측이 얼마나 되는가', dataset: 'busan_rain', output: '(' + nRows + ', 3)\n' + naCount }
      ));
      root.appendChild(UI.code(
        "# ⚠ 에러도 경고도 없다. 그런데 데이터의 3분의 2 가까이가 사라진다\n" +
        "지운뒤 = rain[['날짜', '지점', '강수량']].dropna()\nprint(지운뒤.shape)",
        { dataset: 'busan_rain', output: '(' + droppedShape[0] + ', ' + droppedShape[1] + ')' }
      ));
      root.appendChild(UI.note(
        nRows + '행이 ' + droppedShape[0] + '행으로 준다. 지운 것이 정말 "쓸모없는 빈 자리"인지, ' +
        '아니면 다른 뜻을 가진 값인지부터 판단해야 한다 — 그 판단을 시뮬레이터 ①에서 한다.'
      ));

      // ═══════════════════════════════ 시뮬레이터 ① 결측 판단 실험실
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 결측 판단 실험실' }));
      box1.appendChild(UI.note(
        '결측 63.8%의 뜻은 두 가지로 나뉜다 — 관측 장비가 고장 나서 기록을 못 한 관측 공백이거나, ' +
        '비가 안 와서 적을 값이 없어 비워 둔 것이거나. 세 증거로 판단해 보자.'
      ));
      box1.appendChild(UI.note(
        '증거 ① 결측 비율이 118개 해 내내 ' + UI.fmt(minYearMissRate * 100, 1) + '%~' +
        UI.fmt(maxYearMissRate * 100, 1) + '% 사이에서 고르게 나타난다' +
        (allYearWhole ? ' (통째로 빈 해는 없다)' : '') +
        ' — 장비 고장이라면 특정 시기에 몰려야 자연스러운데 그렇지 않다.'
      ));
      box1.appendChild(UI.note('증거 ② 결측 비율이 달마다 다르고, 강수량과 반대로 움직인다:'));

      var missBars = UI.columns(MONTHS.map(function (mm) { return { label: mm + '월', value: monthMissRate[mm] }; }), {
        title: '월별 결측 비율', yLabel: '결측 비율', highlight: ['7월', '12월']
      });
      var meanBars = UI.columns(MONTHS.map(function (mm) { return { label: mm + '월', value: monthMean[mm] }; }), {
        title: '월별 평균 강수량 (결측을 뺀 mean())', yLabel: '평균 강수량(mm)', highlight: ['7월', '12월']
      });
      box1.appendChild(missBars);
      box1.appendChild(meanBars);
      box1.appendChild(UI.note(
        '비가 가장 많이 오는 7월(' + UI.fmt(monthMean[7], 1) + 'mm)이 결측이 가장 적고(' +
        UI.fmt(monthMissRate[7] * 100, 1) + '%), 비가 가장 적은 12월·1월이 결측이 가장 많다(' +
        UI.fmt(Math.min(monthMissRate[12], monthMissRate[1]) * 100, 1) + '~' +
        UI.fmt(Math.max(monthMissRate[12], monthMissRate[1]) * 100, 1) + '%). 관측 장비가 계절을 가려 가며 고장 났다고 보기는 어렵다.',
        null, { kind: 'why' }
      ));
      box1.appendChild(UI.note(
        '증거 ③ 결측과 별도로 0.0이라는 값이 ' + zeroCount + '일 있다(양수인 날은 ' + posCount +
        '일). 결측이 전부 "비가 0mm"였다면 0.0이라는 값이 따로 있을 이유가 없다 — 장비가 ' +
        '"비가 0mm 왔다"와 "기록이 없다"를 구분해서 남긴다는 뜻이다.'
      ));
      box1.appendChild(UI.note(
        '세 증거를 합치면 이 결측은 관측 공백이 아니라 "비가 오지 않아 적지 않은 날"로 읽는 것이 ' +
        '합리적이다. 이 판단에 따라 숫자가 어떻게 갈라지는지 아래에서 직접 켜고 꺼 보자.'
      ));

      var st1 = { fill0: false };
      var body1 = UI.el('div');
      var CMP_ROWS = [
        { key: '합계(mm)', orig: sumOrig, fill0: sumFill0 },
        { key: '평균(mm)', orig: meanOrig, fill0: meanFill0 },
        { key: '중앙값(mm)', orig: medianOrig, fill0: medianFill0 },
        { key: '날수', orig: countOrig, fill0: nRows },
        { key: '비 온 날 수(>0mm)', orig: posCount, fill0: posCount }
      ];
      function rebuild1() {
        UI.clear(body1);
        var col = st1.fill0 ? 'fill0' : 'orig';
        body1.appendChild(UI.table(
          [
            { key: 'key', label: '지표' },
            { key: 'orig', label: '그대로 (mean 이 NaN 건너뜀)', digits: 2 },
            { key: 'fill0', label: '0으로 채움 (fillna(0))', digits: 2 }
          ],
          CMP_ROWS,
          { hlCells: CMP_ROWS.map(function (r, ri) { return [ri, col]; }) }
        ));
        if (st1.fill0) {
          body1.appendChild(UI.note(
            '지금은 "0으로 채움" 열을 보고 있다. 날수의 분모가 ' + nRows + '일(전체 날) 전부로 ' +
            '늘어나 평균이 ' + UI.fmt(meanFill0, 3) + 'mm로 낮아졌다 — "비가 안 온 날도 값 0"이라고 ' +
            '보는 판단이다.'
          ));
        } else {
          body1.appendChild(UI.note(
            '지금은 "그대로" 열을 보고 있다. 날수의 분모가 ' + countOrig + '일(강수량 값이 있는 날)뿐이라 ' +
            '평균이 ' + UI.fmt(meanOrig, 3) + 'mm로 더 높다 — "기록이 없는 날은 평균에서 빼자"는 판단이다.'
          ));
        }
        body1.appendChild(UI.note(
          '합계는 두 판단이 완전히 같다(' + UI.fmt(sumOrig, 1) + 'mm) — sum()은 더할 값이 없으면 그냥 ' +
          '더하지 않을 뿐이다. 반대로 평균은 나누는 날수가 달라 ' + UI.fmt(meanRatio, 2) + '배 차이가 난다. ' +
          '비 온 날 수(>0mm)도 두 판단이 같다 — 0을 채워도 "비가 온 날"의 정의는 바뀌지 않는다.'
        ));
      }
      box1.appendChild(UI.toggle({
        label: '결측 = "비 없음"(0으로 채움)',
        value: st1.fill0,
        onChange: function (on) { st1.fill0 = on; rebuild1(); }
      }));
      box1.appendChild(body1);
      rebuild1();
      box1.appendChild(UI.code(
        "합계_원본 = rain['강수량'].sum()\n합계_0채움 = rain['강수량'].fillna(0).sum()\n" +
        "평균_원본 = rain['강수량'].mean()\n평균_0채움 = rain['강수량'].fillna(0).mean()\n" +
        "print(f'평균의 비율: {평균_원본 / 평균_0채움:.2f}배')",
        { dataset: 'busan_rain' }
      ));
      root.appendChild(box1);

      // ═══════════════════════════════ 시뮬레이터 ② 연·월 집계 탐색기
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 연·월 집계 탐색기' }));
      box2.appendChild(UI.note(
        '단위를 연·월·계절로 바꿔 가며 강수량 합계가 어떻게 묶이는지 보자. 연 단위는 그 해에 값이 ' +
        '하나도 없으면 NaN으로 남기는 방식(sum(min_count=1))으로, 월·계절 단위는 해마다 합계를 낸 ' +
        '뒤 그 값들을 평균 내는 방식으로 집계한다.'
      ));

      var UNIT_CFG = {
        year: {
          label: '연', xLabel: '년', yLabel: '연강수량 합계(mm)',
          items: function () { return annualItems; },
          note: function (ex) {
            return '연강수량이 가장 많은 해는 ' + ex.max.label + '년으로 ' + UI.fmt(ex.max.value, 1) +
              'mm, 가장 적은 해는 ' + ex.min.label + '년으로 ' + UI.fmt(ex.min.value, 1) +
              'mm이다. 1991~2020년 평년 평균은 ' + UI.fmt(normalAvg, 1) + 'mm이다.';
          },
          code: YM + "연강수량 = rain.groupby('년')['강수량'].sum(min_count=1)\n" +
            "print(f'최대: {연강수량.idxmax()}년 {연강수량.max():.1f}mm')\n" +
            "print(f'최소: {연강수량.idxmin()}년 {연강수량.min():.1f}mm')"
        },
        month: {
          label: '월', xLabel: '월', yLabel: '월 강수량 평균(mm, 해마다 합계의 평균)',
          items: function () { return MONTHS.map(function (mm) { return { label: mm + '월', value: monthlyAvg[mm] }; }); },
          note: function (ex) {
            return ex.max.label + '이 가장 많고(' + UI.fmt(ex.max.value, 1) + 'mm) ' + ex.min.label +
              '이 가장 적다(' + UI.fmt(ex.min.value, 1) + 'mm) — 장마·태풍이 겹치는 여름에 강수가 집중된다.';
          },
          code: YM + MONTH_SUM +
            "월별평균 = 연도별월합계.groupby('월')['강수량'].mean()\nprint(월별평균.round(1))"
        },
        season: {
          label: '계절', xLabel: '계절', yLabel: '계절 강수량 평균(mm, 해마다 합계의 평균)',
          items: function () { return SEASON_ORDER.map(function (s) { return { label: s, value: seasonalAvg[s] }; }); },
          note: function (ex) {
            return ex.max.label + '이 가장 많고(' + UI.fmt(ex.max.value, 1) + 'mm) ' + ex.min.label +
              '이 가장 적다(' + UI.fmt(ex.min.value, 1) + 'mm) — 월을 셋씩 묶어도 여름 쏠림이 그대로 드러난다.';
          },
          code: YM + MONTH_SUM + "def 계절(월):\n    if 월 in (3, 4, 5): return '봄'\n    if 월 in (6, 7, 8): return '여름'\n" +
            "    if 월 in (9, 10, 11): return '가을'\n    return '겨울'\n\n" +
            "연도별월합계['계절'] = 연도별월합계['월'].apply(계절)\n" +
            "계절별평균 = 연도별월합계.groupby('계절')['강수량'].sum().div(len(연도별월합계['년'].unique()))\n" +
            "print(계절별평균.round(1))"
        }
      };
      var st2 = { unit: 'year' };
      var body2 = UI.el('div');
      function rebuild2() {
        UI.clear(body2);
        var cfg = UNIT_CFG[st2.unit];
        var items = cfg.items();
        var ex = maxMinBy(items);
        var chartOpts = { title: cfg.label + ' 단위 강수량 합계', yLabel: cfg.yLabel, xLabel: cfg.xLabel };
        if (ex.max && ex.min) chartOpts.highlight = [ex.max.label, ex.min.label];
        if (st2.unit === 'year') chartOpts.width = 860;
        body2.appendChild(UI.columns(items, chartOpts));
        if (ex.max && ex.min) body2.appendChild(UI.note(cfg.note(ex)));
        body2.appendChild(UI.code(cfg.code, { dataset: 'busan_rain' }));
      }
      box2.appendChild(UI.buttonGroup(
        [{ label: '연', value: 'year' }, { label: '월', value: 'month' }, { label: '계절', value: 'season' }],
        { label: '집계 단위', selected: 0, onChange: function (v) { st2.unit = v; rebuild2(); } }
      ));
      box2.appendChild(body2);
      rebuild2();
      root.appendChild(box2);

      // ═══════════════════════════════ 시뮬레이터 ③ 극값 찾기
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 극값 찾기' }));
      box3.appendChild(UI.note(
        '상위 며칠, 상위 몇 해가 118년 전체 그림을 얼마나 좌우하는지 개수를 늘려 가며 확인하자.'
      ));

      var st3 = { n: 10 };
      var body3 = UI.el('div');
      function rebuild3() {
        UI.clear(body3);
        var n = st3.n;
        var dayRows = byRainDesc.slice(0, n).map(function (idx) {
          return { 날짜: DF.fmtDate(dateArr[idx]), 강수량: rainArr[idx] };
        });
        var yearRows = years.slice().filter(function (yy) { return !DF.isNA(annualSum[yy]); })
          .sort(function (a, b) { return annualSum[b] - annualSum[a]; })
          .slice(0, n)
          .map(function (yy) { return { 년: yy, 연강수량: annualSum[yy] }; });

        var topDaySum = byRainDesc.slice(0, n).reduce(function (s2, idx) { return s2 + rainArr[idx]; }, 0);
        var topDayShare = topDaySum / sumOrig * 100;

        body3.appendChild(UI.el('div.small', { text: '일강수량 상위 ' + n + '일' }));
        body3.appendChild(UI.table(
          [{ key: '날짜', label: '날짜' }, { key: '강수량', label: '강수량(mm)', digits: 1 }],
          dayRows
        ));
        body3.appendChild(UI.note(
          '상위 ' + n + '일의 강수량 합이 118년 전체 강수량 합계(' + UI.fmt(sumOrig, 1) + 'mm)의 ' +
          UI.fmt(topDayShare, 1) + '%를 차지한다.'
        ));
        body3.appendChild(UI.el('div.small', { text: '연강수량 상위 ' + n + '개 해' }));
        body3.appendChild(UI.table(
          [{ key: '년', label: '년' }, { key: '연강수량', label: '연강수량(mm)', digits: 1 }],
          yearRows
        ));
        body3.appendChild(UI.code(
          "print(rain.nlargest(" + n + ", '강수량')[['날짜', '강수량']])\n\n" +
          YM + "연강수량 = rain.groupby('년')['강수량'].sum(min_count=1)\n" +
          "print(연강수량.sort_values(ascending=False).head(" + n + '))',
          { dataset: 'busan_rain' }
        ));
      }
      box3.appendChild(UI.slider({
        label: '상위 며칠 · 몇 해', min: 3, max: 20, step: 1, value: st3.n,
        onChange: function (v) { st3.n = v; rebuild3(); }
      }));
      box3.appendChild(body3);
      rebuild3();
      root.appendChild(box3);

      // ═══════════════════════════════ 통찰 정리
      var insight = UI.el('div.card');
      insight.appendChild(UI.el('div.panel-title', { text: '통찰 정리 — 무엇을 봤고, 무엇을 판단했고, 무엇을 모르는가' }));
      insight.appendChild(UI.note(
        '① 부산 강수량 자료는 ' + UI.fmt(naRate * 100, 1) + '%가 결측이지만, 해마다 고르게 나타나고 ' +
        '비가 잦은 달일수록 결측이 적다 — "비가 안 와서 비워 둔 것"으로 판단했다.'
      ));
      insight.appendChild(UI.note(
        '② 그래서 연강수량 합계는 결측 처리 방식과 관계없이 그대로지만, 일평균은 결측을 0으로 볼 ' +
        '때와 아닐 때가 ' + UI.fmt(meanRatio, 2) + '배 차이 난다.'
      ));
      insight.appendChild(UI.note(
        '③ 가장 비가 많이 온 해(' + annualExtreme.max.label + '년, ' + UI.fmt(annualExtreme.max.value, 1) +
        'mm)와 적게 온 해(' + annualExtreme.min.label + '년, ' + UI.fmt(annualExtreme.min.value, 1) +
        'mm)가 세 배 넘게 차이 난다는 것은 확인했지만, 그 차이를 만든 개별 기상 현상이 무엇인지는 ' +
        '이 표만으로는 알 수 없다.'
      ));
      root.appendChild(insight);

      // ═══════════════════════════════ 흔한 실수
      var pitfalls = UI.el('div.card');
      pitfalls.appendChild(UI.el('div.panel-title', { text: '흔한 실수' }));
      pitfalls.appendChild(UI.note(
        '결측 비율만 보고 바로 지운다. ' + UI.fmt(naRate * 100, 1) + '%라는 숫자만 보면 "거의 못 쓰는 ' +
        '자료"로 보이지만, 그 결측이 무엇을 뜻하는지 확인하면 오히려 지우지 않고 그대로 쓰는 게 맞는 ' +
        '경우도 있다.'
      ));
      pitfalls.appendChild(UI.danger(
        'sum()에 min_count를 안 준다',
        '기본값(min_count=0)은 그 그룹이 전부 결측이어도 0을 돌려준다 — "0mm 확실"과 "그 기간은 ' +
        '기록이 아예 없음"이 구별되지 않는다. 1987년 12월처럼 하루도 기록이 없는 달이 실제로 있다.'
      ));
      pitfalls.appendChild(UI.note(
        '표본 크기를 다르게 두고 두 값을 비교한다. "평균 강수량"이라는 말 한마디에도 분모가 ' +
        countOrig + '일(비 온 날만)인지 ' + nRows + '일(전체 날)인지가 숨어 있다. 값을 말할 때는 분모가 ' +
        '무엇인지도 함께 밝히자.'
      ));
      root.appendChild(pitfalls);

      // ═══════════════════════════════ 확인 문제
      root.appendChild(UI.quiz({
        title: '확인 문제 V6-1',
        question: "결측 " + naCount + "일(" + UI.fmt(naRate * 100, 1) + "%)을 보고 " +
          "\"관측 장비가 자주 고장 났다\"고 결론지었다. 이 장의 증거 중 " +
          "\"비가 안 와서 비워 두었다\"는 판단을 가장 강하게 지지하는 것은?",
        choices: [
          { label: '결측 비율이 비가 많이 오는 달(7월)에 가장 낮고 적게 오는 달(12·1월)에 가장 높다', correct: true,
            why: '결측 비율이 강수량과 반대로 움직이는 패턴은 장비 고장이 아니라 "비가 안 와서 적지 않았다"는 ' +
              '설명과 정확히 맞아떨어진다.' },
          { label: '결측이 전체의 63.8%나 된다', why: '틀렸다. 비율이 크다는 사실 자체는 원인을 말해 주지 않는다.' },
          { label: '지점 번호가 159로 고정되어 있다', why: '틀렸다. 지점 번호는 관측소를 가리킬 뿐 결측의 뜻과 무관하다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V6-2',
        question: '연강수량의 합계는 결측을 0으로 채우든 안 채우든 똑같은데, 일평균은 왜 ' +
          UI.fmt(meanRatio, 2) + '배나 차이가 나는가?',
        choices: [
          { label: 'sum()은 더할 값이 없으면 그냥 더하지 않지만, mean()은 나누는 날수(분모)가 달라지기 때문이다', correct: true,
            why: '결측을 빼고 계산하면 분모가 ' + countOrig + '일(값이 있는 날)이고, 0으로 채우면 분모가 ' +
              nRows + '일(전체 날)이 된다 — 분모가 다르므로 평균도 달라진다.' },
          { label: 'sum()과 mean()이 서로 다른 열을 계산하기 때문이다', why: '틀렸다. 둘 다 같은 강수량 열을 계산한다.' },
          { label: '0으로 채우면 결측이 음수로 바뀌기 때문이다', why: '틀렸다. fillna(0)은 결측을 0.0으로 바꿀 뿐 음수를 만들지 않는다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V6-3',
        question: '1987년 12월은 하루도 강수량 기록이 없는 달이다. min_count 없이(기본값) ' +
          "groupby(['년', '월'])['강수량'].sum()으로 이 달의 값을 구하면?",
        choices: [
          { label: '0.0', correct: true,
            why: 'min_count의 기본값은 0이라 더할 값이 하나도 없어도 0.0을 돌려준다 — "정말 0mm"인지 ' +
              '"기록이 아예 없음"인지 이 값만으로는 구별할 수 없다.' },
          { label: 'NaN', why: '틀렸다. NaN으로 남기려면 sum(min_count=1)처럼 min_count를 명시해야 한다.' },
          { label: '에러가 난다', why: '틀렸다. 에러도 경고도 없이 조용히 0.0을 준다 — 그래서 알아채기 어렵다.' }
        ]
      }));

      // 상위 10일이 "비 온 날" 가운데 차지하는 몫과 전체 강수량에서 차지하는 몫 — 둘 다 그 자리에서 계산한다.
      // (처음 판은 "상당 부분을 차지한다" 고 물었는데 화면의 값은 1.7% 였다. 몫이 크다는 게 아니라
      //  날수의 몫보다 훨씬 크다는 것이 요점이다.)
      var q4Top = byRainDesc.slice(0, 10).reduce(function (s2, idx) { return s2 + rainArr[idx]; }, 0);
      var q4SumShare = q4Top / sumOrig * 100;
      var q4DayShare = 10 / posCount * 100;
      root.appendChild(UI.quiz({
        title: '확인 문제 V6-4',
        question: '일강수량 상위 10일은 비 온 날 ' + posCount + '일 가운데 ' + UI.fmt(q4DayShare, 2) + '%뿐인데, ' +
          '118년 전체 강수량의 ' + UI.fmt(q4SumShare, 1) + '%를 차지한다(날수 몫의 약 ' +
          Math.round(q4SumShare / q4DayShare) + '배). 이것이 보여 주는 것은?',
        choices: [
          { label: '비의 양은 날마다 고르지 않다 — 드문 날에 한꺼번에 많이 온다', correct: true,
            why: '하루 ' + UI.fmt(rainArr[topDayIdx], 1) + 'mm처럼 드물게 아주 많이 오는 날이 있다. ' +
              '그래서 평균 하나만 보고 "비 오는 날엔 이 정도 온다"고 판단하면 안 된다 — 분포를 함께 본다.' },
          { label: '매일 강수량이 거의 비슷하다는 뜻이다', why: '틀렸다. 오히려 그 반대다 — 값이 고르지 않고 소수에 쏠려 있다는 뜻이다.' },
          { label: '결측치가 상위권 날짜에 몰려 있다는 뜻이다', why: '틀렸다. 상위권은 강수량 값이 있는 날 중에서만 뽑은 것이다.' }
        ]
      }));
    }
  });
})();
