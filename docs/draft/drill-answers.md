## 연습 문제 정답 — 타이타닉 데이터 다루기

풀이 바로 아래 출력은 **원본 `train.csv`** 에서 실행한 결과다. 합성본으로 풀었다면 그 아래의
"합성본으로 풀었다면" 을 본다. 두 벌 모두 이 책을 만들 때 실제로 실행해서 얻은 값이다.

### 세트 1. 불러오고 훑어보기

준비 — 이 세트를 새로 시작한다(앞 세트에서 더한 열을 지운다):

```python
t = pd.read_csv('train.csv')
```

**문제 1.** `test.csv` 를 `test_df` 로 불러와 행과 열의 개수를 출력하라. `train.csv` 에는 있는데 `test.csv` 에 없는 열은 무엇인가?

```python
test_df = pd.read_csv('test.csv')
print(test_df.shape)
print(set(t.columns) - set(test_df.columns))
```

```text
(418, 11)
{'Survived'}
```

합성본으로 풀었다면: `test.csv` 를 쓰는 문항이라 원본으로만 풀 수 있다.

`test.csv` 에는 **맞혀야 할 답**(`Survived`)이 없다. 그래서 예측 대회의 문제지가 된다 — 이 연습의 마지막 세트에서 이 파일에 예측을 채운다.

**문제 2.** `Pclass` 별 승객 수를 **비율(%)** 로 구하라. 소수 첫째 자리까지, 등급 순서대로.

```python
print((t['Pclass'].value_counts(normalize=True) * 100).round(1).sort_index())
```

```text
Pclass
1    24.2
2    20.7
3    55.1
Name: proportion, dtype: float64
```

합성본으로 풀었다면:

```text
Pclass
1    22.0
2    21.1
3    56.9
Name: proportion, dtype: float64
```

`value_counts()` 는 **많은 순**으로 정렬한다. 등급 순서로 보려면 `sort_index()` 를 붙인다(10장). 결과 이름이 `proportion` 인 것도 보자 — 개수일 때는 `count` 다.

**문제 3.** 승객의 평균 나이(소수 둘째 자리)와 가장 비싼 요금을 각각 출력하라.

```python
print(round(t['Age'].mean(), 2))
print(t['Fare'].max())
print(t['Age'].count())
```

```text
29.7
512.3292
714
```

합성본으로 풀었다면:

```text
29.63
236.3879
714
```

`mean()` 은 나이가 비어 있는 승객을 **건너뛰고** 평균을 낸다. 그래서 몇 명으로 낸 평균인지 `count()` 를 함께 본다(8장).

### 세트 2. 원하는 행과 열 골라내기

준비 — 이 세트를 새로 시작한다(앞 세트에서 더한 열을 지운다):

```python
t = pd.read_csv('train.csv')
```

**문제 4.** 3등석(`Pclass == 3`)이면서 생존한 승객은 몇 명인가?

```python
print(len(t[(t['Pclass'] == 3) & (t['Survived'] == 1)]))
```

```text
119
```

합성본으로 풀었다면:

```text
191
```

괄호를 빼면 `&` 가 `==` 보다 먼저 계산되어 에러가 난다.

```python
# ✗ 괄호를 빼면 & 가 == 보다 먼저 계산된다
t[t['Pclass'] == 3 & t['Survived'] == 1]
```

```text
ValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().
```

**문제 5.** 요금이 100 이상인 승객의 `Name`, `Pclass`, `Fare` 만 `loc` 로 골라 앞 5행을 출력하라. 모두 몇 명인가?

```python
rich = t.loc[t['Fare'] >= 100, ['Name', 'Pclass', 'Fare']]
print(rich.head())
print(len(rich))
```

```text
                                        Name  Pclass      Fare
27            Fortune, Mr. Charles Alexander       1  263.0000
31   Spencer, Mrs. William Augustus (Mari...       1  146.5208
88                Fortune, Miss. Mabel Helen       1  263.0000
118                 Baxter, Mr. Quigg Edmond       1  247.5208
195                     Lurette, Miss. Elise       1  146.5208
53
```

