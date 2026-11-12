/* Island Navigator — bearings & triangle-solving sailing game. Bago NHS · ADM. */
(function () {
  'use strict';

  const API_NS = 'bnhs-inavigator-nov2026';
  const API = 'https://mantledb.sh/v2/' + API_NS;
  const API_EXPORT = 'https://mantledb.sh/v2/export/' + API_NS;
  const ADM_API =
    'https://script.google.com/macros/s/AKfycbwGMSP8NmPT4GYMJZTw4qruizfFd5wzORZHZRM-HOUJOSQyyg3Gx20L5MEWsqT5EFdl-w/exec';

  const LEVELS = 5;
  const ITEMS = 8;
  const LIVES = 3;
  const MAX_ATTEMPTS = 1;
  const BASE_PTS = [0, 10, 15, 20, 25, 30];
  const ITEM_SEC = [0, 35, 40, 45, 45, 45];
  const TIME_BONUS_MAX = 5;
  const MAX_PLAUSIBLE = 1500; // theoretical max = 8*(10+15+20+25+30) + 40*5 = 1000
  const DEMO =
    /(?:\?|&)(?:demo|test)=1(?:&|$)/.test(location.search || '') ||
    location.hash === '#demo';

  // ---- Web Audio: sea / wind motif ----
  const Sound = (function () {
    let ctx = null, master = null, musicTimer = null, waveNode = null;
    let enabled = localStorage.getItem('in-sound') !== '0';
    function ensure() {
      if (ctx) return ctx;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }
    function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(function () {}); }
    function paintBtn() { const b = document.getElementById('btn-sound'); if (b) b.textContent = enabled ? '🔊 On' : '🔇 Off'; }
    function setEnabled(on) { enabled = on; localStorage.setItem('in-sound', on ? '1' : '0'); paintBtn(); if (!on) stopMusic(); else if (lastLv) startMusic(lastLv); }
    function toggle() { unlock(); setEnabled(!enabled); }
    function tone(freq, dur, type, gain, when) {
      const c = ensure(); if (!c || !enabled) return;
      const t = when || c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    function ding() { const c = ensure(); if (!c || !enabled) return; const t = c.currentTime; tone(784, 0.18, 'triangle', 0.25, t); tone(1175, 0.3, 'sine', 0.2, t + 0.09); }
    function buzz() { const c = ensure(); if (!c || !enabled) return; const t = c.currentTime; tone(150, 0.3, 'sawtooth', 0.12, t); tone(110, 0.35, 'sawtooth', 0.1, t + 0.12); }
    function levelUp() { const c = ensure(); if (!c || !enabled) return; const t = c.currentTime; [392, 523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.2, t + i * 0.09); }); }
    function waves() { // soft filtered noise "sea"
      const c = ensure(); if (!c || !enabled || waveNode) return;
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = c.createGain(); g.gain.value = 0.05;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.04;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      src.connect(f); f.connect(g); g.connect(master); src.start();
      waveNode = { src: src, lfo: lfo };
    }
    let lastLv = 0;
    function stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (waveNode) { try { waveNode.src.stop(); waveNode.lfo.stop(); } catch (e) {} waveNode = null; }
    }
    function startMusic(lv) {
      lastLv = lv || 1; stopMusic(); if (!enabled) return; waves();
      const scale = [294, 330, 392, 440, 494, 587];
      let i = 0;
      musicTimer = setInterval(function () {
        const c = ensure(); if (!c || !enabled) return;
        const n = scale[(i * 3 + lastLv) % scale.length]; i++;
        tone(n, 0.9, 'sine', 0.05);
      }, 1400);
    }
    return { unlock: unlock, ding: ding, buzz: buzz, levelUp: levelUp, startMusic: startMusic, stopMusic: stopMusic, toggle: toggle, paintBtn: paintBtn };
  })();

  function $(id) { return document.getElementById(id); }
  const screens = {
    start: $('screen-start'),
    game: $('screen-game'),
    summary: $('screen-summary'),
    board: $('screen-board'),
  };
  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('active', k === name);
    });
  }

  let learners = [];
  let player = { name: '', grade: '', section: '' };
  let progress = blankProgress();
  let attempt = null;
  let run = null;
  let raf = 0;
  let shakeT = 0;
  let particles = [];

  function blankProgress() {
    return { attemptsUsed: 0, bestTotal: 0, bestLevel: 0, attemptScores: [] };
  }
  function keyOf(p) {
    return norm(p.name) + '-g' + String(p.grade).replace(/\D/g, '');
  }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 48) || 'anon';
  }
  function gradeNum(g) {
    const m = String(g || '').match(/(\d+)/);
    return m ? m[1] : String(g);
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem('in-progress-' + keyOf(player));
      if (raw) {
        const p = JSON.parse(raw);
        progress.attemptsUsed = Math.max(0, Number(p.attemptsUsed) || 0);
        progress.bestTotal = Math.max(0, Number(p.bestTotal) || 0);
        progress.bestLevel = Math.max(0, Number(p.bestLevel) || 0);
        progress.attemptScores = Array.isArray(p.attemptScores) ? p.attemptScores : [];
        if (p.openAttempt && typeof p.openAttempt === 'object') {
          progress.openAttempt = {
            num: Math.max(1, Number(p.openAttempt.num) || 1),
            score: Math.max(0, Number(p.openAttempt.score) || 0),
            bestLevel: Math.max(0, Number(p.openAttempt.bestLevel) || 0),
            totalCorrect: Math.max(0, Number(p.openAttempt.totalCorrect) || 0),
            nextLevel: clampLevel(p.openAttempt.nextLevel),
            awaitingNext: !!p.openAttempt.awaitingNext,
          };
        } else {
          clearOpenAttempt();
        }
      }
    } catch (e) {}
  }
  function saveLocal() {
    try {
      localStorage.setItem('in-progress-' + keyOf(player), JSON.stringify(progress));
    } catch (e) {}
  }


  function clampLevel(n) {
    n = Math.max(1, Math.min(LEVELS, Number(n) || 1));
    return n | 0;
  }

  function clearOpenAttempt() {
    if (progress && progress.openAttempt) delete progress.openAttempt;
  }

  /** Persist in-progress attempt. Mid-level: keep banked score only (restart that level). */
  function snapshotOpenAttempt(opts) {
    opts = opts || {};
    if (DEMO || !attempt || !attempt.active || !player || !player.name) return;
    var nextLevel = opts.nextLevel != null ? opts.nextLevel : 1;
    var awaitingNext = !!opts.awaitingNext;
    progress.openAttempt = {
      num: attempt.num,
      score: Math.max(0, Number(attempt.score) || 0),
      bestLevel: Math.max(0, Number(attempt.bestLevel) || 0),
      totalCorrect: Math.max(0, Number(attempt.totalCorrect) || 0),
      nextLevel: clampLevel(nextLevel),
      awaitingNext: awaitingNext,
    };
    saveLocal();
  }

  function persistOpenAttemptOnHide() {
    if (DEMO || !attempt || !attempt.active) return;
    if (run && run.over) {
      if (run.level < LEVELS) {
        snapshotOpenAttempt({ nextLevel: run.level + 1, awaitingNext: true });
      }
    } else if (run && !run.over) {
      snapshotOpenAttempt({ nextLevel: run.level, awaitingNext: false });
    } else {
      snapshotOpenAttempt({ nextLevel: 1, awaitingNext: false });
    }
  }


  async function fetchRemoteRecord() {
    try {
      const r = await fetch(API + '/scores/' + keyOf(player) + '?t=' + Date.now());
      if (!r.ok) return null;
      const j = await r.json();
      if (j && j.error) return null;
      if (j && j.name) return j;
      return null;
    } catch (e) { return null; }
  }
  function mergeRemote(rec) {
    if (!rec) return;
    const keepOpen = progress.openAttempt;
    progress.attemptsUsed = Math.max(progress.attemptsUsed, Math.max(0, Number(rec.attempts) || 0));
    progress.bestTotal = Math.max(progress.bestTotal, Math.max(0, Number(rec.total) || 0));
    progress.bestLevel = Math.max(progress.bestLevel, Math.max(0, Number(rec.bestLevel) || 0));
    if (Array.isArray(rec.attemptScores) && rec.attemptScores.length) {
      const set = new Set(progress.attemptScores.concat(rec.attemptScores.map(Number)));
      progress.attemptScores = [...set].filter(function (n) { return Number.isFinite(n); });
    }
    if (progress.attemptsUsed >= MAX_ATTEMPTS) {
      clearOpenAttempt();
    } else if (keepOpen) {
      progress.openAttempt = keepOpen;
    }
    saveLocal();
  }
  async function fetchBoard() {
    try {
      const r = await fetch(API_EXPORT + '?t=' + Date.now());
      const j = await r.json();
      const entries = [];
      const bag = (j && j.entries) || {};
      Object.keys(bag).forEach(function (path) {
        if (path.indexOf('scores/') === 0 && bag[path] && bag[path].name) entries.push(bag[path]);
      });
      return entries.filter(function (e) { return Number(e.total) <= MAX_PLAUSIBLE; });
    } catch (e) {
      try { return JSON.parse(localStorage.getItem('in-local-board') || '[]'); }
      catch (e2) { return []; }
    }
  }
  async function submitRecord(entry) {
    const local = JSON.parse(localStorage.getItem('in-local-board') || '[]');
    const idx = local.findIndex(function (e) {
      return norm(e.name) === norm(entry.name) && String(e.grade) === String(entry.grade);
    });
    if (idx >= 0) local[idx] = entry; else local.push(entry);
    localStorage.setItem('in-local-board', JSON.stringify(local));
    try {
      const path = API + '/scores/' + keyOf(entry);
      let best = Object.assign({}, entry);
      try {
        const prev = await (await fetch(path + '?t=' + Date.now())).json();
        if (prev && prev.name) {
          best.total = Math.max(Number(prev.total) || 0, Number(entry.total) || 0);
          best.bestLevel = Math.max(Number(prev.bestLevel) || 0, Number(entry.bestLevel) || 0);
          best.attempts = Math.min(MAX_ATTEMPTS, Math.max(Number(prev.attempts) || 0, Number(entry.attempts) || 0));
          const scores = []
            .concat(Array.isArray(prev.attemptScores) ? prev.attemptScores : [])
            .concat(Array.isArray(entry.attemptScores) ? entry.attemptScores : [])
            .map(Number).filter(function (n) { return Number.isFinite(n); });
          best.attemptScores = [...new Set(scores)].slice(-4);
          if ((Number(prev.attempts) || 0) >= MAX_ATTEMPTS) {
            best.attempts = MAX_ATTEMPTS;
            if (Array.isArray(prev.attemptScores) && prev.attemptScores.length >= MAX_ATTEMPTS) {
              best.attemptScores = prev.attemptScores.slice(0, MAX_ATTEMPTS);
            }
          }
          if ((Number(prev.total) || 0) > (Number(entry.total) || 0)) {
            best.name = prev.name;
            best.section = prev.section || entry.section;
          }
        }
      } catch (e) {}
      if (Number(best.total) > MAX_PLAUSIBLE) return false;
      best.attempts = Math.min(MAX_ATTEMPTS, Math.max(0, Number(best.attempts) || 0));
      const postRes = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(best),
      });
      if (!postRes || !postRes.ok) return false;
      try { const pj = await postRes.clone().json(); if (pj && pj.success === false) return false; } catch (e) {}
      return true;
    } catch (e) { return false; }
  }


  /* ---- Reliable upload: pending queue + retry (added Nov 6 2026) ---- */
  var remoteConfirmed = false;
  function pendingKey(p) { return 'in-pending-' + keyOf(p); }
  function setPending(entry) {
    if (DEMO) return;
    try { localStorage.setItem(pendingKey(entry), JSON.stringify(entry)); } catch (e) {}
  }
  function clearPending(entry) {
    try { localStorage.removeItem(pendingKey(entry)); } catch (e) {}
  }
  function hasPending() {
    try { return !!(player && localStorage.getItem(pendingKey(player))); } catch (e) { return false; }
  }
  function sleepMs(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function submitWithRetry(entry) {
    if (DEMO) return false;
    var waits = [0, 1500, 4000, 9000];
    for (var i = 0; i < waits.length; i++) {
      if (waits[i]) await sleepMs(waits[i]);
      var ok = false;
      try { ok = await submitRecord(entry); } catch (e) { ok = false; }
      if (ok) { clearPending(entry); remoteConfirmed = true; return true; }
    }
    return false;
  }
  var flushing = false;
  async function flushPending() {
    if (DEMO || flushing) return;
    flushing = true;
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('in-pending-') === 0) keys.push(k);
      }
      for (var j = 0; j < keys.length; j++) {
        var e = null;
        try { e = JSON.parse(localStorage.getItem(keys[j]) || 'null'); } catch (x) {}
        if (!e || !e.name) { localStorage.removeItem(keys[j]); continue; }
        await submitWithRetry(e);
      }
    } finally { flushing = false; }
    try { if (keys.length && player && progress) paintLobby(); } catch (e) {}
  }
  function afterRemote(rec) {
    if (DEMO || !player) return;
    remoteConfirmed = !!(rec && rec.name && Number(rec.total) >= Number(progress.bestTotal || 0) && Number(rec.attempts) >= 1);
    // Heal old phones: try used locally but no confirmed server row -> queue upload.
    if (!remoteConfirmed && progress.attemptsUsed >= MAX_ATTEMPTS && !hasPending()) {
      setPending({
        name: player.name, grade: player.grade, section: player.section || '',
        total: progress.bestTotal, bestLevel: progress.bestLevel,
        attempts: progress.attemptsUsed, attemptScores: (progress.attemptScores || []).slice(-4),
        ts: Date.now(),
      });
    }
    if (hasPending()) flushPending();
  }
  function boardNote() {
    if (hasPending()) return 'Saved on this phone only — not yet on the leaderboard. It will upload automatically when you are online (reopen this page with internet).';
    if (remoteConfirmed) return 'That score is on the leaderboard.';
    return 'Checking the leaderboard… open this page with internet to confirm.';
  }
  if (!DEMO) {
    window.addEventListener('online', function () { flushPending(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) flushPending(); });
    setInterval(function () { if (navigator.onLine !== false) flushPending(); }, 30000);
    setTimeout(flushPending, 1500);
  }

  const MEDALS = ['', '🥇', '🥈', '🥉'];
  function sortBoard(list) {
    return list.slice().sort(function (a, b) {
      const pt = Number(b.total) - Number(a.total);
      if (pt) return pt;
      const lv = Number(b.bestLevel || 0) - Number(a.bestLevel || 0);
      if (lv) return lv;
      const ta = Number(a.ts) || Number.MAX_SAFE_INTEGER;
      const tb = Number(b.ts) || Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderBoard(entries, filter) {
    const tb = $('board-body');
    tb.innerHTML = '';
    let list = entries.slice();
    if (filter === '11' || filter === '12') {
      list = list.filter(function (e) { return String(e.grade) === filter; });
    }
    list = sortBoard(list);
    var isGrade = (filter === '11' || filter === '12');
    var shown = isGrade ? list : list.slice(0, 10);
    var cap = document.getElementById('board-caption');
    if (cap) {
      if (!list.length) {
        cap.textContent = isGrade ? ('Grade ' + filter + ' · no scores yet') : 'Overall · no scores yet';
      } else if (isGrade) {
        cap.textContent = 'Grade ' + filter + ' · all ' + list.length + ' player' + (list.length === 1 ? '' : 's');
      } else {
        cap.textContent = 'Overall · Top 10' + (list.length > 10 ? ' of ' + list.length : '');
      }
    }
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="5" class="muted">No scores yet</td></tr>';
      return;
    }
    shown.forEach(function (e, i) {
      const rank = i + 1;
      const tr = document.createElement('tr');
      if (rank <= 3) tr.className = 'rank-' + rank;
      const medal = MEDALS[rank] || '';
      const gs = 'G' + esc(e.grade) + (e.section ? ' · ' + esc(e.section) : '');
      tr.innerHTML =
        '<td class="rank-cell">' + (medal ? medal + ' ' : '') + rank + '</td>' +
        '<td>' + esc(e.name) + '</td>' +
        '<td class="gs">' + gs + '</td>' +
        '<td class="pts">' + Number(e.total) + '</td>' +
        '<td class="lvl">L' + Number(e.bestLevel || 0) + '</td>';
      tb.appendChild(tr);
    });
  }

  // ---- Master list ----
  async function loadLearners() {
    const status = $('load-status');
    try {
      const r = await fetch(ADM_API + '?action=config&t=' + Date.now());
      const j = await r.json();
      learners = Array.isArray(j.learners) ? j.learners.filter(function (x) { return x && x.n && x.g && x.s; }) : [];
      if (!learners.length) {
        status.textContent = 'Class list empty — ask your teacher.';
        return;
      }
      const grades = [...new Set(learners.map(function (x) { return gradeNum(x.g); }))].sort();
      const gSel = $('inp-grade');
      gSel.innerHTML = '<option value="">Select grade</option>';
      grades.forEach(function (g) {
        const o = document.createElement('option');
        o.value = g; o.textContent = 'Grade ' + g;
        gSel.appendChild(o);
      });
      const g11 = learners.filter(function (x) { return gradeNum(x.g) === '11'; }).length;
      const g12 = learners.filter(function (x) { return gradeNum(x.g) === '12'; }).length;
      status.textContent = 'Loaded ' + learners.length + ' learners (G11: ' + g11 + ', G12: ' + g12 + ').';
      $('btn-play').disabled = true;
    } catch (e) {
      status.textContent = 'Could not load class list. Check connection / try again.';
      $('inp-grade').innerHTML = '<option value="">Unavailable</option>';
    }
  }
  function fillSections() {
    const g = $('inp-grade').value;
    const sSel = $('inp-section'), nSel = $('inp-name');
    nSel.innerHTML = '<option value="">Select section first</option>';
    nSel.disabled = true;
    $('btn-play').disabled = true;
    if (!g) {
      sSel.innerHTML = '<option value="">Select grade first</option>';
      sSel.disabled = true;
      return;
    }
    const secs = [...new Set(learners.filter(function (x) { return gradeNum(x.g) === g; }).map(function (x) { return x.s; }))].sort();
    sSel.innerHTML = '<option value="">Select section</option>';
    secs.forEach(function (s) {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      sSel.appendChild(o);
    });
    sSel.disabled = false;
  }
  function fillNames() {
    const g = $('inp-grade').value, s = $('inp-section').value;
    const nSel = $('inp-name');
    $('btn-play').disabled = true;
    if (!g || !s) {
      nSel.innerHTML = '<option value="">Select section first</option>';
      nSel.disabled = true;
      return;
    }
    const names = learners.filter(function (x) { return gradeNum(x.g) === g && x.s === s; })
      .map(function (x) { return x.n; }).sort(function (a, b) { return a.localeCompare(b); });
    nSel.innerHTML = '<option value="">Select your name</option>';
    names.forEach(function (n) {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      nSel.appendChild(o);
    });
    nSel.disabled = false;
  }
  $('inp-grade').onchange = fillSections;
  $('inp-section').onchange = fillNames;
  $('inp-name').onchange = function () { $('btn-play').disabled = !$('inp-name').value; };

  // ---------------- Gameplay (DOM + SVG) ----------------
  let timerRaf = 0;
  function startLevel(level) {
    level = clampLevel(level);
    run = {
      level: level, items: INQ.buildLevel(level, ITEMS), qIndex: 0, lives: LIVES,
      score: 0, correct: 0, over: false, endedByLives: false, locked: false, t0: 0,
    };
    $('hud-topic').textContent = 'Level ' + level + ' · ' + INQ.TOPICS[level];
    show('game');
    Sound.startMusic(level);
    if (!DEMO && attempt && attempt.active) snapshotOpenAttempt({ nextLevel: level, awaitingNext: false });
    paintScene();
    showItem();
  }
  function cur() { return run.items[run.qIndex]; }
  function showItem() {
    const it = cur();
    run.locked = false;
    $('q-prompt').textContent = it.prompt;
    $('q-diagram').innerHTML = Diagram.render(it.diagram);
    const box = $('q-choices'); box.innerHTML = '';
    it.options.forEach(function (opt, i) {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button';
      b.textContent = String.fromCharCode(65 + i) + '.  ' + opt;
      b.onclick = function () { choose(i, b); };
      box.appendChild(b);
    });
    updateHud();
    run.t0 = performance.now();
    cancelAnimationFrame(timerRaf);
    timerRaf = requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!run || run.over || run.locked) return;
    const dur = ITEM_SEC[run.level] * 1000;
    const left = Math.max(0, dur - (now - run.t0));
    $('timer-bar').style.transform = 'scaleX(' + (left / dur) + ')';
    $('timer-label').textContent = Math.ceil(left / 1000) + 's';
    if (left <= 0) { resolve(false, null, true); return; }
    timerRaf = requestAnimationFrame(tick);
  }
  function choose(i, btn) {
    if (!run || run.locked || run.over) return;
    resolve(i === cur().answer, btn, false);
  }
  function resolve(ok, btn, timeUp) {
    run.locked = true;
    cancelAnimationFrame(timerRaf);
    const chips = document.querySelectorAll('#q-choices .chip');
    chips.forEach(function (c) { c.disabled = true; });
    const fb = $('q-feedback');
    if (ok) {
      const dur = ITEM_SEC[run.level] * 1000;
      const frac = Math.max(0, 1 - (performance.now() - run.t0) / dur);
      const pts = BASE_PTS[run.level] + Math.round(frac * TIME_BONUS_MAX);
      run.score += pts; run.correct++;
      if (btn) btn.classList.add('ok');
      fb.className = 'fb ok'; fb.textContent = '⛵ Correct! +' + pts + ' — sailing on.';
      Sound.ding();
    } else {
      run.lives--;
      if (btn) btn.classList.add('bad'); // only the tapped chip is marked; the key is never highlighted
      fb.className = 'fb bad'; fb.textContent = timeUp ? '⏱ Time is up — a wave hit the banca! −1 life' : '🌊 Not quite — a wave hit the banca! −1 life';
      Sound.buzz();
      $('scene').classList.add('shake'); setTimeout(function () { $('scene').classList.remove('shake'); }, 400);
    }
    updateHud(); paintScene();
    setTimeout(function () {
      fb.className = 'fb'; fb.textContent = '';
      if (run.lives <= 0) { run.endedByLives = true; endLevel(false); return; }
      run.qIndex++;
      if (run.qIndex >= ITEMS) { Sound.levelUp(); endLevel(true); return; }
      showItem();
    }, ok ? 900 : 1300);
  }
  function updateHud() {
    if (!run) return;
    $('hud-attempt').textContent = DEMO ? 'DEMO · practice — not saved' : '1 try only';
    $('hud-level').textContent = 'L' + run.level;
    $('hud-q').textContent = Math.min(run.qIndex + 1, ITEMS) + '/' + ITEMS;
    $('hud-score').textContent = (attempt ? attempt.score : 0) + run.score;
    $('hud-lives').textContent = '❤'.repeat(Math.max(0, run.lives)) + '♡'.repeat(Math.max(0, LIVES - run.lives));
  }
  function paintScene() {
    if (!run) return;
    const done = run.correct + (run.qIndex - run.correct);
    const frac = Math.min(1, (run.qIndex + (run.locked ? 1 : 0)) / ITEMS);
    $('boat').style.left = 'calc(' + (6 + frac * 72) + '% - 10px)';
    void done;
  }
  function endLevel(finishedAllItems) {
    if (!run || run.over) return;
    run.over = true;
    cancelAnimationFrame(timerRaf);
    if (attempt) {
      attempt.score += run.score;
      attempt.totalCorrect += run.correct;
      if (finishedAllItems || run.correct > 0) attempt.bestLevel = Math.max(attempt.bestLevel, run.level);
    }
    const isLast = run.level >= LEVELS;
    const died = !!run.endedByLives;
    $('sum-title').textContent = isLast ? '🏝 Voyage complete!' : (died ? 'Out of lives — the banca drifts to the next island' : '🏝 Island ' + run.level + ' reached!');
    $('sum-detail').textContent =
      'Correct: ' + run.correct + '/' + ITEMS +
      ' · Level points: ' + run.score +
      ' · Voyage total: ' + (attempt ? attempt.score : 0) +
      (!isLast ? ' · Fresh 3 lives on next level' : ' · All 5 levels done');
    show('summary');
    if (isLast) {
      Sound.stopMusic();
      finishAttempt().then(function () { paintSummaryButtons(false); });
      paintSummaryButtons(false);
    } else {
      if (!DEMO) snapshotOpenAttempt({ nextLevel: run.level + 1, awaitingNext: true });
      $('sum-sync').textContent = (DEMO ? 'Demo' : '1 try') + ' · Next: Level ' + (run.level + 1) + ' — ' + INQ.TOPICS[run.level + 1];
      paintSummaryButtons(true);
    }
  }

  async function finishAttempt() {
    if (!attempt || !attempt.active) return;
    attempt.active = false;
    Sound.stopMusic();
    const score = attempt.score;
    const bestLevel = attempt.bestLevel;
    if (DEMO) {
      $('sum-sync').textContent = 'Demo mode — score not saved (' + score + ' pts).';
      return;
    }
    progress.attemptsUsed = Math.max(progress.attemptsUsed + 1, attempt.num);
    progress.attemptScores = (progress.attemptScores || []).concat([score]);
    progress.bestTotal = Math.max(progress.bestTotal, score);
    progress.bestLevel = Math.max(progress.bestLevel, bestLevel);
    clearOpenAttempt();
    saveLocal();
    const entry = {
      name: player.name, grade: player.grade, section: player.section || '',
      total: progress.bestTotal, bestLevel: progress.bestLevel,
      attempts: progress.attemptsUsed, attemptScores: progress.attemptScores.slice(-4),
      correct: attempt.totalCorrect, ts: Date.now(),
    };
    $('sum-sync').textContent = 'Saving best score…';
    setPending(entry);
    const ok = await submitWithRetry(entry);
    $('sum-sync').textContent = ok
      ? 'Saved online — on the leaderboard. Your score: ' + progress.bestTotal + ' · Tries used: ' + progress.attemptsUsed + '/' + MAX_ATTEMPTS
      : 'No internet — saved on this phone only. It will upload automatically when you are online (keep or reopen this page). Score: ' + progress.bestTotal + ' · Tries: ' + progress.attemptsUsed + '/' + MAX_ATTEMPTS;
  }

  function paintSummaryButtons(canNext) {
    const left = MAX_ATTEMPTS - progress.attemptsUsed;
    $('btn-next').style.display = canNext ? '' : 'none';
    $('btn-next').textContent = 'Next Level';
    if (!canNext && left > 0) {
      $('btn-retry').style.display = '';
      $('btn-retry').textContent = MAX_ATTEMPTS === 1 ? 'Start Run (1 try)' : ('Start Attempt ' + (progress.attemptsUsed + 1) + ' of ' + MAX_ATTEMPTS);
    } else {
      $('btn-retry').style.display = 'none';
    }
    $('btn-menu').style.display = '';
    $('btn-menu').textContent = 'Back';
  }
  function paintLobby() {
    $('levels-wrap').style.display = '';
    const left = MAX_ATTEMPTS - progress.attemptsUsed;
    $('player-label').textContent =
      player.name + ' · G' + player.grade +
      (player.section ? ' · ' + player.section : '') +
      ' · Best: ' + progress.bestTotal;
    const box = $('level-btns');
    box.innerHTML = '';
    if (left <= 0) {
      const msg = document.createElement('div');
      msg.className = 'no-tries';
      msg.innerHTML =
        '<strong>No tries left</strong><br>Your score: <b>' + progress.bestTotal + '</b>' +
        (progress.bestLevel ? ' (reached L' + progress.bestLevel + ')' : '') +
        '<br><span class="note" style="opacity:1;color:#b71c1c">' + boardNote() + '</span>';
      box.appendChild(msg);
      return;
    }
    const oa = progress.openAttempt;
    const resumeLvl = oa ? clampLevel(oa.nextLevel) : 0;
    const b = document.createElement('button');
    b.className = 'lvl';
    b.textContent = oa
      ? ('Resume Level ' + resumeLvl)
      : (MAX_ATTEMPTS === 1 ? 'Start Run (1 try)' : ('Start Attempt ' + (progress.attemptsUsed + 1) + ' of ' + MAX_ATTEMPTS));
    b.onclick = function () { startAttempt(); };
    box.appendChild(b);
    const hint = document.createElement('p');
    hint.className = 'note';
    hint.textContent = oa
      ? 'Your phone saved your place. You cannot restart from Level 1.'
      : '1 try only · Levels 1→5 (fresh lives each level) · Leaderboard saves your best.';
    box.appendChild(hint);
  }

  $('btn-play').onclick = async function () {
    const name = $('inp-name').value.trim();
    const grade = $('inp-grade').value;
    const section = $('inp-section').value.trim();
    if (!name || !grade || !section) {
      alert('Select Grade, Section, and your Name from the list.');
      return;
    }
    const ok = learners.some(function (x) {
      return x.n === name && gradeNum(x.g) === grade && x.s === section;
    });
    if (!ok) { alert('Name not on the class list.'); return; }
    player = { name: name, grade: grade, section: section };
    localStorage.setItem('in-name', name);
    localStorage.setItem('in-grade', grade);
    localStorage.setItem('in-section', section);
    progress = blankProgress();
    loadLocal();
    $('btn-play').disabled = true;
    $('btn-play').textContent = 'Checking tries…';
    const rec = await fetchRemoteRecord();
    mergeRemote(rec); afterRemote(rec);
    $('btn-play').disabled = false;
    $('btn-play').textContent = 'Continue';
    paintLobby();
  };

  $('btn-go-board').onclick = async function () {
    show('board');
    $('board-body').innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
    renderBoard(await fetchBoard(), $('board-filter').value);
  };
  $('board-filter').onchange = async function () {
    renderBoard(await fetchBoard(), $('board-filter').value);
  };
  $('btn-board-back').onclick = function () { show('start'); };
  $('btn-next').onclick = function () {
    if (attempt && attempt.active && run) startLevel(run.level + 1);
  };
  $('btn-retry').onclick = function () { startAttempt(); };
  $('btn-menu').onclick = function () {
    if (attempt && attempt.active) {
      if (run && !run.over) {
        run.over = true;
        cancelAnimationFrame(raf); cancelAnimationFrame(timerRaf);
        if (!DEMO) snapshotOpenAttempt({ nextLevel: run.level, awaitingNext: false });
      } else if (run && run.over && run.level < LEVELS) {
        if (!DEMO) snapshotOpenAttempt({ nextLevel: run.level + 1, awaitingNext: true });
      } else if (!run) {
        if (!DEMO) snapshotOpenAttempt({ nextLevel: 1, awaitingNext: false });
      }
      try { Sound.stopMusic(); } catch (e) {}
      attempt = null;
      run = null;
      show('start');
      paintLobby();
      return;
    }
    show('start');
    paintLobby();
  };

  function onLeavePage() {
    persistOpenAttemptOnHide();
  }
  window.addEventListener('pagehide', onLeavePage);
  window.addEventListener('beforeunload', onLeavePage);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onLeavePage();
  });

  window.__IN_TEST__ = {
    DEMO: DEMO, API_NS: API_NS, MAX_ATTEMPTS: MAX_ATTEMPTS,
    getRun: function () { return DEMO ? run : null; }, getAttempt: function () { return attempt; },
    forceDemoStart: function (level) {
      if (!DEMO) return;
      player = { name: 'Demo Navigator', grade: '11', section: 'Demo' };
      attempt = { num: 1, score: 0, unlocked: LEVELS, bestLevel: 0, totalCorrect: 0, active: true };
      Sound.unlock();
      startLevel(level || 1);
    },
  };

  if (DEMO) {
    $('load-status').textContent = 'Demo mode — scores not saved, no try used.';
    $('demo-banner').hidden = false;
    $('btn-demo').hidden = false;
    $('btn-demo').onclick = function () { window.__IN_TEST__.forceDemoStart(1); };
  }

  $('btn-quit').onclick = function () { $('btn-menu').onclick(); };
  loadLearners();
  Sound.paintBtn();
  const btnSound = $('btn-sound');
  if (btnSound) btnSound.onclick = function () { Sound.toggle(); };
  show('start');
})();
