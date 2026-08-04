/* ch03-series.js — Series: 인덱스를 가진 1차원 (교재 3장)
 * IIFE 로 완전히 감싸 전역을 공유하지 않는다. render 는 여러 번 호출될 수 있으므로
 * 가변 상태는 전부 render 안의 지역 변수에 둔다(API.md §1 ②).
 */
(function () {
  'use strict';

  var MAX_VALUES = 8;
  var MIN_VALUES = 1;
  var LETTERS = 'abcdefghijklmnopqrstuvwxyz';

  /* 인덱스 모드별 라벨 생성. '기본' 은 null 을 돌려줘서 DF.series 가 RangeIndex 를 쓰게 한다. */
  function indexLabelsFor(mode, n) {
    if (mode === 'str') {
      var out = [];
      for (var i = 0; i < n; i++) out.push(LETTERS[i % LETTERS.length]);
      return out;
    }
    if (mode === 'dup') {
      var out2 = [];
      for (var j = 0; j < n; j++) out2.push(LETTERS[Math.floor(j / 2) % LETTERS.length]);
      return out2;
    }
    return null;
  }

  Lab.register({
    id: 'ch03-series',
    num: 3,
    title: 'Series — 인덱스를 가진 1차원',
    subtitle: '값과 인덱스가 하나로 붙어 다니는 1차원 자료구조',

    render: function (root) {
      // ───────────────────────────────── 시뮬레이터 ① Series 조립기
      var values = [88, 92, 79];
      var indexMode = 'default';

      var box1 = UI.el('div.card');
      box1.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ① Series 조립기' }));
      box1.appendChild(UI.note(
        '값 목록과 인덱스를 각각 바꿔 보라. 값과 인덱스는 항상 같은 길이로 붙어 다닌다.'
      ));

      var valuesRow = UI.el('div.control-row');
      var body1 = UI.el('div');

      function nextDefault() {
        return values.length ? values[values.length - 1] + 1 : 50;
      }

      function renderValuesRow() {
        UI.clear(valuesRow);
        valuesRow.appendChild(UI.el('span.control-label', { text: '값' }));
        values.forEach(function (v, i) {
          var inp = UI.el('input', {
            type: 'number', value: v, style: { width: '64px' }
          });
          inp.addEventListener('input', function () {
            values[i] = inp.value === '' ? 0 : Number(inp.value);
            rebuild1();
          });
          valuesRow.appendChild(inp);
        });
        valuesRow.appendChild(UI.el('button', {
          text: '+ 값 추가',
          onclick: function () {
            if (values.length >= MAX_VALUES) return;
            values.push(nextDefault());
            renderValuesRow();
            rebuild1();
          }
        }));
        valuesRow.appendChild(UI.el('button', {
          text: '− 값 삭제',
          onclick: function () {
            if (values.length <= MIN_VALUES) return;
            values.pop();
            renderValuesRow();
            rebuild1();
          }
        }));
      }

      var modeRow = UI.buttonGroup(
        [{ label: '기본 (0,1,2…)', value: 'default' },
         { label: '문자 (a,b,c…)', value: 'str' },
         { label: '중복 (a,a,b…)', value: 'dup' }],
        {
          label: '인덱스',
          selected: 0,
          onChange: function (v) { indexMode = v; rebuild1(); }
        }
      );

      function rebuild1() {
        UI.clear(body1);
        var idx = indexLabelsFor(indexMode, values.length);
        var opts = { name: '값' };
        if (idx) opts.index = idx;
        var s = DF.series(values.slice(), opts);

        body1.appendChild(UI.seriesTable(s, { frame: 'result' }));
        body1.appendChild(UI.code('s.values', { output: '[' + s.toArray().join(', ') + ']' }));
        body1.appendChild(UI.code('s.index', { output: '[' + s.labels().join(', ') + ']' }));
        body1.appendChild(UI.code('s.dtype', { output: s.dtype }));

        if (indexMode === 'dup') {
          body1.appendChild(UI.note(
            '인덱스에 중복 라벨이 있다 — 6장에서 이게 왜 중요한지 본다(두 Series 를 더할 때 ' +
            '같은 라벨끼리 곱집합으로 짝지어져 행이 늘어난다).',
            '중복 인덱스'
          ));
        }
      }

      root.appendChild(box1);
      box1.appendChild(valuesRow);
      box1.appendChild(modeRow);
      box1.appendChild(body1);
      renderValuesRow();
      rebuild1();

      // ───────────────────────────────── 시뮬레이터 ② 인덱스 불변 실험
      var box2 = UI.el('div.card');
      box2.appendChild(UI.el('div.panel-title', { text: '시뮬레이터 ② 인덱스 불변 실험' }));

      var demo = DF.series([10, 20, 30], { index: ['x', 'y', 'z'], name: 'v' });
      // pandas 는 인덱스 라벨 배열을 직접 대입하지 못하게 막는다. 이 실습에서는
      // 라벨 배열을 실제로 freeze 해서, 건드리면 정말로 예외가 나게 만든다(연출이 아니라 실제 실패).
      Object.freeze(demo.index.labels);

      var body2 = UI.el('div');
      var resultBox2 = UI.el('div');

      function draw2() {
        UI.clear(body2);
        body2.appendChild(UI.seriesTable(demo, { frame: 'original' }));
      }

      var changeValBtn = UI.el('button', {
        text: "값 바꾸기 — s.loc['y'] = 99",
        onclick: function () {
          demo.setLoc('y', 99);
          draw2();
          UI.clear(resultBox2);
          resultBox2.appendChild(UI.note('성공했다. 값은 라벨을 통해 얼마든지 바꿀 수 있다.'));
        }
      });
      var changeIdxBtn = UI.el('button', {
        text: "인덱스 바꾸기 — s.index[0] = 'w'",
        onclick: function () {
          UI.clear(resultBox2);
          try {
            demo.index.labels[0] = 'w';
            resultBox2.appendChild(UI.note('바뀌었다 — 이 실습 엔진에서는 원래 일어나면 안 되는 일이다.'));
          } catch (e) {
            resultBox2.appendChild(UI.danger('TypeError', 'Index does not support mutable operations'));
            resultBox2.appendChild(UI.note(
              '인덱스는 여러 Series 나 DataFrame 이 동시에 참조하는 "이름표 대장" 이다. 몰래 라벨을 ' +
              '바꾸면 같이 쓰는 다른 객체가 전부 영향을 받으므로 pandas 가 원천적으로 막아 둔다. ' +
              '라벨을 바꾸려면 rename() 으로 새 객체를 만든다.'
            ));
          }
          draw2();
        }
      });

      root.appendChild(box2);
      box2.appendChild(UI.el('div.control-row', null, [changeValBtn, changeIdxBtn]));
      box2.appendChild(body2);
      box2.appendChild(resultBox2);
      draw2();

      // ───────────────────────────────── 확인 문제
      root.appendChild(UI.quiz({
        title: '확인 문제 3-1',
        question:
          "s = pd.Series([10,20,30], index=['x','y','z']) 다음 두 줄이 있다. " +
          "(1) s['y'] = 99   (2) s.index[0] = 'w' — 어느 줄에서 에러가 나는가?",
        choices: [
          { label: '(1)에서 에러가 난다', why: '틀렸다. 값을 바꾸는 (1)은 문제없이 실행된다. Series 의 값은 가변이다.' },
          { label: '(2)에서 에러가 난다', correct: true,
            why: "맞다. 인덱스는 불변이라 (2)에서 TypeError: Index does not support mutable operations 가 난다." },
          { label: '둘 다 에러가 난다', why: '틀렸다. (1)은 정상적으로 실행된다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 3-2',
        question: '"Series 는 numpy.ndarray 의 자식 클래스다" — 이 말은 왜 틀렸는가?',
        choices: [
          { label: 'Series 는 ndarray 를 상속하지 않고 내부에 담고 있을 뿐이다(합성)', correct: true,
            why: 'issubclass(pd.Series, np.ndarray) 는 False 다. Series 는 ndarray 를 합성으로 담고 있어서 ' +
                 '.values 나 .to_numpy() 로 명시적으로 꺼내야 한다.' },
          { label: 'Series 는 애초에 배열을 담지 않는다', why: '틀렸다. Series 는 내부에 실제로 numpy 배열을 담고 있다. .values 로 꺼낼 수 있다.' },
          { label: 'numpy 가 pandas 보다 나중에 만들어졌기 때문이다', why: '상속 여부와 만들어진 순서는 관계없다.' }
        ]
      }));

      root.appendChild(UI.quiz({
        title: '확인 문제 3-3',
        question: 'ex_series.values() 처럼 괄호를 붙여 호출하면 무슨 일이 벌어지는가?',
        choices: [
          { label: '정상적으로 배열을 반환한다', why: '.values 는 속성(property)이지 메서드가 아니므로 틀렸다.' },
          { label: "TypeError: 'numpy.ndarray' object is not callable 가 난다", correct: true,
            why: '.values 는 이미 배열을 반환하는 속성이다. 그 배열을 다시 함수처럼 호출하려 하면 이 에러가 난다.' },
          { label: '아무 일도 일어나지 않는다', why: '틀렸다. 에러가 난다.' }
        ]
      }));
    }
  });
})();
