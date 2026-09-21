## V3장. matplotlib — 그림의 구조

> 숫자 112개를 표로 늘어놓으면 아무도 끝까지 읽지 않지만, 선 하나로 그리면 한눈에 들어온다.
> 이 장을 읽으면 matplotlib으로 다섯 가지 기본 그래프를 그리고, `Figure`와 `Axes`가 무엇을
> 가리키는지 구분하고, "분명히 코드는 그대로인데 그림이 이상하게 나온다"는 상황 두 가지를
> 직접 겪어 보고 원인을 짚을 수 있다.

### V3.1 문제 제기 — 표로는 안 보이는 것

서울의 연도별 평균기온 자료(`seoul_temp.csv`, 기상청 기상자료개방포털, 공공누리 제1유형)는
112개 행뿐이라 표로 봐도 못 볼 정도는 아니다. 그래도 "기온이 올라가는 추세인가"라는 질문에는
표보다 그림이 훨씬 빨리 답한다.

```python
import pandas as pd
pd.set_option('display.max_columns', 30)
pd.set_option('display.width', 200)
pd.set_option('display.max_colwidth', 40)

import matplotlib.pyplot as plt
plt.rc('font', family='Malgun Gothic')     # 맥은 'AppleGothic'
plt.rc('axes', unicode_minus=False)

data = pd.read_csv('seoul_temp.csv', encoding='cp949')
data.shape
# (112, 5)
```

```python
data.head()
```

```text
      년   지점  평균기온  최저기온  최고기온
0  1907  108   NaN -20.1  25.4
1  1908  108  10.4 -15.8  33.6
2  1909  108  10.6 -14.6  35.6
3  1910  108  10.3 -19.9  33.3
4  1911  108  10.6 -21.5  34.5
```

112행을 위에서 아래로 읽으며 기온이 올라가는지 판단하기는 어렵다. 그런데 `평균기온` 열
하나를 선 하나로 그리면 얘기가 다르다.

```python
# 그림: v3-hook-line
plt.plot(data['년'], data['평균기온'])
plt.show()
```

![연도별 평균기온을 선 하나로 그리면 오르내림과 전체 추세가 한눈에 보인다](docs/fig/v3-hook-line.png)

숫자 하나하나는 여전히 표에 있는 그 값이다. 달라진 것은 표현 방식뿐인데, "전체적으로 올라가고
있다"는 판단은 그림이 훨씬 빠르다. 이 장은 이런 그림을 **의도한 대로** 그리는 법을 다룬다 —
matplotlib은 그림의 아주 작은 부분까지 코드로 지정할 수 있는 대신, 지정을 빠뜨리거나 잘못하면
그린 사람도 모르게 다른 그림이 나온다.

### V3.2 한글이 깨지지 않게 — 글꼴 두 줄

위 코드에 이미 넣어 둔 두 줄을 짚고 넘어간다.

```python
plt.rc('font', family='Malgun Gothic')
plt.rc('axes', unicode_minus=False)
```

첫 줄이 없으면 한글 라벨이 네모(`□`)로 깨진다. 윈도우에는 맑은 고딕(Malgun Gothic)이 기본
설치돼 있어 이 한 줄이면 충분하다(맥은 `AppleGothic`).

둘째 줄은 별개의 문제를 고친다. 맑은 고딕에는 음수 기호로 쓰는 유니코드 마이너스(`−`,
U+2212) 글리프가 없어서, 이 줄이 없으면 축 눈금에 음수가 있을 때마다 다음 경고가 뜬다.

```text
UserWarning: Glyph 8722 (\N{MINUS SIGN}) missing from font(s) Malgun Gothic.
```

`unicode_minus=False`를 주면 matplotlib이 유니코드 마이너스 대신 일반 하이픈(`-`)을 써서
경고 없이 넘어간다. 이 두 줄은 **그림을 그리는 모든 장(V3~V6)의 첫 블록**에 넣는다.

### V3.3 그래프 다섯 가지 — 무엇을 보여 주려고 고르는가

matplotlib에는 그래프 종류가 훨씬 많지만, 대부분의 질문은 다섯 가지로 답할 수 있다. 아래
값은 그래프 종류의 쓰임을 보여 주기 위해 만든 예시 값이다(실제 조사 결과가 아니다).

**변화를 본다 — `plot`.** 시간처럼 순서가 있는 값을 잇는다.

```python
# 그림: v3-plot-line
걸음수 = [8200, 10500, 6300, 12000, 9100]
요일 = ['월', '화', '수', '목', '금']
plt.plot(요일, 걸음수, marker='o')
plt.title('요일별 걸음 수 (예시)')
plt.show()
```

![다섯 요일의 값을 선으로 이으면 늘고 주는 흐름이 보인다](docs/fig/v3-plot-line.png)

**크기를 비교한다 — `bar` / `barh`.** 범주별 값의 크기를 비교한다. 이름이 길면 가로 막대
(`barh`)가 읽기 편하다.

```python
# 그림: v3-bar
반평균 = [72, 85, 90, 68, 77]
반이름 = ['1반', '2반', '3반', '4반', '5반']
plt.bar(반이름, 반평균)
plt.title('반별 평균 점수 (예시)')
plt.show()
```

![다섯 반의 평균 점수를 세로 막대로 비교한다](docs/fig/v3-bar.png)

```python
# 그림: v3-barh
plt.barh(반이름, 반평균)
plt.title('반별 평균 점수 — 가로 막대 (예시)')
plt.show()
```

![같은 값을 가로 막대로 그리면 범주 이름이 길어도 읽기 편하다](docs/fig/v3-barh.png)

**관계를 본다 — `scatter`.** 두 값이 함께 움직이는지 점으로 흩뿌린다.

```python
# 그림: v3-scatter
공부시간 = [1, 3, 2, 5, 4]
점수 = [65, 75, 70, 92, 88]
plt.scatter(공부시간, 점수)
plt.xlabel('공부 시간(시간)')
plt.ylabel('점수(예시)')
plt.show()
```

![공부 시간이 늘수록 점수도 대체로 늘어나는 것이 점의 배치로 보인다](docs/fig/v3-scatter.png)

**분포를 본다 — `hist`.** 값을 구간으로 나눠 몇 개씩 있는지 센다.

```python
# 그림: v3-hist
반점수 = [55, 62, 63, 67, 70, 71, 72, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 85, 88, 92]
plt.hist(반점수, bins=5)
plt.xlabel('점수(예시)')
plt.ylabel('학생 수')
plt.show()
```

![20명의 점수를 5개 구간으로 나눠 세면 가운데 구간에 학생이 몰려 있다](docs/fig/v3-hist.png)

**분포를 요약해서 본다 — `boxplot`.** 히스토그램과 같은 자료를 다섯 수치(최솟값·1사분위·
중앙값·3사분위·최댓값)로 요약한다. 상자 하나로 분포를 압축해서 보여 준다(자세한 읽는 법은
V4.7에서 seaborn으로 다시 다룬다).

```python
# 그림: v3-box
plt.boxplot(반점수)
plt.ylabel('점수(예시)')
plt.show()
```

