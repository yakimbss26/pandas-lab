"""make_titanic_drill.py — 1부 끝의 연습 문제 "타이타닉 데이터 다루기" 와 그 정답을 만든다.

    python -X utf8 docs/scripts/make_titanic_drill.py

문항은 수업 노트북 「데이터 핸들링 - 판다스 (보강판)」의 확인 문제 1~5 와 미니 프로젝트를 바탕으로 했다
(2026-09-22 사용자 요청). 문장·풀이는 이 교재의 문체와 규칙(변수 t, 셀마다 스스로 준비)으로 새로 썼다.

문항마다 풀이 코드를 **원본(train.csv · test.csv · gender_submission.csv)과 합성본(data/titanic-synthetic.csv)
에서 각각 실제로 실행**하고, 그 출력으로 두 파일을 쓴다. 숫자를 손으로 적지 않는다.

    docs/draft/drill-questions.md   문제 (1부 14장 뒤)
    docs/draft/drill-answers.md     정답 — 원본 출력은 코드 바로 뒤 블록(verify_md.py 가 대조), 합성본은 따로

끼워 넣기는 webapp/book_part2.js 가 한다. 수업자료/ 가 없으면 아무것도 쓰지 않고 끝난다.
풀이에서 예상하지 않은 경고가 나면 멈춘다(ChainedAssignmentError 는 예외가 아니라 경고다 — 그래서 잡는다).
"""
import contextlib
import io
import os
import shutil
import tempfile
import warnings

import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SYNTH = os.path.join(ROOT, 'data', 'titanic-synthetic.csv')
OUT_Q = os.path.join(ROOT, 'docs', 'draft', 'drill-questions.md')
OUT_A = os.path.join(ROOT, 'docs', 'draft', 'drill-answers.md')
SITE = 'https://yakimbss26.github.io/pandas-lab/data/titanic-synthetic.csv'
REAL_FILES = ['train.csv', 'test.csv', 'gender_submission.csv']

# 교재 0.3 절의 표시 설정 — verify_md.py 도 이 설정으로 돈다. 같지 않으면 표 폭이 달라진다.
DISPLAY = ("pd.set_option('display.max_columns', 30)\n"
           "pd.set_option('display.width', 200)\n"
           "pd.set_option('display.max_colwidth', 40)\n")

START = "import pandas as pd\nimport numpy as np\n\nt = pd.read_csv('train.csv')\nt.shape"

