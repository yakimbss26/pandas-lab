# gen_expected.py — 실제 pandas 로 기대값을 만들어 expected.json 에 쓴다.
#
# 검증 4중 구조의 2단계이고 **가장 강한 보증**이다.
# 손계산 기대값에는 사람의 착각이 섞이지만 실제 pandas 가 낸 출력은 그렇지 않다.
#
#   1) 이 스크립트가 케이스 목록을 정의하고 pandas 로 답을 구해 expected.json 에 쓴다
#   2) cross.test.js 가 같은 케이스를 미니 엔진에 돌려 답을 대조한다
#
# ★ 양쪽이 **완전히 같은 입력**을 봐야 한다. 그래서 fixture 를 여기서 만들어
#   expected.json 에 함께 실어 보낸다. 실제 CSV 를 쓰지 않는 이유:
#   웹앱의 data.js 는 합성 데이터라서 파이썬이 읽는 CSV 와 값이 다르다.
#   엔진의 **의미(semantics)** 를 검증하는 것이 목적이므로 fixture 로 충분하다.
#   (실제 CSV 의 사실값은 docs/정답표.md 가 담당한다.)
#
# 실행:
#   C:\Users\user\AppData\Local\Programs\Python\Python313\python.exe -X utf8 webapp/test/gen_expected.py

import json
import os
import sys

import numpy as np
import pandas as pd

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expected.json")

# ─────────────────────────────────────────────────────── 직렬화

def jsonable(v):
    """pandas/numpy 값을 JS 가 읽을 수 있는 형태로. 결측은 None.

    ★ 순서가 중요하다.
      - bool 을 int 보다 먼저 봐야 한다 (파이썬에서 bool 은 int 의 하위 타입이다)
      - 파이썬 기본 int 를 빠뜨리면 str(v) 로 흘러가 인덱스 라벨이 "0" 같은
        문자열로 나가고, 교차 검증이 전부 불일치로 뜬다 (실제로 겪었다)
    """
    if v is None:
        return None
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, (int, np.integer)):
        return int(v)
    if isinstance(v, (float, np.floating)):
        return None if pd.isna(v) else float(v)
    if isinstance(v, str):
        return v
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return str(v)


def ser_out(s):
    return {
        "index": [jsonable(x) for x in s.index],
        "values": [jsonable(x) for x in s.values],
        "dtype": str(s.dtype),
        "name": None if s.name is None else str(s.name),
    }


def frame_out(df):
    """★ columns 는 jsonable 로 내보낸다. str() 로 하면 정수 컬럼 0,1,2,3 이
    "0","1","2","3" 이 되어 혼합 타입 컬럼 케이스가 전부 불일치로 뜬다(실제로 겪었다).
    data 의 key 는 JSON 규격상 문자열이어야 하므로 그쪽만 str() 를 쓴다."""
    return {
        "index": [jsonable(x) for x in df.index],
        "columns": [jsonable(c) for c in df.columns],
        "dtypes": {str(c): str(t) for c, t in df.dtypes.items()},
        "data": {str(c): [jsonable(x) for x in df[c].values] for c in df.columns},
    }


# ─────────────────────────────────────────────────────── fixture