![같은 20명의 점수를 상자그림으로 요약하면 중앙값과 흩어진 정도가 한 번에 보인다](docs/fig/v3-box.png)

히스토그램은 값이 어떻게 흩어져 있는지 **모양**을 보여 주고, 상자그림은 그 모양을 **숫자 다섯
개**로 압축한다. 여러 반을 한 그림에서 비교하려면 반마다 히스토그램을 그리는 것보다 상자그림을
나란히 놓는 쪽이 훨씬 읽기 쉽다 — 이 비교는 V4에서 실제 데이터로 다시 해 본다.

### V3.4 파이는 언제 쓰나

파이 차트는 **전체에서 차지하는 비율**을 보여 줄 때만 쓴다. 조각이 6개를 넘거나 값이
비슷비슷하면 각도 차이를 눈으로 구분하기 어려워 막대가 낫다.

```python
활동 = ['수면', '학교', '자율학습', '취미', '기타']
시간 = [8, 7, 3, 2, 4]
sum(시간)
# 24
```

```python
# 그림: v3-pie
plt.pie(시간, labels=활동, autopct='%.1f%%')
plt.title('하루 24시간의 쓰임 (예시)')
plt.show()
```

![다섯 조각의 합이 24시간 전체가 되므로 파이 차트가 어울린다](docs/fig/v3-pie.png)

조각 5개, 값도 뚜렷이 다르니 파이가 맞는 선택이다. 만약 조각이 12개(월별 강수량 비율 같은)
거나 두 조각이 24.1%와 24.3%처럼 비슷하다면, 파이 대신 막대로 바꿔야 차이가 보인다.

### V3.5 그림의 해부도 — `Figure`와 `Axes`

matplotlib이 그리는 그림에는 이름 붙은 부분이 있다. 이번에는 실제 데이터로 세 계열(최저·
평균·최고기온)을 한 그림에 겹쳐 그리면서 각 부분을 짚는다. 계열이 둘 이상이면 범례가
필요하고, 색은 웹앱과 같은 역할로 고정한다 — **최저=파랑, 최고=주황, 평균=초록**.

```python
# 그림: v3-anatomy
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(data['년'], data['최저기온'], color='tab:blue', label='최저기온')
ax.plot(data['년'], data['평균기온'], color='tab:green', label='평균기온')
ax.plot(data['년'], data['최고기온'], color='tab:orange', label='최고기온')
ax.set_title('서울 연도별 기온')     # 제목
ax.set_xlabel('년')                  # 축 이름(가로)
ax.set_ylabel('기온(℃)')             # 축 이름(세로)
ax.set_xlim(1900, 2020)              # 범위
ax.legend()                          # 범례
ax.grid(True, alpha=0.3)             # 격자
plt.show()
```

![최저·평균·최고기온 세 선을 겹쳐 그리고 제목·축 이름·범례·격자를 모두 붙였다](docs/fig/v3-anatomy.png)

이 그림에서 이름 붙은 부분:

- **`Figure`** — `fig`. 그림 전체, 종이 한 장에 해당한다.
- **`Axes`** — `ax`. 실제로 선이 그려지는 좌표 평면 하나. 그림(`Figure`) 안에 `Axes`가 여러
  개 들어갈 수 있다(V3.8에서 본다).
- **제목** — `ax.set_title(...)`. **축 이름** — `set_xlabel` / `set_ylabel`.
- **범례** — `ax.legend()`. 계열이 둘 이상이면 `label=`을 주고 반드시 붙인다.
- **격자** — `ax.grid(...)`. 값을 정확히 읽는 데 도움을 준다.
- **눈금·범위** — 자동으로 정해지지만 `set_xlim`처럼 직접 지정할 수 있다.

`plt.plot(...)`처럼 `ax` 없이 바로 부르는 방식(V3.3에서 썼다)은 matplotlib이 "현재 그림의
현재 축"에 자동으로 그리는 것이고, `fig, ax = plt.subplots()`는 그 그림과 축을 **이름을 붙여
직접 들고 있는** 방식이다. 다음 두 절이 왜 이름을 붙여 들고 있는 쪽이 안전한지 보여 준다.

### V3.6 ⚠ `plt.figure()`를 두 번 부르면 그림이 두 장 생긴다

옵션을 나눠서 주려다 그림을 두 장 만드는 실수가 흔하다.

```python
# ⚠ 그림이 두 장 생긴다 — 크기를 준 첫 그림은 빈 채로 남는다 (부록 시각화 D-1)
plt.figure(figsize=(20, 3))
plt.figure(dpi=300)
plt.plot([1, 2, 3], [4, 5, 6])
print(plt.get_fignums())
print([plt.figure(n).get_size_inches().tolist() for n in plt.get_fignums()])
```

```text
[1, 2]
[[20.0, 3.0], [6.4, 4.8]]
```

`plt.figure()`는 부를 때마다 **새 그림**을 만든다. 첫 줄이 그림 1번(가로 20인치, 세로
3인치)을 만들고, 둘째 줄이 그림 2번(matplotlib 기본 크기 6.4×4.8인치)을 **새로** 만든다.
그 뒤의 `plt.plot(...)`은 "현재 그림"인 2번에 그려지므로, 크기를 준 1번 그림은 끝까지 텅
비어 있다. 에러도 경고도 없다 — 그림 두 장을 실제로 열어 보지 않으면 알아채기 어렵다.

```python
# 그림: v3-figure-duplicate
plt.figure(figsize=(20, 3))
plt.figure(dpi=300)
plt.plot([1, 2, 3], [4, 5, 6])
plt.show()
```

![빈 그림 한 장과 선 하나짜리 작은 그림 한 장, 총 두 장이 만들어진다](docs/fig/v3-figure-duplicate-1.png)
![두 번째 plt.figure() 호출이 만든 그림에 선이 그려졌다](docs/fig/v3-figure-duplicate-2.png)

바르게 쓰려면 옵션을 **한 번에** 준다.

```python
# 그림: v3-figure-single
plt.figure(figsize=(20, 3), dpi=300)
plt.plot([1, 2, 3], [4, 5, 6])
plt.show()
```

![옵션을 한 번에 주면 그림이 한 장만 생기고 선도 그 안에 그려진다](docs/fig/v3-figure-single.png)

### V3.7 `plt.figure(3, ...)`의 `3`은 무엇인가

`plt.figure()`의 첫 번째 자리 인자를 "하위 그래프 개수"로 착각하기 쉽지만, 이 값은
**그림 번호(`num`)**다.

```python
# ⚠ 3은 하위 그래프 개수가 아니라 그림 번호다. 빈 그림 하나가 생긴다 (부록 시각화 A-3)
plt.figure(3, figsize=(15, 5))
len(plt.gcf().axes)
# 0
```

```python
# 그림: v3-figure-num
plt.figure(3, figsize=(15, 5))
plt.show()
```

![숫자 3을 그림 번호로 받아 빈 그림 하나가 생긴다 — 축이 하나도 없다](docs/fig/v3-figure-num.png)