# 세트 = (제목, 한 줄 소개, 준비 코드(없으면 None), 문항들)
# 문항 = dict(q=문제, hint=힌트, code=풀이, why=설명, test=test.csv 가 필요한가,
#             synth=합성본 주의(없으면 None), bad=✗ 예시 코드, expect_warn=풀이가 내야 하는 경고 이름)
# 설명에 숫자를 적지 않는다 — 숫자는 실행 결과에서 온다.
SETS = [
    ('불러오고 훑어보기', '파일을 읽고 크기·비율·대표값을 본다(2장).', None, [
        dict(q='`test.csv` 를 `test_df` 로 불러와 행과 열의 개수를 출력하라. `train.csv` 에는 있는데 `test.csv` 에 없는 열은 무엇인가?',
             hint='두 표의 열 이름을 `set` 으로 바꾸면 빼기(`-`)로 차이를 구할 수 있다.',
             code="test_df = pd.read_csv('test.csv')\nprint(test_df.shape)\nprint(set(t.columns) - set(test_df.columns))",
             why='`test.csv` 에는 **맞혀야 할 답**(`Survived`)이 없다. 그래서 예측 대회의 문제지가 된다 — 이 연습의 마지막 세트에서 이 파일에 예측을 채운다.',
             test=True),
        dict(q='`Pclass` 별 승객 수를 **비율(%)** 로 구하라. 소수 첫째 자리까지, 등급 순서대로.',
             hint='`value_counts(normalize=True)` 는 개수 대신 비율을 준다.',
             code="print((t['Pclass'].value_counts(normalize=True) * 100).round(1).sort_index())",
             why='`value_counts()` 는 **많은 순**으로 정렬한다. 등급 순서로 보려면 `sort_index()` 를 붙인다(10장). 결과 이름이 `proportion` 인 것도 보자 — 개수일 때는 `count` 다.'),
        dict(q='승객의 평균 나이(소수 둘째 자리)와 가장 비싼 요금을 각각 출력하라.',
             hint='`mean()`, `max()`. 평균 나이는 몇 명으로 낸 값인가?',
             code="print(round(t['Age'].mean(), 2))\nprint(t['Fare'].max())\nprint(t['Age'].count())",
             why='`mean()` 은 나이가 비어 있는 승객을 **건너뛰고** 평균을 낸다. 그래서 몇 명으로 낸 평균인지 `count()` 를 함께 본다(8장).'),
    ]),
    ('원하는 행과 열 골라내기', '불린 마스크와 `loc` 로 꺼낸다(5장).', None, [
        dict(q='3등석(`Pclass == 3`)이면서 생존한 승객은 몇 명인가?',
             hint='조건 두 개는 `&` 로 잇고 조건마다 괄호를 친다.',
             code="print(len(t[(t['Pclass'] == 3) & (t['Survived'] == 1)]))",
             why='괄호를 빼면 `&` 가 `==` 보다 먼저 계산되어 에러가 난다.',
             bad="# ✗ 괄호를 빼면 & 가 == 보다 먼저 계산된다\nt[t['Pclass'] == 3 & t['Survived'] == 1]"),
        dict(q='요금이 100 이상인 승객의 `Name`, `Pclass`, `Fare` 만 `loc` 로 골라 앞 5행을 출력하라. 모두 몇 명인가?',
             hint='`t.loc[행 조건, [열 목록]]` — 쉼표 왼쪽이 행, 오른쪽이 열이다.',
             code="rich = t.loc[t['Fare'] >= 100, ['Name', 'Pclass', 'Fare']]\nprint(rich.head())\nprint(len(rich))",
             why='행 조건과 열 목록을 `loc` 하나에 넣었다. `t[t[\'Fare\'] >= 100][[...]]` 처럼 두 번 나눠 쓰면 읽을 때는 같지만, **값을 바꿀 때** 는 연쇄 할당이 되어 반영되지 않는다(다음 세트).'),
        dict(q='10세 이하 어린이의 생존율을 소수 셋째 자리까지 구하라. 전체 생존율과 비교하라.',
             hint='`Survived` 는 0 과 1 이라 평균이 곧 생존율이다.',
             code="kids = t[t['Age'] <= 10]\nprint(len(kids), round(kids['Survived'].mean(), 3))\nprint(round(t['Survived'].mean(), 3))",
             why='나이가 비어 있는 승객은 `<= 10` 비교에서 False 가 되어 **조용히** 빠진다. 결과 인원이 예상보다 적으면 결측부터 의심한다(8장).',
             synth='합성본은 나이와 생존 사이에 관계가 없어, 원본과 달리 어린이 생존율이 전체보다 높게 나오지 않는다.'),
    ]),
    ('뷰와 복사 — 고친 것이 반영되는가', '꺼낸 표를 고칠 때의 규칙이다(7장).', None, [
        dict(q='1등석 승객만 골라 `first_df` 로 만들고, `first_df` 에 `Fare_KRW` 열(요금 × 1500)을 더하라. 원본 `t` 에는 이 열이 생기지 않아야 한다. 두 표에 이 열이 있는지 확인하라.',
             hint='꺼낸 뒤 고칠 표라면 `.copy()` 로 **내 것**임을 분명히 한다.',
             code="first_df = t[t['Pclass'] == 1].copy()\nfirst_df['Fare_KRW'] = first_df['Fare'] * 1500\nprint('Fare_KRW' in first_df.columns, 'Fare_KRW' in t.columns)",
             why='pandas 3.0 에서는 Copy-on-Write 때문에 `.copy()` 가 없어도 원본은 바뀌지 않는다. 그래도 `.copy()` 를 쓰면 "이 표는 따로 고칠 것" 이라는 뜻이 코드에 남고, 옛 버전에서 뜨던 `SettingWithCopyWarning` 도 피한다(7장).'),
        dict(q='아래 코드는 요금이 0 인 승객의 `Fare` 를 결측(`NaN`)으로 바꾸려는 것이다. 실행하면 무슨 일이 일어나는가? 이유를 말하고 올바르게 고쳐, 바뀐 개수를 확인하라.\n\n'
               '```\ntemp_df = t.copy()\ntemp_df[temp_df[\'Fare\'] == 0][\'Fare\'] = np.nan\n```',
             hint='대괄호가 두 번 이어지면 첫 번째 `[]` 가 **새 표**를 만든다. 고치는 대상은 그 새 표다.',
             code="temp_df = t.copy()\ntemp_df.loc[temp_df['Fare'] == 0, 'Fare'] = np.nan\nprint((t['Fare'] == 0).sum(), temp_df['Fare'].isna().sum())",
             why='문제의 코드는 **연쇄 할당**이다. 첫 `[...]` 가 만든 임시 표를 고치고 그 표는 버려진다. pandas 3.0 은 `ChainedAssignmentError` 를 띄우는데 **예외가 아니라 경고**라서 코드는 끝까지 돌고 `temp_df` 는 그대로다. 행 조건과 열을 `loc` 하나에 넣으면 원본에 바로 쓴다(7장).',
             bad="# ✗ 연쇄 할당 — 경고만 뜨고 temp_df 는 바뀌지 않는다\ntemp_df = t.copy()\ntemp_df[temp_df['Fare'] == 0]['Fare'] = np.nan\nprint(temp_df['Fare'].isna().sum())",
             synth='합성본에는 요금이 0 인 승객이 없어 바뀐 개수가 0 이다 — 이 문제는 원본으로 풀어야 차이가 보인다.'),
    ]),
    ('묶어서 요약하기', '`groupby` 로 묶고 여러 값을 한 번에 낸다(11장).', None, [
        dict(q='탑승 항구(`Embarked`)별 승객 수와 생존율(소수 셋째 자리)을 **한 표**로 만들어라.',
             hint="`groupby('Embarked')['Survived'].agg(['count', 'mean'])`",
             code="print(t.groupby('Embarked')['Survived'].agg(['count', 'mean']).round(3))\nprint(t['Embarked'].isna().sum())",
             why='항구가 비어 있는 승객은 `groupby` 가 기본으로 **빼고** 묶는다(`dropna=True`). 그래서 세 항구의 인원을 더해도 전체보다 적다(11장).'),
        dict(q='`Pclass` 와 `Sex` 로 묶어 평균 요금(소수 둘째 자리)을 구하고, `unstack()` 으로 행 = 등급, 열 = 성별인 표로 바꿔라.',
             hint='`groupby([열1, 열2])` 의 결과는 인덱스가 두 층이다. `unstack()` 은 안쪽 층을 열로 올린다.',
             code="print(t.groupby(['Pclass', 'Sex'])['Fare'].mean().round(2).unstack())",
             why='같은 표를 `pd.pivot_table(t, index=\'Pclass\', columns=\'Sex\', values=\'Fare\', aggfunc=\'mean\')` 로도 만든다(V2).'),
        dict(q='생존 여부(`Survived`)별로 나이의 평균·최솟값·최댓값을 구하라(소수 둘째 자리).',
             hint="`agg(['mean', 'min', 'max'])`",
             code="print(t.groupby('Survived')['Age'].agg(['mean', 'min', 'max']).round(2))",
             why='두 집단의 평균 나이는 별로 다르지 않다. 그렇다고 "나이는 생존과 상관없다" 고 말할 수는 없다 — 문제 6 처럼 '
                 '**어린이만 떼어 보면** 생존율이 뚜렷이 다르다. 평균 하나로 분포 전체를 말하지 않는다(V4 의 상자그림).'),
    ]),
    ('가공하기 — 새 열 만들기', '열을 계산해 붙이고 구간으로 나누고 값을 바꾼다(9장).',
     "def family_type(row):\n    size = row['SibSp'] + row['Parch'] + 1   # 본인 포함 가족 수\n"
     "    if size == 1:\n        return 'Alone'\n    elif size <= 4:\n        return 'Small'\n    else:\n        return 'Large'\n\n"
     "t['Family_type'] = t.apply(family_type, axis=1)\nt['Family_type'].value_counts()", [
        dict(q='`Family_type` 과 `Sex` 로 생존율 피벗 테이블(소수 둘째 자리)을 만들어라. 어떤 특징이 보이는가?',
             hint="`pd.pivot_table(t, index='Family_type', columns='Sex', values='Survived', aggfunc='mean')`",
             code="print(pd.pivot_table(t, index='Family_type', columns='Sex', values='Survived', aggfunc='mean').round(2))",
             why='원본에서는 **대가족(`Large`)이면 여자도 생존율이 크게 낮다** — 성별만으로는 설명되지 않는 차이다. '
                 '다만 칸마다 **몇 명**으로 낸 비율인지 `aggfunc=\'count\'` 로 함께 보자 — 인원이 적은 칸의 비율은 크게 흔들린다(V2, V5).',
             synth='합성본에는 가족 규모와 생존 사이의 관계가 없어 이 특징이 보이지 않는다.'),
        dict(q='요금을 `pd.cut` 으로 `[0, 10, 30, 100, 600]` 구간으로 나눈 `Fare_cut` 열을 만들고, 구간별 승객 수를 구간 순서대로 출력하라(결측 포함). 요금이 0 인 승객은 어떻게 되는가?',
             hint="`value_counts(dropna=False).sort_index()`. 구간 `(0, 10]` 의 둥근 괄호는 무슨 뜻인가?",
             code="t['Fare_cut'] = pd.cut(t['Fare'], bins=[0, 10, 30, 100, 600])\nprint(t['Fare_cut'].value_counts(dropna=False).sort_index())",
             why='`pd.cut` 의 구간은 기본으로 **왼쪽이 열려** 있다(`(0, 10]` 은 0 초과 10 이하). 그래서 요금 0 은 어느 구간에도 들지 않고 `NaN` 이 된다 — 에러 없이. `include_lowest=True` 를 주면 첫 구간이 `[0, 10]` 이 되어 0 도 들어간다.',
             synth='합성본에는 요금이 0 인 승객이 없어 `NaN` 이 생기지 않는다 — 원본으로 풀어야 함정이 보인다.'),
        dict(q='`Embarked` 를 `{\'S\': 0, \'C\': 1, \'Q\': 2}` 로 바꾼 `Embarked_num` 열을 만들어라. 값별 개수(결측 포함)와 이 열의 dtype 을 출력하라.',
             hint='`map` 은 사전에 없는 값을 `NaN` 으로 만든다. 결측이 섞인 정수 열은 무엇이 되는가?',
             code="t['Embarked_num'] = t['Embarked'].map({'S': 0, 'C': 1, 'Q': 2})\nprint(t['Embarked_num'].value_counts(dropna=False))\nprint(t['Embarked_num'].dtype)",
             why='항구가 비어 있던 승객은 `NaN` 으로 남고, 그래서 정수가 아니라 **실수(`float64`)** 열이 된다(9장). 수업 노트북은 이 문제 앞에서 결측을 `\'S\'` 로 채웠기 때문에 결측이 없었다 — **같은 코드도 앞에서 무엇을 했는지에 따라 결과가 다르다**(13장).'),
    ]),
    ('미니 프로젝트 — 규칙으로 생존 예측하기',
     '모델 없이 **규칙**으로 예측하고, 정해진 형식의 제출 파일로 저장한다. `Title`(호칭)은 이름에서 뽑는다(V1 의 `str.extract`).',
     "train = pd.read_csv('train.csv')\ntest = pd.read_csv('test.csv')\n\n"
     "for d in (train, test):   # 두 표에 똑같이 호칭 열을 만든다\n"
     "    d['Title'] = d['Name'].str.extract(r',\\s*([^\\.]+)\\.', expand=False)\n\n"
     "def accuracy(pred, answer):\n    return (pred == answer).mean()\n\ntrain['Title'].value_counts().head()", [
        dict(q='"여자는 생존, 남자는 사망" 이라는 기준 규칙의 `train` 정확도를 소수 넷째 자리까지 구하라.',
             hint="`(train['Sex'] == 'female').astype(int)` 가 예측이다.",
             code="pred0 = (train['Sex'] == 'female').astype(int)\nprint(round(accuracy(pred0, train['Survived']), 4))",
             why='이 기준 규칙이 대회가 주는 예시 파일(`gender_submission.csv`)의 규칙이다. 새 규칙은 **이것보다 나아야** 의미가 있다.',
             test=True),
        dict(q='기준 규칙에 두 가지를 더한 `rule_v2` 의 `train` 정확도를 구하라 — ① 1·2등석 남자 어린이(`Title` 이 `Master`)는 생존 ② 요금 20 이상인 3등석 여자는 사망.',
             hint='예측 Series 를 만든 뒤 `pred[조건] = 1` 처럼 조건에 맞는 칸만 덮어쓴다.',
             code="def rule_v2(d):\n    pred = (d['Sex'] == 'female').astype(int)\n"
                  "    pred[(d['Title'] == 'Master') & (d['Pclass'] < 3)] = 1\n"
                  "    pred[(d['Sex'] == 'female') & (d['Pclass'] == 3) & (d['Fare'] >= 20)] = 0\n"
                  "    return pred\n\nprint(round(accuracy(rule_v2(train), train['Survived']), 4))",
             why='`pred` 는 함수 안에서 새로 만든 Series 라 `pred[조건] = 값` 이 그대로 반영된다(연쇄 할당이 아니다). 규칙 ② 는 "요금이 높은 3등석 여자 = 대가족" 이라는 관찰에서 왔다 — 세트 5 의 가족 규모 표와 이어 보자.',
             test=True, synth='합성본에는 `Master` 호칭이 없고 등급·요금과 생존의 관계도 없어 규칙이 거의 효과가 없다.'),
        dict(q='`rule_v2` 를 `test` 에 적용해 `PassengerId`, `Survived` 두 열의 제출 표를 만들고 `submission.csv` 로 저장하라. 저장 전에 예시 파일과 **형식**(열 이름·행 수·결측)이 같은지, 기준 규칙과 예측이 다른 승객이 몇 명인지 확인하라.',
             hint="`pd.DataFrame({'PassengerId': ..., 'Survived': ...})`, `to_csv(..., index=False)`",
             code="submission = pd.DataFrame({'PassengerId': test['PassengerId'], 'Survived': rule_v2(test)})\n"
                  "sample = pd.read_csv('gender_submission.csv')\n\n"
                  "print(list(submission.columns) == list(sample.columns))\n"
                  "print(len(submission) == len(sample))\n"
                  "print(submission.isna().sum().sum() == 0)\n"
                  "print((submission['Survived'] != sample['Survived']).sum())\n"
                  "submission.to_csv('submission.csv', index=False)",
             why='`index=False` 를 빼면 인덱스가 첫 열로 저장되어 **형식이 틀린 파일**이 된다. 제출 전에 이렇게 형식을 코드로 점검하는 습관을 들이자.',
             test=True, uses_prev=True),
    ]),
]

