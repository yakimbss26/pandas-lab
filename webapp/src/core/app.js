/* app.js — 셸 (챕터 등록소 · 라우터 · 사이드바 · 진도 · 테마)
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
 * ★ 셸의 생김새는 NumPy Lab(https://yakimbss26.github.io/numpy-lab/)과 같다.
 *    두 사이트를 한 학기에 함께 쓰므로 사이드바·홈 화면·이전/다음 자리가 같아야 한다.
 *    구조를 바꾸려면 양쪽을 같이 바꾼다. 배치는 app.css, 색·형태는 theme.css.
 *
 * ES 모듈 문법 금지 — 단일 파일 배포본에 인라인되므로 깨진다.
 */
(function () {
  'use strict';

  var STORE_KEY = 'pandas-lab/v1';
  var chapters = [];        // {id, num, title, subtitle, sim, key, render}
  var byId = {};
  var mounted = null;       // 현재 그려진 장 id
  var opts = {};
  var navLinks = {};        // id -> {a, dot}
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : { theme: null };
    } catch (e) {
      return { theme: null };   // 저장소가 막혀 있어도 앱은 돌아야 한다
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }

  // ─────────────────────────────────────────────── 등록

  /* 모듈이 자기를 등록한다.
   *   Lab.register({
   *     id: 'ch07-copy', num: 7,
   *     title: '뷰와 복사, Copy-on-Write',
   *     subtitle: '한 줄 소개 — 홈 타일과 장 머리에 함께 쓴다',
   *     sim: '참조 카운트 실험실 · 연쇄 할당',   // 홈 타일의 시뮬레이터 요약 (없으면 생략)
   *     key: true,                              // 가장 많이 틀리는 개념 (★)
   *     render: function (root) { … }
   *   }) */
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

  // ─────────────────────────────────────────────── 테마

  /* data-theme 을 루트에 도장한다. 토글이 OS 설정을 양방향으로 이겨야 한다. */
  function applyTheme() {
    var root = document.documentElement;
    if (state.theme === 'dark' || state.theme === 'light') root.setAttribute('data-theme', state.theme);
    else root.removeAttribute('data-theme');
  }
  function setTheme(t) {
    state.theme = (t === 'auto') ? null : t;
    save();
    applyTheme();
  }

  // ─────────────────────────────────────────────── 사이드바

  function buildSidebar() {
    var nav = UI.el('nav.nav');
    nav.appendChild(UI.el('a.home-link', { href: '#/' }, [
      UI.el('span.num', { text: '⌂' }), UI.el('span', { text: '처음 화면' })
    ]));
    nav.appendChild(UI.el('div.nav-group', { text: '학습 과정' }));
    chapters.forEach(function (c) {
      var dot = UI.el('span.dot');
      var a = UI.el('a', { href: '#/' + c.id, 'data-id': c.id }, [
        UI.el('span.num', { text: String(c.num) }),
        UI.el('span', { text: c.title }),
        dot
      ]);
      navLinks[c.id] = { a: a, dot: dot };
      nav.appendChild(a);
    });

    var progText = UI.el('div');
    var progFill = UI.el('i');

    var foot = UI.el('div.side-foot', null, [
      UI.seg({
        label: '테마',
        value: state.theme || 'auto',
        options: [
          { value: 'auto', label: '자동' },
          { value: 'light', label: '밝게' },
          { value: 'dark', label: '어둡게' }
        ],
        onChange: setTheme
      }),
      UI.btn('진도 초기화', function () {
        if (confirm('방문 기록과 맞힌 문제를 모두 지운다. 계속하겠는가?')) UI.progress.reset();
      }),
      opts.bookHref ? UI.el('a.btn', { href: opts.bookHref, text: '교재 보기' }) : null,
      UI.el('div.prog-line', null, [progText, UI.el('div.prog-bar', null, [progFill])])
    ]);

    var side = UI.el('aside.sidebar', { id: 'sidebar' }, [
      UI.el('div.brand', null, [
        UI.el('a.logo', { href: '#/', style: { color: 'inherit' } }, [
          UI.el('span.mark', { text: 'pd' }),
          UI.el('span', { text: opts.title || 'Pandas Lab' })
        ]),
        UI.el('div.tag', { text: '과학고 1학년 심화 학습 · 시뮬레이터 내장' })
      ]),
      nav,
      foot
    ]);

    function refresh() {
      var seen = 0, okQ = 0;
      chapters.forEach(function (c) {
        var st = UI.progress.stats(c.id);
        var d = navLinks[c.id].dot;
        /* 초록은 그 장의 문제를 **전부** 맞혔을 때만. 하나 맞히고 초록이 되면 점이 거짓말을 한다. */
        var allRight = st.total > 0 && st.correct === st.total;
        d.className = 'dot' + (allRight ? ' done' : (st.visited ? ' seen' : ''));
        d.title = c.num + '장 — ' + (allRight ? '확인 문제 전부 정답'
          : st.visited ? '방문함 (문제 ' + st.correct + '/' + (st.total || '?') + ')' : '아직 안 봄');
        if (st.visited) seen++;
        okQ += st.correct;
      });
      progText.textContent = '방문 ' + seen + '/' + chapters.length + ' · 문제 ' + okQ + '문 정답';
      progFill.style.width = (chapters.length ? (seen / chapters.length * 100) : 0).toFixed(0) + '%';
    }
    UI.progress.onChange(refresh);
    refresh();
    return side;
  }

  // ─────────────────────────────────────────────── 홈 화면

  function renderHome(main) {
    main.appendChild(UI.el('div.hero', null, [
      UI.el('h1', { text: opts.title || 'Pandas Lab' }),
      UI.el('p.sub', {
        html: 'pandas 를 <b>읽어서 외우는 대신 직접 움직여 보며</b> 배우는 실습장이다. ' +
          '연산이 왜 인덱스로 짝을 맞추는지, 자른 표가 언제 원본과 메모리를 나눠 쓰는지, ' +
          'groupby 가 실제로 어떤 행을 묶는지 — 모두 화면에서 직접 확인할 수 있다.'
      }),
      UI.el('p.sub.small', {
        html: '이 페이지 안에는 브라우저에서 도는 <b>미니 DataFrame 엔진</b>이 들어 있다. ' +
          '보이는 숫자는 미리 적어 둔 값이 아니라 <b>그 자리에서 계산한 결과</b>다. ' +
          '설치도, 인터넷도 필요 없다.'
      })
    ]));

    var tiles = UI.el('div.tiles');
    chapters.forEach(function (c) {
      tiles.appendChild(UI.el('a.tile' + (c.key ? '.key' : ''), { href: '#/' + c.id }, [
        UI.el('div.n', { text: c.num + '장' }),
        UI.el('div.t', { text: c.title }),
        UI.el('div.d', { text: c.subtitle || '' }),
        c.sim ? UI.el('div.sim', { text: '▸ ' + c.sim }) : null,
        c.key ? UI.el('div.key-mark', { text: '★ 가장 많이 틀리는 개념' }) : null
      ]));
    });
    main.appendChild(tiles);

    main.appendChild(UI.note(
      '왼쪽 목록의 점은 진도 표시다. 회색은 방문한 장, 초록은 확인 문제를 모두 맞힌 장이다. ' +
      '기록은 이 브라우저에만 저장되므로 다른 사람과 섞이지 않는다.', '사용법'));

    main.appendChild(UI.note(
      '화면의 파이썬 코드는 블록 오른쪽 아래 복사 버튼을 누르면 그대로 가져갈 수 있다. ' +
      'import 와 데이터 불러오기가 빠진 코드에는 복사할 때 자동으로 붙여 주므로, ' +
      'IDLE 편집창에 붙여넣고 F5 를 누르면 바로 돈다. ' +
      'pandas 가 없다면 명령 프롬프트에서 pip install pandas 를 한 번 실행하면 된다.',
      'IDLE 에서 직접 실행하는 방법'));

    if (window.LabData && window.LabData.synthetic) {
      main.appendChild(UI.note(
        '이 웹앱의 실습 데이터는 원본과 구조만 같은 합성 데이터다(지진 데이터는 USGS 실데이터). ' +
        '교재의 값과 다를 수 있다.', '실습 데이터에 대하여'));
    }

    var simRows = chapters.filter(function (c) { return c.sim; }).map(function (c) {
      return { ch: c.num + '장', t: c.title, s: c.sim };
    });
    if (simRows.length) {
      main.appendChild(UI.el('h2.h-sec', { text: '이 실습장에 든 시뮬레이터' }));
      main.appendChild(UI.table(
        [{ key: 'ch', label: '장' }, { key: 't', label: '주제' }, { key: 's', label: '시뮬레이터 · 시각화' }],
        simRows
      ));
    }
  }

  // ─────────────────────────────────────────────── 라우터

  function currentId() {
    return (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  }

  function go(id) {
    if (currentId() === id) route();
    else location.hash = '#/' + id;
  }

  function route() {
    var main = document.getElementById('main-inner');
    if (!main) return;
    UI.clear(main);
    removeToc();
    window.scrollTo(0, 0);

    var id = currentId();
    Object.keys(navLinks).forEach(function (k) { navLinks[k].a.classList.remove('on'); });
    var home = document.querySelector('.home-link');
    if (home) home.classList.toggle('on', !id);

    if (!id) {
      mounted = null;
      UI.progress.beginChapter(null);
      renderHome(main);
      document.title = opts.title || 'Pandas Lab';
      closeSidebar();
      return;
    }

    var spec = byId[id];
    if (!spec) {
      main.appendChild(UI.el('h1.h-chapter', { text: '없는 페이지' }));
      main.appendChild(UI.el('p', null, [UI.el('a', { href: '#/', text: '처음 화면으로 돌아가기' })]));
      closeSidebar();
      return;
    }

    mounted = id;
    if (navLinks[id]) navLinks[id].a.classList.add('on');
    document.title = spec.num + '. ' + spec.title + ' · ' + (opts.title || 'Pandas Lab');

    main.appendChild(UI.el('div.crumb', { text: spec.num + '장' }));
    main.appendChild(UI.el('h1.h-chapter', { text: spec.title }));
    if (spec.subtitle) main.appendChild(UI.el('p.lede', { text: spec.subtitle }));
    if (window.LabData && window.LabData.synthetic) {
      main.appendChild(UI.el('p.small.muted', {
        text: '실습 데이터는 원본과 구조만 같은 합성 데이터다(지진 데이터는 USGS 실데이터).'
      }));
    }

    /* 문제 번호를 0 부터 다시 매긴다. render 안에서 만들어지는 순서가 곧 번호다. */
    UI.progress.beginChapter(id);

    var body = UI.el('div.chapter-body');
    main.appendChild(body);
    try {
      spec.render(body);
    } catch (e) {
      body.appendChild(UI.danger('이 장을 그리는 중 오류', String(e && e.message || e)));
      console.error('[Lab] ' + id + ' render 실패', e);
    }

    UI.progress.endChapter(id);      // 이 장에 문제가 몇 개인지 확정한다
    main.appendChild(chapterNav(spec));
    buildToc(main);
    UI.progress.visit(id);
    closeSidebar();
  }

  function chapterNav(spec) {
    var i = chapters.indexOf(spec);
    var box = UI.el('div.chapter-nav');
    if (i > 0) {
      var p = chapters[i - 1];
      box.appendChild(UI.el('a', { href: '#/' + p.id }, [
        UI.el('span.k', { text: '← 이전' }),
        UI.el('span', { text: p.num + '. ' + p.title })
      ]));
    }
    if (i < chapters.length - 1) {
      var n = chapters[i + 1];
      box.appendChild(UI.el('a.next', { href: '#/' + n.id }, [
        UI.el('span.k', { text: '다음 →' }),
        UI.el('span', { text: n.num + '. ' + n.title })
      ]));
    }
    return box;
  }

  // ─────────────────────────────────────────────── 오른쪽 목차

  /* 장 안의 카드 제목(.panel-title)을 긁어서 만든다. 제목이 하나뿐이면 만들지 않는다. */
  function removeToc() {
    var old = document.querySelector('.toc');
    if (old) old.remove();
  }
  function buildToc(main) {
    var heads = main.querySelectorAll('.panel-title');
    if (heads.length < 2) return;
    var toc = UI.el('nav.toc', null, [
      UI.el('div.nav-group', { text: '이 장의 내용', style: { padding: '0 0 .3rem' } })
    ]);
    Array.prototype.forEach.call(heads, function (h, i) {
      if (!h.id) h.id = 'sec-' + i;
      toc.appendChild(UI.el('a', {
        href: '#' + h.id, text: h.textContent,
        onclick: function (e) { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }));
    });
    document.body.appendChild(toc);
  }

  // ─────────────────────────────────────────────── 모바일 서랍

  function closeSidebar() {
    var sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
    var sc = document.getElementById('scrim');
    if (sc) sc.hidden = true;
  }
  function toggleSidebar() {
    var sb = document.getElementById('sidebar');
    var sc = document.getElementById('scrim');
    if (!sb) return;
    sb.classList.toggle('open');
    if (sc) sc.hidden = !sb.classList.contains('open');
  }

  // ─────────────────────────────────────────────── 부팅

  /* 모듈이 전부 등록된 뒤에 부른다. index.html 의 맨 마지막. */
  function boot(o) {
    opts = o || {};
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
    migrateOldProgress();

    /* 브라우저의 스크롤 복원을 끈다.
     * 해시로 장을 옮기는 앱이라 브라우저가 이전 스크롤 위치를 되살리면
     * 새로 고침할 때마다 장 제목을 지나친 자리에서 시작한다. */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    var root = document.getElementById('lab-root') || document.body;
    UI.clear(root);

    var topbar = UI.el('div.topbar', null, [
      UI.btn('☰', toggleSidebar),
      UI.el('span.logo', { text: opts.title || 'Pandas Lab' })
    ]);

    var main = UI.el('main.main', null, [
      topbar,
      UI.el('div.main-inner', { id: 'main-inner' })
    ]);

    root.appendChild(UI.el('div.shell', null, [buildSidebar(), main]));
    root.appendChild(UI.el('div.scrim', { id: 'scrim', hidden: true, onclick: closeSidebar }));

    window.addEventListener('hashchange', route);
    route();
  }

  /* 예전 셸은 "다 봤음" 을 직접 눌러 표시했다. 그 기록을 방문 기록으로 옮긴다 —
   * 옮기지 않으면 학기 중에 쓰던 학생의 진도가 통째로 사라진 것처럼 보인다. */
  function migrateOldProgress() {
    if (!state.done || state.migrated) return;
    Object.keys(state.done).forEach(function (id) {
      if (state.done[id] && byId[id]) UI.progress.visit(id);
    });
    state.migrated = true;
    delete state.done;
    save();
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
