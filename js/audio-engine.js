/* ============================================================
   CaYaSound · audio-engine.js
   Tek doğruluk kaynağı: this.channels = [L, R] (Float32Array).
   Her düzenleme bu diziyi dönüştürür; oynatma ve dışa aktarma
   doğrudan buradan okur (WYSIWYG). Filtreler OfflineAudioContext
   ile "pişirilir". Bağlam ilk kullanıcı hareketinde açılır/resume edilir.
   ============================================================ */
(function (CaYa) {
  'use strict';

  function decode(ctx, arr) {
    // Hem promise hem callback biçimini destekle.
    return new Promise(function (res, rej) {
      var p;
      try { p = ctx.decodeAudioData(arr, res, rej); } catch (e) { rej(e); return; }
      if (p && typeof p.then === 'function') p.then(res, rej);
    });
  }

  function Engine() {
    this.ctx = null;
    this.monitorGain = null;
    this.channels = null;      // [Float32Array L, Float32Array R]
    this.sampleRate = 44100;
    this.length = 0;           // örnek/kare sayısı
    this.sourceChannels = 0;   // kaynak dosyanın kanal sayısı
    this.name = '';
    this.active = [true, true]; // düzenlenebilir kanallar (kilitli = false → işlemler atlar)

    this.volume = 1;
    this.source = null;
    this.playing = false;
    this.playStartSample = 0;
    this.playEndSample = 0;
    this.playStartCtxTime = 0;
    this.onEnded = null;
  }

  Engine.prototype.ensureCtx = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.monitorGain = this.ctx.createGain();
      this.monitorGain.gain.value = this.volume;
      this.monitorGain.connect(this.ctx.destination);
    }
    return this.ctx;
  };

  Engine.prototype.hasAudio = function () { return !!this.channels && this.length > 0; };
  Engine.prototype.duration = function () { return this.length / this.sampleRate; };

  // ---------- Yükleme ----------
  Engine.prototype.loadFile = function (arrayBuffer, name) {
    var self = this;
    var ctx = this.ensureCtx();
    return decode(ctx, arrayBuffer).then(function (decoded) {
      var L, R;
      if (decoded.numberOfChannels >= 2) {
        L = decoded.getChannelData(0).slice();
        R = decoded.getChannelData(1).slice();
      } else {
        L = decoded.getChannelData(0).slice();
        R = L.slice();
      }
      self.channels = [L, R];
      self.sampleRate = decoded.sampleRate;
      self.length = L.length;
      self.sourceChannels = decoded.numberOfChannels;
      self.name = name || 'ses';
      return self;
    });
  };

  // ---------- Anlık görüntü (geçmiş için) ----------
  Engine.prototype.snapshot = function () {
    return {
      channels: [this.channels[0].slice(), this.channels[1].slice()],
      sampleRate: this.sampleRate,
      length: this.length
    };
  };
  Engine.prototype.restore = function (snap) {
    this.channels = [snap.channels[0].slice(), snap.channels[1].slice()];
    this.sampleRate = snap.sampleRate;
    this.length = snap.length;
  };

  // ---------- Oynatma ----------
  Engine.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.monitorGain) this.monitorGain.gain.value = v;
  };

  Engine.prototype._buildBuffer = function (ctx) {
    var buf = ctx.createBuffer(2, this.length, this.sampleRate);
    buf.copyToChannel(this.channels[0], 0);
    buf.copyToChannel(this.channels[1], 1);
    return buf;
  };

  Engine.prototype.play = function (fromSample, toSample) {
    var ctx = this.ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    this.stopInternal();

    var src = ctx.createBufferSource();
    src.buffer = this._buildBuffer(ctx);
    src.connect(this.monitorGain);

    var from = Math.max(0, Math.min(fromSample | 0, this.length));
    var to = (toSample && toSample > from) ? Math.min(toSample | 0, this.length) : this.length;
    var offset = from / this.sampleRate;
    var dur = (to - from) / this.sampleRate;

    this.source = src;
    this.playing = true;
    this.playStartSample = from;
    this.playEndSample = to;
    this.playStartCtxTime = ctx.currentTime;

    var self = this;
    src.onended = function () {
      if (self.source !== src) return;
      self.playing = false;
      self.source = null;
      if (self.onEnded) self.onEnded();
    };

    if (dur > 0) src.start(0, offset, dur);
    else src.start(0, offset);
  };

  Engine.prototype.stopInternal = function () {
    if (this.source) {
      var s = this.source;
      this.source = null;
      this.playing = false;
      try { s.onended = null; s.stop(); } catch (e) {}
    }
  };
  Engine.prototype.stop = function () { this.stopInternal(); };

  Engine.prototype.getPlayheadSample = function () {
    if (!this.playing || !this.ctx) return null;
    var s = this.playStartSample + (this.ctx.currentTime - this.playStartCtxTime) * this.sampleRate;
    return s >= this.playEndSample ? this.playEndSample : s;
  };

  // ---------- Kanal işlemleri (tüm klip) ----------
  Engine.prototype.copyChannel = function (from, to) {
    this.channels[to] = this.channels[from].slice();
  };
  Engine.prototype.swap = function () {
    var t = this.channels[0]; this.channels[0] = this.channels[1]; this.channels[1] = t;
  };
  Engine.prototype.mono = function () {
    var L = this.channels[0], R = this.channels[1], n = this.length, m = new Float32Array(n);
    for (var i = 0; i < n; i++) m[i] = (L[i] + R[i]) * 0.5;
    this.channels[0] = m;
    this.channels[1] = m.slice();
  };
  Engine.prototype.silenceChannel = function (ch) {
    this.channels[ch] = new Float32Array(this.length);
  };

  // ---------- Bölge işlemleri ----------
  Engine.prototype.trim = function (start, end) {
    this.channels = [this.channels[0].slice(start, end), this.channels[1].slice(start, end)];
    this.length = end - start;
  };
  Engine.prototype.deleteRange = function (start, end) {
    var keep = this.length - (end - start);
    var out = [];
    for (var c = 0; c < 2; c++) {
      var o = new Float32Array(keep);
      o.set(this.channels[c].subarray(0, start), 0);
      o.set(this.channels[c].subarray(end), start);
      out.push(o);
    }
    this.channels = out;
    this.length = keep;
  };
  // Bölge/efekt işlemleri yalnızca ETKİN (kilitli olmayan) kanallara uygulanır.
  Engine.prototype.silenceRange = function (start, end) {
    if (this.active[0]) this.channels[0].fill(0, start, end);
    if (this.active[1]) this.channels[1].fill(0, start, end);
  };
  Engine.prototype.reverseRange = function (start, end) {
    for (var c = 0; c < 2; c++) {
      if (!this.active[c]) continue;
      var a = this.channels[c];
      for (var i = start, j = end - 1; i < j; i++, j--) { var t = a[i]; a[i] = a[j]; a[j] = t; }
    }
  };
  Engine.prototype.fade = function (start, end, dir) {
    var n = end - start;
    if (n < 2) return;
    for (var c = 0; c < 2; c++) {
      if (!this.active[c]) continue;
      var a = this.channels[c];
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        var g = dir === 'in' ? t : 1 - t;
        g = Math.sin(g * Math.PI / 2); // eşit güç eğrisi
        a[start + i] *= g;
      }
    }
  };
  Engine.prototype.amplify = function (db, start, end) {
    var g = Math.pow(10, db / 20);
    for (var c = 0; c < 2; c++) {
      if (!this.active[c]) continue;
      var a = this.channels[c];
      for (var i = start; i < end; i++) a[i] *= g;
    }
  };
  // Kazanç tutamacı (canlı önizleme) için: bölgeyi HER seferinde taban
  // kopyadan yeniden türet — böylece birikmez ve serbest bırakınca tam
  // olarak tek bir geri-al adımı olur. base = [Float32Array L, R] (bölge dilimi).
  Engine.prototype.setRegionGain = function (base, start, end, db) {
    var g = Math.pow(10, db / 20);
    for (var c = 0; c < 2; c++) {
      if (!this.active[c]) continue;
      var a = this.channels[c], b = base[c];
      for (var i = start, j = 0; i < end; i++, j++) a[i] = b[j] * g;
    }
  };
  Engine.prototype.normalize = function (targetDb, start, end) {
    var target = Math.pow(10, (targetDb == null ? -0.3 : targetDb) / 20);
    var peak = 0;
    for (var c = 0; c < 2; c++) {
      if (!this.active[c]) continue;
      var a = this.channels[c];
      for (var i = start; i < end; i++) { var v = Math.abs(a[i]); if (v > peak) peak = v; }
    }
    if (peak <= 1e-9) return false;
    var g = target / peak;
    for (var d = 0; d < 2; d++) {
      if (!this.active[d]) continue;
      var b = this.channels[d];
      for (var k = start; k < end; k++) b[k] *= g;
    }
    return true;
  };
  // Bir kanalın bölgesini panodan üzerine yaz (uzunluk değişmez). targets =
  // yazılacak kanal indeksleri; data = kaynak dilimler (kanal sayısı farklıysa döner).
  Engine.prototype.pasteOverwrite = function (data, pos, targets) {
    if (!data.length || !targets.length) return false;
    var len = data[0].length;
    var end = Math.min(this.length, pos + len);
    if (end <= pos) return false;
    for (var i = 0; i < targets.length; i++) {
      var a = this.channels[targets[i]];
      var src = data[i % data.length];
      for (var j = 0, p = pos; p < end; j++, p++) a[p] = src[j];
    }
    return true;
  };

  // ---------- Filtre (OfflineAudioContext ile pişir) ----------
  Engine.prototype.applyFilter = function (type, freq, gainDb, Q) {
    var self = this;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var off = new OAC(2, this.length, this.sampleRate);
    var buf = off.createBuffer(2, this.length, this.sampleRate);
    buf.copyToChannel(this.channels[0], 0);
    buf.copyToChannel(this.channels[1], 1);

    var src = off.createBufferSource();
    src.buffer = buf;
    var f = off.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.gain.value = gainDb;
    if (Q) f.Q.value = Q;
    src.connect(f); f.connect(off.destination);
    src.start();

    return off.startRendering().then(function (rendered) {
      // Yalnızca etkin kanalları yaz; kilitli kanal olduğu gibi kalır.
      if (self.active[0]) self.channels[0] = rendered.getChannelData(0).slice();
      if (self.active[1]) self.channels[1] = rendered.getChannelData(1).slice();
      return self;
    });
  };

  // ---------- Dışa aktarma ----------
  Engine.prototype.exportWAV = function (bitDepth) {
    return CaYa.wav.encodeWAV(this.channels, this.sampleRate, bitDepth);
  };

  CaYa.Engine = Engine;
})(window.CaYa = window.CaYa || {});
