"""make_titanic_drill.py — 1부 끝의 연습 문제 "타이타닉에서 꺼내기" 와 그 정답을 만든다.

    python -X utf8 docs/scripts/make_titanic_drill.py

문항마다 풀이 코드를 **원본 train.csv 와 합성본 data/titanic-synthetic.csv 에서 각각 실제로 실행**하고,
그 출력으로 두 파일을 쓴다. 숫자를 손으로 적지 않는다.

    docs/draft/drill-questions.md   문제 (1부 14장 뒤에 들어간다)
    docs/draft/drill-answers.md     정답 — 원본 출력은 코드 블록, 합성본은 표 (책 맨 뒤)

끼워 넣기는 webapp/book_part2.js 가 한다. 그 뒤 verify_md.py 가 원본 출력을 다시 대조한다.
수업자료/ 가 없으면 아무것도 쓰지 않고 끝난다(기존 파일 보존).
"""
import contextlib
import io
import os
import sys
import warnings

import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SYNTH = os.path.join(ROOT, 'data', 'titanic-synthetic.csv')
OUT_Q = os.path.join(ROOT, 'docs', 'draft', 'drill-questions.md')
OUT_A = os.path.join(ROOT, 'docs', 'draft', 'drill-answers.md')
SITE = 'https://yakimbss26.github.io/pandas-lab/data/titanic-synthetic.csv'


def find_real():
    src = os.path.join(ROOT, '수업자료')
    for root, _, names in os.walk(src):
        if 'train.csv' in names:
            return os.path.join(root, 'train.csv')
    return None


