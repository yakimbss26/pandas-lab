# verify_md.py — 교재의 코드 블록을 실제로 실행해 출력을 대조한다.
#
# 검증 4중 구조의 3단계. 교재가 틀린 값을 가르치지 않게 막는 마지막 자동 검사다.
#
#   실행:
#     C:\Users\user\...\Python313\python.exe -X utf8 webapp/test/verify_md.py
#     ... verify_md.py docs/draft/part5-missing-dtype.md     (파일 지정)
#
# 판정 규칙 (docs/집필규칙.md §4):
#
#   표시 없음   에러·경고 없이 돌아야 하고, 실린 출력과 일치해야 한다
#   # ✗        **예외 또는 경고**가 나야 정상
#              (pandas 3.0 의 ChainedAssignmentError 는 예외가 아니라 경고다.
#               try/except 로는 안 잡히므로 경고도 성공으로 인정한다)
#   # ⚠        에러·경고 없이 돌아야 하고, 실린 출력과 일치해야 한다
#              (조용히 의도와 다른 결과를 내는 코드)
#
# 노트북 의미를 재현한다: 블록의 **마지막 줄이 표현식이면 그 repr 을 출력**하고,
# print() 는 즉시 출력한다. 중간의 bare expression 은 출력되지 않는다.
#
# ★ 원본 폴더를 건드리지 않는다. 필요한 csv 를 임시 작업 폴더로 복사해 거기서 실행한다
#   (교재의 to_pickle/to_csv 예제가 실제로 파일을 쓴다).

import ast
import contextlib
import io
import os
import re
import shutil
import sys
import tempfile
import traceback
import warnings

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC_DATA = os.path.join(ROOT, "수업자료")

DATA_FILES = [
    "train.csv", "test.csv", "gender_submission.csv",
    "ramen-ratings.csv", "abalone.csv", "housing.data", "lab_earthquake.csv",
]

FENCE = re.compile(r"^```(\w*)\s*$")


# ─────────────────────────────────────────────────────── 블록 추출

def extract_blocks(text):
    """(kind, code, 시작줄, 닫는펜스줄) 목록. kind 는 'python' 또는 'text' 등."""
    out = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        m = FENCE.match(lines[i])
        if not m:
            i += 1
            continue
        kind = m.group(1) or "text"
        start = i + 1
        j = start
        while j < len(lines) and not FENCE.match(lines[j]):
            j += 1
        out.append((kind, "\n".join(lines[start:j]), start + 1, j + 1))
        i = j + 1
    return out


def pair_blocks(blocks):
    """python 블록에 바로 뒤따르는 text 블록을 기대 출력으로 붙인다."""
    paired = []
    k = 0
    while k < len(blocks):
        kind, code, ln, endfence = blocks[k]
        if kind != "python":
            k += 1
            continue
        expected, exp_line = None, None
        # ★ 출력 블록은 코드 블록 **바로 뒤**에 오는 것만 인정한다(빈 줄 하나까지 허용).
        #   사이에 설명 문장이 끼어 있으면 그건 출력이 아니라 예시다.
        #   예: "이 줄을 빼면 다음 경고가 뜬다" 뒤의 ```text``` 는 앞 코드의 출력이 아니다.
        # 줄 계산: 코드의 닫는 펜스 C, 빈 줄 C+1, text 여는 펜스 C+2, 내용 시작 C+3.
        # 즉 빈 줄 하나를 허용하려면 차이 3 까지 인정해야 한다.
        # (2 로 잡았다가 정상 출력 블록이 **전부** 제외되어 검사가 조용히 무력화됐다.
        #  그래서 아래 "기대 출력이 붙은 블록 수" 를 항상 출력한다.)
        if (k + 1 < len(blocks) and blocks[k + 1][0] in ("text", "")
                and blocks[k + 1][2] - endfence <= 3):
            expected = blocks[k + 1][1]
            exp_line = blocks[k + 1][2]
        paired.append({"code": code, "line": ln, "expected": expected, "expLine": exp_line})
        k += 1
    return paired


def marker_of(code):
    """# ✗ / # ⚠ 표시를 찾는다. 없으면 None."""
    if "# ✗" in code:
        return "fail"
    if "# ⚠" in code:
        return "silent"
    return None


def inline_expected(code):
    """블록 끝의 주석 줄들을 기대 출력으로 본다.
    `t.shape` 다음 줄의 `# (891, 12)` 같은 형태.
    ★ 설명 문장이 섞이면 오탐이 되므로, 표시 주석(✗/⚠)과
      한국어가 섞인 주석은 기대 출력으로 보지 않는다."""
    out = []
    for line in reversed(code.strip().split("\n")):
        s = line.strip()
        if not s:
            continue
        if not s.startswith("#"):
            break
        body = s[1:].strip()
        if body.startswith("✗") or body.startswith("⚠"):
            continue
        if re.search(r"[가-힣]", body):        # 설명 주석 -> 기대 출력이 아니다
            continue
        out.append(body)
    return list(reversed(out))