`plt.gcf().axes`가 빈 리스트라는 것은 이 그림 안에 좌표 평면이 하나도 없다는 뜻이다. 하위
그래프(subplot) 여러 개를 한 그림에 넣고 싶다면 `plt.figure`가 아니라 다음 절의
`plt.subplots`를 쓴다.

### V3.8 `fig, ax = plt.subplots()` — 그림과 축을 한 번에 이름으로 잡기

`subplots(행, 열)`은 그림 하나와 축 여러 개를 **한 번에** 만들어 배열로 돌려준다. 세 기온
열을 나란히 놓고 `sharey=True`로 세로축 범위를 맞추면 세 그래프의 높낮이를 그대로 비교할 수
있다.

```python
# 그림: v3-subplots-temp
fig, axes = plt.subplots(1, 3, figsize=(12, 3.5), sharey=True)
axes[0].plot(data['년'], data['최저기온'], color='tab:blue')
axes[0].set_title('최저기온')
axes[1].plot(data['년'], data['평균기온'], color='tab:green')
axes[1].set_title('평균기온')
axes[2].plot(data['년'], data['최고기온'], color='tab:orange')
axes[2].set_title('최고기온')
plt.show()
```

![sharey=True로 세 그래프의 세로축을 맞추면 최저·평균·최고의 높이 차이가 그대로 비교된다](docs/fig/v3-subplots-temp.png)

`axes`는 `Axes` 객체 3개짜리 배열이다. `axes[0]`, `axes[1]`, `axes[2]`가 각각 하나의 좌표
평면이고, `fig` 하나가 이 셋을 담는 그림 전체다. `sharey=True`가 없으면 matplotlib이 각
축의 범위를 따로 정해서, 실제로는 최저기온의 변동폭이 더 큰데도 세 그래프가 비슷해 보일 수
있다.

### V3.9 점이 몇 개면 곡선인가

수학 함수를 그릴 때 점을 몇 개 찍느냐가 그래프의 모양을 바꾼다. 반복문으로 점 13개를 찍은
것과, `np.linspace`로 점 1000개를 찍은 것을 나란히 비교한다.

```python
# 그림: v3-linspace-loop
import math
import numpy as np

fig, axes = plt.subplots(1, 2, figsize=(10, 3.5), sharey=True)

xs_loop = list(range(13))
ys_loop = [math.sin(x) for x in xs_loop]
axes[0].plot(xs_loop, ys_loop, marker='o')
axes[0].set_title('반복문 — 점 13개')

xs_dense = np.linspace(0, 12, 1000)
ys_dense = np.sin(xs_dense)
axes[1].plot(xs_dense, ys_dense)
axes[1].set_title('np.linspace — 점 1000개')
plt.show()
```

![같은 sin 함수인데 점이 13개면 각지고 1000개면 매끄러운 곡선이 된다](docs/fig/v3-linspace-loop.png)

왼쪽은 점과 점 사이를 직선으로 이어서 각져 보이고, 오른쪽은 점 간격이 좁아 곡선처럼 보인다.
matplotlib은 **점을 직선으로 잇는 도구**이지 곡선을 그리는 도구가 아니다 — 곡선처럼 보이게
하려면 점을 촘촘히 찍어야 한다.

### V3.10 ✗ 점 크기에 음수가 섞이면

산점도에서 점 크기(`s=`)로 세 번째 값을 표현할 때, 그 값에 음수가 섞이면 어떻게 될까.
시드를 고정해 재현 가능한 예시를 만든다.

```python
np.random.seed(0)
x = np.random.rand(100)
y = np.random.rand(100)
크기 = np.random.randint(-200, 200, 100)
(크기 < 0).sum()
# 50
```

```python
# ✗ 크기가 음수인 점은 그려지지 않는다. RuntimeWarning만 뜨고 원인은 짐작하기 어렵다 (부록 시각화 D-5)
plt.scatter(x, y, s=크기)
```

```text
RuntimeWarning: invalid value encountered in sqrt
```

matplotlib은 점 크기를 정할 때 넓이의 제곱근을 쓰는데, 음수의 제곱근은 정의되지 않아
`nan`이 되고 그 점은 화면에 그려지지 않는다. 100개 중 50개가 음수였으니 절반이 사라진
셈이다.

```python
# 그림: v3-negative-size
# ✗ 같은 경고가 다시 뜬다. 화면에서 절반이 사라진 모습을 직접 본다
plt.scatter(x, y, s=크기)
plt.title('점 크기에 음수가 섞인 산점도 — 절반이 사라졌다')
plt.show()
```

![음수 크기를 받은 점 50개가 그려지지 않아 화면에는 점이 절반만 보인다](docs/fig/v3-negative-size.png)

경고 메시지에 "크기"나 "음수"라는 말이 없어서, 코드를 짠 사람이 아니면 원인을 찾기 어렵다.
크기로 쓸 값이 음수를 가질 수 있다면(예: 증감량) 절댓값을 쓰거나 별도로 색으로 부호를 표현
한다.

### V3.11 pandas에서 바로 그리기 — `df.plot()`

`DataFrame`과 `Series`에는 `.plot()` 메서드가 있어 matplotlib을 따로 불러오지 않고도 그릴 수
있다. 반환값은 `Axes`라서, 만든 뒤에 이어서 꾸밀 수 있다.

```python
# 그림: v3-pandas-plot-line
ax = data.plot(x='년', y='평균기온', figsize=(9, 3.5), color='tab:green', legend=False)
ax.set_ylabel('평균기온(℃)')
plt.show()
```

![df.plot(kind='line')이 기본값이라 연도별 추세선이 바로 그려진다](docs/fig/v3-pandas-plot-line.png)

`kind=` 옵션으로 그래프 종류를 바꾼다. 최근 10개 행만 골라 막대로 그려 본다.

```python
# 그림: v3-pandas-plot-bar
최근10 = data.tail(10)
ax = 최근10.plot(x='년', y='평균기온', kind='bar', figsize=(8, 3.5),
                 color='tab:blue', legend=False)
ax.set_ylabel('평균기온(℃)')
plt.show()
```

![최근 10개 연도의 평균기온을 막대로 비교한다](docs/fig/v3-pandas-plot-bar.png)

`data.plot(x='년', y='평균기온')`은 결국 `plt.plot(data['년'], data['평균기온'])`을 대신
불러 주는 것뿐이다. 다만 `x=`, `y=`를 열 이름으로 바로 받을 수 있어 코드가 짧아진다.

### V3.12 그림을 저장한다 — `savefig`

화면에 띄우는 대신(또는 띄운 것과 별개로) 파일로 저장하려면 `Figure` 객체의 `savefig`를
쓴다. `dpi`는 해상도, `bbox_inches='tight'`는 여백을 잘라내 준다.

```python
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(data['년'], data['평균기온'], color='tab:green')
ax.set_title('서울 연도별 평균기온')
fig.savefig('seoul_temp_trend.png', dpi=150, bbox_inches='tight')
```

`plt.savefig(...)`처럼 `plt` 모듈에서 바로 불러도 되지만, `fig.savefig(...)`처럼 `Figure`
객체에서 부르면 **어느 그림을 저장하는지가 명확하다** — 그림이 여러 장 열려 있을 때(V3.6에서
본 실수를 떠올려 보자) 이 차이가 중요해진다.

