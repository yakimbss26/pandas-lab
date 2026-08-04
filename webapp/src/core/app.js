/* app.js — 셸 (챕터 등록소 · 라우터 · 진도 · 테마)
 *
 * ★★ 가장 비쌌던 버그: 이 파일은 **모듈보다 먼저** 로드되어야 한다.
 *    모듈은 로드 시점에 Lab.register(...) 를 부르는데, 그때 window.Lab 이 없으면
 *    모듈들이 조용히 "Lab is not defined" 로 죽어 장이 하나도 등록되지 않는다.
 *    문법 검사도 node 하네스도 통과한다. 브라우저로 열어 보지 않으면 발견하지 못한다.
 *
 *    올바른 순서: df → ui → data → app → modules → Lab.boot()
 *
 * ★ render(root) 는 여러 번 호출된다. 장을 다시 방문하면 다시 불린다.
 *    모듈 전역에 가변 상태를 두지 말고 render 안의 지역 변수 + rebuild() 를 써라.
 *
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다.
 */
(function () {
  'use strict';

  var STORE_KEY = 'pandas-lab/v1';
  var chapters = [];        // {id, num, title, subtitle, render}
  var byId = {};
  var mounted = null;       // 현재 그려진 장 id
  var firstRenderDone = false;
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : { done: {}, theme: null };
    } catch (e) {
      return { done: {}, theme: null };   // 저장소가 막혀 있어도 앱은 돌아야 한다
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }

  // ─────────────────────────────────────────────── 등록

  /* 모듈이 자기를 등록한다.
   *   Lab.register({ id:'ch07-copy', num:7, title:'뷰와 복사', render:function(root){…} }) */
  function register(spec) {
    if (!spec || !spec.id) throw new Error('register: id 가 필요하다');
    if (typeof spec.render !== 'function') throw new Error('register: ' + spec.id + ' 에 render 가 없다');
    if (byId[spec.id]) {
      console.warn('[Lab] 같은 id 가 두 번 등록되었다: ' + spec.id);
      return;
    }
    byId[spec.id] = spec;
    chapters.push(spec);
  }

  // ─────────────────────────────────────────────── 라우터

  function currentId() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return h && byId[h] ? h : (chapters.length ? chapters[0].id : null);
  }

  function go(id) {
    if (location.hash.replace(/^#\/?/, '') === id) render();
    else location.hash = '#/' + id;
  }

  function render() {
    var id = currentId();
    if (!id) return;
    var main = document.getElementById('lab-main');
    if (!main) return;
    var spec = byId[id];

    // 같은 장을 다시 그릴 때도 root 를 완전히 비운다.
    // 모듈이 root 밖에 상태를 두면 여기서 새지만, 그건 모듈의 잘못이다(위 주석 참고).
    UI.clear(main);
    mounted = id;

    var head = UI.el('div');
    head.appendChild(UI.el('h1', { text: (spec.num ? spec.num + '장. ' : '') + spec.title }));
    if (spec.subtitle) head.appendChild(UI.el('p.note', { text: spec.subtitle }));
    main.appendChild(head);

    var body = UI.el('div');
    main.appendChild(body);
    try {
      spec.render(body);
    } catch (e) {
      body.appendChild(UI.danger('이 장을 그리는 중 오류', String(e && e.message || e)));
      console.error('[Lab] ' + id + ' render 실패', e);
    }

    main.appendChild(footer(spec));
    drawNav();

    /* 장을 **옮길 때만** 맨 위로 올린다.
     * 첫 렌더에서 스크롤하면 앱을 열자마자 장 제목을 지나친 위치에서 시작한다.
     * (scrollIntoView 는 sticky 헤더 높이를 고려하지 않아 제목이 헤더 밑에 깔리기도 한다.) */
    if (firstRenderDone) window.scrollTo({ top: 0, behavior: 'auto' });
    firstRenderDone = true;

    document.title = (spec.num ? spec.num + '장 · ' : '') + spec.title + ' — Pandas Lab';
  }

  function footer(spec) {
    var box = UI.el('div.card');
    var row = UI.el('div.control-row');
    var i = chapters.indexOf(spec);
    var doneBtn = UI.toggle({
      label: state.done[spec.id] ? '✓ 다 봤음' : '다 봤음으로 표시',
      value: !!state.done[spec.id],
      onChange: function (on) {
        state.done[spec.id] = on;
        save();
        doneBtn.textContent = on ? '✓ 다 봤음' : '다 봤음으로 표시';
        drawNav();
      }
    });
    row.appendChild(doneBtn);
    if (i > 0) {
      var p = UI.el('button', { text: '← ' + chapters[i - 1].title });
      p.addEventListener('click', function () { go(chapters[i - 1].id); });
      row.appendChild(p);
    }
    if (i < chapters.length - 1) {
      var n = UI.el('button', { text: chapters[i + 1].title + ' →' });
      n.addEventListener('click', function () { go(chapters[i + 1].id); });
      row.appendChild(n);
    }
    box.appendChild(row);
    return box;
  }

  // ─────────────────────────────────────────────── 네비게이션

  function drawNav() {
    var nav = document.getElementById('lab-nav');
    if (!nav) return;
    UI.clear(nav);
    var cur = currentId();
    var doneCount = chapters.filter(function (c) { return state.done[c.id]; }).length;

    nav.appendChild(UI.el('div.panel-title', {
      text: '진도 ' + doneCount + ' / ' + chapters.length
    }));

    var list = UI.el('div');
    chapters.forEach(function (c) {
      var item = UI.el('button', {
        style: { display: 'block', width: '100%', textAlign: 'left', marginBottom: '4px' },
        'aria-pressed': c.id === cur ? 'true' : 'false'
      });
      item.appendChild(document.createTextNode(
        (state.done[c.id] ? '✓ ' : '') + (c.num ? c.num + '. ' : '') + c.title
      ));
      item.addEventListener('click', function () { go(c.id); });
      list.appendChild(item);
    });
    nav.appendChild(list);

    var reset = UI.el('button', { text: '진도 초기화', style: { marginTop: '12px' } });
    reset.addEventListener('click', function () {
      state.done = {};
      save();
      drawNav();
    });
    nav.appendChild(reset);
  }

  // ─────────────────────────────────────────────── 테마

  /* data-theme 을 루트에 도장한다. 토글이 OS 설정을 양방향으로 이겨야 한다. */
  function applyTheme() {
    var root = document.documentElement;
    if (state.theme === 'dark' || state.theme === 'light') root.setAttribute('data-theme', state.theme);
    else root.removeAttribute('data-theme');
  }

  function themeButton() {
    var b = UI.el('button', { text: themeLabel() });
    b.addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : state.theme === 'light' ? null : 'dark';
      save();
      applyTheme();
      b.textContent = themeLabel();
    });
    return b;
  }
  function themeLabel() {
    return state.theme === 'dark' ? '◐ 어둡게' : state.theme === 'light' ? '◑ 밝게' : '◓ 시스템';
  }

  // ─────────────────────────────────────────────── 부팅

  /* 모듈이 전부 등록된 뒤에 부른다. index.html 의 맨 마지막. */
  function boot(opts) {
    opts = opts || {};
    if (!window.DF) { fatal('DF 엔진이 없다. df.js 가 app.js 보다 먼저 로드되어야 한다.'); return; }
    if (!window.UI) { fatal('UI 위젯이 없다. ui.js 가 app.js 보다 먼저 로드되어야 한다.'); return; }
    if (!chapters.length) {
      fatal('등록된 장이 하나도 없다. modules/*.js 가 app.js 보다 **나중에** 로드되었는지 확인하라.');
      return;
    }

    chapters.sort(function (a, b) {
      var an = a.num === undefined ? 999 : a.num, bn = b.num === undefined ? 999 : b.num;
      return an - bn || (a.id < b.id ? -1 : 1);
    });

    applyTheme();

    /* 브라우저의 스크롤 복원을 끈다.
     * 해시로 장을 옮기는 앱이라 브라우저가 이전 스크롤 위치를 되살리면
     * 새로 고침할 때마다 장 제목을 지나친 자리에서 시작한다. */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    var root = document.getElementById('lab-root') || document.body;
    UI.clear(root);

    var header = UI.el('header.lab-header');
    header.appendChild(UI.el('div.lab-brand', { text: opts.title || 'Pandas Lab' }));
    var tools = UI.el('div.control-row', { style: { margin: '0' } });
    tools.appendChild(themeButton());
    if (opts.bookHref) {
      var a = UI.el('a.btn', { href: opts.bookHref, text: '교재 보기' });
      tools.appendChild(a);
    }
    header.appendChild(tools);
    root.appendChild(header);

    var shell = UI.el('div.lab-shell');
    shell.appendChild(UI.el('aside', { id: 'lab-nav', class: 'lab-nav' }));
    shell.appendChild(UI.el('main', { id: 'lab-main', class: 'lab-main' }));
    root.appendChild(shell);

    if (window.LabData && window.LabData.synthetic) {
      var main0 = shell.querySelector('#lab-main');
      main0.appendChild(UI.note(
        '이 웹앱의 실습 데이터는 원본과 구조만 같은 합성 데이터다(지진 데이터는 USGS 실데이터). ' +
        '교재의 값과 다를 수 있다.', '알림'
      ));
    }

    window.addEventListener('hashchange', render);
    render();
  }

  function fatal(msg) {
    console.error('[Lab] ' + msg);
    var root = document.getElementById('lab-root') || document.body;
    var box = document.createElement('div');
    box.style.cssText = 'margin:24px;padding:16px;border:2px solid #d03b3b;border-radius:8px;' +
      'font-family:system-ui,sans-serif;color:#d03b3b';
    box.textContent = '⚠ 앱을 시작할 수 없다 — ' + msg;
    root.appendChild(box);
  }

  var Lab = {
    register: register,
    boot: boot,
    go: go,
    chapters: function () { return chapters.slice(); },
    get: function (id) { return byId[id]; },
    current: function () { return mounted; },
    state: state
  };

  if (typeof window !== 'undefined') window.Lab = Lab;
  if (typeof module !== 'undefined' && module.exports) module.exports = Lab;
})();
