## V5장. 그래프가 거짓말할 때

> 같은 숫자로 다른 인상을 만들 수 있다. 이 장을 읽고 나면 축을 어디서 시작할지, 색을 언제
> 쓸지, 그리고 결측이 그래프에서 어떻게 착시를 만드는지 알아채고 고칠 수 있다.

### V5.1 문제 제기 — 무엇을 보여줄 것인가가 모양을 정한다

서울의 최근 5년 평균기온을 보여 주고 싶다고 하자. 파이 차트로 그려 보면 어떻게 될까.

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

pd.set_option('display.max_columns', 30)
pd.set_option('display.width', 200)
pd.set_option('display.max_colwidth', 40)
plt.rc('font', family='Malgun Gothic')   # 맥은 'AppleGothic'
plt.rc('axes', unicode_minus=False)

# 출처: 기상청 기상자료개방포털 (공공누리 제1유형)
df = pd.read_csv('seoul_temp_day.csv', encoding='cp949')
df['날짜'] = df['날짜'].str.strip()
df = df[df['날짜'] != ''].copy()
df['날짜'] = pd.to_datetime(df['날짜'])
df['년'] = df['날짜'].dt.year

yearly = df.groupby('년').agg(평균=('평균기온', 'mean'), 날수=('평균기온', 'count'))
print(yearly.loc[2020:2024, '평균'])
```

```text
년
2020    13.271858
2021    13.752055
2022    13.296164
2023    14.109041
2024    14.875410
Name: 평균, dtype: float64
```

```python
# 그림: v5-chart-choice
최근 = yearly.loc[2020:2024, '평균']
최근10 = yearly.loc[2010:2024, '평균']

fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
axes[0].pie(최근, labels=최근.index, autopct='%1.0f%%')
axes[0].set_title('나쁜 예 — 파이로 그린 기온')
axes[1].plot(최근10.index, 최근10.to_numpy(), marker='o', color='tab:blue')
axes[1].set_ylabel('평균기온(℃)')
axes[1].set_title('좋은 예 — 선으로 그린 추세')
plt.tight_layout()
plt.show()
```

![파이 차트와 선 그래프로 같은 기온 자료를 그린 비교](docs/fig/v5-chart-choice.png)

파이 차트는 조각을 다 더하면 100%가 되는 **전체의 몫**을 나타낼 때 쓴다. 다섯 해의 평균기온을
더한 숫자(약 69도)에는 아무 의미가 없다 — "2024년이 전체 기온의 21%를 차지한다"는 문장은
말이 되지 않는다. 그런데도 파이 차트는 그것처럼 보이게 만든다. 반면 시간에 따라 변하는 값은
선 그래프가 자연스럽다. **무엇을 보여 주고 싶은지가 먼저고, 그림 모양은 그다음이다.**

질문의 성격과 그림 모양을 짝지으면 이렇다.

| 보여줄 것 | 그림 |
|:---|:---|
| 크기 비교(항목끼리 누가 더 큰가) | 막대그래프 |
| 시간에 따른 변화 | 선 그래프 |
| 값의 분포(어디에 몰려 있나) | 히스토그램, 상자그림 |
| 두 값의 관계 | 산점도 |
| 전체를 몇 개 조각으로 나눈 몫 | 누적 막대(조각이 6개 이하면 파이도 가능) |
| 숫자 하나 | 그림이 아니라 숫자 그 자체 — 억지로 그리지 않는다 |

이제부터 이 장은 "모양은 맞게 골랐는데도 거짓말하는" 다섯 가지 경우를 하나씩 짚는다.

### V5.2 막대는 0에서 시작한다

2023년과 2024년의 평균기온을 막대로 비교해 보자.

```python
print(yearly.loc[2023, '평균'])
print(yearly.loc[2024, '평균'])
print(yearly.loc[2024, '평균'] - yearly.loc[2023, '평균'])
```

```text
14.109041095890412
14.875409836065574
0.766368740175162
```

두 해의 차이는 0.77℃, 비율로는 5%가 조금 넘는다. 그런데 y축을 어디서 시작하느냐에 따라
이 차이가 완전히 다르게 보인다.

```python
# 그림: v5-bar-from-zero
연도 = ['2023', '2024']
값 = [yearly.loc[2023, '평균'], yearly.loc[2024, '평균']]

fig, axes = plt.subplots(1, 2, figsize=(9, 4.5))
axes[0].bar(연도, 값, color='tab:blue')
axes[0].set_ylim(13.5, 15)
axes[0].set_title('나쁜 예 — 축을 13.5부터')
axes[0].set_ylabel('평균기온(℃)')

axes[1].bar(연도, 값, color='tab:blue')
axes[1].set_ylim(0, 16)
axes[1].set_title('좋은 예 — 0부터')
axes[1].set_ylabel('평균기온(℃)')
plt.tight_layout()
plt.show()
```

![막대그래프의 y축을 13.5부터 시작한 경우와 0부터 시작한 경우 비교](docs/fig/v5-bar-from-zero.png)

왼쪽 그림에서는 2024년 막대가 2023년보다 몇 배는 커 보인다. 축을 13.5부터 자르면 실제로는
5% 남짓인 차이가 화면에서는 압도적인 차이로 확대된다. 오른쪽처럼 0부터 그리면 두 막대의
키 차이가 실제 비율과 같아진다. **막대그래프는 길이로 크기를 비교하는 그림이라서, 길이의
기준점(0)을 옮기면 비교 자체가 거짓이 된다.** 선 그래프는 사정이 다르다 — 선은 길이가 아니라
기울기로 변화를 보여 주므로, 세부 변화를 보려고 축을 확대해도(V5.1의 오른쪽 그림처럼) 막대와
같은 방식으로 왜곡되지는 않는다.

### V5.3 축은 하나 — 이중 y축 금지

서울의 연평균기온과 연교차(그해의 최고기온 − 최저기온)를 함께 보고 싶다고 하자.
`seoul_temp.csv`는 각 연도의 극값을 담고 있다(여기 최고·최저는 그해의
극값이지 연평균의 최고·최저가 아니다).

```python
ext = pd.read_csv('seoul_temp.csv', encoding='cp949')
ext['연교차'] = ext['최고기온'] - ext['최저기온']
print(ext[['년', '평균기온', '최고기온', '최저기온', '연교차']].tail(3))
```

```text
       년   평균기온  최고기온  최저기온   연교차