### V3.13 흔한 실수

- **`plt.figure()`를 옵션 나눠서 두 번 부른다.** 그림이 두 장 생기고, 앞 그림은 빈 채로
  남는다(V3.6). 옵션은 한 번에 준다.
- **`plt.figure(숫자, ...)`의 숫자를 하위 그래프 개수로 착각한다.** 이 숫자는 그림 번호다
  (V3.7). 하위 그래프는 `plt.subplots(행, 열)`로 만든다.
- **`plt.show()` 없이 다음 그림을 이어서 그린다.** 파이썬 스크립트에서는 앞 그림에 선이 계속
  누적된다(주피터는 칸이 끝나면 자동으로 갈무리하지만, `.py` 파일은 그렇지 않다). 그림 하나가
  끝났으면 `plt.show()`나 `plt.close()`로 마무리한다.
- **점 크기·색처럼 값으로 매핑하는 자리에 음수가 섞일 수 있는 값을 그대로 넣는다.** 에러 없이
  일부가 사라진다(V3.10). 매핑 전에 범위를 확인한다.

### 확인 문제

**문제 V3-1.** 6개 조각으로 나뉜 설문 결과가 있는데 각 조각이 15%, 17%, 16%, 18%, 17%, 17%로
비슷하다. 파이 차트와 막대 그래프 중 어느 쪽이 나은가?

<details><summary>답</summary>

막대 그래프다. 파이 차트는 조각의 **각도** 차이로 크기를 비교하는데, 15%와 18%의 각도 차이는
아주 작아서 눈으로 구분하기 어렵다. 막대는 높이로 비교하므로 3%포인트 차이도 뚜렷이 보인다.
조각 수가 많거나(V3.4에서는 6개 이하를 기준으로 들었다) 값이 비슷할 때는 막대가 낫다.

</details>

**문제 V3-2.** 다음 코드를 실행하면 그림이 몇 장 생기는가? 그리고 실제로 선이 그려지는 그림은
몇 번인가?

```text
plt.figure(figsize=(20, 3))
plt.figure(dpi=300)
plt.plot([1, 2, 3], [4, 5, 6])
```

<details><summary>답</summary>

두 장이다(1번, 2번). `plt.figure()`는 부를 때마다 새 그림을 만들고 그 그림을 "현재 그림"으로
만든다. 첫 줄이 1번 그림을, 둘째 줄이 2번 그림을 만들고 2번이 현재 그림이 되므로, 그 뒤의
`plt.plot(...)`은 2번 그림에 그려진다. 1번 그림은 크기(20×3인치)만 가진 채 끝까지 비어
있다(V3.6).

</details>

**문제 V3-3.** `plt.figure(5, figsize=(10, 4))`를 실행한 뒤 `len(plt.gcf().axes)`는 얼마인가?

<details><summary>답</summary>

0이다. 첫 번째 자리의 `5`는 하위 그래프 개수가 아니라 그림 번호이므로, 이 코드는 번호가 5번인
빈 그림 하나를 만들 뿐 축(Axes)은 하나도 만들지 않는다. 하위 그래프가 필요하면
`plt.subplots(행, 열)`을 쓴다(V3.7).

</details>

**문제 V3-4.** `np.random.randint(-200, 200, 100)`으로 만든 값을 산점도의 점 크기(`s=`)로
쓰면, 100개 점 중 몇 개가 화면에 안 보이는가? 왜인가?

<details><summary>답</summary>

값이 음수인 개수만큼 안 보인다(V3.10의 예시에서는 시드를 고정해 50개였다). matplotlib이 점
크기를 계산할 때 넓이의 제곱근을 쓰는데, 음수의 제곱근은 정의되지 않아 `nan`이 되고 `nan`
크기인 점은 그려지지 않기 때문이다. 에러 없이 `RuntimeWarning: invalid value encountered in
sqrt`만 뜬다.

</details>

### 🧪 실습실

> 웹앱 **V3**에서 "그림 해부도"로 제목·축 이름·범례·격자·범위를 하나씩 켜고 끄며 각 부분을
> 만드는 코드 한 줄을 확인해 보라. "점 간격 슬라이더"로 sin 곡선의 점 개수를 직접 늘려 가며
> 언제부터 매끄러운 곡선처럼 보이는지 찾아보라. "현재 그림은 어느 것인가"로 `plt.figure()`를
> 여러 번 부를 때마다 화살표가 어느 그림으로 옮겨 가는지 단계별로 따라가 보라.

---

## V4장. seaborn — 요약해서 그리기

> matplotlib이 점 하나하나의 위치를 직접 지정하는 도구라면, seaborn은 "이 표에서 이 열과 이
> 열의 관계를 보여 줘"라고 말하면 평균과 집계, 색 구분까지 알아서 해 주는 도구다. 이 장을
> 읽으면 seaborn에 표를 건네는 법을 익히고, **막대 하나가 실제로는 수백 개의 행을 요약한
> 것**이라는 사실을 데이터로 직접 확인하고, 셀 것과 나눌 것을 구분해서 쓸 수 있다.

### V4.1 문제 제기 — seaborn은 표를 받는다

matplotlib에서는 `plt.bar(반이름, 반평균)`처럼 x값과 y값을 각각 리스트로 넘겼다. seaborn은
다르다. **표(`DataFrame`) 하나와, 그 표의 열 이름**을 넘긴다.

이 장에서는 서울 일별 기온(`seoul_temp_day.csv`, 기상청 기상자료개방포털, 공공누리 제1유형)을
쓴다. V1의 정리 과정(탭 제거 → 빈 행 제거 → `pd.to_datetime` → `년`/`월` 열)을 다시 한다.

```python
import pandas as pd
pd.set_option('display.max_columns', 30)
pd.set_option('display.width', 200)
pd.set_option('display.max_colwidth', 40)

import matplotlib.pyplot as plt
plt.rc('font', family='Malgun Gothic')
plt.rc('axes', unicode_minus=False)
import seaborn as sns

df = pd.read_csv('seoul_temp_day.csv', encoding='cp949')
df['날짜'] = df['날짜'].str.replace('\t', '', regex=False)
df = df[df['날짜'] != ''].copy()
df['날짜'] = pd.to_datetime(df['날짜'])
df['년'] = df['날짜'].dt.year
df['월'] = df['날짜'].dt.month
df.shape
# (42396, 7)
```

seaborn 함수는 대부분 `data=`, `x=`, `y=`를 **이름으로** 받는다.

```python
# 그림: v4-basic-scatter
sns.scatterplot(data=df, x='최저기온', y='최고기온')
plt.show()
```

![data=, x=, y=를 이름으로 넘기면 열 이름 그대로 축 이름이 붙는다](docs/fig/v4-basic-scatter.png)

축 이름이 자동으로 `최저기온`, `최고기온`이 된 것도 눈여겨보자 — matplotlib이었다면
`plt.xlabel(...)`을 직접 불러야 했다. 표를 넘기면 이런 것들을 seaborn이 대신 해 준다.

