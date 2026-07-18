/* ============================================================
   CaYaSound · waveform.js
   Dalga formu görselleştirme + TEK piksel<->örnek dönüşümü.
   Çizim, seçim ve oynatma imleci hep aynı xToSample/sampleToX
   fonksiyonlarından geçer (zoom + kaydırma dahil).
   ============================================================ */
(function (CaYa) {
  'use strict';

  var RULER_TARGET_PX = 74;
  var NICE = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5,
              1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];

  function fmt(t) {
    if (t < 0) t = 0;
    var m = Math.floor(t / 60);
    var s = t - m * 60;
    var ss = (s < 10 ? '0' : '') + s.toFixed(3);
    return m + ':' + ss;
  }

  function Waveform(o) {
    this.ruler = o.ruler;
    this.cL = o.waveL; this.cR = o.waveR;
    this.overlay = o.overlay;
    this.host = o.scrollHost;
    this.hbar = o.hbar; this.thumb = o.hbarThumb;

    this.onSeek = o.onSeek || function () {};
    this.onSelect = o.onSelect || function () {};
    this.onView = o.onView || function () {};   // görünüm (zoom/kaydırma/boyut) değişince

    this.rctx = this.ruler.getContext('2d');
    this.lctx = this.cL.getContext('2d');
    this.rrctx = this.cR.getContext('2d');
    this.octx = this.overlay.getContext('2d');

    this.channels = null;
    this.total = 0;
    this.sr = 44100;

    this.zoom = 1;
    this.scroll = 0;   // sol kenardaki örnek indeksi
    this.width = 800;  // CSS piksel (ruler/overlay/kanallar ortak)
    this.hCh = 120;    // her kanal yüksekliği (CSS px)

    this._grad = null;
    this._last = { cursor: null, sel: null, play: null };

    this._bindPointer();
    this._bindWheel();
    this._bindScrollbar();

    var self = this;
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(this.host);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
    }
  }

  /* ---------- boyutlandırma ---------- */
  Waveform.prototype._sizeCanvas = function (canvas, ctx) {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height };
  };

  Waveform.prototype.resize = function () {
    var r = this._sizeCanvas(this.ruler, this.rctx);
    var l = this._sizeCanvas(this.cL, this.lctx);
    this._sizeCanvas(this.cR, this.rrctx);
    this._sizeCanvas(this.overlay, this.octx);
    this.width = r.w;
    this.hCh = l.h;
    this._grad = null;
    this.clampScroll();
    this.draw();
    this.drawOverlay(this._last.cursor, this._last.sel, this._last.play);
  };

  /* ---------- veri ---------- */
  Waveform.prototype.setData = function (channels, sampleRate) {
    this.channels = channels;
    this.sr = sampleRate;
    this.total = channels[0].length;
    this.zoom = 1;
    this.scroll = 0;
    this.resize();
  };
  Waveform.prototype.setChannels = function (channels) {
    this.channels = channels;
    this.total = channels[0].length;
    this.clampScroll();
    this.draw();
  };

  /* ---------- TEK dönüşüm ---------- */
  Waveform.prototype.visible = function () { return this.total / this.zoom; };
  Waveform.prototype.spp = function () { return this.visible() / this.width; };
  Waveform.prototype.xToSample = function (x) { return this.scroll + x * this.spp(); };
  Waveform.prototype.sampleToX = function (s) { return (s - this.scroll) / this.spp(); };

  Waveform.prototype.clampScroll = function () {
    var max = this.total - this.visible();
    if (max < 0) max = 0;
    if (this.scroll > max) this.scroll = max;
    if (this.scroll < 0) this.scroll = 0;
    this._updateScrollbar();
  };

  /* ---------- zoom ---------- */
  Waveform.prototype.zoomMax = function () { return Math.max(1, this.total / 16); };
  Waveform.prototype.zoomAt = function (factor, anchorX) {
    if (!this.total) return;
    var anchor = this.xToSample(anchorX);
    var z = this.zoom * factor;
    if (z < 1) z = 1;
    var zm = this.zoomMax();
    if (z > zm) z = zm;
    this.zoom = z;
    this.scroll = anchor - anchorX * this.spp();
    this.clampScroll();
    this.draw();
    this.drawOverlay(this._last.cursor, this._last.sel, this._last.play);
  };
  Waveform.prototype.zoomIn = function () { this.zoomAt(1.6, this.width / 2); };
  Waveform.prototype.zoomOut = function () { this.zoomAt(1 / 1.6, this.width / 2); };
  Waveform.prototype.zoomFit = function () {
    this.zoom = 1; this.scroll = 0; this.clampScroll();
    this.draw(); this.drawOverlay(this._last.cursor, this._last.sel, this._last.play);
  };
  Waveform.prototype.zoomToSelection = function (sel) {
    if (!sel || sel.end <= sel.start) return;
    var span = sel.end - sel.start;
    this.zoom = Math.min(this.zoomMax(), Math.max(1, this.total / span));
    this.scroll = sel.start - 0.05 * this.visible();
    this.clampScroll();
    this.draw(); this.drawOverlay(this._last.cursor, this._last.sel, this._last.play);
  };

  /* ---------- çizim ---------- */
  Waveform.prototype._gradient = function (ctx, h) {
    if (this._grad) return this._grad;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ff5560');
    g.addColorStop(0.5, '#e51e2b');
    g.addColorStop(1, '#a5151f');
    this._grad = g;
    return g;
  };

  Waveform.prototype._drawWave = function (ctx, data, h) {
    ctx.clearRect(0, 0, this.width, h);
    // orta çizgi
    var mid = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid + 0.5); ctx.lineTo(this.width, mid + 0.5); ctx.stroke();

    if (!data || !this.total) return;
    var spp = this.spp();
    var amp = mid * 0.94;
    ctx.fillStyle = this._gradient(ctx, h);

    for (var x = 0; x < this.width; x++) {
      var s0 = this.xToSample(x);
      var s1 = this.xToSample(x + 1);
      var i0 = Math.floor(s0); if (i0 < 0) i0 = 0;
      var i1 = Math.ceil(s1); if (i1 > this.total) i1 = this.total;
      if (i1 <= i0) i1 = i0 + 1;
      var min = 1, max = -1;
      for (var i = i0; i < i1; i++) {
        var v = data[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (min > max) { min = 0; max = 0; }
      var yTop = mid - max * amp;
      var yBot = mid - min * amp;
      var barH = yBot - yTop;
      if (barH < 1) barH = 1;
      ctx.fillRect(x, yTop, 1, barH);
    }
  };

  Waveform.prototype._drawRuler = function () {
    var ctx = this.rctx, w = this.width, h = 26;
    ctx.clearRect(0, 0, w, h);
    if (!this.total) return;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'middle';

    var visSec = this.visible() / this.sr;
    var pxPerSec = w / visSec;
    var minSec = RULER_TARGET_PX / pxPerSec;
    var step = NICE[NICE.length - 1];
    for (var k = 0; k < NICE.length; k++) { if (NICE[k] >= minSec) { step = NICE[k]; break; } }

    var startSec = this.scroll / this.sr;
    var t = Math.ceil(startSec / step) * step;
    ctx.beginPath();
    for (; ; t += step) {
      var x = this.sampleToX(t * this.sr);
      if (x > w) break;
      if (x < 0) continue;
      ctx.moveTo(x + 0.5, h - 8); ctx.lineTo(x + 0.5, h);
      ctx.fillText(fmt(t), x + 4, h - 14);
    }
    ctx.stroke();
  };

  Waveform.prototype.draw = function () {
    this._drawRuler();
    this._drawWave(this.lctx, this.channels ? this.channels[0] : null, this.hCh);
    this._drawWave(this.rrctx, this.channels ? this.channels[1] : null, this.hCh);
    // Zoom/kaydırma/boyut değişimlerinin tamamı draw()'dan geçer:
    // kayan tutamak konumunu tek noktadan güncellemek için buradan haber ver.
    this.onView();
  };

  /* ---------- bindirme (imleç / seçim / oynatma) ---------- */
  Waveform.prototype.drawOverlay = function (cursor, sel, play) {
    this._last = { cursor: cursor, sel: sel, play: play };
    var ctx = this.octx, w = this.width, h = this.overlay.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);

    if (sel && sel.end > sel.start) {
      var x0 = this.sampleToX(sel.start);
      var x1 = this.sampleToX(sel.end);
      if (x1 < 0 || x0 > w) { /* görünmez */ } else {
        var cx0 = Math.max(0, x0), cx1 = Math.min(w, x1);
        // Kırmızı dalgaya zıt, uyumlu camgöbeği (cyan) seçim vurgusu
        ctx.fillStyle = 'rgba(55, 200, 224, 0.22)';
        ctx.fillRect(cx0, 0, cx1 - cx0, h);
        ctx.strokeStyle = '#8beefb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (x0 >= 0 && x0 <= w) { ctx.moveTo(x0 + 1, 0); ctx.lineTo(x0 + 1, h); }
        if (x1 >= 0 && x1 <= w) { ctx.moveTo(x1 - 1, 0); ctx.lineTo(x1 - 1, h); }
        ctx.stroke();
      }
    }

    if (cursor != null) {
      var xc = this.sampleToX(cursor);
      if (xc >= 0 && xc <= w) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xc + 0.5, 0); ctx.lineTo(xc + 0.5, h); ctx.stroke();
      }
    }

    if (play != null) {
      var xp = this.sampleToX(play);
      if (xp >= 0 && xp <= w) {
        ctx.strokeStyle = '#ff2e3e';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(255,46,62,0.8)'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, h); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  };

  /* ---------- fare/pointer ---------- */
  Waveform.prototype._localX = function (e) {
    var rect = this.overlay.getBoundingClientRect();
    var x = e.clientX - rect.left;
    return Math.max(0, Math.min(this.width, x));
  };

  Waveform.prototype._bindPointer = function () {
    var self = this;
    var dragging = false, startX = 0, startSample = 0, moved = false;

    function down(e) {
      if (!self.total) return;
      dragging = true; moved = false;
      startX = self._localX(e);
      startSample = Math.round(self.xToSample(startX));
      startSample = Math.max(0, Math.min(self.total, startSample));
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      var x = self._localX(e);
      if (Math.abs(x - startX) > 3) moved = true;
      var cur = Math.round(self.xToSample(x));
      cur = Math.max(0, Math.min(self.total, cur));
      var a = Math.min(startSample, cur), b = Math.max(startSample, cur);
      if (moved) self.onSelect({ start: a, end: b });
    }
    function up() {
      dragging = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) { self.onSelect(null); self.onSeek(startSample); }
    }
    this.overlay.addEventListener('pointerdown', down);
  };

  Waveform.prototype._bindWheel = function () {
    var self = this;
    this.host.addEventListener('wheel', function (e) {
      if (!self.total) return;
      if (e.ctrlKey || e.metaKey) {
        var rect = self.overlay.getBoundingClientRect();
        var ax = Math.max(0, Math.min(self.width, e.clientX - rect.left));
        self.zoomAt(e.deltaY < 0 ? 1.25 : 1 / 1.25, ax);
      } else if (self.zoom > 1) {
        self.scroll += (e.deltaY + e.deltaX) * self.spp();
        self.clampScroll();
        self.draw();
        self.drawOverlay(self._last.cursor, self._last.sel, self._last.play);
      } else {
        return; // fit halinde sayfayı bırak
      }
      e.preventDefault();
    }, { passive: false });
  };

  Waveform.prototype._updateScrollbar = function () {
    if (!this.hbar || !this.thumb) return;
    if (this.zoom <= 1 || !this.total) { this.hbar.classList.remove('on'); return; }
    this.hbar.classList.add('on');
    var frac = this.visible() / this.total;
    var left = this.scroll / this.total;
    this.thumb.style.width = (frac * 100) + '%';
    this.thumb.style.left = (left * 100) + '%';
  };

  Waveform.prototype._bindScrollbar = function () {
    var self = this;
    var dragging = false, startMouse = 0, startScroll = 0;
    function down(e) {
      dragging = true;
      startMouse = e.clientX;
      startScroll = self.scroll;
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      var dx = e.clientX - startMouse;
      var samplesPerBarPx = self.total / self.hbar.getBoundingClientRect().width;
      self.scroll = startScroll + dx * samplesPerBarPx;
      self.clampScroll();
      self.draw();
      self.drawOverlay(self._last.cursor, self._last.sel, self._last.play);
    }
    function up() {
      dragging = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    if (this.thumb) this.thumb.addEventListener('pointerdown', down);
  };

  CaYa.Waveform = Waveform;
})(window.CaYa = window.CaYa || {});