합성본으로 풀었다면:

```text
                Name  Pclass      Fare
7     Lee, Mr. Junho       1  176.7668
12  Shin, Mr. Woojin       1  143.6775
17  Ko, Mrs. Chaewon       1  187.2942
22  Jung, Mrs. Eunbi       1  129.9195
26    Han, Mrs. Hana       1  197.2351
80
```

행 조건과 열 목록을 `loc` 하나에 넣었다. `t[t['Fare'] >= 100][[...]]` 처럼 두 번 나눠 쓰면 읽을 때는 같지만, **값을 바꿀 때** 는 연쇄 할당이 되어 반영되지 않는다(다음 세트).

**문제 6.** 10세 이하 어린이의 생존율을 소수 셋째 자리까지 구하라. 전체 생존율과 비교하라.

```python
kids = t[t['Age'] <= 10]
print(len(kids), round(kids['Survived'].mean(), 3))
print(round(t['Survived'].mean(), 3))
```

```text
64 0.594
0.384
```

합성본으로 풀었다면:

```text
51 0.255
0.382
```

> 합성본 주의 — 합성본은 나이와 생존 사이에 관계가 없어, 원본과 달리 어린이 생존율이 전체보다 높게 나오지 않는다.

나이가 비어 있는 승객은 `<= 10` 비교에서 False 가 되어 **조용히** 빠진다. 결과 인원이 예상보다 적으면 결측부터 의심한다(8장).

### 세트 3. 뷰와 복사 — 고친 것이 반영되는가

준비 — 이 세트를 새로 시작한다(앞 세트에서 더한 열을 지운다):

```python
t = pd.read_csv('train.csv')
```

**문제 7.** 1등석 승객만 골라 `first_df` 로 만들고, `first_df` 에 `Fare_KRW` 열(요금 × 1500)을 더하라. 원본 `t` 에는 이 열이 생기지 않아야 한다. 두 표에 이 열이 있는지 확인하라.

```python
first_df = t[t['Pclass'] == 1].copy()
first_df['Fare_KRW'] = first_df['Fare'] * 1500
print('Fare_KRW' in first_df.columns, 'Fare_KRW' in t.columns)
```

```text
True False
```

합성본으로 풀었다면:

```text
True False
```

pandas 3.0 에서는 Copy-on-Write 때문에 `.copy()` 가 없어도 원본은 바뀌지 않는다. 그래도 `.copy()` 를 쓰면 "이 표는 따로 고칠 것" 이라는 뜻이 코드에 남고, 옛 버전에서 뜨던 `SettingWithCopyWarning` 도 피한다(7장).

**문제 8.** 아래 코드는 요금이 0 인 승객의 `Fare` 를 결측(`NaN`)으로 바꾸려는 것이다. 실행하면 무슨 일이 일어나는가? 이유를 말하고 올바르게 고쳐, 바뀐 개수를 확인하라.

```
temp_df = t.copy()
temp_df[temp_df['Fare'] == 0]['Fare'] = np.nan
```

```python
temp_df = t.copy()
temp_df.loc[temp_df['Fare'] == 0, 'Fare'] = np.nan
print((t['Fare'] == 0).sum(), temp_df['Fare'].isna().sum())
```

```text
15 15
```

합성본으로 풀었다면:

```text
0 0
```

> 합성본 주의 — 합성본에는 요금이 0 인 승객이 없어 바뀐 개수가 0 이다 — 이 문제는 원본으로 풀어야 차이가 보인다.

문제의 코드는 **연쇄 할당**이다. 첫 `[...]` 가 만든 임시 표를 고치고 그 표는 버려진다. pandas 3.0 은 `ChainedAssignmentError` 를 띄우는데 **예외가 아니라 경고**라서 코드는 끝까지 돌고 `temp_df` 는 그대로다. 행 조건과 열을 `loc` 하나에 넣으면 원본에 바로 쓴다(7장).