109  2016  13.6  36.6 -18.0  54.6
110  2017  13.0  35.4 -12.6  48.0
111  2018  12.9  39.6 -17.8  57.4
```

두 값을 한 그림에 놓고 싶은 유혹이 든다. 왼쪽 축에 평균기온, 오른쪽 축에 연교차를 두면
이렇게 된다.

```python
# 그림: v5-dualaxis-bad
fig, ax1 = plt.subplots(figsize=(9, 4.5))
ax2 = ax1.twinx()
ax1.plot(ext['년'], ext['평균기온'], color='tab:blue', label='평균기온(왼쪽 축)')
ax2.plot(ext['년'], ext['연교차'], color='tab:orange', label='연교차(오른쪽 축)')
ax1.set_ylim(9, 14)
ax2.set_ylim(58, 24)          # 일부러 오른쪽 축을 뒤집어 두 선을 겹쳐 보이게 했다
ax1.set_ylabel('평균기온(℃)')
ax2.set_ylabel('연교차(℃)')
ax1.set_title('나쁜 예 — 두 축의 범위를 맞춰 겹쳐 보이게 함')
fig.legend(loc='upper left', bbox_to_anchor=(0.12, 0.88))
plt.show()
```

![평균기온과 연교차를 이중 y축에 겹쳐 그려 상관이 있어 보이게 만든 그림](docs/fig/v5-dualaxis-bad.png)

두 선이 거의 나란히 움직이는 것처럼 보인다. 그런데 이 "나란함"은 자료가 아니라 **축의
범위를 내가 골랐기 때문에** 생긴 것이다. 오른쪽 축의 범위를 24~58 대신 0~100으로만 바꿔도
겹치는 모양이 달라진다 — 이중 축 그래프는 그린 사람이 축을 조절해서 원하는 만큼 두 선을
가깝게도, 멀게도 만들 수 있다. **두 값의 단위가 다르면(또는 단위가 같아도 크기 규모가 다르면)
이중 축은 "관계가 있어 보이게" 그릴 자유를 그린 사람에게 준다.** 이건 자료를 보여 주는 게
아니라 자료를 연출하는 것이다.

바로잡는 방법은 두 가지다. 그림을 두 개로 나누거나(각자 자기 축을 가지므로 왜곡이 없다),
두 값을 같은 기준으로 정규화해서 한 축에 올린다. 여기서는 그림을 나눈다.

```python
# 그림: v5-dualaxis-fixed
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(ext['년'], ext['평균기온'], color='tab:blue')
axes[0].set_ylabel('평균기온(℃)')
axes[0].set_title('좋은 예 — 그림을 나눈다')
axes[1].plot(ext['년'], ext['연교차'], color='tab:orange')
axes[1].set_ylabel('연교차(℃)')
axes[1].set_xlabel('년')
plt.tight_layout()
plt.show()
```

![평균기온과 연교차를 각자의 축을 가진 두 그림으로 나눠 그린 결과](docs/fig/v5-dualaxis-fixed.png)

두 그림을 나란히 보면 각 선이 자기 축 안에서 어떻게 움직이는지 왜곡 없이 볼 수 있다. 실제로
두 값의 상관계수는 `ext['평균기온'].corr(ext['연교차'])` ≈ -0.45로 약한 음의 관계가 있지만,
이 관계는 두 그림을 따로 보고 판단할 일이지 이중 축이 대신 "보여 줄" 일이 아니다.

### V5.4 색은 뜻이 있을 때만

17개 시도의 총인구를 막대로 비교해 보자.

```python
# 출처: 행정안전부 주민등록 인구통계
pop = pd.read_csv('korea_pop.csv', encoding='cp949', thousands=',')
sido = pop['행정구역'].str.split(r'\s+\(', regex=True).str[0]
pop = pop.set_index(sido)
pop.index.name = '시도'

totals = pop.loc[pop.index != '전국', '2021년08월_계_총인구수'].sort_values(ascending=False)
print(totals.head(3))
```

```text
시도
경기도      13530519
서울특별시     9550227
부산광역시      3359527
Name: 2021년08월_계_총인구수, dtype: int64
```

```python
# 그림: v5-color-compare
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))

무지개 = plt.cm.rainbow(np.linspace(0, 1, len(totals)))
axes[0].bar(range(len(totals)), totals.to_numpy(), color=무지개)
axes[0].set_title('나쁜 예 — 무지개색')
axes[0].set_xticks([])

농도 = 0.3 + 0.6 * (totals / totals.max())
단색 = plt.cm.Blues(농도)
axes[1].bar(range(len(totals)), totals.to_numpy(), color=단색)
axes[1].set_title('좋은 예 — 한 색의 진하기')
axes[1].set_xticks([])
plt.tight_layout()
plt.show()
```

![시도별 인구를 무지개색과 한 색의 진하기로 각각 칠한 막대그래프](docs/fig/v5-color-compare.png)

왼쪽 그림의 색은 **크기와 아무 관계가 없다.** 무지개는 그저 막대 순서대로 색상환을 따라간
것이라, 빨간 막대가 큰지 작은지 색만 보고는 알 수 없다 — 오히려 "빨강이 위험, 초록이
안전" 같은 엉뚱한 인상까지 얹는다. 오른쪽 그림은 값이 클수록 색이 진하다. 색이 **크기라는
뜻을 실제로 나르고 있다.** 규칙은 간단하다.

- 크기(magnitude)를 색으로 보이고 싶으면 **한 색조의 진하기**만 쓴다(순차 팔레트).
- 양수·음수처럼 방향이 있는 값은 두 색 + 가운데 회색(발산 팔레트) — V4의 상관계수
  히트맵이 이 경우다.
- 서로 다른 항목을 구분하고 싶으면(범주) 색을 3개까지만 쓴다. 색약인 사람도 구분해야
  하기 때문이다(이 교재의 세 기온 계열 파랑·주황·초록이 그 예다).
- 그 외에는 색을 아예 쓰지 않는 게 낫다. 무지개는 "구분되어 보이지만 아무 뜻도 없는" 색을
  만드는 가장 흔한 방법이라 특히 피한다.

### V5.5 ★ 결측이 만드는 계곡

서울의 연도별 평균기온을 그대로 선으로 그려 보자. `yearly`는 V5.1에서 이미 만들어 두었다.

```python
# 그림: v5-valley-naive
plt.figure(figsize=(10, 4.5))
plt.plot(yearly.index, yearly['평균'], color='tab:blue')
plt.xlabel('년')
plt.ylabel('평균기온(℃)')
plt.title('연도별 평균기온')
plt.show()
```

![서울 연평균기온 선 그래프. 1950년대 초반에 깊은 계곡이 있다](docs/fig/v5-valley-naive.png)

1950년대 초반에 눈에 띄는 계곡이 있다. 어느 해가 가장 추웠는지 확인해 보자.

```python
가장추운해 = yearly['평균'].idxmin()
print(f'{int(가장추운해)}년, 평균기온 {yearly["평균"].min():.2f}℃')
```

```text
1953년, 평균기온 0.64℃
```

서울이 1953년에 영하에 가까운 연평균을 기록했다는 뜻일까. `mean()`은 결측을 조용히 건너뛰고
계산한다 — 몇 개의 값으로 계산했는지部터 같이 봐야 한다.

```python
print(yearly.loc[1949:1954])
```

```text
             평균   날수
