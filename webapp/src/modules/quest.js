/* quest.js — "스스로 하기" 과제 화면 (#/quest)
 *
 * 형식은 NumPy Lab 의 과제 화면에서 가져왔고 **내용은 pandas 로 새로 썼다.**
 * 5단계 · 문항 25개 · 예측 5개 · 메모 8개 · 배지 5개.
 *
 * 이 화면이 노리는 것은 하나다 — **예측 → 확인 → 뒤집기.**
 * 시작부에서 예측 다섯 개를 먼저 받아 두고, 나중에 그 문항을 맞히면
 * "처음에는 X 라고 생각했다" 를 보여 준다. 맨 아래 확인서가 뒤집은 문항을 모은다.
 * ★ 예측은 반드시 **실재하는 문항 번호**에 건다. 가짜 번호를 쓰면 집계에서 조용히 빠진다
 *   (NumPy Lab 의 원본 노트북이 실제로 그랬다).
 *
 * ★ 문항의 답은 전부 실제 pandas 3.0.5 로 실행해 확인했다. 손계산으로 적은 값은 없다.
 *
 * 이 화면은 장(chapter)이 아니다. Lab.register({ extra: true }) 로 등록해서
 * 학습 과정 목록·홈 타일 격자·이전/다음 줄에 끼지 않고, **진도 분모(14장)도 늘리지 않는다.**
 *
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다.
 */