옛날식으로 위치 인자만 넘기면 seaborn 0.12부터 에러가 난다.

```python
# ✗ x, y는 위치 인자로 받지 않는다 (부록 시각화 C-7)
sns.boxplot(df['최저기온'], df['최고기온'])
```

```text
TypeError: boxplot() takes from 0 to 1 positional arguments but 2 were given
```

**이 장부터는 언제나 `data=, x=, y=`를 이름으로 준다.**

### V4.2 ★ barplot — 막대 하나 뒤의 행들

seaborn의 막대그래프는 matplotlib의 막대그래프와 근본적으로 다르다. `plt.bar`는 준 값을
그대로 막대 높이로 쓰지만, `sns.barplot`은 **같은 x값을 가진 행을 모두 모아 평균을 낸 뒤** 그
평균을 막대 높이로 그린다. 최근 5개 연도로 확인해 보자.

```python
recent = df[df['년'] >= 2020]
recent.groupby('년')['평균기온'].agg(평균='mean', 날수='count')
```

```text
             평균   날수
년                   
2020  13.271858  366
2021  13.752055  365
2022  13.296164  365
2023  14.109041  365
2024  14.875410  366
```

2020년 막대 하나는 평균기온 하나가 아니라 **이 366개의 값을 평균 낸 결과**다. 실제로
`sns.barplot`이 그리는 막대 높이가 이 표의 `평균` 열과 같은지 그림으로 확인한다.

```python
# 그림: v4-barplot-years
sns.barplot(data=recent, x='년', y='평균기온')
plt.ylabel('평균기온(℃)')
plt.show()
```

![다섯 개 연도의 평균기온 막대 — 검은 선(신뢰구간)의 길이는 실행마다 조금씩 다르다](docs/fig/v4-barplot-years.png)

막대 높이는 방금 `groupby`로 구한 `평균` 열의 값과 정확히 같다(2020년 막대는 13.271858).
막대 위의 검은 세로선은 **95% 신뢰구간**이고, 부트스트랩(재표본추출)으로 구하기 때문에
**이 코드를 다시 실행하면 선의 길이가 조금씩 달라진다** — 그래서 이 값은 숫자로 싣지 않는다.
막대 높이(평균)는 실행할 때마다 정확히 같다는 점과 대조된다.

**막대 하나 뒤에 몇 개의 행이 있는지**를 직접 겹쳐서 보면 이 사실이 더 분명해진다. 2020년
한 해의 막대 뒤에 그해 366일의 실제 값을 점으로 겹친다.

```python
# 그림: v4-barplot-behind
year2020 = df[df['년'] == 2020].copy()
year2020['x'] = ''
fig, ax = plt.subplots(figsize=(4, 5))
sns.barplot(data=year2020, x='x', y='평균기온', color='tab:blue', ax=ax)
sns.stripplot(data=year2020, x='x', y='평균기온', color='black', alpha=0.3, size=3, ax=ax)
ax.set_xlabel('2020년')
plt.show()
```

![파란 막대 하나가 실제로는 검은 점 366개(그해 하루하루의 평균기온)를 평균 낸 것이다](docs/fig/v4-barplot-behind.png)

막대는 하나지만 그 뒤에는 366개의 점(행)이 흩어져 있다. **막대그래프를 볼 때는 항상 "이 막대
하나가 몇 개의 행을 요약한 것인가"를 먼저 확인한다** — 뒤에 5개가 있는 평균과 500개가 있는
평균은 신뢰도가 다르다.

### V4.3 신뢰구간 옵션의 이름이 바뀌었다 — `ci` → `errorbar`

원본 자료가 쓰던 `ci=` 옵션은 지금 버전에서 경고가 뜬다.

```python
# ✗ ci 는 없어지는 중이다. errorbar 를 쓰라는 경고가 뜬다 (부록 시각화 C-5)
sns.barplot(data=recent, x='년', y='평균기온', ci='sd')
```

```text
FutureWarning: The `ci` parameter is deprecated. Use `errorbar='sd'` for the same effect.
```

지금은 `errorbar=`를 쓴다. 기본값은 95% 신뢰구간, `'sd'`는 표준편차, `None`은 아예 생략이다.
표준편차와 생략은 부트스트랩을 쓰지 않아 **실행마다 결과가 같다.**

```python
# 그림: v4-barplot-errorbar-compare
fig, axes = plt.subplots(1, 2, figsize=(10, 3.5), sharey=True)
sns.barplot(data=recent, x='년', y='평균기온', errorbar='sd', ax=axes[0])
axes[0].set_title("errorbar='sd' (표준편차)")
sns.barplot(data=recent, x='년', y='평균기온', errorbar=None, ax=axes[1])
axes[1].set_title('errorbar=None (표시 안 함)')
plt.show()
```

![왼쪽은 표준편차만큼의 선이, 오른쪽은 선 없이 막대만 그려진다 — 둘 다 실행마다 같은 그림이다](docs/fig/v4-barplot-errorbar-compare.png)

색을 범주마다 다르게 칠하고 싶을 때 `hue`를 지정하지 않고 `palette`만 주는 것도 지금은
경고 대상이다.

```python
# ✗ hue 를 주지 않고 palette 만 주면 경고가 뜬다 (부록 시각화 C-6)
sns.barplot(data=recent, x='년', y='평균기온', palette='dark')
```

```text
FutureWarning: Passing `palette` without assigning `hue` is deprecated and will be removed in v0.14.0. Assign the `x` variable to `hue` and set `legend=False` for the same effect.
```

막대마다 다른 색을 칠하는 것 자체가 문제이기도 하다 — 이 색은 **연도라는 뜻을 전혀 담고
있지 않다.** 색은 뜻이 있을 때만 나눈다(V5에서 다시 다룬다). 뜻 없이 칠할 거라면 한 색으로
충분하다.

### V4.4 셀 것인가 나눌 것인가 — `countplot`과 `histplot`

**히스토그램은 수치형 값을 구간으로 나눠 개수를 센다.** 범주가 이미 몇 가지로 정해져 있는
값의 개수를 셀 때는 `countplot`을 쓴다. 이 둘을 바꿔 쓰면 무슨 일이 생기는지 직접 본다.

```python
df['평균기온'].nunique()
# 489
```

`평균기온`은 연속값이라 서로 다른 값이 489개나 된다. 이걸 그대로 `countplot`에 넣으면 어떻게
될까.

```python
# ⚠ 연속값에 countplot 을 쓰면 막대가 489개 생겨 x축을 읽을 수 없다 (부록 시각화 A-2, D-2)
sns.countplot(data=df, x='평균기온')
```

```python
# 그림: v4-countplot-489
sns.countplot(data=df, x='평균기온')
plt.show()
```

![489개의 얇은 막대가 x축을 가득 채워 눈금 글자가 서로 겹친다](docs/fig/v4-countplot-489.png)

에러도 경고도 없다 — 그림이 그려지긴 하지만 아무 정보도 읽을 수 없을 뿐이다. "어떤 기온이
가장 흔한가"라는 질문에는 값을 구간으로 나누는 `histplot`이 맞는 도구다.

