# `data/` — 학생이 사이트에서 내려받는 파일

GitHub Pages 가 그대로 서빙한다: `https://yakimbss26.github.io/pandas-lab/data/<파일>`.
**여기 있는 것은 전부 공개된다.** 원본 데이터(`수업자료/`)는 절대 두지 않는다.

| 파일 | 무엇 | 누가 만드나 |
|:---|:---|:---|
| `titanic-synthetic.csv` | 타이타닉 합성본(891행 × 12열). 1부 연습 문제 "타이타닉 데이터 다루기" 를 `train.csv` 없이 풀 때 쓴다 | `webapp/build.js` 의 `writeSyntheticCsv` — **손으로 고치지 않는다** |

## 지킬 것

- **빌드 산출물이다.** 웹앱의 `data.js` 에 든 합성 타이타닉과 같은 레코드를 CSV 로 쓴 것이다(씨앗 고정 → 매번 같은 파일).
  원본이 없어 `data.js` 를 보존하는 빌드에서는 이 파일도 건드리지 않는다.
- **`check_licensing.js` 의 STRICT 대상이다.** 원본 승객 이름·티켓 번호 같은 값이 하나라도 섞이면 실패한다.
- **합성본을 바꾸면 연습 문제의 합성본 정답도 바뀐다.** `docs/scripts/make_titanic_drill.py` →
  `node webapp/book_part2.js --force` → `verify_md.py` 순서로 다시 만든다.
- 합성본은 결측 **개수**만 원본과 같고 자리는 무작위다. 그래서 "객실 번호가 있으면 생존율이 높다" 같은
  **관계는 재현되지 않는다**(연습 정답의 "합성본 주의" 가 문항마다 이 점을 밝힌다).
