# API.md — 화면 모듈 작성 계약

**화면 모듈을 쓰기 전에 이 문서를 끝까지 읽어라.** 여기 없는 API 는 없다고 생각해라.
자기 표·차트를 새로 만들면 장마다 모양이 달라지고, 병렬로 쓴 11개 화면이 하나의 앱으로 안 보인다.

---

## 0. 30초 요약

```js
/* webapp/src/modules/ch07-copy.js */
(function () {
  'use strict';

  Lab.register({
    id: 'ch07-copy',                     // 파일명과 같게. URL 해시가 된다
    num: 7,                              // 교재 장 번호와 반드시 일치
    title: '뷰와 복사, Copy-on-Write',
    subtitle: '한 줄 요약',

    render: function (root) {             // ★ 여러 번 호출된다. 아래 §2 를 읽어라
      var df = LabData.frame('titanic');
      root.appendChild(UI.frameTable(df, { maxRows: 5 }));
    }
  });
})();
```

- 파일 하나 = 장 하나. 파일명은 `chNN-슬러그.js`. **파일명 사전순이 표시 순서다.**
- ES 모듈 문법(`import`/`export`) **금지.** 단일 파일 배포본에 인라인되므로 깨진다. IIFE 로 감싼다.
- 전역은 `DF`, `UI`, `Lab`, `LabData` 네 개뿐이다. 새 전역을 만들지 마라.

---

## 1. 절대 규칙

### ① 화면의 숫자를 하드코딩하지 않는다

이 프로젝트의 존재 이유다. `DF` 엔진으로 그 자리에서 계산해서 보여준다.
슬라이더를 움직이면 진짜 값이 따라와야 한다.

```js
// ✗ 하드코딩
root.appendChild(UI.note('1등급 평균 나이는 38.23세다'));

// ✓ 계산
var m = df.groupby('Pclass').aggCol('Age', 'mean');
root.appendChild(UI.note('1등급 평균 나이는 ' + UI.fmt(m.at(0), 2) + '세다'));
```

### ② `render(root)` 는 여러 번 호출된다

장을 다시 방문하면 다시 불린다. **모듈 전역에 가변 상태를 두면 두 번째 방문에서 깨진다.**
`render` 안의 지역 변수 + `rebuild()` 패턴을 쓴다.

```js
// ✗ 모듈 전역에 상태
var count = 0;
render: function (root) { count++; /* 재방문하면 값이 남아 있다 */ }

// ✓ render 안의 지역 변수
render: function (root) {
  var count = 0;                        // 매번 새로 시작한다
  var body = UI.el('div');
  function rebuild() {
    UI.clear(body);
    body.appendChild(UI.note('count = ' + count));
  }
  root.appendChild(UI.slider({ label: 'count', min: 0, max: 10, value: 0,
    onChange: function (v) { count = v; rebuild(); } }));
  root.appendChild(body);
  rebuild();
}
```

`root` 는 셸이 매번 비워서 준다. `root` 밖(document.body 등)에 붙인 것은 남으므로 붙이지 마라.

### ③ 색은 정해져 있다

| 역할 | CSS 변수 | 언제 |
|:---|:---|:---|
| 원본 | `var(--c-original)` | 원래 DataFrame, 원본 블록 |
| 사본 | `var(--c-copy)` | 복사된 것, 파생 프레임 |
| 결과 | `var(--c-result)` | 연산 결과 |
| 에러/경고 | `var(--c-danger)` | **`UI.danger()` 로만.** 계열색으로 재사용 금지 |
| 결측 | `var(--c-na)` | NaN. `UI.table` 이 자동으로 입힌다 |

- **강조는 색이 아니다.** `is-focus` 클래스(2px 링 + 굵은 글씨)를 쓴다. **노랑을 쓰지 마라** —
  주황과 구분되지 않아 색약 검증에서 FAIL 이 난다(`../CLAUDE.md` §7-1).
- **계열이 4개 이상 필요하면 색을 추가하지 말고** "그 외" 로 묶거나 차트를 나눈다.
- **값·라벨 텍스트에 계열색을 입히지 마라.** 잉크 토큰(`--ink-1`, `--ink-2`)만 쓴다.
- 색 옆에는 항상 글자가 온다. 색 단독으로 의미를 전달하지 않는다.

### ④ 완료 조건 — 보고하기 전에 직접 확인한다

```bash
node --check webapp/src/modules/chNN-이름.js
```

