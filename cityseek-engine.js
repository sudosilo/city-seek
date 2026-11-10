/* City Seek v3. Shared scripts load in order: art, world, engine. */
'use strict';
  function visT(t, s) { if (t.sh && s < t.sh * 1.08) return false; if (t.hd && s > t.hd * 1.18) return false; return true; }

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var pad = opts.pad || { t: 0, r: 0, b: 0, l: 0 };
    var world = null, mark = null, stamp = 0;
    var cam = { x: 0, y: 0, s: 0.1 }, vw = 1, vh = 1, dpr = 1;
    var dirty = true, anims = [], tween = null, hint = null, raf = 0;
    var stats = { misses: 0, hints: 0 };
    var FIND_S = 0.55, MAX_S = 5;
    var showMarks = true;
    var mini = opts.minimap || null, miniBase = null;

    function minS() { return Math.min((vw - pad.l - pad.r) / world.W, (vh - pad.t - pad.b) / world.H); }
    function clampS(s) { return Math.max(minS(), Math.min(MAX_S, s)); }
    function clamp() {
      var s = cam.s, vW = vw / s, vH = vh / s;
      var minX = -pad.l / s, maxX = world.W + pad.r / s - vW;
      var minY = -pad.t / s, maxY = world.H + pad.b / s - vH;
      cam.x = maxX < minX ? (minX + maxX) / 2 : Math.min(maxX, Math.max(minX, cam.x));
      cam.y = maxY < minY ? (minY + maxY) / 2 : Math.min(maxY, Math.max(minY, cam.y));
    }
    function setCenter(wx, wy, s) { cam.s = clampS(s); cam.x = wx - vw / 2 / cam.s; cam.y = wy - vh / 2 / cam.s; clamp(); }
    function center() { return { x: cam.x + vw / 2 / cam.s, y: cam.y + vh / 2 / cam.s }; }
    function zoomAt(sx, sy, ns) { var wx = cam.x + sx / cam.s, wy = cam.y + sy / cam.s; cam.s = clampS(ns); cam.x = wx - sx / cam.s; cam.y = wy - sy / cam.s; clamp(); kick(); }
    function tweenTo(wx, wy, s, dur) { var c = center(); tween = { t0: performance.now(), dur: dur || 420, fx: c.x, fy: c.y, fs: cam.s, tx: wx, ty: wy, ts: clampS(s) }; kick(); }

    function resize() {
      var r = canvas.getBoundingClientRect(), c = world ? center() : null, olds = cam.s;
      dpr = Math.min(2, window.devicePixelRatio || 1); vw = Math.max(1, r.width); vh = Math.max(1, r.height);
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      if (mini) { var mr = mini.getBoundingClientRect(); mini.width = Math.round(mr.width * dpr); mini.height = Math.round(mr.height * dpr); buildMini(); }
      if (world && c) setCenter(c.x, c.y, olds);
      kick();
    }

    function buildMini() {
      if (!mini || !world || !mini.width) return;
      miniBase = document.createElement('canvas'); miniBase.width = mini.width; miniBase.height = mini.height;
      var m = miniBase.getContext('2d'), sc = Math.min(mini.width / world.W, mini.height / world.H);
      m.fillStyle = '#ffffff'; m.fillRect(0, 0, mini.width, mini.height);
      m.setTransform(sc, 0, 0, sc, (mini.width - world.W * sc) / 2, (mini.height - world.H * sc) / 2);
      for (var i = 0; i < world.items.length; i++) { var it = world.items[i]; if (it.sh) continue; if (it.L <= 2) it.f(m); else if (it.L === 4 && it.dot) { m.fillStyle = it.dot; m.fillRect(it.x0, it.y0, it.x1 - it.x0, it.y1 - it.y0); } }
    }
    function drawMini() {
      if (!mini || !miniBase || mini.classList.contains('off')) return;
      var m = mini.getContext('2d'), sc = Math.min(mini.width / world.W, mini.height / world.H), ox = (mini.width - world.W * sc) / 2, oy = (mini.height - world.H * sc) / 2;
      m.setTransform(1, 0, 0, 1, 0, 0); m.drawImage(miniBase, 0, 0);
      m.setTransform(sc, 0, 0, sc, ox, oy);
      if (hint) { m.beginPath(); m.arc(hint.x, hint.y, hint.r, 0, TAU); m.fillStyle = 'rgba(255,210,63,.45)'; m.fill(); m.lineWidth = 2 / sc; m.strokeStyle = INK; m.stroke(); }
      (world.all || world.targets).forEach(function (t) { if (t.found) { m.beginPath(); m.arc(t.wx, t.wy, 4 / sc, 0, TAU); m.fillStyle = '#1f6fff'; m.fill(); } });
      m.lineWidth = 2.5 / sc; m.strokeStyle = '#1f6fff'; m.strokeRect(cam.x, cam.y, vw / cam.s, vh / cam.s);
    }

    function kick() { dirty = true; if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      if (tween) {
        var k = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - k, 3);
        var s = tween.fs * Math.pow(tween.ts / tween.fs, e);
        setCenter(tween.fx + (tween.tx - tween.fx) * e, tween.fy + (tween.ty - tween.fy) * e, s);
        if (k >= 1) tween = null;
        dirty = true;
      }
      anims = anims.filter(function (a) { return now - a.t0 < a.dur; });
      if (hint && now - hint.t0 > hint.dur) hint = null;
      if (dirty || anims.length || hint) { render(now); dirty = false; }
      if (tween || anims.length || hint) raf = requestAnimationFrame(frame);
    }

    function render(now) {
      var s = cam.s;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fbf8f1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!world) return;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, -cam.x * s * dpr, -cam.y * s * dpr);
      var x0 = cam.x, y0 = cam.y, x1 = cam.x + vw / s, y1 = cam.y + vh / s, C = world.CELL, items = world.items, grid = world.grid;
      stamp++; var list = [];
      var cy0 = Math.max(0, Math.floor(y0 / C)), cy1 = Math.min(world.GH - 1, Math.floor(y1 / C)), cx0 = Math.max(0, Math.floor(x0 / C)), cx1 = Math.min(world.GW - 1, Math.floor(x1 / C));
      for (var cy = cy0; cy <= cy1; cy++) for (var cx = cx0; cx <= cx1; cx++) {
        var cell = grid[cy * world.GW + cx];
        for (var i = 0; i < cell.length; i++) {
          var id = cell[i]; if (mark[id] === stamp) continue; mark[id] = stamp; var it = items[id];
          if (it.sh && s < it.sh) continue;
          if (it.hd && s > it.hd * 1.2) continue;
          if (it.x1 < x0 || it.x0 > x1 || it.y1 < y0 || it.y0 > y1) continue;
          list.push(id);
        }
      }
      list.sort(function (a, b) { return items[a].L - items[b].L || a - b; });
      var low = s < 0.22;
      for (var n = 0; n < list.length; n++) {
        var t = items[list[n]];
        if (low && t.L >= 3) {
          if (t.dot) { var w = Math.max(t.x1 - t.x0, 4) * 0.55; ctx.fillStyle = t.dot; ctx.fillRect((t.x0 + t.x1) / 2 - w / 2, (t.y0 + t.y1) / 2 - w / 2, w, w); }
          else if ((t.x1 - t.x0) * s >= 1.5) t.f(ctx);
          continue;
        }
        var al = 1;
        if (t.sh) al = Math.min(1, (s - t.sh) / (t.sh * 0.2));
        if (t.hd) al = Math.min(al, (t.hd * 1.2 - s) / (t.hd * 0.2));
        if (al <= 0.02) continue;
        if (al < 1) { ctx.globalAlpha = al; t.f(ctx); ctx.globalAlpha = 1; } else t.f(ctx);
      }
      ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(0, 0, world.W, world.H);
      if (showMarks) world.targets.forEach(function (tg) { if (!tg.found) return; ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r + 9, 0, TAU); ctx.lineWidth = Math.max(2.5, 3 / s); ctx.strokeStyle = '#1f6fff'; ctx.stroke(); });
      if (hint) {
        var hp = (now - hint.t0) / 600, pulse = 1 + Math.sin(hp * Math.PI) * 0.04;
        ctx.beginPath(); ctx.arc(hint.x, hint.y, hint.r * pulse, 0, TAU); ctx.fillStyle = 'rgba(255,210,63,.14)'; ctx.fill();
        ctx.setLineDash([18 / s, 12 / s]); ctx.lineWidth = 4 / s; ctx.strokeStyle = '#1f6fff'; ctx.stroke(); ctx.setLineDash([]);
      }
      anims.forEach(function (a) {
        var k = (now - a.t0) / a.dur;
        if (a.type === 'found') {
          ctx.beginPath(); ctx.arc(a.x, a.y, (a.r + 8) + k * 40 / s, 0, TAU); ctx.lineWidth = 5 / s * (1 - k) + 0.5; ctx.strokeStyle = 'rgba(31,111,255,' + (1 - k) + ')'; ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(a.x, a.y, (6 + k * 14) / s, 0, TAU); ctx.lineWidth = 3 / s; ctx.strokeStyle = 'rgba(230,57,70,' + (1 - k) + ')'; ctx.stroke();
          var q = 6 / s; ctx.beginPath(); ctx.moveTo(a.x - q, a.y - q); ctx.lineTo(a.x + q, a.y + q); ctx.moveTo(a.x + q, a.y - q); ctx.lineTo(a.x - q, a.y + q); ctx.stroke();
        }
      });
      drawMini();
      if (opts.onView) opts.onView(s);
    }

    function tap(sx, sy) {
      if (!world) return;
      if (opts.onInteract) opts.onInteract();
      var wx = cam.x + sx / cam.s, wy = cam.y + sy / cam.s;
      if (cam.s < FIND_S) { tweenTo(wx, wy, Math.max(FIND_S * 1.7, cam.s * 3)); return; }
      var best = null, bd = 1e9;
      world.targets.forEach(function (t) { if (t.found || !visT(t, cam.s)) return; var d = Math.hypot(t.x - wx, t.y - wy), tol = t.r + 12 / cam.s; if (d < tol && d < bd) { bd = d; best = t; } });
      var now = performance.now();
      if (best) {
        best.found = true; anims.push({ type: 'found', x: best.x, y: best.y, r: best.r, t0: now, dur: 900 });
        if (hint && hint.id === best.id) hint = null;
        if (opts.onFind) opts.onFind(best);
      } else {
        var tw = null;
        if (world.towers) world.towers.forEach(function (q) { if (wx >= q.x0 && wx <= q.x1 && wy >= q.y0 && wy <= q.y1) tw = q; });
        if (tw && opts.onTower) { opts.onTower(tw); return; }
        stats.misses++; anims.push({ type: 'miss', x: wx, y: wy, t0: now, dur: 450 });
        if (opts.onMiss) opts.onMiss(stats.misses);
      }
      kick();
    }

    var P = new Map(), gest = null;
    function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onDown(e) {
      canvas.setPointerCapture(e.pointerId); var p = local(e); P.set(e.pointerId, p); tween = null;
      if (P.size === 1) gest = { type: 'pan', sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: false, t: performance.now() };
      else if (P.size === 2) { var v = Array.from(P.values()), mx = (v[0].x + v[1].x) / 2, my = (v[0].y + v[1].y) / 2; gest = { type: 'pinch', d: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1, s: cam.s, wx: cam.x + mx / cam.s, wy: cam.y + my / cam.s }; }
    }
    function onMove(e) {
      if (!P.has(e.pointerId) || !gest) return; var p = local(e); P.set(e.pointerId, p);
      if (gest.type === 'pan' && P.size === 1) {
        var dx = p.x - gest.sx, dy = p.y - gest.sy;
        if (!gest.moved && Math.hypot(dx, dy) > 8) gest.moved = true;
        if (gest.moved) { cam.x = gest.cx - dx / cam.s; cam.y = gest.cy - dy / cam.s; clamp(); kick(); }
      } else if (gest.type === 'pinch' && P.size >= 2) {
        var v = Array.from(P.values()), mx = (v[0].x + v[1].x) / 2, my = (v[0].y + v[1].y) / 2, d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
        cam.s = clampS(gest.s * d / gest.d); cam.x = gest.wx - mx / cam.s; cam.y = gest.wy - my / cam.s; clamp(); kick();
      }
    }
    function onUp(e) {
      if (!P.has(e.pointerId)) return; var p = local(e); P.delete(e.pointerId);
      if (gest && gest.type === 'pan' && !gest.moved && P.size === 0 && performance.now() - gest.t < 600) tap(p.x, p.y);
      if (P.size === 1) { var q = Array.from(P.values())[0]; gest = { type: 'pan', sx: q.x, sy: q.y, cx: cam.x, cy: cam.y, moved: true, t: 0 }; }
      else if (P.size === 0) gest = null;
    }
    function onWheel(e) { e.preventDefault(); var p = local(e); zoomAt(p.x, p.y, cam.s * Math.exp(-e.deltaY * 0.0015)); }
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    var miniDrag = false;
    function miniGo(e) {
      var r = mini.getBoundingClientRect(), sc = Math.min(r.width / world.W, r.height / world.H), ox = (r.width - world.W * sc) / 2, oy = (r.height - world.H * sc) / 2;
      setCenter((e.clientX - r.left - ox) / sc, (e.clientY - r.top - oy) / sc, Math.max(cam.s, FIND_S)); kick();
    }
    if (mini) {
      mini.addEventListener('pointerdown', function (e) { if (!world) return; miniDrag = true; mini.setPointerCapture(e.pointerId); if (opts.onInteract) opts.onInteract(); miniGo(e); });
      mini.addEventListener('pointermove', function (e) { if (miniDrag) miniGo(e); });
      mini.addEventListener('pointerup', function () { miniDrag = false; });
      mini.addEventListener('pointercancel', function () { miniDrag = false; });
    }
    window.addEventListener('resize', resize);

    function load(w) {
      world = w; mark = new Int32Array(world.items.length); stamp = 0;
      anims = []; hint = null; tween = null;
      resize();
      setCenter(world.W / 2, world.H / 2, minS());
      buildMini(); kick();
    }
    function newGame(o) {
      o = o || {};
      var seed = (o.seed != null ? o.seed : Math.floor(Math.random() * 900000) + 100000) >>> 0;
      stats = { misses: 0, hints: 0 };
      load(build(seed, o.difficulty || 'normal'));
      return { seed: world.seed, difficulty: world.difficulty, targets: world.all };
    }
    function giveHint() {
      if (!world) return null;
      var left = (world.all || world.targets).filter(function (t) { return !t.found; });
      if (!left.length) return null;
      var t = left[Math.floor(Math.random() * left.length)], a = Math.random() * TAU, off = t.tower ? 60 : 120 + Math.random() * 160, r = 430;
      var hx = Math.max(r * 0.6, Math.min(world.W - r * 0.6, t.wx + Math.cos(a) * off)), hy = Math.max(r * 0.6, Math.min(world.H - r * 0.6, t.wy + Math.sin(a) * off));
      hint = { id: t.id, x: hx, y: hy, r: r, t0: performance.now(), dur: 9000 };
      stats.hints++;
      tweenTo(hx, hy, Math.min((vw - pad.l - pad.r) / (r * 2.2), (vh - pad.t - pad.b) / (r * 2.2)), 600);
      return t;
    }
    function drawIcon(cv, t) {
      var c = cv.getContext('2d'), w = cv.width, h = cv.height, sc = Math.min(w, h) / (t.r * 2.9);
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      if (t.kind === 'duck') { c.fillStyle = '#7cc4ff'; c.fillRect(0, 0, w, h); }
      if (t.kind === 'bucket' || t.kind === 'castle' || t.kind === 'toytruck') { c.fillStyle = '#f3dfa8'; c.fillRect(0, 0, w, h); }
      c.setTransform(sc, 0, 0, sc, w / 2, h / 2 + (t.kind === 'balloon' ? -2 * sc : t.kind === 'castle' ? 2 * sc : 0));
      SP[t.kind](c, t.o);
    }

    return {
      newGame: newGame,
      load: load,
      zoomBy: function (f) { zoomAt(vw / 2, vh / 2 + (pad.t - pad.b) / 2, cam.s * f); },
      fit: function () { tweenTo(world.W / 2, world.H / 2, minS(), 450); },
      hint: giveHint,
      drawIcon: drawIcon,
      resize: resize,
      setMarks: function (v) { showMarks = !!v; kick(); },
      redraw: kick,
      resetStats: function () { stats = { misses: 0, hints: 0 }; },
      getStats: function () { return { misses: stats.misses, hints: stats.hints }; },
      getTargets: function () { return world ? (world.all || world.targets) : []; },
      getWorld: function () { return world; },
      getScale: function () { return cam.s; },
      focus: function (x, y, s) { setCenter(x, y, s); kick(); }
    };
  }

  window.CitySeek = { create: create, buildFloor: buildFloor, TARGETS: TDEF, DIFFICULTY: DIFF, SPRITES: SP, ROOF_S: ROOF_S, version: 'v3' };