년                   
1949  11.700000  365
1950  13.478189  243
1951        NaN    0
1952        NaN    0
1953   0.641935   31
1954  11.487945  365
```

1953년은 날수가 **31일**뿐이다. 1951년과 1952년은 평균기온 값이 하루도 없어서 연평균 자체가
`NaN`이다(줄이 아예 비어 있다 — `NaN`이 아니라 계산할 재료가 없다). `날수`를 평균기온과
나란히 그리면 무슨 일이 있었는지 보인다.

```python
# 그림: v5-valley-with-count
fig, axes = plt.subplots(2, 1, figsize=(10, 6), sharex=True)
axes[0].plot(yearly.index, yearly['평균'], color='tab:blue')
axes[0].set_ylabel('평균기온(℃)')
axes[0].set_title('연평균기온')
axes[1].bar(yearly.index, yearly['날수'], color='tab:blue')
axes[1].axhline(360, color='#d03b3b', linestyle='--', linewidth=1)
axes[1].set_ylabel('날수')
axes[1].set_xlabel('년')
axes[1].set_title('그 해에 평균기온 값이 있는 날수 (빨간 선 = 360일)')
plt.tight_layout()
plt.show()
```

![연평균기온 선 그래프와 그 아래 연도별 유효 날수 막대그래프를 나란히 놓은 그림](docs/fig/v5-valley-with-count.png)

계곡이 있는 자리는 정확히 날수가 뚝 떨어진 자리와 겹친다. 1950~1953년은 한국전쟁 기간이다.
1951년과 1952년 구간을 확대해서 선이 어떻게 끊기는지 보자.

```python
# 그림: v5-valley-zoom
zoom = yearly.loc[1948:1957]
plt.figure(figsize=(9, 4.5))
plt.plot(zoom.index, zoom['평균'], color='tab:blue', marker='o')
for 년, 행 in zoom.iterrows():
    plt.annotate(f"{int(행['날수'])}일", (년, 행['평균']) if pd.notna(행['평균']) else (년, 6),
                 textcoords='offset points', xytext=(0, 8), ha='center', fontsize=8)
plt.ylabel('평균기온(℃)')
plt.xlabel('년')
plt.title('1948~1957년 확대 — 선이 끊긴 자리는 값이 아예 없다')
plt.show()
```

![1948년부터 1957년까지 확대한 선 그래프. 1951~1952년 구간에서 선이 끊긴다](docs/fig/v5-valley-zoom.png)

`NaN`이 있는 해는 선이 아래로 처지는 게 아니라 **끊어진다** — matplotlib이 `NaN`을 만나면
그 지점을 건너뛰기 때문이다. 1953년은 끊기지 않고 낮게 찍힌다. 값이 있어서(12월 31일치)
선은 이어지지만, 그 값은 "1년 평균"이 아니라 "12월 한 달 평균"이다. **에러도 경고도 없이,
겨울 한 달의 평균이 연평균이라는 이름을 달고 그래프에 올라간 것이다.**

날수가 충분한 해만 골라서 다시 그려 보자.

```python
valid = yearly[yearly['날수'] >= 360]
새가장추운해 = valid['평균'].idxmin()
print(f'{int(새가장추운해)}년, 평균기온 {valid["평균"].min():.2f}℃')
print(f'제외된 해 수: {len(yearly) - len(valid)}')
```

```text
1947년, 평균기온 9.66℃
제외된 해 수: 5
```

```python
# 그림: v5-valley-fixed
plt.figure(figsize=(10, 4.5))
plt.plot(valid.index, valid['평균'], color='tab:blue')
최저행 = valid.loc[valid['평균'].idxmin()]
plt.scatter([valid['평균'].idxmin()], [최저행['평균']], color='#d03b3b', zorder=3)
plt.annotate('1947년 (가장 추운 해)', (valid['평균'].idxmin(), 최저행['평균']),
             textcoords='offset points', xytext=(10, -12))
plt.ylabel('평균기온(℃)')
plt.xlabel('년')
plt.title('유효 날수 360일 이상인 해만')
plt.show()
```

![유효 날수 360일 이상인 해만 남긴 연평균기온 그래프. 1947년이 가장 낮은 지점으로 표시된다](docs/fig/v5-valley-fixed.png)

**같은 자료, 같은 함수(`mean()`)인데, 결측을 거르지 않고 계산하느냐에 따라 "가장 추운 해"가
1953년에서 1947년으로 바뀐다.** 어느 쪽도 `mean()`이 틀린 게 아니다 — `mean()`은 있는 값만
정직하게 평균 냈을 뿐이다. 틀린 건 며칠짜리 평균인지 확인하지 않고 "연평균"이라는 이름만
믿은 쪽이다. **연도별로 묶어 평균을 낼 때는 `count()`를 항상 같이 낸다.**

### V5.6 그림이 이상하면 데이터를 의심한다

시·도의 위치와 인구를 산점도로 그리는 예제가 있다. 아래 표는 수업 자료의 그 예제가 쓴
값 그대로다.

```python
옮긴표 = pd.DataFrame({
    '시도': ['서울특별시', '부산광역시', '대구광역시', '인천광역시',
             '대전광역시', '울산광역시', '경기도', '제주특별자치도'],
    '위도': [37.56608, 35.18002, 35.87154, 35.45619,
             36.35060, 35.53975, 37.27511, 33.48939],
    '경도': [126.97806, 129.07498, 128.60181, 126.70594,
             127.37488, 129.31153, 127.00915, 126.50041],
    '인구_표': [9550227, 3359527, 393626, 2938429,
                1454679, 1124459, 13530519, 675883],
})
print(옮긴표)
```

```text
        시도       위도       경도   인구_표
0    서울특별시  37.56608  126.97806   9550227
1    부산광역시  35.18002  129.07498   3359527
2    대구광역시  35.87154  128.60181    393626
3    인천광역시  35.45619  126.70594   2938429
4    대전광역시  36.35060  127.37488   1454679
5    울산광역시  35.53975  129.31153   1124459
6      경기도  37.27511  127.00915  13530519
7  제주특별자치도  33.48939  126.50041    675883
```

```python
# 그림: v5-population-scatter-typo
plt.figure(figsize=(6, 6))
plt.scatter(옮긴표['경도'], 옮긴표['위도'], s=옮긴표['인구_표'] / 10000,
            alpha=0.6, color='tab:blue')
for _, 행 in 옮긴표.iterrows():
    plt.annotate(행['시도'][:2], (행['경도'], 행['위도']), ha='center', va='center', fontsize=8)
plt.xlabel('경도')
plt.ylabel('위도')
plt.title('표를 그대로 옮긴 산점도')
plt.show()
```

![표의 값을 그대로 옮겨 그린 산점도. 대구 원이 작고 인천이 부산 쪽에 찍힌다](docs/fig/v5-population-scatter-typo.png)

두 가지가 이상하다. **대구**는 원이 제주보다도 작다 — 대구가 인구 240만 가까운 광역시라는
걸 알면 말이 안 된다. **인천**은 위도가 낮아 부산 근처(경상도 해안)에 찍힌다 — 인천이
서해안 도시라는 걸 알면 역시 이상하다. `korea_pop.csv`에서 실제 값을 읽어 대조해 보자.

```python
실제인구 = pop.loc[옮긴표['시도'], '2021년08월_계_총인구수']
비교 = 옮긴표.set_index('시도')[['인구_표']].assign(인구_실제=실제인구.to_numpy())
print(비교)
```

```text
          인구_표   인구_실제
