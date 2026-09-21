# -*- coding: utf-8 -*-
"""2부(데이터 시각화) Phase 0 — 원본 코드의 실제 동작과 데이터 사실을 확인한다.

규칙(CLAUDE.md §4):
  · 항목마다 격리된 전역에서 돌린다 — 앞 항목이 이름을 덮으면 결과가 조용히 틀어진다
  · 경고까지 캡처한다 — ChainedAssignmentError·FutureWarning 은 예외가 아니다
  · [EXCEPTION] 이 뜨면 라이브러리보다 하네스를 먼저 의심한다
"""
import os, warnings, traceback, io, contextlib
os.environ.setdefault("MPLBACKEND", "Agg")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "수업자료", "데이터시각화")
TEMP = os.path.join(ROOT, "seoul_temp_day.csv")
RAIN = os.path.join(ROOT, "busan_rain_day.csv")
YEAR = os.path.join(ROOT, "데이터시각화자료", "seoul_temp.csv")
POP = os.path.join(ROOT, "데이터시각화자료", "korea_pop.csv")

if not all(os.path.exists(p) for p in (TEMP, RAIN, YEAR, POP)):
    print("원본(수업자료/데이터시각화)이 없다 — 아무것도 하지 않는다.")
    raise SystemExit(0)

print("pandas", pd.__version__, "| seaborn", sns.__version__, "| matplotlib", matplotlib.__version__, "| numpy", np.__version__)

CASES = []
def case(tag, src): CASES.append((tag, src))

BASE = {'pd': pd, 'np': np, 'plt': plt, 'sns': sns, 'TEMP': TEMP, 'RAIN': RAIN, 'YEAR': YEAR, 'POP': POP}

# ═══════════════════════════════════════ A. 데이터 사실 (정답표)
case("A1 서울 일별 기온 — 원본 그대로 읽기", """
df = pd.read_csv(TEMP, encoding='cp949')
print('shape', df.shape, '| dtypes', dict(df.dtypes.astype(str)))
print('날짜 첫 값 repr:', repr(df['날짜'].iloc[0]), '| 마지막 행:', df.iloc[-1].tolist())
print('결측:', df.isna().sum().to_dict())
print('지점 고유값:', df['지점'].unique().tolist())
""")

case("A2 서울 — 정리 후 (\\\\t 제거, 빈 행 제거, 날짜 변환)", """
df = pd.read_csv(TEMP, encoding='cp949')
df['날짜'] = df['날짜'].str.strip()
df = df[df['날짜'] != '']
df['날짜'] = pd.to_datetime(df['날짜'])
print('shape', df.shape, '| 기간', df['날짜'].min().date(), '~', df['날짜'].max().date())
print('지점 dtype 빈 행 제거 후:', df['지점'].dtype, '-> astype(int) 가능:', df['지점'].astype(int).unique().tolist())
print('결측:', df[['평균기온','최저기온','최고기온']].isna().sum().to_dict())
y = df['날짜'].dt.year
miss = df.groupby(y)['평균기온'].apply(lambda s: int(s.isna().sum()))
print('평균기온 결측이 있는 해:', miss[miss > 0].to_dict())
days = df.groupby(y).size()
print('일수가 365/366 이 아닌 해:', {k: int(v) for k, v in days.items() if v not in (365, 366)})
print('빠진 해(행이 아예 없는 해):', sorted(set(range(1907, 2025)) - set(days.index)))
hi = df.loc[df['최고기온'].idxmax()]; lo = df.loc[df['최저기온'].idxmin()]
print('최고기온 최대:', hi['날짜'].date(), hi['최고기온'], '| 최저기온 최소:', lo['날짜'].date(), lo['최저기온'])
ann = df.groupby(y)['평균기온'].mean()
print('연평균(일평균의 평균) 1910s:', round(ann.loc[1910:1919].mean(), 2), '| 2015~2024:', round(ann.loc[2015:2024].mean(), 2))
print('연평균 최고 해:', int(ann.idxmax()), round(ann.max(), 2), '| 최저 해:', int(ann.idxmin()), round(ann.min(), 2))
m = df.groupby(df['날짜'].dt.month)['평균기온'].mean().round(2)
print('월별 평균기온(전 기간):', m.to_dict())
r = df[['평균기온','최저기온','최고기온']].corr().round(4)
print('상관계수:\\n', r)
""")