```bash
npm run build
```

둘 다 통과해야 한다. `node --check` 는 문법만 본다 — **통과해도 브라우저에서 죽을 수 있다.**
`Lab.register` 의 오타, 없는 API 호출은 여기서 안 잡힌다. §7 의 자체 점검을 함께 하라.

---

## 2. `Lab` — 셸

| 호출 | 의미 |
|:---|:---|
| `Lab.register({id, num, title, subtitle, render})` | 자기를 등록한다. **로드 시점에 즉시 부른다** |
| `Lab.go(id)` | 다른 장으로 이동 |
| `Lab.chapters()` | 등록된 장 목록 |

`register` 는 `id` 와 `render` 가 필수다. 같은 `id` 를 두 번 등록하면 두 번째는 무시되고 경고가 난다.

> **★ 로드 순서**: `df → ui → data → app → modules → boot`.
> `app.js` 가 `window.Lab` 을 정의한다. 모듈이 먼저 로드되면 **조용히 `Lab is not defined` 로 죽어
> 장이 하나도 등록되지 않는다.** `build.js` 가 순서를 보장하므로 `index.html` 을 손으로 고치지 마라.

---

## 3. `LabData` — 실습 데이터

| 호출 | 반환 |
|:---|:---|
| `LabData.frame('titanic')` | `DF.DataFrame` (dtype 선언까지 적용된 것) |
| `LabData.records('titanic')` | 레코드 배열 |
| `LabData.sets` | 메타데이터 (`label`, `synthetic`, `rows`, `columns`, `dtypes`) |

데이터 이름: **`titanic`** (891×12), **`ramen`** (2580×7), **`abalone`** (4177×8), **`earthquake`** (467×8)

- `titanic` / `ramen` / `abalone` 은 **합성 데이터**다(저작권). 구조·결측 개수·dtype 은 원본과 같지만
  개별 값은 다르다. 셸이 화면 맨 위에 그 사실을 알린다.
- `earthquake` 는 **USGS 실데이터**다(퍼블릭 도메인). 실제 값을 그대로 쓴다.
- **`LabData.frame()` 을 `render` 안에서 부른다.** 모듈 로드 시점에 부르면 `data.js` 가 아직
  준비되지 않았을 수 있다(순서상 준비되지만, 재방문마다 깨끗한 프레임을 받는 게 낫다).

교재가 가르치는 값은 합성 데이터에서도 그대로 성립한다:
`Age` 결측 177, `Cabin` 687, `Embarked` 2, `ramen.Style` 결측 2, `mag > 6` 인 지진 10건.

---

## 4. `DF` — 미니 DataFrame 엔진

### 4.1 만들기

```js
DF.frame({ a: [1,2,3], b: ['x','y','z'] })            // 컬럼 객체로
DF.frame({ a: [1,2] }, { columns: ['a','연봉'] })      // 없는 이름은 NaN 컬럼이 된다
DF.frame({ a: [1,2] }, { index: ['p','q'] })
DF.fromRecords([{a:1,b:2}, {a:3}])                     // 없는 키는 NaN
DF.series([1,2,3], { index: ['a','b','c'], name: 'v' })
DF.series([1,2], { dtype: 'float64' })                 // ★ JS 는 1 과 1.0 을 구분 못 한다
DF.index(['a','b','a'], '이름')
DF.range(5)                                            // RangeIndex
```

### 4.2 DataFrame