def make_fixtures():
    """양쪽이 공유하는 입력. 난수를 쓰지 않고 결정적으로 만든다."""
    fx = {}

    # 작은 Series 들 — 정렬(alignment) 검증용
    fx["s_abcde"] = {"values": [1, 2, 3, 4, 5], "index": list("abcde")}
    fx["s_ebcdef"] = {"values": [5, 6, 7, 8, 9, 10], "index": list("ebcdef")}
    fx["s_aab"] = {"values": [1, 2, 3], "index": list("aab")}
    fx["s_aab2"] = {"values": [10, 20, 30], "index": list("aab")}
    fx["s_aa"] = {"values": [1, 2], "index": list("aa")}
    fx["s_aaa"] = {"values": [10, 20, 30], "index": list("aaa")}
    fx["s_ca"] = {"values": [1, 2], "index": list("ca")}
    fx["s_ba"] = {"values": [10, 20], "index": list("ba")}
    fx["s_ca2"] = {"values": [10, 20], "index": list("ca")}
    fx["s_azz"] = {"values": [1, 2, 3], "index": list("azz")}
    fx["s_a1"] = {"values": [10], "index": ["a"]}
    fx["s_int31"] = {"values": [1, 2], "index": [3, 1]}
    fx["s_int21"] = {"values": [10, 20], "index": [2, 1]}

    # 집계·정렬 검증용
    fx["s_nums"] = {"values": [1, 2, 3, 4], "index": [0, 1, 2, 3]}
    fx["s_with_na"] = {"values": [3.0, None, 1.0, 2.0], "index": list("abcd")}
    fx["s_cats"] = {"values": ["S", "C", None, "S", "Q", "S"], "index": list(range(6))}
    fx["s_strnum"] = {"values": ["3.75", "Unrated", "2.25", "5"], "index": list(range(4))}
    # 불린 집계 — `isna().sum()` 관용구의 뿌리다. 엔진이 이걸 0 으로 내던 버그가 있었다.
    fx["s_bool"] = {"values": [True, False, True, True], "index": list(range(4))}

    # 결정적으로 만든 200행 — 실제 규모에서 통계가 맞는지 본다
    n = 200
    vals = []
    for i in range(n):
        # 손으로 재현 가능한 결정적 수열
        vals.append(round(((i * 37) % 91) / 7.0 + (i % 5) * 0.25, 4))
    grp = ["A", "B", "C"][0:0]  # placeholder
    grp = [["A", "B", "C"][i % 3] for i in range(n)]
    sex = [["m", "f"][(i // 3) % 2] for i in range(n)]
    with_na = [None if i % 11 == 0 else vals[i] for i in range(n)]
    ints = [(i * 13) % 7 for i in range(n)]
    fx["big"] = {
        "columns": ["v", "vna", "g", "sex", "k"],
        "data": {"v": vals, "vna": with_na, "g": grp, "sex": sex, "k": ints},
    }

    # merge 검증용
    fx["m_left"] = {"columns": ["id", "x"], "data": {"id": [1, 2, 3], "x": ["a", "b", "c"]}}
    fx["m_right"] = {"columns": ["id", "y"], "data": {"id": [2, 3, 4], "y": ["B", "C", "D"]}}
    fx["m_ldup"] = {"columns": ["id", "x"], "data": {"id": [1, 1], "x": ["a", "b"]}}
    fx["m_rdup"] = {"columns": ["id", "y"], "data": {"id": [1, 1], "y": ["A", "B"]}}

    # DataFrame 정렬 검증용
    fx["f_abc3"] = {"columns": list("abc"),
                    "data": {"a": [0, 3, 6], "b": [1, 4, 7], "c": [2, 5, 8]}}
    fx["f_abcd4"] = {"columns": list("abcd"),
                     "data": {"a": [0, 4, 8, 12], "b": [1, 5, 9, 13],
                              "c": [2, 6, 10, 14], "d": [3, 7, 11, 15]}}
    return fx


FX = make_fixtures()


def S(name):
    f = FX[name]
    return pd.Series(f["values"], index=f["index"])


def F(name):
    f = FX[name]
    return pd.DataFrame({c: f["data"][c] for c in f["columns"]}, columns=f["columns"])


# ─────────────────────────────────────────────────────── 케이스

cases = []


def add(cid, kind, spec, expect, note=""):
    cases.append({"id": cid, "kind": kind, "spec": spec, "expect": expect, "note": note})


# ── 정렬(alignment) — 교재 6장. 엔진에서 가장 틀리기 쉬운 곳
for cid, l, r, op in [
    ("align-dup-right", "s_abcde", "s_ebcdef", "add"),
    ("align-identical-dup", "s_aab", "s_aab2", "add"),
    ("align-cartesian", "s_aa", "s_aaa", "add"),
    ("align-sorted-union", "s_ca", "s_ba", "add"),
    ("align-identical-order", "s_ca", "s_ca2", "add"),
    ("align-left-only-dup", "s_azz", "s_a1", "add"),
    ("align-int-index", "s_int31", "s_int21", "add"),
    ("align-sub", "s_abcde", "s_ebcdef", "sub"),
    ("align-mul", "s_aa", "s_aaa", "mul"),
]:
    res = getattr(S(l), op)(S(r))
    add(cid, "series_binop", {"left": l, "right": r, "op": op}, ser_out(res))

# fill_value
res = S("s_ca").add(S("s_ba"), fill_value=0)
add("align-fillvalue", "series_binop",
    {"left": "s_ca", "right": "s_ba", "op": "add", "fillValue": 0}, ser_out(res))

# 스칼라
res = S("s_with_na").add(10)
add("scalar-add-na", "series_scalar_binop",
    {"left": "s_with_na", "op": "add", "value": 10}, ser_out(res))

# ── Series 집계
_aggs = ["count", "sum", "mean", "std", "min", "max", "median", "nunique"]
for src in ["s_nums", "s_with_na"]:
    for a in _aggs:
        s = S(src)
        try:
            v = getattr(s, a)()
        except Exception as e:              # noqa: BLE001
            add(src + "-" + a, "series_agg", {"src": src, "agg": a},
                {"error": type(e).__name__})
            continue
        add(src + "-" + a, "series_agg", {"src": src, "agg": a}, {"value": jsonable(v)})

# mode — 동률이면 정렬해서 여러 개를 준다. 결측 채우기 비교(교재 8장)에 쓰인다.
FX["s_mode_tie"] = {"values": [1, 2, 2, 3, 3], "index": list(range(5))}
FX["s_mode_one"] = {"values": ["b", "a", "a"], "index": list(range(3))}
FX["s_mode_na"] = {"values": [1, None, 1, 2], "index": list(range(4))}
for name in ["s_mode_tie", "s_mode_one", "s_mode_na"]:
    add(name + "-mode", "series_mode", {"src": name}, ser_out(S(name).mode()))

# 불린 Series 의 집계 — pandas 는 True 를 1 로 센다
for a in ["sum", "mean", "count"]:
    add("s_bool-" + a, "series_agg", {"src": "s_bool", "agg": a},
        {"value": jsonable(getattr(S("s_bool"), a)())},
        "isna().sum() 관용구가 이 동작에 의존한다")

# isna().sum() 을 Series 수준에서 직접 — 교재 8장의 핵심 관용구
_na = S("s_with_na")
add("series-isna-sum", "series_isna_sum", {"src": "s_with_na"},
    {"value": int(_na.isna().sum())},
    "결측 개수를 세는 가장 흔한 방법. 엔진이 0 을 내던 버그가 있었다")
add("series-notna-sum", "series_notna_sum", {"src": "s_with_na"},
    {"value": int(_na.notna().sum())})

# std(ddof=0) — numpy 기본값과 헷갈리는 지점
add("s_nums-std-ddof0", "series_agg", {"src": "s_nums", "agg": "std", "ddof": 0},
    {"value": jsonable(S("s_nums").std(ddof=0))},
    "pandas 기본은 ddof=1. numpy 의 np.std 기본값은 ddof=0 이다")

for q in [0.25, 0.5, 0.75]:
    add("s_nums-q%s" % q, "series_agg", {"src": "s_nums", "agg": "quantile", "q": q},
        {"value": jsonable(S("s_nums").quantile(q))})

# 200행 규모에서도 통계가 맞는가
big = F("big")
for col in ["v", "vna"]:
    for a in ["count", "sum", "mean", "std", "min", "max", "median"]:
        add("big-%s-%s" % (col, a), "frame_col_agg",
            {"src": "big", "col": col, "agg": a},
            {"value": jsonable(getattr(big[col], a)())})
for q in [0.25, 0.5, 0.75]:
    add("big-v-q%s" % q, "frame_col_agg",
        {"src": "big", "col": "v", "agg": "quantile", "q": q},
        {"value": jsonable(big["v"].quantile(q))})

# ── value_counts — pandas 3.0 에서 name 이 'count' 로 바뀌었다
vc = S("s_cats").value_counts()
add("valuecounts-dropna", "series_valuecounts", {"src": "s_cats", "dropna": True}, ser_out(vc))
vc2 = S("s_cats").value_counts(dropna=False)
add("valuecounts-keepna", "series_valuecounts", {"src": "s_cats", "dropna": False}, ser_out(vc2))

# ── sortValues — 결측이 맨 뒤로 가는가
for asc in [True, False]:
    res = S("s_with_na").sort_values(ascending=asc)
    add("sortvalues-%s" % ("asc" if asc else "desc"), "series_sortvalues",
        {"src": "s_with_na", "ascending": asc}, ser_out(res))

# ── fillna / replace / astype / to_numeric — dtype 승격이 핵심
add("fillna-0", "series_fillna", {"src": "s_with_na", "value": 0},
    ser_out(S("s_with_na").fillna(0)),
    "float64 컬럼은 fillna(0) 후에도 float64 다 (int64 로 내려가지 않는다)")
add("fillna-str", "series_fillna", {"src": "s_with_na", "value": "0"},
    ser_out(S("s_with_na").fillna("0")),
    "문자열을 넣으면 object 가 되고 이후 산술이 죽는다 — 교재 8장")
add("tonumeric-coerce", "series_tonumeric", {"src": "s_strnum", "errors": "coerce"},
    ser_out(pd.to_numeric(S("s_strnum"), errors="coerce")))
add("replace-map", "series_replace",
    {"src": "s_cats", "map": {"S": 0, "C": 1, "Q": 2}},
    ser_out(S("s_cats").replace({"S": 0, "C": 1, "Q": 2})),
    "문자열을 숫자로 replace 하면 str 이 아니라 object 가 된다")

# object 가 된 컬럼의 산술은 죽는다 — 재현해야 하는 동작
try:
    S("s_with_na").fillna("0").mean()
    _err = None
except Exception as e:                      # noqa: BLE001
    _err = type(e).__name__
add("fillna-str-then-mean", "series_fillna_then_agg",
    {"src": "s_with_na", "value": "0", "agg": "mean"},
    {"error": _err}, "TypeError 가 나야 정상이다")

# ── dtype 추론
for cid, vals in [
    ("dtype-int", [1, 2, 3]),
    ("dtype-float", [1, 2.5]),
    ("dtype-int-na", [1, None]),
    ("dtype-str", ["a", "b"]),
    ("dtype-mixed", [1, "a"]),
    ("dtype-bool", [True, False]),
    ("dtype-bool-num", [True, 1]),
]:
    add(cid, "dtype_infer", {"values": vals}, {"dtype": str(pd.Series(vals).dtype)})

# ── DataFrame 기본
add("big-shape", "frame_shape", {"src": "big"}, {"shape": list(big.shape)})
add("big-dtypes", "frame_dtypes", {"src": "big"},
    {"dtypes": {str(c): str(t) for c, t in big.dtypes.items()}})
add("big-isna-sum", "frame_isna_sum", {"src": "big"}, ser_out(big.isna().sum()))
add("big-count", "frame_count", {"src": "big"}, ser_out(big.count()))
add("big-dropna", "frame_dropna", {"src": "big", "subset": ["vna"]},
    {"rows": int(big.dropna(subset=["vna"]).shape[0])})
add("big-describe-v", "frame_describe_col", {"src": "big", "col": "v"},
    ser_out(big.describe()["v"]))

# 슬라이싱·필터
add("big-head5", "frame_head", {"src": "big", "n": 5}, frame_out(big.head(5)))
mask_rows = big[big["v"] > 6]
add("big-mask", "frame_mask", {"src": "big", "col": "v", "op": "gt", "value": 6},
    {"rows": int(mask_rows.shape[0]), "index": [jsonable(x) for x in mask_rows.index[:20]]})

# 정렬
sv = big.sort_values(["g", "v"], ascending=True).head(10)
add("big-sortvalues", "frame_sortvalues",
    {"src": "big", "by": ["g", "v"], "ascending": True, "head": 10}, frame_out(sv))

# ── groupby
for keys, col, agg in [
    (["g"], "v", "mean"),
    (["g"], "v", "sum"),
    (["g"], "v", "max"),
    (["g"], "vna", "mean"),
    (["g"], "vna", "count"),
    (["g", "sex"], "v", "mean"),
    (["k"], "v", "mean"),
]:
    res = big.groupby(keys)[col].agg(agg)
    if len(keys) > 1:
        res = pd.Series(res.values,
                        index=[" / ".join(str(x) for x in t) for t in res.index],
                        name=res.name)
    add("gb-%s-%s-%s" % ("_".join(keys), col, agg), "frame_groupby_agg",
        {"src": "big", "keys": keys, "col": col, "agg": agg}, ser_out(res))

gsz = big.groupby("g").size()
add("gb-size", "frame_groupby_size", {"src": "big", "keys": ["g"]}, ser_out(gsz))

gagg = big.groupby("g").agg({"v": "max", "vna": "mean"})
add("gb-multi-agg", "frame_groupby_multiagg",
    {"src": "big", "keys": ["g"], "spec": {"v": "max", "vna": "mean"}}, frame_out(gagg))

# ── merge
for cid, l, r, how in [
    ("merge-inner", "m_left", "m_right", "inner"),
    ("merge-left", "m_left", "m_right", "left"),
    ("merge-right", "m_left", "m_right", "right"),
    ("merge-outer", "m_left", "m_right", "outer"),
    ("merge-dup-both", "m_ldup", "m_rdup", "inner"),
]:
    res = F(l).merge(F(r), on="id", how=how)
    add(cid, "frame_merge", {"left": l, "right": r, "on": "id", "how": how},
        {"rows": int(res.shape[0]), "columns": [str(c) for c in res.columns],
         "ids": [jsonable(x) for x in res["id"].values]})

# ★ 겹치는 컬럼의 접미사 — 양쪽에 _x / _y 가 붙고 키에는 붙지 않는다
FX["m_lcol"] = {"columns": ["id", "x", "note"],
                "data": {"id": [1, 2], "x": ["a", "b"], "note": ["L1", "L2"]}}
FX["m_rcol"] = {"columns": ["id", "y", "note"],
                "data": {"id": [1, 2], "y": ["A", "B"], "note": ["R1", "R2"]}}
_sfx = F("m_lcol").merge(F("m_rcol"), on="id")
add("merge-suffixes", "frame_merge",
    {"left": "m_lcol", "right": "m_rcol", "on": "id", "how": "inner"},
    {"rows": int(_sfx.shape[0]), "columns": [str(c) for c in _sfx.columns],
     "ids": [jsonable(x) for x in _sfx["id"].values]},
    "note_x / note_y 양쪽에 붙고 키 id 에는 붙지 않는다")

# ── DataFrame 끼리의 정렬 — 인덱스와 컬럼 둘 다
res = F("f_abc3").add(F("f_abcd4"))
add("frame-align-add", "frame_binop",
    {"left": "f_abc3", "right": "f_abcd4", "op": "add"}, frame_out(res))

# ── DataFrame + Series 브로드캐스팅 (교재 6.6절)
_s_abcd = pd.Series([10, 11, 12, 13], index=list("abcd"))
add("frame-add-series-cols", "frame_series_binop",
    {"left": "f_abcd4", "op": "add", "series": {"values": [10, 11, 12, 13], "index": list("abcd")}},
    frame_out(F("f_abcd4").add(_s_abcd)),
    "기본은 컬럼에 맞춘다")

_s_0123 = pd.Series([10, 11, 12, 13])          # index 0,1,2,3
_mixed = F("f_abcd4").add(_s_0123)
add("frame-add-series-mismatch", "frame_series_binop",
    {"left": "f_abcd4", "op": "add", "series": {"values": [10, 11, 12, 13], "index": [0, 1, 2, 3]}},
    frame_out(_mixed),
    "★ 컬럼 라벨과 겹치지 않으면 컬럼이 8개로 늘고 전부 NaN 이 된다. "
    "게다가 컬럼 순서가 **정렬되지 않고** 왼쪽->오른쪽이다 (Series 인덱스 합집합과 규칙이 다르다)")

add("frame-add-series-axis0", "frame_series_binop",
    {"left": "f_abcd4", "op": "add", "axis": 0,
     "series": {"values": [10, 11, 12, 13], "index": [0, 1, 2, 3]}},
    frame_out(F("f_abcd4").add(_s_0123, axis=0)),
    "axis=0 은 행에 맞춘다")

# ── 전치
add("frame-transpose", "frame_transpose", {"src": "f_abc3"}, frame_out(F("f_abc3").T))

# ─────────────────────────────────────────────────────── 쓰기

payload = {
    "meta": {
        "pandas": pd.__version__,
        "numpy": np.__version__,
        "python": sys.version.split()[0],
        "note": "gen_expected.py 가 생성. 손으로 고치지 마라. "
                "cross.test.js 가 이 파일을 읽어 미니 엔진과 대조한다.",
    },
    "fixtures": FX,
    "cases": cases,
}

with open(OUT, "w", encoding="utf-8") as fp:
    json.dump(payload, fp, ensure_ascii=False, indent=1)

print("wrote %s (%d bytes)" % (OUT, os.path.getsize(OUT)))
print("fixtures: %d, cases: %d" % (len(FX), len(cases)))
kinds = {}
for c in cases:
    kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
for k in sorted(kinds):
    print("  %-28s %d" % (k, kinds[k]))
