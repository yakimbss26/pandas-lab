## 연습 문제. 타이타닉 데이터 다루기

수업에서 다룬 타이타닉 데이터로 1부 전체를 연습한다. 세트 6개 · 문항 17개와 도전 하나.
앞의 다섯 세트는 불러오기 → 골라내기 → 복사 → 요약 → 가공 순서이고, 마지막 세트는 규칙으로 생존을 예측해
대회 제출 파일을 만든다. 정답과 풀이는 책 맨 뒤 "연습 문제 정답" 에 있다.
**먼저 스스로 풀고, 답이 다르면 풀이를 보기 전에 한 번 더 의심해 보자.**

모든 문항은 아래 블록을 먼저 실행했다고 가정한다. 세트에 **준비** 블록이 있으면 그것도 먼저 실행한다.

```python
import pandas as pd
import numpy as np

t = pd.read_csv('train.csv')
t.shape
```

```text
(891, 12)
```

> **`train.csv` 가 없으면** 사이트의 합성본을 받아 같은 폴더에 두고 `read_csv` 의 파일 이름만 바꾼다:
> `t = pd.read_csv('titanic-synthetic.csv')` — 받는 곳: <https://yakimbss26.github.io/pandas-lab/data/titanic-synthetic.csv>
> 합성본은 열 이름 · 행 수 · 결측 개수가 원본과 같지만 **값은 다르고, 값 사이의 관계도 대부분 없다.**
> 그래서 정답이 두 벌이고, 합성본으로는 볼 수 없는 문항에는 따로 적어 두었다.
> `test.csv` 가 필요한 문항(1번, 마지막 세트)은 원본으로만 풀 수 있다.

### 세트 1. 불러오고 훑어보기

파일을 읽고 크기·비율·대표값을 본다(2장).

**문제 1.** `test.csv` 를 `test_df` 로 불러와 행과 열의 개수를 출력하라. `train.csv` 에는 있는데 `test.csv` 에 없는 열은 무엇인가?

> 힌트 — 두 표의 열 이름을 `set` 으로 바꾸면 빼기(`-`)로 차이를 구할 수 있다.

**문제 2.** `Pclass` 별 승객 수를 **비율(%)** 로 구하라. 소수 첫째 자리까지, 등급 순서대로.

> 힌트 — `value_counts(normalize=True)` 는 개수 대신 비율을 준다.

**문제 3.** 승객의 평균 나이(소수 둘째 자리)와 가장 비싼 요금을 각각 출력하라.

> 힌트 — `mean()`, `max()`. 평균 나이는 몇 명으로 낸 값인가?

### 세트 2. 원하는 행과 열 골라내기

불린 마스크와 `loc` 로 꺼낸다(5장).

**문제 4.** 3등석(`Pclass == 3`)이면서 생존한 승객은 몇 명인가?

> 힌트 — 조건 두 개는 `&` 로 잇고 조건마다 괄호를 친다.

**문제 5.** 요금이 100 이상인 승객의 `Name`, `Pclass`, `Fare` 만 `loc` 로 골라 앞 5행을 출력하라. 모두 몇 명인가?

> 힌트 — `t.loc[행 조건, [열 목록]]` — 쉼표 왼쪽이 행, 오른쪽이 열이다.

**문제 6.** 10세 이하 어린이의 생존율을 소수 셋째 자리까지 구하라. 전체 생존율과 비교하라.

> 힌트 — `Survived` 는 0 과 1 이라 평균이 곧 생존율이다.

### 세트 3. 뷰와 복사 — 고친 것이 반영되는가

꺼낸 표를 고칠 때의 규칙이다(7장).

**문제 7.** 1등석 승객만 골라 `first_df` 로 만들고, `first_df` 에 `Fare_KRW` 열(요금 × 1500)을 더하라. 원본 `t` 에는 이 열이 생기지 않아야 한다. 두 표에 이 열이 있는지 확인하라.

> 힌트 — 꺼낸 뒤 고칠 표라면 `.copy()` 로 **내 것**임을 분명히 한다.

**문제 8.** 아래 코드는 요금이 0 인 승객의 `Fare` 를 결측(`NaN`)으로 바꾸려는 것이다. 실행하면 무슨 일이 일어나는가? 이유를 말하고 올바르게 고쳐, 바뀐 개수를 확인하라.

```
temp_df = t.copy()
temp_df[temp_df['Fare'] == 0]['Fare'] = np.nan
```

> 힌트 — 대괄호가 두 번 이어지면 첫 번째 `[]` 가 **새 표**를 만든다. 고치는 대상은 그 새 표다.

### 세트 4. 묶어서 요약하기

`groupby` 로 묶고 여러 값을 한 번에 낸다(11장).

**문제 9.** 탑승 항구(`Embarked`)별 승객 수와 생존율(소수 셋째 자리)을 **한 표**로 만들어라.

> 힌트 — `groupby('Embarked')['Survived'].agg(['count', 'mean'])`