| 호출 | 반환 | 메모 |
|:---|:---|:---|
| `df.shape` | `[행, 열]` | 속성이다(괄호 없음) |
| `df.columns` | 이름 배열 | |
| `df.index` | `Index` | |
| `df.dtypes()` | `{컬럼: dtype}` | |
| `df.col(name)` | `Series` | **블록을 공유한다** |
| `df.cols([names])` | `DataFrame` | 블록 공유 |
| `df.setCol(name, 값)` | `this` | 배열 / Series(인덱스로 재배치) / 스칼라 |
| `df.setLoc(행선택, 컬럼, 값)` | `this` | **`.loc[조건, 컬럼] = 값` 에 해당. 여기서 CoW 가 일어난다** |
| `df.head(n)` / `df.tail(n)` | `DataFrame` | 슬라이스 → **블록 공유** |
| `df.islice(start, stop, step)` | `DataFrame` | 슬라이스 → **블록 공유** |
| `df.take(sel)` / `df.mask(sel)` | `DataFrame` | 불린 배열·Series·정수 배열 → **복사** |
| `df.iloc(행, 열)` | | 위치 기준. §4.5 |
| `df.loc(행, 열)` | | 라벨 기준. §4.5 |
| `df.copy()` | `DataFrame` | 완전 복사 |
| `df.drop(labels, {axis, inplace})` | `DataFrame` 또는 `null` | `inplace` 면 `null` 반환 |
| `df.rename({old: new})` | `DataFrame` | |
| `df.T` / `df.transpose()` | `DataFrame` | 행↔열. **dtype 이 섞이면 결과는 `object`** (교재 4장) |
| `df.resetIndex({drop})` | `DataFrame` | 인덱스를 컬럼으로 |
| `df.setIndex(name)` | `DataFrame` | |
| `df.isna()` | `DataFrame` | 불린 |
| `df.sum()` / `df.count()` / `df.mean()` | `Series` | 컬럼별. `sum()` 은 불린을 센다 |
| `df.fillna(값 또는 {컬럼:값})` | `DataFrame` | |
| `df.dropna({subset})` | `DataFrame` | |
| `df.sortValues(by, {ascending})` | `DataFrame` | 결측은 맨 뒤 |
| `df.describe({include})` | `DataFrame` | `include:'all'` 이면 문자열 컬럼도 |
| `df.info()` | 객체 | `{indexDesc, columns:[{pos,name,nonNull,dtype}], dtypeCounts}` |
| `df.groupby(keys)` | `GroupBy` | §4.6 |
| `df.merge(other, {on, how})` | `DataFrame` | `how`: inner/left/right/outer |
| `DF.concat([df1, df2], {ignoreIndex})` | `DataFrame` | 세로로 이어붙임 |
| `df.records()` | 레코드 배열 | |
| `df.blockInfo()` | 배열 | **CoW 시각화용.** §4.7 |
| `df.declareDtypes({컬럼: dtype})` | `this` | |
| `df.toString(maxRows)` | 문자열 | pandas 스타일 표 |

### 4.3 Series

| 호출 | 메모 |
|:---|:---|
| `s.length()` / `s.at(i)` / `s.toArray()` / `s.labels()` | |
| `s.dtype` | 속성. `int64` / `float64` / `str` / `bool` / `object` |
| `s.iloc(sel)` | 정수 / `{slice:true, start, stop, step}`(공유) / 배열(복사) |
| `s.loc(sel)` | 라벨. 중복이면 Series 를 준다 |
| `s.setLoc(label, v)` / `s.setILoc(i, v)` | **여기서 CoW 가 일어난다** |
| `s.head(n)` / `s.tail(n)` | |
| `s.isna()` / `s.notna()` / `s.fillna(v)` / `s.dropna()` | |
| `s.replace({from: to})` / `s.replace(from, to)` | dtype 승격 규칙을 따른다 |
| `s.astype(dt)` / `s.toNumeric('coerce')` | |
| `s.map(fn)` / `s.apply(fn)` | |
| `s.count()` `sum()` `mean()` `std(ddof)` `min()` `max()` `median()` `quantile(q)` | **`std` 기본 `ddof=1`** |
| `s.unique()` / `s.nunique()` | |
| `s.valueCounts({dropna})` | 결과 `name` 은 `'count'`, 인덱스 이름은 원래 컬럼명 |
| `s.sortValues({ascending})` | |
| `s.describe()` | |
| `s.add/sub/mul/div(other, {fillValue})` | **인덱스로 짝짓는다.** §4.4 |
| `s.gt/ge/lt/le/eq/ne(other)` | 불린 Series |
| `s.and(o)` / `s.or(o)` / `s.not()` | 마스크 조합 |

**주의**: `dtype` 이 `object` 인데 문자열이 섞여 있으면 `sum/mean/std` 가 **예외를 던진다.**
버그가 아니라 pandas 를 재현한 것이다(교재 8장 `fillna('0')` 사례). `try/catch` 로 잡아 보여줘라.

### 4.4 정렬(alignment) — 6장의 핵심

`DF.alignIndexes(leftIndex, rightIndex)` → `{ pairs: [[왼쪽위치, 오른쪽위치, 라벨], …], labels, name }`
위치가 `-1` 이면 그 쪽에 라벨이 없다(결과는 NaN).

검증된 규칙(실제 pandas 3.0.5 확인):

