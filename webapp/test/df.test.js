/* df.test.js — 미니 엔진 단위 테스트
 *
 * 기대값은 두 종류다.
 *   ① 손계산으로 확실한 것
 *   ② scratchpad/probe_align.py 로 실제 pandas 3.0.5 에서 확인한 것 (주석에 [probe] 표시)
 *
 * 실제 pandas 와의 전면 교차 검증은 gen_expected.py + cross.test.js 가 한다.
 * 이 파일은 그 전에 엔진이 "말이 되는가" 를 막는 1차 방어선이다.
 *
 * 실행: node webapp/test/df.test.js
 */
'use strict';

var DF = require('../src/core/df.js');

var passed = 0, failed = 0, current = '';
var failures = [];

function group(name) { current = name; }

function ok(cond, label) {
  if (cond) { passed++; return; }
  failed++;
  failures.push(current + ' :: ' + label);
}

function eq(actual, expected, label) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++;
  failures.push(current + ' :: ' + label + '\n      기대: ' + e + '\n      실제: ' + a);
}

function close(actual, expected, label, tol) {
  tol = tol === undefined ? 1e-9 : tol;
  if (typeof actual === 'number' && Math.abs(actual - expected) <= tol) { passed++; return; }
  failed++;
  failures.push(current + ' :: ' + label + '\n      기대: ' + expected + '\n      실제: ' + actual);
}

function throws(fn, matcher, label) {
  try {
    fn();
  } catch (e) {
    if (!matcher || String(e.message).indexOf(matcher) !== -1) { passed++; return; }
    failed++;
    failures.push(current + ' :: ' + label + '\n      기대 메시지에 포함: ' + matcher + '\n      실제: ' + e.message);
    return;
  }
  failed++;
  failures.push(current + ' :: ' + label + ' (예외가 나지 않았다)');
}

// ─────────────────────────────────────────────────────── Index

group('Index');
{
  var ix = DF.index(['a', 'b', 'a', 'c']);
  eq(ix.positions('a'), [0, 2], '중복 라벨의 위치를 모두 준다');
  eq(ix.positions('z'), [], '없는 라벨은 빈 배열');
  ok(ix.hasDuplicates(), '중복 있음을 안다');
  ok(!DF.index(['a', 'b']).hasDuplicates(), '중복 없음을 안다');
  ok(DF.index(['c', 'a']).equals(DF.index(['c', 'a'])), '같은 인덱스');
  ok(!DF.index(['c', 'a']).equals(DF.index(['a', 'c'])), '순서가 다르면 다른 인덱스');
  eq(DF.range(3).labels, [0, 1, 2], 'RangeIndex');
  eq(DF.sortedUnion(DF.index(['c', 'a']), DF.index(['b', 'a'])), ['a', 'b', 'c'], '합집합은 정렬된다');
  eq(DF.sortedUnion(DF.index([3, 1]), DF.index([2, 1])), [1, 2, 3], '정수 라벨도 정렬');
}

// ─────────────────────────────────────────────────────── 정렬 (probe 로 확인한 규칙)