# ─────────────────────────────────────────────────────── 실행

def run_block(code, ns):
    """노트북 한 칸처럼 실행한다. (stdout, 경고목록, 예외) 반환."""
    buf = io.StringIO()
    caught = []
    err = None

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        # ★ ast.parse 를 이 안에서 해야 한다. SyntaxWarning(예: 유효하지 않은 이스케이프
        #   `'\s+'`)은 **파싱 시점**에 나오므로, 밖에서 파싱하면 경고를 놓친다.
        #   그러면 `# ✗` 로 표시한 블록이 "경고가 나지 않았다" 로 잘못 실패한다.
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return "", [], "SyntaxError: %s" % e
        body = tree.body
        last_expr = None
        if body and isinstance(body[-1], ast.Expr):
            last_expr = body.pop()
        try:
            with contextlib.redirect_stdout(buf):
                if body:
                    exec(compile(ast.Module(body=body, type_ignores=[]), "<교재>", "exec"), ns)
                if last_expr is not None:
                    val = eval(compile(ast.Expression(body=last_expr.value), "<교재>", "eval"), ns)
                    if val is not None:
                        print(repr(val) if not hasattr(val, "to_string") else str(val))
        except Exception as e:                                   # noqa: BLE001
            err = "%s: %s" % (type(e).__name__, e)
        caught = ["%s: %s" % (x.category.__name__, str(x.message).split("\n")[0]) for x in w]
    # 하네스 때문에 생기는 경고는 걸러낸다. 교재의 잘못이 아니다.
    #   · matplotlib Agg 백엔드에서 plt.show() 는 "화면에 못 띄운다" 고 경고한다.
    #     학생의 Jupyter 에서는 그림이 정상으로 나온다.
    caught = [c for c in caught if "FigureCanvasAgg is non-interactive" not in c]
    return buf.getvalue(), caught, err


def norm(s):
    """줄 끝 공백과 빈 줄을 없앤 비교용 형태."""
    return [ln.rstrip() for ln in s.strip().split("\n") if ln.strip()]


ELLIPSIS = ("...", "…", "(생략)", "... (생략)")


def strip_display(lines):
    """표 폭에서 오는 차이를 지운 비교용 형태.

    `김민준, 서울 거...` 와 `김민준, 서울 거주...` 은 같은 값이고
    `display.max_colwidth` / 화면 폭만 다른 것이다. 잘림 표시와 공백을 없애고
    남은 글자열을 비교한다. 숫자가 틀린 경우는 여기서도 걸린다.
    """
    joined = " ".join(lines)
    joined = joined.replace("...", " ").replace("…", " ")
    return re.sub(r"\s+", "", joined)


def looks_like_diagram(expected):
    """출력이 아니라 손으로 그린 설명 다이어그램인가.

    집필규칙 §6 이 ASCII 다이어그램을 권하고, 에이전트들이 그것도 ```text``` 로 감쌌다.
    다이어그램을 기대 출력으로 대조하면 전부 오탐이 된다.
    판별: 한국어 설명이 들어 있으면 pandas 출력이 아니다
          (pandas 는 한국어 컬럼명이 아니면 한글을 출력하지 않는다).
    """
    korean_lines = sum(1 for ln in norm(expected) if re.search(r"[가-힣]", ln))
    return korean_lines >= 2


def match_with_ellipsis(got_lines, exp_lines):
    """기대 출력의 `...` 줄은 "여기서 몇 줄이 생략됨" 을 뜻한다.
    교재가 긴 표를 줄여 실을 때 쓰는 표기다."""
    if not any(ln.strip() in ELLIPSIS for ln in exp_lines):
        return None                      # 생략 표기가 없으면 이 규칙을 쓰지 않는다
    segs, cur = [], []
    for ln in exp_lines:
        if ln.strip() in ELLIPSIS:
            segs.append(cur)
            cur = []
        else:
            cur.append(ln)
    segs.append(cur)

    pos = 0
    for i, seg in enumerate(segs):
        if not seg:
            continue
        if i == 0:                       # 첫 조각은 맨 앞에서 시작해야 한다
            if got_lines[pos:pos + len(seg)] != seg:
                return False
            pos += len(seg)
            continue
        found = -1
        for j in range(pos, len(got_lines) - len(seg) + 1):
            if got_lines[j:j + len(seg)] == seg:
                found = j
                break
        if found == -1:
            return False
        pos = found + len(seg)
    return True