# (번호, 단계, 문제, 힌트, 풀이 코드, 풀이 뒤 설명)
# 설명에는 숫자를 적지 않는다 — 숫자는 실행 결과에서 온다.
EX = [
    (1, '기본',
     '`Name`, `Sex`, `Age` 세 열만 꺼낸 표를 만들고 `shape` 를 출력하라.',
     '열 이름의 **리스트**를 대괄호에 넣는다 — 대괄호가 두 겹이 된다.',
     "sub = t[['Name', 'Sex', 'Age']]\nprint(sub.shape)",
     '열을 하나만 꺼내면(`t[\'Name\']`) Series, 리스트로 꺼내면(`t[[\'Name\']]`) 열이 하나인 DataFrame 이다(4장).'),
    (2, '기본',
     '여자 승객(`Sex` 가 `\'female\'`)만 꺼내라. 몇 명인가?',
     '비교식이 만든 True/False 를 대괄호에 넣는다(불린 마스크).',
     "women = t[t['Sex'] == 'female']\nprint(len(women))",
     '`t[\'Sex\'] == \'female\'` 은 행마다 True/False 인 Series 다. 그것을 `t[...]` 에 넣으면 True 인 행만 남는다.'),
    (3, '기본',
     '1등석(`Pclass` 가 1) 승객만 꺼내라. 몇 명이고, 그중 생존자는 몇 명인가?',
     '꺼낸 표에서 `Survived` 열을 더하면 생존자 수다(1 = 생존).',
     "first = t[t['Pclass'] == 1]\nprint(len(first), first['Survived'].sum())",
     '`Survived` 는 0 과 1 이라 합이 곧 생존자 수이고, 평균이 곧 생존율이다.'),
    (4, '기본',
     '나이가 60세 이상인 승객을 꺼내라. 몇 명인가? 나이가 비어 있는 승객은 이 결과에 들어가는가?',
     '`NaN >= 60` 은 True 일까 False 일까.',
     "old = t[t['Age'] >= 60]\nprint(len(old))\nprint(old['Age'].isna().sum())",
     '결측과의 비교는 언제나 False 다. 그래서 나이를 모르는 승객은 **조용히** 빠진다 — 에러도 경고도 없다(8장).'),
    (5, '기본',
     '**위치로** 11번째부터 20번째 행(10개)을 꺼내라. 꺼낸 행 수와 그 안의 생존자 수를 출력하라.',
     '위치는 0 부터 센다. 11번째 행의 위치는 10 이다. `iloc` 의 끝은 포함되지 않는다.',
     "rows = t.iloc[10:20]\nprint(len(rows), rows['Survived'].sum())",
     '`iloc[10:20]` 은 위치 10~19, 곧 10개다. 파이썬 리스트 슬라이스와 같은 규칙이다(5장).'),
    (6, '중급',
     '1등석 **여자** 승객만 꺼내라. 몇 명인가?',
     '조건 두 개는 `&` 로 잇고, 조건마다 **괄호**를 친다.',
     "fw = t[(t['Pclass'] == 1) & (t['Sex'] == 'female')]\nprint(len(fw))",
     '파이썬의 `and` 는 쓸 수 없다 — Series 전체가 참인지 한 번에 묻게 되어 에러가 난다. 괄호를 빼면 아래처럼 된다.'),
    (7, '중급',
     '승선항(`Embarked`)이 `\'C\'` 또는 `\'Q\'` 인 승객은 몇 명인가?',
     '`==` 를 두 번 쓰고 `|` 로 이어도 되지만, 값의 목록으로 묻는 메서드가 있다.',
     "cq = t[t['Embarked'].isin(['C', 'Q'])]\nprint(len(cq))",
     '`isin` 은 목록에 든 값이면 True 다. 승선항이 비어 있는 승객은 어느 쪽에도 들지 않는다.'),
    (8, '중급',
     '요금(`Fare`)이 10 이상 30 이하인 승객은 몇 명인가?',
     '`>=` 와 `<=` 두 조건 대신 한 메서드로 쓸 수 있다. 양 끝을 포함하는지 확인한다.',
     "mid = t[t['Fare'].between(10, 30)]\nprint(len(mid))",
     '`between` 은 기본으로 **양 끝을 포함**한다(`inclusive=\'both\'`). `(t[\'Fare\'] >= 10) & (t[\'Fare\'] <= 30)` 과 같다.'),
    (9, '중급',
     '나이가 **비어 있는** 승객만 꺼내라. 몇 명이고, 그중 생존자는 몇 명인가?',
     '`== NaN` 으로는 찾을 수 없다. 결측을 묻는 메서드를 쓴다.',
     "unknown = t[t['Age'].isna()]\nprint(len(unknown), unknown['Survived'].sum())",
     '`t[\'Age\'] == float(\'nan\')` 은 전부 False 다 — NaN 은 자기 자신과도 같지 않다. 결측은 `isna()` 로만 찾는다(8장).'),
    (10, '중급',
     '3등석 **남자** 승객의 평균 나이를 소수 둘째 자리까지 구하라. `loc` 로 행과 열을 한 번에 골라라.',
     '`t.loc[행 조건, \'열 이름\']` — 쉼표 왼쪽이 행, 오른쪽이 열이다.',
     "age3m = t.loc[(t['Pclass'] == 3) & (t['Sex'] == 'male'), 'Age']\nprint(round(age3m.mean(), 2))",
     '`mean()` 은 결측을 건너뛰고 평균을 낸다. 몇 명으로 낸 평균인지는 `age3m.count()` 로 함께 본다(V5 에서 다시 본다).'),
    (11, '심화',
     '이름에 `Mr.` 가 들어간 승객은 몇 명인가? `str.contains` 에 `regex=False` 를 줄 때와 주지 않을 때를 비교하라.',
     '정규식에서 `.` 은 "아무 글자 하나" 라는 뜻이다.',
     "print(t['Name'].str.contains('Mr.', regex=False).sum())\nprint(t['Name'].str.contains('Mr.').sum())",
     '`regex=False` 를 빼면 `Mr.` 가 "Mr + 아무 글자" 로 읽혀 **`Mrs`** 까지 걸린다. 에러가 나지 않아 알아채기 어렵다. 글자 그대로 찾을 때는 `regex=False` 를 준다.'),
    (12, '심화',
     '객실 번호(`Cabin`)가 **있는** 승객과 **없는** 승객의 생존율을 각각 소수 셋째 자리까지 구하라.',
     '`isna()` 의 반대는 `notna()` 다. 불린 마스크 앞에 `~` 를 붙여도 뒤집힌다.',
     "has = t[t['Cabin'].notna()]\nno = t[t['Cabin'].isna()]\nprint(round(has['Survived'].mean(), 3), round(no['Survived'].mean(), 3))",
     '원본에서는 두 생존율이 크게 다르다. 결측이 **그 자체로 정보**일 때가 있다 — 객실 번호가 남아 있는 승객은 대개 '
     '상위 등급 승객이었다. 그래서 이 열의 결측을 지우거나 아무 값으로 채우기 전에 먼저 이렇게 나눠 본다. '
     '**합성본에서는 두 값이 거의 같다** — 합성본은 결측 **개수**만 원본과 맞추고 자리는 무작위로 골랐기 때문이다. '
     '합성 데이터로는 이런 발견을 할 수 없다는 것도 함께 기억하자.'),
    (13, '심화',
     '요금이 200 이상인 승객만 꺼내 `Pclass`, `Fare`, `Survived` 세 열을 **요금이 높은 순**으로 정렬하라. 몇 명이고, 그중 생존자는 몇 명인가?',
     '꺼내기 → 열 고르기 → `sort_values(..., ascending=False)` 를 한 줄에 이어 쓸 수 있다.',
     "rich = t.loc[t['Fare'] >= 200, ['Pclass', 'Fare', 'Survived']].sort_values('Fare', ascending=False)\nprint(len(rich), rich['Survived'].sum())",
     '행 조건과 열 목록을 `loc` 하나에 넣었다. 정렬은 꺼낸 **뒤에** 한다 — 891행 전체를 정렬할 필요가 없다(10장).'),
    (14, '심화',
     '혼자 탄 승객(`SibSp` 와 `Parch` 가 모두 0)의 `Survived`, `Fare` 두 열만 꺼낸 표의 `shape` 와 생존율(소수 셋째 자리)을 구하라.',
     '조건 두 개를 `&` 로 잇고, 열 목록과 함께 `loc` 에 넣는다.',
     "alone = t.loc[(t['SibSp'] == 0) & (t['Parch'] == 0), ['Survived', 'Fare']]\nprint(alone.shape)\nprint(round(alone['Survived'].mean(), 3))",
     '`SibSp + Parch == 0` 으로 써도 같다. 조건 하나로 줄일 수 있으면 읽기 쉽다.'),
    (15, '심화',
     '★ `t2 = t.set_index(\'PassengerId\')` 로 인덱스를 승객 번호로 바꾼 뒤, `t2.loc[1:5]` 와 `t2.iloc[1:5]` 가 각각 **몇 행**이고 **첫 행의 승객 번호**가 무엇인지 구하라.',
     '`loc` 은 라벨, `iloc` 은 위치다. 끝을 포함하는지도 다르다.',
     "t2 = t.set_index('PassengerId')\na = t2.loc[1:5]\nb = t2.iloc[1:5]\nprint(len(a), a.index[0])\nprint(len(b), b.index[0])",
     '`loc[1:5]` 은 **승객 번호** 1~5 — 라벨 슬라이스라 끝(5)을 **포함**한다. `iloc[1:5]` 는 **위치** 1~4 — 끝을 포함하지 않고, 위치 1 은 승객 번호 2 다. 같은 `1:5` 가 다른 행을 가리킨다(5장).'),
]