group('정렬(alignment)');
{
  // [probe] 1) 오른쪽에만 중복: 결과 인덱스 a,b,c,d,e,e,f / 값 NaN,8,10,12,10,14,NaN
  var s1 = DF.series([1, 2, 3, 4, 5], { index: ['a', 'b', 'c', 'd', 'e'] });
  var s2 = DF.series([5, 6, 7, 8, 9, 10], { index: ['e', 'b', 'c', 'd', 'e', 'f'] });
  var r = s1.add(s2);
  eq(r.labels(), ['a', 'b', 'c', 'd', 'e', 'e', 'f'], '[probe] 교재 6장 예제의 인덱스');
  eq(r.toArray(), [null, 8, 10, 12, 10, 14, null], '[probe] 교재 6장 예제의 값');

  // [probe] 2) 인덱스가 완전히 동일하면 정렬하지 않고 위치로 짝짓는다 -> 11,22,33 (곱집합 아님)
  var d1 = DF.series([1, 2, 3], { index: ['a', 'a', 'b'] });
  var d2 = DF.series([10, 20, 30], { index: ['a', 'a', 'b'] });
  var rd = d1.add(d2);
  eq(rd.labels(), ['a', 'a', 'b'], '[probe] 동일 인덱스는 인덱스를 그대로 둔다');
  eq(rd.toArray(), [11, 22, 33], '[probe] 동일 인덱스는 위치 짝짓기 (곱집합이 아니다)');

  // [probe] 3) 왼쪽 2개 x 오른쪽 3개 = 6행, 왼쪽이 바깥 루프
  var c1 = DF.series([1, 2], { index: ['a', 'a'] });
  var c2 = DF.series([10, 20, 30], { index: ['a', 'a', 'a'] });
  var rc = c1.add(c2);
  eq(rc.toArray(), [11, 21, 31, 12, 22, 32], '[probe] 중복 x 중복 = 곱집합, 왼쪽이 바깥');
  eq(rc.length(), 6, '[probe] 행이 6개로 늘어난다');

  // [probe] 4) 다른 인덱스는 합집합 정렬
  var e1 = DF.series([1, 2], { index: ['c', 'a'] });
  var e2 = DF.series([10, 20], { index: ['b', 'a'] });
  var re = e1.add(e2);
  eq(re.labels(), ['a', 'b', 'c'], '[probe] 다르면 합집합을 정렬');
  eq(re.toArray(), [22, null, null], '[probe] 한쪽만 있으면 NaN');

  // [probe] 5) 동일 인덱스면 정렬하지 않는다 (c,a 유지)
  var f1 = DF.series([1, 2], { index: ['c', 'a'] });
  var f2 = DF.series([10, 20], { index: ['c', 'a'] });
  eq(f1.add(f2).labels(), ['c', 'a'], '[probe] 동일하면 c,a 순서 유지');

  // [probe] 6) 한쪽에만 있는 라벨이 중복이면 그 개수만큼 NaN
  var g1 = DF.series([1, 2, 3], { index: ['a', 'z', 'z'] });
  var g2 = DF.series([10], { index: ['a'] });
  var rg = g1.add(g2);
  eq(rg.labels(), ['a', 'z', 'z'], '[probe] 왼쪽에만 있는 중복 라벨');
  eq(rg.toArray(), [11, null, null], '[probe] 값은 NaN');

  // fillValue
  var h = DF.series([1, 2], { index: ['a', 'b'] }).add(
    DF.series([10], { index: ['a'] }), { fillValue: 0 });
  eq(h.toArray(), [11, 2], 'fillValue 를 주면 한쪽만 있어도 계산한다');

  // 스칼라
  eq(DF.series([1, 2, null]).add(10).toArray(), [11, 12, null], '스칼라 연산. 결측은 결측으로 남는다');
}

// ─────────────────────────────────────────────────────── Copy-on-Write

group('Copy-on-Write');
{
  var df = DF.frame({ x: [0, 1, 2, 3, 4, 5], y: [0, 2, 4, 6, 8, 10] });

  // [probe] 슬라이싱은 블록을 공유한다 (shares_memory True)
  var sl = df.islice(2, 5);
  ok(DF.sharesMemory(df.col('x'), sl.col('x')), '[probe] 슬라이싱은 메모리를 공유한다');
  eq(sl.col('x').toArray(), [2, 3, 4], '슬라이스의 값');
  eq(sl.index.labels, [2, 3, 4], '슬라이스의 인덱스는 원본 라벨을 유지');

  // [probe] 불린 마스크는 복사한다 (shares_memory False)
  var mk = df.mask(df.col('x').gt(3));
  ok(!DF.sharesMemory(df.col('x'), mk.col('x')), '[probe] 불린 마스크는 복사한다');
  eq(mk.col('x').toArray(), [4, 5], '마스크의 값');
  eq(mk.index.labels, [4, 5], '마스크의 인덱스');

  // [probe] copy() 는 복사한다
  ok(!DF.sharesMemory(df.col('x'), df.copy().col('x')), '[probe] copy() 는 공유하지 않는다');

  // 쓰기 시점에 복사된다 — 슬라이스에 쓰면 원본이 안 바뀐다
  var before = df.col('x').toArray();
  sl.setLoc(2, 'x', 999);
  eq(df.col('x').toArray(), before, '슬라이스에 쓰면 원본은 그대로다 (CoW)');
  eq(sl.col('x').toArray(), [999, 3, 4], '슬라이스 자신은 바뀐다');
  ok(!DF.sharesMemory(df.col('x'), sl.col('x')), '쓰기 후에는 더 이상 공유하지 않는다');

  // 교재 7장의 핵심: 마스크 결과에 쓰면 원본이 안 바뀐다
  var t = DF.frame({ age: [70, 20, 65, 30] });
  var sub = t.mask(t.col('age').gt(60));
  sub.setCol('age', [0, 0]);
  eq(t.col('age').toArray(), [70, 20, 65, 30], '필터 결과에 써도 원본은 그대로다');
  eq(sub.col('age').toArray(), [0, 0], '사본은 바뀐다');

  // 바른 형태: setLoc 으로 조건 대입
  var t2 = DF.frame({ age: [70, 20, 65, 30] });
  t2.setLoc(t2.col('age').gt(60), 'age', 0);
  eq(t2.col('age').toArray(), [0, 20, 0, 30], '.loc[조건, 컬럼] = 값 은 원본을 바꾼다');

  /* ★ refs 회계 — CoW 시뮬레이터가 이 숫자를 화면에 띄운다.
   * `col()` 은 **읽기용으로 빌리는** 것이므로 refs 를 올리지 않는다.
   * 올리면 표를 한 번 그릴 때마다(셀마다 col() 호출) refs 가 끝없이 누적된다. */
  var f = DF.frame({ a: [1, 2, 3] });
  var r0 = f.blockInfo()[0].refs;
  f.col('a'); f.col('a'); f.col('a');
  eq(f.blockInfo()[0].refs, r0, 'col() 을 여러 번 불러도 refs 가 누적되지 않는다');

  // 파생 프레임은 소유하므로 refs 를 올린다
  var shared2 = f.cols(['a']);
  ok(f.blockInfo()[0].refs > r0, '파생 프레임이 생기면 refs 가 올라간다');

  // 빌린 참조에 쓰면 무조건 복사된다 = 연쇄 할당은 원본을 바꾸지 못한다
  var borrowed = f.col('a');
  borrowed.setILoc(0, 777);
  eq(f.col('a').toArray(), [1, 2, 3], 'col() 로 꺼낸 Series 에 써도 원본은 안 바뀐다 (연쇄 할당)');
  eq(borrowed.toArray(), [777, 2, 3], '꺼낸 Series 자신은 바뀐다');
}