# ─────────────────────────────────────────────────────── 대조

def compare(got, expected_block, inline):
    """(일치여부, 설명). 기대 출력이 없으면 (True, 'no-expectation')."""
    g = norm(got)
    if expected_block is not None:
        if looks_like_diagram(expected_block):
            return True, "설명 다이어그램으로 판단 — 대조하지 않음"
        e = norm(expected_block)
        if g == e:
            return True, "출력 일치 (%d줄)" % len(e)
        # 오탐 완화 ①: 표 정렬 공백 차이는 값이 같으면 통과로 본다
        squash = lambda xs: [re.sub(r"\s+", " ", x) for x in xs]      # noqa: E731
        if squash(g) == squash(e):
            return True, "출력 일치 (공백 차이 무시)"
        # 오탐 완화 ②: 교재가 `...` 로 줄여 실은 출력
        ell = match_with_ellipsis(squash(g), squash(e))
        if ell is True:
            return True, "출력 일치 (`...` 생략 표기 인정)"
        # 오탐 완화 ③: 표 폭 때문에 셀이 잘린 차이.
        # 표 폭은 학생의 화면 크기에 따라 달라지는 표시 산물이고 사실이 아니다.
        # 값이 같고 폭만 다르면 실패가 아니라 경고로 분리한다.
        if strip_display(g) == strip_display(e):
            return "warn", "값은 같고 표 폭·잘림만 다르다"
        if ell is False:
            return False, ("`...` 생략을 감안해도 맞지 않는다\n         기대: %s\n         실제: %s"
                           % (" | ".join(e[:3]) or "(없음)", " | ".join(g[:3]) or "(없음)"))
        return False, ("기대 %d줄 / 실제 %d줄\n         기대: %s\n         실제: %s"
                       % (len(e), len(g),
                          " | ".join(e[:4]) or "(없음)",
                          " | ".join(g[:4]) or "(없음)"))
    if inline:
        joined = " ".join(g)
        missing = [c for c in inline if re.sub(r"\s+", " ", c) not in re.sub(r"\s+", " ", joined)]
        if not missing:
            return True, "주석 출력 일치"
        return False, "주석에 적힌 출력이 실제에 없다: %s\n         실제: %s" % (
            " | ".join(missing), " | ".join(g[:4]) or "(없음)")
    return True, "기대 출력 없음 (실행만 확인)"


# ─────────────────────────────────────────────────────── main

FIX = "--fix" in sys.argv