1. **인덱스가 완전히 동일하면 정렬하지 않는다.** 위치로 짝짓고 인덱스를 그대로 둔다.
2. 다르면 **합집합을 정렬**한다.
3. **중복 라벨은 곱집합. 왼쪽이 바깥 루프, 오른쪽이 안쪽 루프.**
   `['a','a'](1,2) + ['a','a','a'](10,20,30)` → 6행 `11,21,31,12,22,32`

`UI.alignView(left, right, result)` 가 이걸 표로 그려 준다. 직접 그리지 마라.

### 4.5 `iloc` / `loc` 선택자 표기

JS 에는 파이썬의 `df.iloc[1:3, 0]` 문법이 없다. 객체로 표현한다.

```js
df.iloc(2)                                   // 위치 2 인 행 (1행 DataFrame)
df.iloc({ slice: true, start: 0, stop: 5 })  // 위치 슬라이스. 끝 제외. 블록 공유
df.iloc([0, 2, 4])                           // 정수 배열. 복사
df.iloc(null, 0)                             // 첫 열
df.iloc(null, [0, 1])                        // 0, 1 열
df.iloc(null, 'Name')                        // ✗ ValueError (pandas 와 같다)

df.loc(2)                                    // 라벨이 2 인 행
df.loc({ range: true, from: 56, to: 1 })     // 라벨 슬라이스. ★ 끝을 포함한다
df.loc([55, 1])                              // 라벨 배열
df.loc(mask)                                 // 불린 Series 또는 배열
df.loc(null, 'Name')                         // 컬럼 하나 → Series
df.loc(null, { range: true, from: 'Name', to: 'Age' })   // 컬럼 라벨 슬라이스. 끝 포함
df.loc(mask, 'Age')                          // 조건 + 컬럼
```

### 4.6 `GroupBy`

```js
var g = df.groupby('Pclass');            // 또는 ['Pclass','Sex']
g.groups()      // [{key:[…], rows:[행위치…]}, …]  ← split 을 눈에 보이게
g.size()        // Series
g.aggCol('Age', 'mean')                  // Series
g.agg({ Age: 'max', Fare: 'mean' })      // DataFrame
```

집계 이름: `mean sum min max std median count nunique first`, 또는 `function (series) {…}`.
**NaN 키를 가진 행은 그룹에서 빠진다**(pandas 기본).

### 4.7 Copy-on-Write 관찰 — 7장의 핵심

```js
DF.sharesMemory(a, b)     // Series 또는 ColRef 두 개가 같은 블록을 보는가
df.blockInfo()            // [{column, blockId, refs, isView, blockLength, viewLength}, …]
```

**재현해야 하는 비대칭**(실제 pandas 와 같다):

| 연산 | 메모리 |
|:---|:---|
| `df.head()`, `df.islice()` | **공유** (`sharesMemory` → true) |
| `df.mask()`, `df.take()` | **복사** (false) |
| `df.copy()` | 복사 |
| 공유 중인 컬럼에 쓰기 | **그 순간 블록이 복제된다** |

```js
var sub = df.mask(df.col('Age').gt(60));
sub.setCol('Age', 0);
// sub 는 바뀌고 df 는 안 바뀐다 — 교재 7장이 가르치는 그 함정
```

`UI.blockView(df)` 와 `UI.shareBadge(a, b, 'df', 'sub')` 로 보여준다.

### 4.8 단계 실행 (`DF.trace`)

```js
DF.trace.enable();
var r = s1.add(s2);
var steps = DF.trace.get();   // [{kind, detail}, …]
DF.trace.disable();
```

`kind`: `align` · `slice` · `take` · `copy` · `cow` · `block-copy` · `setCol` ·
`groupby-split` · `groupby-combine` · `merge`

`UI.stepper(steps, renderStep)` 와 함께 쓴다.
**`enable()` 은 로그를 비운다.** 다른 모듈과 겹치지 않게 쓰고 나면 `disable()` 하라.

### 4.9 그 외

```js
DF.isNA(v)              // null / undefined / NaN
DF.inferDtype([…])
DF.isNumericDtype(dt)
DF.fmt(v)               // 표시용 문자열
DF.cmpLabel(a, b)       // 라벨 정렬 비교자
DF.sortedUnion(ixA, ixB)
```

---

## 5. `UI` — 위젯

### 5.1 DOM