// ─────────────────────────────────────────────────────── dtype (probe 로 확인)

group('dtype');
{
  eq(DF.inferDtype([1, 2, 3]), 'int64', '[probe] 정수만');
  eq(DF.inferDtype([1, 2.5]), 'float64', '[probe] 실수가 섞이면 float64');
  eq(DF.inferDtype([1, null]), 'float64', '[probe] 정수 + 결측 -> float64');
  eq(DF.inferDtype(['a', 'b']), 'str', '[probe] 문자열은 str (pandas 3.0 기본)');
  eq(DF.inferDtype([1, 'a']), 'object', '[probe] 숫자 + 문자열 -> object');
  eq(DF.inferDtype([true, false]), 'bool', '[probe] 불린');
  eq(DF.inferDtype([true, 1]), 'object', '[probe] 불린 + 숫자 -> object');

  // 교재 8장: fillna('0') 로 dtype 이 올라가 산술이 죽는다
  var age = DF.series([22, null, 26]);
  eq(age.dtype, 'float64', '원래는 float64');
  var broken = age.fillna('0');
  eq(broken.dtype, 'object', "[probe] fillna('0') 이후에는 object");
  throws(function () { broken.mean(); }, 'unsupported operand',
    '[probe] object 가 되면 산술이 죽는다 — 교재 8장의 핵심');

  var fixed = age.fillna(0);
  eq(fixed.dtype, 'float64', "[probe] fillna(0) 은 float64 를 유지 (int64 로 내려가지 않는다)");
  close(fixed.mean(), 16, 'fillna(0) 후 평균 (22+0+26)/3');

  // [probe] 문자열 컬럼을 숫자로 replace 하면 str 이 아니라 object 가 된다
  eq(DF.series(['male', 'female']).replace({ male: 0, female: 1 }).dtype, 'object',
    '[probe] str 을 숫자로 replace -> object');
  // JS 는 1 과 1.0 을 구분하지 못하므로 float 컬럼은 dtype 을 명시해서 만든다 (엔진 한계)
  eq(DF.series([1, 2], { dtype: 'float64' }).replace({ 1: 9 }).dtype, 'float64',
    '[probe] 숫자를 숫자로 replace -> dtype 유지');
  eq(DF.series([1.5, 2.5]).dtype, 'float64', '소수점이 있으면 float64 로 추론된다');
  eq(DF.series(['a', null]).fillna('b').dtype, 'str', "[probe] str + fillna('b') -> str");
  eq(DF.series(['a', null]).fillna(0).dtype, 'object', '[probe] str + fillna(0) -> object');
  eq(DF.series([1, 2, 3]).fillna(0).dtype, 'int64', '[probe] 결측이 없으면 dtype 그대로');

  /* ★ [정정표 C-7] str dtype 은 **대입에는 엄격하고 변환은 통과시킨다**.
   * 실제 pandas 3.0.5 의 비대칭을 재현한 것이다. */
  var strS = DF.series(['a', 'b', 'c']);
  eq(strS.dtype, 'str', 'str dtype');
  throws(function () { strS.setILoc(0, 0); }, "Invalid value '0' for dtype 'str'",
    '[probe] str 컬럼에 정수를 대입하면 TypeError');
  throws(function () { strS.setLoc(1, 3.5); }, "for dtype 'str'",
    '[probe] 실수도 막는다');
  eq(strS.copy().setILoc(0, 'z').toArray(), ['z', 'b', 'c'], '문자열 대입은 통과한다');
  eq(strS.copy().setILoc(0, null).toArray(), [null, 'b', 'c'], '결측 대입은 통과한다');
  eq(strS.replace({ a: 0 }).dtype, 'object', '[probe] replace 는 승격시켜 통과한다');

  var strF = DF.frame({ s: ['x', 'y'] });
  throws(function () { strF.setLoc(0, 's', 1); }, "for dtype 'str'",
    '[probe] DataFrame.setLoc 도 막는다');
  strF.setLoc(0, 's', 'z');
  eq(strF.col('s').toArray(), ['z', 'y'], '문자열은 통과');

  // mode — 결측 채우기 비교에 쓰인다
  eq(DF.series([1, 2, 2, 3, 3]).mode().toArray(), [2, 3], '동률이면 여러 개를 정렬해서 준다');
  eq(DF.series(['b', 'a', 'a']).mode().toArray(), ['a'], '최빈값 하나');
}

