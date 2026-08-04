/* serve.js — 개발용 정적 서버
 *
 *   npm start   ->  http://localhost:5173  에서 index.html 을 서빙한다
 *
 * 의존성 없이 node 기본 모듈만 쓴다. GitHub Pages 와 같은 조건(정적 파일)을 로컬에서 재현하는 것이
 * 목적이므로 라이브 리로드 같은 것은 넣지 않았다. 파일을 고치면 브라우저를 새로 고친다.
 */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var ROOT = path.resolve(__dirname, '..');
var PORT = Number(process.env.PORT) || 5173;

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',   // .md 를 브라우저에서 읽을 수 있게 (Pages 는 text/markdown 을 준다)
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

var server = http.createServer(function (req, res) {
  var pathname = decodeURIComponent(url.parse(req.url).pathname);
  if (pathname === '/') pathname = '/index.html';

  var target = path.join(ROOT, pathname);

  // ROOT 밖으로 나가는 경로를 막는다
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('403');
    return;
  }
  // 원본 자료는 서빙하지 않는다 (저작권·자격증명. ../CLAUDE.md §10)
  if (pathname.indexOf('/수업자료') === 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('403 — 수업자료는 서빙하지 않는다 (저작권)');
    return;
  }

  fs.stat(target, function (err, st) {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end('404 ' + pathname);
      return;
    }
    var type = TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, function () {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.log('! index.html 이 없다. 먼저 `npm run build` 를 돌려라.');
  }
  console.log('Pandas Lab  ->  http://localhost:' + PORT + '/');
  console.log('단일 파일    ->  http://localhost:' + PORT + '/pandas-lab.html');
  console.log('멈추려면 Ctrl+C');
});
