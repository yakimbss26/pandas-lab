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
    /* 날짜 열은 값이 epoch 밀리초 숫자라서 dtype 을 보고 날짜로 바꿔 보여 준다(없으면 숫자가 찍힌다) */
    var dts = df.dtypes(), cache = {};
    df.columns.forEach(function (n) { cache[n] = df.col(n); });
    for (var i = 0; i < limit; i++) {
      var r = { __index__: df.index.at(i) };
      df.columns.forEach(function (n) {
        var v = cache[n].at(i);
        r[n] = window.DF && window.DF.isDatetimeDtype(dts[n]) ? window.DF.fmtTyped(v, dts[n]) : v;
      });
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
    var isDt = window.DF && window.DF.isDatetimeDtype(s.dtype);
    for (var i = 0; i < limit; i++) rows.push({ idx: s.index.at(i), val: isDt ? window.DF.fmtTyped(s.at(i), s.dtype) : s.at(i) });
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

  // ═══════════════════════════════════════════════ 2부 차트 — 선 · 세로 막대 · 분포 · 히트맵 · 피라미드
  //
  // dataviz 규칙을 그대로 따른다(docs/2부-설계.md §4):
  //   · 계열은 검증된 순서(원본 파랑 · 사본 주황 · 결과 초록)로 **최대 3개**. 넘으면 던진다
  //   · 모든 차트에 표 보기 twin. 계열 2개 이상이면 범례 + 끝점 직접 라벨
  //   · 값·라벨 글자는 잉크 토큰. 계열색을 입지 않는다
  //   · 강조는 색이 아니라 **링**(2px 잉크)과 굵은 라벨
  //   · 결측은 선을 **끊는다** — 이어 그리면 없는 값을 지어내는 것이다
  // 무작위(부트스트랩 · 흔들림)는 시드를 고정한다. 화면을 다시 그려도 같은 그림이 나와야 한다.

  var SERIES_COLORS = ['var(--c-original)', 'var(--c-copy)', 'var(--c-result)'];

  function isNumber(v) { return typeof v === 'number' && !isNaN(v); }
  function minOf(a) { var m = Infinity; for (var i = 0; i < a.length; i++) if (isNumber(a[i]) && a[i] < m) m = a[i]; return m; }
  function maxOf(a) { var m = -Infinity; for (var i = 0; i < a.length; i++) if (isNumber(a[i]) && a[i] > m) m = a[i]; return m; }

  /* 결정적 난수 (mulberry32) — 부트스트랩과 흔들림에 쓴다 */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 선형 보간 분위수 — pandas quantile / numpy percentile 기본과 같다 */
  function quantileOf(sorted, q) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function meanOf(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : NaN; }
  function sdOf(a) {
    if (a.length < 2) return NaN;
    var m = meanOf(a), ss = 0;
    for (var i = 0; i < a.length; i++) ss += (a[i] - m) * (a[i] - m);
    return Math.sqrt(ss / (a.length - 1));                       // ddof=1 (pandas·seaborn 과 같다)
  }

  /* 상자그림 다섯 수치. 수염은 Q1−1.5·IQR ~ Q3+1.5·IQR 안의 **가장 먼 실제 값**까지
   * (matplotlib · seaborn 기본과 같다). 그 밖의 점은 이상치. */
  function fiveNum(values) {
    var s = values.filter(isNumber).sort(function (a, b) { return a - b; });
    var q1 = quantileOf(s, 0.25), q2 = quantileOf(s, 0.5), q3 = quantileOf(s, 0.75), iqr = q3 - q1;
    var lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr, wl = q1, wh = q3, out = [];
    s.forEach(function (v) {
      if (v < lo || v > hi) out.push(v);
      else { if (v < wl) wl = v; if (v > wh) wh = v; }
    });
    return { n: s.length, min: s[0], q1: q1, median: q2, q3: q3, max: s[s.length - 1],
             whiskerLo: wl, whiskerHi: wh, outliers: out, sorted: s };
  }
  function bootstrapCI(values, seed, nBoot, level) {
    var rnd = seeded(seed || 1), n = values.length, means = [];
    if (n < 2) return [NaN, NaN];
    for (var b = 0; b < (nBoot || 1000); b++) {
      var s = 0;
      for (var i = 0; i < n; i++) s += values[Math.floor(rnd() * n)];
      means.push(s / n);
    }
    means.sort(function (x, y) { return x - y; });
    var a = (1 - (level || 0.95)) / 2;
    return [quantileOf(means, a), quantileOf(means, 1 - a)];
  }
  /* 가우스 커널 밀도 — 대역폭은 Scott 규칙(seaborn 기본) */
  function kde(sorted, at) {
    var n = sorted.length, sd = sdOf(sorted);
    var bw = sd * Math.pow(n, -1 / 5) || 1;
    return at.map(function (x) {
      var s = 0;
      for (var i = 0; i < n; i++) { var z = (x - sorted[i]) / bw; s += Math.exp(-0.5 * z * z); }
      return s / (n * bw * Math.sqrt(2 * Math.PI));
    });
  }

  function svgRoot(W, H, kids, label) {
    return svg('svg.viz', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': label || null }, kids);
  }
  function yAxis(kids, y, ticks, padL, W, padR, fmtTick) {
    ticks.forEach(function (t) {
      kids.push(svg('line.grid-line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t) }));
      kids.push(svg('text.tick-label', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end', text: fmtTick ? fmtTick(t) : fmt(t, 2) }));
    });
  }
  function hoverTip(node, html) {
    node.addEventListener('mousemove', function (e) { tip().show(html, e.clientX, e.clientY); });
    node.addEventListener('mouseleave', function () { tip().hide(); });
  }
  function checkSeriesCount(n, what) {
    if (n > 3) throw new Error(what + ' 의 계열은 3개까지다. "그 외" 로 묶거나 차트를 나눠라 (팔레트 한계, docs/2부-설계.md §4).');
  }

  /* 선그래프 — 시간에 따른 변화.
   *   line([{name, points:[[x, y], …]}], {title, xLabel, yLabel, xFormat, yMin, yMax, zero,
   *        markers, highlight:[x…], height})
   * y 가 결측이면 선을 끊는다. yMin/yMax 로 축 범위를 정한다(V5 의 "축 자르기" 가 쓴다).
   * highlight 에 준 x 는 링으로 강조한다. 마우스를 올리면 가장 가까운 x 에 세로선과 값. */
  function line(series, opts) {
    opts = opts || {};
    checkSeriesCount(series.length, '선그래프');
    var W = opts.width || 640, H = opts.height || 300;
    var multi = series.length > 1;
    var padL = 56, padR = multi ? 92 : 20, padT = 14, padB = 42;
    var xs = [], ys = [];
    series.forEach(function (s) { s.points.forEach(function (p) { if (isNumber(p[0])) xs.push(p[0]); if (isNumber(p[1])) ys.push(p[1]); }); });
    if (!xs.length || !ys.length) return el('div.note', { text: '그릴 값이 없다' });
    var xMin = minOf(xs), xMax = maxOf(xs);
    var yMin = opts.yMin !== undefined ? opts.yMin : (opts.zero ? Math.min(0, minOf(ys)) : minOf(ys));
    var yMax = opts.yMax !== undefined ? opts.yMax : maxOf(ys);
    if (yMax === yMin) { yMax += 1; yMin -= 1; }
    var x = scale([xMin, xMax], [padL, W - padR]), y = scale([yMin, yMax], [H - padB, padT]);
    var xf = opts.xFormat || function (v) { return fmt(v, 2); };
    var clip = uid('clip');

    var kids = [svg('defs', null, [svg('clipPath', { id: clip }, [svg('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB })])])];
    yAxis(kids, y, niceTicks(yMin, yMax, 4), padL, W, padR);
    niceTicks(xMin, xMax, 6).forEach(function (t) {
      kids.push(svg('text.tick-label', { x: x(t), y: H - padB + 16, 'text-anchor': 'middle', text: xf(t) }));
    });
    kids.push(svg('line.axis-line', { x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));
    if (opts.xLabel) kids.push(svg('text.axis-label', { x: (padL + W - padR) / 2, y: H - 6, 'text-anchor': 'middle', text: opts.xLabel }));
    if (opts.yLabel) kids.push(svg('text.axis-label', { x: 8, y: padT - 2, text: opts.yLabel }));

    series.forEach(function (s, si) {
      var d = '', pen = false;
      s.points.forEach(function (p) {
        if (!isNumber(p[0]) || !isNumber(p[1])) { pen = false; return; }      // 결측 -> 끊는다
        d += (pen ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1) + ' ';
        pen = true;
      });
      kids.push(svg('path.line', { d: d, fill: 'none', stroke: s.color || SERIES_COLORS[si], 'stroke-width': 2,
        'stroke-linejoin': 'round', 'clip-path': 'url(#' + clip + ')' }));
      if (opts.markers) s.points.forEach(function (p) {
        if (isNumber(p[0]) && isNumber(p[1])) {
          kids.push(svg('circle.mark', { cx: x(p[0]), cy: y(p[1]), r: 4, fill: s.color || SERIES_COLORS[si],
            stroke: 'var(--surface-1)', 'stroke-width': 2 }));
        }
      });
      if (multi) {                                             // 끝점 직접 라벨 (잉크 글자 + 색 점)
        var last = null;
        s.points.forEach(function (p) { if (isNumber(p[0]) && isNumber(p[1])) last = p; });
        if (last) {
          kids.push(svg('circle', { cx: W - padR + 8, cy: y(last[1]), r: 4, fill: s.color || SERIES_COLORS[si] }));
          kids.push(svg('text.value-label', { x: W - padR + 16, y: y(last[1]) + 4, text: s.name }));
        }
      }
    });

    (opts.highlight || []).forEach(function (hx) {
      series.forEach(function (s) {
        s.points.forEach(function (p) {
          if (p[0] === hx && isNumber(p[1])) {
            kids.push(svg('circle', { cx: x(p[0]), cy: y(p[1]), r: 7, fill: 'none', stroke: 'var(--ink-1)', 'stroke-width': 2 }));
            kids.push(svg('text.value-label', { x: x(p[0]), y: y(p[1]) - 12, 'text-anchor': 'middle',
              'font-weight': 700, text: xf(p[0]) }));
          }
        });
      });
    });

    // 가장 가까운 x 에 세로선 + 값
    var uniq = xs.slice().sort(function (a, b) { return a - b; }).filter(function (v, i, a) { return i === 0 || v !== a[i - 1]; });
    var byX = series.map(function (s) { var m = new Map(); s.points.forEach(function (p) { m.set(p[0], p[1]); }); return m; });
    var cross = svg('line.crosshair', { x1: 0, x2: 0, y1: padT, y2: H - padB, visibility: 'hidden' });
    kids.push(cross);
    var hit = svg('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB, fill: 'transparent' });
    hit.addEventListener('mousemove', function (e) {
      var r = hit.ownerSVGElement.getBoundingClientRect();
      var px = (e.clientX - r.left) * (W / r.width);
      var dv = xMin + (px - padL) / (W - padL - padR) * (xMax - xMin), best = uniq[0];
      for (var i = 0; i < uniq.length; i++) if (Math.abs(uniq[i] - dv) < Math.abs(best - dv)) best = uniq[i];
      cross.setAttribute('x1', x(best)); cross.setAttribute('x2', x(best)); cross.setAttribute('visibility', 'visible');
      tip().show('<b>' + esc(xf(best)) + '</b>' + series.map(function (s, si) {
        var v = byX[si].get(best);
        return '<br>' + esc(s.name) + ': ' + (isNumber(v) ? esc(fmt(v, 2)) : '<i>결측</i>');
      }).join(''), e.clientX, e.clientY);
    });
    hit.addEventListener('mouseleave', function () { cross.setAttribute('visibility', 'hidden'); tip().hide(); });
    kids.push(hit);

    var node = svgRoot(W, H, kids, opts.title);
    var cols = [{ key: 'x', label: opts.xLabel || 'x' }].concat(series.map(function (s, si) {
      return { key: 's' + si, label: s.name, digits: 2 };
    }));
    var rows = uniq.map(function (xv) {
      var r = { x: xf(xv) };
      series.forEach(function (s, si) { var v = byX[si].get(xv); r['s' + si] = isNumber(v) ? v : null; });
      return r;
    });
    var out = withTableTwin(node, table(cols, rows, { maxRows: opts.tableRows || 200 }), { title: opts.title });
    if (multi) out.appendChild(legend(series.map(function (s, i) { return { label: s.name, color: s.color || SERIES_COLORS[i] }; })));
    return out;
  }

  /* 세로 막대 — 범주마다 값 하나. seaborn barplot 처럼 **평균 하나**를 막대로 그린다.
   *   columns([{label, values:[…]} 또는 {label, value}], {title, yLabel, yMin, errorbar:'ci'|'sd'|null,
   *           showPoints, seed, highlight:[label…], height})
   * values 를 주면 막대 = 평균, errorbar 로 그 퍼짐을 검은 선으로. showPoints 면 막대 뒤에 행들을 점으로.
   * ★ yMin 을 0 보다 크게 주면 막대가 **잘린다** — V5 가 그 거짓말을 보여 줄 때만 쓴다.
   *   그때는 "막대는 0 에서 시작해야 한다" 는 경고 딱지를 차트 위에 붙인다. */
  function columns(groups, opts) {
    opts = opts || {};
    var W = opts.width || 640, H = opts.height || 300;
    var padL = 56, padR = 16, padT = 16, padB = 42;
    var stats = groups.map(function (g, gi) {
      var vals = g.values ? g.values.filter(isNumber) : null;
      var v = vals ? meanOf(vals) : g.value;
      var err = null;
      if (vals && opts.errorbar === 'sd') { var sd = sdOf(vals); err = [v - sd, v + sd]; }
      if (vals && opts.errorbar === 'ci') err = bootstrapCI(vals, (opts.seed || 7) + gi, 1000, 0.95);
      return { label: g.label, value: v, n: vals ? vals.length : null, err: err, vals: vals };
    });
    var all = [];
    stats.forEach(function (s) {
      all.push(s.value);
      if (s.err) { all.push(s.err[0]); all.push(s.err[1]); }
      if (opts.showPoints && s.vals) all = all.concat(s.vals);
    });
    var yMin = opts.yMin !== undefined ? opts.yMin : Math.min(0, minOf(all));
    var yMax = opts.yMax !== undefined ? opts.yMax : maxOf(all);
    if (yMax === yMin) yMax = yMin + 1;
    var y = scale([yMin, yMax], [H - padB, padT]);
    var band = (W - padL - padR) / Math.max(1, stats.length), bw = Math.min(48, band * 0.7);
    var clip = uid('clip');
    var kids = [svg('defs', null, [svg('clipPath', { id: clip }, [svg('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB })])])];
    yAxis(kids, y, niceTicks(yMin, yMax, 4), padL, W, padR);
    var truncated = yMin > 0;
    var rnd = seeded(opts.seed || 11);
    var hi = new Set(opts.highlight || []);
    var every = Math.max(1, Math.ceil(stats.length / 16));      // 라벨이 겹치지 않게 솎는다
    stats.forEach(function (s, i) {
      var cx = padL + band * i + band / 2;
      if (opts.showPoints && s.vals) {
        s.vals.forEach(function (v) {
          kids.push(svg('circle', { cx: cx + (rnd() - 0.5) * bw * 0.9, cy: y(v), r: 2, fill: 'var(--ink-muted)', 'fill-opacity': 0.35,
            'clip-path': 'url(#' + clip + ')' }));
        });
      }
      var top = y(Math.max(s.value, yMin)), base = y(Math.max(0, yMin));
      var r = svg('rect.mark', { x: cx - bw / 2, y: Math.min(top, base), width: bw, height: Math.abs(base - top), rx: 4, ry: 4,
        fill: s.color || opts.color || 'var(--c-original)', 'fill-opacity': opts.showPoints ? 0.55 : 1, 'clip-path': 'url(#' + clip + ')' });
      hoverTip(r, '<b>' + esc(s.label) + '</b><br>' + (s.n !== null ? '평균 ' : '') + esc(fmt(s.value, 2)) +
        (s.n !== null ? '<br>행 ' + s.n + '개' : '') + (s.err ? '<br>' + esc(fmt(s.err[0], 2)) + ' ~ ' + esc(fmt(s.err[1], 2)) : ''));
      kids.push(r);
      if (s.err && isNumber(s.err[0])) {
        kids.push(svg('line', { x1: cx, x2: cx, y1: y(s.err[0]), y2: y(s.err[1]), stroke: 'var(--ink-1)', 'stroke-width': 2 }));
      }
      if (hi.has(s.label)) kids.push(svg('rect', { x: cx - bw / 2 - 3, y: Math.min(top, base) - 3, width: bw + 6,
        height: Math.abs(base - top) + 6, rx: 6, fill: 'none', stroke: 'var(--ink-1)', 'stroke-width': 2 }));
      if (i % every === 0) kids.push(svg('text.tick-label', { x: cx, y: H - padB + 16, 'text-anchor': 'middle', text: String(s.label) }));
    });
    kids.push(svg('line.axis-line', { x1: padL, x2: W - padR, y1: y(Math.max(0, yMin)), y2: y(Math.max(0, yMin)) }));
    if (opts.yLabel) kids.push(svg('text.axis-label', { x: 8, y: padT - 4, text: opts.yLabel }));
    var node = svgRoot(W, H, kids, opts.title);
    var cols = [{ key: 'label', label: opts.xLabel || '항목' }, { key: 'value', label: stats[0] && stats[0].n !== null ? '평균' : '값', digits: 3 }];
    if (stats.some(function (s) { return s.n !== null; })) cols.push({ key: 'n', label: '행 수' });
    if (opts.errorbar) { cols.push({ key: 'lo', label: '아래', digits: 3 }); cols.push({ key: 'hi', label: '위', digits: 3 }); }
    var out = withTableTwin(node, table(cols, stats.map(function (s) {
      return { label: s.label, value: s.value, n: s.n, lo: s.err ? s.err[0] : null, hi: s.err ? s.err[1] : null };
    }), { maxRows: 200 }), { title: opts.title });
    if (truncated) {
      out.insertBefore(danger('축이 잘렸다', 'y축이 ' + fmt(yMin, 2) + ' 에서 시작한다. 막대의 길이가 값에 비례하지 않는다.'), out.firstChild.nextSibling);
    }
    return out;
  }

  /* 분포 — 상자 · 바이올린 · 스트립. 범주마다 값 묶음 하나.
   *   dist([{label, values}], {kind:'box'|'violin'|'strip', overlay:'strip', title, yLabel, maxPoints, seed})
   * 표 보기에는 다섯 수치와 수염 끝, 이상치 개수가 나온다(상자그림을 읽는 법을 표로 확인한다). */
  function dist(groups, opts) {
    opts = opts || {};
    var kind = opts.kind || 'box';
    var W = opts.width || 640, H = opts.height || 320;
    var padL = 56, padR = 16, padT = 14, padB = 42;
    var st = groups.map(function (g) { var f = fiveNum(g.values); f.label = g.label; return f; });
    var all = [];
    st.forEach(function (f) { all.push(f.min, f.max); });
    var yMin = opts.yMin !== undefined ? opts.yMin : minOf(all), yMax = opts.yMax !== undefined ? opts.yMax : maxOf(all);
    if (yMax === yMin) { yMax += 1; yMin -= 1; }
    var y = scale([yMin, yMax], [H - padB, padT]);
    var band = (W - padL - padR) / Math.max(1, st.length), bw = Math.min(56, band * 0.6);
    var kids = [];
    yAxis(kids, y, niceTicks(yMin, yMax, 4), padL, W, padR);
    var color = opts.color || 'var(--c-original)';
    var rnd = seeded(opts.seed || 5), cap = opts.maxPoints || 400;
    st.forEach(function (f, i) {
      var cx = padL + band * i + band / 2;
      if (!f.n) return;
      if (kind === 'violin') {
        var at = [], K = 48;
        for (var k = 0; k <= K; k++) at.push(f.min + (f.max - f.min) * k / K);
        var dens = kde(f.sorted, at), dm = Math.max.apply(null, dens) || 1;
        var vw = Math.min(110, band * 0.85);                   // 바이올린은 모양을 읽어야 하므로 상자보다 넓게
        var right = at.map(function (v, k) { return (cx + dens[k] / dm * vw / 2).toFixed(1) + ' ' + y(v).toFixed(1); });
        var left = at.slice().reverse().map(function (v, k) { return (cx - dens[K - k] / dm * vw / 2).toFixed(1) + ' ' + y(v).toFixed(1); });
        kids.push(svg('path.mark', { d: 'M' + right.join(' L') + ' L' + left.join(' L') + ' Z', fill: color, 'fill-opacity': 0.45, stroke: color, 'stroke-width': 1.5 }));
        kids.push(svg('line', { x1: cx, x2: cx, y1: y(f.q1), y2: y(f.q3), stroke: 'var(--ink-1)', 'stroke-width': 4 }));
        kids.push(svg('circle', { cx: cx, cy: y(f.median), r: 3, fill: 'var(--surface-1)' }));
      }
      if (kind === 'box') {
        kids.push(svg('line', { x1: cx, x2: cx, y1: y(f.whiskerLo), y2: y(f.q1), stroke: 'var(--ink-2)', 'stroke-width': 1.5 }));
        kids.push(svg('line', { x1: cx, x2: cx, y1: y(f.q3), y2: y(f.whiskerHi), stroke: 'var(--ink-2)', 'stroke-width': 1.5 }));
        kids.push(svg('line', { x1: cx - bw / 4, x2: cx + bw / 4, y1: y(f.whiskerLo), y2: y(f.whiskerLo), stroke: 'var(--ink-2)', 'stroke-width': 1.5 }));
        kids.push(svg('line', { x1: cx - bw / 4, x2: cx + bw / 4, y1: y(f.whiskerHi), y2: y(f.whiskerHi), stroke: 'var(--ink-2)', 'stroke-width': 1.5 }));
        var b = svg('rect.mark', { x: cx - bw / 2, y: y(f.q3), width: bw, height: Math.max(1, y(f.q1) - y(f.q3)), rx: 4,
          fill: color, 'fill-opacity': opts.overlay === 'strip' ? 0.3 : 0.6, stroke: color, 'stroke-width': 1.5 });
        hoverTip(b, '<b>' + esc(f.label) + '</b><br>Q1 ' + esc(fmt(f.q1, 2)) + ' · 중앙값 ' + esc(fmt(f.median, 2)) + ' · Q3 ' + esc(fmt(f.q3, 2)));
        kids.push(b);
        kids.push(svg('line', { x1: cx - bw / 2, x2: cx + bw / 2, y1: y(f.median), y2: y(f.median), stroke: 'var(--ink-1)', 'stroke-width': 2 }));
        if (opts.overlay !== 'strip') f.outliers.forEach(function (v) {
          kids.push(svg('circle', { cx: cx, cy: y(v), r: 3, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.2 }));
        });
      }
      if (kind === 'strip' || opts.overlay === 'strip') {
        var pts = f.sorted;
        if (pts.length > cap) { var step = pts.length / cap, p2 = []; for (var q = 0; q < cap; q++) p2.push(pts[Math.floor(q * step)]); pts = p2; }
        pts.forEach(function (v) {
          kids.push(svg('circle', { cx: cx + (rnd() - 0.5) * bw * 0.8, cy: y(v), r: 2.5,
            fill: kind === 'strip' ? color : 'var(--ink-2)', 'fill-opacity': 0.5 }));
        });
      }
      kids.push(svg('text.tick-label', { x: cx, y: H - padB + 16, 'text-anchor': 'middle', text: String(f.label) }));
    });
    kids.push(svg('line.axis-line', { x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));
    if (opts.yLabel) kids.push(svg('text.axis-label', { x: 8, y: padT - 2, text: opts.yLabel }));
    var node = svgRoot(W, H, kids, opts.title);
    var tbl = table([{ key: 'label', label: opts.xLabel || '범주' }, { key: 'n', label: '개수' },
      { key: 'min', label: '최솟값', digits: 2 }, { key: 'q1', label: 'Q1', digits: 2 }, { key: 'median', label: '중앙값', digits: 2 },
      { key: 'q3', label: 'Q3', digits: 2 }, { key: 'max', label: '최댓값', digits: 2 },
      { key: 'whiskerLo', label: '수염 아래', digits: 2 }, { key: 'whiskerHi', label: '수염 위', digits: 2 }, { key: 'nout', label: '이상치' }],
      st.map(function (f) { return Object.assign({}, f, { nout: f.outliers.length }); }), {});
    return withTableTwin(node, tbl, { title: opts.title });
  }

  /* 히트맵 — 격자의 크기(순차) 또는 양·음(발산).
   *   heatmap(rowLabels, colLabels, values[r][c], {scale:'sequential'|'diverging', digits, title, rowTitle, colTitle})
   * 색은 극(끝) 색 하나를 **투명도**로 겹쳐 만든다 — 라이트·다크 모두 한 색조의 명도 단계가 된다
   * (무지개 금지). 발산은 가운데가 회색, 음수는 빨강(slot 8), 양수는 파랑. 칸에는 숫자를 함께 쓴다
   * (색만으로 값을 말하지 않는다). 결측 칸은 회색 해칭 + 'NaN'. */
  function heatmap(rowLabels, colLabels, values, opts) {
    opts = opts || {};
    var div = opts.scale === 'diverging';
    var cw = opts.cellWidth || Math.max(36, Math.min(64, 560 / Math.max(1, colLabels.length)));
    var ch = opts.cellHeight || 26;
    var padL = opts.padLeft || 72, padT = 30, padR = 12, padB = 36;
    var W = padL + cw * colLabels.length + padR, H = padT + ch * rowLabels.length + padB;
    var flat = [];
    values.forEach(function (r) { r.forEach(function (v) { if (isNumber(v)) flat.push(v); }); });
    var lo = div ? -1 : minOf(flat), hi = div ? 1 : maxOf(flat);
    if (opts.min !== undefined) lo = opts.min;
    if (opts.max !== undefined) hi = opts.max;
    var hatch = uid('hatch');
    var kids = [svg('defs', null, [svg('pattern', { id: hatch, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      [svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--c-na)', 'stroke-width': 1.5 })])])];
    colLabels.forEach(function (c, j) {
      kids.push(svg('text.tick-label', { x: padL + cw * j + cw / 2, y: padT - 8, 'text-anchor': 'middle', text: String(c) }));
    });
    rowLabels.forEach(function (rl, i) {
      kids.push(svg('text.tick-label', { x: padL - 6, y: padT + ch * i + ch / 2 + 4, 'text-anchor': 'end', text: String(rl) }));
      colLabels.forEach(function (cl, j) {
        var v = values[i][j], x0 = padL + cw * j, y0 = padT + ch * i;
        if (!isNumber(v)) {
          kids.push(svg('rect', { x: x0 + 1, y: y0 + 1, width: cw - 2, height: ch - 2, fill: 'url(#' + hatch + ')' }));
          kids.push(svg('text.tick-label', { x: x0 + cw / 2, y: y0 + ch / 2 + 4, 'text-anchor': 'middle', text: 'NaN' }));
          return;
        }
        var t, pole;
        if (div) { t = Math.min(1, Math.abs(v) / Math.max(Math.abs(lo), Math.abs(hi))); pole = v < 0 ? 'var(--c-original)' : 'var(--div-pos)'; }
        else { t = hi === lo ? 1 : 0.12 + 0.88 * (v - lo) / (hi - lo); pole = 'var(--c-original)'; }
        kids.push(svg('rect', { x: x0 + 1, y: y0 + 1, width: cw - 2, height: ch - 2, fill: div ? 'var(--div-mid)' : 'var(--surface-1)' }));
        var cell = svg('rect', { x: x0 + 1, y: y0 + 1, width: cw - 2, height: ch - 2, rx: 2, fill: pole, 'fill-opacity': t.toFixed(3) });
        hoverTip(cell, '<b>' + esc(String(rl)) + ' · ' + esc(String(cl)) + '</b><br>' + esc(fmt(v, 4)));
        kids.push(cell);
        kids.push(svg('text', { x: x0 + cw / 2, y: y0 + ch / 2 + 4, 'text-anchor': 'middle', 'font-size': 11,
          fill: t > 0.55 ? '#ffffff' : 'var(--ink-1)', 'pointer-events': 'none',
          // seaborn 의 annot=True, fmt='.2f' 처럼 자릿수를 고정한다 — 1 이 아니라 1.00
          text: v.toFixed(opts.digits === undefined ? 2 : opts.digits) }));
      });
    });
    if (opts.colTitle) kids.push(svg('text.axis-label', { x: padL + cw * colLabels.length / 2, y: 12, 'text-anchor': 'middle', text: opts.colTitle }));
    if (opts.rowTitle) kids.push(svg('text.axis-label', { x: 4, y: 12, text: opts.rowTitle }));
    kids.push(svg('text.tick-label', { x: padL, y: H - 12, text: (div ? '파랑 = 음, 회색 = 0, 빨강 = 양 · 진할수록 크다' : '진할수록 크다') +
      ' (' + fmt(lo, 2) + ' ~ ' + fmt(hi, 2) + ')' }));
    var node = svgRoot(W, H, kids, opts.title);
    var cols = [{ key: '_r', label: opts.rowTitle || '' }].concat(colLabels.map(function (c, j) { return { key: 'c' + j, label: String(c), digits: opts.digits === undefined ? 2 : opts.digits }; }));
    var rows = rowLabels.map(function (rl, i) {
      var r = { _r: rl };
      colLabels.forEach(function (c, j) { r['c' + j] = isNumber(values[i][j]) ? values[i][j] : null; });
      return r;
    });
    return withTableTwin(node, table(cols, rows, { maxRows: 200 }), { title: opts.title });
  }

  /* 인구 피라미드 — 가운데 축에서 양쪽으로.
   *   pyramid(labels(아래 -> 위), left[], right[], {leftName, rightName, absTicks=true, title, step})
   * ★ absTicks:false 는 matplotlib 로 barh(-여자) 를 그렸을 때처럼 왼쪽 눈금이 **음수로** 찍힌다.
   *   V5 가 그 문제를 보여 줄 때만 쓴다. 인구에 음수는 없다. */
  function pyramid(labels, left, right, opts) {
    opts = opts || {};
    var n = labels.length;
    var W = opts.width || 640, rowH = opts.rowHeight || Math.max(3, Math.min(14, 440 / n));
    var padL = 48, padR = 16, padT = 28, padB = 36, H = padT + rowH * n + padB;
    var m = Math.max(maxOf(left), maxOf(right)) || 1;
    var cx = (padL + W - padR) / 2;
    var xl = scale([0, m], [cx, padL]), xr = scale([0, m], [cx, W - padR]);
    var kids = [];
    var ticks = niceTicks(0, m, 3);
    var absT = opts.absTicks !== false;
    ticks.forEach(function (t) {
      kids.push(svg('line.grid-line', { x1: xl(t), x2: xl(t), y1: padT, y2: H - padB }));
      kids.push(svg('line.grid-line', { x1: xr(t), x2: xr(t), y1: padT, y2: H - padB }));
      kids.push(svg('text.tick-label', { x: xl(t), y: H - padB + 16, 'text-anchor': 'middle', text: t === 0 ? '0' : (absT ? '' : '−') + fmt(t, 0) }));
      if (t) kids.push(svg('text.tick-label', { x: xr(t), y: H - padB + 16, 'text-anchor': 'middle', text: fmt(t, 0) }));
    });
    var lc = opts.leftColor || 'var(--c-original)', rc = opts.rightColor || 'var(--c-copy)';
    var every = opts.labelEvery || Math.max(1, Math.ceil(n / 12));
    labels.forEach(function (lab, i) {
      var y0 = padT + rowH * (n - 1 - i);                      // 첫 라벨(가장 어린 나이)이 맨 아래
      var a = svg('rect', { x: xl(left[i] || 0), y: y0 + 0.5, width: Math.max(0, cx - xl(left[i] || 0) - 1), height: Math.max(1, rowH - 1), fill: lc });
      var b = svg('rect', { x: cx + 1, y: y0 + 0.5, width: Math.max(0, xr(right[i] || 0) - cx - 1), height: Math.max(1, rowH - 1), fill: rc });
      var h = '<b>' + esc(String(lab)) + '</b><br>' + esc(opts.leftName || '왼쪽') + ' ' + esc(fmt(left[i], 0)) +
        '<br>' + esc(opts.rightName || '오른쪽') + ' ' + esc(fmt(right[i], 0));
      hoverTip(a, h); hoverTip(b, h);
      kids.push(a, b);
      if (i % every === 0) kids.push(svg('text.tick-label', { x: padL - 6, y: y0 + rowH / 2 + 4, 'text-anchor': 'end', text: String(lab) }));
    });
    kids.push(svg('line.axis-line', { x1: cx, x2: cx, y1: padT, y2: H - padB }));
    kids.push(svg('text.value-label', { x: (padL + cx) / 2, y: 16, 'text-anchor': 'middle', text: opts.leftName || '' }));
    kids.push(svg('text.value-label', { x: (cx + W - padR) / 2, y: 16, 'text-anchor': 'middle', text: opts.rightName || '' }));
    var node = svgRoot(W, H, kids, opts.title);
    var tbl = table([{ key: 'l', label: opts.labelHeader || '구간' }, { key: 'a', label: opts.leftName || '왼쪽' },
      { key: 'b', label: opts.rightName || '오른쪽' }, { key: 'd', label: '차 (' + (opts.leftName || '왼') + '−' + (opts.rightName || '오른') + ')' }],
      labels.map(function (lab, i) { return { l: lab, a: left[i], b: right[i], d: (left[i] || 0) - (right[i] || 0) }; }), { maxRows: 200 });
    var out = withTableTwin(node, tbl, { title: opts.title });
    out.appendChild(legend([{ label: opts.leftName || '왼쪽', color: lc }, { label: opts.rightName || '오른쪽', color: rc }]));
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

  /* textInput({label, value, placeholder, wide, onChange, onEnter})
   * 학생이 답을 직접 적는 자리. 반환 노드에 setValue / focus 가 붙는다. */
  function textInput(opts) {
    opts = opts || {};
    var inp = el('input', {
      type: 'text', value: opts.value || '', placeholder: opts.placeholder || '',
      oninput: function () { if (opts.onChange) opts.onChange(inp.value); },
      onkeydown: function (e) { if (e.key === 'Enter' && opts.onEnter) opts.onEnter(inp.value); }
    });
    if (opts.wide) inp.classList.add('wide');
    var w = el('div.ctl', null, [
      opts.label ? el('label.control-label', { text: opts.label }) : null,
      inp
    ]);
    w.setValue = function (v) { inp.value = v; if (opts.onChange) opts.onChange(v); };
    w.focus = function () { inp.focus(); };
    return w;
  }

  /* chips(['가','나'], onPick) — 짧은 선택지를 알약으로 늘어놓는다.
   * 계열 칩(.chip 범례)과 이름이 겹치지 않게 .pill 을 쓴다. */
  function chips(items, onPick) {
    return el('div.pills', null, (items || []).map(function (t) {
      var val = typeof t === 'string' ? t : t.value;
      var lab = typeof t === 'string' ? t : t.label;
      return el('button.pill', {
        type: 'button', text: lab,
        onclick: function () { if (onPick) onPick(val); }
      });
    }));
  }

  /* statRow([{k, v, sub}]) — 숫자 몇 개를 나란히. 확인서·요약에 쓴다 */
  function statRow(stats) {
    return el('div.stat-row', null, (stats || []).map(function (s) {
      return el('div.stat', null, [
        el('div.k', { text: s.k }),
        el('div.v', { text: s.v }),
        s.sub ? el('div.sub', { text: s.sub }) : null
      ]);
    }));
  }

  /* modal({title, body, onClose}) — <dialog> 라서 Esc 와 배경 어둡게가 공짜로 따라온다.
   *
   * ★ 닫을 때 close 이벤트만 믿으면 안 된다. 그 이벤트는 비동기라서 노드가 DOM 에 남고,
   *   다음에 띄우는 창을 가려 버린다. 그래서 (a) 열 때 남아 있는 창을 먼저 지우고
   *   (b) 닫을 때도 직접 remove 한다. */
  function modal(opts) {
    opts = opts || {};
    Array.prototype.forEach.call(document.querySelectorAll('dialog.modal'), function (d) {
      if (d.open) { try { d.close(); } catch (e) { /* 이미 닫혔다 */ } }
      d.remove();
    });

    var dlg = el('dialog.modal');
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      if (dlg.open) { try { dlg.close(); } catch (e) { /* 이미 닫혔다 */ } }
      dlg.remove();
      if (opts.onClose) opts.onClose();
    }

    dlg.appendChild(el('div.modal-head', null, [
      el('div.modal-title', { text: opts.title || '' }),
      el('button.modal-x', { type: 'button', 'aria-label': '닫기', text: '✕', onclick: close })
    ]));
    dlg.appendChild(el('div.modal-body', null, opts.body || []));
    dlg.appendChild(el('div.modal-foot', null, [btn('닫기', close)]));

    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });  // 배경 클릭
    dlg.addEventListener('close', close);                                           // Esc

    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', 'open');    // <dialog> 미지원 브라우저 대비

    dlg.closeModal = close;
    return dlg;
  }

  // ─────────────────────────────────────────────── 코드·출력

  /* 데이터셋별 실행 준비 코드.
   * 웹앱의 코드 조각은 `t`, `df` 같은 변수를 이미 있다고 가정한다. 학생이 IDLE 이나
   * 주피터에 그대로 붙이면 NameError 가 난다. 그래서 복사할 때 이걸 앞에 붙여 준다. */
  var PREAMBLE = {
    titanic: ['import pandas as pd', '', "t = pd.read_csv('train.csv')"],
    ramen: ['import pandas as pd', '', "ramen = pd.read_csv('ramen-ratings.csv')"],
    abalone: ['import pandas as pd', '', "df = pd.read_csv('abalone.csv')"],
    earthquake: ['import pandas as pd', '', "data = pd.read_csv('lab_earthquake.csv')"],
    /* 2부. 교재 각 장의 첫 블록과 같은 정리를 한다 — 복사해 붙이면 바로 그림이 나온다.
     * 변수 이름도 교재와 같다: 일별 기온 df · 연별 기온 data · 강수 rain · 인구 pop */
    seoul_day: ['import pandas as pd', 'import matplotlib.pyplot as plt', 'import seaborn as sns',
      "plt.rc('font', family='Malgun Gothic')   # 맥은 'AppleGothic'", "plt.rc('axes', unicode_minus=False)", '',
      "df = pd.read_csv('seoul_temp_day.csv', encoding='cp949')",
      "df['날짜'] = df['날짜'].str.strip()", "df = df[df['날짜'] != ''].copy()",
      "df['날짜'] = pd.to_datetime(df['날짜'])",
      "df['년'] = df['날짜'].dt.year", "df['월'] = df['날짜'].dt.month"],
    seoul_year: ['import pandas as pd', 'import matplotlib.pyplot as plt',
      "plt.rc('font', family='Malgun Gothic')   # 맥은 'AppleGothic'", "plt.rc('axes', unicode_minus=False)", '',
      "data = pd.read_csv('seoul_temp.csv', encoding='cp949')"],
    busan_rain: ['import pandas as pd', 'import matplotlib.pyplot as plt', 'import seaborn as sns',
      "plt.rc('font', family='Malgun Gothic')   # 맥은 'AppleGothic'", "plt.rc('axes', unicode_minus=False)", '',
      // 교재 V6 첫 블록처럼 읽기만 한다 — rain.shape 가 (43100, 3) 이어야 화면과 같다.
      // 년·월 열이 필요한 블록은 그 블록 안에서 만든다.
      "rain = pd.read_csv('busan_rain_day.csv', encoding='cp949')"],
    korea_pop: ['import pandas as pd', 'import matplotlib.pyplot as plt',
      "plt.rc('font', family='Malgun Gothic')   # 맥은 'AppleGothic'", "plt.rc('axes', unicode_minus=False)", '',
      "pop = pd.read_csv('korea_pop.csv', encoding='cp949', thousands=',')"]
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
          btn.textContent = 'Ctrl+C 로 직접 복사';
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

  /* note(message, title, opts)
   *   opts.kind: 'why' | 'tip' | 'ver' | 'danger'  — 왼쪽 줄 색만 바뀐다
   *   opts.html: true 면 message 를 HTML 로 넣는다. escape 책임은 호출자에게 있다. */
  function note(message, title, opts) {
    opts = opts || {};
    var box = el('div.note' + (opts.kind ? '.note--' + opts.kind : ''));
    if (title) box.appendChild(el('span.note-label', { text: title }));
    if (opts.html) box.appendChild(el('div', { html: message }));
    else box.appendChild(document.createTextNode(message));
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
    /* 장 진도만 지운다. 과제(quest:) 와 보관함(questbox:) 은 건드리지 않는다 —
     * 사이드바의 "장 진도 초기화" 한 번에 남의 과제 답까지 날아가면 안 된다.
     * 과제 기록은 과제 화면 안에서 이름별로 따로 지운다. */
    reset: function () {
      var d = this.load();
      Object.keys(d).forEach(function (k) {
        if (k.indexOf('quest:') !== 0 && k.indexOf('questbox:') !== 0) delete d[k];
      });
      this.save(d);
      emitProgress();
    },
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
    /* 보기 순서를 섞는다. 모듈 작성자는 정답을 첫 보기에 두는 버릇이 있어서(2부 20문항 중
     * 17문항이 A 였다) 학생이 "모르면 A" 를 배운다. 문제 글을 씨앗으로 섞으므로 다시 방문해도
     * 같은 순서다. 진도는 정답 여부만 기록하므로 순서가 바뀌어도 기록은 그대로다.
     * 보기 순서에 뜻이 있으면(예: 0 · 1 · 2 처럼 크기순) spec.keepOrder: true. */
    var choices = (spec.choices || []).slice();
    if (!spec.keepOrder && choices.length > 2) {
      var h = 2166136261;
      String(spec.question || '').split('').forEach(function (ch) { h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; });
      for (var si = choices.length - 1; si > 0; si--) {
        h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
        var sj = h % (si + 1), tmp = choices[si]; choices[si] = choices[sj]; choices[sj] = tmp;
      }
    }
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
    // 2부 차트
    line: line, columns: columns, dist: dist, heatmap: heatmap, pyramid: pyramid,
    fiveNum: fiveNum, bootstrapCI: bootstrapCI, seeded: seeded, SERIES_COLORS: SERIES_COLORS,
    niceTicks: niceTicks, scale: scale,
    // 컨트롤
    slider: slider, buttonGroup: buttonGroup, toggle: toggle, seg: seg, btn: btn,
    textInput: textInput, chips: chips,
    // 텍스트
    code: code, note: note, danger: danger, statRow: statRow, modal: modal,
    copyToClipboard: copyToClipboard, PREAMBLE: PREAMBLE,
    // 단계·문제·진도
    stepper: stepper, quiz: quiz, progress: progress
  };

  if (typeof window !== 'undefined') window.UI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})();