// ─────────────────────────────────────────────────────── Series 집계

group('Series 집계');
{
  var s = DF.series([1, 2, 3, 4]);
  close(s.mean(), 2.5, '평균');
  // [probe] pandas s.std() = 1.2909944487358056 (ddof=1), np.std = 1.118033988749895 (ddof=0)
  close(s.std(), 1.2909944487358056, '[probe] std 는 ddof=1 (pandas 기본)', 1e-12);
  close(s.std(0), 1.118033988749895, '[probe] std(0) 은 numpy 기본값과 같다', 1e-12);
  eq(s.min(), 1, '최소');
  eq(s.max(), 4, '최대');
  close(s.median(), 2.5, '중앙값');
  close(s.quantile(0.25), 1.75, '1사분위 (선형 보간)');
  close(s.quantile(0.75), 3.25, '3사분위 (선형 보간)');

  var withNA = DF.series([1, null, 3]);
  eq(withNA.count(), 2, 'count 는 결측을 세지 않는다');
  close(withNA.mean(), 2, '평균은 결측을 빼고 계산');
  eq(withNA.sum(), 4, '합도 결측을 빼고');

  eq(DF.series([1, 1, 2, null]).nunique(), 2, 'nunique 는 결측 제외');
  eq(DF.series([1, 1, 2, null]).unique().length, 3, 'unique 는 결측 포함');

  // ★ 불린 집계 — 엔진이 0 을 내던 버그가 있었다. 교재 8장의 핵심 관용구가 여기 의존한다.
  var b = DF.series([true, false, true, true]);
  eq(b.sum(), 3, '[probe] 불린 sum 은 True 를 1 로 센다');
  close(b.mean(), 0.75, '[probe] 불린 mean');
  eq(b.count(), 4, '불린 count 는 전체 개수');
  eq(DF.series([1, null, 3, null]).isna().sum(), 2, '★ isna().sum() 이 결측 개수를 준다');
  eq(DF.series([1, null, 3, null]).notna().sum(), 2, 'notna().sum()');
}

group('valueCounts');
{
  var pc = DF.series([3, 1, 3, 2, 3, 1], { name: 'Pclass' });
  var vc = pc.valueCounts();
  eq(vc.labels(), [3, 1, 2], '개수 내림차순');
  eq(vc.toArray(), [3, 2, 1], '개수');
  // pandas 3.0: name 은 'count', 인덱스 이름은 원래 컬럼명
  eq(vc.name, 'count', "[정정표 C-2] 결과 name 은 'count'");
  eq(vc.index.name, 'Pclass', '[정정표 C-2] 인덱스 이름이 원래 컬럼명');

  var withNA = DF.series(['S', 'C', null, 'S']);
  eq(withNA.valueCounts().toArray(), [2, 1], 'dropna=true 기본');
  eq(withNA.valueCounts({ dropna: false }).toArray(), [2, 1, 1], 'dropna=false 면 결측도 센다');
}

group('sortValues');
{
  var s = DF.series([3, 1, null, 2], { index: ['a', 'b', 'c', 'd'] });
  eq(s.sortValues().toArray(), [1, 2, 3, null], '오름차순, 결측은 맨 뒤');
  eq(s.sortValues().labels(), ['b', 'd', 'a', 'c'], '인덱스가 값과 함께 따라간다');
  eq(s.sortValues({ ascending: false }).toArray(), [3, 2, 1, null], '내림차순에서도 결측은 맨 뒤');
}

