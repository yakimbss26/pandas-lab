/* v5-honest.js — V5장. 그래프가 거짓말할 때 (2부, docs/draft/v5-v6-honest-eda.md V5장)
 * 같은 계산 결과라도 축을 어디서 시작하는지, 결측을 어떻게 다루는지, 눈금을 어떻게 적는지에 따라
 * 완전히 다른 인상을 줄 수 있다는 것을 세 시뮬레이터로 보여준다. IIFE 로 감싸고, 가변 상태는
 * 전부 render 안의 지역 변수에 둔다(API.md §1 ②). 숫자는 전부 DF 로 그 자리에서 계산한다(§1 ①).
 * 데이터는 seoul_day · korea_pop — 2부는 실데이터다(합성이 아니다).
 */
(function () {
  'use strict';

  function isNum(v) { return typeof v === 'number' && !isNaN(v); }
  /* 파이썬 round(v, 6) 을 print 한 모양. 14.109041, 0.766369 */
  function r6(v) { return Math.round(v * 1e6) / 1e6; }

  /* 연도별 평균기온(meanS)·날수(countS) 중에서 날수가 threshold 이상인 해만 놓고
   * 가장 추운 해를 찾는다. mean() 이 그렇듯 NaN(결측)은 건너뛴다. */
  function findColdest(years, meanS, countS, threshold) {
    var idx = -1;
    for (var i = 0; i < years.length; i++) {
      if (countS.at(i) < threshold) continue;
      var v = meanS.at(i);
      if (DF.isNA(v)) continue;
      if (idx === -1 || v < meanS.at(idx)) idx = i;
    }
    if (idx === -1) return null;
    return { year: years[idx], mean: meanS.at(idx), count: countS.at(idx) };
  }

  /* 0~100세(이상) 101개 나이 배열을 bucket 세로 묶는다. bucket=1 이면 원래 그대로.
   * 마지막 구간은 '100세 이상'까지 합쳐서 하나로 묶는다. */
  function bucketAges(ages, maleVals, femaleVals, bucket) {
    if (bucket <= 1) return { labels: ages.slice(), male: maleVals.slice(), female: femaleVals.slice() };
    var mainN = ages.length - 1;               // 마지막 하나('100세 이상')는 따로 빼 둔다
    var labels = [], male = [], female = [];
    for (var start = 0; start < mainN; start += bucket) {
      var end = Math.min(start + bucket, mainN) - 1;
      var isLast = (start + bucket >= mainN);
      labels.push(isLast ? (start + '세 이상') : (start + '~' + end + '세'));
      var sm = 0, sf = 0;
      for (var k = start; k <= end; k++) { sm += maleVals[k]; sf += femaleVals[k]; }
      if (isLast) { sm += maleVals[mainN]; sf += femaleVals[mainN]; }
      male.push(sm); female.push(sf);
    }
    return { labels: labels, male: male, female: female };
  }

  Lab.register({
    id: 'v5-honest',
    part: 2,
    num: 5,
    title: '그래프가 거짓말할 때',
    subtitle: '같은 계산 결과라도 축의 시작점, 결측을 다루는 방식, 눈금이 적힌 모양에 따라 완전히 다른 인상을 줄 수 있다',
    sim: 'y축 자르기 · 결측의 계곡 · 인구 피라미드',

    render: function (root) {
      // ── 데이터는 한 번만 받고, 무거운 집계도 한 번만 만든다(API.md §3 2부 데이터 주의)
      var full = LabData.frame('seoul_day');
      full.setCol('년', full.col('날짜').dt.year);
      var g = full.groupby('년');
      var meanS = g.aggCol('평균기온', 'mean');
      var countS = g.aggCol('평균기온', 'count');
      var years = meanS.labels();

      var yf = LabData.frame('seoul_year');
      var ext = yf.copy();
      ext.setCol('연교차', ext.col('최고기온').sub(ext.col('최저기온')));
      var corrDf = ext.cols(['평균기온', '연교차']).corr({ numericOnly: true });
      var corrPos = corrDf.index.positions('평균기온')[0];
      var corrValue = corrDf.col('연교차').at(corrPos);

      var pop = LabData.frame('korea_pop');
      pop.setCol('시도', pop.col('행정구역').str.split('\\s+\\(', { regex: true, expand: true }).col(0));
      var TOTAL_COL = '2021년08월_계_총인구수';
      var maleCols = pop.filter({ regex: '_남_\\d+세$|_남_100세 이상$' }).columns;
      var femaleCols = pop.filter({ regex: '_여_\\d+세$|_여_100세 이상$' }).columns;
      var ages = maleCols.map(function (c) { var parts = c.split('_'); return parts[parts.length - 1]; });
      var sidoList = pop.col('시도').toArray().filter(function (s) { return s !== '전국'; });

      // ═══════════════════════════════ 문제 제기
      root.appendChild(UI.note(
        '축을 어디서 시작하는지, 결측을 빼고 계산했는지, 눈금을 어떻게 적었는지 — 이 세 가지만 바뀌어도 ' +
        '같은 자료, 같은 계산 결과가 전혀 다른 인상을 줄 수 있다. 아래 세 시뮬레이터로 직접 값을 바꿔 가며 ' +
        '그 차이를 눈으로 확인해보자.'
      ));

      // ═══════════════════════════════ 시뮬레이터 ① y축 자르기
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① y축 자르기' }));
      box1.appendChild(UI.note(
        '막대그래프는 막대의 길이(0부터 잰 높이)로 크기를 비교하는 그림이다. 두 해의 평균기온을 비교할 때 ' +
        'y축을 어디서 시작하느냐에 따라 막대 높이의 비율이 실제 값의 비율과 얼마나 벌어지는지 비교해보자.'
      ));

      var st1 = { endYear: Math.min(2024, years[years.length - 1]), yStart: 0 };
      var ctl1 = UI.el('div.control-row');
      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(ctl1);
        UI.clear(body1);

        var idxB = years.indexOf(st1.endYear);
        var idxA = years.indexOf(st1.endYear - 1);
        var valA = meanS.at(idxA), valB = meanS.at(idxB);
        var smaller = Math.min(valA, valB), bigger = Math.max(valA, valB);
        var maxStart = Math.max(0, Math.floor(smaller * 10) / 10 - 0.1);
        if (st1.yStart > maxStart) st1.yStart = maxStart;

        ctl1.appendChild(UI.slider({
          label: '비교할 두 해 — 뒤 해', min: years[1] === years[0] + 1 ? years[1] : 1955, max: years[years.length - 1], step: 1,
          value: st1.endYear, onChange: function (v) { st1.endYear = v; rebuild1(); }
        }));
        ctl1.appendChild(UI.slider({
          label: 'y축 시작값', min: 0, max: maxStart, step: 0.1, value: st1.yStart,
          onChange: function (v) { st1.yStart = v; rebuild1(); }
        }));

        var yearA = st1.endYear - 1, yearB = st1.endYear;
        var diff = bigger - smaller;
        var pct = diff / smaller * 100;
        var actualRatio = bigger / smaller;
        var visibleRatio = (bigger - st1.yStart) / (smaller - st1.yStart);

        body1.appendChild(UI.columns(
          [{ label: yearA + '년', value: valA }, { label: yearB + '년', value: valB }],
          { title: yearA + '년 vs ' + yearB + '년 평균기온', yLabel: '평균기온(℃)', yMin: st1.yStart, width: 420 }
        ));

        body1.appendChild(UI.table(
          [{ key: 'k', label: '' }, { key: 'v', label: '값' }],
          [
            { k: '실제 차이', v: UI.fmt(diff, 2) + '℃ (' + UI.fmt(pct, 1) + '%)' },
            { k: '실제 값 비율 (0부터)', v: UI.fmt(actualRatio, 2) + '배' },
            { k: '지금 축(' + UI.fmt(st1.yStart, 1) + '부터)에서 보이는 높이 비율', v: UI.fmt(visibleRatio, 2) + '배' }
          ]
        ));

        body1.appendChild(UI.note(
          st1.yStart === 0
            ? '지금은 축이 0부터라서 보이는 비율과 실제 비율이 같다. 슬라이더로 y축 시작값을 올리면서 두 비율이 ' +
              '어떻게 벌어지는지 살펴보자.'
            : '축을 ' + UI.fmt(st1.yStart, 1) + '부터로 자르니 실제로는 ' + UI.fmt(actualRatio, 2) + '배 차이인 ' +
              '두 막대가 화면에서는 ' + UI.fmt(visibleRatio, 2) + '배 차이처럼 보인다. 막대그래프는 길이로 크기를 ' +
              '전달하는 그림이라서, 길이의 기준점을 옮기면 그 전달 자체가 어긋난다.'
        ));

        body1.appendChild(UI.code(
          "yearly = df.groupby('년')['평균기온'].mean()\n" +
          "print(round(yearly.loc[" + yearA + "], 6))\nprint(round(yearly.loc[" + yearB + "], 6))\n" +
          "print(round(yearly.loc[" + yearB + "] - yearly.loc[" + yearA + "], 6))",
          {
            dataset: 'seoul_day',
            // round(…, 6) 로 찍는다. 그대로 print 하면 전 자릿수가 나오는데, 엔진과 pandas 는 더하는 순서가
            // 달라 마지막 자리가 다르다(엔진 14.109041095890413, pandas …412). 여섯 자리면 같다.
            output: String(r6(valA)) + '\n' + String(r6(valB)) + '\n' + String(r6(valB - valA))
          }
        ));
      }

      box1.appendChild(ctl1);
      box1.appendChild(body1);
      rebuild1();
      root.appendChild(box1);

      // ═══════════════════════════════ 시뮬레이터 ② 결측의 계곡 ★
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② ★ 결측의 계곡' }));
      box2.appendChild(UI.note(
        '서울의 연도별 평균기온을 선으로, 그 해에 값이 있는 날수를 막대로 나란히 그린다. 날수가 적은 해를 ' +
        '계산에서 빼면 선이 그 자리에서 끊기고, "가장 추운 해"가 바뀌는지 슬라이더로 확인해보자.'
      ));

      var st2 = { threshold: 0 };
      var ctl2 = UI.el('div.control-row');
      var body2 = UI.el('div');

      function rebuild2() {
        UI.clear(body2);

        var linePoints = years.map(function (y, i) {
          var v = meanS.at(i);
          if (DF.isNA(v)) return [y, null];
          if (countS.at(i) < st2.threshold) return [y, null];
          return [y, v];
        });
        var below = [];
        years.forEach(function (y, i) { if (countS.at(i) < st2.threshold) below.push(y); });

        body2.appendChild(UI.line(
          [{ name: '평균기온', points: linePoints }],
          { title: '연도별 평균기온', yLabel: '평균기온(℃)', xLabel: '년', width: 860 }
        ));
        body2.appendChild(UI.columns(
          years.map(function (y, i) { return { label: y, value: countS.at(i) }; }),
          { title: '연도별 날수 (평균기온이 결측이 아닌 날 수)', yLabel: '날수', width: 860, highlight: below }
        ));

        var coldestAll = findColdest(years, meanS, countS, 0);
        var coldestNow = findColdest(years, meanS, countS, st2.threshold);

        if (st2.threshold === 0) {
          body2.appendChild(UI.note(
            '지금은 모든 해를 그대로 쓴다. mean() 은 결측을 건너뛰고 계산하므로, 가장 추운 해는 ' +
            coldestAll.year + '년(평균 ' + UI.fmt(coldestAll.mean, 2) + '℃)으로 나온다. 그런데 그 해는 날수가 ' +
            coldestAll.count + '일뿐이다 — 슬라이더를 올려 며칠로 낸 평균인지 확인해보자.'
          ));
        } else {
          body2.appendChild(UI.note(
            '날수 ' + st2.threshold + '일 미만인 해 ' + below.length + '개(' +
            (below.length ? below.slice(0, 10).join(', ') + (below.length > 10 ? ' 외 ' + (below.length - 10) + '개' : '') : '없음') +
            ')를 뺐다. 이 기준에서 가장 추운 해는 ' + (coldestNow ? coldestNow.year + '년(평균 ' + UI.fmt(coldestNow.mean, 2) +
            '℃, 날수 ' + coldestNow.count + '일)' : '없음') + '다.' +
            (coldestNow && coldestNow.year !== coldestAll.year
              ? ' 전체를 그대로 쓸 때의 ' + coldestAll.year + '년(평균 ' + UI.fmt(coldestAll.mean, 2) + '℃, 날수 ' +
                coldestAll.count + '일)과 다른 해다 — 기준을 바꾸는 것만으로 결론이 바뀌었다.'
              : ' 전체를 그대로 쓸 때와 같은 해다.')
          ));
        }

        body2.appendChild(UI.code(
          "yearly = df.groupby('년').agg(평균=('평균기온', 'mean'), 날수=('평균기온', 'count'))\n" +
          "valid = yearly[yearly['날수'] >= " + st2.threshold + "]\n" +
          "print(valid['평균'].idxmin(), round(valid['평균'].min(), 6))",
          {
            dataset: 'seoul_day',
            output: coldestNow ? coldestNow.year + ' ' + String(r6(coldestNow.mean)) : '(해당하는 해가 없다)'
          }
        ));
      }

      ctl2.appendChild(UI.slider({
        label: '날수 기준 — 이 값 미만인 해는 계산에서 뺀다', min: 0, max: 366, step: 1, value: st2.threshold,
        onChange: function (v) { st2.threshold = v; rebuild2(); }
      }));
      box2.appendChild(ctl2);
      box2.appendChild(body2);
      rebuild2();
      root.appendChild(box2);

      // ═══════════════════════════════ 시뮬레이터 ③ 인구 피라미드
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 인구 피라미드' }));
      box3.appendChild(UI.note(
        '시도를 고르면 그 시도의 나이별 남·여 인구를 피라미드로 그린다. 여자 쪽은 왼쪽에 그리려고 값에 ' +
        '음수를 곱하는데, 그 부호가 눈금에도 그대로 남는지 토글로 켜고 꺼 보고, 나이를 몇 세 단위로 묶을지도 바꿔보자.'
      ));

      var st3 = { sido: sidoList.indexOf('제주특별자치도') >= 0 ? '제주특별자치도' : sidoList[0], bucket: 1, absTicks: true };
      var ctl3a = UI.el('div.control-row');
      var ctl3b = UI.el('div.control-row');
      var body3 = UI.el('div');

      function rebuild3() {
        UI.clear(body3);

        var row = pop.mask(pop.col('시도').eq(st3.sido));
        var maleVals = maleCols.map(function (c) { return row.col(c).at(0); });
        var femaleVals = femaleCols.map(function (c) { return row.col(c).at(0); });
        var total = row.col(TOTAL_COL).at(0);

        var bucketed = bucketAges(ages, maleVals, femaleVals, st3.bucket);

        body3.appendChild(UI.pyramid(
          bucketed.labels, bucketed.female, bucketed.male,
          {
            leftName: '여자', rightName: '남자', absTicks: st3.absTicks,
            title: st3.sido + ' 나이별 인구', width: 640, height: 500,
            labelEvery: Math.max(1, Math.ceil(bucketed.labels.length / 15))
          }
        ));

        var sumMale = maleVals.reduce(function (a, b) { return a + b; }, 0);
        var sumFemale = femaleVals.reduce(function (a, b) { return a + b; }, 0);
        var diffs = bucketed.male.map(function (v, i) { return v - bucketed.female[i]; });
        var maxI = 0, minI = 0;
        diffs.forEach(function (d, i) { if (d > diffs[maxI]) maxI = i; if (d < diffs[minI]) minI = i; });

        body3.appendChild(UI.statRow([
          { k: '총인구', v: total.toLocaleString('en-US') },
          { k: '남', v: sumMale.toLocaleString('en-US') },
          { k: '여', v: sumFemale.toLocaleString('en-US') },
          { k: '남 − 여', v: (sumMale - sumFemale).toLocaleString('en-US') }
        ]));

        body3.appendChild(UI.note(
          '남이 가장 많이 앞서는 구간은 ' + bucketed.labels[maxI] + '(+' + diffs[maxI].toLocaleString('en-US') +
          '), 여가 가장 많이 앞서는 구간은 ' + bucketed.labels[minI] + '(' + diffs[minI].toLocaleString('en-US') + ')다.'
        ));

        body3.appendChild(UI.note(
          st3.absTicks
            ? '지금은 왼쪽(여자) 눈금도 양수로 적었다. 막대는 왼쪽으로 그려지지만 눈금 글자는 사람 수 그대로다 — ' +
              '사람 수는 음수가 될 수 없으니 이쪽이 사실에 맞는 모양이다.'
            : '토글을 끄니 왼쪽 눈금에 마이너스가 붙는다. 이 마이너스는 자료가 아니라 "왼쪽으로 그리기 위해 부호를 ' +
              '뒤집었다"는 그리기 방식의 흔적일 뿐인데, 눈금에 그대로 남으면 사람 수가 음수인 것처럼 보인다.',
          '눈금 절댓값'
        ));

        body3.appendChild(UI.code(
          "pop.index = pop['행정구역'].str.split(r'\\s+\\(', regex=True).str[0]   # 시도 이름으로 찾게\n" +
          "남열 = pop.filter(regex=r'_남_\\d+세|_남_100세 이상').columns\n" +
          "여열 = pop.filter(regex=r'_여_\\d+세|_여_100세 이상').columns\n" +
          "남 = pop.loc['" + st3.sido + "', 남열].to_numpy()\n" +
          "여 = pop.loc['" + st3.sido + "', 여열].to_numpy()\n" +
          'print((남 - 여).sum())',
          { dataset: 'korea_pop', output: String(sumMale - sumFemale) }
        ));
      }

      ctl3a.appendChild(UI.buttonGroup(
        sidoList.map(function (s) { return { label: s, value: s }; }),
        { label: '시도', selected: sidoList.indexOf(st3.sido), onChange: function (v) { st3.sido = v; rebuild3(); } }
      ));
      ctl3b.appendChild(UI.buttonGroup(
        [{ label: '1세', value: 1 }, { label: '5세', value: 5 }, { label: '10세', value: 10 }],
        { label: '나이 구간', selected: 0, onChange: function (v) { st3.bucket = v; rebuild3(); } }
      ));
      ctl3b.appendChild(UI.toggle({
        label: '눈금 절댓값', value: st3.absTicks, onChange: function (on) { st3.absTicks = on; rebuild3(); }
      }));

      box3.appendChild(ctl3a);
      box3.appendChild(ctl3b);
      box3.appendChild(body3);
      rebuild3();
      root.appendChild(box3);

      // ═══════════════════════════════ 점검표
      var checklist = UI.el('div.card');
      checklist.appendChild(UI.el('div.panel-title', { text: '점검표' }));
      checklist.appendChild(UI.note('그림을 내보내기 전에 다음 다섯 가지를 확인하자.'));
      var ul = UI.el('ul');
      [
        '제목이 주장인가, 사실인가 — "역대 최저"처럼 제목이 결론을 대신 내리고 있지 않은가',
        '축은 0부터인가 — 막대그래프인데 축이 잘려 있다면 그 이유를 설명할 수 있는가',
        '단위가 적혀 있는가 — ℃인지 mm인지 없이는 숫자가 뜻을 잃는다',
        '결측을 확인했는가 — 평균·합계를 낸 값 옆에 몇 개로 낸 값인지(count) 함께 적었는가',
        '색에 뜻이 있는가, 그리고 표로도 볼 수 있는가 — 색이나 툴팁이 값을 읽는 유일한 통로가 되면 안 된다'
      ].forEach(function (t) { ul.appendChild(UI.el('li', { text: t })); });
      checklist.appendChild(ul);
      root.appendChild(checklist);

      // ═══════════════════════════════ 흔한 실수
      var pitfalls = UI.el('div.card');
      pitfalls.appendChild(UI.el('div.panel-title', { text: '흔한 실수' }));
      pitfalls.appendChild(UI.note(
        '연도별 평균을 그대로 믿는다 — groupby(\'년\')[\'평균기온\'].mean() 은 며칠로 낸 평균인지 말해 주지 ' +
        '않는다. count() 를 항상 같이 낸다.'
      ));
      pitfalls.appendChild(UI.note(
        '"두 값을 한눈에 보고 싶다"는 이유만으로 이중 y축을 쓴다 — 두 선이 겹쳐 보이는 것은 자료의 성질이 ' +
        '아니라 각 축의 범위를 고른 사람의 선택이다. 그림을 나누거나 정규화한다.'
      ));
      pitfalls.appendChild(UI.note(
        '무지개색을 크기 비교에 쓴다 — 무지개는 순서를 따라갈 뿐 크기와 아무 관계가 없다. 크기를 색으로 ' +
        '보이려면 한 색조의 진하기만 쓴다.'
      ));
      root.appendChild(pitfalls);

      // ═══════════════════════════════ 확인 문제
      var refIdxB = years.indexOf(st1.endYear), refIdxA = years.indexOf(st1.endYear - 1);
      var refValA = meanS.at(refIdxA), refValB = meanS.at(refIdxB);
      var refSmaller = Math.min(refValA, refValB), refBigger = Math.max(refValA, refValB);
      var refDiff = refBigger - refSmaller, refPct = refDiff / refSmaller * 100;

      root.appendChild(UI.quiz({
        title: '확인 문제 V5-1',
        question:
          '서울의 ' + (st1.endYear - 1) + '년과 ' + st1.endYear + '년 평균기온 차이는 ' + UI.fmt(refDiff, 2) +
          '℃(약 ' + UI.fmt(refPct, 1) + '%)뿐이다. "그래프가 밋밋해 보인다"는 이유로 y축을 두 값보다 살짝 낮은 ' +
          '값에서 시작해 막대그래프를 그렸다. 무엇이 문제인가?',
        choices: [
          { label: '막대의 길이 비율이 실제 값의 비율과 달라져서, 작은 차이가 훨씬 큰 차이로 보인다', correct: true,
            why: '막대그래프는 길이(0부터 잰 높이)로 크기를 비교하는 그림이다. 축을 0이 아닌 곳에서 시작하면 ' +
              '실제로는 작은 차이가 화면에서는 훨씬 크게 보인다 — 두 막대의 높이 비율이 실제 값의 비율과 달라지기 ' +
              '때문이다.' },
          { label: '축을 어디서 시작하든 막대그래프의 결과는 똑같다', why: '틀렸다. 시뮬레이터 ①에서 y축 시작값을 ' +
            '올려 보면 보이는 비율과 실제 비율이 벌어지는 것을 바로 확인할 수 있다.' },
          { label: '차이가 작을 때는 축을 잘라서 강조하는 것이 올바른 방법이다', why: '틀렸다. 차이가 작다는 사실 ' +
            '자체를 숨기지 않고 그대로 보여 주는 것이 맞다. 정 강조하고 싶으면 막대 위에 실제 값(숫자)을 적는다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V5-2',
        question:
          '서울 연평균기온과 연교차(그 해 최고기온 − 최저기온)의 상관계수는 ' + UI.fmt(corrValue, 2) + '다. ' +
          '두 값을 이중 y축 그래프로 그렸더니 두 선이 거의 겹쳐 보였다면, 이 그림만으로 "기온이 오르면 연교차도 ' +
          '커진다"고 결론 내려도 되는가?',
        choices: [
          { label: '안 된다 — 이중 축에서는 각 축의 범위를 그리는 사람이 정하므로 겹쳐 보이게 만드는 것이 항상 가능하다',
            correct: true,
            why: '실제 상관계수는 ' + UI.fmt(corrValue, 2) + '로 약한 음의 관계일 뿐이다. 이중 y축은 두 축의 범위를 ' +
              '따로 고를 수 있어서, 상관이 약해도 두 선을 겹쳐 보이게 그릴 자유를 그린 사람에게 준다. 관계를 ' +
              '판단하려면 그림을 두 개로 나누거나 상관계수처럼 축과 무관한 수치로 확인해야 한다.' },
          { label: '된다 — 두 선이 겹쳐 보인다는 것 자체가 강한 상관관계의 증거다', why: '틀렸다. 겹쳐 보이는 모양은 ' +
            '축 범위를 고른 사람의 선택으로 얼마든지 만들 수 있다.' },
          { label: '안 된다 — 애초에 이중 y축 그래프는 그릴 수 없다', why: '틀렸다. 이중 y축 자체는 그릴 수 있다. ' +
            '문제는 "그릴 수 있느냐"가 아니라 "그 모양만으로 관계를 판단해도 되느냐"다.' }
        ]
      }));

      var coldAllRef = findColdest(years, meanS, countS, 0);
      var coldFilteredRef = findColdest(years, meanS, countS, 360);
      var excludedRef = years.filter(function (y, i) { return countS.at(i) < 360; }).length;

      root.appendChild(UI.quiz({
        title: '확인 문제 V5-3',
        question:
          "groupby('년')['평균기온'].mean() 으로 구한 서울의 \"가장 추운 해\"는 " + coldAllRef.year + '년(평균 ' +
          UI.fmt(coldAllRef.mean, 2) + '℃)이었다. 그런데 그 해는 날수가 ' + coldAllRef.count + '일뿐이다. 날수 ' +
          '360일 이상인 해만 놓고 다시 구하면 어떻게 되는가?',
        choices: [
          { label: '가장 추운 해가 ' + coldFilteredRef.year + '년(평균 ' + UI.fmt(coldFilteredRef.mean, 2) + '℃)으로 바뀐다',
            correct: true,
            why: coldAllRef.year + '년은 실제로는 ' + coldAllRef.count + '일치 값만 있는데 "연평균"이라는 이름을 ' +
              '달고 있었다. 날수가 충분한 해만 남기면(제외된 해 ' + excludedRef + '개) 가장 추운 해는 ' +
              coldFilteredRef.year + '년으로 바뀐다. mean() 은 있는 값만으로 정직하게 계산했을 뿐이고, 몇 개의 ' +
              '값으로 계산했는지는 따로 확인해야 한다는 것을 보여 주는 예다.' },
          { label: '결과는 바뀌지 않는다 — mean() 은 항상 정확한 연평균을 계산한다', why: '틀렸다. mean() 의 계산 ' +
            '자체는 정확하지만, 며칠치로 낸 평균인지는 스스로 확인해야 한다.' },
          { label: '에러가 나서 계산할 수 없다', why: '틀렸다. 조건에 맞는 해만 골라 다시 계산하는 데는 에러도 ' +
            '경고도 나지 않는다 — 그래서 더 위험하다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V5-4',
        question:
          '인구 피라미드에서 여자 쪽 막대를 왼쪽으로 그리려고 값에 음수를 곱했더니, x축 눈금에도 -50000 같은 ' +
          '값이 그대로 찍혔다. 이 눈금을 그대로 보고서에 실어도 되는가?',
        choices: [
          { label: '안 된다 — 사람 수는 음수가 될 수 없으므로 눈금 글자만 절댓값으로 바꾸고 막대 방향은 그대로 둔다',
            correct: true,
            why: '-50000 은 자료가 아니라 "왼쪽으로 그리기 위해 부호를 뒤집었다"는 그리기 방식의 흔적일 뿐이다. ' +
              '막대의 방향(왼쪽=여자)은 그대로 유지하면서 눈금 라벨만 절댓값 문자열로 바꾸면, 읽는 사람이 ' +
              '음수 인구로 착각하지 않는다.' },
          { label: '된다 — 어차피 왼쪽이 여자라는 것은 범례로 알 수 있다', why: '틀렸다. 범례가 방향의 뜻은 ' +
            '알려주지만, 눈금에 남은 마이너스는 "사람 수가 음수"라는 잘못된 인상을 그대로 남긴다.' },
          { label: '안 된다 — 애초에 남녀를 한 그림에 겹쳐 그리면 안 된다', why: '틀렸다. 인구 피라미드처럼 두 ' +
            '집단을 좌우로 나눠 그리는 것 자체는 널리 쓰이는 방식이다. 문제는 눈금에 부호의 흔적이 남는 것이다.' }
        ]
      }));
    }
  });
})();
