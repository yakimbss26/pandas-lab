/* browser_check.js — 브라우저에서 전 장을 실검증한다.
 *
 * 플레이북 Phase 4: "여기서 진짜 버그가 나온다." 문법 검사와 node 하네스는 통과했는데
 * 브라우저에서 죽는 경우가 있다. 특히 로드 순서 문제는 브라우저로 열어 보지 않으면 못 잡는다.
 *
 * 쓰는 법 — 앱을 띄운 뒤 콘솔이나 javascript_tool 에서:
 *
 *   fetch('/webapp/test/browser_check.js').then(r => r.text()).then(eval)
 *
 * 결과는 JSON 문자열이다.
 *
 * ★ 클릭은 **항상 살아 있는 DOM 에서 다시 찾아서** 한다.
 *   버튼 목록을 한 번 담아 두고 클릭하면, 그 사이 교체된 버튼(떨어진 노드)을 누르게 되어
 *   실제 사용에서 불가능한 에러가 난다. 처음 이 검사를 만들 때 KeyError 6건이 그렇게 나왔고
 *   전부 오탐이었다.
 */
(function () {
  'use strict';

  var errors = [];
  window.addEventListener('error', function (e) { errors.push('window: ' + e.message); });

  function fail(msg) { errors.push(msg); }

  // ── 1. 전역과 로드 순서
  var globals = {
    DF: !!window.DF, UI: !!window.UI, Lab: !!window.Lab, LabData: !!window.LabData
  };
  Object.keys(globals).forEach(function (k) {
    if (!globals[k]) fail('전역 ' + k + ' 가 없다 — 로드 순서를 확인하라 (df → ui → data → app → modules)');
  });
  if (!window.Lab) return JSON.stringify({ errors: errors, globals: globals }, null, 1);

  var chapters = Lab.chapters();
  if (!chapters.length) {
    fail('등록된 장이 없다 — modules/*.js 가 app.js 보다 **나중에** 로드되어야 한다');
  }

  // 장 번호가 비거나 겹치는지
  var nums = chapters.map(function (c) { return c.num; });
  nums.forEach(function (n, i) {
    if (nums.indexOf(n) !== i) fail('장 번호 중복: ' + n);
  });

  var report = [];
  var TAGLIKE = /<\/?(b|i|em|strong|span|div|code|br|table|td|tr)\b[^>]*>/i;
  var totalCells = 0, tagLeaks = [];

  chapters.forEach(function (c) {
    var before = errors.length;

    // ── 2. render 를 두 번 — 모듈 전역에 가변 상태가 있으면 여기서 드러난다
    var counts = [];
    for (var pass = 0; pass < 2; pass++) {
      var root = document.createElement('div');
      document.body.appendChild(root);
      try {
        c.render(root);
        counts.push(root.querySelectorAll('*').length);
      } catch (e) {
        fail(c.id + ' render pass' + (pass + 1) + ': ' + e.message);
        counts.push(-1);
      }
      if (pass === 1) {
        // ── 3. 표 escape 누출 — raw 를 행에 붙이면 <b> 가 글자로 보인다
        root.querySelectorAll('table.tbl td, table.tbl th').forEach(function (cell) {
          totalCells++;
          if (TAGLIKE.test(cell.textContent)) {
            tagLeaks.push({ id: c.id, text: cell.textContent.slice(0, 60) });
          }
        });
      }
      root.remove();
    }

    // ── 4. 상호작용 — 매번 살아 있는 노드를 다시 찾는다
    var live = document.createElement('div');
    document.body.appendChild(live);
    var clicks = 0;
    try {
      c.render(live);
      for (var i = 0; i < 300; i++) {
        var btns = Array.prototype.filter.call(live.querySelectorAll('button'), function (b) {
          return !b.disabled && !b.dataset.bcSwept && !/다 봤음|초기화/.test(b.textContent);
        });
        if (!btns.length) break;
        btns[0].dataset.bcSwept = '1';
        try { btns[0].click(); clicks++; } catch (e) { fail(c.id + ' click: ' + e.message); }
      }
      Array.prototype.forEach.call(live.querySelectorAll('input[type=range]'), function (r) {
        [r.min, r.max, Math.floor((+r.min + +r.max) / 2)].forEach(function (v) {
          r.value = v;
          r.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    } catch (e) {
      fail(c.id + ' 상호작용: ' + e.message);
    }

    // ── 5. 장마다 지킬 최소선
    var sims = live.querySelectorAll('.card').length;
    var quizzes = Array.prototype.filter.call(live.querySelectorAll('.card'), function (card) {
      return /확인 문제/.test(card.textContent.slice(0, 40));
    }).length;
    var charts = live.querySelectorAll('svg.viz').length;
    var tables = live.querySelectorAll('table.tbl').length;
    // 차트가 있으면 표 보기 twin 이 있어야 한다
    var chartsWithoutTwin = 0;
    Array.prototype.forEach.call(live.querySelectorAll('svg.viz'), function (svg) {
      var box = svg.closest('div');
      var wrap = svg.parentElement && svg.parentElement.parentElement;
      var hasTwin = wrap && /표 보기/.test(wrap.textContent || '');
      if (!hasTwin) chartsWithoutTwin++;
    });
    live.remove();

    report.push({
      id: c.id, num: c.num,
      nodes: counts,
      stableOnRevisit: counts[0] === counts[1],
      clicks: clicks,
      cards: sims, quizCards: quizzes, charts: charts, tables: tables,
      chartsWithoutTableTwin: chartsWithoutTwin,
      newErrors: errors.length - before
    });
  });

  // ── 6. 테마 토큰
  var cs = getComputedStyle(document.documentElement);
  var tokens = {};
  ['--surface-1', '--ink-1', '--c-original', '--c-copy', '--c-result', '--c-danger', '--c-na']
    .forEach(function (v) { tokens[v] = cs.getPropertyValue(v).trim(); });
  Object.keys(tokens).forEach(function (k) {
    if (!tokens[k]) fail('CSS 변수 ' + k + ' 가 비어 있다 — theme.css 가 로드되지 않았다');
  });

  return JSON.stringify({
    ok: errors.length === 0 && tagLeaks.length === 0,
    globals: globals,
    chapterCount: chapters.length,
    errors: errors,
    tableCellsChecked: totalCells,
    tagTextLeaks: tagLeaks,
    themeTokens: tokens,
    scrollRestoration: history.scrollRestoration,
    chapters: report
  }, null, 1);
})();
