/* v1-strdate.js — V1장. 문자열과 날짜: 파일을 쓸 수 있게 만들기 (2부)
 * 받아 온 CSV 를 그대로는 쓸 수 없는 이유를 하나씩 찾아 고친다: 탭 문자, 빈 행, 문자열로
 * 남은 연도, 잘못된 결측 채우기. IIFE 로 감싸고, render 는 여러 번 호출되므로 가변 상태는
 * 전부 render 안의 지역 변수에 둔다(API.md §1 ②). 데이터는 seoul_day — 2부는 실데이터다.
 */
(function () {
  'use strict';

  /* 값 하나를 표에 보여줄 문자열로. 문자열은 파이썬 repr 처럼 작은따옴표로 감싸고 탭을 \t 로
   * 적어 눈에 보이게 만든다(브라우저 표는 탭을 그냥 공백처럼 접어 버린다). */
  function pyRepr(v) {
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n').replace(/'/g, "\\'") + "'";
  }
  /* 파이썬 출력처럼 True / False 로 적는다(화면의 코드가 파이썬이다). */
  function pyBool(b) { return b ? 'True' : 'False'; }
  function cellRepr(v, dtype) {
    if (DF.isNA(v)) return 'NaN';
    if (dtype === 'str' || dtype === 'object') return pyRepr(v);
    return DF.fmtTyped(v, dtype);
  }

  /* 시뮬레이터 ① 이 쓰는 다섯 단계. raw:true 로 읽은 프레임에서 출발해 순서대로 정리한다.
   * 42397행짜리 변환을 다섯 단계 전부 미리 계산해 두고, 버튼은 이미 계산된 결과를 보여주기만
   * 한다 — 클릭마다 4만 행을 다시 처리하지 않는다(API.md §3 2부 데이터 주의). */
  function buildStages() {
    var raw = LabData.frame('seoul_day', { raw: true });
    var stages = [];

    stages.push({
      title: '① 원본 그대로 (read_csv)',
      code: "df = pd.read_csv('seoul_temp_day.csv', encoding='cp949')",
      df: raw,
      note: "지점 열이 int64 가 아니라 float64 로 읽혔다 — 정수 열에 결측이 하나라도 섞이면 " +
        '그 열 전체가 실수로 승격된다는 신호다.'
    });

    var s1 = raw.copy();
    s1.setCol('날짜', raw.col('날짜').str.strip());
    stages.push({
      title: "② df['날짜'].str.strip()",
      code: "df['날짜'] = df['날짜'].str.strip()",
      df: s1,
      note: '탭은 사라졌다. 그런데 마지막 행은 이제 빈 문자열 "" 이 됐을 뿐, 행 자체는 아직 안 지워졌다.'
    });

    var mask2 = s1.col('날짜').ne('');
    var s2 = s1.mask(mask2);
    stages.push({
      title: "③ df[df['날짜'] != '']",
      code: "df = df[df['날짜'] != '']",
      df: s2,
      note: '행 수가 ' + raw.shape[0] + '에서 ' + s2.shape[0] + '로, 그 빈 행 하나만 빠졌다. ' +
        "dropna() 는 여기서 못 쓴다 — 값이 NaN 이 아니라 빈 문자열 '' 이기 때문이다."
    });

    var s3 = s2.copy();
    s3.setCol('날짜', DF.toDatetime(s2.col('날짜')));
    stages.push({
      title: "④ pd.to_datetime(df['날짜'])",
      code: "df['날짜'] = pd.to_datetime(df['날짜'])",
      df: s3,
      note: '날짜 dtype 이 str 에서 ' + s3.col('날짜').dtype + ' 로 바뀌었다. 이제 날짜끼리 크기 비교와 ' +
        '뺄셈, 정렬이 전부 된다. 빈 행을 먼저 지웠기 때문에 예외 없이 여기까지 왔다.'
    });

    var s4 = s3.copy();
    s4.setCol('년', s3.col('날짜').dt.year);
    stages.push({
      title: "⑤ df['년'] = df['날짜'].dt.year",
      code: "df['년'] = df['날짜'].dt.year",
      df: s4,
      note: '정수 연도 열 년 이 새로 생겼다(dtype ' + s4.col('년').dtype + "). '.str.split'으로 뽑은 " +
        '문자열 연도와 달리, 이 열은 처음부터 숫자라서 비교가 위험하지 않다.'
    });

    return stages;
  }

  Lab.register({
    id: 'v1-strdate',
    part: 2,
    num: 1,
    title: '문자열과 날짜',
    subtitle: '파일을 쓸 수 있게 만들기 — 탭 문자, 빈 행, 문자열로 남은 연도가 조용히 숨어드는 함정을 하나씩 고친다',
    sim: '청소 단계 실행기 · 문자열 연도 vs 숫자 연도 · 해마다 며칠이 있었나',

    render: function (root) {
      root.appendChild(UI.note(
        '기상청에서 받은 기온 파일은 숫자표가 아니라 문자열 뭉치다. 문자열 열을 .str 로 다듬고, ' +
        '날짜 문자열을 진짜 datetime 으로 바꾸는 과정에서 탭 문자, 빈 행, 문자열로 남은 연도 같은 ' +
        '함정이 하나씩 나온다. 아래 시뮬레이터로 직접 짚어 보자.'
      ));

      // ═══════════════════════════════ 시뮬레이터 ① 청소 단계 실행기
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① 청소 단계 실행기' }));
      box1.appendChild(UI.note(
        '원본을 그대로 읽은 표에서 출발해 strip → 빈 행 제거 → to_datetime → .dt.year 를 한 단계씩 ' +
        '눌러 보자. 단계마다 dtype 과 shape, 첫 행·마지막 행의 값이 어떻게 바뀌는지 보여 준다.'
      ));

      var STAGES1 = buildStages();
      var st1 = { stage: 0 };
      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(body1);
        var s = STAGES1[st1.stage];
        var last = s.df.shape[0] - 1;

        body1.appendChild(UI.code(s.code, { noCopy: true }));
        body1.appendChild(UI.note('shape = (' + s.df.shape[0] + ', ' + s.df.shape[1] + ')'));

        body1.appendChild(UI.table(
          [{ key: 'col', label: '열' }, { key: 'dtype', label: 'dtype' }],
          s.df.columns.map(function (c) { return { col: c, dtype: s.df.col(c).dtype }; }),
          { caption: '열별 dtype' }
        ));

        var rowCols = [{ key: 'pos', label: '' }].concat(
          s.df.columns.map(function (c) { return { key: c, label: c }; })
        );
        var rows = [0, last].map(function (pos) {
          var r = { pos: pos === 0 ? '첫 행' : '마지막 행' };
          s.df.columns.forEach(function (c) {
            var col = s.df.col(c);
            r[c] = cellRepr(col.at(pos), col.dtype);
          });
          return r;
        });
        body1.appendChild(UI.table(rowCols, rows, { caption: '첫 행 vs 마지막 행' }));

        body1.appendChild(UI.note(s.note));
      }

      box1.appendChild(UI.buttonGroup(
        STAGES1.map(function (s, i) { return { label: s.title, value: i }; }),
        { label: '단계 선택', selected: st1.stage, onChange: function (v) { st1.stage = v; rebuild1(); } }
      ));
      box1.appendChild(body1);
      rebuild1();
      root.appendChild(box1);

      // ═══════════════════════════════ 시뮬레이터 ② 문자열 연도 vs 숫자 연도
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 문자열 연도 vs 숫자 연도' }));
      box2.appendChild(UI.note(
        "'.str.split'으로 뽑은 연도는 문자열로 남는다. 자릿수가 같으면 문자열 비교와 숫자 비교가 " +
        '우연히 같은 답을 낸다 — 두 값을 직접 넣어 그 우연이 언제 깨지는지 찾아보자.'
      ));

      var st2 = { a: '999', b: '2010' };
      var body2 = UI.el('div');

      function rebuild2() {
        UI.clear(body2);
        var strResult = DF.series([st2.a], { dtype: 'str' }).gt(st2.b).at(0);
        var na = Number(st2.a), nb = Number(st2.b);
        var numValid = !isNaN(na) && !isNaN(nb) && st2.a.trim() !== '' && st2.b.trim() !== '';
        var numResult = numValid ? DF.series([na], { dtype: 'float64' }).gt(nb).at(0) : null;

        body2.appendChild(UI.code(
          "d2['년'] > " + pyRepr(st2.b) + '                # 문자열 비교\n' +
          "d2['년'].astype(int) > " + st2.b + '        # 숫자로 바꾼 뒤 비교',
          {
            noCopy: true,
            output:
              "'" + st2.a + "' > '" + st2.b + "'  ->  " + pyBool(strResult) + '\n' +
              (numValid ? (na + ' > ' + nb + '  ->  ' + pyBool(numResult)) : '숫자로 바꿀 수 없는 값이다')
          }
        ));

        body2.appendChild(UI.table(
          [{ key: 'k', label: '비교' }, { key: 'v', label: '결과' }],
          [
            { k: "'" + st2.a + "' > '" + st2.b + "'  (문자열 비교)", v: pyBool(strResult) },
            { k: numValid ? (na + ' > ' + nb + '  (숫자 비교)') : '숫자 비교', v: numValid ? pyBool(numResult) : '불가' }
          ]
        ));

        if (numValid && strResult !== numResult) {
          body2.appendChild(UI.danger(
            '문자열 비교와 숫자 비교가 다르다',
            "'" + st2.a + "'와 '" + st2.b + "'는 자릿수가 달라 사전순 비교가 크기순과 어긋난다. " +
            '지금 데이터가 전부 네 자리라서 우연히 맞았을 뿐, 자릿수가 다른 값이 하나만 섞여도 이렇게 틀린다.'
          ));
        } else if (numValid) {
          body2.appendChild(UI.note(
            '지금 값은 두 비교가 같은 결과를 낸다. 두 값 다 네 자리 숫자라서 사전순과 크기순이 우연히 ' +
            '같았을 뿐이다 — 처음부터 .dt.year 로 숫자 연도를 만들면 이 우연에 기대지 않아도 된다.'
          ));
        }
      }

      var row2 = UI.el('div.control-row');
      var inputA = UI.textInput({ label: '값 A', value: st2.a, onChange: function (v) { st2.a = v; rebuild2(); } });
      var inputB = UI.textInput({ label: '값 B', value: st2.b, onChange: function (v) { st2.b = v; rebuild2(); } });
      row2.appendChild(inputA);
      row2.appendChild(inputB);
      box2.appendChild(row2);
      box2.appendChild(UI.chips(['999 vs 2010', '10000 vs 2010', '2020 vs 2015', '2 vs 10'], function (pair) {
        var parts = pair.split(' vs ');
        inputA.setValue(parts[0]);
        inputB.setValue(parts[1]);
      }));
      box2.appendChild(body2);
      rebuild2();
      root.appendChild(box2);

      // ═══════════════════════════════ 시뮬레이터 ③ 해마다 며칠이 있었나
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ 해마다 며칠이 있었나' }));
      box3.appendChild(UI.note(
        '연도별 평균만 보면 그 해에 데이터가 며칠 있었는지 알 수 없다. count 를 평균과 함께 내고, ' +
        '기준 날수보다 적은 해를 링으로 짚어 보자.'
      ));

      var full3 = LabData.frame('seoul_day');           // 정리된 프레임, 한 번만 받는다
      full3.setCol('년', full3.col('날짜').dt.year);      // 연 열도 한 번만 만든다
      var g3 = full3.groupby('년');
      var meanS = g3.aggCol('평균기온', 'mean');
      var countS = g3.aggCol('평균기온', 'count');         // 날수 = 평균기온이 결측이 아닌 날 수
      var years3 = meanS.labels();

      var st3 = { th: 365 };
      var body3 = UI.el('div');

      function rebuild3() {
        UI.clear(body3);
        var groups = years3.map(function (y, i) { return { label: y, value: countS.at(i) }; });
        var below = [];
        years3.forEach(function (y, i) { if (countS.at(i) < st3.th) below.push(y); });

        body3.appendChild(UI.columns(groups, {
          title: '연도별 날수 (평균기온이 결측이 아닌 날 수)',
          yLabel: '날수',
          width: 860,
          highlight: below
        }));

        body3.appendChild(UI.note(
          '날수 ' + st3.th + '일 미만인 해가 ' + below.length + '개 있다' +
          (below.length ? ' — ' + below.slice(0, 12).join(', ') +
            (below.length > 12 ? ' 외 ' + (below.length - 12) + '개' : '') : '') + '.'
        ));

        var order = years3.map(function (y, i) { return i; })
          .sort(function (a, b) { return countS.at(a) - countS.at(b); });
        var least5 = order.slice(0, 5).map(function (i) {
          return { 년: years3[i], 평균: UI.fmt(meanS.at(i), 2), 날수: countS.at(i) };
        });
        body3.appendChild(UI.table(
          [{ key: '년', label: '년' }, { key: '평균', label: '평균기온' }, { key: '날수', label: '날수' }],
          least5, { caption: '날수가 가장 적은 해 5개' }
        ));
      }

      box3.appendChild(UI.slider({
        label: '강조 기준 — 이 날수 미만이면 링으로 표시', min: 300, max: 366, step: 1, value: st3.th,
        onChange: function (v) { st3.th = v; rebuild3(); }
      }));
      box3.appendChild(body3);
      rebuild3();
      box3.appendChild(UI.code(
        "g = d.groupby('년').agg(평균=('평균기온', 'mean'), 날수=('평균기온', 'count'))\n" +
        'g.loc[[1950, 1951, 1952, 1953]]',
        {
          noCopy: true,
          output: [1950, 1951, 1952, 1953].map(function (y) {
            var i = years3.indexOf(y);
            if (i < 0) return y + '  (데이터 없음)';
            return y + '   평균 ' + UI.fmt(meanS.at(i), 2) + '   날수 ' + countS.at(i);
          }).join('\n')
        }
      ));
      root.appendChild(box3);

      // ═══════════════════════════════ 흔한 실수
      var pitfalls = UI.el('div.card');
      pitfalls.appendChild(UI.el('div.panel-title', { text: '흔한 실수' }));
      pitfalls.appendChild(UI.note(
        "'.str' 없이 문자열 메서드를 바로 부른다 — df['날짜'].strip() 은 AttributeError 다."
      ));
      pitfalls.appendChild(UI.note(
        "탭만 지우고 빈 문자열은 그대로 둔다 — replace('\\t', '') 는 탭은 지우지만 빈 행은 남긴다. " +
        "pd.to_datetime 은 그 행을 조용히 NaT 로 만든다. != '' 마스크로 직접 걸러야 한다."
      ));
      pitfalls.appendChild(UI.note(
        '문자열 연도를 그대로 비교한다 — 지금 자릿수가 맞아서 결과가 맞아 보여도, 자릿수가 다른 ' +
        '값이 하나만 섞이면 바로 틀린다. 처음부터 .dt.year 로 숫자를 만든다.'
      ));
      pitfalls.appendChild(UI.note(
        "정리 순서를 건너뛴다 — 빈 행을 지우기 전에 bfill() 부터 하면 마지막 결측이 안 채워진 채로 " +
        '남는다. 걸러내고 → 날짜로 바꾸고 → 채우는 순서를 지킨다.'
      ));
      root.appendChild(pitfalls);

      // ═══════════════════════════════ 확인 문제
      var rawRows = STAGES1[0].df.shape[0];
      var cleanRows = STAGES1[2].df.shape[0];

      root.appendChild(UI.quiz({
        title: '확인 문제 V1-1',
        question: "seoul_temp_day.csv 를 read_csv 로 그대로 읽으면 '지점' 열이 int64 가 아니라 float64 로 나온다. 왜 그런가?",
        choices: [
          { label: '관측소 번호가 지점마다 달라서', why: '틀렸다. 서울은 지점 108 하나뿐이다 — 값이 늘 같아도 문제와 무관하다.' },
          { label: '마지막 행이 통째로 빈 행이라 지점 자리에 결측이 하나 섞여서', correct: true,
            why: '정수 열에 결측이 하나라도 섞이면 pandas 는 그 열 전체를 float64 로 승격한다. ' +
              '정수인 줄 알았던 열이 실수로 보이면 결측이 숨어 있다는 신호다.' },
          { label: 'pandas 가 read_csv 에서 정수를 항상 float64 로 읽어서', why: '틀렸다. 결측이 없는 정수 열은 int64 로 읽힌다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V1-2',
        question: 'seoul_temp_day.csv 를 read_csv 로 그대로 읽은 표는 몇 행인가?',
        choices: [
          { label: String(rawRows), correct: true,
            why: '지금 엔진이 계산한 값이다. 빈 행 하나까지 포함해서 읽은 그대로의 행 수다.' },
          { label: String(cleanRows), why: '틀렸다. 그건 빈 행을 지운 뒤(3단계)의 행 수다.' },
          { label: String(rawRows + 1), why: '틀렸다. 빈 행은 하나뿐이다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V1-3',
        question:
          "d2['년']이 문자열일 때 (d2['년'] > '2010').sum()이 실제 2011~2024년 행 수와 우연히 맞아떨어진다. " +
          '왜 위험한 코드인가?',
        choices: [
          { label: '지금 데이터가 전부 네 자리 연도라서 사전순 비교가 크기순과 우연히 같았을 뿐이다', correct: true,
            why: "'999' > '2010'은 True, '10000' > '2010'은 False로 실제 크기와 반대다. 자릿수가 다른 " +
              '값이 하나만 섞여도 결과가 틀어진다.' },
          { label: '문자열 비교는 항상 숫자 비교와 같은 결과를 낸다', why: '틀렸다. 시뮬레이터 ②에서 자릿수가 다른 값을 넣어 보면 바로 갈린다.' },
          { label: 'pandas 가 비교 전에 문자열을 자동으로 숫자로 바꿔서', why: '틀렸다. dtype 이 문자열이면 pandas 는 그대로 사전식으로 비교한다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 V1-4',
        question:
          "df['평균기온'].fillna(0, inplace=True)를 실행한 뒤 df['평균기온'].isna().sum()이 실행 전과 " +
          '같다. 예외도 안 났는데 왜 결측이 그대로인가?',
        choices: [
          { label: "df['평균기온']으로 꺼낸 것이 원본과 분리될 수 있는 임시 조각이라, inplace=True가 그 조각에만 적용돼서", correct: true,
            why: 'ChainedAssignmentError 경고가 뜨지만 이름과 달리 예외가 아니라서 코드는 멈추지 않고 끝까지 실행된다. ' +
              "바른 형태는 df['평균기온'] = df['평균기온'].fillna(0)처럼 컬럼 전체를 재대입하는 것이다." },
          { label: 'fillna(0)이 잘못된 값을 채워서 이후 계산에서 다시 결측으로 바뀌어서', why: '틀렸다. 채우기 자체가 원본에 반영되지 않았을 뿐이다.' },
          { label: '평균기온 열에는 원래 결측이 없어서', why: '틀렸다. 평균기온에는 결측이 있다 — 그래서 채우려 한 것이다.' }
        ]
      }));
    }
  });
})();