```python
# ✗ 연쇄 할당 — 경고만 뜨고 temp_df 는 바뀌지 않는다
temp_df = t.copy()
temp_df[temp_df['Fare'] == 0]['Fare'] = np.nan
print(temp_df['Fare'].isna().sum())
```

```text
0
ChainedAssignmentError: A value is being set on a copy of a DataFrame or Series through chained assignment.
Such chained assignment never works to update the original DataFrame or Series, because the intermediate object on which we are setting values always behaves as a copy (due to Copy-on-Write).

Try using '.loc[row_indexer, col_indexer] = value' instead, to perform the assignment in a single step.

See the documentation for a more detailed explanation: https://pandas.pydata.org/pandas-docs/stable/user_guide/copy_on_write.html#chained-assignment
```

### 세트 4. 묶어서 요약하기

준비 — 이 세트를 새로 시작한다(앞 세트에서 더한 열을 지운다):

```python
t = pd.read_csv('train.csv')
```

**문제 9.** 탑승 항구(`Embarked`)별 승객 수와 생존율(소수 셋째 자리)을 **한 표**로 만들어라.

```python
print(t.groupby('Embarked')['Survived'].agg(['count', 'mean']).round(3))
print(t['Embarked'].isna().sum())
```

```text
          count   mean
Embarked              
C           168  0.554
Q            77  0.390
S           644  0.337
2
```

합성본으로 풀었다면:

```text
          count   mean
Embarked              
C           166  0.416
Q            87  0.391
S           636  0.369
2
```

항구가 비어 있는 승객은 `groupby` 가 기본으로 **빼고** 묶는다(`dropna=True`). 그래서 세 항구의 인원을 더해도 전체보다 적다(11장).

**문제 10.** `Pclass` 와 `Sex` 로 묶어 평균 요금(소수 둘째 자리)을 구하고, `unstack()` 으로 행 = 등급, 열 = 성별인 표로 바꿔라.

```python
print(t.groupby(['Pclass', 'Sex'])['Fare'].mean().round(2).unstack())
```

```text
Sex     female   male
Pclass               
1       106.13  67.23
2        21.97  19.74
3        16.12  12.66
```

합성본으로 풀었다면:

```text
Sex     female   male
Pclass               
1        90.06  89.81
2        20.09  21.82
3        15.46  15.31
```

같은 표를 `pd.pivot_table(t, index='Pclass', columns='Sex', values='Fare', aggfunc='mean')` 로도 만든다(V2).

**문제 11.** 생존 여부(`Survived`)별로 나이의 평균·최솟값·최댓값을 구하라(소수 둘째 자리).

```python
print(t.groupby('Survived')['Age'].agg(['mean', 'min', 'max']).round(2))
```

```text
           mean   min   max
Survived                   
0         30.63  1.00  74.0
1         28.34  0.42  80.0
```

합성본으로 풀었다면:

```text
           mean  min   max
Survived                  
0         29.13  0.5  63.4
1         30.43  0.5  70.5
```

두 집단의 평균 나이는 별로 다르지 않다. 그렇다고 "나이는 생존과 상관없다" 고 말할 수는 없다 — 문제 6 처럼 **어린이만 떼어 보면** 생존율이 뚜렷이 다르다. 평균 하나로 분포 전체를 말하지 않는다(V4 의 상자그림).

### 세트 5. 가공하기 — 새 열 만들기

준비 — 이 세트를 새로 시작한다(앞 세트에서 더한 열을 지운다):

```python
t = pd.read_csv('train.csv')

def family_type(row):
    size = row['SibSp'] + row['Parch'] + 1   # 본인 포함 가족 수
    if size == 1:
        return 'Alone'
    elif size <= 4:
        return 'Small'
    else:
        return 'Large'

t['Family_type'] = t.apply(family_type, axis=1)
```

