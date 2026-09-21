# -*- coding: utf-8 -*-
"""정답표-시각화.md / 정답표-시각화.json 생성 — 2부(데이터 시각화)의 데이터 사실.

    python -X utf8 docs/scripts/make_facts_viz.py

교재 2부와 웹앱 V 장의 모든 수치는 이 표가 기준이다. 손으로 적지 않는다.
값을 고쳐야 하면 이 스크립트를 고쳐 다시 돌린다(docs/CLAUDE.md 규칙 ①).

★ 원본 폴더(수업자료/)가 없으면 아무것도 쓰지 않고 끝낸다 — 기존 정답표를 보존한다.
"""
import json
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, '수업자료', '데이터시각화')
OUT_MD = os.path.join(ROOT, 'docs', '정답표-시각화.md')
OUT_JSON = os.path.join(ROOT, 'docs', '정답표-시각화.json')

TEMP = os.path.join(SRC, 'seoul_temp_day.csv')
RAIN = os.path.join(SRC, 'busan_rain_day.csv')
YEAR = os.path.join(SRC, '데이터시각화자료', 'seoul_temp.csv')
POP = os.path.join(SRC, '데이터시각화자료', 'korea_pop.csv')

if not all(os.path.exists(p) for p in (TEMP, RAIN, YEAR, POP)):
    print('원본이 없다 — 기존 정답표를 그대로 둔다.')
    sys.exit(0)


def r(x, n=2):
    """표에 싣는 실수는 반올림한다. NaN 은 None 으로."""
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return round(float(x), n)


facts = {'versions': {'pandas': pd.__version__, 'numpy': np.__version__, 'python': sys.version.split()[0]}}
md = []
w = md.append

w('# 정답표 — 2부 데이터 시각화 (실제 pandas 로 계산)')
w('')
w('- pandas %s / numpy %s / python %s' % (pd.__version__, np.__version__, sys.version.split()[0]))
w('- 생성 스크립트: `docs/scripts/make_facts_viz.py` — **손으로 고치지 말고 스크립트를 다시 돌린다**')
w('- 원본: `수업자료/데이터시각화/` (기상청 기상자료개방포털 · 행정안전부 주민등록 인구통계)')
w('- **교재 2부·웹앱 V 장의 모든 수치는 이 표를 기준으로 한다.**')
w('')

# ═══════════════════════════════════════════════ 서울 일별 기온
raw = pd.read_csv(TEMP, encoding='cp949')
t = raw.copy()
t['날짜'] = t['날짜'].str.strip()
junk = t[t['날짜'] == '']
t = t[t['날짜'] != ''].copy()
t['날짜'] = pd.to_datetime(t['날짜'])
t['지점'] = t['지점'].astype(int)
yr = t['날짜'].dt.year
V = ['평균기온', '최저기온', '최고기온']

annual = t.groupby(yr).agg(행=('평균기온', 'size'), 평균기온_유효일=('평균기온', 'count'),
                            평균기온=('평균기온', 'mean'), 최저기온=('최저기온', 'min'),
                            최고기온=('최고기온', 'max'))