case("A3 부산 일별 강수량 — 결측의 정체", """
df = pd.read_csv(RAIN, encoding='cp949')
print('shape', df.shape, '| 날짜 repr', repr(df['날짜'].iloc[0]), '| dtypes', dict(df.dtypes.astype(str)))
df['날짜'] = pd.to_datetime(df['날짜'].str.strip())
print('기간', df['날짜'].min().date(), '~', df['날짜'].max().date())
print('강수량 결측', int(df['강수량'].isna().sum()), '/', len(df), '| 0.0 인 날', int((df['강수량'] == 0).sum()), '| 양수인 날', int((df['강수량'] > 0).sum()))
y = df['날짜'].dt.year
g = df.groupby(y)['강수량']
tbl = pd.DataFrame({'행': g.size(), '결측': g.apply(lambda s: int(s.isna().sum())), '값있음': g.count(), '0.0': g.apply(lambda s: int((s == 0).sum()))})
allnan = tbl[tbl['값있음'] == 0]
print('한 해 전체가 결측인 해:', allnan.index.tolist())
print('연도별 표 (앞 5, 1940~1955, 뒤 3):')
print(pd.concat([tbl.head(5), tbl.loc[1940:1955], tbl.tail(3)]).to_string())
print('0.0 이 처음 나오는 날:', df.loc[df['강수량'] == 0, '날짜'].min().date())
tot = g.sum(min_count=1)
print('연강수량 최대:', int(tot.idxmax()), tot.max(), '| 최소(값 있는 해):', int(tot.idxmin()), tot.min())
print('fillna(0) 뒤 연합계 == 원래 합계? ', bool((df.fillna({'강수량': 0}).groupby(y)['강수량'].sum() == g.sum()).all()))
print('1991~2020 평년 연강수량(평균):', round(tot.loc[1991:2020].mean(), 1))
print('일 최대:', df.loc[df['강수량'].idxmax(), '날짜'].date(), df['강수량'].max())
""")

case("A4 서울 연별 기온 (PDF 자료)", """
df = pd.read_csv(YEAR, encoding='cp949')
print('shape', df.shape, '| 년 범위', df['년'].min(), '~', df['년'].max())
print('결측 행:'); print(df[df.isna().any(axis=1)].to_string())
print('빠진 해:', sorted(set(range(df['년'].min(), df['년'].max()+1)) - set(df['년'])))
df['기온차'] = df['최고기온'] - df['최저기온']
print('기온차 상위 5:'); print(df.sort_values('기온차', ascending=False).head(5)[['년','최고기온','최저기온','기온차']].to_string())
""")

case("A5 인구 (korea_pop.csv) — 310열", """
df = pd.read_csv(POP, encoding='cp949', thousands=',')
print('shape', df.shape)
print('행정구역 앞 3:', df['행정구역'].head(3).tolist())
cols = list(df.columns)
print('열 106, 206, 207, -101, -1:', cols[106], '|', cols[206], '|', cols[207], '|', cols[-101], '|', cols[-1])
print('계_0세 위치:', cols.index('2021년08월_계_0세'), '| 남_0세 위치:', cols.index('2021년08월_남_0세'), '| 여_0세 위치:', cols.index('2021년08월_여_0세'))
print('남_총인구수 위치:', cols.index('2021년08월_남_총인구수'))
man = df.iloc[0, 106:207].to_numpy(); print('iloc[0,106:207] 길이', len(man), '| 첫/끝 열', cols[106], '/', cols[206])
print('dtype 확인(값 문자열?):', df.dtypes.value_counts().to_dict())
print('전국 총인구', int(df.loc[0, '2021년08월_계_총인구수']))
print('대구 총인구', int(df.loc[df['행정구역'].str.contains('대구'), '2021년08월_계_총인구수'].iloc[0]))
j = df[df['행정구역'].str.contains('제주')]
jm = j.filter(regex=r'_남_\\d+세|_남_100세 이상').iloc[0].to_numpy(dtype=int)
jw = j.filter(regex=r'_여_\\d+세|_여_100세 이상').iloc[0].to_numpy(dtype=int)
print('filter 로 뽑은 제주 남/여 길이', len(jm), len(jw), '| 합계 차이(남-여)', int((jm - jw).sum()))
d = jm - jw
print('남>여 최대 나이', int(d.argmax()), int(d.max()), '| 여>남 최대 나이', int((-d).argmax()), int((-d).max()))
print('행정구역 문자열 끝 공백?', repr(df['행정구역'].iloc[1]))
""")