(function () {
  'use strict';

  var UI = window.UI, DF = window.DF, el = UI.el;
  var P = UI.progress;

  // ─────────────────────────────────────────────── 저장소
  /* 장들과 같은 localStorage 를 쓴다. 문항 정답 여부만 'quest:q<번호>' 로 넣어서
   * UI.progress.stats('quest') 가 그대로 세게 했다(사이드바 점).
   * 'quest:' 로 시작하는 키는 사이드바의 "장 진도 초기화" 가 건드리지 않는다. */

  function get(k, dflt) { var d = P.load(); return (k in d) ? d[k] : dflt; }
  function put(k, v) { var d = P.load(); d[k] = v; P.save(d); }

  function solved(id) { return get('quest:q' + id, false) === true; }
  function markSolved(id, ok) { P.mark('quest:q' + id, ok); }   // emit → 사이드바 갱신
  function tries(id) { return get('quest:try:' + id, 0); }
  function bumpTries(id) { var n = tries(id) + 1; put('quest:try:' + id, n); return n; }
  function firstTry(id) { return get('quest:first:' + id, false) === true; }
  function prediction(id) { return get('quest:pre:' + id, ''); }
  function memoOf(id) { return get('quest:memo:' + id, ''); }

  // ─────────────────────────────────────────────── 이름(공용 PC 대응)
  /* 실습실처럼 한 컴퓨터를 여러 학생이 쓰면 localStorage 가 공유되어 앞 사람의 답이
   * 다음 사람에게 그대로 보인다. 그래서 "지금 하는 사람"을 두고, 사람이 바뀌면
   * 앞 사람 기록을 questbox:<이름> 으로 옮겨 **보관한다. 지우지 않는다.**
   * 나중에 그 이름을 다시 넣으면 하던 데서 이어진다.
   *
   * 비밀번호는 없다. 남의 이름을 고르면 그 기록이 보인다 — 점수에 반영하지 않는
   * 과제라서 이 정도로 둔다. 점수에 쓰려면 서버가 있어야 한다. */

  var WHO = 'quest:who';
  var BOX = 'questbox:';

  function whoNow() { return get(WHO, ''); }

  /** 지금 화면에 올라와 있는 기록의 키들 (이름표는 뺀다) */
  function activeKeys(d) {
    return Object.keys(d).filter(function (k) {
      return k.indexOf('quest:') === 0 && k !== WHO;
    });
  }

  function boxNames() {
    return Object.keys(P.load())
      .filter(function (k) { return k.indexOf(BOX) === 0; })
      .map(function (k) { return k.slice(BOX.length); })
      .sort();
  }

  /** 사람 바꾸기 — 앞 사람 것을 상자에 넣고, 그 사람 것을 꺼내 온다 */
  function switchTo(name) {
    name = String(name == null ? '' : name).trim();
    if (!name) return false;
    var d = P.load();
    if (d[WHO] === name) return true;

    if (d[WHO]) {                        // 앞 사람 기록을 상자에 보관
      var box = {};
      activeKeys(d).forEach(function (k) { box[k] = d[k]; });
      d[BOX + d[WHO]] = box;
    }
    activeKeys(d).forEach(function (k) { delete d[k]; });

    var mine = d[BOX + name];            // 전에 하던 것이 있으면 되돌린다
    if (mine) {
      Object.keys(mine).forEach(function (k) { d[k] = mine[k]; });
      delete d[BOX + name];              // 사본을 남기지 않는다 — 지금 것이 원본이다
    }

    d[WHO] = name;
    P.save(d);
    return true;
  }

  // ─────────────────────────────────────────────── 판정기
  /* 정규화한 뒤 정답 배열과 비교한다. 소문자화하고 공백·따옴표·대괄호·괄호를 지우고
   * 끝의 콤마를 턴다. 그래서 "3,2" 와 "(3, 2)" 와 "[3,2]" 가 같은 답이 된다. */

  function norm(s) {
    s = String(s == null ? '' : s).trim().toLowerCase();
    s = s.replace(/[ \t'"[\]()]/g, '');
    while (s.charAt(s.length - 1) === ',') s = s.slice(0, -1);
    return s;
  }

  function matches(input, answers) {
    var n = norm(input);
    if (!n) return false;
    for (var i = 0; i < answers.length; i++) if (n === norm(answers[i])) return true;
    return false;
  }

  // ─────────────────────────────────────────────── 문항
  /* ch = 이 문항을 확인할 장 번호. LINKS 가 해시 경로로 바꿔 준다. */

  var LINKS = {
    '5': { id: 'ch05-locindex', t: 'loc 와 iloc' },
    '6': { id: 'ch06-align', t: '인덱스 정렬' },
    '7': { id: 'ch07-copy', t: '뷰와 복사, Copy-on-Write' },
    '8': { id: 'ch08-missing', t: '결측 데이터' },
    '9': { id: 'ch09-dtype', t: '값 바꾸기와 타입 변환' },
    '11': { id: 'ch11-groupby', t: 'groupby' },
    '12': { id: 'ch12-merge', t: '표를 합치기' }
  };

  /* 이 과제에서 계속 쓰는 표. 화면에도 그려 주고 코드에도 같은 것이 나온다. */
  var BASE_SRC = "df = pd.DataFrame({'a': [1, 2, 3, 4], 'b': [10, 20, 30, 40]})";

  var STAGES = [
    {
      n: '1단계',
      title: '지난 노트북 코드가 지금은 안 돈다',
      badge: '출발 도장',
      intro: '수업 노트북은 pandas 1.x 로 쓰였다. 지금 이 실습장이 쓰는 것은 <b>3.0</b> 이고, ' +
             '그 사이에 <b>없어진 기능</b>이 있다. 지난 코드를 그대로 돌리면 여기서 먼저 멈춘다.',
      items: [
        {
          id: '1-1', ch: '12',
          code: "df = pd.DataFrame({'a': [1, 2]})\ndf.append({'a': 3}, ignore_index=True)   # AttributeError",
          q: '없어진 <code>append</code> 대신, 두 표를 <b>세로로 이어 붙일 때</b> 쓰는 함수는?',
          ph: '예: pd.무엇',
          ans: ['pd.concat', 'concat', 'pandas.concat', 'pd.concat()'],
          hint: '12장 첫 시뮬레이터의 이름이 그것이다. 함수 이름만 적으면 된다.',
          explain: 'pandas 2.0 에서 <code>DataFrame.append</code> 가 없어졌다. ' +
                   '<code>pd.concat([df1, df2], ignore_index=True)</code> 를 쓴다. ' +
                   '한 줄씩 <code>append</code> 로 붙이는 것은 매번 표를 새로 만드는 일이라 느리기도 했다.'
        },
        {
          kind: 'predict',
          title: '화면을 열기 전에 — 다섯 가지 예측',
          note: '아직 확인하지 말고 <b>생각만</b> 적어 보자. 이 다섯 개가 오늘의 지도가 된다. ' +
                '틀려도 좋다 — 오히려 틀렸다가 직접 뒤집은 것이 오늘 진짜로 배운 것이고, ' +
                '맨 아래 확인서에서 그 목록을 보여 준다.',
          code: BASE_SRC,
          targets: [
            { id: '2-1a', q: "<code>sub = df[df['a'] &gt; 2]</code> 로 자른 뒤 <code>sub['b'] = 0</code> 을 했다. <b>원본</b> <code>df['b']</code> 는 어떻게 될까?" },
            { id: '3-1', q: "<code>s = pd.Series([10,20,30,40], index=['a','b','c','d'])</code> 에서 <code>s.loc['b':'d']</code> 의 길이는?" },
            { id: '4-1a', q: "인덱스가 <code>['a','b']</code> 인 Series 와 <code>['b','c']</code> 인 Series 를 더하면 결과의 길이는?" },
            { id: '5-2', q: "실수 컬럼에 <code>.fillna('0')</code> 을 하면 dtype 은 무엇이 될까?" },
            { id: '5-5', q: "키가 <code>[1,2,3]</code> 인 표와 <code>[2,3,4]</code> 인 표를 <code>how='inner'</code> 로 합치면 몇 행일까?" }
          ]
        }
      ]
    },

    {
      n: '2단계',
      title: '잘라 놓은 표를 고쳤는데 원본이 그대로다',
      badge: '사본 사냥꾼 배지',
      intro: '7장 <b>뷰와 복사, Copy-on-Write</b> 로 가자. 참조 카운트와 블록이 복사되는 순간을 ' +
             '눈으로 보면서 아래를 풀어 보자. <b>여기서 조용히 아무 일도 일어나지 않는 것</b>이 오늘의 함정이다.',
      base: true,
      items: [
        {
          id: '2-1a', ch: '7',
          code: BASE_SRC + "\nsub = df[df['a'] > 2]\nsub['b'] = 0\nprint(df['b'].tolist())",
          q: '<b>원본</b> <code>df</code> 의 <code>b</code> 컬럼 값은?',
          ph: '예: 1,2,3,4',
          ans: ['10,20,30,40'],
          hint: '마스크(불린)로 자른 것은 뷰가 아니라 <b>사본</b>이다. 7장의 공유 배지를 확인해 보자.',
          explain: '불린 마스크로 고른 것은 새 블록이다. 그래서 <code>sub</code> 를 고쳐도 ' +
                   '<code>df</code> 는 그대로다. 원본을 바꾸려고 이렇게 썼다면 <b>아무 일도 일어나지 않은 것</b>이다.'
        },
        {
          id: '2-1b', ch: '7',
          q: '그러면 <code>sub</code> 의 <code>b</code> 는 어떻게 되었나?',
          ph: '예: 1,2',
          ans: ['0,0'],
          hint: '조각 자체는 두 행이고, 그 두 행은 바뀌었다.',
          explain: '조각은 바뀌고 원본은 그대로다. 이 어긋남이 "왜 안 바뀌지?" 의 정체다.'
        },
        {
          id: '2-2a', ch: '7',
          code: BASE_SRC + "\ndf['b'][0] = 99\nprint(df.loc[0, 'b'])",
          q: '<code>df.loc[0, \'b\']</code> 의 값은?',
          ph: '숫자 하나',
          ans: ['10'],
          hint: '<code>df[\'b\']</code> 로 한 번, <code>[0]</code> 으로 또 한 번 — <b>두 번에 나눠</b> 접근했다.',
          explain: '<b>연쇄 할당(chained assignment)</b> 이다. <code>df[\'b\']</code> 가 만든 임시 조각에 ' +
                   '값을 넣었고, 그 조각은 곧 버려진다. 원본은 <code>10</code> 그대로다.'
        },
        {
          id: '2-2b', ch: '7',
          q: '그때 pandas 가 내는 <b>경고의 이름</b>은?',
          ph: '예: SomeWarning',
          ans: ['ChainedAssignmentError', 'pandas.errors.ChainedAssignmentError'],
          hint: '이름에 Error 가 붙어 있지만 <b>예외가 아니라 경고</b>다. 코드는 끝까지 돌아간다.',
          explain: '<code>ChainedAssignmentError</code> 다. 이름과 달리 <b>경고</b>라서 프로그램이 멈추지 않는다. ' +
                   '경고를 안 보고 넘어가면 결과가 반영되지 않은 것을 모른 채 다음으로 간다 — 가장 위험한 종류다.'
        },
        {
          id: '2-2c', ch: '7',
          q: '0번 행의 <code>b</code> 를 <b>실제로</b> 99 로 바꾸려면 어떻게 쓰나? 한 줄로 적어 보자.',
          ph: "예: df.무엇[...] = 99",
          ans: ["df.loc[0,'b'] = 99", 'df.loc[0,"b"] = 99', 'df.loc[0, b] = 99'],
          hint: '한 번에, 하나의 인덱서로 행과 열을 같이 집어야 한다.',
          explain: '<code>df.loc[0, \'b\'] = 99</code> — <b>한 번의 인덱싱</b>으로 행과 열을 같이 집으면 ' +
                   'pandas 가 원본을 직접 고친다. 나눠서 접근하는 순간 임시 조각이 끼어든다.'
        },
        {
          kind: 'memo', id: '2-3',
          q: '예전 pandas 는 연쇄 할당이 <b>어떤 때는 먹고 어떤 때는 안 먹었다.</b> ' +
             '지금은 <b>항상 안 먹고 대신 경고한다.</b> 어느 쪽이 배우기에 나은지, 왜 그런지 자기 말로 적어 보자.'
        },
        {
          id: '2-4', ch: '7',
          code: BASE_SRC + "\ns = df['a']\ns.iloc[0] = 99\nprint(df.loc[0, 'a'])",
          q: '<code>df.loc[0, \'a\']</code> 의 값은?',
          ph: '숫자 하나',
          ans: ['1'],
          hint: '컬럼을 꺼내 변수에 담았다. 그 변수에 <b>쓰는 순간</b> 무슨 일이 일어나는지 7장에서 보자.',
          explain: '꺼낸 컬럼은 처음엔 원본과 블록을 공유하지만, <b>쓰는 순간 복사된다</b>(Copy-on-Write). ' +
                   '그래서 <code>s</code> 만 99 가 되고 <code>df</code> 는 1 그대로다.'
        }
      ]
    },

    {
      n: '3단계',
      title: '같은 숫자 2 가 다른 행을 가리킨다',
      badge: '라벨 길잡이 배지',
      intro: '5장 <b>loc 와 iloc</b> 로 가자. 인덱스를 "행 번호" 라고 생각하면 여기서 반드시 걸린다.',
      items: [
        {
          id: '3-1', ch: '5',
          code: "s = pd.Series([10, 20, 30, 40], index=['a', 'b', 'c', 'd'])\nprint(s.loc['b':'d'].tolist())",
          q: '<code>s.loc[\'b\':\'d\']</code> 의 <b>길이</b>는?',
          ph: '개수',
          ans: ['3'],
          hint: '파이썬 슬라이스의 습관과 다르다. 5장의 "슬라이스 — 끝을 포함하는가" 를 열어 보자.',
          explain: '<b>라벨 슬라이스는 끝을 포함한다.</b> <code>b, c, d</code> 세 개다. ' +
                   '파이썬 리스트나 <code>iloc</code> 과 다른 유일한 자리라서 자주 틀린다.'
        },
        {
          id: '3-2', ch: '5',
          code: 's = pd.Series([10, 20, 30, 40], index=[\'a\', \'b\', \'c\', \'d\'])\nprint(s.iloc[1:3].tolist())',
          q: '<code>s.iloc[1:3]</code> 의 <b>길이</b>는?',
          ph: '개수',
          ans: ['2'],
          hint: '이쪽은 파이썬 습관 그대로다.',
          explain: '<b>위치 슬라이스는 끝을 포함하지 않는다.</b> 두 개다. 같은 표에서 ' +
                   '<code>loc</code> 은 3개, <code>iloc</code> 은 2개 — 이 차이가 오늘 기억할 것이다.'
        },
        {
          id: '3-3', ch: '5',
          code: 't = pd.Series([10, 20, 30], index=[2, 0, 1])\nprint(t.loc[2], t.iloc[2])',
          q: '<code>t.loc[2]</code> 의 값은?',
          ph: '숫자 하나',
          ans: ['10'],
          hint: '<code>loc</code> 은 <b>라벨</b>을 찾는다. 라벨 2 는 몇 번째에 있나?',
          explain: '라벨 <code>2</code> 는 맨 앞에 있으므로 <code>10</code> 이다.'
        },
        {
          id: '3-4', ch: '5',
          q: '같은 표에서 <code>t.iloc[2]</code> 의 값은?',
          ph: '숫자 하나',
          ans: ['30'],
          hint: '<code>iloc</code> 은 <b>위치</b>다. 0, 1, 2 로 세면 된다.',
          explain: '같은 숫자 <code>2</code> 인데 <code>loc</code> 은 <code>10</code>, ' +
                   '<code>iloc</code> 은 <code>30</code> 을 준다. 인덱스가 <code>0,1,2…</code> 가 아닐 때 갈린다.'
        },
        {
          id: '3-5', ch: '5',
          code: BASE_SRC + "\nd = df[df['a'] > 2]\nprint(d.index.tolist())",
          q: '걸러낸 <code>d</code> 의 인덱스는?',
          ph: '예: 0,1',
          ans: ['2,3'],
          hint: '걸러내도 <b>인덱스는 다시 매겨지지 않는다.</b> 원래 자리의 번호를 그대로 들고 온다.',
          explain: '필터는 인덱스를 새로 매기지 않는다. 그래서 <code>d</code> 의 인덱스는 ' +
                   '<code>0, 1</code> 이 아니라 <code>2, 3</code> 이다.'
        },
        {
          id: '3-6', ch: '5',
          q: '그 <code>d</code> 에 대고 <code>d.loc[0]</code> 을 하면 무엇이 나오나? <b>오류 이름</b>을 적어 보자.',
          ph: '예: SomeError',
          ans: ['KeyError'],
          hint: '라벨 0 이 남아 있는지 위 문항의 답을 다시 보자.',
          explain: '<code>KeyError</code> 다. 라벨 <code>0</code> 은 걸러지면서 사라졌다. ' +
                   '"첫 행" 을 원한 것이라면 <code>d.iloc[0]</code> 을 써야 한다.'
        },
        {
          kind: 'memo', id: '3-7',
          q: '인덱스를 <b>행 번호</b>라고 생각했을 때 생기는 오해를 한 문장으로 적어 보자. ' +
             '위 3-5, 3-6 에서 본 것을 근거로 삼으면 된다.'
        }
      ]
    },

    {
      n: '4단계',
      title: '연산은 위치가 아니라 인덱스로 짝짓는다',
      badge: '정렬 감시자 배지',
      intro: '6장 <b>인덱스 정렬</b> 로 가자. 넘파이 배열이라면 위치끼리 더하지만 pandas 는 아니다. ' +
             '짝짓기 표를 보면서 아래를 풀어 보자.',
      items: [
        {
          id: '4-1a', ch: '6',
          code: "x = pd.Series([1, 2], index=['a', 'b'])\ny = pd.Series([10, 20], index=['b', 'c'])\nprint(x + y)",
          q: '<code>x + y</code> 결과의 <b>길이</b>는?',
          ph: '개수',
          ans: ['3'],
          hint: '둘 중 한쪽에만 있는 라벨도 결과에 남는다. 6장의 짝짓기 표를 보자.',
          explain: '두 인덱스의 <b>합집합을 정렬한 것</b>이 결과 인덱스가 된다 — <code>a, b, c</code> 세 개다. ' +
                   '길이가 2 인 것 둘을 더했는데 3 이 나온다.'
        },
        {
          id: '4-1c', ch: '6',
          q: '결과에서 <code>b</code> 자리의 값은?',
          ph: '숫자 하나',
          ans: ['12', '12.0'],
          hint: '양쪽에 다 있는 라벨은 하나뿐이다.',
          explain: '<code>b</code> 만 양쪽에 있으므로 <code>2 + 10 = 12</code>. ' +
                   '나머지 <code>a</code> 와 <code>c</code> 는 짝이 없어 <code>NaN</code> 이 되고, ' +
                   '그래서 결과 dtype 이 <code>float64</code> 로 올라간다.'
        },
        {
          id: '4-2', ch: '6',
          code: "x = pd.Series([1, 2], index=['a', 'b'])\ny = pd.Series([10, 20], index=['b', 'c'])\nprint(x.add(y, fill_value=0))",
          q: '<code>x.add(y, fill_value=0)</code> 결과에 <code>NaN</code> 은 몇 개인가?',
          ph: '개수',
          ans: ['0'],
          hint: '짝이 없는 자리를 0 으로 채우고 나서 더한다.',
          explain: '<code>fill_value</code> 는 <b>한쪽에만 있는 자리</b>를 그 값으로 채우고 더한다. ' +
                   '그래서 <code>NaN</code> 이 하나도 없다 — <code>a=1, b=12, c=20</code>.'
        },
        {
          id: '4-3', ch: '6',
          code: "x = pd.Series([1, 2], index=['e', 'e'])\ny = pd.Series([10, 20, 30], index=['e', 'e', 'e'])\nprint(len(x + y))",
          q: '결과의 <b>행 수</b>는?',
          ph: '개수',
          ans: ['6'],
          hint: '라벨이 양쪽에 여러 개면 <b>모든 짝</b>을 만든다. 2 와 3 을 어떻게 하면 되나?',
          explain: '중복 라벨은 <b>곱집합</b>으로 짝지어진다. <code>2 × 3 = 6</code> 행이다. ' +
                   '표를 합칠 생각이 없었는데 행이 늘어나 있으면 대개 이것이다.'
        },
        {
          id: '4-4', ch: '6',
          code: "df1 = pd.DataFrame({'a': [1], 'b': [2]})\ns = pd.Series([10, 20], index=['b', 'c'])\nprint((df1 + s).columns.tolist())",
          q: '<code>df1 + s</code> 의 <b>컬럼 수</b>는?',
          ph: '개수',
          ans: ['3'],
          hint: 'DataFrame 과 Series 를 더하면 Series 의 인덱스는 <b>컬럼</b>에 맞춰진다.',
          explain: 'DataFrame + Series 는 기본이 <b>컬럼 정렬</b>이다. ' +
                   '컬럼 <code>a, b</code> 와 인덱스 <code>b, c</code> 의 합집합이라 <code>a, b, c</code> 세 개가 된다. ' +
                   '행에 맞추고 싶으면 <code>df1.add(s, axis=0)</code> 을 쓴다.'
        },
        {
          kind: 'memo', id: '4-5',
          q: '넘파이 배열이라면 길이가 같은 것끼리 <b>위치로</b> 더한다. pandas 는 <b>라벨로</b> 더한다. ' +
             '이 차이 때문에 생길 수 있는 실수를 하나 상상해서 적어 보자.'
        }
      ]
    },

    {
      n: '5단계',
      title: '결측, 타입, 묶기, 합치기',
      badge: '표 다루기 면허',
      intro: '남은 함정을 한 번에 훑는다. 8장·9장·11장·12장을 오가며 확인하자.',
      items: [
        {
          id: '5-1', ch: '8',
          code: 's = pd.Series([1, 2, None])\nprint(s.dtype)',
          q: '이 Series 의 <code>dtype</code> 은?',
          ph: '예: int64',
          ans: ['float64'],
          hint: '정수만 넣었는데 하나가 비어 있다. 빈 자리를 표현하려면 무엇이 필요한가?',
          explain: '<code>NaN</code> 은 실수라서 정수 컬럼이 <code>float64</code> 로 올라간다. ' +
                   '"왜 내 정수 컬럼에 소수점이 붙었지?" 의 답이 이것이다.'
        },
        {
          id: '5-2', ch: '9',
          code: "s = pd.Series([1, 2, None])\nprint(s.fillna(0).dtype)\nprint(s.fillna('0').dtype)   # 따옴표 하나 차이",
          q: '<code>s.fillna(\'0\')</code> 의 <code>dtype</code> 은?',
          ph: '예: float64',
          ans: ['object'],
          hint: '따옴표를 붙였다. 숫자와 문자가 한 컬럼에 섞이면 pandas 는 무엇으로 담는가?',
          explain: '<code>object</code> 다. 숫자 <code>0</code> 을 넣었으면 <code>float64</code> 로 남지만, ' +
                   '문자 <code>\'0\'</code> 을 넣는 순간 컬럼 전체가 <code>object</code> 로 올라가고 ' +
                   '<b>이후 산술 연산이 죽는다.</b> 에러도 경고도 없이 타입만 바뀐다.'
        },
        {
          id: '5-3', ch: '8',
          code: 's = pd.Series([1, 2, np.nan])\nprint(s.mean())\nprint(np.mean(s.to_numpy()))',
          q: '<code>s.mean()</code> 의 값은?',
          ph: '숫자 하나',
          ans: ['1.5'],
          hint: 'pandas 는 결측을 <b>건너뛰고</b> 계산한다. 그러면 몇 개로 나누나?',
          explain: 'pandas 는 결측을 빼고 <code>(1+2)/2 = 1.5</code> 로 계산한다. ' +
                   '같은 값을 넘파이로 계산하면 <code>nan</code> 이다. ' +
                   '<b>분모가 3 이 아니라 2 라는 것</b>을 모르고 쓰면 평균을 잘못 읽는다.'
        },
        {
          id: '5-4', ch: '11',
          code: "g = pd.DataFrame({'k': ['x', 'y', 'x'], 'v': [1, 2, 3]})\nprint(g.groupby('k')['v'].sum())",
          q: '결과 <b>인덱스의 이름</b>은 무엇인가?',
          ph: '이름 하나',
          ans: ['k'],
          hint: '묶은 기준이 컬럼에 남지 않고 어디로 갔는지 11장에서 보자.',
          explain: '묶은 기준 컬럼이 <b>인덱스가 된다.</b> 그래서 결과에서 <code>g[\'k\']</code> 로는 못 꺼낸다. ' +
                   '컬럼으로 두고 싶으면 <code>groupby(\'k\', as_index=False)</code> 를 쓴다.'
        },
        {
          id: '5-5', ch: '12',
          code: "L = pd.DataFrame({'k': [1, 2, 3], 'l': list('abc')})\nR = pd.DataFrame({'k': [2, 3, 4], 'r': list('XYZ')})\nprint(len(L.merge(R, on='k', how='inner')))",
          q: '<code>how=\'inner\'</code> 로 합치면 몇 행인가?',
          ph: '개수',
          ans: ['2'],
          hint: '양쪽에 <b>모두 있는</b> 키만 남는다. 어떤 키가 그런가?',
          explain: '양쪽에 다 있는 키는 <code>2, 3</code> 뿐이라 2행이다. ' +
                   '<code>inner</code> 는 기본값이라, 아무 생각 없이 합치면 <b>행이 조용히 줄어든다.</b>'
        },
        {
          id: '5-6', ch: '12',
          q: '같은 두 표를 <code>how=\'outer\'</code> 로 합치면 몇 행인가?',
          ph: '개수',
          ans: ['4'],
          hint: '양쪽 키의 합집합이다. 1, 2, 3, 4 중 몇 개가 남나?',
          explain: '합집합 <code>1, 2, 3, 4</code> 라 4행이다. 짝이 없는 자리는 <code>NaN</code> 으로 채워진다. ' +
                   '같은 두 표인데 <code>how</code> 하나로 2행이 되기도 4행이 되기도 한다.'
        },
        {
          id: '5-7', ch: '12',
          code: "L = pd.DataFrame({'k': [1, 1], 'l': ['a', 'b']})\nR = pd.DataFrame({'k': [1, 1, 1], 'r': ['X', 'Y', 'Z']})\nprint(len(L.merge(R, on='k')))",
          q: '키 <code>1</code> 이 왼쪽에 2개, 오른쪽에 3개다. 합친 결과는 몇 행인가?',
          ph: '개수',
          ans: ['6'],
          hint: '4단계의 중복 라벨과 같은 계산이다.',
          explain: '<code>2 × 3 = 6</code> 행이다. 키가 중복이면 merge 도 <b>곱집합</b>을 만든다. ' +
                   '합쳤더니 행이 늘어나 있으면 먼저 <code>df[\'k\'].duplicated().sum()</code> 을 확인하자.'
        },
        {
          kind: 'memo', id: '5-8',
          q: '표를 합치고 나서 <b>가장 먼저 확인해야 할 것</b>은 무엇이라고 생각하나? ' +
             '위 5-5 ~ 5-7 에서 본 것을 근거로 한 문장으로 적어 보자.'
        }
      ]
    }
  ];

  /* 마지막에 몰아서 받는 서술형. 판정하지 않는다. */
  var MEMO_LAST = [
    { id: 'z-1', q: '오늘 <b>가장 뜻밖이었던 것</b> 하나를 골라 적어 보자. 왜 뜻밖이었는지도 함께.' },
    { id: 'z-2', q: '다음에 표를 잘라서 고칠 일이 생기면 <b>무엇을 먼저 확인</b>하겠는가?' },
    { id: 'z-3', q: '오늘 배운 것을 아직 안 배운 친구에게 <b>한 문장으로</b> 설명한다면?' },
    { id: 'z-4', q: '아직도 <b>잘 모르겠는 것</b>이 있다면 적어 두자. 다음 시간에 이것부터 본다.' }
  ];

  // ─────────────────────────────────────────────── 집계

  function isAsk(it) { return !it.kind || it.kind === 'ask'; }

  function stageItems(s) { return s.items.filter(isAsk); }

  /* 정답이 있는 문항만 모은 목록 — 진도의 분모다 */
  var ALL = (function () {
    var out = [];
    STAGES.forEach(function (s) { stageItems(s).forEach(function (it) { out.push(it); }); });
    return out;
  })();

  var MEMOS = (function () {
    var out = [];
    STAGES.forEach(function (s) {
      s.items.forEach(function (it) { if (it.kind === 'memo') out.push(it); });
    });
    return out.concat(MEMO_LAST);
  })();

  function solvedCount() {
    var n = 0;
    ALL.forEach(function (it) { if (solved(it.id)) n++; });
    return n;
  }
  function memoCount() {
    var n = 0;
    MEMOS.forEach(function (m) { if (memoOf(m.id)) n++; });
    return n;
  }
  function stageDone(s) {
    return stageItems(s).every(function (it) { return solved(it.id); });
  }

  /* 진도 키를 미리 깔아 둔다 — 그래야 사이드바 점이 "25개 중 몇 개" 로 센다.
   *
   * ★ 없어진 문항의 키는 지운다. 문항을 하나 빼고 나면 예전에 깔아 둔 키가 남아
   *   UI.progress.stats('quest') 의 분모가 25 대신 26 으로 잡힌다. 화면은 25 라고
   *   말하는데 사이드바 점은 26 을 세는 상태가 되고, 그러면 점이 영원히 초록이 안 된다.
   *   여기서 스스로 고치므로 문항을 빼도 학생 쪽에서 저절로 맞춰진다. */
  function seed() {
    var d = P.load(), touched = false;

    var askIds = {}, memoIds = {};
    ALL.forEach(function (it) { askIds[it.id] = true; });
    MEMOS.forEach(function (m) { memoIds[m.id] = true; });

    ALL.forEach(function (it) {
      if (!(('quest:q' + it.id) in d)) { d['quest:q' + it.id] = false; touched = true; }
    });

    /* prefix 뒤가 문항 번호인 키들. 모르는 번호면 없어진 문항의 흔적이다. */
    [['quest:q', askIds], ['quest:try:', askIds], ['quest:first:', askIds],
     ['quest:pre:', askIds], ['quest:memo:', memoIds]].forEach(function (pair) {
      var prefix = pair[0], valid = pair[1];
      Object.keys(d).forEach(function (k) {
        if (k.indexOf(prefix) !== 0) return;
        if (!valid[k.slice(prefix.length)]) { delete d[k]; touched = true; }
      });
    });

    if (touched) P.save(d);
  }

  // ─────────────────────────────────────────────── 화면 조각

  /* 장은 과제 창이 아니라 옆 창에서 연다. 이름을 고정했으므로 몇 번을 눌러도
   * 창이 하나만 뜨고, 그 창만 갈아탄다. 과제 창은 스크롤 위치까지 그대로 남는다. */
  var LAB_WIN = 'pandas-lab-chapter';

  /** 코드 블록. 붙여넣기만으로 돌게 import 를 앞에 붙여 복사한다. */
  function py(src) {
    return UI.code(src, { copyText: 'import pandas as pd\nimport numpy as np\n\n' + src });
  }

  /**
   * 장을 연다. 되도록 옆 창에서 열어 과제 창을 건드리지 않는다.
   * ★ 새 창이 막히는 환경(팝업 차단·키오스크)에서는 window.open 이 null 을 돌려주면서
   *   현재 탭을 그냥 이동시키기도 한다. 그래서 **열기 전에 보던 자리를 적어 두고**,
   *   장 화면 맨 위의 "과제로 돌아가기" 줄로 되돌아올 수 있게 한다.
   */
  function openChapter(id) {
    put('quest:return', { y: window.scrollY || 0, t: Date.now(), to: 'quest' });

    var url = location.href.split('#')[0] + '#/' + id;
    var w = null;
    try { w = window.open(url, LAB_WIN); } catch (e) { w = null; }

    if (w) {
      try {
        if (w.location && w.location.hash !== '#/' + id) w.location.hash = '#/' + id;
        w.focus();
      } catch (e) { /* 손댈 수 없어도 창은 떴다 */ }
      return true;
    }
    /* 새 창을 못 열었다 — 이 창에서 연다. 돌아가는 줄이 대신 받아 준다. */
    location.hash = '#/' + id;
    return false;
  }

  function chapterButton(ch) {
    var L = LINKS[ch];
    if (!L) return null;
    return UI.btn(ch + '장 열기 — ' + L.t, function () { openChapter(L.id); });
  }

  /** 문항 하나 */
  function askCard(it, onSolve) {
    var box = el('div.q');
    box.appendChild(el('div.q-stem', {
      html: '<span class="q-no">' + UI.esc(it.id) + '</span> ' + it.q
    }));
    if (it.code) box.appendChild(py(it.code));

    var verdict = el('span.q-verdict');
    var explain = el('div.q-explain', { hidden: true, html: it.explain || '' });

    var value = '';
    var input = UI.textInput({
      value: '', placeholder: it.ph || '답',
      onChange: function (v) { value = v; },
      onEnter: function () { check(); }
    });

    function paint(state, msg) {
      verdict.setAttribute('data-state', state);
      verdict.textContent = msg;
    }

    /** 힌트는 모달로 띄운다 — 본문을 가리지 않고, Esc 로 닫힌다. */
    function openHint() {
      var body = [el('p', { html: it.hint || '이 문항에는 힌트가 없다. 화면을 다시 열어 보자.' })];
      var L = LINKS[it.ch];
      if (tries(it.id) >= 3 && L) {
        body.push(el('p', { html: '<b>' + it.ch + '장</b> 화면을 다시 열어서 눈으로 확인하고 오자.' }));
      }
      if (L) {
        body.push(el('p', null, [
          UI.btn(it.ch + '장 열기 — ' + L.t, function () {
            dlg.closeModal();
            openChapter(L.id);
          }, { primary: true })
        ]));
      }
      var dlg = UI.modal({ title: '힌트 · ' + it.id, body: body });
    }

    function check() {
      if (!norm(value)) { paint('', '아직 답을 안 적었다.'); return; }
      var n = bumpTries(it.id);
      if (matches(value, it.ans)) {
        var already = solved(it.id);
        if (!already && n === 1) put('quest:first:' + it.id, true);
        markSolved(it.id, true);
        paint('right', '맞았다.' + (firstTry(it.id) ? '  (한 번에!)' : ''));
        if (it.explain) explain.hidden = false;

        /* 예측을 뒤집었으면 그 자리에서 보여 준다 — 이 과제가 노리는 순간이다 */
        var pre = prediction(it.id);
        if (pre && !matches(pre, it.ans)) {
          explain.hidden = false;
          if (!explain.querySelector('.q-flip')) {
            explain.appendChild(el('p.q-flip', {
              html: '처음에는 <b>' + UI.esc(pre) + '</b> 라고 생각했다. 그게 오늘의 수확이다.'
            }));
          }
        }
        onSolve();
      } else {
        paint('wrong', '아직 아니다. (' + n + '번째 시도)' + (it.hint ? '  「힌트」를 눌러 보자.' : ''));
      }
    }

    box.appendChild(el('div.q-answer', null, [input, UI.btn('확인', check, { primary: true }), verdict]));

    var meta = el('div.q-meta');
    var chBtn = chapterButton(it.ch);
    if (chBtn) meta.appendChild(chBtn);
    if (it.hint) meta.appendChild(UI.btn('힌트', openHint));
    box.appendChild(meta);
    box.appendChild(explain);

    /* 이미 푼 문항은 다시 열었을 때 그대로 보여 준다 */
    if (solved(it.id)) {
      paint('right', '지난번에 해결했다.' + (firstTry(it.id) ? '  (한 번에!)' : ''));
      if (it.explain) explain.hidden = false;
    }
    return box;
  }

  /** 서술형 메모 — 판정하지 않는다. 적었는지만 센다. */
  function memoCard(m, onSave) {
    var box = el('div.q');
    box.appendChild(el('div.q-stem', { html: '<span class="q-no memo">메모</span> ' + m.q }));

    var ta = el('textarea', { placeholder: '자기 말로 한 문장이라도 적어 보자' });
    ta.value = memoOf(m.id);
    var said = el('span.q-verdict');
    if (ta.value) { said.setAttribute('data-state', 'right'); said.textContent = '적어 두었다.'; }

    box.appendChild(el('div.q-note', null, [ta]));
    box.appendChild(el('div.q-answer', null, [
      UI.btn('적어 두기', function () {
        var t = ta.value.trim();
        if (t.length < 5) {
          said.setAttribute('data-state', 'wrong');
          said.textContent = '한 문장이라도 좋으니 자기 말로 적어 보자.';
          return;
        }
        put('quest:memo:' + m.id, t);
        said.setAttribute('data-state', 'right');
        said.textContent = '적어 두었다. (지금까지 ' + memoCount() + '개)';
        onSave();
      }), said
    ]));
    return box;
  }

  /** 예측 다섯 개 — 확인하기 전에 생각을 먼저 적는다 */
  function predictCard(block, onSave) {
    var card = el('div.card');
    card.appendChild(el('div.panel-title', { text: block.title }));
    card.appendChild(el('p', { html: block.note }));
    if (block.code) card.appendChild(py(block.code));

    var list = el('div.quiz');
    block.targets.forEach(function (t) {
      var val = prediction(t.id);
      var v = val;
      var said = el('span.q-verdict');
      if (val) { said.setAttribute('data-state', 'right'); said.textContent = '적어 두었다: ' + val; }

      function save() {
        var txt = String(v == null ? '' : v).trim();
        if (!txt) return;
        put('quest:pre:' + t.id, txt);
        said.setAttribute('data-state', 'right');
        said.textContent = '적어 두었다: ' + txt;
        onSave();
      }
      var inp = UI.textInput({
        value: val, placeholder: '내 생각',
        onChange: function (x) { v = x; }, onEnter: save
      });

      list.appendChild(el('div.q', null, [
        el('div.q-stem', { html: '<span class="q-no">' + UI.esc(t.id) + '</span> ' + t.q }),
        el('div.q-answer', null, [inp, UI.btn('적어 두기', save), said])
      ]));
    });
    card.appendChild(list);
    return card;
  }

  // ─────────────────────────────────────────────── 화면

  /** 이름을 받는 첫 화면. 공용 PC 에서 기록이 섞이지 않게 하는 장치다. */
  function renderGate(root) {
    root.appendChild(el('p.lede', {
      html: '이 과제는 <b>답·예측·메모가 이 컴퓨터에 저장된다.</b> 실습실처럼 여러 사람이 쓰는 ' +
            '컴퓨터라면 누구 것인지 구분해야 하므로, 시작하기 전에 이름을 넣어 두자.'
    }));

    var v = '';
    var msg = el('span.q-verdict');

    function start(name) {
      if (!String(name || '').trim()) {
        msg.setAttribute('data-state', 'wrong');
        msg.textContent = '이름을 넣어야 시작할 수 있다.';
        return;
      }
      switchTo(name);
      location.reload();
    }

    var input = UI.textInput({
      label: '이름', value: '', placeholder: '예: 김민준',
      onChange: function (x) { v = x; }, onEnter: function () { start(v); }
    });

    var card = el('div.card');
    card.appendChild(el('div.panel-title', { text: '누가 하는지 알려 주자' }));
    card.appendChild(el('p', {
      text: '이름은 이 컴퓨터 안에만 저장된다. 어디로도 전송되지 않고 선생님도 볼 수 없다. ' +
            '비밀번호는 없으니 점수와 상관없는 이름이라고 생각하면 된다.'
    }));
    card.appendChild(el('div.q-answer', null, [
      input, UI.btn('시작하기', function () { start(v); }, { primary: true }), msg
    ]));

    var names = boxNames();
    if (names.length) {
      card.appendChild(el('p.small.muted', { text: '전에 하던 것이 있으면 이어서 할 수 있다.' }));
      card.appendChild(UI.chips(names, function (nm) { start(nm); }));
    }
    root.appendChild(card);
  }

  function render(root) {
    root.classList.add('quest');       // .q-stem 의 "Q1." 카운터를 끈다
    if (!whoNow()) { renderGate(root); return; }
    seed();

    /* 장을 보고 돌아왔으면 보던 자리로 되돌려 놓는다 */
    var back = get('quest:return', null);
    if (back && typeof back.y === 'number') {
      var d0 = P.load(); delete d0['quest:return']; P.save(d0);
      setTimeout(function () { window.scrollTo(0, back.y); }, 0);
    }

    root.appendChild(el('div.quest-who', null, [
      el('span.badge.on', { text: '✎ ' + whoNow() }),
      el('span.who-note', { text: '이 이름으로 기록된다.' }),
      UI.btn('사람 바꾸기', function () {
        if (!confirm(whoNow() + ' 의 기록을 그대로 보관하고 처음 화면으로 돌아간다.\n' +
                     '지우는 것이 아니므로 이름을 다시 넣으면 이어서 할 수 있다.\n계속하겠는가?')) return;
        var d = P.load();
        var box = {};
        activeKeys(d).forEach(function (k) { box[k] = d[k]; delete d[k]; });
        d[BOX + d[WHO]] = box;
        delete d[WHO];
        P.save(d);
        location.reload();
      })
    ]));

    var progText = el('span');
    var progFill = el('i');
    root.appendChild(el('div.quest-prog', null, [
      progText, el('span.bar', null, [progFill])
    ]));

    var badgeRow = el('div.badge-row');
    root.appendChild(badgeRow);

    root.appendChild(UI.note(
      '① 문제를 보면 <b>화면을 열기 전에</b> 예측을 먼저 적는다. ' +
      '② 문항 아래 <b>장 열기</b> 를 누른다 — <b>옆 창</b>에서 열리므로 이 과제 창은 그대로 남는다. ' +
      '③ 확인했으면 이 창으로 돌아와 답을 넣는다. 옆 창이 안 열리는 컴퓨터라면 장 화면 맨 위의 ' +
      '<b>과제로 돌아가기</b> 를 누르면 보던 자리로 돌아온다.<br>' +
      '틀려도 감점은 없다. 맞을 때까지 몇 번이든 다시 해도 된다 — 오히려 틀리라고 만든 문제다. ' +
      '<b>예측이 틀렸다가 직접 뒤집은 문항이 오늘 진짜로 배운 것</b>이고, 맨 아래에서 그 목록을 보여 준다.',
      '과제 하는 법', { html: true, kind: 'tip' }));

    root.appendChild(UI.note(
      '문항은 모두 <b>' + ALL.length + '개</b>, 서술형 메모가 <b>' + MEMOS.length + '개</b>다. ' +
      '다섯 단계를 다 하면 배지 다섯 개를 모을 수 있다. ' +
      '중심은 <b>5장 · 6장 · 7장</b>이고 8장 · 9장 · 11장 · 12장은 한 문항씩만 본다. ' +
      '답은 전부 실제 pandas 3.0.5 로 돌려 확인한 값이다.',
      '오늘 열어 볼 곳', { html: true, kind: 'why' }));

    var certBox = el('div');

    function refresh() {
      var done = solvedCount(), total = ALL.length;
      progText.textContent = '진도 ' + done + ' / ' + total + '문항 · 메모 ' +
        memoCount() + ' / ' + MEMOS.length + '개';
      progFill.style.width = (total ? (done / total * 100) : 0).toFixed(0) + '%';

      UI.clear(badgeRow);
      STAGES.forEach(function (s) {
        var on = stageDone(s);
        badgeRow.appendChild(el('span', {
          class: 'badge' + (on ? ' on' : ''),
          text: (on ? '✓ ' : '· ') + s.badge
        }));
      });
      drawCert();
    }

    STAGES.forEach(function (s) {
      root.appendChild(el('h2.h-sec', { text: s.n + ' — ' + s.title }));
      if (s.intro) root.appendChild(el('p', { html: s.intro }));

      /* 이 단계에서 쓰는 표를 엔진으로 그려 준다. 숫자를 적어 두지 않는다. */
      if (s.base) {
        var base = DF.frame({ a: [1, 2, 3, 4], b: [10, 20, 30, 40] });
        var card = el('div.card');
        card.appendChild(el('div.panel-title', { text: '이 단계에서 쓰는 표' }));
        card.appendChild(py(BASE_SRC));
        card.appendChild(UI.frameTable(base, { frame: 'original' }));
        card.appendChild(el('p.small.muted', { text: '원본 (파란 테두리)' }));
        root.appendChild(card);
      }

      var quizBox = el('div.card.quiz');
      s.items.forEach(function (it) {
        if (it.kind === 'predict') {
          if (quizBox.childNodes.length) root.appendChild(quizBox);
          quizBox = el('div.card.quiz');
          root.appendChild(predictCard(it, refresh));
          return;
        }
        if (it.kind === 'memo') { quizBox.appendChild(memoCard(it, refresh)); return; }
        quizBox.appendChild(askCard(it, refresh));
      });
      if (quizBox.childNodes.length) root.appendChild(quizBox);
    });

    root.appendChild(el('h2.h-sec', { text: '오늘 정리하기' }));
    var lastBox = el('div.card.quiz');
    MEMO_LAST.forEach(function (m) { lastBox.appendChild(memoCard(m, refresh)); });
    root.appendChild(lastBox);

    root.appendChild(el('h2.h-sec', { text: '완주 확인서' }));
    root.appendChild(certBox);

    function drawCert() {
      UI.clear(certBox);

      var done = solvedCount(), total = ALL.length;
      var once = 0;
      ALL.forEach(function (it) { if (solved(it.id) && firstTry(it.id)) once++; });

      var name = whoNow();
      var badges = STAGES.filter(stageDone).map(function (s) { return s.badge; });

      var card = el('div.card');
      card.appendChild(el('div.panel-title', { text: 'Pandas Lab 스스로 하기 확인서' }));
      card.appendChild(el('p.cert-name', { text: name }));
      card.appendChild(UI.statRow([
        { k: '해결한 문항', v: done + ' / ' + total },
        { k: '한 번에 맞힌 것', v: once + '개' },
        { k: '적어 둔 생각', v: memoCount() + '개' }
      ]));
      card.appendChild(el('p', {
        html: badges.length
          ? '모은 배지 — <b>' + badges.join(' · ') + '</b>'
          : '아직 배지가 없다. 1단계부터 가 보자.'
      }));

      if (done === total) {
        card.appendChild(UI.note(
          '<b>전부 해냈다.</b> 14장 종합 실습으로 가서 오늘 확인한 것들을 지진 데이터에 한꺼번에 써 보자. ' +
          '거기서도 결측·dtype·인덱스가 그대로 문제가 된다.',
          '완주', { html: true, kind: 'tip' }));
      }

      /* 예측을 뒤집은 문항 — 이 과제가 노리는 진짜 성과다 */
      var flipped = ALL.filter(function (it) {
        var pre = prediction(it.id);
        return solved(it.id) && pre && !matches(pre, it.ans);
      });
      if (flipped.length) {
        card.appendChild(el('h3', { text: '오늘 생각이 바뀐 문항' }));
        card.appendChild(UI.table(
          [{ key: 'no', label: '문항' }, { key: 'pre', label: '처음 생각' }, { key: 'now', label: '실제' }],
          flipped.map(function (it) {
            return { no: it.id, pre: prediction(it.id), now: it.ans[0] };
          })
        ));
        card.appendChild(el('p.small.muted', {
          text: '틀린 예측을 직접 뒤집은 것이다. 이것이 오늘 배운 것의 목록이다.'
        }));
      }
      certBox.appendChild(card);

      certBox.appendChild(el('div.q-answer', null, [
        UI.btn(name + ' 의 과제 기록 지우기', function () {
          if (!confirm(name + ' 의 답·예측·메모를 모두 지운다.\n' +
                       '다른 사람 기록과 장별 확인 문제 진도는 그대로 둔다.\n계속하겠는가?')) return;
          var data = P.load();
          activeKeys(data).forEach(function (k) { delete data[k]; });
          delete data[BOX + name];
          P.save(data);
          location.reload();
        })
      ]));
    }

    refresh();
  }

  Lab.register({
    id: 'quest',
    extra: true,
    navTitle: '과제',
    title: '스스로 하기 — pandas 를 직접 확인하기',
    subtitle: '예측하고, 화면에서 확인하고, 답을 넣는다. 25문항 · 5단계 · 배지 5개. ' +
              '기록은 이름별로 이 컴퓨터에 남는다.',
    sim: '자유 입력 판정 · 예측 뒤집기 추적 · 힌트 모달 · 완주 확인서',
    render: render
  });
})();