# 문항 뒤에 붙는 ✗ 예시(원본에서 실제로 돌려 에러 문구를 얻는다)
EXTRA = {
    6: "# ✗ 괄호를 빼면 & 가 == 보다 먼저 계산된다\nt[t['Pclass'] == 1 & t['Sex'] == 'female']",
}


def run(code, t):
    g = {'pd': pd, 't': t.copy()}
    buf = io.StringIO()
    with warnings.catch_warnings(record=True) as w, contextlib.redirect_stdout(buf):
        warnings.simplefilter('always')
        err = None
        try:
            exec(code, g)
        except Exception as e:  # noqa: BLE001
            err = f'{type(e).__name__}: {e}'
    if w:
        raise SystemExit(f'경고가 났다 — 문항을 고쳐라:\n{code}\n{[str(x.message) for x in w]}')
    return buf.getvalue().rstrip('\n'), err


def main():
    real_path = find_real()
    if not real_path or not os.path.exists(SYNTH):
        print('train.csv 또는 합성본이 없다 — 기존 파일을 그대로 둔다.')
        return
    real, synth = pd.read_csv(real_path), pd.read_csv(SYNTH)

    q = ['## 연습 문제. 타이타닉에서 원하는 것만 꺼내기', '',
         '1부에서 배운 **꺼내기**(열 고르기 · 불린 마스크 · `loc`/`iloc` · `isin` · `between` · `isna` · `str.contains`)를',
         '타이타닉 데이터로 연습한다. 기본 5문항 → 중급 5문항 → 심화 5문항. 정답과 풀이는 책 맨 뒤',
         '"연습 문제 정답" 에 있다. **먼저 스스로 풀고, 답이 다르면 풀이를 보기 전에 한 번 더 의심해 보자.**', '',
         '모든 문항은 아래 한 블록을 먼저 실행했다고 가정한다.', '',
         '```python', 'import pandas as pd', "t = pd.read_csv('train.csv')", 't.shape', '```', '',
         '```text', str(real.shape), '```', '',
         '> **`train.csv` 가 없으면** 사이트의 합성본을 받아 같은 폴더에 두고 두 번째 줄만 바꾼다:',
         f"> `t = pd.read_csv('titanic-synthetic.csv')` — 받는 곳: <{SITE}>",
         '> 합성본은 열 이름 · 행 수 · 결측 개수가 원본과 같지만 **값은 다르다.** 그래서 정답이 두 벌이다.', '']
    a = ['## 연습 문제 정답 — 타이타닉에서 꺼내기', '',
         '풀이 코드의 출력은 **원본 `train.csv`** 에서 실행한 결과다. 합성본(`titanic-synthetic.csv`)으로 풀었다면',
         '각 풀이 아래의 **합성본** 줄과 비교한다. 두 벌 모두 이 책을 만들 때 실제로 실행해서 얻은 값이다.', '']
    level = None
    for num, lv, text, hint, code, why in EX:
        if lv != level:
            q += [f'### {lv}', '']
            level = lv
        q += [f'**문제 {num}.** {text}', '', f'> 힌트 — {hint}', '']
        ro, rerr = run(code, real)
        so, serr = run(code, synth)
        if rerr or serr:
            raise SystemExit(f'문항 {num} 풀이가 실패했다: {rerr or serr}')
        a += [f'**문제 {num}.** {text}', '', '```python', code, '```', '', '```text', ro, '```', '',
              '합성본: `' + so.replace('\n', '` · `') + '`', '', why, '']
        if num in EXTRA:
            _, err = run(EXTRA[num], real)
            if not err:
                raise SystemExit(f'문항 {num} 의 ✗ 예시가 에러를 내지 않았다')
            a += ['```python', EXTRA[num], '```', '', '```text', err, '```', '']
    a += ['### 이 문제에서 가져갈 것', '',
          '- **결측은 조건에서 조용히 빠진다**(문제 4, 9, 12). 결과 행 수가 예상보다 적으면 결측부터 의심한다.',
          '- **`loc` 과 `iloc` 은 같은 `1:5` 로 다른 행을 꺼낸다**(문제 15). 인덱스가 0, 1, 2… 일 때만 우연히 비슷해 보인다.',
          '- **에러가 나지 않았다고 맞은 것이 아니다**(문제 11). `regex` 기본값 하나로 결과가 백 명 넘게 달라진다.', '']
    for p, lines in ((OUT_Q, q), (OUT_A, a)):
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(lines).rstrip() + '\n')
        print('->', os.path.relpath(p, ROOT), len(lines), '줄')


if __name__ == '__main__':
    main()
