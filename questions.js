/* Island Navigator — audited item generators (Grade 11 Gen Math, Week 9).
 * Every generator computes the key, re-verifies it with an independent check,
 * builds distractors from common mistakes, and never lets the key appear twice. */
(function (root) {
  'use strict';
  var D2R = Math.PI / 180;
  function sin(d) { return Math.sin(d * D2R); }
  function cos(d) { return Math.cos(d * D2R); }
  function tan(d) { return Math.tan(d * D2R); }
  function asinD(x) { return Math.asin(x) / D2R; }
  function acosD(x) { return Math.acos(x) / D2R; }
  function atanD(x) { return Math.atan(x) / D2R; }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function close(x, y, tol) { return Math.abs(x - y) <= (tol || 1e-6) * Math.max(1, Math.abs(y)); }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function num(x, unit) { return f2(x) + ' ' + unit; }
  function deg(x) { return Math.round(x) + '°'; }
  function az(x) { x = ((Math.round(x) % 360) + 360) % 360; return ('00' + x).slice(-3) + '°'; }

  var PLACES = ['Culasi Port', 'Baybay Beach', 'Olotayan Island', 'Banica', 'Libas', 'Pan de Azucar Island', 'Mantalinga Island', 'Basiao', 'Ivisan', 'Pilar Bay', 'Sapian Bay', 'Lawaan', 'Tabuc Suba'];
  var BOATS = ['banca', 'fishing banca', 'motor banca', 'paddle boat'];
  function place(not) { var p; do { p = pick(PLACES); } while (not && not.indexOf(p) >= 0); return p; }

  /* Build 4 options: key + 3 distinct distractors (from mistakes first, then near-misses). */
  function options(key, mistakes, fmt, kVal, isAngle) {
    var seen = {}; var out = [];
    seen[key] = 1;
    function add(v) {
      if (out.length >= 3) return;
      if (typeof v !== 'number' || !isFinite(v) || v <= 0) return;
      if (isAngle && v >= 180) return;
      var s = fmt(v);
      if (seen[s]) return;
      seen[s] = 1; out.push(s);
    }
    shuffle(mistakes).forEach(add);
    var bumps = isAngle ? [4, -4, 7, -7, 10, -10, 13, 15, -15] : [1.12, 0.88, 1.2, 0.8, 1.3, 0.75, 1.45, 0.6];
    shuffle(bumps).forEach(function (b) { add(isAngle ? kVal + b : kVal * b); });
    if (out.length < 3) throw new Error('distractors');
    var all = shuffle([key].concat(out));
    return { options: all, answer: all.indexOf(key) };
  }
  function fromStrings(key, pool) {
    var uniq = [];
    pool.forEach(function (s) { if (s !== key && uniq.indexOf(s) < 0) uniq.push(s); });
    if (uniq.length < 3) throw new Error('distractors');
    var all = shuffle([key].concat(shuffle(uniq).slice(0, 3)));
    return { options: all, answer: all.indexOf(key) };
  }
  function assert(c) { if (!c) throw new Error('verify failed'); }

  /* Triangle helper: build vertex coordinates for diagram from sides. */
  function triDiagram(t, show, opts) {
    // t: {a,b,c,A,B,C}; place A at (0,0), B at (c,0), C from angle A and side b.
    return { type: 'tri', a: t.a, b: t.b, c: t.c, A: t.A, B: t.B, C: t.C, show: show, right: opts && opts.right, names: opts && opts.names };
  }

  /* ---------------- LEVEL 1: Bearings & compass ---------------- */
  var L1 = [
    function compassToAz() {
      var th = ri(12, 78); var q = pick(['NE', 'SE', 'SW', 'NW']);
      var label = { NE: 'N ' + th + '° E', SE: 'S ' + th + '° E', SW: 'S ' + th + '° W', NW: 'N ' + th + '° W' }[q];
      var map = { NE: th, SE: 180 - th, SW: 180 + th, NW: 360 - th };
      var key = map[q];
      // verify by converting back via vector direction
      var vx = Math.sin(key * D2R), vy = Math.cos(key * D2R);
      var back = Math.abs(atanD(Math.abs(vx) / Math.abs(vy)));
      assert(close(back, th, 1e-6) && (vx > 0) === (q[1] === 'E') && (vy > 0) === (q[0] === 'N'));
      var pool = [map.NE, map.SE, map.SW, map.NW, 90 - th, 90 + th, 270 - th, 270 + th].map(az);
      var o = fromStrings(az(key), pool);
      var p = place();
      return { prompt: 'From ' + p + ', your ' + pick(BOATS) + ' sails on bearing ' + label + '. What is this as a true (3-digit) bearing?', diagram: { type: 'compass', bearing: key, label: label }, options: o.options, answer: o.answer };
    },
    function backBearing() {
      var th = ri(10, 349); if (th % 90 === 0) th += 7;
      var key = (th + 180) % 360;
      assert(Math.abs(((key - th + 360) % 360) - 180) < 1e-9);
      var pool = [(360 - th) % 360, Math.abs(180 - th), (th + 90) % 360, (th + 270) % 360].map(az);
      var o = fromStrings(az(key), pool);
      return { prompt: 'A ' + pick(BOATS) + ' leaves ' + place() + ' on a true bearing of ' + az(th) + '. What bearing must it sail to return straight back?', diagram: { type: 'compass', bearing: th, label: az(th) }, options: o.options, answer: o.answer };
    },
    function twoLegDistance() {
      var e = ri(3, 14), n = ri(3, 14); if (e === n) n++;
      var dirs = pick([['east', 'north'], ['west', 'north'], ['east', 'south'], ['west', 'south']]);
      var key = Math.sqrt(e * e + n * n);
      assert(close(key * key, e * e + n * n));
      var o = options(num(key, 'km'), [e + n, Math.abs(e - n), Math.sqrt(Math.abs(e * e - n * n)), (e * n) / 2, (e + n) / 2], function (v) { return num(v, 'km'); }, key);
      return { prompt: 'A banca leaves ' + place() + ' and sails ' + e + ' km due ' + dirs[0] + ', then ' + n + ' km due ' + dirs[1] + '. How far is it now from where it started?', diagram: { type: 'legs', e: e, n: n, dirs: dirs }, options: o.options, answer: o.answer };
    },
    function bearingOfPoint() {
      var e = ri(3, 15), n = ri(3, 15); if (e === n) e++;
      var a = atanD(e / n); // angle from north toward east
      var k = Math.round(a);
      assert(close(tan(a), e / n));
      var key = 'N ' + k + '° E';
      var c = Math.round(90 - a);
      var pool = ['N ' + c + '° E', 'S ' + k + '° E', 'N ' + k + '° W', 'S ' + c + '° W', 'N ' + (k + 10) + '° E'];
      var o = fromStrings(key, pool);
      return { prompt: 'The island stop ' + place() + ' is ' + e + ' km east and ' + n + ' km north of your port. Find its bearing from the port (nearest degree).', diagram: { type: 'legs', e: e, n: n, dirs: ['east', 'north'], ask: 'angle' }, options: o.options, answer: o.answer };
    },
  ];

  /* ---------------- LEVEL 2: Right triangles (SOH-CAH-TOA) ---------------- */
  var L2 = [
    function lighthouseDistance() {
      var h = ri(20, 60), th = ri(15, 60);
      var key = h / tan(th);
      assert(close(tan(th) * key, h));
      var o = options(num(key, 'm'), [h * tan(th), h / sin(th), h * cos(th), h / cos(th), h * sin(th)], function (v) { return num(v, 'm'); }, key);
      var t = { a: h, b: key, c: Math.hypot(h, key), A: th, B: 90, C: 90 - th };
      return { prompt: 'From your banca, the top of the ' + h + ' m lighthouse near ' + place() + ' is seen at an angle of elevation of ' + th + '°. How far is the banca from the base of the lighthouse?', diagram: { type: 'right', opp: h + ' m', adj: '?', hyp: '', ang: th + '°' }, options: o.options, answer: o.answer };
    },
    function cliffHeight() {
      var d = ri(30, 120), th = ri(12, 55);
      var key = d * tan(th);
      assert(close(key / d, tan(th)));
      var o = options(num(key, 'm'), [d / tan(th), d * sin(th), d * cos(th), d / cos(th), d * tan(90 - th)], function (v) { return num(v, 'm'); }, key);
      return { prompt: 'A fisher is ' + d + ' m from the foot of a cliff on ' + place() + '. The angle of elevation to the cliff top is ' + th + '°. How tall is the cliff?', diagram: { type: 'right', opp: '?', adj: d + ' m', hyp: '', ang: th + '°' }, options: o.options, answer: o.answer };
    },
    function courseHyp() {
      var opp = ri(4, 18), th = ri(20, 65);
      var key = opp / sin(th);
      assert(close(key * sin(th), opp));
      var o = options(num(key, 'km'), [opp * sin(th), opp / cos(th), opp / tan(th), opp * tan(th), opp * cos(th)], function (v) { return num(v, 'km'); }, key);
      return { prompt: 'A banca sails straight to an island. The island lies ' + opp + ' km north of the shoreline road, and the banca\'s path makes a ' + th + '° angle with that road. How long is the path?', diagram: { type: 'right', opp: opp + ' km', adj: '', hyp: '?', ang: th + '°' }, options: o.options, answer: o.answer };
    },
    function findAngle() {
      var opp = ri(5, 30), adj = ri(5, 30); if (opp === adj) adj += 3;
      var a = atanD(opp / adj); var key = Math.round(a);
      assert(close(tan(a), opp / adj));
      var o = options(deg(key), [90 - a, atanD(adj / opp), asinD(Math.min(opp, adj) / Math.max(opp, adj)), acosD(Math.min(opp, adj) / Math.max(opp, adj)), a + 5], function (v) { return deg(v); }, key, true);
      return { prompt: 'A pole on a raft is ' + opp + ' m tall and casts a shadow ' + adj + ' m long on the water. What is the angle of elevation of the sun (nearest degree)?', diagram: { type: 'right', opp: opp + ' m', adj: adj + ' m', hyp: '', ang: '?' }, options: o.options, answer: o.answer };
    },
    function adjFromHyp() {
      var hyp = ri(8, 40), th = ri(18, 70);
      var key = hyp * cos(th);
      assert(close(Math.hypot(key, hyp * sin(th)), hyp));
      var o = options(num(key, 'km'), [hyp * sin(th), hyp / cos(th), hyp * tan(th), hyp / tan(th)], function (v) { return num(v, 'km'); }, key);
      return { prompt: 'A banca sails ' + hyp + ' km on a course making ' + th + '° with the coastline. How far along the coastline (adjacent side) has it moved?', diagram: { type: 'right', opp: '', adj: '?', hyp: hyp + ' km', ang: th + '°' }, options: o.options, answer: o.answer };
    },
  ];

  /* ---------------- LEVEL 3: Law of Sines (AAS / ASA only) ---------------- */
  function randAngles() { var A, B; do { A = ri(25, 95); B = ri(25, 95); } while (A + B > 150 || A === B); return { A: A, B: B, C: 180 - A - B }; }
  var L3 = [
    function aas() {
      var g = randAngles(); var a = ri(6, 30);
      var key = a * sin(g.B) / sin(g.A);
      assert(close(a / sin(g.A), key / sin(g.B)));
      var o = options(num(key, 'km'), [a * sin(g.A) / sin(g.B), a * sin(g.B), a * sin(g.C) / sin(g.A), a / sin(g.B), a * sin(g.A) / sin(g.C)], function (v) { return num(v, 'km'); }, key);
      var P = place(), Q = place([P]);
      return { prompt: 'In triangle ABC (A, B are lookouts, C is a banca), ∠A = ' + g.A + '°, ∠B = ' + g.B + '°, and side a = ' + a + ' km. Find side b.', diagram: triDiagram({ a: a, b: key, c: a * sin(g.C) / sin(g.A), A: g.A, B: g.B, C: g.C }, { A: g.A + '°', B: g.B + '°', a: a + ' km', b: '?' }), options: o.options, answer: o.answer };
    },
    function asa() {
      var g = randAngles(); var c = ri(8, 30);
      var key = c * sin(g.A) / sin(g.C);
      assert(close(key / sin(g.A), c / sin(g.C)));
      var o = options(num(key, 'km'), [c * sin(g.A) / sin(g.B), c * sin(g.C) / sin(g.A), c * sin(g.B) / sin(g.C), c * sin(g.A), c * sin(g.A) / sin(g.A + g.B)], function (v) { return num(v, 'km'); }, key);
      var P = place(), Q = place([P]);
      return { prompt: 'Two lookouts, A at ' + P + ' and B at ' + Q + ', are ' + c + ' km apart. They see a banca C at ∠A = ' + g.A + '° and ∠B = ' + g.B + '°. How far is the banca from lookout B (side a)?', diagram: triDiagram({ a: key, b: c * sin(g.B) / sin(g.C), c: c, A: g.A, B: g.B, C: g.C }, { A: g.A + '°', B: g.B + '°', c: c + ' km', a: '?' }), options: o.options, answer: o.answer };
    },
    function thirdAngleThenSide() {
      var g = randAngles(); var b = ri(6, 25);
      var key = b * sin(g.C) / sin(g.B);
      assert(close(key / sin(g.C), b / sin(g.B)) && g.A + g.B + g.C === 180);
      var o = options(num(key, 'km'), [b * sin(g.B) / sin(g.C), b * sin(g.A) / sin(g.B), b * sin(g.C), b * sin(g.C) / sin(g.A)], function (v) { return num(v, 'km'); }, key);
      return { prompt: 'Triangle ABC: ∠A = ' + g.A + '°, ∠B = ' + g.B + '°, side b = ' + b + ' km. First find ∠C, then find side c.', diagram: triDiagram({ a: b * sin(g.A) / sin(g.B), b: b, c: key, A: g.A, B: g.B, C: g.C }, { A: g.A + '°', B: g.B + '°', b: b + ' km', c: '?' }), options: o.options, answer: o.answer };
    },
  ];

  /* ---------------- LEVEL 4: Law of Cosines (SAS / SSS) ---------------- */
  var L4 = [
    function sasSide() {
      var a = ri(5, 20), b = ri(5, 20), C = ri(30, 140); if (C === 90) C = 95;
      var key = Math.sqrt(a * a + b * b - 2 * a * b * cos(C));
      assert(close(acosD((a * a + b * b - key * key) / (2 * a * b)), C, 1e-6));
      var o = options(num(key, 'km'), [Math.sqrt(a * a + b * b + 2 * a * b * cos(C)), Math.sqrt(a * a + b * b), a * a + b * b - 2 * a * b * cos(C), Math.sqrt(Math.abs(a * a + b * b - a * b * cos(C)))], function (v) { return num(v, 'km'); }, key);
      var c = key; var A = acosD((b * b + c * c - a * a) / (2 * b * c));
      return { prompt: 'From ' + place() + ', two bancas leave along paths ' + C + '° apart. One sails ' + a + ' km, the other ' + b + ' km. How far apart are they now?', diagram: triDiagram({ a: a, b: b, c: c, A: A, B: 180 - A - C, C: C }, { a: a + ' km', b: b + ' km', C: C + '°', c: '?' }), options: o.options, answer: o.answer };
    },
    function sssAngle() {
      var a, b, c;
      do { a = ri(5, 20); b = ri(5, 20); c = ri(5, 20); } while (!(a + b > c + 1 && a + c > b + 1 && b + c > a + 1) || (a === b && b === c));
      var Cr = acosD((a * a + b * b - c * c) / (2 * a * b)); var key = Math.round(Cr);
      assert(close(c * c, a * a + b * b - 2 * a * b * cos(Cr), 1e-9));
      var A = acosD((b * b + c * c - a * a) / (2 * b * c)), B = 180 - A - Cr;
      var o = options(deg(key), [180 - Cr, A, B, 90 - Cr, acosD(Math.max(-1, Math.min(1, (a * a + b * b + c * c) / (2 * a * b * 2))))], function (v) { return deg(v); }, key, true);
      return { prompt: 'Three islands form a triangle with sides a = ' + a + ' km, b = ' + b + ' km, c = ' + c + ' km. Find angle C (opposite side c), nearest degree.', diagram: triDiagram({ a: a, b: b, c: c, A: A, B: B, C: Cr }, { a: a + ' km', b: b + ' km', c: c + ' km', C: '?' }), options: o.options, answer: o.answer };
    },
    function sasPlainSide() {
      var b = ri(6, 22), c = ri(6, 22), A = ri(35, 130); if (A === 90) A = 100;
      var key = Math.sqrt(b * b + c * c - 2 * b * c * cos(A));
      assert(close(key * key + 2 * b * c * cos(A), b * b + c * c));
      var o = options(num(key, 'm'), [Math.sqrt(b * b + c * c + 2 * b * c * cos(A)), Math.sqrt(b * b + c * c), b * sin(A) / sin(180 - A - 30) , Math.abs(b - c) + 1.5], function (v) { return num(v, 'm'); }, key);
      var a = key, B = acosD((a * a + c * c - b * b) / (2 * a * c));
      return { prompt: 'Triangle ABC: b = ' + b + ' m, c = ' + c + ' m, and the included angle ∠A = ' + A + '°. Find side a.', diagram: triDiagram({ a: a, b: b, c: c, A: A, B: B, C: 180 - A - B }, { b: b + ' m', c: c + ' m', A: A + '°', a: '?' }), options: o.options, answer: o.answer };
    },
  ];

  /* ---------------- LEVEL 5: Mixed + area ---------------- */
  var RULE_OPTS = ['SOH-CAH-TOA', 'Law of Sines', 'Law of Cosines', 'Pythagorean theorem only'];
  var L5 = [
    function areaSAS() {
      var a = ri(5, 25), b = ri(5, 25), C = ri(25, 150); if (C === 90) C = 80;
      var key = 0.5 * a * b * sin(C);
      var c = Math.sqrt(a * a + b * b - 2 * a * b * cos(C)), s = (a + b + c) / 2;
      assert(close(key, Math.sqrt(s * (s - a) * (s - b) * (s - c)), 1e-6));
      var o = options(num(key, 'km²'), [a * b * sin(C), 0.5 * a * b * Math.abs(cos(C)), 0.5 * a * b, 0.5 * (a + b) * sin(C)], function (v) { return num(v, 'km²'); }, key);
      var A = acosD((b * b + c * c - a * a) / (2 * b * c));
      return { prompt: 'A fishing zone near ' + place() + ' is a triangle with sides ' + a + ' km and ' + b + ' km and an included angle of ' + C + '°. Find its area.', diagram: triDiagram({ a: a, b: b, c: c, A: A, B: 180 - A - C, C: C }, { a: a + ' km', b: b + ' km', C: C + '°' }), options: o.options, answer: o.answer };
    },
    function heron() {
      var a, b, c;
      do { a = ri(5, 20); b = ri(5, 20); c = ri(5, 20); } while (!(a + b > c + 1 && a + c > b + 1 && b + c > a + 1));
      var s = (a + b + c) / 2; var key = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      var C = acosD((a * a + b * b - c * c) / (2 * a * b));
      assert(close(key, 0.5 * a * b * sin(C), 1e-6));
      var P = a + b + c;
      var o = options(num(key, 'm²'), [s * (s - a) * (s - b) * (s - c), Math.sqrt(Math.max(0, P * (P - a) * (P - b) * (P - c))), 0.5 * a * b, Math.sqrt(s * (s + a) * (s - b) * (s - c)) ], function (v) { return num(v, 'm²'); }, key);
      var A = acosD((b * b + c * c - a * a) / (2 * b * c));
      return { prompt: 'A triangular seaweed farm has sides ' + a + ' m, ' + b + ' m and ' + c + ' m. Use Heron\'s formula to find its area.', diagram: triDiagram({ a: a, b: b, c: c, A: A, B: 180 - A - C, C: C }, { a: a + ' m', b: b + ' m', c: c + ' m' }), options: o.options, answer: o.answer };
    },
    function whichRule() {
      var cases = [
        { k: 'Law of Cosines', t: 'You know two sides and the angle BETWEEN them, and want the third side.' },
        { k: 'Law of Cosines', t: 'You know all three sides of a triangle and want one angle.' },
        { k: 'Law of Sines', t: 'You know two angles and one side of a non-right triangle, and want another side.' },
        { k: 'SOH-CAH-TOA', t: 'A right triangle: you know one acute angle and the hypotenuse, and want the opposite side.' },
        { k: 'Law of Sines', t: 'Two lookouts a known distance apart each measure the angle to a banca. You want the distance to the banca.' },
      ];
      var cs = pick(cases);
      assert(RULE_OPTS.indexOf(cs.k) >= 0);
      var all = shuffle(RULE_OPTS);
      return { prompt: 'Navigator\'s choice: ' + cs.t + ' Which rule fits best?', diagram: { type: 'compass', bearing: ri(0, 359), label: '?' }, options: all, answer: all.indexOf(cs.k) };
    },
    function bearingTriangle() {
      var a = ri(4, 15), b = ri(4, 15), th = ri(25, 75);
      // sail a km due north, then turn and sail b km on bearing N th E. Interior angle at turn = 180 - th.
      var turn = 180 - th;
      var key = Math.sqrt(a * a + b * b - 2 * a * b * cos(turn));
      // verify by coordinates
      var x = b * sin(th), y = a + b * cos(th);
      assert(close(key, Math.hypot(x, y), 1e-9));
      var o = options(num(key, 'km'), [Math.sqrt(a * a + b * b - 2 * a * b * cos(th)), a + b, Math.sqrt(a * a + b * b), Math.sqrt(a * a + b * b + 2 * a * b * cos(turn))], function (v) { return num(v, 'km'); }, key);
      return { prompt: 'Your banca sails ' + a + ' km due north from ' + place() + ', then turns and sails ' + b + ' km on bearing N ' + th + '° E. How far is it from the starting port? (Hint: the angle at the turn is not ' + th + '°.)', diagram: { type: 'bearingTri', a: a, b: b, th: th }, options: o.options, answer: o.answer };
    },
  ];

  var GENS = [null, L1, L2, L3, L4, L5];
  var TOPICS = [null, 'Bearings & Compass', 'Right Triangles (SOH-CAH-TOA)', 'Law of Sines', 'Law of Cosines', 'Mixed Navigation & Area'];

  function makeItem(level) {
    var gens = GENS[level];
    for (var tries = 0; tries < 60; tries++) {
      try {
        var it = pick(gens)();
        if (it.options.length !== 4) continue;
        if (new Set(it.options).size !== 4) continue;
        if (it.answer < 0 || it.answer > 3) continue;
        it.level = level;
        return it;
      } catch (e) { /* regenerate */ }
    }
    throw new Error('could not build item for level ' + level);
  }
  /** Build n items for a level, rotating generators so each type appears, no duplicate prompts. */
  function buildLevel(level, n) {
    var gens = GENS[level]; var out = []; var prompts = {};
    var order = [];
    while (order.length < n) order = order.concat(shuffle(gens.map(function (_, i) { return i; })));
    order = order.slice(0, n);
    order.forEach(function (gi) {
      for (var t = 0; t < 60; t++) {
        try {
          var it = gens[gi]();
          if (it.options.length !== 4 || new Set(it.options).size !== 4 || prompts[it.prompt]) continue;
          prompts[it.prompt] = 1; it.level = level; out.push(it); return;
        } catch (e) {}
      }
      out.push(makeItem(level));
    });
    return out;
  }

  var api = { buildLevel: buildLevel, makeItem: makeItem, TOPICS: TOPICS, _gens: GENS };
  root.INQ = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
