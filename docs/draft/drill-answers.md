## 연습 문제 정답 — 타이타닉에서 꺼내기

풀이 코드의 출력은 **원본 `train.csv`** 에서 실행한 결과다. 합성본(`titanic-synthetic.csv`)으로 풀었다면
각 풀이 아래의 **합성본** 줄과 비교한다. 두 벌 모두 이 책을 만들 때 실제로 실행해서 얻은 값이다.

**문제 1.** `Name`, `Sex`, `Age` 세 열만 꺼낸 표를 만들고 `shape` 를 출력하라.

```python
sub = t[['Name', 'Sex', 'Age']]
print(sub.shape)
```

```text
(891, 3)
```

합성본: `(891, 3)`

열을 하나만 꺼내면(`t['Name']`) Series, 리스트로 꺼내면(`t[['Name']]`) 열이 하나인 DataFrame 이다(4장).

**문제 2.** 여자 승객(`Sex` 가 `'female'`)만 꺼내라. 몇 명인가?

```python
women = t[t['Sex'] == 'female']
print(len(women))
```

```text
314
```

합성본: `320`

`t['Sex'] == 'female'` 은 행마다 True/False 인 Series 다. 그것을 `t[...]` 에 넣으면 True 인 행만 남는다.

**문제 3.** 1등석(`Pclass` 가 1) 승객만 꺼내라. 몇 명이고, 그중 생존자는 몇 명인가?

```python
first = t[t['Pclass'] == 1]
print(len(first), first['Survived'].sum())
```

```text
216 136
```

합성본: `196 78`

`Survived` 는 0 과 1 이라 합이 곧 생존자 수이고, 평균이 곧 생존율이다.

**문제 4.** 나이가 60세 이상인 승객을 꺼내라. 몇 명인가? 나이가 비어 있는 승객은 이 결과에 들어가는가?

```python
old = t[t['Age'] >= 60]
print(len(old))
print(old['Age'].isna().sum())
```

```text
26
0
```

합성본: `8` · `0`

결측과의 비교는 언제나 False 다. 그래서 나이를 모르는 승객은 **조용히** 빠진다 — 에러도 경고도 없다(8장).

**문제 5.** **위치로** 11번째부터 20번째 행(10개)을 꺼내라. 꺼낸 행 수와 그 안의 생존자 수를 출력하라.

```python
rows = t.iloc[10:20]
print(len(rows), rows['Survived'].sum())
```

```text
10 5
```

합성본: `10 6`

`iloc[10:20]` 은 위치 10~19, 곧 10개다. 파이썬 리스트 슬라이스와 같은 규칙이다(5장).

**문제 6.** 1등석 **여자** 승객만 꺼내라. 몇 명인가?

```python
fw = t[(t['Pclass'] == 1) & (t['Sex'] == 'female')]
print(len(fw))
```

```text
94
```

합성본: `75`

파이썬의 `and` 는 쓸 수 없다 — Series 전체가 참인지 한 번에 묻게 되어 에러가 난다. 괄호를 빼면 아래처럼 된다.

```python
# ✗ 괄호를 빼면 & 가 == 보다 먼저 계산된다
t[t['Pclass'] == 1 & t['Sex'] == 'female']
```

```text
TypeError: unsupported operand type(s) for &: 'int' and 'StringArray'
```

**문제 7.** 승선항(`Embarked`)이 `'C'` 또는 `'Q'` 인 승객은 몇 명인가?

```python
cq = t[t['Embarked'].isin(['C', 'Q'])]
print(len(cq))
```

```text
245
```

합성본: `253`

`isin` 은 목록에 든 값이면 True 다. 승선항이 비어 있는 승객은 어느 쪽에도 들지 않는다.

**문제 8.** 요금(`Fare`)이 10 이상 30 이하인 승객은 몇 명인가?

```python
mid = t[t['Fare'].between(10, 30)]
print(len(mid))
```

```text
321
```

합성본: `436`

`between` 은 기본으로 **양 끝을 포함**한다(`inclusive='both'`). `(t['Fare'] >= 10) & (t['Fare'] <= 30)` 과 같다.

**문제 9.** 나이가 **비어 있는** 승객만 꺼내라. 몇 명이고, 그중 생존자는 몇 명인가?

```python
unknown = t[t['Age'].isna()]
print(len(unknown), unknown['Survived'].sum())
```

```text
177 52
```

합성본: `177 64`

`t['Age'] == float('nan')` 은 전부 False 다 — NaN 은 자기 자신과도 같지 않다. 결측은 `isna()` 로만 찾는다(8장).

**문제 10.** 3등석 **남자** 승객의 평균 나이를 소수 둘째 자리까지 구하라. `loc` 로 행과 열을 한 번에 골라라.