```python
# 그림: v4-histplot-basic
sns.histplot(data=df, x='평균기온', bins=30)
plt.show()
```

![30개 구간으로 나누자 20℃ 안팎에 값이 몰려 있는 분포 모양이 보인다](docs/fig/v4-histplot-basic.png)

반대로 범주형 값(예: `월`)의 개수를 셀 때는 `countplot`이 맞다.

```python
# 그림: v4-countplot-month
sns.countplot(data=df, x='월')
plt.show()
```

![12개 월 각각 몇 번 나왔는지 막대 12개로 정리된다](docs/fig/v4-countplot-month.png)

"구간을 나눠야 하면 histplot, 값이 이미 몇 가지로 나뉘어 있으면 countplot" — 둘을 가르는
기준은 이 한 줄이다.

### V4.5 `histplot`의 `bins`

구간을 몇 개로 나누느냐(`bins`)에 따라 같은 데이터가 다른 모양으로 보인다.

```python
# 그림: v4-histplot-bins-compare
fig, axes = plt.subplots(1, 3, figsize=(12, 3.5), sharey=True)
for ax, b in zip(axes, [10, 30, 100]):
    sns.histplot(data=df, x='평균기온', bins=b, ax=ax)
    ax.set_title(f'bins={b}')
plt.show()
```

![구간이 10개면 뭉뚱그려지고 100개면 들쭉날쭉해진다 — 30개 정도가 전체 모양을 가장 잘 보여 준다](docs/fig/v4-histplot-bins-compare.png)

`bins`가 너무 적으면 봉우리 두 개가 하나로 뭉개지고, 너무 많으면 우연한 굴곡까지 다 드러나
전체 모양이 오히려 안 보인다. 정해진 정답은 없고, 몇 가지 값으로 그려 보고 고른다.

### V4.6 분포를 곡선으로 — `kdeplot`, `rugplot`

히스토그램을 매끄러운 곡선으로 보고 싶을 때는 `kdeplot`(커널 밀도 추정)을 쓴다. 원본 자료가
쓰던 `distplot`은 지금도 실행은 되지만 경고가 뜬다. **없어진 것이 아니라 없어질 예정**이라는
점이 중요하다.

```python
# ✗ distplot 은 아직 있지만 없어질 예정이라 경고가 뜬다 — "없어졌다"가 아니다 (부록 시각화 C-3)
sns.distplot(df['평균기온'].dropna())
```

```text
UserWarning: `distplot` is a deprecated function and will be removed in seaborn v0.14.0.
```

지금 쓸 대체 함수는 둘로 나뉜다. 막대로 보려면 `histplot`, 곡선으로 보려면 `kdeplot`, 둘 다
보려면 `histplot(..., kde=True)`.

```python
# 그림: v4-kde-rug
sns.kdeplot(data=df, x='평균기온')
sns.rugplot(data=df, x='평균기온')
plt.show()
```

![부드러운 곡선(kdeplot) 아래에 실제 값의 위치를 짧은 선(rugplot)으로 함께 표시했다](docs/fig/v4-kde-rug.png)

`rugplot`은 각 값의 실제 위치를 x축 위에 짧은 선으로 찍어, 곡선이 뭉뚱그린 지점에 실제로
값이 몇 개나 모여 있는지 보여 준다. 두 함수를 그룹별로 나눠 비교할 때는 `FacetGrid`를 쓴다
(원본은 `FacetGrid.map(sns.distplot, ...)`을 썼는데 이 역시 C-3과 같은 경고 대상이다).

```python
# 그림: v4-kde-rug-facet
겨울여름 = df[df['월'].isin([1, 7])]
g = sns.FacetGrid(겨울여름, col='월')
g.map(sns.kdeplot, '평균기온')
g.map(sns.rugplot, '평균기온')
plt.show()
```

![1월과 7월의 평균기온 분포를 나란히 놓으면 겹치지 않을 만큼 확실히 다르다](docs/fig/v4-kde-rug-facet.png)

### V4.7 상자그림 읽기 — box · violin · strip

상자그림은 다섯 수치(최솟값·1사분위·중앙값·3사분위·최댓값)로 분포를 요약한다. 8월의
평균기온으로 값을 직접 확인한다.

```python
aug = df[df['월'] == 8]['평균기온'].dropna()
aug.describe()
```

```text
count    3534.000000
mean       25.602066
std         2.331173
min        17.400000
25%        24.100000
50%        25.700000
75%        27.200000
max        33.700000
Name: 평균기온, dtype: float64
```

상자그림의 상자는 1사분위(24.1)에서 3사분위(27.2)까지를 그린다. 수염은 상자에서
1.5×사분위범위(IQR)만큼 뻗고, 그 밖의 값은 점으로 따로 찍는다. **지금 환경(seaborn 0.13.2 +
matplotlib 3.11.1)에서 `sns.boxplot`을 부르면 두 라이브러리의 인자 이름이 어긋나 경고가
뜬다** — 코드가 잘못된 것이 아니라 버전 조합 문제다.

```python
# ✗ 이 환경에서는 boxplot 을 부를 때마다 이 경고가 뜬다 (matplotlib 3.11 의 vert 인자 이름 변경)
sns.boxplot(data=df, x='월', y='평균기온')
```

```text
MatplotlibDeprecationWarning: vert: bool was deprecated in Matplotlib 3.11 and will be removed in 3.13. Use orientation: {'vertical', 'horizontal'} instead.
```

```python
# 그림: v4-box-month
import warnings
warnings.filterwarnings('ignore', message='vert: bool was deprecated')     # 위에서 이미 확인한 경고
sns.boxplot(data=df, x='월', y='평균기온')
plt.show()
```

![월별 상자그림 12개 — 여름 상자는 위쪽, 겨울 상자는 아래쪽에 놓인다](docs/fig/v4-box-month.png)

같은 데이터를 violinplot과 stripplot으로도 그려 비교한다. 이 둘은 이 경고를 내지 않는다.

```python
# 그림: v4-violin-month
sns.violinplot(data=df, x='월', y='평균기온')
plt.show()
```

![상자그림보다 violinplot은 분포의 폭까지 곡선 모양으로 보여 준다](docs/fig/v4-violin-month.png)

```python
# 그림: v4-strip-month
sns.stripplot(data=df, x='월', y='평균기온', size=2, alpha=0.3)
plt.show()
```

![stripplot은 요약하지 않고 점 하나하나(하루하루의 값)를 그대로 흩뿌린다](docs/fig/v4-strip-month.png)

상자그림은 요약이 깔끔한 대신 분포의 모양(봉우리가 하나인지 둘인지 등)을 감춘다. violinplot은
그 모양을 보여 주고, stripplot은 아예 원자료를 그대로 보여 준다. 세 그림을 겹치면 요약과
원자료를 한 번에 볼 수 있다. 앞서 나온 버전 경고는 이미 확인했으니 겹쳐 그릴 때는 걸러낸다.