# ═══════════════════════════════════════ B. 원본 코드의 실제 동작 (정정표)
PRE = "df = pd.read_csv(TEMP, encoding='cp949')\ndf['날짜'] = df['날짜'].str.replace('\\t', '', regex=False)\n"

case("B1 fillna(method='bfill')  [8번 노트북 셀14]", PRE + """
df = df.fillna(method='bfill')
""")
case("B1b 대체 — bfill()", PRE + """
print('bfill 후 결측', int(df.bfill().isna().sum().sum()), '| ffill 후 결측', int(df.ffill().isna().sum().sum()))
""")

case("B2 df['평균기온'].fillna(0, inplace=True)  [8번 노트북 셀12 설명]", PRE + """
before = int(df['평균기온'].isna().sum())
df['평균기온'].fillna(0, inplace=True)
print('결측 전', before, '-> 후', int(df['평균기온'].isna().sum()))
""")
case("B2b 대체 — 대입", PRE + """
df['평균기온'] = df['평균기온'].fillna(0)
print('결측', int(df['평균기온'].isna().sum()))
""")

case("B3 str.split 로 년/월/일, 그리고 문자열 비교  [셀16, 셀22]", PRE + """
df = df[df['날짜'] != '']
df['년'] = df['날짜'].str.split('-', expand=True)[0]
print('년 dtype', df['년'].dtype, '| 예', df['년'].iloc[0])
g = df[df['년'] > '2010']
print('문자열 비교 결과 연도 범위', g['년'].min(), '~', g['년'].max(), '| 행', len(g))
print("'999' > '2010' =", '999' > '2010', "| '10000' > '2010' =", '10000' > '2010')
""")
case("B3b 숫자로 바꾼 뒤 문자열과 비교  [셀53 이후 셀22 재실행]", PRE + """
df = df[df['날짜'] != '']
df['년'] = pd.to_numeric(df['날짜'].str.split('-', expand=True)[0])
g = df[df['년'] > '2010']
""")

case("B4 temp_df.corr() — 문자열 열이 섞인 표  [셀49]", PRE + """
df = df.drop(columns=['지점'])
print(df.corr())
""")
case("B4b corr(numeric_only=True)", PRE + """
print(df.corr(numeric_only=True).round(3))
""")

case("B5 sns.distplot  [셀47, 61, 62]", """
print('distplot 존재:', hasattr(sns, 'distplot'))
sns.distplot(pd.Series([1.0, 2.0, 3.0, 2.5]))
""")
case("B5b FacetGrid.map(sns.distplot, ..., hist=False, rug=True)", """
d = pd.DataFrame({'y': [1,1,2,2], 'v': [1.0, 2.0, 3.0, 4.0]})
g = sns.FacetGrid(d, col='y')
g.map(sns.distplot, 'v', hist=False, rug=True)
""")

case("B6 barplot(ci='sd')  [셀18 설명]", """
d = pd.DataFrame({'x': list('aabb'), 'y': [1, 2, 3, 5]})
ax = sns.barplot(data=d, x='x', y='y', ci='sd')
""")
case("B6b barplot(palette='dark') 에 hue 없음  [셀22]", """
d = pd.DataFrame({'x': list('aabb'), 'y': [1, 2, 3, 5]})
ax = sns.barplot(data=d, x='x', y='y', palette='dark')
""")
case("B6c barplot 기본 막대 높이 = 평균, 오차막대 = 95% 신뢰구간(부트스트랩)", """
d = pd.DataFrame({'x': list('aaab'), 'y': [1, 2, 6, 5]})
ax = sns.barplot(data=d, x='x', y='y')
print('막대 높이:', [round(p.get_height(), 3) for p in ax.patches])
print('오차막대 선 개수:', len(ax.lines), '| a 의 오차막대 y 범위:', [round(v, 3) for v in ax.lines[0].get_ydata()])
""")