complete = annual[annual['평균기온_유효일'] >= 360]
hi = t.loc[t['최고기온'].idxmax()]
lo = t.loc[t['최저기온'].idxmin()]
month_clim = t.groupby(t['날짜'].dt.month)['평균기온'].mean()
decade = t.groupby((yr // 10) * 10)['평균기온'].mean()
corr = t[V].corr()

seoul = {
    'raw_shape': list(raw.shape),
    'raw_dtypes': {k: str(v) for k, v in raw.dtypes.items()},
    'raw_first_date_repr': repr(raw['날짜'].iloc[0]),
    'junk_rows': int(len(junk)),
    'junk_row_index': [int(i) for i in junk.index],
    'clean_shape': list(t.shape),
    'period': [str(t['날짜'].min().date()), str(t['날짜'].max().date())],
    'nan': {c: int(t[c].isna().sum()) for c in V},
    'nan_by_year': {int(k): int(v) for k, v in t.groupby(yr)['평균기온'].apply(lambda s: s.isna().sum()).items() if v},
    'rows_by_year_unusual': {int(k): int(v) for k, v in annual['행'].items() if v not in (365, 366)},
    'max_tmax': {'date': str(hi['날짜'].date()), 'value': float(hi['최고기온'])},
    'min_tmin': {'date': str(lo['날짜'].date()), 'value': float(lo['최저기온'])},
    'annual_mean_artifact_1953': {'mean': r(annual.loc[1953, '평균기온']), 'valid_days': int(annual.loc[1953, '평균기온_유효일'])},
    # 전쟁 기간에 값이 남은 날짜 구간 — "남은 것은 겨울" 같은 서술은 이것으로 확인한다
    'war_years_valid_span': {
        int(y): ([str(s['날짜'].min().date()), str(s['날짜'].max().date())] if len(s) else None)
        for y in (1950, 1951, 1952, 1953)
        for s in [t[(yr == y) & t['평균기온'].notna()]]
    },
    'war_years_row_span': {
        int(y): [str(s['날짜'].min().date()), str(s['날짜'].max().date())]
        for y in (1950, 1951, 1952, 1953)
        for s in [t[yr == y]]
    },
    'annual_mean_artifact_1907': {'mean': r(annual.loc[1907, '평균기온']), 'valid_days': int(annual.loc[1907, '평균기온_유효일'])},
    'coldest_year_naive': {'year': int(annual['평균기온'].idxmin()), 'mean': r(annual['평균기온'].min())},
    'coldest_year_complete': {'year': int(complete['평균기온'].idxmin()), 'mean': r(complete['평균기온'].min())},
    'warmest_year_complete': {'year': int(complete['평균기온'].idxmax()), 'mean': r(complete['평균기온'].max())},
    'normal_1991_2020': r(complete.loc[1991:2020, '평균기온'].mean()),
    'mean_1911_1940': r(complete.loc[1911:1940, '평균기온'].mean()),
    'mean_2015_2024': r(complete.loc[2015:2024, '평균기온'].mean()),
    'month_climatology': {int(k): r(v) for k, v in month_clim.items()},
    'decade_mean': {int(k): r(v) for k, v in decade.items()},
    'corr': {a: {b: r(corr.loc[a, b], 4) for b in V} for a in V},
    'annual': {int(k): {'rows': int(row['행']), 'valid': int(row['평균기온_유효일']),
                         'mean': r(row['평균기온']), 'min': r(row['최저기온'], 1), 'max': r(row['최고기온'], 1)}
               for k, row in annual.iterrows()},
}
facts['seoul_temp_day'] = seoul

w('## 1. `seoul_temp_day.csv` — 서울(지점 108) 일별 기온')
w('')
w('### 원본 그대로 읽었을 때 — `read_csv(encoding=\'cp949\')`')
w('')
w('- shape **%s**, dtypes %s' % (tuple(seoul['raw_shape']), ', '.join('`%s`=%s' % kv for kv in seoul['raw_dtypes'].items())))
w('- `날짜` 첫 값은 `%s` — **앞에 탭 문자가 붙어 있다**' % seoul['raw_first_date_repr'])
w('- **마지막 행(%s)이 빈 행이다** — 날짜는 탭 하나, 나머지는 전부 NaN.' % seoul['junk_row_index'])
w('  그래서 `지점` 이 정수가 아니라 **`float64`** 로 읽힌다(NaN 이 하나 섞였기 때문).')
w('')
w('### 정리한 뒤 — 탭 제거 · 빈 행 제거 · `pd.to_datetime`')
w('')
w('- shape **%s**, 기간 **%s ~ %s** (1907년은 10월 1일부터)' % (tuple(seoul['clean_shape']), *seoul['period']))
w('- 결측: ' + ', '.join('`%s` %d' % kv for kv in seoul['nan'].items()))
w('- 평균기온 결측이 있는 해: ' + ', '.join('%d년 %d일' % kv for kv in seoul['nan_by_year'].items()) + ' — **한국전쟁 기간**')
w('- 행 수가 365/366 이 아닌 해: ' + ', '.join('%d년 %d행' % kv for kv in seoul['rows_by_year_unusual'].items()))
w('- 최고기온 최댓값 **%.1f℃ (%s)**, 최저기온 최솟값 **%.1f℃ (%s)**' % (
    seoul['max_tmax']['value'], seoul['max_tmax']['date'], seoul['min_tmin']['value'], seoul['min_tmin']['date']))
w('')
w('### ★ 결측이 만드는 착시 — "가장 추운 해"')
w('')
w('| 방법 | 가장 추운 해 | 연평균 |')
w('|:---|:---|--:|')
w('| 연도별 `mean()` 을 그대로 | **%d년** | %.2f℃ |' % (seoul['coldest_year_naive']['year'], seoul['coldest_year_naive']['mean']))
w('| 유효일 360일 이상인 해만 | **%d년** | %.2f℃ |' % (seoul['coldest_year_complete']['year'], seoul['coldest_year_complete']['mean']))
w('')
sp53 = seoul['war_years_valid_span'][1953]
w('1953년은 유효일이 **%d일**뿐이고 그것이 **%s ~ %s**, 곧 12월 한 달이다. 1907년도 %d일(10~12월)뿐이라 연평균 %.2f℃ 로 낮게 나온다.' % (
    seoul['annual_mean_artifact_1953']['valid_days'], sp53[0], sp53[1],
    seoul['annual_mean_artifact_1907']['valid_days'], seoul['annual_mean_artifact_1907']['mean']))
w('`mean()` 은 NaN 을 건너뛰므로 **에러도 경고도 없이** 틀린 연평균을 낸다.')
w('')
w('전쟁 기간의 실제 모습:')
w('')
w('| 해 | 행이 있는 기간 | 평균기온 값이 있는 기간 |')
w('|:---|:---|:---|')
for y in (1950, 1951, 1952, 1953):
    rs = seoul['war_years_row_span'][y]; vs = seoul['war_years_valid_span'][y]
    w('| %d | %s ~ %s | %s |' % (y, rs[0], rs[1], ('%s ~ %s' % tuple(vs)) if vs else '**없음** (연평균 자체가 NaN)'))
w('')
w('### 기후 요약 (유효일 360일 이상인 해만)')
w('')
w('| 항목 | 값 |')
w('|:---|--:|')
w('| 가장 더운 해 | %d년 %.2f℃ |' % (seoul['warmest_year_complete']['year'], seoul['warmest_year_complete']['mean']))
w('| 1911~1940 평균 | %.2f℃ |' % seoul['mean_1911_1940'])
w('| 1991~2020 평균 (평년) | %.2f℃ |' % seoul['normal_1991_2020'])
w('| 2015~2024 평균 | %.2f℃ |' % seoul['mean_2015_2024'])
w('')
w('월별 평균기온(전 기간, 일평균의 평균):')
w('')
w('| ' + ' | '.join('%d월' % m for m in range(1, 13)) + ' |')
w('|' + '--:|' * 12)
w('| ' + ' | '.join('%.2f' % seoul['month_climatology'][m] for m in range(1, 13)) + ' |')
w('')
w('상관계수 (`corr()`, 세 열만):')
w('')
w('| | ' + ' | '.join(V) + ' |')
w('|:---|' + '--:|' * 3)
for a in V:
    w('| %s | ' % a + ' | '.join('%.4f' % seoul['corr'][a][b] for b in V) + ' |')
w('')

# ═══════════════════════════════════════════════ 부산 일별 강수량
rr = pd.read_csv(RAIN, encoding='cp949')
rr['날짜'] = pd.to_datetime(rr['날짜'].str.strip())
ry = rr['날짜'].dt.year
g = rr.groupby(ry)['강수량']
rtab = pd.DataFrame({'rows': g.size(), 'nan': g.apply(lambda s: int(s.isna().sum())),
                     'zero': g.apply(lambda s: int((s == 0).sum())), 'wet': g.apply(lambda s: int((s > 0).sum())),
                     'total': g.sum(min_count=1)})
dmax = rr.loc[rr['강수량'].idxmax()]
month_total = rr.assign(y=ry, m=rr['날짜'].dt.month).groupby(['y', 'm'])['강수량'].sum().groupby('m').mean()

busan = {
    'raw_shape': list(rr.shape),
    'period': [str(rr['날짜'].min().date()), str(rr['날짜'].max().date())],
    'nan': int(rr['강수량'].isna().sum()),
    'zero': int((rr['강수량'] == 0).sum()),
    'wet': int((rr['강수량'] > 0).sum()),
    'years_all_nan': [int(k) for k, v in rtab.iterrows() if v['nan'] == v['rows']],
    'nan_share': r(rr['강수량'].isna().mean() * 100, 1),
    'mean_daily_skipna': r(rr['강수량'].mean(), 3),
    'mean_daily_fill0': r(rr['강수량'].fillna(0).mean(), 3),
    'fill0_changes_annual_total': bool(not (rr.fillna({'강수량': 0}).groupby(ry)['강수량'].sum() == g.sum()).all()),
    'wettest_year': {'year': int(rtab['total'].idxmax()), 'total': r(rtab['total'].max(), 1)},
    'driest_year': {'year': int(rtab['total'].idxmin()), 'total': r(rtab['total'].min(), 1)},
    'max_daily': {'date': str(dmax['날짜'].date()), 'value': float(dmax['강수량'])},
    'normal_1991_2020': r(rtab.loc[1991:2020, 'total'].mean(), 1),
    'month_mean_total': {int(k): r(v, 1) for k, v in month_total.items()},
    'annual': {int(k): {'rows': int(v['rows']), 'nan': int(v['nan']), 'zero': int(v['zero']),
                         'wet': int(v['wet']), 'total': r(v['total'], 1)} for k, v in rtab.iterrows()},
}
facts['busan_rain_day'] = busan

w('## 2. `busan_rain_day.csv` — 부산(지점 159) 일별 강수량')
w('')
w('- shape **%s**, 기간 **%s ~ %s**. 서울 파일과 달리 날짜에 탭이 없고 빈 행도 없다.' % (tuple(busan['raw_shape']), *busan['period']))
w('- `강수량`: 결측 **%d일 (%.1f%%)**, `0.0` **%d일**, 양수 **%d일**' % (busan['nan'], busan['nan_share'], busan['zero'], busan['wet']))
w('- 한 해 전체가 결측인 해: %s' % (busan['years_all_nan'] or '**없다**'))
w('')
w('### ★ 결측은 "비가 안 온 날" 인가')
w('')
w('결측이 매년 고르게 60% 안팎이고 해 전체가 빈 해는 없다 — **관측 공백이 아니라 "비 없음" 을 비워 둔 것**으로 읽힌다.')
w('그래서 판단에 따라 숫자가 달라진다.')
w('')
w('| 계산 | 값 |')
w('|:---|--:|')
w('| 일평균 강수량 — `mean()` (NaN 건너뜀) | %.3f mm |' % busan['mean_daily_skipna'])
w('| 일평균 강수량 — `fillna(0).mean()` | %.3f mm |' % busan['mean_daily_fill0'])
w('| 연강수량(합계) — `fillna(0)` 을 해도 바뀌는가 | %s |' % ('바뀐다' if busan['fill0_changes_annual_total'] else '**안 바뀐다**'))
w('')
w('**합계는 같고 평균은 약 %.1f배 차이** — 결측을 어떻게 볼지가 평균에만 영향을 준다.' % (busan['mean_daily_skipna'] / busan['mean_daily_fill0']))
w('')
w('| 항목 | 값 |')
w('|:---|--:|')
w('| 연강수량 최대 | %d년 %.1f mm |' % (busan['wettest_year']['year'], busan['wettest_year']['total']))
w('| 연강수량 최소 | %d년 %.1f mm |' % (busan['driest_year']['year'], busan['driest_year']['total']))
w('| 일강수량 최대 | %s %.1f mm |' % (busan['max_daily']['date'], busan['max_daily']['value']))
w('| 1991~2020 평균 연강수량 (평년) | %.1f mm |' % busan['normal_1991_2020'])
w('')
w('월별 평균 강수량(해마다 월 합계를 낸 뒤 평균):')
w('')
w('| ' + ' | '.join('%d월' % m for m in range(1, 13)) + ' |')
w('|' + '--:|' * 12)
w('| ' + ' | '.join('%.1f' % busan['month_mean_total'][m] for m in range(1, 13)) + ' |')
w('')

# ═══════════════════════════════════════════════ 서울 연별 기온 (PDF 자료)
yy = pd.read_csv(YEAR, encoding='cp949')
yy_shape = list(yy.shape)            # 기온차 열을 더하기 **전**의 모양
yy['기온차'] = yy['최고기온'] - yy['최저기온']
top5 = yy.sort_values('기온차', ascending=False).head(5)
year = {
    'shape': yy_shape,
    'range': [int(yy['년'].min()), int(yy['년'].max())],
    'nan_rows': [int(v) for v in yy.loc[yy[['평균기온', '최저기온', '최고기온']].isna().any(axis=1), '년']],
    'diff_top5': [{'year': int(v['년']), 'max': float(v['최고기온']), 'min': float(v['최저기온']), 'diff': r(v['기온차'], 1)}
                  for _, v in top5.iterrows()],
}
facts['seoul_temp_year'] = year
w('## 3. `seoul_temp.csv` — 서울 연별 기온 (시각화 자료 PDF 의 데이터)')
w('')
w('- shape **%s**, %d ~ %d년. 결측이 있는 해: %s' % (tuple(year['shape']), *year['range'], year['nan_rows']))
w('- 여기서 `최고기온` / `최저기온` 은 **그해의 극값**이다(연평균의 최고·최저가 아니다).')
w('')
w('| 기온차 상위 | 최고기온 | 최저기온 | 차 |')
w('|:---|--:|--:|--:|')
for v in year['diff_top5']:
    w('| %d년 | %.1f | %.1f | %.1f |' % (v['year'], v['max'], v['min'], v['diff']))
w('')

# ═══════════════════════════════════════════════ 인구
p = pd.read_csv(POP, encoding='cp949', thousands=',')
p_nothou = pd.read_csv(POP, encoding='cp949')
cols = list(p.columns)
# 310열 표에 열을 하나 더 꽂으면 조각난 표 경고가 난다. 새 표로 이어 붙인다.
p = pd.concat([p, p['행정구역'].str.split(r'\s+\(', regex=True).str[0].rename('시도')], axis=1)
man_cols = [c for c in cols if '_남_' in c and c.endswith('세') or c.endswith('_남_100세 이상')]
wom_cols = [c for c in cols if '_여_' in c and c.endswith('세') or c.endswith('_여_100세 이상')]
jeju = p[p['시도'] == '제주특별자치도'].iloc[0]
jm = jeju[man_cols].to_numpy(dtype=int)
jw = jeju[wom_cols].to_numpy(dtype=int)
nat = p.iloc[0]
nm = nat[man_cols].to_numpy(dtype=int)
nw = nat[wom_cols].to_numpy(dtype=int)
pop = {
    'shape': list(p_nothou.shape),
    'dtypes_without_thousands': {str(k): int(v) for k, v in p_nothou.dtypes.astype(str).value_counts().items()},
    'dtypes_with_thousands': {str(k): int(v) for k, v in p.drop(columns='시도').dtypes.astype(str).value_counts().items()},
    'region_example_repr': repr(p['행정구역'].iloc[1]),
    'col_positions': {'계_0세': cols.index('2021년08월_계_0세'), '남_총인구수': cols.index('2021년08월_남_총인구수'),
                      '남_0세': cols.index('2021년08월_남_0세'), '남_100세 이상': cols.index('2021년08월_남_100세 이상'),
                      '여_총인구수': cols.index('2021년08월_여_총인구수'), '여_0세': cols.index('2021년08월_여_0세')},
    'n_age_cols_per_sex': len(man_cols),
    'total': {row['시도']: int(row['2021년08월_계_총인구수']) for _, row in p.iterrows()},
    'national_male': int(nat['2021년08월_남_총인구수']), 'national_female': int(nat['2021년08월_여_총인구수']),
    'national_peak_age_male': int(nm.argmax()), 'national_peak_age_female': int(nw.argmax()),
    'jeju_male_minus_female': int((jm - jw).sum()),
    'jeju_most_male_age': {'age': int((jm - jw).argmax()), 'diff': int((jm - jw).max())},
    'jeju_most_female_age': {'age': int((jw - jm).argmax()), 'diff': int((jw - jm).max())},
}
facts['korea_pop'] = pop
w('## 4. `korea_pop.csv` — 시도별 연령별 인구 (2021년 8월, 주민등록)')
w('')
w('- shape **%s** — 18행(전국 + 17 시도) × **310열**' % (tuple(pop['shape']),))
w('- `thousands=\',\'` 없이 읽으면 dtype: %s — **숫자가 전부 문자열이 된다**' % pop['dtypes_without_thousands'])
w('- `thousands=\',\'` 로 읽으면: %s' % pop['dtypes_with_thousands'])
w('- `행정구역` 값 예: `%s` — 이름 뒤에 공백 두 칸과 괄호 코드가 붙어 있다' % pop['region_example_repr'])
w('- 열 위치: ' + ', '.join('`%s`=%d' % kv for kv in pop['col_positions'].items()) + ' (성별마다 나이 열 %d개: 0~99세 + 100세 이상)' % pop['n_age_cols_per_sex'])
w('')
w('| 시도 | 총인구 |')
w('|:---|--:|')
for k, v in pop['total'].items():
    w('| %s | %s |' % (k, format(v, ',')))
w('')
w('- 전국 남 %s / 여 %s. 인구가 가장 많은 나이: 남 %d세, 여 %d세' % (
    format(pop['national_male'], ','), format(pop['national_female'], ','), pop['national_peak_age_male'], pop['national_peak_age_female']))
w('- 제주: 남−여 합계 **%d명**, 남이 가장 많이 앞서는 나이 **%d세(+%d)**, 여가 가장 많이 앞서는 나이 **%d세(+%d)**' % (
    pop['jeju_male_minus_female'], pop['jeju_most_male_age']['age'], pop['jeju_most_male_age']['diff'],
    pop['jeju_most_female_age']['age'], pop['jeju_most_female_age']['diff']))
w('')

with open(OUT_MD, 'w', encoding='utf-8') as f:
    f.write('\n'.join(md) + '\n')
with open(OUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(facts, f, ensure_ascii=False, indent=1)
print('->', OUT_MD)
print('->', OUT_JSON)
