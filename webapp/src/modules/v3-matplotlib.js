/* v3-matplotlib.js — matplotlib: 그림의 구조 (2부 V3장)
 * 브라우저에는 matplotlib 이 없다. 이 화면은 matplotlib 이 "무엇을 계산해서 그리는지" 를
 * 엔진(DF)과 직접 그린 SVG 로 재현하고, 옆에 실제로 IDLE 에서 돌아가는 파이썬 코드를 둔다.
 * IIFE 로 감싸고, 가변 상태는 전부 render() 안의 지역 변수에 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  function isNum(v) { return typeof v === 'number' && !isNaN(v); }
  function minArr(a) { var m = Infinity; a.forEach(function (v) { if (isNum(v) && v < m) m = v; }); return m; }
  function maxArr(a) { var m = -Infinity; a.forEach(function (v) { if (isNum(v) && v > m) m = v; }); return m; }

  /* 학생이 IDLE/주피터에 그대로 붙여 실행할 수 있는 준비 두 줄(정정표 C-8).
   * 구글 코랩 전용 코드(files.upload, apt-get, koreanize-matplotlib)는 쓰지 않는다 — 이 두 줄이면 된다. */
  var FONT_LINES = ["plt.rc('font', family='Malgun Gothic')", "plt.rc('axes', unicode_minus=False)"];

  // ═══════════════════════════════════════════════ 시뮬레이터 ① 그림의 해부도

  /* 서울 연도별 기온(seoul_temp.csv)의 최저·평균·최고기온 세 선을 직접 SVG 로 그린다.
   * UI.line 은 title/legend/grid/xlim 을 개별 토글로 켜고 끄는 기능이 없으므로,
   * 이 해부도만은 API.md §0 의 안내대로 위젯을 쓰지 않고 직접 그린다(색은 CSS 변수만 사용). */
  var ANATOMY_PARTS = [
    { key: 'title', label: '제목', lines: ["ax.set_title('서울 연도별 기온')"] },
    { key: 'axisLabel', label: '축 이름 (x, y)', lines: ["ax.set_xlabel('년')", "ax.set_ylabel('기온(℃)')"] },
    { key: 'xlim', label: 'x축 범위', lines: ['ax.set_xlim(1900, 2020)'] },
    { key: 'legend', label: '범례', lines: ['ax.legend()'] },
    { key: 'grid', label: '격자', lines: ['ax.grid(True, alpha=0.3)'] }
  ];

  function anatomySvg(years, seriesDefs, on) {
    var W = 660, H = 360;
    var padL = 60, padR = 20;
    var padT = on.title ? 40 : 18;
    var padB = on.axisLabel ? 58 : 38;
    var xDomain = on.xlim ? [1900, 2020] : [minArr(years), maxArr(years)];
    var allVals = [];
    seriesDefs.forEach(function (s) { s.arr.forEach(function (v) { if (isNum(v)) allVals.push(v); }); });
    var yMin = minArr(allVals), yMax = maxArr(allVals);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    var x = UI.scale(xDomain, [padL, W - padR]);
    var y = UI.scale([yMin, yMax], [H - padB, padT]);
    var kids = [];

    if (on.grid) {
      UI.niceTicks(yMin, yMax, 5).forEach(function (t) {
        kids.push(UI.svg('line.grid-line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t) }));
      });
      UI.niceTicks(xDomain[0], xDomain[1], 6).forEach(function (t) {
        kids.push(UI.svg('line.grid-line', { x1: x(t), x2: x(t), y1: padT, y2: H - padB }));
      });
    }
    UI.niceTicks(yMin, yMax, 5).forEach(function (t) {
      kids.push(UI.svg('text.tick-label', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end', text: UI.fmt(t, 0) }));
    });
    UI.niceTicks(xDomain[0], xDomain[1], 6).forEach(function (t) {
      kids.push(UI.svg('text.tick-label', { x: x(t), y: H - padB + 16, 'text-anchor': 'middle', text: String(Math.round(t)) }));
    });
    kids.push(UI.svg('line.axis-line', { x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));
    kids.push(UI.svg('line.axis-line', { x1: padL, x2: padL, y1: padT, y2: H - padB }));

    seriesDefs.forEach(function (s) {
      var d = '', pen = false;
      years.forEach(function (yr, i) {
        var v = s.arr[i];
        if (!isNum(v)) { pen = false; return; }        // 결측이 있는 해는 선을 끊는다
        d += (pen ? 'L' : 'M') + x(yr).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
        pen = true;
      });
      kids.push(UI.svg('path.line', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    });

    if (on.title) {
      kids.push(UI.svg('text.axis-label', {
        x: (padL + W - padR) / 2, y: 20, 'text-anchor': 'middle', 'font-weight': 700, text: '서울 연도별 기온'
      }));
    }
    if (on.axisLabel) {
      kids.push(UI.svg('text.axis-label', { x: (padL + W - padR) / 2, y: H - 6, 'text-anchor': 'middle', text: '년' }));
      kids.push(UI.svg('text.axis-label', { x: 8, y: padT - 4, text: '기온(℃)' }));
    }

    // Figure(굵은 점선, 전체) / Axes(실선, 좌표 평면) — 항상 표시. 새 CSS 클래스 대신 인라인 속성만 쓴다.
    kids.unshift(UI.svg('rect', { x: 1, y: 1, width: W - 2, height: H - 2, fill: 'none', stroke: 'var(--ink-2)', 'stroke-dasharray': '5 4' }));
    kids.push(UI.svg('text', { x: 6, y: H - 4, fill: 'var(--ink-2)', 'font-size': 10, text: 'Figure (fig)' }));
    kids.push(UI.svg('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB, fill: 'none', stroke: 'var(--grid)' }));
    kids.push(UI.svg('text', { x: padL + 4, y: padT + 12, fill: 'var(--ink-2)', 'font-size': 10, text: 'Axes (ax)' }));

    return UI.svg('svg.viz', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': '서울 연도별 기온 해부도' }, kids);
  }

  // ═══════════════════════════════════════════════ 시뮬레이터 ③ 현재 그림은 어느 것인가

  /* 정정표 D-1(그림이 두 장 생기는 것) + A-3(plt.figure(3,...)의 3은 그림 번호)를
   * 하나로 이은 단계 실행. 상태는 매번 이 함수가 새로 계산한다 — 모듈 전역에 두지 않는다. */
  function simulateFigures() {
    var figures = [], current = null, steps = [];
    function snapshot(code, note) {
      steps.push({
        code: code, note: note,
        figures: figures.map(function (f) { return { num: f.num, w: f.w, h: f.h, hasLine: f.hasLine }; }),
        current: current
      });
    }
    snapshot('(시작) — 아직 열린 그림이 없다', '');
    figures.push({ num: 1, w: 20, h: 3, hasLine: false }); current = 1;
    snapshot('plt.figure(figsize=(20, 3))', '새 그림 1번이 생기고 "현재 그림"이 된다.');
    figures.push({ num: 2, w: 6.4, h: 4.8, hasLine: false }); current = 2;
    snapshot('plt.figure(dpi=300)', 'plt.figure() 는 부를 때마다 새 그림을 만든다. matplotlib 기본 크기(6.4×4.8인치)의 ' +
      '그림 2번이 또 생기고, 이제 2번이 "현재 그림"이다. 1번은 그대로 남아 있다.');
    figures.forEach(function (f) { if (f.num === current) f.hasLine = true; });
    snapshot('plt.plot([1, 2, 3], [4, 5, 6])', '선은 언제나 "현재 그림"에 그려진다 — 지금은 2번. 크기를 준 1번 그림은 ' +
      '에러도 경고도 없이 끝까지 빈 채로 남는다.');
    figures.push({ num: 3, w: 15, h: 5, hasLine: false }); current = 3;
    snapshot('plt.figure(3, figsize=(15, 5))', '숫자 3은 "하위 그래프 3개" 가 아니라 그림 번호(num)다. 번호가 3번인 ' +
      '새 그림이 생기고 현재 그림이 되지만, 아직 축(Axes)은 하나도 만들지 않았다.');
    return steps;
  }

  function figureBox(f, isCurrent) {
    var w = 46 + f.w * 4, h = 34 + f.h * 6;
    var card = UI.el('div', {
      style: {
        border: isCurrent ? '2px solid var(--ink-1)' : '1px solid var(--grid)',
        borderRadius: '6px', padding: '6px 8px', width: w + 'px', minHeight: h + 'px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
      }
    });
    card.appendChild(UI.el('div', { style: { fontWeight: 700 }, text: '그림 ' + f.num }));
    card.appendChild(UI.el('div.small', { text: f.w + '×' + f.h + '인치' }));
    card.appendChild(UI.el('div.small', { text: f.hasLine ? '선 있음' : '비어 있음 (축 0개)' }));
    if (f.hasLine) {
      card.appendChild(UI.svg('svg', { viewBox: '0 0 40 20', width: 40, height: 20 }, [
        UI.svg('path', { d: 'M2 16 L20 4 L38 8', fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2 })
      ]));
    }
    if (isCurrent) card.appendChild(UI.el('div', { style: { fontWeight: 700 }, text: '◀ 현재 그림' }));
    return card;
  }

  function renderFigureStep(step) {
    var box = UI.el('div');
    box.appendChild(UI.code(step.code, { noCopy: true }));
    if (!step.figures.length) {
      box.appendChild(UI.note('아직 그림이 하나도 없다.'));
    } else {
      var row = UI.el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '10px 0' } });
      step.figures.forEach(function (f) { row.appendChild(figureBox(f, f.num === step.current)); });
      box.appendChild(row);
    }
    if (step.note) box.appendChild(UI.note(step.note));
    return box;
  }

  Lab.register({
    id: 'v3-matplotlib',
    part: 2,
    num: 3,
    title: 'matplotlib — 그림의 구조',
    subtitle: 'Figure 와 Axes 가 무엇을 가리키는지 구분하고, 코드는 그대로인데 그림이 이상하게 나오는 두 가지 상황을 직접 겪어 본다',
    sim: '그림 해부도 · 점 간격 슬라이더 · 현재 그림은 어느 것인가',

    render: function (root) {
      var yf = LabData.frame('seoul_year');
      var years = yf.col('년').toArray();
      var loArr = yf.col('최저기온').toArray();
      var hiArr = yf.col('최고기온').toArray();
      var avgArr = yf.col('평균기온').toArray();
      var seriesDefs = [
        { name: '최저기온', arr: loArr, color: UI.SERIES_COLORS[0] },
        { name: '최고기온', arr: hiArr, color: UI.SERIES_COLORS[1] },
        { name: '평균기온', arr: avgArr, color: UI.SERIES_COLORS[2] }
      ];

      var corrDf = yf.cols(['년', '평균기온']).corr({ numericOnly: true });
      var posYear = corrDf.index.positions('년')[0];
      var corrYearAvg = corrDf.col('평균기온').at(posYear);
      var trendWord = corrYearAvg > 0 ? '오르는' : (corrYearAvg < 0 ? '내리는' : '뚜렷하지 않은');

      // ── 문제 제기
      root.appendChild(UI.note(
        '서울의 연도별 평균기온 자료는 ' + years.length + '개 행뿐이라 표로 봐도 못 볼 정도는 아니다. 그래도 ' +
        '"기온이 ' + trendWord + ' 추세인가" 라는 질문에는 표보다 그림이 훨씬 빨리 답한다(년-평균기온 상관계수 ' +
        UI.fmt(corrYearAvg, 3) + '). matplotlib 은 그림의 아주 작은 부분까지 코드로 지정할 수 있는 대신, ' +
        '지정을 빠뜨리거나 잘못하면 그린 사람도 모르게 다른 그림이 나온다 — 이 장은 그 두 가지 상황을 직접 겪어 본다.'
      ));

      // ── 한글 글꼴 두 줄
      var fontBox = UI.el('div.card');
      fontBox.appendChild(UI.el('div.panel-title', { text: '한글이 깨지지 않게 — 글꼴 두 줄' }));
      fontBox.appendChild(UI.note(
        '첫 줄이 없으면 한글 라벨이 네모(□)로 깨진다. 둘째 줄이 없으면 맑은 고딕에 유니코드 마이너스(−) ' +
        '글리프가 없어 축 눈금에 음수가 있을 때마다 "Glyph 8722 … missing from font(s)" 경고가 뜬다. 이 두 줄은 ' +
        '그림을 그리는 모든 장(V3~V6)의 첫 블록에 넣는다.'
      ));
      fontBox.appendChild(UI.code(FONT_LINES.join('\n'), { noCopy: true }));
      fontBox.appendChild(UI.note(
        '이 교재는 IDLE/주피터를 기준으로 한다. 구글 코랩에서 쓰던 파일 업로드 도우미(files.upload), ' +
        '나눔폰트 설치(apt-get install fonts-nanum), koreanize-matplotlib 설치 같은 코드는 쓰지 않는다 — ' +
        '윈도우에서는 위 두 줄이면 충분하다(맥은 family=\'AppleGothic\').', 'IDLE 기준', { kind: 'tip' }
      ));
      root.appendChild(fontBox);

      // ── 그래프 다섯 가지
      var pickBox = UI.el('div.card');
      pickBox.appendChild(UI.el('div.panel-title', { text: '그래프 다섯 가지를 언제 고르나' }));
      pickBox.appendChild(UI.table(
        [{ key: 'kind', label: '함수' }, { key: 'when', label: '무엇을 보여 주려고 고르는가' }],
        [
          { kind: 'plot', when: '변화 — 시간처럼 순서가 있는 값을 선으로 잇는다' },
          { kind: 'bar / barh', when: '크기 비교 — 범주별 값의 크기. 이름이 길면 barh' },
          { kind: 'scatter', when: '관계 — 두 값이 함께 움직이는지 점으로 흩뿌린다' },
          { kind: 'hist', when: '분포 — 값을 구간으로 나눠 몇 개씩 있는지 센다' },
          { kind: 'boxplot', when: '분포 요약 — 다섯 수치(최소·1사분위·중앙값·3사분위·최대)로 압축한다' },
          { kind: 'pie', when: '전체에서 차지하는 비율. 조각 6개 이하, 값이 뚜렷이 다를 때만 — 비슷하면 막대가 낫다' }
        ]
      ));
      root.appendChild(pickBox);

      // ═══════════════════ 시뮬레이터 ① 그림의 해부도
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '그림 해부도' }));
      box1.appendChild(UI.note(
        '점선 사각형이 Figure(fig, 그림 전체), 안쪽 실선 사각형이 Axes(ax, 실제로 선이 그려지는 좌표 평면)다 — ' +
        'fig, ax = plt.subplots(figsize=(9, 4)) 로 이 둘을 이름 붙여 들고 있는다. 아래 토글을 하나씩 켜 보면서 ' +
        '그 부분의 이름과, 그 부분을 만드는 코드 한 줄이 아래 코드 블록에 나타나고 사라지는 것을 확인해 보자. ' +
        '계열이 셋(최저·최고·평균)이므로 범례 없이는 색만으로 구분할 수 없다.'
      ));

      var toggles = { title: false, axisLabel: false, xlim: false, legend: false, grid: false };
      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(body1);
        var svgNode = anatomySvg(years, seriesDefs, toggles);
        var tableNode = UI.frameTable(yf.cols(['년', '최저기온', '평균기온', '최고기온']), { maxRows: 12, digits: 1, caption: '서울 연도별 기온 (seoul_temp.csv)' });
        body1.appendChild(UI.withTableTwin(svgNode, tableNode, { title: '서울 연도별 기온 — 세 선' }));
        if (toggles.legend) {
          body1.appendChild(UI.legend(seriesDefs.map(function (s) { return { label: s.name, color: s.color }; })));
        }
        var activeLines = [];
        ANATOMY_PARTS.forEach(function (p) { if (toggles[p.key]) activeLines = activeLines.concat(p.lines); });
        var script = [
          'import pandas as pd', 'import matplotlib.pyplot as plt'
        ].concat(FONT_LINES).concat([
          '', "data = pd.read_csv('seoul_temp.csv', encoding='cp949')", '',
          'fig, ax = plt.subplots(figsize=(9, 4))',
          "ax.plot(data['년'], data['최저기온'], color='tab:blue', label='최저기온')",
          "ax.plot(data['년'], data['최고기온'], color='tab:orange', label='최고기온')",
          "ax.plot(data['년'], data['평균기온'], color='tab:green', label='평균기온')"
        ]).concat(activeLines).concat(['plt.show()']).join('\n');
        body1.appendChild(UI.code(script, { title: '지금까지 켠 것을 반영한 코드' }));
      }

      box1.appendChild(UI.el('div.control-row', null, ANATOMY_PARTS.map(function (p) {
        return UI.toggle({
          label: p.label, value: toggles[p.key],
          onChange: function (on) { toggles[p.key] = on; rebuild1(); }
        });
      })));
      box1.appendChild(body1);
      rebuild1();
      root.appendChild(box1);

      // ═══════════════════ 시뮬레이터 ② 점 간격 슬라이더
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '점 간격 슬라이더' }));
      box2.appendChild(UI.note(
        'matplotlib 은 점을 직선으로 잇는 도구이지 곡선을 그리는 도구가 아니다. 슬라이더로 sin 곡선을 그리는 점의 ' +
        '개수 N 을 0~12 구간에서 바꿔 보자. N 을 13 에 두면 파이썬 list(range(13)) 으로 만든 점과 정확히 같고, ' +
        '1000 까지 올리면 np.linspace(0, 12, 1000) 과 같아진다 — 점이 촘촘해질수록 매끄러운 곡선처럼 보인다.'
      ));

      var st2 = { n: 13 };
      var body2 = UI.el('div');

      function sinPoints(n) {
        var pts = [];
        for (var i = 0; i < n; i++) {
          var x = n <= 1 ? 0 : (i * 12 / (n - 1));
          pts.push([x, Math.sin(x)]);
        }
        return pts;
      }

      function rebuild2() {
        UI.clear(body2);
        var pts = sinPoints(st2.n);
        body2.appendChild(UI.line(
          [{ name: 'sin(x)', points: pts }],
          { title: '점 ' + st2.n + '개', xLabel: 'x', yLabel: 'sin(x)', markers: st2.n <= 40 }
        ));
        var isLoop = st2.n === 13;
        var plotLine = 'plt.plot(xs, ys' + (st2.n <= 40 ? ", marker='o'" : '') + ')';
        var body = isLoop
          ? ['xs = list(range(13))', 'ys = [math.sin(x) for x in xs]', plotLine].join('\n')
          : ['xs = np.linspace(0, 12, ' + st2.n + ')', 'ys = np.sin(xs)', plotLine].join('\n');
        var script = ['import math', 'import numpy as np', 'import matplotlib.pyplot as plt']
          .concat(FONT_LINES).concat(['', body, 'plt.show()']).join('\n');
        body2.appendChild(UI.code(script, { title: isLoop ? '반복문과 완전히 같은 점 (N=13)' : 'np.linspace 코드' }));
        body2.appendChild(UI.note(
          st2.n <= 13
            ? '점과 점 사이를 곧은 선분으로 이었기 때문에 꺾여 보인다.'
            : (st2.n < 100
              ? '점이 늘어나면서 꺾인 부분이 점점 줄어든다.'
              : '점 간격이 눈에 안 보일 만큼 좁아 곡선처럼 보이지만, matplotlib 은 지금도 점을 직선으로 잇고 있을 뿐이다.')
        ));
      }

      box2.appendChild(UI.slider({
        label: '점 개수 N', min: 3, max: 1000, step: 1, value: st2.n,
        onChange: function (v) { st2.n = v; rebuild2(); }
      }));
      box2.appendChild(body2);
      rebuild2();
      root.appendChild(box2);

      // ═══════════════════ 시뮬레이터 ③ 현재 그림은 어느 것인가
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '현재 그림은 어느 것인가' }));
      box3.appendChild(UI.note(
        'plt.figure() 는 부를 때마다 새 그림을 만들고 그 그림을 "현재 그림"으로 삼는다. 옵션을 나눠서 두 번 부르면 ' +
        '그림이 두 장 생기고, 이어서 plt.figure(3, ...)을 부르면 그 3은 하위 그래프 개수가 아니라 그림 번호다. ' +
        '한 줄씩 눌러 가며 "현재 그림" 표시가 어디로 옮겨 가는지 따라가 보자.'
      ));
      var figSteps = simulateFigures();
      box3.appendChild(UI.stepper(figSteps, renderFigureStep, { title: null }));
      var lastStep = figSteps[figSteps.length - 1];
      box3.appendChild(UI.note(
        'plt.get_fignums() -> [' + lastStep.figures.map(function (f) { return f.num; }).join(', ') + ']  ' +
        '(열린 그림 번호 목록)', '마지막 상태'
      ));
      root.appendChild(box3);

      // ── 점 크기에 음수가 섞이면 (정정표 D-5)
      var negBox = UI.el('div.card');
      negBox.appendChild(UI.el('div.panel-title', { text: '점 크기에 음수가 섞이면' }));
      negBox.appendChild(UI.note(
        '산점도에서 점 크기(s=)로 쓸 값에 음수가 섞이면 어떻게 될까. matplotlib 은 점 크기를 정할 때 넓이의 ' +
        '제곱근을 쓰는데, 음수의 제곱근은 정의되지 않아 NaN 이 되고 그 점은 화면에 그려지지 않는다. 에러 없이 ' +
        '일부가 조용히 사라진다 — 버튼을 눌러 직접 만들어 보자.'
      ));
      var negBody = UI.el('div');
      function rollNegative() {
        UI.clear(negBody);
        var sizes = [];
        for (var i = 0; i < 100; i++) sizes.push(Math.floor(Math.random() * 400) - 200);
        var negCount = sizes.filter(function (v) { return v < 0; }).length;
        negBody.appendChild(UI.note(
          '이번에 만든 100개 중 ' + negCount + '개가 음수라, 그 ' + negCount + '개는 화면에 그려지지 않는다.'
        ));
        negBody.appendChild(UI.danger('RuntimeWarning', 'invalid value encountered in sqrt — 메시지에 "크기"나 "음수"라는 말이 없어 원인을 짐작하기 어렵다.'));
      }
      negBox.appendChild(UI.el('button', { text: '무작위로 100개 만들어 보기', onclick: rollNegative }));
      negBox.appendChild(negBody);
      rollNegative();
      root.appendChild(negBox);

      // ═══════════════════ 확인 문제
      var d1 = figSteps[3];   // plt.plot(...) 직후
      var a3 = figSteps[4];   // plt.figure(3, ...) 직후
      var fig3 = a3.figures.filter(function (f) { return f.num === 3; })[0];
      var axesAfterFigureCall = fig3.hasLine ? 1 : 0;

      var loopXs = []; for (var i = 0; i < 13; i++) loopXs.push(i);
      var linspaceXs = sinPointsForQuiz(13);
      function sinPointsForQuiz(n) {
        var xs = []; for (var k = 0; k < n; k++) xs.push(k * 12 / (n - 1)); return xs;
      }
      var sameAsLoop = loopXs.every(function (v, idx) { return Math.abs(v - linspaceXs[idx]) < 1e-9; });

      root.appendChild(UI.quiz({
        title: '확인 문제 V3-1',
        question: 'plt.figure(figsize=(20, 3)) 다음 plt.figure(dpi=300) 을 부르고, 이어서 ' +
          'plt.plot([1, 2, 3], [4, 5, 6]) 을 실행했다. 총 몇 개의 그림이 열리고, 선은 몇 번 그림에 그려지는가?',
        choices: [
          { label: '그림 ' + d1.figures.length + '개, 선은 ' + d1.current + '번 그림', correct: true,
            why: 'plt.figure() 는 부를 때마다 새 그림을 만들고 그 그림을 현재 그림으로 삼는다. 마지막으로 만든 ' +
              d1.current + '번이 현재 그림이라 선은 거기에 그려지고, 크기만 준 1번 그림은 끝까지 빈 채로 남는다.' },
          { label: '그림 1개, 선은 1번 그림', why: 'plt.figure() 를 두 번 불렀으므로 그림도 두 장 생긴다. 옵션을 나눠 준다고 ' +
            '한 그림에 합쳐지지 않는다.' },
          { label: '그림 ' + d1.figures.length + '개, 선은 1번 그림', why: '그림 개수는 맞지만, 선은 "현재 그림"에 그려진다. ' +
            '마지막에 만든 그림이 현재 그림이므로 1번이 아니라 ' + d1.current + '번이다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V3-2',
        question: '위 상태에서 이어서 plt.figure(3, figsize=(15, 5)) 를 실행했다. 이 직후 len(plt.gcf().axes) 는 얼마인가?',
        choices: [
          { label: String(axesAfterFigureCall), correct: true,
            why: 'plt.figure() 는 빈 도화지(그림)만 만들 뿐, 그 안에 좌표 평면(Axes)을 만들지는 않는다. 첫 번째 자리의 ' +
              '3 은 하위 그래프 개수가 아니라 그림 번호(num)라서, 이 호출은 축이 하나도 없는 3번 그림을 새로 만들 뿐이다.' },
          { label: '3', why: '숫자 3을 "하위 그래프 3개" 로 착각한 답이다. 이 자리의 3은 그림 번호일 뿐, Axes 를 만들지 않는다.' },
          { label: '1', why: 'plt.figure() 호출 자체는 Axes 를 만들지 않는다. Axes 가 필요하면 plt.subplots() 나 plt.subplot() 을 따로 불러야 한다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V3-3',
        question: '최저·평균·최고기온 세 선을 한 그림에 겹쳐 그릴 때 ax.legend() 를 반드시 불러야 하는 이유는?',
        choices: [
          { label: '계열이 3개라 색만으로는 어떤 선이 어떤 값인지 구분할 수 없기 때문', correct: true,
            why: '계열이 둘 이상이면 범례가 필수다(§7). 계열이 하나뿐이라면 색이 곧 "그 값" 이므로 범례가 없어도 되지만, ' +
              '셋을 겹치면 범례 없이는 파랑·주황·초록이 각각 무엇인지 알 길이 없다.' },
          { label: '그림을 더 커 보이게 하려고', why: '범례는 그림 크기와 무관하다. legend() 는 색과 이름을 짝지어 보여줄 뿐이다.' },
          { label: 'matplotlib 문법상 선을 그릴 때 항상 필요하다', why: '틀렸다. 계열이 하나뿐인 그래프(V3.3 의 예시들)에는 ' +
            '범례 없이도 무엇을 그렸는지 알 수 있어 굳이 붙이지 않는다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V3-4',
        question: 'np.linspace(0, 12, 13) 으로 만든 x 값과 list(range(13)) 으로 만든 x 값은 같은가?',
        choices: [
          { label: sameAsLoop ? '같다' : '다르다', correct: true,
            why: 'np.linspace(0, 12, 13) 은 0부터 12까지를 12등분(13개 점)해서 0, 1, 2, …, 12를 낸다. list(range(13)) 도 ' +
              '똑같이 0부터 12까지 정수를 낸다 — 두 방식이 우연히 같은 점을 만든 것이 아니라, 13개로 나누면 간격이 ' +
              '정확히 1이 되기 때문이다. N을 13이 아닌 값으로 바꾸면 더는 정수 목록과 같지 않다.' },
          { label: sameAsLoop ? '다르다' : '같다', why: '위 시뮬레이터의 슬라이더를 13에 두고 "반복문과 완전히 같은 점" 이라는 ' +
            '설명을 다시 확인해 보자.' }
        ]
      }));
    }
  });
})();
