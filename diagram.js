/* Island Navigator — SVG sketches: compass rose, legs, right triangle, oblique triangle. */
(function (root) {
  'use strict';
  var W = 320, H = 210, R = Math.PI / 180;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function txt(x, y, s, cls, anchor) { if (!anchor || anchor === 'middle') { var hw = String(s).length * 4.4; x = Math.max(hw + 4, Math.min(W - hw - 4, x)); } return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="' + (cls || 'lb') + '" text-anchor="' + (anchor || 'middle') + '">' + esc(s) + '</text>'; }
  function line(a, b, cls) { return '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" class="' + (cls || 'ln') + '"/>'; }
  function dot(p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" class="dt"/>'; }
  function wrap(inner) { return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dg" role="img" aria-label="diagram"><rect width="' + W + '" height="' + H + '" rx="12" class="bg"/>' + inner + '</svg>'; }
  function fit(pts, pad) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var minX = Math.min.apply(0, xs), maxX = Math.max.apply(0, xs), minY = Math.min.apply(0, ys), maxY = Math.max.apply(0, ys);
    var s = Math.min((W - 2 * pad) / Math.max(1e-6, maxX - minX), (H - 2 * pad) / Math.max(1e-6, maxY - minY));
    var ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
    return function (p) { return [ox + (p[0] - minX) * s, H - (oy + (p[1] - minY) * s)]; };
  }
  function off(p, c, d) { var dx = p[0] - c[0], dy = p[1] - c[1], L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * d, p[1] + dy / L * d]; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  function compass(d) {
    var cx = 160, cy = 105, r = 80, s = '';
    s += '<circle cx="160" cy="105" r="80" class="rose"/><circle cx="160" cy="105" r="5" class="dt"/>';
    for (var k = 0; k < 360; k += 30) { var a = k * R; s += line([cx + Math.sin(a) * (r - 8), cy - Math.cos(a) * (r - 8)], [cx + Math.sin(a) * r, cy - Math.cos(a) * r], 'tk'); }
    s += txt(cx, cy - r - 6 + 0, 'N', 'nsew') + txt(cx + r + 12, cy + 5, 'E', 'nsew') + txt(cx, cy + r + 16, 'S', 'nsew') + txt(cx - r - 12, cy + 5, 'W', 'nsew');
    s += line([cx, cy - r], [cx, cy + r], 'axis') + line([cx - r, cy], [cx + r, cy], 'axis');
    var b = d.bearing * R, tip = [cx + Math.sin(b) * (r - 12), cy - Math.cos(b) * (r - 12)];
    s += line([cx, cy], tip, 'path') + '<circle cx="' + tip[0].toFixed(1) + '" cy="' + tip[1].toFixed(1) + '" r="6" class="boat"/>';
    s += txt(18, 22, 'Course: ' + d.label, 'lb', 'start');
    return wrap(s);
  }
  function legs(d) {
    var sx = d.dirs[0] === 'east' ? 1 : -1, sy = d.dirs[1] === 'north' ? 1 : -1;
    var P0 = [0, 0], P1 = [sx * d.e, 0], P2 = [sx * d.e, sy * d.n];
    var T = fit([P0, P1, P2], 52), a = T(P0), b = T(P1), c = T(P2);
    var s = line(a, b, 'path') + line(b, c, 'path') + line(a, c, 'dash') + dot(a) + dot(c);
    var rx = -sx * 10, ry = sy * 10; // right-angle box at b (screen y flipped)
    s += '<path d="M' + (b[0] + rx) + ' ' + b[1] + ' L' + (b[0] + rx) + ' ' + (b[1] - ry) + ' L' + b[0] + ' ' + (b[1] - ry) + '" class="ra"/>';
    s += txt(mid(a, b)[0], mid(a, b)[1] + (sy > 0 ? 18 : -8), d.e + ' km ' + d.dirs[0]);
    s += txt(b[0] + sx * 8, mid(b, c)[1], d.n + ' km ' + d.dirs[1], 'lb', sx > 0 ? 'start' : 'end');
    s += txt(a[0] - sx * 8, a[1] + 5, 'Port', 'lb', sx > 0 ? 'end' : 'start') + txt(mid(a, c)[0] - sx * 14, mid(a, c)[1], d.ask === 'angle' ? '' : '?', 'q');
    if (d.ask === 'angle') { s += line(a, [a[0], a[1] - 40], 'axis') + txt(a[0], a[1] - 44, 'N', 'nsew') + txt(a[0] + 12, a[1] - 22, '?', 'q', 'start'); }
    return wrap(s);
  }
  function right(d) {
    var A = [40, 175], C = [270, 175], B = [270, 40];
    var s = line(A, C, 'path') + line(C, B, 'path') + line(A, B, 'path') + dot(A) + dot(B) + dot(C);
    s += '<path d="M258 175 L258 163 L270 163" class="ra"/>';
    s += '<path d="M78 175 A38 38 0 0 0 72.8 155.6" class="arc"/>';
    s += txt(96, 168, d.ang, d.ang === '?' ? 'q' : 'lb', 'start');
    if (d.adj) s += txt(155, 196, d.adj, d.adj === '?' ? 'q' : 'lb');
    if (d.opp) s += txt(280, 112, d.opp, d.opp === '?' ? 'q' : 'lb', 'start');
    if (d.hyp) s += txt(140, 96, d.hyp, d.hyp === '?' ? 'q' : 'lb', 'end');
    return wrap(s);
  }
  function tri(d) {
    var Ap = [0, 0], Bp = [d.c, 0], Cp = [d.b * Math.cos(d.A * R), d.b * Math.sin(d.A * R)];
    var T = fit([Ap, Bp, Cp], 36), a = T(Ap), b = T(Bp), c = T(Cp), g = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    var sh = d.show || {};
    var s = line(a, b, 'path') + line(b, c, 'path') + line(c, a, 'path') + dot(a) + dot(b) + dot(c);
    [['A', a], ['B', b], ['C', c]].forEach(function (v) {
      var p = off(v[1], g, 16); s += txt(p[0], p[1] + 5, v[0], 'vx');
      if (sh[v[0]]) { var q = off(v[1], g, -28); s += txt(q[0], q[1] + 4, sh[v[0]], sh[v[0]] === '?' ? 'q' : 'ang'); }
    });
    [['a', b, c], ['b', a, c], ['c', a, b]].forEach(function (e) {
      var m = mid(e[1], e[2]), p = off(m, g, 22), lab = sh[e[0]] ? e[0] + ' = ' + sh[e[0]] : e[0];
      s += txt(p[0], p[1] + 4, lab, sh[e[0]] === '?' ? 'q' : 'sd');
    });
    return wrap(s);
  }
  function bearingTri(d) {
    var P0 = [0, 0], P1 = [0, d.a], P2 = [d.b * Math.sin(d.th * R), d.a + d.b * Math.cos(d.th * R)];
    var T = fit([P0, P1, P2, [0, d.a + d.b * 0.6]], 30), a = T(P0), b = T(P1), c = T(P2);
    var s = line(a, b, 'path') + line(b, c, 'path') + line(a, c, 'dash') + dot(a) + dot(c);
    s += line(b, [b[0], b[1] - 45], 'axis') + txt(b[0], b[1] - 49, 'N', 'nsew');
    s += txt(b[0] + 6, b[1] - 18, d.th + '°', 'ang', 'start');
    s += txt(a[0] - 8, mid(a, b)[1], d.a + ' km', 'lb', 'end') + txt(mid(b, c)[0] - 6, mid(b, c)[1] - 8, d.b + ' km', 'lb', 'end');
    s += txt(mid(a, c)[0] + 12, mid(a, c)[1] + 10, '?', 'q', 'start') + txt(a[0], a[1] + 18, 'Port');
    return wrap(s);
  }
  root.Diagram = { render: function (d) {
    if (!d) return '';
    if (d.type === 'compass') return compass(d);
    if (d.type === 'legs') return legs(d);
    if (d.type === 'right') return right(d);
    if (d.type === 'tri') return tri(d);
    if (d.type === 'bearingTri') return bearingTri(d);
    return '';
  } };
})(window);