// ─────────────────────────────────────────────────────── DataFrame

group('DataFrame 기본');
{
  var df = DF.frame({ a: [1, 2, 3], b: ['x', 'y', 'z'] });
  eq(df.shape, [3, 2], 'shape');
  eq(df.columns, ['a', 'b'], 'columns');
  eq(df.dtypes(), { a: 'int64', b: 'str' }, '컬럼마다 다른 dtype');
  eq(df.col('a').toArray(), [1, 2, 3], '컬럼 꺼내기');
  eq(df.col('a').name, 'a', '꺼낸 Series 의 name 은 컬럼명');
  throws(function () { df.col('없음'); }, 'KeyError', '없는 컬럼은 KeyError');

  // columns= 에만 있는 이름은 NaN 컬럼이 된다 (원본 nb05 [98])
  var withNaN = DF.frame({ a: [1, 2] }, { columns: ['a', '연봉'] });
  eq(withNaN.col('연봉').toArray(), [null, null], 'columns= 에만 있는 이름은 NaN 컬럼');

  // fromRecords
  var fr = DF.fromRecords([{ a: 1, b: 2 }, { a: 3 }]);
  eq(fr.columns, ['a', 'b'], 'fromRecords 가 컬럼을 모은다');
  eq(fr.col('b').toArray(), [2, null], '없는 키는 결측');
}

group('drop');
{
  // [정정표 A-2] drop 은 view 가 아니라 복사본을 반환한다
  var df = DF.frame({ a: [1, 2, 3], b: [4, 5, 6], c: [7, 8, 9] });
  var d = df.drop('c', { axis: 1 });
  eq(d.columns, ['a', 'b'], '컬럼이 빠진다');
  eq(df.columns, ['a', 'b', 'c'], '[정정표 A-2] 원본은 그대로다');
  d.setLoc(0, 'a', 999);
  eq(df.col('a').toArray(), [1, 2, 3], '[정정표 A-2] 반환본을 고쳐도 원본은 안 바뀐다');

  /* ★ 메모리 공유 매트릭스 — 실제 pandas 3.0.5 로 확인한 값이다.
   * 초기 probe 에서 **쓰기를 먼저 하고 측정해** drop 을 "즉시 복사" 로 잘못 기록했다.
   * 측정은 반드시 쓰기 전에 한다. */
  var sh = DF.frame({ a: [1, 2, 3], b: [4, 5, 6], c: [7, 8, 9] });
  ok(DF.sharesMemory(sh.col('a'), sh.drop('c', { axis: 1 }).col('a')),
    '[probe] drop(axis=1) 직후에는 메모리를 공유한다 (컬럼 목록만 바뀐다)');
  ok(!DF.sharesMemory(sh.col('a'), sh.drop(0, { axis: 0 }).col('a')),
    '[probe] drop(axis=0) 은 행 추출이므로 즉시 새 메모리를 만든다');
  ok(DF.sharesMemory(sh.col('a'), sh.cols(['a', 'b']).col('a')),
    "[probe] df[['a','b']] 는 메모리를 공유한다");
  // 쓰면 그 순간 갈라진다
  var dropped = sh.drop('c', { axis: 1 });
  dropped.setLoc(0, 'a', 999);
  ok(!DF.sharesMemory(sh.col('a'), dropped.col('a')), '[probe] 쓰고 나면 공유가 끊긴다');
  eq(sh.col('a').toArray(), [1, 2, 3], '원본은 그대로다');

  var dfi = DF.frame({ a: [1, 2, 3] });
  var ret = dfi.drop(0, { axis: 0, inplace: true });
  eq(ret, null, 'inplace=true 는 None(null) 을 반환한다');
  eq(dfi.col('a').toArray(), [2, 3], 'inplace 는 원본을 바꾼다');
}

group('transpose');
{
  var df = DF.frame({ a: [1, 2], b: [3, 4] }, { index: ['p', 'q'] });
  var t = df.T;
  eq(t.columns, ['p', 'q'], '인덱스 라벨이 컬럼이 된다');
  eq(t.index.labels, ['a', 'b'], '컬럼이 인덱스가 된다');
  eq(t.col('p').toArray(), [1, 3], '전치된 값');
  eq(t.T.col('a').toArray(), [1, 2], '두 번 전치하면 원래대로');
  // dtype 이 섞이면 object 가 된다 — 한 행에 서로 다른 타입이 모이므로
  var mixed = DF.frame({ n: [1, 2], s: ['x', 'y'] });
  eq(mixed.T.dtypes(), { 0: 'object', 1: 'object' }, 'dtype 이 섞이면 전치 결과는 object');
  ok(!DF.sharesMemory(df.col('a'), t.col('p')), '전치는 새 블록을 만든다');
}

