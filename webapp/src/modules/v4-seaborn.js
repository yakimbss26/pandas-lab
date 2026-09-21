/* v4-seaborn.js — V4장. seaborn: 요약해서 그리기 (2부)
 * matplotlib은 점 하나하나의 좌표를 직접 지정하지만, seaborn은 표(df) 하나와 열 이름을 건네면
 * 평균·집계·색 구분을 대신 해 준다. 이 장의 핵심은 "막대 하나가 실제로는 수백 개의 행을 요약한
 * 것"이라는 사실을 데이터로 직접 확인하는 것이다. IIFE 로 감싸고, render 는 여러 번 호출되므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②). 데이터는 seoul_day — 2부는 실데이터다.
 * 브라우저에는 matplotlib·seaborn 이 없으므로 화면은 그 그림이 "무엇을 계산해서 그리는지"를 엔진으로
 * 재현하고, 옆의 UI.code 는 실제로 붙여 넣어 돌릴 수 있는 seaborn 코드를 보여 준다(dataset: 'seoul_day'
 * 가 복사할 때 import·글꼴 두 줄·정리 코드까지 앞에 붙여 준다).
 */
(function () {
  'use strict';

  Lab.register({
    id: 'v4-seaborn',
    part: 2,
    num: 4,
    title: 'seaborn — 요약해서 그리기',
    subtitle: '막대 하나가 실제로는 수백 개의 행을 요약한 것이라는 사실을 데이터로 직접 확인한다',
    sim: '막대 뒤의 행들 · bins 슬라이더 · box·violin·strip · hue가 숫자일 때',

    render: function (root) {
      // ═══════════════════════════ 데이터 준비 (한 번만 — 이후는 캐시된 값으로 그린다)
      var df = LabData.frame('seoul_day');           // 정리된 서울 일별 기온, 42396행
      df.setCol('년', df.col('날짜').dt.year);
      df.setCol('월', df.col('날짜').dt.month);

      var yearArr = df.col('년').toArray();
      var monthArr = df.col('월').toArray();
      var tempArr = df.col('평균기온').toArray();
      var loArr = df.col('최저기온').toArray();
      var hiArr = df.col('최고기온').toArray();
      var nRows = yearArr.length;

      var byYear = {}, byMonth = {}, allTemps = [];
      var i;
      for (i = 0; i < nRows; i++) {
        var t = tempArr[i];
        if (!DF.isNA(t)) {
          allTemps.push(t);
          if (!byYear[yearArr[i]]) byYear[yearArr[i]] = [];
          byYear[yearArr[i]].push(t);
          if (!byMonth[monthArr[i]]) byMonth[monthArr[i]] = [];
          byMonth[monthArr[i]].push(t);
        }
      }
      var years = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });
      var nUniqueTemp = df.col('평균기온').nunique();
      var nUniqueMonth = df.col('월').nunique();

      // ═══════════════════════════════ 도입 — seaborn 은 표를 받는다
      root.appendChild(UI.note(
        "matplotlib은 x값과 y값을 각각 리스트로 넘겼다. seaborn은 다르다 — 표(df) 하나와 그 표의 " +
        '열 이름을 data=, x=, y=로 이름을 붙여 건넨다. 옛날 방식대로 열을 위치 인자로 순서대로 넘기면 ' +
        '지금 버전에서는 실행되지 않는다. 이 장부터는 언제나 이름으로 준다.'
      ));

      root.appendChild(UI.code(
        "sns.scatterplot(data=df, x='최저기온', y='최고기온')\nplt.show()",
        { title: 'data=, x=, y= 를 이름으로', dataset: 'seoul_day' }
      ));

      root.appendChild(UI.code(
        "# ✗ 위치 인자로 넘기면 실행되지 않는다\nsns.boxplot(df['최저기온'], df['최고기온'])",
        { noCopy: true, output: 'TypeError: boxplot() takes from 0 to 1 positional arguments but 2 were given' }
      ));

      // ═══════════════════════════════ 시뮬레이터 ① 막대 뒤의 행들
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 막대 뒤의 행들' }));
      box1.appendChild(UI.note(
        'sns.barplot이 그리는 막대 하나는 그 연도 하루하루의 평균기온을 다시 평균 낸 값이다. 몇 개 ' +
        '연도를 볼지 바꾸고, 검은 오차 막대의 종류를 바꿔 가며 막대 뒤에 실제로 며칠 치 점이 흩어져 ' +
        '있는지 확인하자.'
      ));

      var st1 = { nYears: 5, errorbar: 'ci' };
      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(body1);
        var sel = years.slice(-st1.nYears);
        var groups = sel.map(function (y) { return { label: String(y), values: byYear[y] || [] }; });

        body1.appendChild(UI.columns(groups, {
          title: '최근 ' + st1.nYears + '개 연도의 평균기온 — 막대는 평균 하나',
          yLabel: '평균기온(℃)',
          errorbar: st1.errorbar,
          showPoints: true,
          seed: 7
        }));

        if (st1.errorbar === 'ci') {
          body1.appendChild(UI.note(
            '검은 선은 95% 신뢰구간이고 부트스트랩(재표본추출)으로 구한다. 막대 높이(평균)는 다시 ' +
            '그려도 정확히 같지만, 이 선의 길이는 실행할 때마다 조금씩 달라질 수 있다.',
            null, { kind: 'why' }
          ));
        } else if (st1.errorbar === 'sd') {
          body1.appendChild(UI.note(
            'errorbar를 표준편차로 바꾸면 부트스트랩을 쓰지 않으므로 다시 그려도 선의 길이가 똑같다.'
          ));
        } else {
          body1.appendChild(UI.note(
            '오차 막대를 끄면 막대만 남는다 — 이 막대 하나가 며칠을 평균 낸 것인지는 표 보기의 행 수로 ' +
            '확인해야 한다.'
          ));
        }

        body1.appendChild(UI.code(
          "recent = df[df['년'] >= " + sel[0] + "]\n" +
          "sns.barplot(data=recent, x='년', y='평균기온',\n" +
          '            errorbar=' + (st1.errorbar === 'ci' ? "('ci', 95)" : st1.errorbar === 'sd' ? "'sd'" : 'None') + ')\n' +
          "plt.ylabel('평균기온(℃)')\nplt.show()",
          { dataset: 'seoul_day' }
        ));
      }

      box1.appendChild(UI.slider({
        label: '최근 몇 개 연도', min: 2, max: 8, step: 1, value: st1.nYears,
        onChange: function (v) { st1.nYears = v; rebuild1(); }
      }));
      box1.appendChild(UI.buttonGroup(
        [{ label: "errorbar=('ci', 95)", value: 'ci' }, { label: "errorbar='sd'", value: 'sd' }, { label: 'errorbar=None', value: null }],
        { label: '오차 막대', selected: 0, onChange: function (v) { st1.errorbar = v; rebuild1(); } }
      ));
      box1.appendChild(body1);
      rebuild1();
      root.appendChild(box1);

      // ═══════════════════════════════ 시뮬레이터 ② bins 슬라이더
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② bins 슬라이더' }));
      box2.appendChild(UI.note(
        '평균기온은 서로 다른 값이 ' + nUniqueTemp + '개나 되는 연속값이다. 이런 값을 구간으로 나눠 ' +
        '개수를 세는 것이 histplot이고, 값이 이미 몇 가지로 정해진 것의 개수를 세는 것이 countplot이다. ' +
        '구간 수(bins)를 바꿔 가며 histplot의 모양이 어떻게 달라지는지 보자.'
      ));

      var st2 = { bins: 30 };
      var body2 = UI.el('div');
      function rebuild2() {
        UI.clear(body2);
        body2.appendChild(UI.hist(allTemps, { bins: st2.bins, title: 'histplot(bins=' + st2.bins + ')' }));
        body2.appendChild(UI.code(
          "sns.histplot(data=df, x='평균기온', bins=" + st2.bins + ')\nplt.show()',
          { dataset: 'seoul_day' }
        ));
      }
      box2.appendChild(UI.slider({
        label: 'bins', min: 5, max: 100, step: 5, value: st2.bins,
        onChange: function (v) { st2.bins = v; rebuild2(); }
      }));
      box2.appendChild(body2);
      rebuild2();

      box2.appendChild(UI.danger(
        '같은 열에 countplot을 쓰면',
        '평균기온의 서로 다른 값은 ' + nUniqueTemp + '개다. 값 하나하나를 범주로 보고 막대를 그리는 ' +
        'countplot에 이 열을 넣으면 막대가 정확히 ' + nUniqueTemp + '개 생겨 x축 눈금 글자가 서로 겹쳐 ' +
        '읽을 수 없게 된다. 에러도 경고도 없다.'
      ));
      box2.appendChild(UI.code(
        "# ⚠ 연속값에 countplot 을 쓰면 막대가 " + nUniqueTemp + "개 생긴다\nsns.countplot(data=df, x='평균기온')\nplt.show()",
        { dataset: 'seoul_day' }
      ));
      box2.appendChild(UI.note(
        '범주가 이미 몇 가지로 정해진 값에는 countplot이 맞는 도구다 — 월은 ' + nUniqueMonth + '가지뿐이라 ' +
        '막대 ' + nUniqueMonth + '개로 정리된다.'
      ));
      root.appendChild(box2);

      // ═══════════════════════════════ 시뮬레이터 ③ box · violin · strip
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ box · violin · strip' }));
      box3.appendChild(UI.note(
        '상자그림은 다섯 수치(최솟값·1사분위·중앙값·3사분위·최댓값)로 분포를 요약한다. 월을 하나 ' +
        '고르고 같은 달의 평균기온을 상자그림·violinplot·stripplot 세 방식으로 바꿔 가며 무엇이 보이고 ' +
        '무엇이 가려지는지 비교하자.'
      ));

      var st3 = { month: 8, kind: 'box' };
      var body3 = UI.el('div');
      var KIND_FN = { box: 'boxplot', violin: 'violinplot', strip: 'stripplot' };
      function rebuild3() {
        UI.clear(body3);
        var vals = byMonth[st3.month] || [];
        body3.appendChild(UI.dist([{ label: st3.month + '월', values: vals }], {
          kind: st3.kind, title: st3.month + '월 평균기온 — ' + KIND_FN[st3.kind], yLabel: '평균기온(℃)'
        }));
        // sns.boxplot 만 matplotlib 3.11 의 vert 경고를 낸다(교재 부록 시각화 C-10). 교재처럼 그 문구 하나만 거른다.
        var boxWarn = st3.kind === 'box'
          ? "import warnings\nwarnings.filterwarnings('ignore', message='vert: bool was deprecated')  # seaborn 과 matplotlib 사이의 경고 — 그림은 맞다\n\n"
          : '';
        body3.appendChild(UI.code(
          boxWarn + "month = df[df['월'] == " + st3.month + "]\n" +
          'sns.' + KIND_FN[st3.kind] + "(data=month, x='월', y='평균기온')\nplt.show()",
          { dataset: 'seoul_day' }
        ));
      }
      box3.appendChild(UI.slider({
        label: '월', min: 1, max: 12, step: 1, value: st3.month,
        onChange: function (v) { st3.month = v; rebuild3(); }
      }));
      box3.appendChild(UI.buttonGroup(
        [{ label: 'boxplot', value: 'box' }, { label: 'violinplot', value: 'violin' }, { label: 'stripplot', value: 'strip' }],
        { label: '방식', selected: 0, onChange: function (v) { st3.kind = v; rebuild3(); } }
      ));
      box3.appendChild(body3);
      rebuild3();
      root.appendChild(box3);

      // ═══════════════════════════════ 시뮬레이터 ④ hue 가 숫자일 때
      var box4 = UI.el('div.card');
      box4.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ hue가 숫자일 때' }));
      box4.appendChild(UI.note(
        '월은 1부터 12까지의 정수로 저장돼 있다. 이 열을 그대로 hue에 넘기면 seaborn은 연속값으로 ' +
        '보고 색을 그러데이션으로 칠하며, 범례에는 대표 값 몇 개만 나온다. 문자열로 바꾸면 범례에 12개 ' +
        '항목이 모두 나온다. 계열 색은 최대 3개까지만 뜻을 실을 수 있으므로, 여기서는 산점도는 한 색으로 ' +
        '그리고 범례가 어떻게 달라지는지만 비교한다.'
      ));

      var validIdx = [];
      for (i = 0; i < nRows; i++) if (!DF.isNA(loArr[i]) && !DF.isNA(hiArr[i])) validIdx.push(i);
      var rnd4 = UI.seeded(3);
      var shuffled = validIdx.slice();
      for (var k = shuffled.length - 1; k > 0; k--) {
        var j = Math.floor(rnd4() * (k + 1));
        var tmp = shuffled[k]; shuffled[k] = shuffled[j]; shuffled[j] = tmp;
      }
      var sampleN = Math.min(2000, shuffled.length);
      var sampleIdx = shuffled.slice(0, sampleN);
      var points = sampleIdx.map(function (idx) { return [loArr[idx], hiArr[idx]]; });

      box4.appendChild(UI.scatter([{ name: '표본 ' + sampleN + '개', points: points }], {
        title: '최저기온 vs 최고기온 (표본 ' + sampleN + '개)', xLabel: '최저기온(℃)', yLabel: '최고기온(℃)'
      }));

      var monthsUnique = df.col('월').unique().slice().sort(function (a, b) { return a - b; });
      var numericTicks = UI.niceTicks(monthsUnique[0], monthsUnique[monthsUnique.length - 1], 6);

      box4.appendChild(UI.note('월을 숫자 그대로 hue에 넘기면(연속값) 범례는 대표 눈금만 보여 준다:'));
      box4.appendChild(UI.legend(numericTicks.map(function (t) {
        return { label: String(Math.round(t)), color: 'var(--c-original)' };
      })));
      box4.appendChild(UI.note('월을 문자열로 바꾸면(범주) 범례에 ' + monthsUnique.length + '개 항목이 모두 나온다:'));
      box4.appendChild(UI.legend(monthsUnique.map(function (m) {
        return { label: m + '월', color: 'var(--c-original)' };
      })));

      box4.appendChild(UI.code(
        "sample = df.dropna(subset=['최저기온', '최고기온']).sample(2000, random_state=0)\n" +
        "# ⚠ 숫자 dtype 인 hue 는 연속값으로 취급되어 범례에 대표 값만 나온다\n" +
        "sns.scatterplot(data=sample, x='최저기온', y='최고기온', hue='월', alpha=0.5)\n\n" +
        '# 범주로 다루려면 문자열로 바꾼다\n' +
        "sns.scatterplot(data=sample, x='최저기온', y='최고기온',\n" +
        "                hue=sample['월'].astype(str), alpha=0.5)\nplt.show()",
        { dataset: 'seoul_day' }
      ));
      root.appendChild(box4);

      // ═══════════════════════════════ 상관계수를 색으로 — heatmap
      var box5 = UI.el('div.card');
      box5.appendChild(UI.el('div.panel-title', { text: '상관계수를 색으로 — heatmap' }));
      box5.appendChild(UI.note(
        '상관계수는 두 열이 함께 변하는 정도를 잰다. 지점처럼 이 파일 전체에서 값이 한 종류뿐인 열을 ' +
        '넣으면 그 값은 전혀 변하지 않으므로 상관계수를 정의할 수 없어 그 행과 열이 통째로 NaN이 된다.'
      ));
      var corrSrc = df.cols(['지점', '평균기온', '최저기온', '최고기온', '년', '월']);
      var corrDf = corrSrc.corr({ numericOnly: true });
      var corrNames = corrDf.columns;
      var corrValues = corrNames.map(function (r, ri) {
        return corrNames.map(function (c) { return corrDf.col(c).at(ri); });
      });
      box5.appendChild(UI.heatmap(corrNames, corrNames, corrValues, {
        scale: 'diverging', digits: 2, title: '상관계수 (numeric_only=True)'
      }));
      box5.appendChild(UI.code(
        "temp_corr = df[['지점', '평균기온', '최저기온', '최고기온', '년', '월']].corr(numeric_only=True)\n" +
        "sns.heatmap(temp_corr, annot=True, fmt='.2f', cmap='coolwarm', vmin=-1, vmax=1)\nplt.show()",
        { dataset: 'seoul_day' }
      ));
      root.appendChild(box5);

      // ═══════════════════════════════ 흔한 실수
      var pitfalls = UI.el('div.card');
      pitfalls.appendChild(UI.el('div.panel-title', { text: '흔한 실수' }));
      pitfalls.appendChild(UI.note(
        '막대그래프의 높이만 보고 뒤에 행이 몇 개 있는지 확인하지 않는다 — 행 5개의 평균과 행 500개의 ' +
        '평균이 같은 굵기의 막대로 그려진다. 오차 막대의 길이나 표 보기의 행 수를 함께 본다.'
      ));
      pitfalls.appendChild(UI.note(
        '연속값에 countplot을 쓴다 — 에러 없이 막대가 수백 개 생겨 아무것도 읽을 수 없다. 구간을 나눠야 ' +
        '하면 histplot이다.'
      ));
      pitfalls.appendChild(UI.note(
        "distplot이 경고를 낸다고 '없어졌다'고 단정한다 — 지금 버전에서는 여전히 실행된다. 다음 버전에서 " +
        '없어질 예정이라는 경고일 뿐이라 실제로 실행해서 확인해야 한다.'
      ));
      pitfalls.appendChild(UI.note(
        '숫자로 저장된 범주(월, 년 같은)를 그대로 hue에 넘긴다 — seaborn이 연속값으로 오해해 범례가 ' +
        '줄어든다. 범주로 쓰려면 문자열로 바꾼다.'
      ));
      root.appendChild(pitfalls);

      // ═══════════════════════════════ 확인 문제
      root.appendChild(UI.quiz({
        title: '확인 문제 V4-1',
        question: '2020년 평균기온 막대 하나의 높이는 실제로 무엇을 나타내는가?',
        choices: [
          { label: '2020년 하루하루의 평균기온을 다시 평균 낸 값', correct: true,
            why: 'sns.barplot은 같은 x값을 가진 행을 모두 모아 평균을 낸 뒤 그 평균을 막대 높이로 그린다. ' +
              '2020년은 하루하루의 값이 366개 있고, 막대는 그 366개를 평균 낸 값이다.' },
          { label: '2020년 중 가장 더웠던 하루의 평균기온', why: '틀렸다. 그건 최댓값이지 barplot이 그리는 값이 아니다.' },
          { label: '2020년 1월 1일의 평균기온', why: '틀렸다. barplot은 첫 값이 아니라 평균을 그린다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V4-2',
        question: "평균기온처럼 서로 다른 값이 " + nUniqueTemp + "개나 되는 연속값에 countplot을 쓰면 무슨 일이 일어나는가?",
        choices: [
          { label: '값의 가짓수만큼(' + nUniqueTemp + '개) 막대가 생겨 x축을 읽을 수 없게 된다', correct: true,
            why: 'countplot은 값 하나하나를 범주로 보고 막대를 그린다. 서로 다른 값이 ' + nUniqueTemp + '개면 ' +
              '막대도 ' + nUniqueTemp + '개 생긴다.' },
          { label: '자동으로 구간을 나눠 histplot처럼 그려진다', why: '틀렸다. countplot은 구간을 나누지 않는다 — 그 일을 하는 것이 histplot이다.' },
          { label: '에러가 나서 그래프가 그려지지 않는다', why: '틀렸다. 에러도 경고도 없이 그림은 그려진다. 다만 읽을 수 없을 뿐이다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V4-3',
        question: '상자그림의 수염(whisker)은 어디까지 뻗는가?',
        choices: [
          { label: '데이터의 최솟값부터 최댓값까지', why: '틀렸다. 그러면 이상치도 수염 안에 들어가 상자그림의 의미가 없어진다.' },
          { label: '1사분위·3사분위에서 1.5·IQR만큼 뻗되, 그 범위 안에 있는 가장 먼 실제 값까지', correct: true,
            why: '수염은 1.5·IQR 지점 자체가 아니라 그 지점 안쪽에 있는 가장 먼 실제 데이터 값까지 뻗는다. ' +
              '그 밖의 값은 점(이상치)으로 따로 찍는다.' },
          { label: '평균 ± 표준편차', why: '틀렸다. 그건 정규분포를 요약하는 다른 방법이고 상자그림은 사분위수를 쓴다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V4-4',
        question: "월을 정수 그대로 hue='월'에 넘기면 범례에 어떤 일이 일어나는가?",
        choices: [
          { label: '12개 달이 모두 범례에 나온다', why: '틀렸다. 점은 12개 달 전부 제대로 색이 칠해지지만 범례 항목은 줄어든다.' },
          { label: 'seaborn이 연속값으로 보고 색을 그러데이션으로 칠해 범례에 대표 값만 나온다', correct: true,
            why: '정수 dtype인 열은 seaborn이 범주가 아니라 연속값으로 해석한다. 그 결과 색은 띠(그러데이션)가 ' +
              '되고 범례에는 몇 개의 대표 값만 나온다. 점은 12개 달 모두 제대로 칠해진다.' },
          { label: '에러가 나서 그래프가 그려지지 않는다', why: '틀렸다. 에러도 경고도 없이 조용히 실행된다 — 그래서 알아채기 어렵다.' }
        ]
      }));
    }
  });
})();
