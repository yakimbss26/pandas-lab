"""run_code_blocks.py — 화면의 복사용 코드 블록을 실제 pandas 로 돌린다.

    python -X utf8 webapp/test/run_code_blocks.py harvest.json

harvest.json 은 harvest_code.js 가 브라우저에서 돌려준 {pre, blocks}.
블록마다 **격리된 전역**에서 (머리말 + 본문) 을 실행하고, 예외와 경고를 모두 적는다.
화면에 실린 출력(out)이 있으면 실제 출력과 나란히 보여 준다 — 판정은 사람이 한다.

데이터 파일은 수업자료/ 에서 찾아 임시 폴더로 복사해 쓴다(저장소에는 원본이 없다 — 없으면 끝낸다).
matplotlib 은 Agg 로 돌리므로 plt.show() 가 내는 FigureCanvasAgg 경고는 걸러서 보여 주지 않는다
(학생 화면에서는 나지 않는다).
"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import warnings

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, '수업자료')
FILES = ['train.csv', 'ramen-ratings.csv', 'abalone.csv', 'lab_earthquake.csv',
         'seoul_temp_day.csv', 'seoul_temp.csv', 'busan_rain_day.csv', 'korea_pop.csv']
HARNESS_ONLY = ('FigureCanvasAgg is non-interactive',)


def stage_data():
    if not os.path.isdir(SRC):
        print('수업자료/ 가 없다 — 실행할 데이터가 없어 끝낸다.')
        sys.exit(0)
    d = tempfile.mkdtemp(prefix='codeblocks-')
    for root, _, names in os.walk(SRC):
        for n in names:
            if n in FILES and not os.path.exists(os.path.join(d, n)):
                shutil.copy(os.path.join(root, n), d)
    return d


def main():
    h = json.load(open(sys.argv[1], encoding='utf-8'))
    os.chdir(stage_data())
    flagged = 0
    for i, b in enumerate(h['blocks']):
        pre = '\n'.join(h['pre'][b['ds']]) + '\n\n' if b.get('ds') else ''
        out = io.StringIO()
        with warnings.catch_warnings(record=True) as w, contextlib.redirect_stdout(out):
            warnings.simplefilter('always')
            try:
                exec(compile(pre + b['src'], f"<{b['ch']}#{i}>", 'exec'), {'__name__': '__main__'})
                err = None
            except Exception as e:  # noqa: BLE001 — 무엇이든 적는다
                err = f'{type(e).__name__}: {e}'
        plt.close('all')
        ws = sorted({f'{x.category.__name__}: {str(x.message)[:100]}' for x in w
                     if not any(s in str(x.message) for s in HARNESS_ONLY)})
        bad = bool(err or ws)
        flagged += bad
        print(f"{'!!' if bad else 'OK'} {b['ch']:15} #{i:<3} {b['src'].splitlines()[0][:70]}")
        if err:
            print('      예외  ', err)
        for x in ws:
            print('      경고  ', x)
        got = out.getvalue().strip()
        if b.get('out') is not None and got and got != b['out'].strip():
            print('      화면  ', b['out'].replace('\n', ' | ')[:150])
            print('      실제  ', got.replace('\n', ' | ')[:150])
    print(f'\n예외·경고 {flagged}건 / 블록 {len(h["blocks"])}개')
    print('# ✗ 로 일부러 에러를 보여 주는 블록(화면 출력에 Error 가 있는 것)은 정상이다.')


if __name__ == '__main__':
    main()