```python
# 그림: v4-box-strip-overlay
import warnings
warnings.filterwarnings('ignore', message='vert: bool was deprecated')

fig, ax = plt.subplots(figsize=(9, 4))
sns.boxplot(data=df, x='월', y='평균기온', color='lightgray', ax=ax)
sns.stripplot(data=df, x='월', y='평균기온', size=1.5, alpha=0.2, color='black', ax=ax)
plt.show()
```

![회색 상자 뒤에 실제 점을 겹치면 상자 밖 점(이상치)과 상자 안의 빽빽한 정도가 함께 보인다](docs/fig/v4-box-strip-overlay.png)

### V4.8 `lineplot`과 미리 집계하기

전체 42,396행을 그대로 `lineplot`에 넘기면 느릴 뿐 아니라, x값(연도)마다 여러 행이 있어
seaborn이 그 값들의 평균과 신뢰구간(띠)까지 계산한다 — 이 띠가 무엇을 뜻하는지 모르고 보면
오해하기 쉽다. `groupby`로 연평균을 미리 낸 것과 비교한다.

```python
# 그림: v4-lineplot-compare
yearly = df.groupby('년')['평균기온'].mean().reset_index()

fig, axes = plt.subplots(1, 2, figsize=(11, 3.5), sharey=True)
sns.lineplot(data=df, x='년', y='평균기온', ax=axes[0])
axes[0].set_title('원본을 그대로 — 연도마다 최대 366행, 회색 띠는 신뢰구간')
sns.lineplot(data=yearly, x='년', y='평균기온', ax=axes[1])
axes[1].set_title('groupby로 연평균을 미리 낸 뒤')
plt.show()
```

![왼쪽은 연도마다 여러 행이 있어 회색 신뢰구간 띠가 함께 그려지고, 오른쪽은 미리 집계해 선만 남는다](docs/fig/v4-lineplot-compare.png)

두 그림의 선 모양은 사실상 같다 — 둘 다 결국 연평균을 보여 주기 때문이다. 차이는 왼쪽에만
있는 **회색 띠**다. 저 띠는 "그해 하루하루의 값이 얼마나 흩어져 있었는가"를 나타내는
신뢰구간이지, 연평균의 오차가 아니다. 뜻을 모르고 보면 "선이 두껍다"고만 여기고 지나치기
쉽다. 무엇을 보여 줄지 미리 정했다면(여기서는 "연평균 추세") `groupby`로 그 값만 남기고
그리는 쪽이 더 정직하고 더 빠르다.

### V4.9 관계를 본다 — `scatterplot`

두 수치 열의 관계를 볼 때도 42,396개 점을 그대로 찍으면 점이 서로 겹쳐 밀도를 알 수 없다.
표본을 뽑고 `alpha`(투명도)를 줘서 겹친 정도가 드러나게 한다. 무작위 표본은 시드를 고정한다.

```python
# 그림: v4-scatter-alpha
sample = df.dropna(subset=['최저기온', '최고기온']).sample(2000, random_state=0)
sns.scatterplot(data=sample, x='최저기온', y='최고기온', alpha=0.4)
plt.show()
```

![2000개 표본에 투명도를 주니 점이 몰린 곳이 진하게 보인다](docs/fig/v4-scatter-alpha.png)

세 번째 값을 색(`hue`)으로 표현할 때, 그 값의 **dtype**이 그림을 바꾼다. `월`은 1~12 사이의
정수라 seaborn이 **연속값**으로 보고 색을 그러데이션으로 칠한다.

```python
# ⚠ 숫자 dtype 인 hue 는 연속값으로 취급되어 범례에 짝수 달만 나온다 (부록 시각화 D-4)
ax = sns.scatterplot(data=sample, x='최저기온', y='최고기온', hue='월', alpha=0.5)
[t.get_text() for t in ax.get_legend().get_texts()]
```

```text
['2', '4', '6', '8', '10', '12']
```

점은 12개 달 전부 제대로 색이 칠해졌지만, **범례에는 짝수 달만 나온다.** seaborn이 12개
범주 대신 색 띠 하나로 표현하면서 대표 눈금만 골라 보여 주기 때문이다. 에러도 경고도 없다.
`월`을 범주로 다루고 싶다면 문자열로 바꾼다.

```python
# 그림: v4-scatter-hue-numeric
fig, axes = plt.subplots(1, 2, figsize=(11, 4))
sns.scatterplot(data=sample, x='최저기온', y='최고기온', hue='월', alpha=0.5, ax=axes[0])
axes[0].set_title("hue='월' (숫자) — 범례에 짝수만")
sns.scatterplot(data=sample, x='최저기온', y='최고기온', hue=sample['월'].astype(str),
                 alpha=0.5, ax=axes[1])
axes[1].set_title("hue를 문자열로 — 범례에 12개 전부")
plt.show()
```

![왼쪽 범례는 짝수 달만, astype(str)로 바꾼 오른쪽 범례는 12개 달이 모두 나온다](docs/fig/v4-scatter-hue-numeric.png)

숫자로 저장돼 있다고 해서 항상 "크기를 재는 값"은 아니다. `월`은 순서는 있지만 1과 12가
가깝다는 뜻은 아니므로(12월과 1월은 겨울로 붙어 있다), 애초에 범주로 다루는 쪽이 자연스럽다.

### V4.10 `heatmap` — 상관계수를 색으로

상관계수 표를 색으로 칠하면 숫자를 하나하나 읽지 않고도 강한 관계를 한눈에 찾을 수 있다.
그런데 `corr()`은 문자열 열이 섞여 있으면 계산할 수 없다.

```python
# ✗ 날짜 열이 아직 문자열이면 corr() 이 실패한다 (부록 시각화 C-2)
raw = pd.read_csv('seoul_temp_day.csv', encoding='cp949')
raw.corr()
```

```text
ValueError: could not convert string to float: '\t1907-10-01'
```

지금 쓰는 `df`는 이미 `날짜`를 datetime으로 바꿔 두었지만, `지점`(관측소 번호, 값이 108
하나뿐)까지 포함하면 문제가 남는다. `numeric_only=True`로 숫자 열만 골라도, 값이 한 종류뿐인
열은 상관계수를 정의할 수 없어 그 행과 열이 통째로 `NaN`이 된다.

```python
df[['지점', '평균기온', '최저기온', '최고기온', '년', '월']].corr(numeric_only=True)
```

```text
      지점      평균기온      최저기온      최고기온         년         월
지점   NaN       NaN       NaN       NaN       NaN       NaN
평균기온 NaN  1.000000  0.987406  0.987636  0.083975  0.261068
최저기온 NaN  0.987406  1.000000  0.956321  0.114768  0.260005
최고기온 NaN  0.987636  0.956321  1.000000  0.048276  0.250451
년    NaN  0.083975  0.114768  0.048276  1.000000 -0.004249
월    NaN  0.261068  0.260005  0.250451 -0.004249  1.000000
```

`지점` 값은 이 파일 전체에서 108 하나뿐이라 값이 전혀 변하지 않는다. 상관계수는 "함께
변하는 정도"를 재는데 변하지 않는 값과는 그 정도를 정의할 수 없어 `NaN`이 된다. 히트맵에
빈 줄이 하나 그대로 나오는 것보다, 애초에 뜻 없는 열을 빼는 쪽이 낫다.

