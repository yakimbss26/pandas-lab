/* ui.js — 공용 위젯
 *
 * 화면 모듈은 여기 있는 것만 쓴다. 모듈마다 표·차트를 새로 만들면 장마다 모양이 달라진다.
 *
 * 규칙 (전부 NumPy Lab 에서 실제로 깨져 본 것):
 *   ① HTML escape 는 **열(cols) 속성**이다. UI.table 의 raw:true 는 cols 에 붙인다.
 *      행에 붙이면 <b> 가 글자로 보인다.
 *   ② 모든 차트에 **표 보기 twin** 을 붙인다. 툴팁이 값을 읽는 유일한 경로가 되면 안 된다.
 *   ③ 계열이 2개 이상이면 범례 필수. 값 라벨은 의미 있는 것만.
 *   ④ 값·라벨 텍스트는 **계열색을 입지 않는다.** 잉크 토큰만 쓴다.
 *   ⑤ 강조는 색이 아니라 링(is-focus)이다. 노랑을 쓰지 마라 — 주황과 구분되지 않는다.
 *   ⑥ 이중 y축 금지. 스케일이 다르면 차트를 나눈다.
 *
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다.
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var seq = 0;
  function uid(p) { return (p || 'u') + (++seq); }

  // ─────────────────────────────────────────────── DOM 도우미

  /* el('div.card', {onclick:fn}, [자식…]) — 태그에 .클래스 를 붙일 수 있다 */
  function el(spec, attrs, children) {
    var parts = String(spec).split('.');
    var node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i++) node.classList.add(parts[i]);
    applyAttrs(node, attrs);
    append(node, children);
    return node;
  }

  function svg(spec, attrs, children) {
    var parts = String(spec).split('.');
    var node = document.createElementNS(SVG_NS, parts[0]);
    for (var i = 1; i < parts.length; i++) node.classList.add(parts[i]);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'text') node.textContent = String(v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    append(node, children);
    return node;
  }

  function applyAttrs(node, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined) return;
      if (k === 'text') node.textContent = String(v);
      else if (k === 'html') node.innerHTML = v;          // 호출자가 escape 책임을 진다
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k in node && k !== 'list') node[k] = v;
      else node.setAttribute(k, v);
    });
  }

  function append(node, children) {
    if (children === null || children === undefined) return;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  // ─────────────────────────────────────────────── 값 표시

  function isNA(v) { return v === null || v === undefined || (typeof v === 'number' && isNaN(v)); }

  /* 표시용 문자열. 실수는 소수 6자리에서 끊는다(교재의 정답표와 같은 규칙). */
  function fmt(v, digits) {
    if (isNA(v)) return 'NaN';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      var d = digits === undefined ? 6 : digits;
      return String(Number(v.toFixed(d)));
    }
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
  }

  // ─────────────────────────────────────────────── 표

  /* UI.table(cols, rows, opts)
   *   cols: [{key, label, raw?, align?, width?}]  ← raw:true 는 **여기** 붙인다
   *   rows: [{key: value, …}]  또는 [[값…]]
   *   opts: { maxRows, hlRows:[i…], hlCells:[[i,key]…], caption, frame:'original'|'copy'|'result' }
   */
  function table(cols, rows, opts) {
    opts = opts || {};
    var wrap = el('div.tbl-wrap');
    if (opts.frame) wrap.classList.add('frame--' + opts.frame);
    var t = el('table.tbl');

    var thead = el('thead');
    var htr = el('tr');
    cols.forEach(function (c) {
      var th = el('th', { text: c.label === undefined ? c.key : c.label });
      if (c.width) th.style.width = c.width;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    t.appendChild(thead);

    var tbody = el('tbody');
    var limit = opts.maxRows === undefined ? rows.length : Math.min(rows.length, opts.maxRows);
    var hlRows = new Set(opts.hlRows || []);
    var hlCells = new Set((opts.hlCells || []).map(function (p) { return p[0] + ' ' + p[1]; }));

    for (var i = 0; i < limit; i++) {
      var row = rows[i];
      var tr = el('tr');
      if (hlRows.has(i)) tr.classList.add('hl');
      cols.forEach(function (c, ci) {
        var v = Array.isArray(row) ? row[ci] : row[c.key];
        var td = el('td');
        if (c.raw) td.innerHTML = isNA(v) ? 'NaN' : String(v);  // 열이 raw 를 선언했을 때만
        else td.textContent = fmt(v, c.digits);
        if (isNA(v)) td.classList.add('na');
        if (c.align) td.style.textAlign = c.align;
        if (hlCells.has(i + ' ' + c.key)) td.classList.add('is-focus');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    t.appendChild(tbody);
    wrap.appendChild(t);

    if (rows.length > limit) {
      wrap.appendChild(el('div.note', {
        text: '· ' + rows.length + '행 중 ' + limit + '행만 보여준다 (' + (rows.length - limit) + '행 생략)'
      }));
    }
    if (opts.caption) wrap.appendChild(el('div.panel-title', { text: opts.caption }));
    return wrap;
  }

  /* DF.DataFrame 을 그대로 그린다. 인덱스 열이 앞에 붙는다. */
  function frameTable(df, opts) {
    opts = opts || {};
    var cols = [{ key: '__index__', label: opts.indexLabel || (df.index.name === null ? '' : df.index.name) }];
    df.columns.forEach(function (n) { cols.push({ key: n, label: n, digits: opts.digits }); });
    var rows = [];
    var limit = opts.maxRows === undefined ? df.nrows() : Math.min(df.nrows(), opts.maxRows);
    for (var i = 0; i < limit; i++) {
      var r = { __index__: df.index.at(i) };
      df.columns.forEach(function (n) { r[n] = df.col(n).at(i); });
      rows.push(r);
    }
    var node = table(cols, rows, Object.assign({}, opts, { maxRows: undefined }));
    if (df.nrows() > limit) {
      node.appendChild(el('div.note', {
        text: '[' + df.nrows() + ' rows x ' + df.ncols() + ' columns]'
      }));
    }
    return node;
  }

  function seriesTable(s, opts) {
    opts = opts || {};
    var rows = [];
    var limit = opts.maxRows === undefined ? s.length() : Math.min(s.length(), opts.maxRows);
    for (var i = 0; i < limit; i++) rows.push({ idx: s.index.at(i), val: s.at(i) });
    var node = table(
      [{ key: 'idx', label: s.index.name === null ? '' : s.index.name },
       { key: 'val', label: s.name === null ? '' : s.name, digits: opts.digits }],
      rows, Object.assign({}, opts, { maxRows: undefined })
    );
    node.appendChild(el('div.note', {
      text: (s.name === null ? '' : 'Name: ' + s.name + ', ') + 'dtype: ' + s.dtype
    }));
    return node;
  }

  // ─────────────────────────────────────────────── Copy-on-Write 시각화

  /* 블록 상태를 보여준다. refs 와 뷰 여부가 CoW 시뮬레이터의 핵심이다. */
  function blockView(df, opts) {
    opts = opts || {};
    var info = df.blockInfo();
    var box = el('div.card');
    box.appendChild(el('div.panel-title', { text: opts.title || '내부 저장 상태' }));
    var cols = [
      { key: 'column', label: '컬럼' },
      { key: 'blockId', label: '블록 #' },
      { key: 'refs', label: '참조 수' },
      { key: 'state', label: '상태' },
      { key: 'len', label: '보는 길이' }
    ];
    box.appendChild(table(cols, info.map(function (b) {
      return {
        column: b.column,
        blockId: 'B' + b.blockId,
        refs: b.refs,
        state: b.isView ? '뷰 (메모리 공유)' : (b.refs > 1 ? '공유 중' : '단독 소유'),
        len: b.viewLength + ' / ' + b.blockLength
      };
    }), {}));
    box.appendChild(el('div.note', {
      text: '참조 수가 1 보다 크거나 뷰인 컬럼에 값을 쓰면 그 순간 블록이 복사된다(Copy-on-Write).'
    }));
    return box;
  }

  /* 두 프레임이 같은 블록을 보고 있는지 한 줄로 알려준다. */
  function shareBadge(a, b, labelA, labelB) {
    var shared = window.DF.sharesMemory(a, b);
    var row = el('div.chip' + (shared ? '.chip--original' : '.chip--copy'));
    row.appendChild(document.createTextNode(
      (labelA || 'A') + ' 와 ' + (labelB || 'B') + ' 는 ' +
      (shared ? '같은 메모리를 본다 (공유)' : '다른 메모리를 본다 (복사됨)')
    ));
    return row;
  }

  // ─────────────────────────────────────────────── 인덱스 정렬 시각화

  /* 두 Series 의 인덱스가 어떻게 짝지어지는지 그린다.
   * 중복 라벨이 행을 늘리는 것이 눈에 보여야 한다 — 교재 6장의 핵심. */
  function alignView(left, right, result, opts) {
    opts = opts || {};
    var DF = window.DF;
    var al = DF.alignIndexes(left.index, right.index);
    var box = el('div.card');
    box.appendChild(el('div.panel-title', {
      text: opts.title || ('인덱스 짝짓기 — ' +
        (al.pairs.length > Math.max(left.length(), right.length())
          ? '결과가 ' + al.pairs.length + '행으로 늘어났다'
          : '결과 ' + al.pairs.length + '행'))
    }));

    var rows = al.pairs.map(function (p, i) {
      return {
        label: p[2],
        lv: p[0] === -1 ? null : left.at(p[0]),
        lp: p[0] === -1 ? '—' : p[0],
        rv: p[1] === -1 ? null : right.at(p[1]),
        rp: p[1] === -1 ? '—' : p[1],
        out: result ? result.at(i) : null
      };
    });
    // 곱집합으로 늘어난 행을 링으로 강조한다 (색이 아니라 링)
    var counts = {};
    rows.forEach(function (r) { counts[r.label] = (counts[r.label] || 0) + 1; });
    var hl = [];
    rows.forEach(function (r, i) { if (counts[r.label] > 1) hl.push(i); });

    box.appendChild(table([
      { key: 'label', label: '라벨' },
      { key: 'lp', label: '왼쪽 위치' },
      { key: 'lv', label: '왼쪽 값' },
      { key: 'rp', label: '오른쪽 위치' },
      { key: 'rv', label: '오른쪽 값' },
      { key: 'out', label: '결과' }
    ], rows, { hlRows: hl }));

    box.appendChild(el('div.note', {
      text: al.pairs.length > Math.max(left.length(), right.length())
        ? '표시된 행은 라벨이 양쪽에 여러 개라 곱집합으로 짝지어진 것이다. 그래서 행이 늘어났다.'
        : (left.index.equals(right.index)
          ? '두 인덱스가 완전히 같으므로 정렬하지 않고 위치로 짝짓는다.'
          : '두 인덱스가 다르므로 합집합을 정렬해서 짝짓는다. 한쪽에만 있는 라벨은 NaN 이 된다.')
    }));
    return box;
  }

  // ─────────────────────────────────────────────── groupby 시각화

  function groupView(df, groupby, opts) {
    opts = opts || {};
    var box = el('div.card');
    box.appendChild(el('div.panel-title', { text: opts.title || 'split → apply → combine' }));
    var groups = groupby.groups();
    groups.forEach(function (g) {
      var head = el('div.chip.chip--original');
      head.appendChild(document.createTextNode(
        groupby.keys.join(' / ') + ' = ' + g.key.join(' / ') + '  (' + g.rows.length + '행)'
      ));
      box.appendChild(head);
      var sub = df.take(g.rows);
      box.appendChild(frameTable(sub, { maxRows: opts.maxRowsPerGroup || 4 }));
    });
    box.appendChild(el('div.note', {
      text: '그룹마다 행을 따로 모은 뒤(split) 각 묶음에 함수를 적용하고(apply) 결과를 한 표로 합친다(combine).'
    }));
    return box;
  }

  // ─────────────────────────────────────────────── 차트

  function scale(domain, range) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    var span = d1 - d0 || 1;
    return function (v) { return r0 + (v - d0) / span * (r1 - r0); };
  }

  function niceTicks(min, max, count) {
    count = count || 5;
    var span = (max - min) || 1;
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], t = Math.ceil(min / step) * step;
    for (; t <= max + step * 1e-9; t += step) out.push(Number(t.toFixed(10)));
    return out;
  }

  /* 차트 + 표 보기 twin. 모든 차트는 이 껍데기를 통해 나간다. */
  function withTableTwin(chartNode, tableNode, opts) {
    opts = opts || {};
    var box = el('div');
    if (opts.title) box.appendChild(el('div.panel-title', { text: opts.title }));
    var bar = el('div.control-row');
    var bChart = el('button', { text: '차트', 'aria-pressed': 'true' });
    var bTable = el('button', { text: '표 보기', 'aria-pressed': 'false' });
    var chartWrap = el('div.viz-wrap', null, chartNode);
    var tableWrap = el('div', { style: { display: 'none' } }, tableNode);
    function show(isChart) {
      chartWrap.style.display = isChart ? '' : 'none';
      tableWrap.style.display = isChart ? 'none' : '';
      bChart.setAttribute('aria-pressed', isChart ? 'true' : 'false');
      bTable.setAttribute('aria-pressed', isChart ? 'false' : 'true');
    }
    bChart.addEventListener('click', function () { show(true); });
    bTable.addEventListener('click', function () { show(false); });
    bar.appendChild(bChart);
    bar.appendChild(bTable);
    box.appendChild(bar);
    box.appendChild(chartWrap);
    box.appendChild(tableWrap);
    return box;
  }

  function tooltipLayer() {
    var tip = el('div.tooltip', { style: { display: 'none' } });
    document.body.appendChild(tip);
    return {
      show: function (html, x, y) {
        tip.innerHTML = html;
        tip.style.display = '';
        tip.style.left = (x + 12) + 'px';
        tip.style.top = (y + 12) + 'px';
      },
      hide: function () { tip.style.display = 'none'; },
      node: tip
    };
  }
  var TIP = null;
  function tip() { if (!TIP) TIP = tooltipLayer(); return TIP; }

  /* 막대 그래프. items: [{label, value}] — 단일 계열이므로 범례 없음(제목이 이름을 진다). */
  function bar(items, opts) {
    opts = opts || {};
    var W = opts.width || 560, H = opts.height || Math.max(160, items.length * 26 + 40);
    var padL = opts.padLeft || 90, padR = 44, padT = 8, padB = 26;
    var maxV = Math.max.apply(null, items.map(function (d) { return d.value; }).concat([0]));
    var minV = Math.min.apply(null, items.map(function (d) { return d.value; }).concat([0]));
    var x = scale([Math.min(0, minV), maxV || 1], [padL, W - padR]);
    var rowH = (H - padT - padB) / Math.max(1, items.length);
    var barH = Math.min(18, rowH - 6);
    var color = opts.color || 'var(--c-original)';

    var kids = [];
    niceTicks(Math.min(0, minV), maxV || 1, 4).forEach(function (t) {
      kids.push(svg('line.grid-line', { x1: x(t), x2: x(t), y1: padT, y2: H - padB }));
      kids.push(svg('text.tick-label', { x: x(t), y: H - padB + 14, 'text-anchor': 'middle', text: fmt(t) }));
    });
    kids.push(svg('line.axis-line', { x1: x(0), x2: x(0), y1: padT, y2: H - padB }));

    items.forEach(function (d, i) {
      var cy = padT + i * rowH + rowH / 2;
      var x0 = x(Math.min(0, d.value)), x1 = x(Math.max(0, d.value));
      var isNAv = isNA(d.value);
      var r = svg('rect.mark', {
        x: x0, y: cy - barH / 2, width: Math.max(1, x1 - x0), height: barH,
        rx: 4, ry: 4,                                   // 4px 라운딩, 기준선에 붙는다
        fill: isNAv ? 'var(--c-na)' : color,
        'fill-opacity': isNAv ? 0.35 : 1
      });
      r.addEventListener('mousemove', function (e) {
        tip().show('<b>' + esc(d.label) + '</b><br>' + esc(fmt(d.value)), e.clientX, e.clientY);
      });
      r.addEventListener('mouseleave', function () { tip().hide(); });
      kids.push(r);
      kids.push(svg('text.tick-label', {
        x: padL - 8, y: cy + 4, 'text-anchor': 'end', text: d.label
      }));
      // 값 라벨은 잉크 토큰. 계열색을 입지 않는다
      kids.push(svg('text.value-label', { x: x1 + 6, y: cy + 4, text: fmt(d.value) }));
    });

    var node = svg('svg.viz', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img' }, kids);
    var tbl = table([{ key: 'label', label: opts.labelHeader || '항목' },
                     { key: 'value', label: opts.valueHeader || '값' }], items, {});
    return withTableTwin(node, tbl, { title: opts.title });
  }

  /* 히스토그램. values 를 bins 개로 나눈다. */
  function hist(values, opts) {
    opts = opts || {};
    var nums = values.filter(function (v) { return typeof v === 'number' && !isNaN(v); });
    if (!nums.length) return el('div.note', { text: '숫자 값이 없다' });
    var bins = opts.bins || 20;
    var lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
    var step = (hi - lo) / bins || 1;
    var counts = new Array(bins).fill(0);
    nums.forEach(function (v) {
      var k = Math.min(bins - 1, Math.floor((v - lo) / step));
      counts[k]++;
    });
    var items = counts.map(function (c, i) {
      return { label: fmt(lo + i * step, 2) + ' ~ ' + fmt(lo + (i + 1) * step, 2), value: c };
    });
    return bar(items, Object.assign({ padLeft: 120, labelHeader: '구간', valueHeader: '개수' }, opts));
  }

  /* 산점도. 계열이 3개를 넘지 않게 한다(팔레트 all-pairs 한계). */
  function scatter(series, opts) {
    opts = opts || {};
    if (series.length > 3) {
      throw new Error('산점도 계열은 3개까지다. 더 필요하면 "그 외" 로 묶거나 차트를 나눠라 (팔레트 all-pairs 한계).');
    }
    var W = opts.width || 560, H = opts.height || 340;
    var padL = 52, padR = 16, padT = 12, padB = 40;
    var all = series.reduce(function (a, s) { return a.concat(s.points); }, []);
    var xs = all.map(function (p) { return p[0]; }), ys = all.map(function (p) { return p[1]; });
    var x = scale([Math.min.apply(null, xs), Math.max.apply(null, xs)], [padL, W - padR]);
    var y = scale([Math.min.apply(null, ys), Math.max.apply(null, ys)], [H - padB, padT]);
    var COLORS = ['var(--c-original)', 'var(--c-copy)', 'var(--c-result)'];

    var kids = [];
    niceTicks(Math.min.apply(null, ys), Math.max.apply(null, ys), 4).forEach(function (t) {
      kids.push(svg('line.grid-line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t) }));
      kids.push(svg('text.tick-label', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end', text: fmt(t, 2) }));
    });
    niceTicks(Math.min.apply(null, xs), Math.max.apply(null, xs), 5).forEach(function (t) {
      kids.push(svg('text.tick-label', { x: x(t), y: H - padB + 16, 'text-anchor': 'middle', text: fmt(t, 2) }));
    });
    kids.push(svg('line.axis-line', { x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));
    if (opts.xLabel) kids.push(svg('text.axis-label', { x: (padL + W - padR) / 2, y: H - 6, 'text-anchor': 'middle', text: opts.xLabel }));
    if (opts.yLabel) kids.push(svg('text.axis-label', { x: 12, y: padT + 4, text: opts.yLabel }));

    series.forEach(function (s, si) {
      s.points.forEach(function (p) {
        var c = svg('circle.mark', {
          cx: x(p[0]), cy: y(p[1]), r: Math.max(4, (opts.markerSize || 8) / 2),
          fill: COLORS[si], 'fill-opacity': 0.75
        });
        c.addEventListener('mousemove', function (e) {
          tip().show('<b>' + esc(s.name) + '</b><br>' + fmt(p[0], 3) + ', ' + fmt(p[1], 3), e.clientX, e.clientY);
        });
        c.addEventListener('mouseleave', function () { tip().hide(); });
        kids.push(c);
      });
    });

    var node = svg('svg.viz', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img' }, kids);

    var rows = [];
    series.forEach(function (s) {
      s.points.forEach(function (p) { rows.push({ series: s.name, x: p[0], y: p[1] }); });
    });
    var tbl = table([{ key: 'series', label: '계열' },
                     { key: 'x', label: opts.xLabel || 'x', digits: 3 },
                     { key: 'y', label: opts.yLabel || 'y', digits: 3 }], rows, { maxRows: 100 });

    /* svg 를 withTableTwin 에 직접 넘긴다(bar/hist 와 같은 구조 — svg 의 부모가 곧 .viz-wrap 이다).
     * 전에는 svg 와 범례를 한 div 로 감싸서 넘겼는데, 그러면 svg 의 조부모가 .viz-wrap 이 아니라
     * 그 감싼 div 가 되어 "표 보기 twin이 있는가" 를 조상 2단계로 검사하는 도구(browser_check.js)가
     * 오탐(twin 없음)을 냈다. 범례는 결과 상자에 형제로 붙인다 — 표 보기로 전환해도 계열 색을
     * 계속 알아볼 수 있어서 오히려 더 낫다. */
    var out = withTableTwin(node, tbl, { title: opts.title });
    if (series.length >= 2) {
      out.appendChild(legend(series.map(function (s, i) {
        return { label: s.name, color: COLORS[i] };
      })));
    }
    return out;
  }

  /* 범례 — 계열 2개 이상이면 반드시 붙는다. 색 옆에 항상 글자가 온다. */
  function legend(items) {
    var box = el('div.legend');
    items.forEach(function (it) {
      var c = el('span.chip');
      c.style.setProperty('--chip-color', it.color);
      c.appendChild(document.createTextNode(it.label));
      box.appendChild(c);
    });
    return box;
  }

  // ─────────────────────────────────────────────── 컨트롤

  function slider(opts) {
    var row = el('div.control-row');
    var out = el('span.mono', { text: String(opts.value) });
    var input = el('input', {
      type: 'range', min: opts.min, max: opts.max, step: opts.step || 1, value: opts.value
    });
    input.addEventListener('input', function () {
      out.textContent = input.value;
      if (opts.onChange) opts.onChange(Number(input.value));
    });
    if (opts.label) row.appendChild(el('span.control-label', { text: opts.label }));
    row.appendChild(input);
    row.appendChild(out);
    return row;
  }

  function buttonGroup(items, opts) {
    opts = opts || {};
    var row = el('div.control-row');
    if (opts.label) row.appendChild(el('span.control-label', { text: opts.label }));
    var btns = [];
    items.forEach(function (it, i) {
      var b = el('button', { text: it.label, 'aria-pressed': i === (opts.selected || 0) ? 'true' : 'false' });
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        if (opts.onChange) opts.onChange(it.value === undefined ? it.label : it.value, i);
      });
      btns.push(b);
      row.appendChild(b);
    });
    return row;
  }

  function toggle(opts) {
    var b = el('button', { text: opts.label, 'aria-pressed': opts.value ? 'true' : 'false' });
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (opts.onChange) opts.onChange(on);
    });
    return b;
  }

  // ─────────────────────────────────────────────── 코드·출력

  /* 데이터셋별 실행 준비 코드.
   * 웹앱의 코드 조각은 `t`, `df` 같은 변수를 이미 있다고 가정한다. 학생이 IDLE 이나
   * 주피터에 그대로 붙이면 NameError 가 난다. 그래서 복사할 때 이걸 앞에 붙여 준다. */
  var PREAMBLE = {
    titanic: ['import pandas as pd', '', "t = pd.read_csv('train.csv')"],
    ramen: ['import pandas as pd', '', "ramen = pd.read_csv('ramen-ratings.csv')"],
    abalone: ['import pandas as pd', '', "df = pd.read_csv('abalone.csv')"],
    earthquake: ['import pandas as pd', '', "data = pd.read_csv('lab_earthquake.csv')"]
  };

  /* 클립보드에 쓴다. https 가 아니거나 file:// 로 열면 navigator.clipboard 가 없으므로
   * textarea + execCommand 로 되돌아간다(단일 파일 배포본을 그냥 열어도 동작해야 한다). */
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject(new Error('복사할 수 없다'));
    });
  }

  function copyToClipboard(text) {
    /* ★ clipboard API 가 **있어도 거부될 수 있다**(창에 포커스가 없을 때 등).
     * 그래서 없을 때만이 아니라 거부됐을 때도 textarea 로 되돌아간다.
     * 이걸 빠뜨리면 정상적인 상황에서도 "복사할 수 없다" 로 떨어진다. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  /* 코드 블록. 실행하지 않는다 — 옆의 결과는 엔진이 계산한 실제 값이다.
   *
   *   opts.title      제목
   *   opts.output     아래에 붙일 출력
   *   opts.dataset    'titanic' | 'ramen' | 'abalone' | 'earthquake'
   *                   복사할 때 import 와 read_csv 를 앞에 붙여 **붙이면 바로 도는** 코드로 만든다
   *   opts.copyText   복사할 내용을 직접 지정 (dataset 보다 우선)
   *   opts.noCopy     복사 버튼을 달지 않는다
   */
  function code(src, opts) {
    opts = opts || {};
    var box = el('div.codeblock');
    if (opts.title) box.appendChild(el('div.panel-title', { text: opts.title }));

    var pre = el('pre', null, el('code', { text: src }));
    box.appendChild(pre);

    if (!opts.noCopy) {
      var payload = opts.copyText;
      if (payload === undefined) {
        var head = PREAMBLE[opts.dataset];
        payload = head ? head.join('\n') + '\n\n' + src : src;
      }
      var bar = el('div.code-actions');
      var btn = el('button.btn-copy', { text: '복사', type: 'button' });
      var hint = el('span.code-hint', {
        text: opts.dataset
          ? 'import 와 데이터 불러오기까지 함께 복사된다 — IDLE 에 붙여 바로 실행할 수 있다'
          : '이 블록만 복사된다'
      });
      btn.addEventListener('click', function () {
        copyToClipboard(payload).then(function () {
          btn.textContent = '✓ 복사됨';
          btn.classList.add('is-on');
          setTimeout(function () {
            btn.textContent = '복사';
            btn.classList.remove('is-on');
          }, 1600);
        }, function () {
          // 복사가 막힌 환경 — 학생이 직접 고를 수 있게 코드를 선택해 준다
          btn.textContent = '직접 복사하세요 (Ctrl+C)';
          var r = document.createRange();
          r.selectNodeContents(pre);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        });
      });
      bar.appendChild(btn);
      bar.appendChild(hint);
      box.appendChild(bar);
    }

    if (opts.output !== undefined) {
      /* 출력 딱지는 .panel-title 이 아니다 — 그건 카드 소제목이고 오른쪽 목차가 긁어 간다.
       * 목차가 "출력" 으로 도배되면 목차가 쓸모없어진다. */
      box.appendChild(el('div.out-label', { text: '출력' }));
      box.appendChild(el('pre.out', null, el('code', { text: opts.output })));
    }
    return box;
  }

  /* 경고·에러 안내. 색만으로 말하지 않는다 — 아이콘과 라벨이 함께 온다. */
  function danger(label, message) {
    var box = el('div.note.note--danger');
    box.appendChild(el('span.note-label', { text: '⚠ ' + label + ' ' }));
    box.appendChild(document.createTextNode(message));
    return box;
  }

  function note(message, title) {
    var box = el('div.note');
    if (title) box.appendChild(el('span.note-label', { text: title + ' ' }));
    box.appendChild(document.createTextNode(message));
    return box;
  }

  // ─────────────────────────────────────────────── 단계 실행

  /* DF.trace 의 기록을 한 단계씩 넘겨 본다. */
  function stepper(steps, renderStep, opts) {
    opts = opts || {};
    var i = 0;
    var box = el('div.card');
    if (opts.title) box.appendChild(el('div.panel-title', { text: opts.title }));
    var bar = el('div.control-row');
    var prev = el('button', { text: '← 이전' });
    var next = el('button', { text: '다음 →' });
    var label = el('span.control-label');
    var body = el('div');
    function draw() {
      label.textContent = (i + 1) + ' / ' + steps.length;
      prev.disabled = i === 0;
      next.disabled = i === steps.length - 1;
      clear(body);
      body.appendChild(renderStep(steps[i], i));
    }
    prev.addEventListener('click', function () { if (i > 0) { i--; draw(); } });
    next.addEventListener('click', function () { if (i < steps.length - 1) { i++; draw(); } });
    bar.appendChild(prev); bar.appendChild(next); bar.appendChild(label);
    box.appendChild(bar);
    box.appendChild(body);
    draw();
    return box;
  }

  // ─────────────────────────────────────────────── 세그먼트 컨트롤

  /* seg({value, options:[{value,label}], onChange}) — 테마 전환처럼 값이 하나인 선택.
   * 눌린 칸만 떠오른다. NumPy Lab 과 같은 위젯이다. */
  function seg(opts) {
    var cur = opts.value;
    var btns = (opts.options || []).map(function (op) {
      var val = typeof op === 'string' ? op : op.value;
      var lab = typeof op === 'string' ? op : op.label;
      return el('button', {
        type: 'button', text: lab,
        'aria-pressed': String(val) === String(cur) ? 'true' : 'false',
        onclick: function () { set(val); if (opts.onChange) opts.onChange(val); }
      });
    });
    var box = el('div.seg', { role: 'group', 'aria-label': opts.label || null }, btns);
    function set(val) {
      cur = val;
      btns.forEach(function (b, i) {
        var op = opts.options[i];
        var v = typeof op === 'string' ? op : op.value;
        b.setAttribute('aria-pressed', String(v) === String(val) ? 'true' : 'false');
      });
    }
    box.setValue = set;
    return box;
  }

  function btn(label, onClick, opts) {
    opts = opts || {};
    return el('button' + (opts.primary ? '.btn.primary' : '.btn'), {
      type: 'button', text: label, onclick: onClick
    });
  }

  // ─────────────────────────────────────────────── 진도

  /* 방문한 장과 맞힌 문제를 이 브라우저에만 저장한다.
   * 사이드바의 점(회색=방문, 초록=문제 전부 정답)과 진도 막대가 이걸 읽는다. */
  var PROG_KEY = 'pandas-lab/progress-v1';
  var progListeners = [];
  var quizSeq = {};

  var progress = {
    chapter: null,           // 지금 화면에 그려지는 장. app.js 가 세운다
    load: function () {
      try { return JSON.parse(localStorage.getItem(PROG_KEY) || '{}'); } catch (e) { return {}; }
    },
    save: function (d) { try { localStorage.setItem(PROG_KEY, JSON.stringify(d)); } catch (e) { /* 저장소가 막혀도 앱은 돈다 */ } },
    mark: function (k, ok) { var d = this.load(); d[k] = !!ok; this.save(d); emitProgress(); },
    visit: function (id) { var d = this.load(); d['visit:' + id] = true; this.save(d); emitProgress(); },
    /* total 은 **그 장에 있는 문제 수**다. 답한 문제 수가 아니다 —
     * 답한 것만 세면 한 문제만 맞혀도 "다 맞혔다" 로 보여 점이 거짓말을 한다. */
    stats: function (id) {
      var d = this.load(), answered = 0, ok = 0;
      for (var k in d) if (k.indexOf(id + ':q') === 0) { answered++; if (d[k]) ok++; }
      var tot = d['count:' + id];
      if (typeof tot !== 'number') tot = answered;      // 아직 그려 본 적이 없는 장
      return { total: tot, answered: answered, correct: ok, visited: !!d['visit:' + id] };
    },
    reset: function () { this.save({}); emitProgress(); },
    /* 장을 그리기 직전에 부른다. 그 장의 문제 번호를 0 부터 다시 매긴다 —
     * 번호가 렌더마다 밀리면 다시 방문했을 때 다른 문제로 기록된다. */
    beginChapter: function (id) { this.chapter = id || null; if (id) quizSeq[id] = 0; },
    /* 렌더가 끝난 뒤에 부른다. 그 장에 문제가 몇 개인지 확정해 저장한다. */
    endChapter: function (id) {
      if (!id || !quizSeq[id]) return;
      var d = this.load();
      if (d['count:' + id] === quizSeq[id]) return;
      d['count:' + id] = quizSeq[id];
      this.save(d);
      emitProgress();
    },
    onChange: function (f) { progListeners.push(f); }
  };
  function emitProgress() { progListeners.forEach(function (f) { f(); }); }

  // ─────────────────────────────────────────────── 확인 문제

  /* quiz({title, question, choices:[{label, correct, why}], explain})
   * 보기는 줄로 쌓이고 A·B·C 표식이 앞에 온다. 누르면 정답 자리가 함께 드러난다.
   * 색만으로 말하지 않는다 — 표식 글자와 테두리가 같이 바뀐다. */
  function quiz(spec) {
    var box = el('div.card.quiz');
    if (spec.title !== null) box.appendChild(el('div.panel-title', { text: spec.title || '확인 문제' }));

    /* 장 안에서 만들어진 순서가 곧 문제 번호다. beginChapter 가 0 으로 되돌린다. */
    var key = null, idx = 0;
    if (progress.chapter) {
      var ch = progress.chapter;
      if (quizSeq[ch] === undefined) quizSeq[ch] = 0;
      idx = quizSeq[ch]++;
      key = ch + ':q' + idx;
    }
    /* Q 번호는 **장 전체에서** 이어진다. 카드마다 셈을 새로 시작하면 전부 Q1 이 된다. */
    box.style.counterReset = 'qn ' + idx;

    var explain = el('div.q-explain', { hidden: true });
    var choices = spec.choices || [];
    var answered = false;

    var choiceEls = choices.map(function (c, ci) {
      return el('button.q-choice', {
        type: 'button',
        onclick: function () {
          var right = !!c.correct;
          choiceEls.forEach(function (e, i) {
            e.setAttribute('data-state', choices[i].correct ? 'right' : (i === ci ? 'wrong' : ''));
          });
          clear(explain);
          explain.appendChild(el('b', { text: right ? '✓ 맞다. ' : '✗ 아니다. ' }));
          explain.appendChild(document.createTextNode(c.why || spec.explain || ''));
          explain.hidden = false;
          // 첫 번째 답만 기록한다. 그리고 살아 있는 본문 안에서 눌렀을 때만 —
          // 검사 하네스는 떨어진 노드에 렌더하므로 진도를 더럽히지 않는다.
          if (key && !answered && box.closest && box.closest('#main-inner')) {
            answered = true;
            progress.mark(key, right);
          }
        }
      }, [
        el('span.mk', { text: 'ABCDE'[ci] || String(ci + 1) }),
        el('span', { text: c.label })
      ]);
    });

    box.appendChild(el('div.q', null, [
      el('div.q-stem', { text: spec.question }),
      el('div.q-choices', null, choiceEls),
      explain
    ]));
    return box;
  }

  // ─────────────────────────────────────────────── 공개 API

  var UI = {
    // DOM
    el: el, svg: svg, clear: clear, esc: esc, uid: uid,
    // 값
    fmt: fmt, isNA: isNA,
    // 표
    table: table, frameTable: frameTable, seriesTable: seriesTable,
    // 엔진 시각화
    blockView: blockView, shareBadge: shareBadge, alignView: alignView, groupView: groupView,
    // 차트
    bar: bar, hist: hist, scatter: scatter, legend: legend, withTableTwin: withTableTwin,
    niceTicks: niceTicks, scale: scale,
    // 컨트롤
    slider: slider, buttonGroup: buttonGroup, toggle: toggle, seg: seg, btn: btn,
    // 텍스트
    code: code, note: note, danger: danger,
    copyToClipboard: copyToClipboard, PREAMBLE: PREAMBLE,
    // 단계·문제·진도
    stepper: stepper, quiz: quiz, progress: progress
  };

  if (typeof window !== 'undefined') window.UI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})();