**문제 10.** `Pclass` 와 `Sex` 로 묶어 평균 요금(소수 둘째 자리)을 구하고, `unstack()` 으로 행 = 등급, 열 = 성별인 표로 바꿔라.

> 힌트 — `groupby([열1, 열2])` 의 결과는 인덱스가 두 층이다. `unstack()` 은 안쪽 층을 열로 올린다.

**문제 11.** 생존 여부(`Survived`)별로 나이의 평균·최솟값·최댓값을 구하라(소수 둘째 자리).

> 힌트 — `agg(['mean', 'min', 'max'])`

### 세트 5. 가공하기 — 새 열 만들기

열을 계산해 붙이고 구간으로 나누고 값을 바꾼다(9장).

**준비**

```python
def family_type(row):
    size = row['SibSp'] + row['Parch'] + 1   # 본인 포함 가족 수
    if size == 1:
        return 'Alone'
    elif size <= 4:
        return 'Small'
    else:
        return 'Large'

t['Family_type'] = t.apply(family_type, axis=1)
t['Family_type'].value_counts()
```

```text
Family_type
Alone    537
Small    292
Large     62
Name: count, dtype: int64
```

**문제 12.** `Family_type` 과 `Sex` 로 생존율 피벗 테이블(소수 둘째 자리)을 만들어라. 어떤 특징이 보이는가?

> 힌트 — `pd.pivot_table(t, index='Family_type', columns='Sex', values='Survived', aggfunc='mean')`

**문제 13.** 요금을 `pd.cut` 으로 `[0, 10, 30, 100, 600]` 구간으로 나눈 `Fare_cut` 열을 만들고, 구간별 승객 수를 구간 순서대로 출력하라(결측 포함). 요금이 0 인 승객은 어떻게 되는가?

> 힌트 — `value_counts(dropna=False).sort_index()`. 구간 `(0, 10]` 의 둥근 괄호는 무슨 뜻인가?

**문제 14.** `Embarked` 를 `{'S': 0, 'C': 1, 'Q': 2}` 로 바꾼 `Embarked_num` 열을 만들어라. 값별 개수(결측 포함)와 이 열의 dtype 을 출력하라.

> 힌트 — `map` 은 사전에 없는 값을 `NaN` 으로 만든다. 결측이 섞인 정수 열은 무엇이 되는가?

### 세트 6. 미니 프로젝트 — 규칙으로 생존 예측하기

모델 없이 **규칙**으로 예측하고, 정해진 형식의 제출 파일로 저장한다. `Title`(호칭)은 이름에서 뽑는다(V1 의 `str.extract`).

**준비**

```python
train = pd.read_csv('train.csv')
test = pd.read_csv('test.csv')

for d in (train, test):   # 두 표에 똑같이 호칭 열을 만든다
    d['Title'] = d['Name'].str.extract(r',\s*([^\.]+)\.', expand=False)

def accuracy(pred, answer):
    return (pred == answer).mean()

train['Title'].value_counts().head()
```

```text
Title
Mr        517
Miss      182
Mrs       125
Master     40
Dr          7
Name: count, dtype: int64
```

**문제 15.** "여자는 생존, 남자는 사망" 이라는 기준 규칙의 `train` 정확도를 소수 넷째 자리까지 구하라.

> 힌트 — `(train['Sex'] == 'female').astype(int)` 가 예측이다.

**문제 16.** 기준 규칙에 두 가지를 더한 `rule_v2` 의 `train` 정확도를 구하라 — ① 1·2등석 남자 어린이(`Title` 이 `Master`)는 생존 ② 요금 20 이상인 3등석 여자는 사망.

> 힌트 — 예측 Series 를 만든 뒤 `pred[조건] = 1` 처럼 조건에 맞는 칸만 덮어쓴다.

**문제 17.** `rule_v2` 를 `test` 에 적용해 `PassengerId`, `Survived` 두 열의 제출 표를 만들고 `submission.csv` 로 저장하라. 저장 전에 예시 파일과 **형식**(열 이름·행 수·결측)이 같은지, 기준 규칙과 예측이 다른 승객이 몇 명인지 확인하라.

> 힌트 — `pd.DataFrame({'PassengerId': ..., 'Survived': ...})`, `to_csv(..., index=False)`

### 도전 — 나만의 규칙

`rule_v2` 를 고쳐 `train` 정확도를 더 높여 보자. 가족 규모, 나이대, 탑승 항구, 객실 번호가 있는지 등을 쓸 수 있다.
정답은 없다. 대신 두 가지를 스스로 확인한다.

- 새 규칙마다 **몇 명의 예측이 바뀌었는지** 함께 본다. 서너 명을 맞히려고 규칙 한 줄을 더했다면 우연일 가능성이 크다.
- `train` 에만 꼭 맞춘 복잡한 규칙은 `test` 에서 오히려 틀리기 쉽다(**과적합**). 규칙은 이유를 한 문장으로 말할 수 있는 것만 남긴다.