시도                         
서울특별시    9550227   9550227
부산광역시    3359527   3359527
대구광역시     393626   2393626
인천광역시   2938429   2938429
대전광역시   1454679   1454679
울산광역시   1124459   1124459
경기도    13530519  13530519
제주특별자치도  675883    675883
```

대구만 정확히 200만이 차이 난다 — 앞자리 `2`가 하나 빠졌다(393626 vs 2393626). 인구는
전부 CSV와 맞는데 유독 대구만 어긋난다는 것 자체가 "손으로 옮겨 적다 자릿수가 빠졌다"는
가장 흔한 원인을 가리킨다. 위도는 CSV에 없으니(이 파일은 인구만 담고 있다) 손으로 옮겨
적을 때 실수가 있었는지는 다른 방법으로 확인해야 한다 — 인천은 서울(37.57)·경기도(37.28)와
가까운 위도여야 자연스러운데 표의 값(35.46)은 부산(35.18)과 비슷하다. 실제 인천의 위도는
37.456 부근으로 알려져 있다 — 앞의 두 자리(37)가 부산과 비슷한 값(35)으로 잘못 옮겨진
것으로 보인다. 두 값을 바로잡아 다시 그리면 이렇다.

```python
# 그림: v5-population-scatter-real
고친표 = 옮긴표.copy()
고친표.loc[고친표['시도'] == '대구광역시', '인구_표'] = int(pop.loc['대구광역시', '2021년08월_계_총인구수'])
고친표.loc[고친표['시도'] == '인천광역시', '위도'] = 37.456
고친표 = 고친표.rename(columns={'인구_표': '인구'})

plt.figure(figsize=(6, 6))
plt.scatter(고친표['경도'], 고친표['위도'], s=고친표['인구'] / 10000, alpha=0.6, color='tab:blue')
for _, 행 in 고친표.iterrows():
    plt.annotate(행['시도'][:2], (행['경도'], 행['위도']), ha='center', va='center', fontsize=8)
plt.xlabel('경도')
plt.ylabel('위도')
plt.title('바로잡은 산점도')
plt.show()
```

![바로잡은 산점도. 대구 원이 커지고 인천이 서울·경기 쪽으로 이동한다](docs/fig/v5-population-scatter-real.png)

대구 원이 제 크기를 찾고, 인천이 서울·경기 근처로 올라온다. **숫자를 손으로 옮겨 적는
순간마다 이런 실수가 들어갈 수 있다.** 그림이 상식과 어긋나면 — 잘 아는 도시가 이상한
자리에 있다면 — 코드보다 자료 자체를 의심하는 것이 먼저다.

### V5.7 피라미드의 음수 눈금

남녀 인구를 한 그림에서 비교하는 인구 피라미드는 관례적으로 남자를 오른쪽(양수), 여자를
왼쪽(음수)으로 그린다. 제주의 나이별 인구로 그려 보자.

```python
남열 = pop.filter(regex=r'_남_\d+세|_남_100세 이상').columns
여열 = pop.filter(regex=r'_여_\d+세|_여_100세 이상').columns
나이 = [c.split('_')[-1] for c in 남열]

남 = pop.loc['제주특별자치도', 남열].to_numpy()
여 = pop.loc['제주특별자치도', 여열].to_numpy()
print(len(나이), 나이[0], 나이[-1])
```

```text
101 0세 100세 이상
```

```python
# 그림: v5-pyramid
y = np.arange(len(나이))
fig, axes = plt.subplots(1, 2, figsize=(10, 6), sharey=True)

axes[0].barh(y, 남, color='tab:blue', label='남')
axes[0].barh(y, -여, color='tab:orange', label='여')
axes[0].set_yticks(y[::10])
axes[0].set_yticklabels([나이[i] for i in y[::10]])
axes[0].set_title('나쁜 예 — 눈금이 음수')
axes[0].legend()