```js
UI.el('div.card', { text: '…', onclick: fn, style: {…} }, [자식…])   // 태그에 .클래스
UI.svg('rect', { x: 0, y: 0, width: 10, height: 10 })
UI.clear(node)          // 비운다
UI.esc(s)               // HTML escape
UI.fmt(v, digits)       // 값 표시 (NaN → 'NaN', True/False)
```

`UI.el` 의 `html:` 옵션은 escape 하지 않는다. **사용자 데이터에는 쓰지 마라.**

### 5.2 표

```js
UI.table(cols, rows, opts)
//   cols: [{ key, label, raw?, align?, width?, digits? }]   ★ raw 는 여기 붙인다
//   rows: [{key: value}] 또는 [[값…]]
//   opts: { maxRows, hlRows:[i…], hlCells:[[i,key]…], caption, frame:'original'|'copy'|'result' }
UI.frameTable(df, { maxRows: 5, digits: 4, hlRows: [0], frame: 'original' })
UI.seriesTable(s, { maxRows: 10 })
```

> **★ HTML escape 는 열 속성이다.** `raw: true` 를 **`cols`** 에 붙인다.
> 행에 붙이면 아무 효과가 없고 `<b>` 가 글자로 보인다. 이게 NumPy Lab 에서 실제로 나온 버그다.

`frame:` 을 주면 표 테두리가 원본/사본/결과 색으로 칠해진다. **테두리만으로 말하지 말고 라벨도 붙여라.**

### 5.3 엔진 시각화 (직접 그리지 말고 이걸 써라)

```js
UI.blockView(df, { title: '…' })                       // 블록 id·참조 수·뷰 여부
UI.shareBadge(seriesA, seriesB, 'df', 'sub')           // 공유/복사 한 줄 배지
UI.alignView(s1, s2, result, { title: '…' })           // 인덱스 짝짓기 표 (중복 행은 링 강조)
UI.groupView(df, groupby, { maxRowsPerGroup: 4 })      // split → apply → combine
```

### 5.4 차트

```js
UI.bar(items, { title, color, padLeft, labelHeader, valueHeader })
//   items: [{ label, value }]
UI.hist(values, { bins: 20, title })
UI.scatter([{ name, points: [[x,y], …] }, …], { title, xLabel, yLabel })
UI.legend([{ label, color }, …])
UI.withTableTwin(chartNode, tableNode, { title })      // 직접 만든 차트에 표 보기 붙이기
UI.niceTicks(min, max, count)
UI.scale([d0, d1], [r0, r1])
```

- **모든 차트에 표 보기 twin 이 붙는다.** `UI.bar`/`hist`/`scatter` 는 자동으로 붙인다.
  직접 SVG 를 만들면 `UI.withTableTwin` 으로 감싸라. 툴팁이 값을 읽는 유일한 경로가 되면 안 된다.
- **`UI.scatter` 의 계열은 3개까지다.** 넘으면 예외를 던진다(팔레트 all-pairs 한계).
- 이중 y축을 만들지 마라. 스케일이 다르면 차트를 두 개 만든다.

### 5.5 컨트롤

```js
UI.slider({ label, min, max, step, value, onChange: function (v) {…} })
UI.buttonGroup([{ label, value }, …], { label, selected: 0, onChange: function (v, i) {…} })
UI.toggle({ label, value, onChange: function (on) {…} })
```

`onChange` 안에서 `rebuild()` 를 불러 화면을 다시 그린다(§1 ②).

### 5.6 텍스트

```js
UI.code(src, { title, output, dataset, copyText, noCopy })
UI.note(message, title)
UI.danger(label, message)           // ⚠ 아이콘 + 라벨 + 빨강. 경고는 이것만 쓴다
```

**`UI.code` 는 복사 버튼을 자동으로 붙인다.** 학생이 IDLE 이나 주피터에 붙여 실행하기 때문이다.

- **`dataset:`** 을 주면 `import pandas as pd` 와 `read_csv` 를 **앞에 붙여서** 복사한다.
  화면에는 안 보이고 복사할 때만 들어간다. 그래서 붙이면 바로 돈다.
  값: `'titanic'`(변수 `t`) · `'ramen'`(`ramen`) · `'abalone'`(`df`) · `'earthquake'`(`data`)
- `copyText:` 로 복사 내용을 직접 정할 수 있다(`dataset` 보다 우선).
- `noCopy: true` 면 버튼을 달지 않는다. 붙여 실행할 코드가 아닐 때만 쓴다
  (예: 언어 동작을 보여주는 조각).