**문제 12.** `Family_type` 과 `Sex` 로 생존율 피벗 테이블(소수 둘째 자리)을 만들어라. 어떤 특징이 보이는가?

```python
print(pd.pivot_table(t, index='Family_type', columns='Sex', values='Survived', aggfunc='mean').round(2))
```

```text
Sex          female  male
Family_type              
Alone          0.79  0.16
Large          0.27  0.03
Small          0.81  0.32
```

합성본으로 풀었다면:

```text
Sex          female  male
Family_type              
Alone          0.75  0.18
Large          0.79  0.18
Small          0.69  0.19
```

> 합성본 주의 — 합성본에는 가족 규모와 생존 사이의 관계가 없어 이 특징이 보이지 않는다.

원본에서는 **대가족(`Large`)이면 여자도 생존율이 크게 낮다** — 성별만으로는 설명되지 않는 차이다. 다만 칸마다 **몇 명**으로 낸 비율인지 `aggfunc='count'` 로 함께 보자 — 인원이 적은 칸의 비율은 크게 흔들린다(V2, V5).

**문제 13.** 요금을 `pd.cut` 으로 `[0, 10, 30, 100, 600]` 구간으로 나눈 `Fare_cut` 열을 만들고, 구간별 승객 수를 구간 순서대로 출력하라(결측 포함). 요금이 0 인 승객은 어떻게 되는가?

```python
t['Fare_cut'] = pd.cut(t['Fare'], bins=[0, 10, 30, 100, 600])
print(t['Fare_cut'].value_counts(dropna=False).sort_index())
```

```text
Fare_cut
(0.0, 10.0]       321
(10.0, 30.0]      321
(30.0, 100.0]     181
(100.0, 600.0]     53
NaN                15
Name: count, dtype: int64
```

합성본으로 풀었다면:

```text
Fare_cut
(0, 10]       214
(10, 30]      436
(30, 100]     161
(100, 600]     80
Name: count, dtype: int64
```

> 합성본 주의 — 합성본에는 요금이 0 인 승객이 없어 `NaN` 이 생기지 않는다 — 원본으로 풀어야 함정이 보인다.

`pd.cut` 의 구간은 기본으로 **왼쪽이 열려** 있다(`(0, 10]` 은 0 초과 10 이하). 그래서 요금 0 은 어느 구간에도 들지 않고 `NaN` 이 된다 — 에러 없이. `include_lowest=True` 를 주면 첫 구간이 `[0, 10]` 이 되어 0 도 들어간다.

**문제 14.** `Embarked` 를 `{'S': 0, 'C': 1, 'Q': 2}` 로 바꾼 `Embarked_num` 열을 만들어라. 값별 개수(결측 포함)와 이 열의 dtype 을 출력하라.

```python
t['Embarked_num'] = t['Embarked'].map({'S': 0, 'C': 1, 'Q': 2})
print(t['Embarked_num'].value_counts(dropna=False))
print(t['Embarked_num'].dtype)
```

```text
Embarked_num
0.0    644
1.0    168
2.0     77
NaN      2
Name: count, dtype: int64
float64
```

합성본으로 풀었다면:

```text
Embarked_num
0.0    636
1.0    166
2.0     87
NaN      2
Name: count, dtype: int64
float64
```

항구가 비어 있던 승객은 `NaN` 으로 남고, 그래서 정수가 아니라 **실수(`float64`)** 열이 된다(9장). 수업 노트북은 이 문제 앞에서 결측을 `'S'` 로 채웠기 때문에 결측이 없었다 — **같은 코드도 앞에서 무엇을 했는지에 따라 결과가 다르다**(13장).

### 세트 6. 미니 프로젝트 — 규칙으로 생존 예측하기

준비 — 이 세트를 새로 시작한다(앞 세트에서 더한 열을 지운다):