```python
age3m = t.loc[(t['Pclass'] == 3) & (t['Sex'] == 'male'), 'Age']
print(round(age3m.mean(), 2))
```

```text
26.51
```

합성본: `29.16`

`mean()` 은 결측을 건너뛰고 평균을 낸다. 몇 명으로 낸 평균인지는 `age3m.count()` 로 함께 본다(V5 에서 다시 본다).

**문제 11.** 이름에 `Mr.` 가 들어간 승객은 몇 명인가? `str.contains` 에 `regex=False` 를 줄 때와 주지 않을 때를 비교하라.

```python
print(t['Name'].str.contains('Mr.', regex=False).sum())
print(t['Name'].str.contains('Mr.').sum())
```

```text
517
647
```

합성본: `571` · `743`

`regex=False` 를 빼면 `Mr.` 가 "Mr + 아무 글자" 로 읽혀 **`Mrs`** 까지 걸린다. 에러가 나지 않아 알아채기 어렵다. 글자 그대로 찾을 때는 `regex=False` 를 준다.

**문제 12.** 객실 번호(`Cabin`)가 **있는** 승객과 **없는** 승객의 생존율을 각각 소수 셋째 자리까지 구하라.

```python
has = t[t['Cabin'].notna()]
no = t[t['Cabin'].isna()]
print(round(has['Survived'].mean(), 3), round(no['Survived'].mean(), 3))
```

```text
0.667 0.3
```

합성본: `0.392 0.378`

원본에서는 두 생존율이 크게 다르다. 결측이 **그 자체로 정보**일 때가 있다 — 객실 번호가 남아 있는 승객은 대개 상위 등급 승객이었다. 그래서 이 열의 결측을 지우거나 아무 값으로 채우기 전에 먼저 이렇게 나눠 본다. **합성본에서는 두 값이 거의 같다** — 합성본은 결측 **개수**만 원본과 맞추고 자리는 무작위로 골랐기 때문이다. 합성 데이터로는 이런 발견을 할 수 없다는 것도 함께 기억하자.

**문제 13.** 요금이 200 이상인 승객만 꺼내 `Pclass`, `Fare`, `Survived` 세 열을 **요금이 높은 순**으로 정렬하라. 몇 명이고, 그중 생존자는 몇 명인가?

```python
rich = t.loc[t['Fare'] >= 200, ['Pclass', 'Fare', 'Survived']].sort_values('Fare', ascending=False)
print(len(rich), rich['Survived'].sum())
```

```text
20 14
```

합성본: `11 4`

행 조건과 열 목록을 `loc` 하나에 넣었다. 정렬은 꺼낸 **뒤에** 한다 — 891행 전체를 정렬할 필요가 없다(10장).

**문제 14.** 혼자 탄 승객(`SibSp` 와 `Parch` 가 모두 0)의 `Survived`, `Fare` 두 열만 꺼낸 표의 `shape` 와 생존율(소수 셋째 자리)을 구하라.

```python
alone = t.loc[(t['SibSp'] == 0) & (t['Parch'] == 0), ['Survived', 'Fare']]
print(alone.shape)
print(round(alone['Survived'].mean(), 3))
```

```text
(537, 2)
0.304
```

합성본: `(446, 2)` · `0.399`

`SibSp + Parch == 0` 으로 써도 같다. 조건 하나로 줄일 수 있으면 읽기 쉽다.

**문제 15.** ★ `t2 = t.set_index('PassengerId')` 로 인덱스를 승객 번호로 바꾼 뒤, `t2.loc[1:5]` 와 `t2.iloc[1:5]` 가 각각 **몇 행**이고 **첫 행의 승객 번호**가 무엇인지 구하라.

```python
t2 = t.set_index('PassengerId')
a = t2.loc[1:5]
b = t2.iloc[1:5]
print(len(a), a.index[0])
print(len(b), b.index[0])
```

```text
5 1
4 2
```

합성본: `5 1` · `4 2`

`loc[1:5]` 은 **승객 번호** 1~5 — 라벨 슬라이스라 끝(5)을 **포함**한다. `iloc[1:5]` 는 **위치** 1~4 — 끝을 포함하지 않고, 위치 1 은 승객 번호 2 다. 같은 `1:5` 가 다른 행을 가리킨다(5장).

### 이 문제에서 가져갈 것

- **결측은 조건에서 조용히 빠진다**(문제 4, 9, 12). 결과 행 수가 예상보다 적으면 결측부터 의심한다.
- **`loc` 과 `iloc` 은 같은 `1:5` 로 다른 행을 꺼낸다**(문제 15). 인덱스가 0, 1, 2… 일 때만 우연히 비슷해 보인다.
- **에러가 나지 않았다고 맞은 것이 아니다**(문제 11). `regex` 기본값 하나로 결과가 백 명 넘게 달라진다.
