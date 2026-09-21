/* harvest_code.js — 화면의 "복사해서 바로 실행" 코드 블록을 모은다 (브라우저에서 돌린다).
 *
 *   npm start 로 앱을 띄운 뒤 콘솔에서:
 *     fetch('/webapp/test/harvest_code.js').then(r => r.text()).then(eval)
 *   반환값(JSON 문자열)을 파일로 저장하고 run_code_blocks.py 로 돌린다.
 *
 * 무엇을 모으나: UI.code 중 복사 가능한(noCopy 아님) 블록 가운데 dataset 머리말이 붙거나
 * 스스로 import 하는 것. 각 장을 떨어진 노드에 한 번 그려서 **처음 상태**의 블록만 모은다
 * (슬라이더를 움직인 뒤의 변형은 모으지 않는다 — 같은 틀에 숫자만 바뀐다).
 * 떨어진 노드에 그리므로 학생 진도를 건드리지 않는다.
 */
(function () {
  var orig = UI.code, got = [], cur = '';
  UI.code = function (src, opts) {
    opts = opts || {};
    src = String(src);
    if (!opts.noCopy && (opts.dataset || /(^|\n)import /.test(src))) {
      got.push({ ch: cur, ds: opts.dataset || null, src: src,
        out: opts.output === undefined ? null : String(opts.output) });
    }
    return orig.apply(this, arguments);
  };
  try {
    Lab.chapters().forEach(function (c) {
      cur = c.id;
      c.render(document.createElement('div'));
    });
  } finally {
    UI.code = orig;
  }
  var seen = {}, blocks = got.filter(function (g) {
    var k = g.ch + '\n' + g.src;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
  return JSON.stringify({ pre: UI.PREAMBLE, blocks: blocks });
})();