```js
// 학생이 그대로 실행할 수 있어야 하는 코드 -> dataset 을 준다
UI.code("t.loc[t['Age'] > 60, 'Age'] = 0", { dataset: 'titanic' });
```

`navigator.clipboard` 가 없는 환경(단일 파일을 `file://` 로 열었을 때)에서는
`textarea` 로 되돌아가고, 그것도 막히면 코드를 선택해 준다.

### 5.7 단계 실행 · 확인 문제

```js
UI.stepper(steps, function (step, i) { return UI.note(step.kind); }, { title })

UI.quiz({
  question: '…',
  choices: [{ label: 'A', correct: true, why: '…' }, { label: 'B', why: '…' }],
  explain: '공통 해설'
})
```

장마다 **확인 문제 2~4개, 시뮬레이터 최소 2개.**

---

## 6. 장 구성 (교재와 반드시 일치)

| id | num | 제목 |
|:---|--:|:---|
| `ch01-why` | 1 | pandas 는 무엇을 해결하는가 |
| `ch02-load` | 2 | 데이터를 불러오고 첫눈에 파악하기 |
| `ch03-series` | 3 | Series — 인덱스를 가진 1차원 |
| `ch04-frame` | 4 | DataFrame — 여러 Series 의 집합 |
| `ch05-locindex` | 5 | ★ loc 와 iloc |
| `ch06-align` | 6 | ★ 인덱스 정렬 |
| `ch07-copy` | 7 | ★ 뷰와 복사, Copy-on-Write |
| `ch08-missing` | 8 | 결측 데이터 |
| `ch09-dtype` | 9 | 값 바꾸기와 타입 변환 |
| `ch10-agg` | 10 | 정렬과 집계 |
| `ch11-groupby` | 11 | groupby |
| `ch12-merge` | 12 | 표를 합치기 |
| `ch13-notebook` | 13 | 노트북이 거짓말할 때 |
| `ch14-project` | 14 | 종합 실습 + 머신러닝으로 |

★ 표시된 3개 장에 가장 많은 공을 들인다. 교재의 해당 장을 먼저 읽고 시뮬레이터를 정하라.

---

## 7. 보고 전 자체 점검

- [ ] `node --check` 통과
- [ ] `npm run build` 통과
- [ ] `Lab.register` 의 `id` 가 파일명과 같고 `num` 이 교재 장 번호와 같다
- [ ] 화면에 하드코딩된 숫자가 없다 (전부 `DF` 로 계산)
- [ ] `render` 안에서만 상태를 만든다 (모듈 전역 가변 상태 없음)
- [ ] 차트에 표 보기 twin 이 있다
- [ ] 색을 §1 ③ 대로만 썼다. 노랑을 쓰지 않았다. 강조는 링이다
- [ ] `UI.table` 의 `raw` 를 행이 아니라 **열**에 붙였다
- [ ] 경고는 `UI.danger` 로만 냈다
- [ ] 시뮬레이터 2개 이상, 확인 문제 2~4개
- [ ] **`node webapp/test/check_licensing.js` 통과** — 원본 데이터의 값(승객 이름, 브랜드명)이나
      실존 인물 이름을 코드·주석·퀴즈 해설에 적지 않았다. 필요하면 `LabData` 에서 읽어 온다.
      이미 두 번 걸렸다(`webapp/src/modules/CLAUDE.md` 참고)

### 흔히 하는 실수

| 증상 | 원인 |
|:---|:---|
| 장이 목록에 안 보인다 | `id` 중복, 또는 `register` 가 `render` 없이 불렸다 |
| 재방문하면 값이 이상하다 | 모듈 전역에 가변 상태를 뒀다 (§1 ②) |
| `<b>` 가 글자로 보인다 | `raw` 를 행에 붙였다. **열**에 붙여라 |
| float 컬럼이 `int64` 로 나온다 | `DF.series([1.0, 2.0])` 은 JS 에서 정수다. `{dtype:'float64'}` 를 넘겨라 |
| `mean()` 이 예외를 던진다 | `dtype` 이 `object` 이고 문자열이 섞였다. 재현해야 하는 동작이다 |
| `std` 값이 교재와 다르다 | pandas 기본은 `ddof=1`. `s.std()` 가 맞고 `s.std(0)` 은 numpy 기본값이다 |
| 단계 로그가 비어 있다 | `DF.trace.enable()` 을 연산 **전에** 불러야 한다 |