group('iloc / loc');
{
  // 교재 5장의 핵심 예제: 인덱스가 [55,56,1,2]
  var t = DF.frame({ name: ['A', 'B', 'C', 'D'] }, { index: [55, 56, 1, 2] });
  eq(t.iloc(2).col('name').toArray(), ['C'], 'iloc[2] 는 위에서 세 번째');
  eq(t.iloc(2).index.labels, [1], 'iloc[2] 의 라벨은 1');
  eq(t.loc(2).col('name').toArray(), ['D'], 'loc[2] 는 라벨이 2 인 행');
  eq(t.loc(2).index.labels, [2], 'loc[2] 의 라벨은 2');

  // loc 슬라이스는 끝을 포함한다
  eq(t.loc({ range: true, from: 56, to: 1 }).col('name').toArray(), ['B', 'C'],
    'loc 라벨 슬라이스는 끝을 포함');

  // iloc 에 문자열을 주면 pandas 와 같은 ValueError
  throws(function () { t.iloc(0, 'name'); }, 'Location based indexing',
    'iloc 에 문자열 열 이름은 ValueError');
  throws(function () { t.loc(0); }, 'KeyError', '없는 라벨은 KeyError');

  // 필터링하면 인덱스가 연속이 아니게 된다 (교재 5장 흔한 실수)
  var ages = DF.frame({ age: [10, 70, 20, 65, 30] });
  var old = ages.mask(ages.col('age').gt(60));
  eq(old.index.labels, [1, 3], '필터 결과의 인덱스는 원본 라벨(연속 아님)');
  eq(old.iloc(0).col('age').toArray(), [70], '위치 0 은 첫 행');
  eq(old.loc(1).col('age').toArray(), [70], '라벨 1 도 같은 행 — 여기선 우연히 같다');
  throws(function () { old.loc(0); }, 'KeyError', '라벨 0 은 이제 없다 — 버그가 여기서 터진다');
}

group('불린 마스크 조합');
{
  var t = DF.frame({
    age: [70, 20, 65, 30],
    cls: [1, 1, 2, 1],
    sex: ['f', 'm', 'f', 'f']
  });
  var m = t.col('age').gt(60).and(t.col('cls').eq(1)).and(t.col('sex').eq('f'));
  eq(m.toArray(), [true, false, false, false], '세 조건을 and 로');
  eq(t.mask(m).nrows(), 1, '한 행만 남는다');
}

group('isna / fillna / dropna');
{
  var df = DF.frame({ a: [1, null, 3], b: [null, null, 'z'] });
  eq(df.isna().col('a').toArray(), [false, true, false], 'isna');
  eq(df.isna().sum().toArray(), [1, 2], 'isna().sum() 은 컬럼별 결측 수');
  eq(df.isna().sum().labels(), ['a', 'b'], '인덱스는 컬럼명');
  eq(df.fillna(0).col('a').toArray(), [1, 0, 3], '스칼라 fillna');
  eq(df.fillna({ a: -1 }).col('b').toArray(), [null, null, 'z'], '컬럼별 fillna 는 지정한 것만');
  eq(df.dropna().nrows(), 1, 'dropna 는 결측이 하나라도 있는 행을 버린다');
  eq(df.dropna({ subset: ['a'] }).nrows(), 2, 'subset 을 주면 그 컬럼만 본다');
}