def apply_fixes(path, fixes):
    """어긋난 기대 출력을 실제 출력으로 덮어쓴다.

    fixes: [(text블록의 시작 줄번호(1-based), 새 내용)]
    ★ 이건 검증을 무력화하는 도구가 아니다. 표 폭·버전 차이로 출력만 달라진 곳을
      일괄로 맞추기 위한 것이다. 값이 틀린 경우에는 쓰면 안 되므로
      실행하고 나서 diff 를 반드시 눈으로 확인하라.
    """
    with open(path, encoding="utf-8") as fp:
        lines = fp.read().split("\n")
    # 뒤에서부터 고쳐야 줄번호가 밀리지 않는다
    for start, new in sorted(fixes, key=lambda x: -x[0]):
        i = start - 1                      # 0-based, 펜스 다음 줄
        j = i
        while j < len(lines) and not FENCE.match(lines[j]):
            j += 1
        lines[i:j] = new.split("\n")
    with open(path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args:
        targets = [os.path.join(ROOT, a) if not os.path.isabs(a) else a for a in args]
    else:
        merged = os.path.join(ROOT, "pandas.md")
        if os.path.exists(merged):
            targets = [merged]
        else:
            draft = os.path.join(ROOT, "docs", "draft")
            targets = sorted(
                os.path.join(draft, f) for f in os.listdir(draft)
                if f.startswith("part") and f.endswith(".md")
            ) if os.path.isdir(draft) else []
            print("pandas.md 가 아직 없다 -> docs/draft/part*.md 를 검사한다")

    if not targets:
        print("검사할 파일이 없다.")
        return 1

    # 임시 작업 폴더 — 원본 폴더를 건드리지 않는다
    work = tempfile.mkdtemp(prefix="verify_md_")
    copied = []
    for f in DATA_FILES:
        p = os.path.join(SRC_DATA, f)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(work, f))
            copied.append(f)
    cwd0 = os.getcwd()
    os.chdir(work)

    try:
        import matplotlib
        matplotlib.use("Agg")     # 창을 띄우며 멈추지 않게
    except ImportError:
        pass

    total = ok = 0
    problems = []
    warnings_list = []

    # ★ 표시 옵션을 건드리지 않는다. **pandas 기본값**이 기준이다.
    #   이유: 교재는 학생이 아무 설정 없이 그대로 따라 실행하는 문서다.
    #   여기서 폭을 넓히면 교재에 학생이 보지 못할 출력이 실리게 된다.
    #   교재가 폭을 바꾸고 싶으면 본문에 set_option 코드 블록을 실어야 한다
    #   (part3 이 max_colwidth 를 그렇게 바꾼다 — 그건 정상이다).
    print("")
    print("교재 코드 블록 실행 검증")
    print("  작업 폴더: %s  (csv %d개 복사)" % (work, len(copied)))
    print("  표시 설정: pandas 기본값 (교재가 본문에서 바꾸면 그 설정이 적용된다)")
    if FIX:
        print("  ★ --fix 모드: 어긋난 기대 출력을 실제 출력으로 덮어쓴다")
    print("")

    for tgt in targets:
        rel = os.path.relpath(tgt, ROOT)
        if not os.path.exists(tgt):
            print("  ! 없는 파일: %s" % rel)
            continue
        with open(tgt, encoding="utf-8") as fp:
            text = fp.read()
        blocks = pair_blocks(extract_blocks(text))
        ns = {"__name__": "__교재__"}
        f_ok = f_bad = 0
        file_fixes = []

        for b in blocks:
            total += 1
            mark = marker_of(b["code"])
            got, warns, err = run_block(b["code"], ns)
            inline = inline_expected(b["code"])
            where = "%s:%d" % (rel, b["line"])

            if mark == "fail":
                # 예외 또는 경고 중 하나라도 있어야 정상
                if err or warns:
                    ok += 1
                    f_ok += 1
                else:
                    f_bad += 1
                    problems.append((where, "# ✗ 인데 에러도 경고도 나지 않았다",
                                     b["code"].strip().split("\n")[0]))
                continue

            if err:
                f_bad += 1
                problems.append((where, "예외: %s" % err, b["code"].strip().split("\n")[0]))
                continue
            if warns and mark == "silent":
                f_bad += 1
                problems.append((where, "# ⚠ 인데 경고가 났다: %s" % warns[0],
                                 b["code"].strip().split("\n")[0]))
                continue
            if warns and mark is None:
                f_bad += 1
                problems.append((where, "표시가 없는데 경고가 났다: %s" % warns[0],
                                 b["code"].strip().split("\n")[0]))
                continue

            good, why = compare(got, b["expected"], inline)
            if good == "warn":
                ok += 1
                f_ok += 1
                warnings_list.append((where, why, b["code"].strip().split("\n")[0]))
            elif good:
                ok += 1
                f_ok += 1
            else:
                f_bad += 1
                problems.append((where, why, b["code"].strip().split("\n")[0]))
                # --fix: 출력만 어긋난 경우에 한해 실제 출력으로 덮어쓴다.
                # 다이어그램으로 판단된 블록은 위에서 통과했으므로 여기 오지 않는다.
                if FIX and b["expLine"] and got.strip():
                    file_fixes.append((b["expLine"], got.rstrip("\n")))

        if FIX and file_fixes:
            apply_fixes(tgt, file_fixes)
            print("      -> %d개 기대 출력을 실제 출력으로 덮어썼다" % len(file_fixes))

        marks = sum(1 for b in blocks if marker_of(b["code"]) == "fail")
        silents = sum(1 for b in blocks if marker_of(b["code"]) == "silent")
        # ★ "기대 출력이 붙은 블록 수" 를 반드시 보여준다.
        #   이 숫자가 갑자기 줄면 대조를 안 하고 있다는 뜻이다(무력화된 검사는 통과처럼 보인다).
        with_exp = sum(1 for b in blocks if b["expected"] is not None)
        print("  %-30s 블록 %3d  통과 %3d  실패 %3d   (출력대조 %3d, ✗ %d, ⚠ %d)"
              % (os.path.basename(rel), len(blocks), f_ok, f_bad, with_exp, marks, silents))

    print("")
    if warnings_list:
        print("  경고 (실패는 아니다 — 표 폭 차이):")
        for where, why, first in warnings_list:
            print("    · %s  %s" % (where, why))
        print("")
    if problems:
        print("  실패 상세:")
        for where, why, first in problems:
            print("    ✗ %s" % where)
            print("       코드: %s" % first)
            print("       %s" % why)
        print("")
    print("  합계: 블록 %d  통과 %d  실패 %d" % (total, ok, total - ok))
    print("")
    if problems:
        print("  ★ 오탐 판별 기준은 webapp/test/CLAUDE.md 에 있다. 먼저 그것을 확인하라.")
        print("")

    os.chdir(cwd0)
    shutil.rmtree(work, ignore_errors=True)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
