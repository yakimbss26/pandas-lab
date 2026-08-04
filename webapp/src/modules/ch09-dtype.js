/* ch09-dtype.js — 값 바꾸기와 타입 변환 (교재 9장)
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  /* NaN 을 항상 false 로 다루는 비교. DF 엔진의 비교 연산자(gt/le 등)와 같은 규칙이다
   * ( isNA(lv) || isNA(rv) ? false : fn(lv, rv) — df.js 참고 ). 여러 단계 if/elif 가 필요한
   * 분류 함수라 Series.le/gt 하나로는 못 쓰고, 같은 규칙을 스칼라용으로 직접 구현한다. */
  function naSafeLE(v, x) { return DF.isNA(v) ? false : v <= x; }

  /* 교재 9.5절 get_category 의 "버그" 버전 — 결측을 먼저 걸러내지 않는다. */
  function categorizeBuggy(age) {
    if (naSafeLE(age, 5)) return 'Baby';
    if (naSafeLE(age, 12)) return 'Child';
    if (naSafeLE(age, 18)) return 'Teenager';
    if (naSafeLE(age, 25)) return 'Student';
    if (naSafeLE(age, 35)) return 'Young Adult';
    if (naSafeLE(age, 60)) return 'Adult';
    return 'Elderly';
  }
  /* 고친 버전 — 결측을 맨 앞에서 따로 처리한다. */
  function categorizeFixed(age) {
    if (DF.isNA(age)) return '결측';
    return categorizeBuggy(age);
  }

  var CAT_ORDER = ['Baby', 'Child', 'Teenager', 'Student', 'Young Adult', 'Adult', 'Elderly'];
  var CAT_ORDER_FIXED = CAT_ORDER.concat(['결측']);

  function countsInOrder(catSeries, order) {
    var vc = catSeries.valueCounts();
    var labels = vc.labels(), vals = vc.toArray();
    var map = {};
    labels.forEach(function (l, i) { map[l] = vals[i]; });
    return order.map(function (c) { return { label: c, value: map[c] || 0 }; });
  }

  Lab.register({
    id: 'ch09-dtype',
    num: 9,
    title: '값 바꾸기와 타입 변환',
    subtitle: 'replace · to_numeric · astype 이 dtype 을 어떻게 바꾸는지, 그리고 결측이 조건문을 속이는 법',

    render: function (root) {
      var t = LabData.frame('titanic');
      var ramen = LabData.frame('ramen');

      // ───────────────────────────────── 시뮬레이터 ① dtype 승격표
      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① dtype 승격표' }));
      box1.appendChild(UI.note(
        '값의 조합에 따라 dtype 이 어떻게 정해지는지 DF.inferDtype() 으로 그 자리에서 계산한다.'
      ));

      var PRESETS = [
        { label: '[1, 2, 3]', values: [1, 2, 3] },
        { label: '[1, 2.5]', values: [1, 2.5] },
        { label: '[1, null]', values: [1, null] },
        { label: "['a', 'b']", values: ['a', 'b'] },
        { label: "[1, 'a']", values: [1, 'a'] },
        { label: '[true, false]', values: [true, false] },
        { label: '[true, 1]', values: [true, 1] }
      ];
      box1.appendChild(UI.table(
        [{ key: 'label', label: '값 조합' }, { key: 'dtype', label: 'dtype (DF.inferDtype 계산)' }],
        PRESETS.map(function (p) { return { label: p.label, dtype: DF.inferDtype(p.values) }; })
      ));

      var strDtype = DF.inferDtype(['a', 'b']);
      box1.appendChild(UI.note(
        "['a','b'] 처럼 문자열만 있으면 dtype 은 object 가 아니라 " + strDtype +
        " 다(실제로 방금 계산한 값). pandas 3.0 부터 문자열 전용 dtype 이 생겼기 때문이다. " +
        "[1,'a'] 처럼 숫자와 문자열이 섞이면 그때는 " + DF.inferDtype([1, 'a']) + " 로 떨어진다.",
        '★ 정정표 — pandas 3.0 의 변화'
      ));

      // 학생이 직접 값을 추가/제거하며 dtype 이 바뀌는 것을 본다
      var st1 = { values: [], nextInt: 1, nextFloat: 1.5, nextChar: 97 /* 'a' */, nextBool: true };
      var body1 = UI.el('div');

      function rebuild1() {
        UI.clear(body1);
        body1.appendChild(UI.el('div.mono', {
          text: '값 목록: [' + st1.values.map(function (v) {
            return v === null ? 'null' : (typeof v === 'string' ? "'" + v + "'" : String(v));
          }).join(', ') + ']'
        }));
        body1.appendChild(UI.note(
          '현재 dtype = ' + (st1.values.length ? DF.inferDtype(st1.values) : '(값이 없다)')
        ));
      }

      var addIntBtn = UI.el('button', {
        text: '정수 추가', onclick: function () { st1.values.push(st1.nextInt++); rebuild1(); }
      });
      var addFloatBtn = UI.el('button', {
        text: '실수 추가', onclick: function () { st1.values.push(st1.nextFloat); st1.nextFloat += 1; rebuild1(); }
      });
      var addStrBtn = UI.el('button', {
        text: '문자열 추가',
        onclick: function () { st1.values.push(String.fromCharCode(st1.nextChar++)); rebuild1(); }
      });
      var addBoolBtn = UI.el('button', {
        text: '불리언 추가',
        onclick: function () { st1.values.push(st1.nextBool); st1.nextBool = !st1.nextBool; rebuild1(); }
      });
      var addNABtn = UI.el('button', {
        text: '결측(null) 추가', onclick: function () { st1.values.push(null); rebuild1(); }
      });
      var popBtn = UI.el('button', {
        text: '마지막 값 제거', onclick: function () { st1.values.pop(); rebuild1(); }
      });
      var resetBtn1 = UI.el('button', {
        text: '초기화', onclick: function () { st1.values = []; rebuild1(); }
      });

      box1.appendChild(UI.el('div.panel-title', { text: '직접 만들어 보기' }));
      box1.appendChild(UI.el('div.control-row', null,
        [addIntBtn, addFloatBtn, addStrBtn, addBoolBtn, addNABtn, popBtn, resetBtn1]));
      box1.appendChild(body1);
      rebuild1();

      root.appendChild(box1);

      // ───────────────────────────────── 시뮬레이터 ② 숫자로 못 바꾸는 값 찾기
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 숫자로 못 바꾸는 값 찾기' }));

      var stars = ramen.col('Stars');
      box2.appendChild(UI.note(
        "ramen['Stars'] 는 척 보면 숫자 같지만 dtype 은 " + stars.dtype + " 다. to_numeric 으로 " +
        '바로 바꾸려 하면 무슨 일이 일어나는지 본다.'
      ));

      var raiseMsg = null;
      try {
        stars.toNumeric();
      } catch (e) {
        raiseMsg = e.message;
      }
      box2.appendChild(UI.danger(
        "stars.toNumeric() (기본값, errors='raise')",
        raiseMsg || '(예외가 발생하지 않았다 — 데이터 상태를 확인하라)'
      ));

      var st2 = { coerced: false };
      var body2 = UI.el('div');

      function rebuild2() {
        UI.clear(body2);
        if (!st2.coerced) {
          body2.appendChild(UI.note("아직 coerce 를 실행하지 않았다. 아래 버튼을 눌러 보라."));
          return;
        }
        var coerced = stars.toNumeric('coerce');
        var badPos = [];
        for (var i = 0; i < coerced.length(); i++) if (DF.isNA(coerced.at(i))) badPos.push(i);

        body2.appendChild(UI.note(
          "toNumeric('coerce') 는 실패한 값을 에러 대신 NaN 으로 바꾼다. 지금 데이터에서 실패한 " +
          '값은 ' + badPos.length + '건이다(계산한 값 — 합성 데이터라 교재의 3건과 다를 수 있다).'
        ));
        if (badPos.length) {
          body2.appendChild(UI.frameTable(
            ramen.cols(['Brand', 'Variety', 'Country', 'Stars']).take(badPos),
            { maxRows: 10, caption: '숫자로 바뀌지 못한 행' }
          ));
        }
      }

      var coerceBtn = UI.el('button', {
        text: "errors='coerce' 로 다시 시도",
        onclick: function () { st2.coerced = true; rebuild2(); }
      });
      box2.appendChild(coerceBtn);
      box2.appendChild(body2);
      rebuild2();

      root.appendChild(box2);

      // ───────────────────────────────── 시뮬레이터 ③ replace 와 dtype
      var box3 = UI.el('div.card');
      box3.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ③ replace 와 dtype' }));

      var sex = t.col('Sex');
      var st3 = { mode: 'num' };
      var body3 = UI.el('div');

      var MODES3 = [
        { label: "숫자로: {male:0, female:1}", value: 'num' },
        { label: "문자열로: {male:'M', female:'F'}", value: 'str' }
      ];

      function rebuild3() {
        UI.clear(body3);
        var mapping = st3.mode === 'num' ? { male: 0, female: 1 } : { male: 'M', female: 'F' };
        var replaced = sex.replace(mapping);

        body3.appendChild(UI.table(
          [{ key: 'expr', label: '표현식' }, { key: 'dtype', label: 'dtype' }],
          [
            { expr: 'Sex (원본)', dtype: sex.dtype },
            { expr: 'Sex.replace(' + JSON.stringify(mapping) + ')', dtype: replaced.dtype }
          ]
        ));
        body3.appendChild(UI.seriesTable(replaced, { maxRows: 5 }));

        if (st3.mode === 'num') {
          body3.appendChild(UI.danger(
            '숫자를 넣었는데 str 이 아니라 object 다',
            "replace 는 값을 보고 dtype 을 다시 추론하지 않는다. 원래 dtype(" + sex.dtype +
            ')과 새 값(정수)을 함께 담을 수 있는 더 넓은 dtype 으로 승격시킬 뿐이라 결과는 ' +
            replaced.dtype + ' 이다. 문자열과 정수를 동시에 담을 수 있는 dtype 은 object 뿐이다.'
          ));
        } else {
          body3.appendChild(UI.note(
            '이번에는 문자열을 문자열로 바꿨을 뿐이라 dtype 이 ' + sex.dtype + ' 그대로 남는다. ' +
            'dtype 이 바뀌는 것은 "숫자를 넣어서" 가 아니라 "원래 dtype 과 다른 종류가 섞여서" 다.'
          ));
        }
      }

      box3.appendChild(UI.buttonGroup(MODES3, {
        label: '어떻게 바꿀까', selected: 0,
        onChange: function (v) { st3.mode = v; rebuild3(); }
      }));
      box3.appendChild(body3);
      rebuild3();

      root.appendChild(box3);

      // ───────────────────────────────── 시뮬레이터 ④ 결측이 조건문을 통과한다
      var box4 = UI.el('div.card');
      box4.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ④ ★★ 결측이 조건문을 통과한다' }));
      box4.appendChild(UI.note(
        "get_category(age) 함수는 if/elif 사슬 끝에 else: 'Elderly' 를 둔다. NaN 은 어떤 비교에서도 " +
        'False 이므로, 나이를 모르는 사람도 모든 조건을 통과해 마지막 else 로 떨어진다.'
      ));

      var ages = t.col('Age');
      var naDemoIdx = (function () {
        var arr = ages.isna().toArray();
        return arr.indexOf(true);
      })();
      if (naDemoIdx !== -1) {
        box4.appendChild(UI.table(
          [{ key: 'cond', label: '조건 (결측 나이 하나에 대해)' }, { key: 'result', label: '결과' }],
          [
            { cond: 'age <= 5', result: String(ages.le(5).at(naDemoIdx)) },
            { cond: 'age <= 60', result: String(ages.le(60).at(naDemoIdx)) },
            { cond: 'age > 60', result: String(ages.gt(60).at(naDemoIdx)) }
          ],
          { caption: '엔진의 비교 연산도 결측을 항상 False 로 다룬다' }
        ));
      }

      var actualOver60 = ages.gt(60).sum();
      var st4 = { fixed: false };
      var body4 = UI.el('div');

      function rebuild4() {
        UI.clear(body4);
        var order = st4.fixed ? CAT_ORDER_FIXED : CAT_ORDER;
        var cats = ages.apply(st4.fixed ? categorizeFixed : categorizeBuggy);
        var items = countsInOrder(cats, order);

        body4.appendChild(UI.bar(items, {
          title: (st4.fixed ? '수정 버전' : '버그 버전') + ' — Age_cat.value_counts()',
          labelHeader: '분류', valueHeader: '인원', padLeft: 110
        }));

        var catArr = cats.toArray();
        var isnaArr = ages.isna().toArray();
        var elderlyTotal = items.filter(function (it) { return it.label === 'Elderly'; })[0].value;

        if (!st4.fixed) {
          var wronglyElderly = 0;
          for (var i = 0; i < catArr.length; i++) {
            if (isnaArr[i] && catArr[i] === 'Elderly') wronglyElderly++;
          }
          body4.appendChild(UI.danger(
            'Elderly 의 정체',
            'Elderly 로 분류된 ' + elderlyTotal + '명 중 ' + wronglyElderly + '명은 사실 나이를 ' +
            '모르는 결측이다. 실제로 60살을 넘은 사람은 ' + actualOver60 + '명뿐이다.'
          ));
        } else {
          var missingTotal = items.filter(function (it) { return it.label === '결측'; })[0].value;
          body4.appendChild(UI.note(
            '결측을 먼저 걸러내자 "결측" 카테고리에 ' + missingTotal + '명이 따로 잡히고, Elderly 는 ' +
            elderlyTotal + '명으로 줄었다 — 실제로 60살을 넘은 ' + actualOver60 + '명과 같다.'
          ));
        }
      }

      box4.appendChild(UI.buttonGroup(
        [{ label: '버그 버전 (else: Elderly)', value: 'buggy' }, { label: '수정 버전 (결측 먼저 분기)', value: 'fixed' }],
        { selected: 0, onChange: function (v) { st4.fixed = (v === 'fixed'); rebuild4(); } }
      ));
      box4.appendChild(body4);
      rebuild4();

      root.appendChild(box4);

      // ───────────────────────────────── 확인 문제
      root.appendChild(UI.quiz({
        title: '확인 문제 9-1',
        question: "pd.Series(['a', 'b']).dtype 는 무엇인가?",
        choices: [
          { label: 'object', why: '틀렸다. pandas 2.x 까지는 object 였지만, 3.0 부터는 문자열 전용 dtype 이 생겼다.' },
          { label: 'str', correct: true,
            why: "실제로 DF.inferDtype(['a','b']) 를 계산하면 " + strDtype + " 가 나온다. pandas 3.0 의 " +
                 '변화다 — 문자열만 있으면 object 가 아니라 전용 str dtype 을 받는다.' },
          { label: 'int64', why: '틀렸다. 문자열 값에는 나올 수 없는 dtype 이다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 9-2',
        question:
          "Sex 컬럼(dtype " + sex.dtype + ")을 {male:0, female:1} 로 replace 하면 dtype 은 무엇이 되는가?",
        choices: [
          { label: sex.dtype, why: '틀렸다. 새로 들어온 값(정수)이 원래 dtype 과 다른 종류라 승격이 일어난다.' },
          { label: 'float64', why: '틀렸다. replace 는 값에서 dtype 을 다시 추론하지 않는다.' },
          { label: 'object', correct: true,
            why: '문자열(' + sex.dtype + ')과 정수를 동시에 담을 수 있는 dtype 은 object 뿐이다. ' +
                 '숫자를 넣었다고 곧바로 숫자형이 되지 않는다 — 진짜 숫자 dtype 이 필요하면 ' +
                 'to_numeric 을 이어서 써야 한다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 9-3',
        question:
          "get_category(age) 의 if/elif 사슬(끝에 else: 'Elderly')을 나이가 결측인 승객에게 적용하면 " +
          '어떤 카테고리로 분류되고, 왜 그런가?',
        choices: [
          { label: '에러가 난다', why: "틀렸다. NaN 과의 비교는 에러 없이 항상 False 를 돌려준다." },
          { label: "Baby 로 분류된다", why: '틀렸다. age <= 5 도 False 이므로 Baby 가 아니다.' },
          { label: "Elderly 로 분류된다", correct: true,
            why: 'NaN 은 <=, > 등 모든 비교에서 False 다. 그래서 if/elif 의 모든 조건을 다 통과하지 ' +
                 '못하고 마지막 else: cat = \'Elderly\' 로 떨어진다. 결측을 나이가 아주 많은 사람으로 ' +
                 '잘못 분류한 것이다. 함수 맨 앞에 결측을 먼저 처리하는 분기를 추가해야 막을 수 있다.' }
        ]
      }));
    }
  });
})();