```python
# 그림: v4-heatmap-corr
temp_corr = df[['평균기온', '최저기온', '최고기온', '년', '월']].corr(numeric_only=True)
sns.heatmap(temp_corr, annot=True, fmt='.2f', cmap='coolwarm', vmin=-1, vmax=1)
plt.show()
```

![평균·최저·최고기온 세 열은 진한 색(0.95 이상)으로, 월과의 상관은 옅은 색으로 나타난다](docs/fig/v4-heatmap-corr.png)

평균·최저·최고기온 세 열은 서로 0.95 이상으로 진하게 칠해진다 — 셋 다 같은 날의 기온을
다른 방식으로 잰 값이니 당연하다. `년`과의 상관(0.05~0.11)이 낮아 보이는 것은 온난화가
없어서가 아니라, **연평균이 아니라 일별 값**으로 계산했기 때문이다(하루하루의 기온은
연도보다 계절의 영향을 훨씬 크게 받는다). 이런 오해는 V5에서 다시 짚는다.

### V4.11 `pairplot` — 한 번에 훑어보기

`pairplot`은 여러 수치 열의 관계를 조합마다 산점도로, 자기 자신과의 관계는 히스토그램으로
그려 한 판에 배열한다. 세 기온 열로 확인한다(표본 2,000행 — 전체를 다 쓰면 그리는 데
시간이 오래 걸린다).

```python
# 그림: v4-pairplot
sns.pairplot(sample[['최저기온', '평균기온', '최고기온']].dropna())
plt.show()
```

![대각선은 각 열의 분포, 그 밖의 칸은 두 열씩 짝지은 산점도다 — 세 기온 모두 강한 직선 관계를 보인다](docs/fig/v4-pairplot.png)

대각선 세 칸은 히스토그램 하나(V4.5), 나머지 여섯 칸은 산점도(V4.9)다. 열이 3개면 칸이 9개,
열이 5개면 칸이 25개가 되므로 열이 많을수록 한 칸의 크기가 작아져 읽기 어려워진다 — 대개
5~6개 열 이하에서 쓴다.

### V4.12 흔한 실수

- **막대그래프의 높이만 보고 뒤에 몇 개의 행이 있는지 확인하지 않는다.** 행 5개의 평균과 행
  500개의 평균이 같은 굵기의 막대로 그려진다(V4.2). 신뢰구간(검은 선)의 길이나 `count()`를
  함께 확인한다.
- **연속값에 `countplot`을 쓴다.** 에러 없이 막대가 수백 개 생겨 아무것도 읽을 수 없다
  (V4.4). 구간을 나눠야 하면 `histplot`이다.
- **`distplot`이 경고를 내는 것을 보고 "없어졌다"고 단정한다.** 지금은 실행된다. 0.14에서
  없어질 예정이라는 경고일 뿐이다(V4.6) — "없어질 것 같다"가 아니라 실제로 실행해 확인한다.
- **숫자로 저장된 범주(`월`, `년`, 우편번호 등)를 그대로 `hue`에 넘긴다.** seaborn이
  연속값으로 오해해 범례가 줄어든다(V4.9). 범주면 `astype(str)`로 명시한다.
- **`corr()`에 값이 하나뿐인 열(`지점` 같은)을 남겨 둔다.** 히트맵에 뜻 없는 `NaN` 줄이
  생긴다(V4.10). 그리기 전에 어떤 열이 실제로 변하는 값인지 확인한다.

### 확인 문제

**문제 V4-1.** 두 연도의 `sns.barplot` 막대 높이가 똑같은데 한쪽은 검은 선(신뢰구간)이
짧고 다른 쪽은 길다. 무엇이 다르다는 뜻인가?

<details><summary>답</summary>

두 해의 **평균**은 같지만 하루하루 값이 흩어진 정도(분산)나 표본 수가 다르다는 뜻이다.
신뢰구간은 평균을 부트스트랩으로 다시 계산했을 때 그 값이 얼마나 흔들리는지를 보여 준다.
값이 고르게 모여 있거나 날수가 많으면 선이 짧고, 값이 들쭉날쭉하거나 날수가 적으면 선이
길어진다. 막대 높이(평균)만 보고 "두 해가 똑같다"고 결론 내리면 이 차이를 놓친다(V4.2).

</details>

**문제 V4-2.** `sns.countplot(data=df, x='평균기온')`을 실행하면 막대가 489개 생긴다. 왜
이런 일이 일어나고, 같은 질문(어느 기온이 흔한가)에 답하려면 어떤 함수를 대신 써야 하는가?

<details><summary>답</summary>

`평균기온`은 소수점 값을 가진 연속값이라 서로 다른 값이 489개나 있다. `countplot`은 값
하나하나를 범주로 보고 막대 하나씩 그리므로 막대가 489개가 된다. 연속값의 분포를 보려면
값을 구간으로 나눠 세는 `histplot(data=df, x='평균기온', bins=30)`을 쓴다(V4.4).

</details>

**문제 V4-3.** `sns.distplot(...)`을 실행하면 `UserWarning`이 뜨지만 그래프는 정상적으로
나온다. "distplot은 seaborn에서 없어졌다"는 말은 정확한가?

<details><summary>답</summary>

정확하지 않다. 지금 버전(0.13.2)에서 `distplot`은 여전히 동작하고, 경고는 "0.14.0에서
없어질 예정"이라고 알릴 뿐이다(V4.6). "없어졌다"와 "없어질 예정이라 경고가 뜬다"는 다른
문장이고, 실제로 실행해 보지 않으면 둘을 구분할 수 없다.

</details>

**문제 V4-4.** `df[['지점', '평균기온', '최저기온']].corr(numeric_only=True)`를 히트맵으로
그렸더니 `지점` 행과 열이 전부 `NaN`(빈 칸)으로 나온다. 원인은 무엇인가?

<details><summary>답</summary>

`지점`은 이 파일 전체에서 108이라는 값 하나뿐이라 전혀 변하지 않는 열이다. 상관계수는 두 열이
함께 변하는 정도를 재는 값인데, 변하지 않는 열과는 그 정도를 정의할 수 없어 `NaN`이 된다
(V4.10). 그리기 전에 값이 실제로 변하는 열인지 확인해서 빼는 것이 낫다.

</details>

### 🧪 실습실

> 웹앱 **V4**에서 "막대 뒤의 행들"로 연도를 하나 골라 막대(평균) 뒤에 그해 365개(또는
> 366개) 점이 흩어진 모습을 직접 확인해 보라. "bins 슬라이더"로 같은 데이터를 histplot과
> countplot(막대 489개)으로 나란히 놓고 비교해 보라. "box · violin · strip"으로 같은 달의
> 데이터를 세 방식으로 바꿔 가며 상자그림의 다섯 수치를 표로 확인해 보라. "hue가 숫자일 때"로
> `월`을 숫자와 문자열로 바꿔 가며 범례가 어떻게 달라지는지 보라.