group('describe');
{
  var df = DF.frame({ v: [1, 2, 3, 4], s: ['a', 'b', 'c', 'd'] });
  var d = df.describe();
  eq(d.columns, ['v'], 'describe 는 숫자 컬럼만');
  eq(d.index.labels, ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'], '8개 행');
  close(d.col('v').at(1), 2.5, 'mean');
  close(d.col('v').at(2), 1.2909944487358056, '[probe] std 는 ddof=1', 1e-12);
  eq(df.describe({ include: 'all' }).columns, ['v', 's'], "include:'all' 이면 문자열도");
}

group('groupby');
{
  var t = DF.frame({
    cls: [1, 1, 2, 2, 3],
    age: [30, 50, 20, null, 10],
    fare: [1, 2, 3, 4, 5]
  });
  var g = t.groupby('cls');
  eq(g.groups().map(function (x) { return x.key[0]; }), [1, 2, 3], '키 순으로 정렬된 그룹');
  eq(g.groups().map(function (x) { return x.rows.length; }), [2, 2, 1], '그룹 크기');
  eq(g.size().toArray(), [2, 2, 1], 'size()');

  var m = g.aggCol('age', 'mean');
  eq(m.labels(), [1, 2, 3], '집계 결과의 인덱스는 키');
  close(m.at(0), 40, '1등급 평균 나이');
  close(m.at(1), 20, '결측은 빼고 계산한다');
  close(m.at(2), 10, '3등급');

  var agg = g.agg({ age: 'max', fare: 'mean' });
  eq(agg.columns, ['age', 'fare'], '컬럼마다 다른 집계');
  close(agg.col('age').at(0), 50, 'age max');
  close(agg.col('fare').at(0), 1.5, 'fare mean');

  // 다중 키
  var t2 = DF.frame({ a: ['x', 'x', 'y'], b: [1, 2, 1], v: [10, 20, 30] });
  var g2 = t2.groupby(['a', 'b']);
  eq(g2.groups().length, 3, '다중 키 그룹 수');
  eq(g2.aggCol('v', 'sum').toArray(), [10, 20, 30], '다중 키 집계');

  // NaN 키는 버린다
  var t3 = DF.frame({ k: ['a', null, 'a'], v: [1, 2, 3] });
  eq(t3.groupby('k').size().toArray(), [2], 'NaN 키 행은 그룹에서 빠진다');
}

group('merge / concat');
{
  var L = DF.frame({ id: [1, 2, 3], x: ['a', 'b', 'c'] });
  var R = DF.frame({ id: [2, 3, 4], y: ['B', 'C', 'D'] });

  var inner = L.merge(R, { on: 'id', how: 'inner' });
  eq(inner.nrows(), 2, 'inner 는 양쪽에 있는 것만');
  eq(inner.col('id').toArray(), [2, 3], 'inner 키');
  eq(inner.columns, ['id', 'x', 'y'], '컬럼이 합쳐진다');

  var left = L.merge(R, { on: 'id', how: 'left' });
  eq(left.nrows(), 3, 'left 는 왼쪽 전부');
  eq(left.col('y').toArray(), [null, 'B', 'C'], '오른쪽에 없으면 NaN');

  var outer = L.merge(R, { on: 'id', how: 'outer' });
  eq(outer.nrows(), 4, 'outer 는 합집합');

  // 키가 중복이면 행이 늘어난다
  var L2 = DF.frame({ id: [1, 1], x: ['a', 'b'] });
  var R2 = DF.frame({ id: [1, 1], y: ['A', 'B'] });
  eq(L2.merge(R2, { on: 'id', how: 'inner' }).nrows(), 4, '중복 키는 곱집합이라 4행');

  /* ★ 겹치는 컬럼에는 양쪽 모두 접미사가 붙는다. 키에는 붙지 않는다. [probe]
   * 처음에는 오른쪽에만 `_y` 를 붙여 교재 12.5절과 어긋났다. */
  var Ls = DF.frame({ id: [1, 2], x: ['a', 'b'], note: ['L1', 'L2'] });
  var Rs = DF.frame({ id: [1, 2], y: ['A', 'B'], note: ['R1', 'R2'] });
  eq(Ls.merge(Rs, { on: 'id' }).columns, ['id', 'x', 'note_x', 'y', 'note_y'],
    '[probe] 겹치는 note 에 _x / _y 가 양쪽 다 붙고 키 id 에는 안 붙는다');
  eq(Ls.merge(Rs, { on: 'id', suffixes: ['_L', '_R'] }).columns,
    ['id', 'x', 'note_L', 'y', 'note_R'], 'suffixes 를 지정할 수 있다');
  eq(DF.frame({ id: [1], a: [1] }).merge(DF.frame({ id: [1], b: [2] }), { on: 'id' }).columns,
    ['id', 'a', 'b'], '[probe] 겹치는 컬럼이 없으면 접미사도 없다');

  var c = DF.concat([DF.frame({ a: [1] }), DF.frame({ a: [2], b: [3] })], { ignoreIndex: true });
  eq(c.columns, ['a', 'b'], 'concat 은 컬럼 합집합');
  eq(c.col('b').toArray(), [null, 3], '한쪽에만 있는 컬럼은 NaN');
  eq(c.index.labels, [0, 1], 'ignoreIndex');
}

group('resetIndex / rename / setIndex');
{
  var vc = DF.series([491, 216, 184], { index: DF.index([3, 1, 2], 'Pclass'), name: 'count' });
  // [정정표 C-2] value_counts().reset_index() 의 컬럼은 ['Pclass','count'] 다
  var f = DF.frame({ count: vc.toArray() }, { index: vc.index });
  var reset = f.resetIndex();
  eq(reset.columns, ['Pclass', 'count'], "[정정표 C-2] 컬럼이 ['Pclass','count']");
  eq(reset.col('Pclass').toArray(), [3, 1, 2], '인덱스가 컬럼으로 내려온다');

  eq(reset.rename({ count: '건수' }).columns, ['Pclass', '건수'], 'rename');
  // [정정표 C-2] 원본의 rename 은 아무 일도 안 하는 게 아니라 조용히 잘못된 일을 한다.
  // 'index' 매핑은 무시되지만 'Pclass'->'Pclass_count' 는 실제로 적용되어
  // 등급 라벨이 담긴 컬럼이 'Pclass_count' 라는 이름을 갖는다 (이름이 내용과 반대).
  eq(reset.rename({ index: 'Pclass', Pclass: 'Pclass_count' }).columns, ['Pclass_count', 'count'],
    "[정정표 C-2] 원본 rename 은 컬럼 이름을 내용과 반대로 만든다");

  var si = DF.frame({ k: ['a', 'b'], v: [1, 2] }).setIndex('k');
  eq(si.columns, ['v'], 'setIndex 후 그 컬럼은 빠진다');
  eq(si.index.labels, ['a', 'b'], '인덱스가 된다');
}

group('replace / astype / toNumeric');
{
  var s = DF.series(['male', 'female', 'male']);
  eq(s.replace({ male: 0, female: 1 }).toArray(), [0, 1, 0], 'replace 딕셔너리');
  eq(s.replace('male', 'Man').toArray(), ['Man', 'female', 'Man'], 'replace 단일 값');
  eq(DF.series(['A', null, 'B']).replace(null, 'C001').toArray(), ['A', 'C001', 'B'],
    '[probe] 결측을 replace 로 채울 수 있다');

  var stars = DF.series(['3.75', 'Unrated', '2.25']);
  eq(stars.toNumeric('coerce').toArray(), [3.75, null, 2.25], "errors='coerce' 는 실패를 결측으로");
  throws(function () { stars.toNumeric(); }, 'Unable to parse', '기본은 예외');
  eq(DF.series(['1', '2']).toNumeric().dtype, 'int64', '숫자로 바뀌면 int64');
  eq(DF.series([1.7, 2.2]).astype('int64').toArray(), [1, 2], 'astype int 는 버림');
}

group('map / apply');
{
  eq(DF.series([1, 2, 3]).map(function (v) { return v * v; }).toArray(), [1, 4, 9], 'map');
  var names = DF.series(['ab', 'cde']);
  eq(names.apply(function (v) { return v.length; }).toArray(), [2, 3], 'apply');
}

group('trace');
{
  DF.trace.enable();
  var df = DF.frame({ a: [1, 2, 3, 4] });
  df.islice(1, 3);
  df.mask(df.col('a').gt(2));
  var log = DF.trace.get();
  ok(log.some(function (e) { return e.kind === 'slice' && e.detail.shared === true; }),
    '슬라이싱이 shared:true 로 기록된다');
  ok(log.some(function (e) { return e.kind === 'take' && e.detail.shared === false; }),
    '마스크가 shared:false 로 기록된다');

  DF.trace.clear();
  DF.series([1, 2], { index: ['a', 'a'] }).add(DF.series([1, 2, 3], { index: ['a', 'a', 'a'] }));
  var al = DF.trace.get().filter(function (e) { return e.kind === 'align'; });
  eq(al.length, 1, '정렬이 한 번 기록된다');
  eq(al[0].detail.grew, true, '행이 늘어났다는 것을 기록한다');
  DF.trace.disable();
}

group('표시');
{
  var df = DF.frame({ a: [1, 2], b: ['x', 'y'] });
  ok(df.toString().indexOf('a') !== -1, 'toString 에 컬럼명이 있다');
  var info = df.info();
  eq(info.columns.map(function (c) { return c.dtype; }), ['int64', 'str'], 'info 의 dtype');
  eq(info.dtypeCounts, { int64: 1, str: 1 }, 'dtype 개수 집계');
  ok(info.indexDesc.indexOf('RangeIndex') !== -1, 'RangeIndex 표시');
  eq(DF.fmt(null), 'NaN', '결측 표시는 NaN');
  eq(DF.fmt(1.5), '1.5', '실수 표시');
}

// ─────────────────────────────────────────────────────── 결과

console.log('');
if (failed === 0) {
  console.log('  통과 ' + passed + ' / 실패 0');
  console.log('');
  process.exit(0);
} else {
  failures.forEach(function (f) { console.log('  ✗ ' + f); });
  console.log('');
  console.log('  통과 ' + passed + ' / 실패 ' + failed);
  console.log('');
  process.exit(1);
}