```python
t = pd.read_csv('train.csv')

train = pd.read_csv('train.csv')
test = pd.read_csv('test.csv')

for d in (train, test):   # 두 표에 똑같이 호칭 열을 만든다
    d['Title'] = d['Name'].str.extract(r',\s*([^\.]+)\.', expand=False)

def accuracy(pred, answer):
    return (pred == answer).mean()

```

**문제 15.** "여자는 생존, 남자는 사망" 이라는 기준 규칙의 `train` 정확도를 소수 넷째 자리까지 구하라.

```python
pred0 = (train['Sex'] == 'female').astype(int)
print(round(accuracy(pred0, train['Survived']), 4))
```

```text
0.7868
```

합성본으로 풀었다면: `test.csv` 를 쓰는 문항이라 원본으로만 풀 수 있다.

이 기준 규칙이 대회가 주는 예시 파일(`gender_submission.csv`)의 규칙이다. 새 규칙은 **이것보다 나아야** 의미가 있다.

**문제 16.** 기준 규칙에 두 가지를 더한 `rule_v2` 의 `train` 정확도를 구하라 — ① 1·2등석 남자 어린이(`Title` 이 `Master`)는 생존 ② 요금 20 이상인 3등석 여자는 사망.

```python
def rule_v2(d):
    pred = (d['Sex'] == 'female').astype(int)
    pred[(d['Title'] == 'Master') & (d['Pclass'] < 3)] = 1
    pred[(d['Sex'] == 'female') & (d['Pclass'] == 3) & (d['Fare'] >= 20)] = 0
    return pred

print(round(accuracy(rule_v2(train), train['Survived']), 4))
```

```text
0.8215
```

합성본으로 풀었다면: `test.csv` 를 쓰는 문항이라 원본으로만 풀 수 있다.

`pred` 는 함수 안에서 새로 만든 Series 라 `pred[조건] = 값` 이 그대로 반영된다(연쇄 할당이 아니다). 규칙 ② 는 "요금이 높은 3등석 여자 = 대가족" 이라는 관찰에서 왔다 — 세트 5 의 가족 규모 표와 이어 보자.

**문제 17.** `rule_v2` 를 `test` 에 적용해 `PassengerId`, `Survived` 두 열의 제출 표를 만들고 `submission.csv` 로 저장하라. 저장 전에 예시 파일과 **형식**(열 이름·행 수·결측)이 같은지, 기준 규칙과 예측이 다른 승객이 몇 명인지 확인하라.

```python
submission = pd.DataFrame({'PassengerId': test['PassengerId'], 'Survived': rule_v2(test)})
sample = pd.read_csv('gender_submission.csv')

print(list(submission.columns) == list(sample.columns))
print(len(submission) == len(sample))
print(submission.isna().sum().sum() == 0)
print((submission['Survived'] != sample['Survived']).sum())
submission.to_csv('submission.csv', index=False)
```

```text
True
True
True
15
```

합성본으로 풀었다면: `test.csv` 를 쓰는 문항이라 원본으로만 풀 수 있다.

`index=False` 를 빼면 인덱스가 첫 열로 저장되어 **형식이 틀린 파일**이 된다. 제출 전에 이렇게 형식을 코드로 점검하는 습관을 들이자.

### 이 연습에서 가져갈 것

- **결측은 조건·평균·묶기에서 조용히 빠진다**(문제 3, 6, 9). 결과 인원이 예상과 다르면 결측부터 센다.
- **고친 것이 반영됐는지 확인한다**(문제 8). 연쇄 할당은 예외가 아니라 경고라서 코드가 끝까지 돈다.
- **같은 코드도 앞에서 무엇을 했는지에 따라 결과가 다르다**(문제 14). 셀을 위에서부터 다시 실행해 본다(13장).
- **합성 데이터는 모양만 같다**(합성본 주의). 관계를 찾는 분석은 진짜 데이터로 한다.