axes[1].barh(y, 남, color='tab:blue', label='남')
axes[1].barh(y, -여, color='tab:orange', label='여')
틱 = axes[1].get_xticks()
axes[1].set_xticks(틱)
axes[1].set_xticklabels([f'{abs(int(t)):,}' for t in 틱])
axes[1].set_title('좋은 예 — 절댓값 눈금')
axes[1].legend()
plt.tight_layout()
plt.show()
```

![제주 인구 피라미드. 왼쪽은 x축 눈금이 음수, 오른쪽은 절댓값으로 고친 그림](docs/fig/v5-pyramid.png)

왼쪽 그림의 x축에는 `-8000`, `-6000`처럼 **음수 인구**가 찍혀 있다. 사람 수는 음수가 될 수
없으니 이건 자료가 아니라 "왼쪽으로 그리기 위해 부호를 뒤집었다"는 그리기 방식의 흔적일
뿐이다. 그런데 눈금에 그 흔적이 그대로 남으면 읽는 사람이 착각한다. 오른쪽처럼 눈금 값을
절댓값 문자열로 바꾸면 막대의 방향(왼쪽=여자, 오른쪽=남자)은 그대로 유지하면서 눈금은
사실대로 보인다. `matplotlib.ticker.FuncFormatter(lambda x, pos: f'{abs(int(x)):,}')`를
`ax.xaxis.set_major_formatter`에 넣어도 같은 효과를 낸다 — 눈금이 다시 그려질 때마다
자동으로 절댓값으로 바뀐다는 점이 다르다.

```python
남녀차 = pd.Series(남 - 여, index=나이)
print(f"남-여 합계: {남녀차.sum()}")
print(f"남이 가장 앞서는 나이: {남녀차.idxmax()} (+{남녀차.max()})")
print(f"여가 가장 앞서는 나이: {남녀차.idxmin()} ({남녀차.min()})")
```

```text
남-여 합계: 2041
남이 가장 앞서는 나이: 55세 (+666)
여가 가장 앞서는 나이: 88세 (-861)
```

### V5.8 점검표

그림을 내보내기 전에 다섯 가지를 확인한다.

- **제목이 주장인가, 사실인가.** "역대 최저"처럼 제목이 결론을 대신 내리고 있지 않은가.
- **축은 0부터인가.** 막대그래프인데 축이 잘려 있다면 이유를 설명할 수 있어야 한다.
- **단위가 적혀 있는가.** ℃인지 mm인지 없이는 숫자가 뜻을 잃는다.
- **결측을 확인했는가.** 평균·합계를 낸 값 옆에 몇 개로 낸 값인지(`count()`) 같이 적었는가.
- **색에 뜻이 있는가, 그리고 표로도 볼 수 있는가.** 툴팁이나 색이 유일한 정보 통로가 되면
  안 된다 — 숫자로도 확인할 길을 남긴다.

### V5.9 흔한 실수

**연도별 평균을 그대로 믿는다.** V5.5에서 본 것처럼 `groupby('년')['x'].mean()`은 며칠로
낸 평균인지 말해 주지 않는다. `count()`를 항상 같이 낸다.

**"두 값을 한눈에 보고 싶다"는 이유만으로 이중 축을 쓴다.** 두 선이 겹쳐 보이는 건 자료의
성질이 아니라 축 범위를 고른 사람의 선택이다. 그림을 나누거나 정규화한다.

```python
# ⚠ 에러도 경고도 없다. 그런데 전체 평균에서 전쟁 기간 두 해가 조용히 빠진다
print(yearly['평균'].count())
print(yearly['평균'].mean())
```

```text
116
11.694081898132573
```

`yearly`는 1907~2024년, 118개 행이 있는데 `count()`는 116을 센다. 1951년과 1952년은
평균기온 값 자체가 `NaN`이라 애초에 `날수` 표에서만 빈 줄로 보였고, 여기서는 평균 계산
대상에서 자동으로 빠진다. `mean()`은 항상 옳게 계산하지만, **몇 개를 빼고 계산했는지는
스스로 확인해야 한다** — 이 장 전체를 관통하는 문장이다.

### 확인 문제

**문제 V5-1.** 두 도시의 최근 5년 평균기온을 막대그래프로 비교하는데, 차이가 0.3℃뿐이라
"그래프가 밋밋해 보인다"는 이유로 y축을 12에서 시작했다. 무엇이 문제인가?

<details><summary>답</summary>

막대그래프는 막대의 길이(0부터 잰 높이)로 크기를 비교하는 그림이다. 축을 12에서 시작하면
실제로는 작은 차이(0.3℃)가 화면에서는 훨씬 큰 차이로 보인다 — 두 막대의 높이 비율이 실제
값의 비율과 달라진다. 차이가 작다는 사실 자체를 숨기지 않고 그대로 보여 주는 것이 맞고,
정 강조하고 싶으면 두 막대 위에 실제 값(숫자)을 적어 준다.

</details>

**문제 V5-2.** 연도별 평균기온과 강수량을 이중 y축 그래프로 그렸더니 두 선이 거의 겹쳐
보였다. 이 그림만으로 "기온이 오르면 강수량도 는다"고 결론 내려도 되는가?

<details><summary>답</summary>

안 된다. 이중 y축에서는 각 축의 범위를 그리는 사람이 따로 정하므로, 두 선이 겹쳐 보이도록
범위를 고르는 것이 항상 가능하다 — 실제 상관관계가 약해도 축만 조절하면 겹쳐 보이게 만들
수 있다. 관계를 판단하려면 그림을 두 개로 나눠 각자의 축에서 추세를 보거나, 상관계수처럼
축과 무관한 수치로 확인해야 한다.

</details>

**문제 V5-3.** `yearly.groupby('년')['평균기온'].mean()`으로 구한 "가장 추운 해"가 1953년이라고
보고서에 썼다. 이 결론에서 무엇을 더 확인해야 하는가?

<details><summary>답</summary>

그 해의 평균을 며칠로 계산했는지(`count()`)를 확인해야 한다. 1953년은 실제로 12월 한 달
(31일)치 값만 있어서 "연평균"이 아니라 "12월 평균"에 가깝다. 날수가 충분한 해만 놓고 다시
계산하면 가장 추운 해는 1947년으로 바뀐다. `mean()`은 있는 값만으로 정직하게 계산하지만,
몇 개의 값으로 계산했는지는 별도로 확인해야 한다.

</details>

**문제 V5-4.** 인구 피라미드에서 여자 쪽 막대를 `-여성인구`로 그렸더니 x축 눈금에 `-50000`
같은 값이 찍혔다. 이 눈금을 그대로 보고서에 실어도 되는가? 안 된다면 어떻게 고치는가?

<details><summary>답</summary>

안 된다. 인구는 음수가 될 수 없으므로 `-50000`은 사실이 아니라 "왼쪽 방향으로 그리기 위해
부호만 뒤집었다"는 그리기 방식의 흔적이다. 막대의 방향(왼쪽 = 여자)은 그대로 두고, 눈금
라벨만 절댓값으로 바꾼다 — `ax.set_xticklabels`에 `abs()`를 적용한 문자열을 넣거나
`matplotlib.ticker.FuncFormatter`로 눈금이 그려질 때마다 절댓값으로 바꾸게 한다.

</details>

### 🧪 실습실
> 웹앱 **V5**에서 **y축 자르기** 시뮬레이터로 축 시작값을 슬라이더로 옮기며 막대 높이의
> "보이는 비율"과 "실제 비율"이 얼마나 벌어지는지 확인해 보라. **결측의 계곡** 시뮬레이터는
> 연평균 선과 날수 막대를 나란히 두고 "날수 360일 미만인 해 빼기"를 토글로 켜고 끌 수 있다.
> **인구 피라미드** 시뮬레이터에서는 시도를 바꿔 가며 눈금을 절댓값으로 켜고 끌 수 있다.

---

## V6장. EDA 실습 — 부산 강수량 118년

> 지금까지 배운 것을 혼자 써서 처음 보는 자료를 끝까지 탐색한다. 이 장을 읽고 나면 결측을
> 판단하는 절차, 시계열·그룹으로 요약하는 방법, 그리고 본 것을 세 줄로 정리하는 습관을
> 갖게 된다.

### V6.1 문제 제기 — 63.8%가 비어 있는 자료

부산의 일별 강수량 자료를 불러온다.

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

pd.set_option('display.max_columns', 30)
pd.set_option('display.width', 200)
pd.set_option('display.max_colwidth', 40)
plt.rc('font', family='Malgun Gothic')   # 맥은 'AppleGothic'
plt.rc('axes', unicode_minus=False)

# 출처: 기상청 기상자료개방포털 (공공누리 제1유형)
rain = pd.read_csv('busan_rain_day.csv', encoding='cp949')
print(rain.shape)
print(rain['강수량'].isna().sum())
print(rain['강수량'].isna().mean())
```

```text
(43100, 3)
27477
0.6375174013921113
```

118년치 43,100일 중 27,477일(63.8%)이 결측이다. 절반이 훨씬 넘는다. "그냥 결측인 행을
지우면 되지 않을까" — 해 보자.

```python
# ⚠ 에러도 경고도 없다. 그런데 데이터의 3분의 2 가까이가 사라진다
지운뒤 = rain.dropna()
print(지운뒤.shape)
```

```text
(15623, 3)
```

43,100행이 15,623행으로 준다. 지운 게 정말 "쓸모없는 빈 자리"인지, 아니면 다른 뜻을 가진
값인지 먼저 판단해야 한다 — 이 장의 ②가 그 판단을 다룬다. 그전에 자료를 한 번 훑어보자.

### V6.2 ① 불러오기·기본 확인

```python
print(rain.head(3))
print(rain.tail(3))
```

```text
          날짜   지점  강수량
0  1907-01-01  159  NaN
1  1907-01-02  159  NaN
2  1907-01-03  159  0.0
              날짜   지점  강수량
43097  2024-12-29  159  NaN
43098  2024-12-30  159  NaN
43099  2024-12-31  159  NaN
```

`train.csv`나 `seoul_temp_day.csv`와 달리 이 파일은 탭도, 빈 행도 없다. 날짜가
문자열이라는 것과 `지점`이 처음부터 정수(159, 부산)라는 것만 확인하고 바로 다음으로 간다.

```python
rain.info()
```

```text
<class 'pandas.DataFrame'>
RangeIndex: 43100 entries, 0 to 43099
Data columns (total 3 columns):
 #   Column  Non-Null Count  Dtype  
---  ------  --------------  -----  
 0   날짜      43100 non-null  str    
 1   지점      43100 non-null  int64  
 2   강수량     15623 non-null  float64
dtypes: float64(1), int64(1), str(1)
memory usage: 1010.3 KB
```

`강수량`만 결측이 있다는 것을 `info()`가 한 번에 보여 준다. 날짜를 다룰 수 있게 바꾼다.

```python
rain['날짜'] = pd.to_datetime(rain['날짜'])
rain['년'] = rain['날짜'].dt.year
rain['월'] = rain['날짜'].dt.month
print(rain['년'].min(), rain['년'].max())
```

```text
1907 2024
```

### V6.3 ② ★ 결측은 무엇인가