case("B7 plt.figure(figsize) 다음 plt.figure(dpi)  [셀20, 42]", """
plt.close('all')
plt.figure(figsize=(20, 3))
plt.figure(dpi=300)
plt.plot([1, 2, 3])
print('열린 그림 수:', len(plt.get_fignums()))
print('그림별 크기(인치):', [tuple(plt.figure(n).get_size_inches().round(1)) for n in plt.get_fignums()])
print('그림별 선 개수:', [len(plt.figure(n).axes[0].lines) if plt.figure(n).axes else 0 for n in plt.get_fignums()])
""")

case("B8 countplot(x='평균기온') — 연속값에 countplot  [셀26]", PRE + """
ax = sns.countplot(data=df, x='평균기온')
print('막대 수:', len(ax.patches), '| 평균기온 고유값 수:', df['평균기온'].nunique())
""")

case("B9 pointplot(hue='월') 에서 월이 문자열 '01'..'12'", PRE + """
df = df[df['날짜'] != '']
df['월'] = df['날짜'].str.split('-', expand=True)[1]
print('월 고유값 앞 3:', sorted(df['월'].unique())[:3], '| dtype', df['월'].dtype)
""")

case("B10 PDF(2) plt.figure(3, figsize=...) — 첫 인자는 무엇인가", """
plt.close('all')
f = plt.figure(3, figsize=(15, 5))
print('그림 번호:', f.number, '| 열린 그림:', plt.get_fignums(), '| 축 개수(subplot 전):', len(f.axes))
""")

case("B11 PDF(2) scatter 의 s 에 음수가 섞임", """
plt.close('all')
np.random.seed(0)
x = np.random.randint(-100, 100, 100); y = np.random.randint(-200, 200, 100)
size = np.random.randint(-200, 200, 100)
sc = plt.scatter(x, y, s=size)
print('음수 크기 개수:', int((size < 0).sum()))
""")

case("B12 PDF(4) sns.boxplot(Series, Series) 위치 인자", """
d = pd.DataFrame({'t': [0, 0, 1, 1], 'v': [1.0, 2.0, 3.0, 4.0]})
ax = sns.boxplot(d['t'], d['v'])
""")

case("B13 PDF(2) 인구 배열 오탈자 — 대구·인천", """
pop = pd.read_csv(POP, encoding='cp949', thousands=',')
print('대구 실제 총인구:', int(pop.loc[pop['행정구역'].str.contains('대구'), '2021년08월_계_총인구수'].iloc[0]), '| PDF 배열 값: 393626')
print('인천 위도: PDF 35.45619 (부산 35.18 과 비슷) — 실제 인천시청 위도 약 37.456')
""")

case("B14 read_csv 에 thousands 를 빼면", """
p = pd.read_csv(POP, encoding='cp949')
print('dtype 분포:', p.dtypes.astype(str).value_counts().to_dict())
print('전국 총인구 값 repr:', repr(p.iloc[0, 1]))
""")

case("B15 seaborn 은 hue 가 숫자면 연속 색(범례가 구간)", PRE + """
df = df[df['날짜'] != '']
df['월'] = pd.to_datetime(df['날짜']).dt.month
ax = sns.scatterplot(data=df.sample(500, random_state=0), x='최고기온', y='최저기온', hue='월')
leg = ax.get_legend()
print('범례 항목:', [t.get_text() for t in leg.get_texts()])
""")

for tag, src in CASES:
    print("\n" + "-" * 78 + "\n[" + tag + "]")
    g = dict(BASE)
    plt.close('all')
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        try:
            exec(compile(src, "<case>", "exec"), g)
        except Exception as e:
            print("  [예외] " + type(e).__name__ + ": " + str(e).splitlines()[0][:160])
    seen = set()
    for w in caught:
        if 'Glyph' in str(w.message) or 'missing from font' in str(w.message):
            continue   # 한글 글꼴 경고는 Agg 에서 늘 난다 — 동작과 무관
        key = (w.category.__name__, str(w.message)[:80])
        if key in seen: continue
        seen.add(key)
        print("  [경고] " + w.category.__name__ + ": " + str(w.message).replace('\n', ' ')[:200])