CHALLENGE = [
    '### 도전 — 나만의 규칙',
    '',
    '`rule_v2` 를 고쳐 `train` 정확도를 더 높여 보자. 가족 규모, 나이대, 탑승 항구, 객실 번호가 있는지 등을 쓸 수 있다.',
    '정답은 없다. 대신 두 가지를 스스로 확인한다.',
    '',
    '- 새 규칙마다 **몇 명의 예측이 바뀌었는지** 함께 본다. 서너 명을 맞히려고 규칙 한 줄을 더했다면 우연일 가능성이 크다.',
    '- `train` 에만 꼭 맞춘 복잡한 규칙은 `test` 에서 오히려 틀리기 쉽다(**과적합**). 규칙은 이유를 한 문장으로 말할 수 있는 것만 남긴다.',
    '',
]


def stage(files):
    d = tempfile.mkdtemp(prefix='drill-')
    for name, src in files.items():
        shutil.copy(src, os.path.join(d, name))
    return d


def run(pre, code, workdir):
    """pre 를 **조용히** 실행한 뒤 code 를 workdir 에서 실행하고 (출력, 예외, 경고들) 을 돌려준다.
    pre 의 print 는 버린다 — 앞 문항의 풀이를 다시 돌려 정의만 가져올 때 그 출력이 섞이면 안 된다
    (실제로 한 번 섞였다: 17번 출력 맨 위에 16번의 정확도가 찍혔다)."""
    g = {'__name__': '__main__'}
    cwd = os.getcwd()
    os.chdir(workdir)
    try:
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter('always')
            err = None
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    exec(pre, g)
            except Exception as e:  # noqa: BLE001
                return '', f'준비 코드: {type(e).__name__}: {e}', []
            buf = io.StringIO()
            try:
                with contextlib.redirect_stdout(buf):
                    exec(code, g)
            except Exception as e:  # noqa: BLE001
                err = f'{type(e).__name__}: {e}'
    finally:
        os.chdir(cwd)
    return buf.getvalue().rstrip('\n'), err, [f'{x.category.__name__}: {x.message}' for x in w]


