/* v2-reshape.js — V2장. 넓은 표와 긴 표: melt 와 pivot_table (2부, docs/draft/v1-v2-strdate-reshape.md V2장)
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로 가변 상태는
 * 전부 render 안의 지역 변수(각 시뮬레이터의 st 객체)에 둔다(API.md §1 ②).
 *
 * 이 장의 데이터(korea_pop, seoul_day)는 2부 실데이터다 — 합성이 아니다(API.md §3). 시도 이름 같은
 * 값도 가능한 한 LabData 에서 읽어서 쓴다(웹앱 CLAUDE.md "원본 데이터의 값을 코드에 적지 마라").
 * 표는 전부 UI.frameTable/UI.table 로 그린다. 색은 API.md §1 ③ 대로 원본=파랑/사본=주황/결과=초록만 쓴다.
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────── 순수 도우미
  // (상태가 없는 계산·설정 자료만 모듈 스코프에 둔다. ch12-merge.js 의 PRESETS_MERGE 와 같은 패턴.)

  var AXIS_OPTS = [{ label: '년', value: '년' }, { label: '월', value: '월' }];
  var VALUE_OPTS = [
    { label: '평균기온', value: '평균기온' }, { label: '최저기온', value: '최저기온' }, { label: '최고기온', value: '최고기온' }
  ];
  var AGG_OPTS = [
    { label: 'mean (평균)', value: 'mean' }, { label: 'sum (합)', value: 'sum' }, { label: 'count (날수)', value: 'count' },
    { label: 'min (최소)', value: 'min' }, { label: 'max (최대)', value: 'max' }, { label: 'median (중앙값)', value: 'median' }
  ];

  /* index/columns 가 같은 축을 고르면 반대쪽으로 밀어낸다. */
  function otherAxis(v) { return v === '년' ? '월' : '년'; }

  /* pop 의 '시도' 열(전국 제외)을 원래 순서 그대로 3개씩 묶어 멜트 시뮬레이터의 예제 묶음을 만든다.
   * 이름을 코드에 직접 적지 않고 LabData 에서 읽은 값을 그대로 쓰기 위한 방법이다. */
  function buildProvinceSets(pop) {
    var all = pop.col('시도').toArray().filter(function (v) { return v !== '전국'; });
    var sets = [];
    for (var i = 0; i + 2 < all.length; i += 3) sets.push(all.slice(i, i + 3));
    if (all.length % 3 !== 0) sets.push(all.slice(all.length - 3));
    return sets;
  }

  Lab.register({
    id: 'v2-reshape',
    part: 2,
    num: 2,
    title: '넓은 표와 긴 표 — melt 와 pivot_table',
    subtitle: '310열짜리 인구 표를 melt 로 세로로 풀고 pivot_table 로 다시 넓힌다. 위치로 고른 열은 표가 바뀌면 조용히 어긋난다',
    sim: 'melt 애니메이션 · pivot_table 조립기 · 열이 하나 끼면',

    render: function (root) {
      var pop = LabData.frame('korea_pop');
      // '시도' 열은 cleanupSection() 이 직접 만든다 — introSection/thousandsSection 이 청소 전 원본
      // 열 개수(310)를 그대로 보여줘야 하기 때문이다. pop 은 같은 참조라 이후 섹션에도 반영된다.

      var sd = LabData.frame('seoul_day');
      sd.setCol('년', sd.col('날짜').dt.year);
      sd.setCol('월', sd.col('날짜').dt.month);

      root.appendChild(introSection(pop));
      root.appendChild(thousandsSection(pop));
      root.appendChild(cleanupSection(pop));
      root.appendChild(simMelt(pop));
      root.appendChild(simPivot(sd));
      root.appendChild(simColumnShift(pop));
      root.appendChild(commonMistakes(pop));
      root.appendChild(quizSection(pop, sd));
    }
  });

  // ───────────────────────────────── 문제 제기 — 이름이 있는데도 못 찾는다

  function introSection(pop) {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '문제 제기 — 이름이 있는데도 못 찾는다' }));
    box.appendChild(UI.note(
      '시도별 연령별 인구 파일은 ' + pop.shape[0] + '행 × ' + pop.shape[1] + '열이다(전국 + 17개 시도). ' +
      "그런데 '행정구역' 열의 값으로 서울 행을 찾으면 결과가 늘 0행이다."
    ));

    var zero = pop.mask(pop.col('행정구역').eq('서울특별시'));
    box.appendChild(UI.code(
      "pop[pop['행정구역'] == '서울특별시'].shape",
      { output: '(' + zero.shape[0] + ', ' + zero.shape[1] + ')', dataset: 'korea_pop' }
    ));

    var raw = pop.col('행정구역').at(1);
    box.appendChild(UI.code("pop['행정구역'].iloc[1]", { output: "'" + raw + "'", dataset: 'korea_pop' }));
    box.appendChild(UI.note(
      "값을 직접 열어 보면 '" + raw + "' 다. 이름 뒤에 공백 두 칸과 행정구역 코드가 붙어 있어 '서울특별시' 와 " +
      '정확히 같은 문자열이 아니다. == 비교는 한 글자라도 다르면 전부 다른 문자열로 본다.',
      '왜 0행인가'
    ));
    return box;
  }

  // ───────────────────────────────── ⚠ thousands 를 빼면

  function thousandsSection(pop) {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '⚠ thousands 를 빼면' }));

    var totalCol = '2021년08월_계_총인구수';
    var sample = pop.col(totalCol).at(0).toLocaleString('en-US');
    box.appendChild(UI.note(
      "'" + sample + "' 처럼 쉼표가 든 값은 thousands=',' 없이 읽으면 숫자로 파싱되지 않고 문자열로 남는다."
    ));

    var strVals = pop.col(totalCol).toArray().map(function (v) { return v.toLocaleString('en-US'); });
    var strFrame = DF.frame({ v: strVals }, { columns: ['v'] }).declareDtypes({ v: 'str' });
    var concatSum = strFrame.col('v').sum();

    box.appendChild(UI.code(
      "pop = pd.read_csv('korea_pop.csv', encoding='cp949')  # thousands 없이\n" +
      "s = pop['" + totalCol + "'].sum()\nlen(s)",
      { output: String(concatSum.length) }
    ));
    box.appendChild(UI.code('s[:40]', { output: "'" + concatSum.slice(0, 40) + "'", noCopy: true }));
    box.appendChild(UI.danger(
      '숫자를 더한 것이 아니다',
      '에러가 없어서 계산이 된 것처럼 보이지만, 실제로는 ' + pop.shape[0] + '개 시도의 문자열을 그대로 이어붙인 것이다. ' +
      "문자열 Series 의 sum() 은 덧셈이 아니라 이어붙이기다."
    ));

    var realSum = pop.col(totalCol).sum();
    box.appendChild(UI.code(
      "pop['" + totalCol + "'].sum()",
      { output: String(realSum), dataset: 'korea_pop' }
    ));
    box.appendChild(UI.note(
      '첫 행 전국(' + pop.col(totalCol).at(0).toLocaleString('en-US') + '명)이 이미 17개 시도의 합이라, ' +
      '전부 더하면 같은 사람을 두 번 센다 — 실제 인구의 두 배가 나온다. 전국 행을 빼고 더해야 한다.'
    ));
    return box;
  }

  // ───────────────────────────────── 행정구역 청소 — 시도 이름 뽑기

  function cleanupSection(pop) {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '행정구역 청소 — 시도 이름 뽑기' }));

    pop.setCol('시도', pop.col('행정구역').str.split('\\s+\\(', { regex: true, expand: true }).col(0));
    var names = pop.col('시도').toArray();
    var namesRepr = '[' + names.map(function (n) { return "'" + n + "'"; }).join(', ') + ']';
    box.appendChild(UI.code(
      "pop = pop.copy()   # 열 309개가 따로 저장돼 있어 바로 열을 더하면 성능 경고가 난다\n" +
      "pop['시도'] = pop['행정구역'].str.split(r'\\s+\\(', regex=True, expand=True)[0]\npop['시도'].tolist()",
      { output: namesRepr, dataset: 'korea_pop' }
    ));
    box.appendChild(UI.note(
      '공백 하나 이상(\\s+)과 여는 괄호(\\() 를 기준으로 쪼개고 앞 조각만 남겼다. 정리된 시도 이름이 ' +
      names.length + '개 나왔다 — 전국을 포함한 개수와 같다.'
    ));

    var found = pop.mask(pop.col('시도').eq('서울특별시'));
    box.appendChild(UI.code(
      "pop[pop['시도'] == '서울특별시'].shape",
      { output: '(' + found.shape[0] + ', ' + found.shape[1] + ')', noCopy: true }
    ));
    box.appendChild(UI.note('이제 이름으로 정확히 찾을 수 있다.'));
    return box;
  }

  // ───────────────────────────────── 시뮬레이터 ① melt 애니메이션

  function simMelt(pop) {
    var provinceSets = buildProvinceSets(pop);
    var st = { setIdx: 0, startAge: 0, provIdx: 0, ageIdx: 0 };

    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① melt 애니메이션 — 넓은 표가 긴 표로 풀리는 과정' }));
    box.appendChild(UI.note(
      '시도 3곳 × 나이 3개로 만든 작은 넓은 표를 melt() 로 세로로 푼다. 칸 하나를 고르면 그 값이 긴 표의 ' +
      '몇 번째 행이 되는지 링으로 따라갈 수 있다.'
    ));

    var ctl = UI.el('div.control-row');
    ctl.appendChild(UI.buttonGroup(
      provinceSets.map(function (s, i) { return { label: s.join(' · '), value: i }; }),
      { label: '시도 3곳', selected: 0, onChange: function (v, i) { st.setIdx = i; st.provIdx = 0; rebuild(); } }
    ));
    ctl.appendChild(UI.slider({
      label: '시작 나이', min: 0, max: 40, step: 20, value: st.startAge,
      onChange: function (v) { st.startAge = v; rebuild(); }
    }));
    box.appendChild(ctl);

    var pickCtl = UI.el('div.control-row');
    box.appendChild(pickCtl);

    var body = UI.el('div');
    box.appendChild(body);

    function currentProvinces() { return provinceSets[st.setIdx]; }
    function currentAges() { return [st.startAge, st.startAge + 20, st.startAge + 40]; }

    function rebuild() {
      UI.clear(pickCtl);
      UI.clear(body);

      var provinces = currentProvinces();
      var ages = currentAges();
      if (st.provIdx >= provinces.length) st.provIdx = 0;
      if (st.ageIdx >= ages.length) st.ageIdx = 0;

      pickCtl.appendChild(UI.buttonGroup(
        provinces.map(function (p, i) { return { label: p, value: i }; }),
        { label: '선택한 시도', selected: st.provIdx, onChange: function (v, i) { st.provIdx = i; rebuild(); } }
      ));
      pickCtl.appendChild(UI.buttonGroup(
        ages.map(function (a, i) { return { label: a + '세', value: i }; }),
        { label: '선택한 나이', selected: st.ageIdx, onChange: function (v, i) { st.ageIdx = i; rebuild(); } }
      ));

      var ageCols = ages.map(function (a) { return '2021년08월_계_' + a + '세'; });
      var ageLabels = ages.map(function (a) { return a + '세'; });
      var renameMap = {};
      ageCols.forEach(function (c, i) { renameMap[c] = ageLabels[i]; });

      // isin 은 pop 에 저장된 원래 순서를 따르는데, provinces 자체가 그 원래 순서를 그대로 3개씩
      // 끊어 만든 것이라 결과 행 순서가 항상 provinces 순서와 같다(buildProvinceSets 참고).
      var wide = pop.mask(pop.col('시도').isin(provinces)).cols(['시도'].concat(ageCols)).rename(renameMap);
      var long = wide.melt({ idVars: '시도', varName: '나이대', valueName: '인구수' });

      var selProvince = provinces[st.provIdx];
      var selAgeLabel = ageLabels[st.ageIdx];
      // melt 는 "나이대 열 하나의 모든 행 -> 다음 나이대" 순서로 쌓는다(df.js melt 구현, 실제 pandas 와 같다).
      var longPos = st.ageIdx * provinces.length + st.provIdx;

      body.appendChild(UI.el('div.panel-title', { text: '넓은 표 (시도 × 나이대)' }));
      body.appendChild(UI.frameTable(wide, {
        frame: 'original', caption: wide.shape[0] + '행 × ' + wide.shape[1] + '열',
        hlCells: [[st.provIdx, selAgeLabel]]
      }));

      body.appendChild(UI.code(
        "long = wide.melt(id_vars='시도', var_name='나이대', value_name='인구수')\nlong.shape",
        { output: '(' + long.shape[0] + ', ' + long.shape[1] + ')', noCopy: true }
      ));

      body.appendChild(UI.el('div.panel-title', { text: '긴 표 (melt 결과)' }));
      body.appendChild(UI.frameTable(long, {
        frame: 'result', caption: long.shape[0] + '행 × ' + long.shape[1] + '열',
        hlRows: [longPos]
      }));

      body.appendChild(UI.note(
        '넓은 표에서 링을 두른 칸 — ' + selProvince + '의 ' + selAgeLabel + '(' +
        UI.fmt(wide.col(selAgeLabel).at(st.provIdx)) + '명) — 은 긴 표의 ' + longPos + '번 행이 됐다. ' +
        'melt 는 나이대 열 하나의 모든 시도를 먼저 쌓고 다음 나이대로 넘어간다 — 그래서 같은 나이대끼리 ' +
        provinces.length + '행씩 붙어 있다. 넓은 표의 인구 칸 ' + (provinces.length * ageLabels.length) +
        '개가 긴 표의 인구수 열 ' + long.shape[0] + '행이 됐다 — 값은 그대로고 모양만 바뀌었다.'
      ));

      body.appendChild(extractSubsection(pop, selProvince, ages));
    }

    rebuild();
    return box;
  }

  /* 열 이름에서 성별·나이를 str.extract 로 뽑는 단계. 선택한 시도 하나, 나이 3개로 성별×나이 열을 만들고
   * melt 뒤 정규식으로 갈라낸다(교재 V2.6 제주 예제와 같은 방식). */
  function extractSubsection(pop, province, ages) {
    var box = UI.el('div');
    box.appendChild(UI.el('div.panel-title', { text: '열 이름에서 성별·나이 뽑기 — str.extract' }));
    box.appendChild(UI.note(
      province + ' 하나만 골라 성별(남·여) × 나이(' + ages.join(', ') + ') 로 열 이름을 만든 표를 melt 한 뒤, ' +
      '열 이름 하나에 섞여 있던 성별과 나이를 정규식으로 갈라낸다.'
    ));

    var sexes = ['남', '여'];
    var colsGA = [];
    sexes.forEach(function (s) { ages.forEach(function (a) { colsGA.push('2021년08월_' + s + '_' + a + '세'); }); });

    var row = pop.mask(pop.col('시도').eq(province)).cols(['시도'].concat(colsGA));
    var longGA = row.melt({ idVars: '시도', varName: '열이름', valueName: '인구수' });
    var ext = longGA.col('열이름').str.extract('_(남|여)_(\\d+)세');
    longGA.setCol('성별', ext.col(0));
    longGA.setCol('나이', ext.col(1).astype('int64'));
    var shown = longGA.cols(['시도', '열이름', '성별', '나이', '인구수']);

    box.appendChild(UI.code(
      "long = row.melt(id_vars='시도', var_name='열이름', value_name='인구수')\n" +
      "ext = long['열이름'].str.extract(r'_(남|여)_(\\d+)세')\n" +
      "long['성별'] = ext[0]\nlong['나이'] = ext[1].astype(int)",
      { output: shown.toString(shown.shape[0]), noCopy: true }
    ));
    box.appendChild(UI.frameTable(shown, {
      frame: 'result', caption: province + ' — 열 이름 하나에 있던 성별·나이가 각자 열을 갖게 됐다'
    }));
    return box;
  }

  // ───────────────────────────────── 시뮬레이터 ② pivot_table 조립기

  function simPivot(sd) {
    var st = { index: '년', columns: '월', values: '평균기온', aggfunc: 'mean', rowPos: 0, colPos: 0 };

    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② pivot_table 조립기' }));
    box.appendChild(UI.note(
      '서울 일별 기온 ' + sd.shape[0] + '행으로 index·columns·values·aggfunc 를 바꿔 가며 결과 표를 조립해 본다. ' +
      '칸 하나를 골라 그 칸에 며칠치 값이 모여 뭉쳐졌는지도 확인한다.'
    ));

    var ctl = UI.el('div.control-row');
    ctl.appendChild(UI.buttonGroup(AXIS_OPTS, {
      label: 'index', selected: 0,
      onChange: function (v) { st.index = v; if (st.columns === v) st.columns = otherAxis(v); rebuild(); }
    }));
    ctl.appendChild(UI.buttonGroup(AXIS_OPTS, {
      label: 'columns', selected: 1,
      onChange: function (v) { st.columns = v; if (st.index === v) st.index = otherAxis(v); rebuild(); }
    }));
    ctl.appendChild(UI.buttonGroup(VALUE_OPTS, {
      label: 'values', selected: 0, onChange: function (v) { st.values = v; rebuild(); }
    }));
    ctl.appendChild(UI.buttonGroup(AGG_OPTS, {
      label: 'aggfunc', selected: 0, onChange: function (v) { st.aggfunc = v; rebuild(); }
    }));
    box.appendChild(ctl);

    var body = UI.el('div');
    box.appendChild(body);

    function rebuild() {
      UI.clear(body);
      var pt = sd.pivotTable({ index: st.index, columns: st.columns, values: st.values, aggfunc: st.aggfunc });

      body.appendChild(UI.code(
        "df.pivot_table(index='" + st.index + "', columns='" + st.columns + "', values='" + st.values +
        "', aggfunc='" + st.aggfunc + "')",
        // 출력은 싣지 않는다 — 엔진의 toString 은 pandas 처럼 열마다 자릿수를 맞추지 않고
        // 월·년 이름 줄도 없어서, 학생이 돌린 화면과 다르게 보인다. 값은 아래 표로 본다.
        { dataset: 'seoul_day' }
      ));
      body.appendChild(UI.frameTable(pt, {
        frame: 'result', maxRows: 8, digits: 2,
        caption: '결과 — ' + pt.shape[0] + '행 × ' + pt.shape[1] + '열 (index=' + st.index + ', columns=' + st.columns + ')'
      }));

      var rowKeys = pt.index.labels, colKeys = pt.columns;
      if (st.rowPos >= rowKeys.length) st.rowPos = 0;
      if (st.colPos >= colKeys.length) st.colPos = 0;

      var pickCtl = UI.el('div.control-row');
      pickCtl.appendChild(UI.slider({
        label: '칸 조회 — ' + st.index + ' 위치', min: 0, max: rowKeys.length - 1, value: st.rowPos,
        onChange: function (v) { st.rowPos = v; rebuild(); }
      }));
      pickCtl.appendChild(UI.slider({
        label: '칸 조회 — ' + st.columns + ' 위치', min: 0, max: colKeys.length - 1, value: st.colPos,
        onChange: function (v) { st.colPos = v; rebuild(); }
      }));
      body.appendChild(pickCtl);

      var rk = rowKeys[st.rowPos], ck = colKeys[st.colPos];
      var rows = pt.cellRows(rk, ck);
      var cellVal = pt.col(ck).loc(rk);
      body.appendChild(UI.code(
        "df[(df['" + st.index + "'] == " + rk + ") & (df['" + st.columns + "'] == " + ck +
        ")].shape[0]  # 이 칸에 모인 행 수",
        { output: rows.length, dataset: 'seoul_day' }
      ));
      body.appendChild(UI.note(rows.length === 0
        ? st.index + '=' + rk + ', ' + st.columns + '=' + ck + ' 칸에는 모인 행이 하나도 없다. 그래서 이 칸은 NaN 이다 — ' +
          '관측이 없던 달이다.'
        : st.index + '=' + rk + ', ' + st.columns + '=' + ck + ' 칸에는 원본의 ' + rows.length + '개 행이 모였고, ' +
          st.aggfunc + ' 로 묶어 ' + UI.fmt(cellVal, 2) + ' 이 됐다.'
      ));

      try {
        sd.pivot({ index: st.index, columns: st.columns, values: st.values });
        body.appendChild(UI.note(
          '이 조합은 (' + st.index + ', ' + st.columns + ') 마다 행이 정확히 하나뿐이라 pivot() 도 에러 없이 된다.'
        ));
      } catch (e) {
        body.appendChild(UI.code(
          "df.pivot(index='" + st.index + "', columns='" + st.columns + "', values='" + st.values + "')",
          { output: e.message, dataset: 'seoul_day' }
        ));
        body.appendChild(UI.danger(
          'pivot 은 중복을 못 견딘다',
          '같은 (' + st.index + ', ' + st.columns + ') 조합이 여러 번 나오면 pivot() 은 멈춘다. pivot_table() 은 ' +
          'aggfunc(' + st.aggfunc + ')으로 그 값들을 뭉쳐서 에러 없이 계속 진행한다.'
        ));
      }
    }

    rebuild();
    return box;
  }

  // ───────────────────────────────── 시뮬레이터 ③ 열이 하나 끼면

  function simColumnShift(pop) {
    var startName = '2021년08월_남_0세', endName = '2021년08월_남_100세 이상';
    var start = pop.columns.indexOf(startName);
    var end = pop.columns.indexOf(endName) + 1;
    var regexPat = '_남_\\d+세$|_남_100세 이상$';

    var st = { inserted: false };
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 열이 하나 끼면' }));
    box.appendChild(UI.note(
      '남자 나이별 인구(' + (end - start) + '개 열)는 지금 열 순서에서 위치 ' + start + '부터 ' + (end - 1) +
      '까지에 있다. 앞쪽에 열을 하나 끼워 넣어도 iloc 과 filter(regex=) 가 똑같이 반응하는지 비교해 보자.'
    ));

    box.appendChild(UI.toggle({
      label: "앞쪽에 '전입' 열 끼워 넣기", value: st.inserted,
      onChange: function (on) { st.inserted = on; rebuild(); }
    }));

    var body = UI.el('div');
    box.appendChild(body);

    function withInsertedColumn(df) {
      var cols = df.columns.slice();
      var obj = {};
      cols.forEach(function (c) { obj[c] = df.col(c).toArray(); });
      var newCols = [cols[0], '전입'].concat(cols.slice(1));
      obj['전입'] = df.col(cols[0]).toArray().map(function () { return 0; });
      return DF.frame(obj, { columns: newCols });
    }

    function rebuild() {
      UI.clear(body);
      var target = st.inserted ? withInsertedColumn(pop) : pop;
      var varName = st.inserted ? 'pop2' : 'pop';

      var nam = target.iloc(0, { slice: true, start: start, stop: end });
      var namLabels = nam.columns;
      var namVar = st.inserted ? '남2' : '남';
      var ilocOpts = { output: "('" + namLabels[0] + "', '" + namLabels[namLabels.length - 1] + "')" };
      if (st.inserted) ilocOpts.noCopy = true; else ilocOpts.dataset = 'korea_pop';
      body.appendChild(UI.code(
        namVar + ' = ' + varName + '.iloc[0, ' + start + ':' + end + ']\n' +
        namVar + '.index[0], ' + namVar + '.index[-1]',
        ilocOpts
      ));

      if (st.inserted) {
        body.appendChild(UI.danger(
          '조용히 밀렸다',
          '같은 ' + start + ':' + end + ' 인데 이제 ' + namLabels[0] + ' 부터 ' + namLabels[namLabels.length - 1] +
          ' 까지를 가리킨다. 원래 뽑으려던 ' + startName + ' ~ ' + endName + ' 이 아니다 — 에러도 경고도 없다.'
        ));
      } else {
        body.appendChild(UI.note('열이 끼기 전에는 이 위치가 정확히 ' + startName + ' ~ ' + endName + ' 이다.'));
      }

      var fil = target.filter({ regex: regexPat });
      var filOpts = { output: '(' + fil.shape[0] + ', ' + fil.shape[1] + ')' };
      if (st.inserted) filOpts.noCopy = true; else filOpts.dataset = 'korea_pop';
      body.appendChild(UI.code(varName + ".filter(regex=r'" + regexPat + "').shape", filOpts));
      body.appendChild(UI.note(
        'filter(regex=) 는 열 이름의 패턴을 보고 고르므로 열이 끼어들어도 똑같이 ' + fil.shape[1] + '개(' +
        fil.columns[0] + ' ~ ' + fil.columns[fil.columns.length - 1] + ')를 정확히 찾는다. 위치는 표의 모양이 ' +
        '바뀌면 부서지기 쉽지만, 이름으로 고르면 흔들리지 않는다.'
      ));
    }

    rebuild();
    return box;
  }

  // ───────────────────────────────── 흔한 실수

  function commonMistakes(pop) {
    var box = UI.el('div.card');
    box.appendChild(UI.el('div.panel-title', { text: '흔한 실수' }));

    box.appendChild(UI.el('div.panel-title', { text: '① melt 에서 id_vars 를 빠뜨리면' }));
    var demo = pop.mask(pop.col('시도').isin(['서울특별시', '부산광역시']))
      .cols(['시도', '2021년08월_계_0세', '2021년08월_계_20세'])
      .rename({ '2021년08월_계_0세': '0세', '2021년08월_계_20세': '20세' });
    var noId = demo.melt({ varName: '나이대', valueName: '인구수' });

    box.appendChild(UI.frameTable(demo, { frame: 'original', caption: "wide — 컬럼 [" + demo.columns.join(', ') + ']' }));
    box.appendChild(UI.code(
      "wide.melt(var_name='나이대', value_name='인구수')  # id_vars 없이",
      { output: noId.toString(), noCopy: true }
    ));
    box.appendChild(UI.danger(
      "'시도' 열까지 녹았다",
      'id_vars 를 안 주면 pandas 는 유지할 열이 없다고 보고 모든 열을 녹인다. 그 결과 인구수 열의 dtype 이 ' +
      "'" + noId.dtypes()['인구수'] + "' 로 바뀌었다 — 원래 숫자였던 값과 시도 이름이 한 열에 섞여 들어갔다는 뜻이다."
    ));

    box.appendChild(UI.el('div.panel-title', { text: '② pivot 과 pivot_table 을 바꿔 쓴다' }));
    box.appendChild(UI.note(
      '데이터가 어느 쪽인지 모르겠으면 pivot_table 이 더 안전하다. 위 시뮬레이터 ②에서 aggfunc 를 무엇으로 ' +
      '두든 pivot() 은 늘 실패한다 — 서울 기온은 하루하루가 다 다른 행이라 (년, 월) 조합이 항상 여러 번 ' +
      '겹치기 때문이다.'
    ));

    box.appendChild(UI.el('div.panel-title', { text: '③ 위치가 항상 안전하다고 믿는다' }));
    box.appendChild(UI.note(
      '지금 열 순서에서만 맞는 코드다. 열이 하나만 끼어들어도 iloc 은 조용히 다른 값을 가리킨다 — ' +
      '시뮬레이터 ③에서 직접 확인한 그대로다. 이름으로 고를 수 있으면(filter(regex=), 라벨 색인) 그쪽을 우선한다.'
    ));

    return box;
  }

  // ───────────────────────────────── 확인 문제

  function quizSection(pop, sd) {
    var wrap = UI.el('div');
    wrap.appendChild(UI.el('div.panel-title', { text: '확인 문제' }));

    // V2-1 — thousands 없이 읽고 sum()
    var totalCol = '2021년08월_계_총인구수';
    var strVals = pop.col(totalCol).toArray().map(function (v) { return v.toLocaleString('en-US'); });
    var strFrame = DF.frame({ v: strVals }, { columns: ['v'] }).declareDtypes({ v: 'str' });
    var concatLen = strFrame.col('v').sum().length;
    var realSum = pop.col(totalCol).sum();

    wrap.appendChild(UI.quiz({
      title: '확인 문제 V2-1',
      question:
        "korea_pop.csv 를 thousands=',' 없이 읽고 '" + totalCol + "' 열의 sum() 을 구하면 왜 숫자가 아니라 문자열이 나오는가?",
      choices: [
        { label: '쉼표가 든 값이 문자열로 남아서 sum() 이 이어붙이기가 되기 때문이다', correct: true,
          why: "쉼표가 든 '51,669,716' 같은 값은 숫자로 파싱되지 않고 문자열로 남는다. 문자열 Series 의 sum() 은 " +
            '덧셈이 아니라 이어붙이기라서 ' + pop.shape[0] + '개 시도의 문자열이 그대로 이어진 ' + concatLen + '자짜리 값이 나온다.' },
        { label: 'pandas 버전이 낮아서 안 되는 기능이다',
          why: '오답이다. 버전과 무관하게 문자열 dtype 의 sum() 은 이어붙이기다.' },
        { label: '열 이름을 잘못 썼기 때문이다',
          why: '오답이다. 열 이름은 맞다 — thousands 옵션을 빼고 읽은 것이 원인이다.' }
      ],
      explain: "thousands=',' 로 읽어야 처음부터 숫자(int64)가 되어 sum() 이 " + UI.fmt(realSum) + ' 이 된다.'
    }));

    // V2-2 — iloc vs filter
    var startName = '2021년08월_남_0세', endName = '2021년08월_남_100세 이상';
    var start = pop.columns.indexOf(startName), end = pop.columns.indexOf(endName) + 1;

    wrap.appendChild(UI.quiz({
      title: '확인 문제 V2-2',
      question: 'pop.iloc[0, ' + start + ':' + end + '] 로 남자 나이별 인구를 뽑는 코드가 왜 부서지기 쉬운가?',
      choices: [
        { label: '지금 열 순서에서만 맞고, 앞에 열이 하나 끼면 조용히 다른 값을 가리킨다', correct: true,
          why: '위 시뮬레이터 ③에서 확인한 것처럼, 열이 하나 끼어들면 같은 위치(' + start + ':' + end +
            ')가 다른 열들을 가리키는데도 에러나 경고가 없다.' },
        { label: '위치로 선택하는 기능 자체가 pandas 에서 지원되지 않는다',
          why: '오답이다. iloc 은 정상적으로 동작한다 — 문제는 위치가 열 순서에 의존한다는 점이다.' },
        { label: 'filter(regex=) 도 똑같이 흔들린다',
          why: '오답이다. filter(regex=) 는 열 이름을 보고 고르므로 열 순서가 바뀌어도 흔들리지 않는다.' }
      ],
      explain: 'filter(regex=) 는 이름의 패턴을 보고 고르므로 열이 끼어들어도 같은 101개를 정확히 찾는다.'
    }));

    // V2-3 — pivot vs pivot_table
    wrap.appendChild(UI.quiz({
      title: '확인 문제 V2-3',
      question:
        "같은 (년, 월) 조합이 여러 번 있는 서울 기온 표에 df.pivot(index='년', columns='월', values='평균기온') 을 쓰면 무슨 일이 일어나는가?",
      choices: [
        { label: 'ValueError 로 멈춘다', correct: true,
          why: 'pivot 은 (index, columns) 조합마다 값이 정확히 하나라고 가정한다. 서울 기온은 하루하루가 다른 행이라 ' +
            '(년, 월) 조합이 겹치는 자리가 많아 곧바로 멈춘다. pivot_table 은 aggfunc 로 뭉쳐서 계속 진행한다.' },
        { label: '평균으로 알아서 뭉쳐서 계산한다',
          why: '오답이다. 그건 pivot_table 의 동작이다 — pivot 은 집계하지 않는다.' },
        { label: '마지막 값만 남기고 계산한다',
          why: '오답이다. pivot 은 중복을 만나면 계산을 시도하지 않고 바로 에러를 던진다.' }
      ],
      explain: '위 시뮬레이터 ②에서 어떤 index·columns 조합을 골라도 pivot() 이 항상 실패하는 것을 직접 확인할 수 있다.'
    }));

    // V2-4 — id_vars 생략
    var demo = pop.mask(pop.col('시도').isin(['서울특별시', '부산광역시']))
      .cols(['시도', '2021년08월_계_0세', '2021년08월_계_20세'])
      .rename({ '2021년08월_계_0세': '0세', '2021년08월_계_20세': '20세' });
    var noId = demo.melt({ varName: '나이대', valueName: '인구수' });

    wrap.appendChild(UI.quiz({
      title: '확인 문제 V2-4',
      question: "wide.melt(var_name='나이대', value_name='인구수') 처럼 id_vars 를 빠뜨리면 어떤 문제가 생기는가?",
      choices: [
        { label: "유지해야 할 '시도' 열까지 값으로 녹아 들어가 인구수 열의 dtype 이 '" + noId.dtypes()['인구수'] + "' 가 된다",
          correct: true,
          why: 'id_vars 를 안 주면 유지할 열이 없다고 보고 모든 열을 녹인다. 문자열 시도 이름과 숫자 인구수가 한 열에 섞여 dtype 이 승격된다.' },
        { label: '에러가 나서 코드가 멈춘다',
          why: '오답이다. 에러도 경고도 없이 조용히 일어난다 — 그래서 더 위험하다.' },
        { label: "'시도' 열이 그대로 유지된다",
          why: '오답이다. id_vars 로 지정하지 않은 열은 전부 녹는다 — 시도도 예외가 아니다.' }
      ],
      explain: '유지할 열은 반드시 id_vars 로 밝혀야 한다.'
    }));

    return wrap;
  }
})();