결측이 63.8%나 되면 그 뜻부터 판단해야 한다. 후보는 두 가지다 — 관측 장비가 고장 나서
기록을 못 한 **관측 공백**이거나, 비가 안 와서 적을 값이 없어 **비워 둔 것**이거나.
둘 중 어느 쪽인지 증거를 모은다.

**증거 ① — 결측 비율이 해마다 고르다.** 관측 공백이라면 특정 시기(장비 고장 기간)에
몰려 있어야 자연스럽다.

```python
연도별결측률 = rain.groupby('년')['강수량'].apply(lambda s: s.isna().mean())
print(연도별결측률.describe())
```

```text
count    118.000000
mean       0.637521
std        0.042071
min        0.452055
25%        0.608219
50%        0.636986
75%        0.663251
max        0.742466
Name: 강수량, dtype: float64
```

118개 해 전부 결측 비율이 45~74% 사이에 있다. 어느 한 해가 통째로 비어 있지도, 통째로 채워져
있지도 않다 — 118년 동안 고르게 반복되는 패턴이다.

**증거 ② — 결측 비율이 달마다 다르고, 그 차이가 강수량과 반대로 움직인다.**

```python
월별결측률 = rain.groupby('월')['강수량'].apply(lambda s: s.isna().mean())
월별평균 = rain.groupby('월')['강수량'].mean()
print(pd.DataFrame({'결측률': 월별결측률.round(3), '평균강수량': 월별평균.round(1)}))
```

```text
      결측률  평균강수량
월               
1   0.756    4.4
2   0.710    5.5
3   0.654    7.7
4   0.610   11.7
5   0.621   12.1
6   0.536   14.6
7   0.449   16.6
8   0.544   14.5
9   0.553   13.7
10  0.729    8.3
11  0.723    6.3
12  0.767    4.3
```

```python
# 그림: v6-missing-vs-rain
fig, axes = plt.subplots(2, 1, figsize=(8, 6), sharex=True)
axes[0].bar(월별결측률.index, 월별결측률.to_numpy(), color='tab:blue')
axes[0].set_ylabel('결측 비율')
axes[0].set_title('월별 결측 비율')
axes[1].bar(월별평균.index, 월별평균.to_numpy(), color='tab:blue')
axes[1].set_ylabel('평균 강수량(mm)')
axes[1].set_xlabel('월')
axes[1].set_title('월별 평균 강수량 (결측을 뺀 mean())')
plt.tight_layout()
plt.show()
```

![월별 결측 비율과 월별 평균 강수량을 위아래로 나란히 그린 막대그래프. 비가 많은 7월에 결측이 가장 적다](docs/fig/v6-missing-vs-rain.png)

비가 가장 많이 오는 7월(16.6mm)이 결측이 가장 적고(44.9%), 비가 가장 적은 12월·1월이
결측이 가장 많다(76% 안팎). **관측 장비가 계절을 가려 가며 고장 났다고 보기는 어렵다.**
반대로 "비가 안 온 날은 적을 값이 없어서 빈칸으로 남긴다"는 관례라면 이 패턴이 정확히
설명된다.

**증거 ③ — `0.0`이라는 값이 따로 있다.**

```python
print((rain['강수량'] == 0.0).sum())
print((rain['강수량'] > 0).sum())
```

```text
3792
11831
```

관측 장비가 "비가 0mm 왔다"는 것과 "기록이 없다"는 것을 구분해서 남긴다는 뜻이다. 만약
결측이 전부 "비가 0mm"였다면 `0.0`이라는 값이 따로 있을 이유가 없다. 세 증거를 합치면:
**이 결측은 관측 공백이 아니라 "비가 오지 않아 적지 않은 날"로 읽는 것이 합리적이다.**

이 판단에 따라 숫자가 달라진다. 합계와 평균을 두 가지 방법으로 비교해 보자.

```python
합계_원본 = rain['강수량'].sum()
합계_0채움 = rain['강수량'].fillna(0).sum()
평균_원본 = rain['강수량'].mean()
평균_0채움 = rain['강수량'].fillna(0).mean()
print(f'합계: {합계_원본:.1f}mm (원본) vs {합계_0채움:.1f}mm (0으로 채움)')
print(f'평균: {평균_원본:.3f}mm (원본) vs {평균_0채움:.3f}mm (0으로 채움)')
print(f'평균의 비율: {평균_원본 / 평균_0채움:.2f}배')
```

```text
합계: 173518.3mm (원본) vs 173518.3mm (0으로 채움)
평균: 11.107mm (원본) vs 4.026mm (0으로 채움)
평균의 비율: 2.76배
```

**합계는 조금도 바뀌지 않는다** — `sum()`은 애초에 `NaN`을 0처럼 취급하고 더하기 때문이다
(합칠 값이 없으면 더할 게 없을 뿐이다). 그런데 **평균은 2.76배 차이가 난다** — 나누는
분모(날수)가 15,623일(비가 왔거나 기록이 있는 날만)인지 43,100일(전체 날)인지가 완전히
다르기 때문이다. "부산의 일평균 강수량"이라는 말 한마디에도 어느 분모를 썼는지가 숨어 있다.
이 판단은 pandas가 대신 내려 주지 않는다.

### V6.4 ③ 단일 변수 살펴보기 — 비 온 날의 분포

전체가 아니라 실제로 비가 온 날(강수량 > 0)만 놓고 분포를 본다.

```python
rainy = rain[rain['강수량'] > 0]['강수량']
print(rainy.describe())
```

```text
count    11831.000000
mean        14.666410
std         25.237762
min          0.100000
25%          1.000000
50%          4.900000
75%         17.500000
max         439.000000
Name: 강수량, dtype: float64
```

평균(14.7mm)이 중앙값(4.9mm)보다 훨씬 크다 — 적은 비가 대부분이고, 아주 많이 오는 날이
드물게 섞여 평균을 끌어올린다는 뜻이다. 히스토그램으로 확인한다.

```python
# 그림: v6-rainy-dist
fig, axes = plt.subplots(1, 2, figsize=(10, 4.5))
axes[0].hist(rainy, bins=40, color='tab:blue')
axes[0].set_xlabel('강수량(mm)')
axes[0].set_title('그대로')
axes[1].hist(rainy, bins=40, color='tab:blue')
axes[1].set_yscale('log')
axes[1].set_xlabel('강수량(mm)')
axes[1].set_title('y축을 로그로')
plt.tight_layout()
plt.show()
```

![비 온 날의 강수량 히스토그램. 왼쪽은 그대로, 오른쪽은 y축을 로그로 바꿔 꼬리를 드러낸다](docs/fig/v6-rainy-dist.png)

왼쪽 그림에서는 10mm를 넘는 날이 거의 안 보일 만큼 눌려 있다. y축을 로그로 바꾸면(오른쪽)
빈도가 낮은 큰 값들도 눈에 들어온다 — 대부분의 비는 약하게 오고, 아주 많이 오는 날은 수는
적어도 분명히 존재한다는 것이 드러난다.

### V6.5 ④ 시계열과 그룹으로 요약하기

한 해의 강수량 합계를 구할 때는 `min_count=1`을 준다 — 그 해가 (있을 리는 없지만) 전부
결측이면 `0`이 아니라 `NaN`으로 남기기 위해서다.