def main():
    src = os.path.join(ROOT, '수업자료')
    found = {}
    for root, _, names in os.walk(src):
        for n in REAL_FILES:
            if n in names and n not in found:
                found[n] = os.path.join(root, n)
    if len(found) < len(REAL_FILES) or not os.path.exists(SYNTH):
        print('원본 파일 또는 합성본이 없다 — 기존 파일을 그대로 둔다.')
        return
    real_dir = stage(found)
    synth_dir = stage({'train.csv': SYNTH})
    head = 'import pandas as pd\nimport numpy as np\n' + DISPLAY + "t = pd.read_csv('train.csv')\n"

    start_out, _, _ = run(head, 'print(t.shape)', real_dir)
    nsets = len(SETS)
    nq = sum(len(s[3]) for s in SETS)
    q = ['## 연습 문제. 타이타닉 데이터 다루기', '',
         f'수업에서 다룬 타이타닉 데이터로 1부 전체를 연습한다. 세트 {nsets}개 · 문항 {nq}개와 도전 하나.',
         '앞의 다섯 세트는 불러오기 → 골라내기 → 복사 → 요약 → 가공 순서이고, 마지막 세트는 규칙으로 생존을 예측해',
         '대회 제출 파일을 만든다. 정답과 풀이는 책 맨 뒤 "연습 문제 정답" 에 있다.',
         '**먼저 스스로 풀고, 답이 다르면 풀이를 보기 전에 한 번 더 의심해 보자.**', '',
         '모든 문항은 아래 블록을 먼저 실행했다고 가정한다. 세트에 **준비** 블록이 있으면 그것도 먼저 실행한다.', '',
         '```python', START, '```', '', '```text', start_out, '```', '',
         '> **`train.csv` 가 없으면** 사이트의 합성본을 받아 같은 폴더에 두고 `read_csv` 의 파일 이름만 바꾼다:',
         f"> `t = pd.read_csv('titanic-synthetic.csv')` — 받는 곳: <{SITE}>",
         '> 합성본은 열 이름 · 행 수 · 결측 개수가 원본과 같지만 **값은 다르고, 값 사이의 관계도 대부분 없다.**',
         '> 그래서 정답이 두 벌이고, 합성본으로는 볼 수 없는 문항에는 따로 적어 두었다.',
         '> `test.csv` 가 필요한 문항(1번, 마지막 세트)은 원본으로만 풀 수 있다.', '']
    a = ['## 연습 문제 정답 — 타이타닉 데이터 다루기', '',
         '풀이 바로 아래 출력은 **원본 `train.csv`** 에서 실행한 결과다. 합성본으로 풀었다면 그 아래의',
         '"합성본으로 풀었다면" 을 본다. 두 벌 모두 이 책을 만들 때 실제로 실행해서 얻은 값이다.', '']

    num = 0
    for title, intro, setup, items in SETS:
        q += [f'### 세트 {SETS.index((title, intro, setup, items)) + 1}. {title}', '', intro, '']
        a += [f'### 세트 {SETS.index((title, intro, setup, items)) + 1}. {title}', '']
        # 정답 쪽도 세트마다 **새로 시작**한다. 책을 위에서부터 이어 실행하면 앞 세트가 더한 열(Family_type 등)이
        # t 에 남아 1번의 답이 달라진다 — verify_md.py 가 실제로 이것을 잡았다(문제 14 가 가르치는 바로 그 함정).
        prep = "t = pd.read_csv('train.csv')" + ('\n\n' + setup.rsplit('\n', 1)[0] if setup else '')
        a += ['준비 — 이 세트를 새로 시작한다(앞 세트에서 더한 열을 지운다):', '', '```python', prep, '```', '']
        pre = head
        if setup:
            body, last = setup.rsplit('\n', 1)          # 마지막 줄은 표시용 식 — print 로 감싸 출력을 얻는다
            s_out, s_err, s_w = run(head + body, 'print(' + last + ')', real_dir)
            if s_err or s_w:
                raise SystemExit(f'준비 블록 실패: {s_err or s_w}')
            q += ['**준비**', '', '```python', setup, '```', '', '```text', s_out, '```', '']
            pre = head + setup + '\n'
        prev_code = ''
        for it in items:
            num += 1
            q += [f'**문제 {num}.** {it["q"]}', '', f'> 힌트 — {it["hint"]}', '']
            if it.get('uses_prev'):          # 앞 문항에서 만든 것(예: rule_v2)을 이어서 쓴다
                pre = pre + prev_code + '\n'
            prev_code = it['code']
            ro, rerr, rw = run(pre, it['code'], real_dir)
            if rerr or rw:
                raise SystemExit(f'문항 {num} 원본 풀이 실패: {rerr} {rw}')
            a += [f'**문제 {num}.** {it["q"]}', '', '```python', it['code'], '```', '', '```text', ro, '```', '']
            if it.get('test'):
                a += ['합성본으로 풀었다면: `test.csv` 를 쓰는 문항이라 원본으로만 풀 수 있다.', '']
            else:
                so, serr, sw = run(pre, it['code'], synth_dir)
                if serr or sw:
                    raise SystemExit(f'문항 {num} 합성본 풀이 실패: {serr} {sw}')
                a += ['합성본으로 풀었다면:', '', '```text', so, '```', '']
                if it.get('synth'):
                    a += [f'> 합성본 주의 — {it["synth"]}', '']
            a += [it['why'], '']
            if it.get('bad'):
                bo, berr, bw = run(pre, it['bad'], real_dir)
                if not (berr or bw):
                    raise SystemExit(f'문항 {num} 의 ✗ 예시가 에러도 경고도 내지 않았다')
                shown = berr or bw[0]
                a += ['```python', it['bad'], '```', '', '```text', (bo + '\n' if bo else '') + shown, '```', '']
    q += CHALLENGE
    a += ['### 이 연습에서 가져갈 것', '',
          '- **결측은 조건·평균·묶기에서 조용히 빠진다**(문제 3, 6, 9). 결과 인원이 예상과 다르면 결측부터 센다.',
          '- **고친 것이 반영됐는지 확인한다**(문제 8). 연쇄 할당은 예외가 아니라 경고라서 코드가 끝까지 돈다.',
          '- **같은 코드도 앞에서 무엇을 했는지에 따라 결과가 다르다**(문제 14). 셀을 위에서부터 다시 실행해 본다(13장).',
          '- **합성 데이터는 모양만 같다**(합성본 주의). 관계를 찾는 분석은 진짜 데이터로 한다.', '']

    for p, lines in ((OUT_Q, q), (OUT_A, a)):
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(lines).rstrip() + '\n')
        print('->', os.path.relpath(p, ROOT), len(lines), '줄')


if __name__ == '__main__':
    main()