```python
연강수량 = rain.groupby('년')['강수량'].sum(min_count=1)
print(f'최대: {연강수량.idxmax()}년 {연강수량.max():.1f}mm')
print(f'최소: {연강수량.idxmin()}년 {연강수량.min():.1f}mm')
print(f'평년(1991~2020) 평균: {연강수량.loc[1991:2020].mean():.1f}mm')
```

```text
최대: 1999년 2396.7mm
최소: 1929년 772.7mm
평년(1991~2020) 평균: 1576.7mm
```

```python
# 그림: v6-annual-rain
plt.figure(figsize=(10, 4.5))
plt.plot(연강수량.index, 연강수량.to_numpy(), color='tab:blue')
plt.axhline(연강수량.loc[1991:2020].mean(), color='#898781', linestyle='--', linewidth=1,
            label='평년(1991~2020)')
plt.scatter([연강수량.idxmax()], [연강수량.max()], color='#1baf7a', zorder=3, label='최대(1999)')
plt.scatter([연강수량.idxmin()], [연강수량.min()], color='#d03b3b', zorder=3, label='최소(1929)')
plt.ylabel('연강수량(mm)')
plt.xlabel('년')
plt.legend()
plt.title('부산 연강수량 118년')
plt.show()
```

![부산 연강수량 118년 선 그래프. 1999년 최대, 1929년 최소가 표시되어 있다](docs/fig/v6-annual-rain.png)

가장 비가 많이 온 해와 적게 온 해의 차이는 3배가 넘는다. 이제 월별로 묶어 어느 달에 비가
몰리는지 본다. 이번에는 `min_count`를 주지 않는다 — 한 달이 통째로 결측인 경우(예:
1987년 12월)가 실제로 있고, 그런 달은 "그 달은 0mm"로 보는 것이 이 절의 목적(계절 패턴)에
맞기 때문이다.

```python
연도별월합계 = rain.groupby(['년', '월'])['강수량'].sum().reset_index()
월별평균2 = 연도별월합계.groupby('월')['강수량'].mean()
print(월별평균2.round(1))
```

```text
월
1     32.9
2     44.8
3     82.9
4    137.1
5    142.0
6    203.4
7    284.3
8    205.7
9    184.3
10    69.9
11    52.3
12    30.9
Name: 강수량, dtype: float64
```

```python
# 그림: v6-monthly-rain
plt.figure(figsize=(9, 4.5))
색 = ['tab:orange' if m == 월별평균2.idxmax() else 'tab:blue' for m in 월별평균2.index]
plt.bar(월별평균2.index, 월별평균2.to_numpy(), color=색)
plt.ylabel('월 강수량 평균(mm)')
plt.xlabel('월')
plt.title('월별 평균 강수량 (해마다 월 합계를 낸 뒤 평균)')
plt.show()
```

![부산 월별 평균 강수량 막대그래프. 7월이 가장 높게 강조되어 있다](docs/fig/v6-monthly-rain.png)

7월(284.3mm)이 가장 많고 12월(30.9mm)이 가장 적다 — 장마와 태풍이 겹치는 여름에 강수가
집중된다는 사실이 숫자로 드러난다. 가장 비가 많이 온 날도 확인해 보자.

```python
최다일 = rain.loc[rain['강수량'].idxmax()]
print(최다일[['날짜', '강수량']])
```

```text
날짜     1991-08-23 00:00:00
강수량                   439.0
Name: 30915, dtype: object
```

하루 만에 439.0mm — 이 날 무슨 기상 현상이 있었는지는 이 표만으로는 알 수 없다. 날짜와
숫자 이상을 알고 싶다면 다른 자료를 찾아봐야 한다.

### V6.6 ⑤ 시각화 — seaborn으로 다시 그리기

118개 해를 막대로 다 그리면 x축 글자가 겹쳐 읽을 수 없다. 최근 30년만 미리 집계해서
그린다(전체 흐름은 앞의 선 그래프에서 이미 보았다).

```python
# 그림: v6-sns-barplot
최근30 = 연강수량.loc[1995:2024].reset_index()
최근30.columns = ['년', '강수량']
plt.figure(figsize=(11, 4.5))
sns.barplot(data=최근30, x='년', y='강수량', color='tab:blue')
plt.xticks(rotation=90)
plt.title('최근 30년 연강수량 (미리 집계한 값을 그린다)')
plt.show()
```

![최근 30년 연강수량 막대그래프](docs/fig/v6-sns-barplot.png)

`sns.pointplot`으로 월별 평균과 해마다의 흩어진 정도(오차 막대)를 함께 본다.

```python
# 그림: v6-sns-pointplot
plt.figure(figsize=(9, 4.5))
sns.pointplot(data=연도별월합계, x='월', y='강수량', color='tab:blue')
plt.ylabel('월 강수량(mm)')
plt.title('월별 평균과 해마다의 흩어짐(오차 막대)')
plt.show()
```

![월별 강수량 포인트플롯. 7월 근처가 가장 높고 오차 막대도 크다](docs/fig/v6-sns-pointplot.png)

7월 근처의 오차 막대가 가장 길다 — 평균만 큰 게 아니라 **해마다 편차도 크다**(장마·태풍이
드는 해와 아닌 해의 차이). 월별 분포를 상자그림으로도 본다. 이번에는 비 온 날의 실제 값만
쓴다.

```python
# 그림: v6-sns-boxplot
# ✗ 경고가 뜬다. matplotlib 3.11 이 boxplot 의 옛 매개변수(vert)를 없애는 중이고
#   seaborn 0.13.2 는 아직 그 이름을 쓴다 — 그림 자체는 정상이다 (부록 시각화 C-10)
plt.figure(figsize=(9, 4.5))
sns.boxplot(data=rain[rain['강수량'] > 0], x='월', y='강수량', color='tab:blue')
plt.ylabel('강수량(mm)')
plt.title('월별 강수량 분포 (비 온 날만)')
plt.show()
```

```text
MatplotlibDeprecationWarning: vert: bool was deprecated in Matplotlib 3.11 and
will be removed in 3.13. Use orientation: {'vertical', 'horizontal'} instead.
```

![월별 강수량 상자그림. 여름 달의 상자가 더 크고 수염 밖 점도 많다](docs/fig/v6-sns-boxplot.png)

이 경고는 코드가 틀려서가 아니라 matplotlib과 seaborn의 지금 버전 조합 때문에 뜬다 —
seaborn 안쪽 코드가 matplotlib이 없애는 중인 옛 이름(`vert`)을 아직 쓰고 있어서다(부록 시각화
C-10). 학생이 고칠 수 있는 부분이 아니고 그림도 정상적으로 그려진다. 상자 위쪽 수염 밖으로
점이 많이 튀는 달일수록 극단적인 폭우가 잦다는 뜻이다. 이 경고는 상자그림을 부를 때마다
뜨므로, 이제부터는 그 문구 하나만 걸러서 조용히 만든다 — 경고 전체를 끄는 것과는 다르다.

마지막으로 계절별로 나눠 각 계절 안에서 강수량이 어떻게 흩어져 있는지 한 번에 비교한다.
`catplot`은 범주마다 작은 그림을 나란히 그려 준다 — 12개 달 대신 4개 계절로 묶어 한눈에
비교한다.

```python
def 계절(월):
    if 월 in (3, 4, 5):
        return '봄'
    if 월 in (6, 7, 8):
        return '여름'
    if 월 in (9, 10, 11):
        return '가을'
    return '겨울'

rain_계절 = rain[rain['강수량'] > 0].copy()
rain_계절['계절'] = rain_계절['월'].apply(계절)
```

```python
# 그림: v6-sns-catplot
import warnings
warnings.filterwarnings('ignore', message='vert: bool was deprecated')  # 부록 시각화 C-10
g = sns.catplot(data=rain_계절, x='강수량', col='계절', kind='box',
                 col_order=['봄', '여름', '가을', '겨울'], color='tab:blue', height=3.2)
g.figure.suptitle('계절별 강수량 분포 (비 온 날만)', y=1.05)
plt.show()
```

![계절별 강수량 상자그림 네 칸. 여름 칸이 가장 오른쪽까지 늘어져 있다](docs/fig/v6-sns-catplot.png)

여름 상자가 가장 오른쪽까지 늘어져 있다 — 여름에 강한 비가 가장 자주, 가장 세게 온다는
것을 계절 네 개로 압축해서 보여 준다.

극값도 따로 짚어 보자.

```python
# 그림: v6-top-extreme-days
상위10 = rain.nlargest(10, '강수량')[['날짜', '강수량']].sort_values('강수량')
plt.figure(figsize=(8, 4.5))
plt.barh(상위10['날짜'].dt.strftime('%Y-%m-%d'), 상위10['강수량'], color='tab:blue')
plt.xlabel('강수량(mm)')
plt.title('일강수량 상위 10일 (118년 중)')
plt.show()
```

![일강수량 상위 10일을 가로 막대로 나열한 그래프](docs/fig/v6-top-extreme-days.png)

### V6.7 ⑥ 통찰 정리

지금까지 본 것을 세 줄로 정리한다. 아래는 예시일 뿐이다 — 실제로는 자기가 직접 확인한
것만 자기 말로 쓴다.

1. 부산 강수량 자료는 63.8%가 결측이지만, 해마다 고르게 나타나고 비가 잦은 달일수록
   결측이 적다 — "비가 안 와서 비워 둔 것"으로 판단했다.
2. 그래서 연강수량 합계는 결측 처리 방식과 관계없이 그대로지만, 일평균은 결측을 0으로
   볼 때와 아닐 때가 2.76배 차이 난다.
3. 가장 비가 많이 온 해(1999, 2396.7mm)와 적게 온 해(1929, 772.7mm)가 3배 넘게 차이
   난다는 것은 확인했지만, 그 차이를 만든 개별 기상 현상이 무엇인지는 이 표만으로는
   알 수 없다.

### V6.8 흔한 실수

**결측 비율만 보고 바로 지운다.** 63.8%라는 숫자만 보면 "거의 못 쓰는 자료"로 보이지만,
그 결측이 무엇을 뜻하는지 확인하면(V6.3의 세 증거) 오히려 지우지 않고 그대로 쓰는 게 맞는
경우도 있다.

**`sum()`에 `min_count`를 안 준다.** 기본값(`min_count=0`)은 그 그룹이 전부 결측이어도
`0`을 돌려준다 — "0mm 확실"과 "그 기간은 기록이 아예 없음"이 구별되지 않는다.

```python
연도별월합계2 = rain.groupby(['년', '월'])['강수량'].sum()
연도별월합계3 = rain.groupby(['년', '월'])['강수량'].sum(min_count=1)
print(연도별월합계2.loc[(1987, 12)])
print(연도별월합계3.loc[(1987, 12)])
```

```text
0.0
nan
```

1987년 12월은 하루도 강수량 기록이 없는 달이다. `min_count`가 없는 `sum()`은 이걸 "비가
0mm"로 둔갑시킨다. **그 기간에 정말 관측이 있었는지 확실하지 않다면 `min_count=1`을 쓴다.**

**표본 크기를 다르게 두고 두 값을 비교한다.** V6.4에서 본 것처럼 "평균 강수량"이라는
말 한마디에도 분모가 15,623일(비 온 날만)인지 43,100일(전체 날)인지가 숨어 있다. 값을
발표할 때는 분모가 무엇인지도 함께 말한다.

### 확인 문제

**문제 V6-1.** `rain['강수량'].isna().sum()`이 27,477이라는 걸 보고 "관측 장비가 자주
고장 났다"고 결론 내렸다. 이 결론에 반박할 증거를 이 장에서 찾아 두 가지 이상 말하라.

<details><summary>답</summary>

두 가지 이상: ① 결측 비율이 118년 내내 45~74% 사이에서 고르게 나타난다 — 장비 고장이라면
특정 시기에 몰려야 자연스러운데 그렇지 않다. ② 결측 비율이 비가 많이 오는 달(7월, 44.9%)에
낮고 적게 오는 달(12월·1월, 76% 안팎)에 높다 — 강수량과 반대로 움직이는 패턴은 장비 고장이
아니라 "비가 안 와서 적지 않았다"는 설명과 맞아떨어진다. ③ 결측과 별도로 `0.0`이라는 값이
3,792일 있다 — 장비가 "비가 0mm 왔다"와 "기록이 없다"를 구분해서 남긴다는 뜻이다.

</details>

**문제 V6-2.** 연강수량의 합계는 결측을 0으로 채우든 안 채우든 똑같은데, 일평균은 왜
2.76배나 차이가 나는가?

<details><summary>답</summary>

`sum()`은 더할 값이 없으면(결측) 그냥 더하지 않을 뿐이라서 결측을 0으로 채우든 안 채우든
합계 자체는 바뀌지 않는다. 반면 평균은 합계를 "며칠로 나누는가"에 따라 달라진다. 결측을
빼고 계산하면 분모가 15,623일(강수량 값이 있는 날)이고, 결측을 0으로 채우면 분모가
43,100일(전체 날)이 된다 — 분모가 거의 3배 차이 나므로 평균도 그만큼 달라진다.

</details>

**문제 V6-3.** `rain.groupby(['년', '월'])['강수량'].sum()`(min_count 없이)과
`sum(min_count=1)`의 결과가 다른 딱 한 자리가 있다. 왜 그 자리에서만 다른가?

<details><summary>답</summary>

1987년 12월이다. 이 달은 하루도 강수량 값이 없는(전부 결측인) 유일한 달이다.
`min_count`가 없는 기본 `sum()`은 더할 값이 하나도 없어도 `0.0`을 돌려주는데,
`min_count=1`을 주면 "적어도 하나는 값이 있어야 진짜 합계로 인정한다"는 뜻이 되어 이
달만 `NaN`으로 남는다. 다른 달·해는 결측이 섞여 있어도 값이 하나 이상은 있어서 두 방식의
결과가 같다.

</details>

### 🧪 실습실
> 웹앱 **V6**에서 **결측 판단 실험실**의 "결측 = 0" 토글을 켜고 꺼 보며 합계·평균·중앙값·
> 날수가 어떻게 따로 움직이는지 확인해 보라. **연·월 집계 탐색기**로 연도·월·계절을 바꿔
> 가며 강수량 합계 막대를 직접 만들어 보고, **극값 찾기**로 상위 며칠·몇 해가 전체 그림을
> 얼마나 좌우하는지 살펴보라.
