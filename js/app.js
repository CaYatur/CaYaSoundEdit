/* ============================================================
   CaYaSound · app.js
   UI orkestrasyonu: dosya G/Ç, transport, araçlar, geçmiş,
   klavye kısayolları, oynatma imleci animasyonu.
   ============================================================ */
(function (CaYa) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var $ = function (id) { return document.getElementById(id); };

    var engine = new CaYa.Engine();
    var hist = new CaYa.History(180 * 1024 * 1024);

    var wf = new CaYa.Waveform({
      ruler: $('ruler'), waveL: $('waveL'), waveR: $('waveR'), overlay: $('overlay'),
      scrollHost: $('waveScroll'), hbar: $('hbar'), hbarThumb: $('hbarThumb'),
      onSeek: function (sample) { setCursor(sample); },
      onSelect: function (sel) { setSelection(sel); }
    });

    var state = { cursor: 0, selection: null, playFrom: 0, raf: null };

    /* ---------- yardımcılar ---------- */
    function fmtTime(sec) {
      if (!isFinite(sec) || sec < 0) sec = 0;
      var m = Math.floor(sec / 60);
      var s = sec - m * 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
    }
    function toast(type, msg) {
      var t = document.createElement('div');
      t.className = 'toast ' + (type || '');
      t.textContent = msg;
      $('toasts').appendChild(t);
      setTimeout(function () { t.remove(); }, 3000);
    }
    function busy(txt) { $('busyText').textContent = txt || 'İşleniyor…'; $('busy').hidden = false; }
    function unbusy() { $('busy').hidden = true; }
    function download(blob, name) {
      var a = document.createElement('a');
      var url = URL.createObjectURL(blob);
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    /* ---------- görsel güncelleme ---------- */
    function paintOverlay() {
      var play = engine.playing ? engine.getPlayheadSample() : null;
      wf.drawOverlay(state.cursor, state.selection, play);
    }
    function updateTime(ph) {
      var sr = engine.sampleRate || 44100;
      var cur = ph != null ? ph / sr : state.cursor / sr;
      $('timeCur').textContent = fmtTime(cur);
      $('stCursor').textContent = fmtTime(cur);
      $('timeDur').textContent = fmtTime(engine.duration());
    }
    function updateSelStatus() {
      var s = state.selection, sr = engine.sampleRate || 44100;
      if (s && s.end > s.start) {
        $('stSel').textContent = 'seçim ' + fmtTime(s.start / sr) + ' → ' + fmtTime(s.end / sr) +
          '  (' + fmtTime((s.end - s.start) / sr) + ')';
      } else {
        $('stSel').textContent = 'seçim yok';
      }
    }
    function updateInfo() {
      $('infName').textContent = engine.name || '—';
      $('infName').title = engine.name || '';
      $('infDur').textContent = fmtTime(engine.duration());
      $('infRate').textContent = engine.sampleRate + ' Hz';
      $('infCh').textContent = engine.sourceChannels <= 1 ? '1 (mono → stereo)' : '2 (stereo)';
      $('stFile').textContent = engine.name || 'dosya yok';
    }
    function updateUndoRedo() {
      $('btnUndo').disabled = !hist.canUndo();
      $('btnRedo').disabled = !hist.canRedo();
    }

    /* ---------- imleç / seçim ---------- */
    function setCursor(sample) {
      state.cursor = Math.max(0, Math.min(engine.length, Math.round(sample)));
      updateTime(null); paintOverlay();
    }
    function setSelection(sel) {
      if (sel && sel.end > sel.start) {
        state.selection = {
          start: Math.max(0, Math.min(engine.length, sel.start)),
          end: Math.max(0, Math.min(engine.length, sel.end))
        };
      } else {
        state.selection = null;
      }
      updateSelStatus(); paintOverlay();
    }
    function clampAfterEdit(structural) {
      if (structural) {
        // Zaman çizelgesini değiştiren işlemler (kırp/sil): seçim artık geçersiz.
        state.selection = null;
        state.cursor = 0;
      } else if (state.selection) {
        var s = state.selection;
        if (s.end > engine.length || s.start >= engine.length || s.start >= s.end) state.selection = null;
      }
      state.cursor = Math.max(0, Math.min(engine.length, state.cursor));
    }
    function range() {
      if (state.selection && state.selection.end > state.selection.start)
        return [state.selection.start, state.selection.end];
      return [0, engine.length];
    }

    /* ---------- düzenleme commit ---------- */
    function afterEdit() {
      wf.setChannels(engine.channels);
      updateUndoRedo(); updateInfo(); updateSelStatus(); updateTime(null); paintOverlay();
    }
    function commit(fn, resetCursor) {
      if (engine.playing) stopPlayback();
      var snap = engine.snapshot();
      var res = fn();
      if (res === false) { toast('err', 'İşlem uygulanamadı'); return; }
      hist.record(snap);
      clampAfterEdit(resetCursor);
      afterEdit();
    }
    function commitAsync(label, promiseFn) {
      if (engine.playing) stopPlayback();
      var snap = engine.snapshot();
      busy(label + ' uygulanıyor…');
      promiseFn().then(function () {
        hist.record(snap);
        afterEdit();
        toast('ok', label + ' uygulandı');
      }).catch(function (e) {
        toast('err', label + ' hatası: ' + (e && e.message ? e.message : e));
      }).then(unbusy);
    }

    /* ---------- oynatma ---------- */
    function setPlaying(on) {
      document.body.classList.toggle('is-playing', on);
      if (on) { if (!state.raf) state.raf = requestAnimationFrame(tick); }
      else {
        if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
        paintOverlay(); updateTime(null);
      }
    }
    function tick() {
      if (!engine.playing) { state.raf = null; return; }
      var ph = engine.getPlayheadSample();
      if (wf.zoom > 1) {
        var x = wf.sampleToX(ph);
        if (x > wf.width * 0.94 || x < 0) {
          wf.scroll = ph - wf.width * 0.1 * wf.spp();
          wf.clampScroll(); wf.draw();
        }
      }
      wf.drawOverlay(state.cursor, state.selection, ph);
      updateTime(ph);
      state.raf = requestAnimationFrame(tick);
    }
    function togglePlay() {
      if (!engine.hasAudio()) return;
      if (engine.playing) {
        state.cursor = Math.round(engine.getPlayheadSample());
        engine.stop(); setPlaying(false);
      } else {
        var s = state.selection;
        if (s && s.end > s.start) { state.playFrom = s.start; engine.play(s.start, s.end); }
        else {
          var from = state.cursor >= engine.length ? 0 : state.cursor;
          state.playFrom = from; engine.play(from, null);
        }
        setPlaying(true);
      }
    }
    function stopPlayback() {
      if (engine.playing) { engine.stop(); }
      setPlaying(false);
    }
    engine.onEnded = function () {
      state.cursor = state.playFrom;
      setPlaying(false);
    };

    /* ---------- dosya açma ---------- */
    function openFile(file) {
      if (!file) return;
      busy('“' + file.name + '” çözümleniyor…');
      var reader = file.arrayBuffer ? file.arrayBuffer() : readAsArrayBuffer(file);
      reader.then(function (ab) {
        return engine.loadFile(ab, file.name);
      }).then(function () {
        hist.clear();
        state.cursor = 0; state.selection = null;
        wf.setData(engine.channels, engine.sampleRate);
        setLoaded();
        updateInfo(); updateSelStatus(); updateTime(null); updateUndoRedo(); paintOverlay();
        $('dropzone').classList.add('hide');
        toast('ok', file.name + ' yüklendi');
      }).catch(function (e) {
        toast('err', 'Dosya açılamadı: ' + (e && e.message ? e.message : e));
      }).then(unbusy);
    }
    function readAsArrayBuffer(file) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { rej(fr.error); };
        fr.readAsArrayBuffer(file);
      });
    }

    /* ---------- kontrolleri etkinleştir ---------- */
    function setLoaded() {
      var sel = '.tool, .fx-apply, #btnExport, #btnStart, #btnPlay, #btnStop, ' +
        '#btnZoomIn, #btnZoomOut, #btnZoomFit, #bassRange, #trebleRange, #ampRange';
      var els = document.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) els[i].disabled = false;
    }

    /* ---------- eylem dağıtıcı ---------- */
    function doAct(act) {
      if (!engine.hasAudio()) return;
      var r;
      switch (act) {
        case 'selectAll': setSelection({ start: 0, end: engine.length }); break;
        case 'selectNone': setSelection(null); break;
        case 'trim':
          if (!state.selection) { toast('err', 'Önce dalga üzerinde bir bölge seç'); break; }
          var st = state.selection;
          commit(function () { engine.trim(st.start, st.end); }, true);
          break;
        case 'delete':
          if (!state.selection) { toast('err', 'Önce silinecek bölgeyi seç'); break; }
          var sd = state.selection;
          if (sd.end - sd.start >= engine.length) { toast('err', 'Tümünü silemezsin'); break; }
          commit(function () { engine.deleteRange(sd.start, sd.end); }, true);
          break;
        case 'silence': r = range(); commit(function () { engine.silenceRange(r[0], r[1]); }); break;
        case 'reverse': r = range(); commit(function () { engine.reverseRange(r[0], r[1]); }); break;
        case 'fadeIn': r = range(); commit(function () { engine.fade(r[0], r[1], 'in'); }); break;
        case 'fadeOut': r = range(); commit(function () { engine.fade(r[0], r[1], 'out'); }); break;
        case 'copyLR': commit(function () { engine.copyChannel(0, 1); }); break;
        case 'copyRL': commit(function () { engine.copyChannel(1, 0); }); break;
        case 'swap': commit(function () { engine.swap(); }); break;
        case 'mono': commit(function () { engine.mono(); }); break;
        case 'muteL': commit(function () { engine.silenceChannel(0); }); break;
        case 'muteR': commit(function () { engine.silenceChannel(1); }); break;
        case 'normalize':
          r = range();
          commit(function () { return engine.normalize(-0.3, r[0], r[1]); });
          break;
        case 'amplify':
          r = range();
          var db = parseFloat($('ampRange').value) || 0;
          commit(function () { engine.amplify(db, r[0], r[1]); });
          break;
        case 'bass':
          commitAsync('Bas', function () {
            return engine.applyFilter('lowshelf', 200, parseFloat($('bassRange').value) || 0, 0);
          });
          break;
        case 'treble':
          commitAsync('Tiz', function () {
            return engine.applyFilter('highshelf', 3200, parseFloat($('trebleRange').value) || 0, 0);
          });
          break;
      }
    }

    /* ---------- geçmiş ---------- */
    function undo() {
      if (engine.playing) stopPlayback();
      var prev = hist.undo(engine.snapshot());
      if (!prev) return;
      engine.restore(prev);
      clampAfterEdit(false); afterEdit();
    }
    function redo() {
      if (engine.playing) stopPlayback();
      var next = hist.redo(engine.snapshot());
      if (!next) return;
      engine.restore(next);
      clampAfterEdit(false); afterEdit();
    }

    /* ---------- dışa aktarma ---------- */
    function exportWav() {
      if (!engine.hasAudio()) return;
      var depth = parseInt($('fmtSelect').value, 10);
      try {
        var blob = engine.exportWAV(depth);
        var base = (engine.name || 'ses').replace(/\.[^.]+$/, '');
        download(blob, base + '-cayasound.wav');
        toast('ok', 'WAV dışa aktarıldı (' + (depth === 32 ? '32-bit float' : '16-bit PCM') + ')');
      } catch (e) {
        toast('err', 'Dışa aktarma hatası: ' + e.message);
      }
    }

    /* ---------- olay bağları ---------- */
    $('btnOpen').addEventListener('click', function () { $('fileInput').click(); });
    $('dzOpen').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) openFile(e.target.files[0]);
      e.target.value = '';
    });

    $('btnPlay').addEventListener('click', togglePlay);
    $('btnStop').addEventListener('click', function () {
      state.cursor = state.playFrom; stopPlayback(); paintOverlay();
    });
    $('btnStart').addEventListener('click', function () {
      stopPlayback(); setCursor(0); wf.scroll = 0; wf.clampScroll(); wf.draw(); paintOverlay();
    });

    $('volSlider').addEventListener('input', function (e) {
      var v = parseInt(e.target.value, 10);
      engine.setVolume(v / 100);
      $('volVal').textContent = v + '%';
    });

    $('btnZoomIn').addEventListener('click', function () { wf.zoomIn(); });
    $('btnZoomOut').addEventListener('click', function () { wf.zoomOut(); });
    $('btnZoomFit').addEventListener('click', function () { wf.zoomFit(); });

    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);
    $('btnExport').addEventListener('click', exportWav);

    // araç butonları
    var tools = document.querySelectorAll('[data-act]');
    for (var i = 0; i < tools.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () { doAct(btn.getAttribute('data-act')); });
      })(tools[i]);
    }

    // efekt kaydırıcı etiketleri
    function sign(v) { return (v > 0 ? '+' : '') + v; }
    $('bassRange').addEventListener('input', function (e) { $('bassVal').textContent = sign(e.target.value) + ' dB'; });
    $('trebleRange').addEventListener('input', function (e) { $('trebleVal').textContent = sign(e.target.value) + ' dB'; });
    $('ampRange').addEventListener('input', function (e) { $('ampVal').textContent = sign(e.target.value) + ' dB'; });
    // başlangıç etiketleri
    $('bassVal').textContent = sign($('bassRange').value) + ' dB';
    $('trebleVal').textContent = sign($('trebleRange').value) + ' dB';
    $('ampVal').textContent = sign($('ampRange').value) + ' dB';

    /* ---------- sürükle-bırak ---------- */
    var dz = $('dropzone'), ww = $('waveWrap');
    function stop(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(function (ev) {
      ww.addEventListener(ev, function (e) { stop(e); dz.classList.add('drag'); dz.classList.remove('hide'); });
    });
    ['dragleave', 'dragend'].forEach(function (ev) {
      ww.addEventListener(ev, function (e) { stop(e); dz.classList.remove('drag'); if (engine.hasAudio()) dz.classList.add('hide'); });
    });
    ww.addEventListener('drop', function (e) {
      stop(e); dz.classList.remove('drag');
      var f = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
      if (f) openFile(f); else if (engine.hasAudio()) dz.classList.add('hide');
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    /* ---------- klavye ---------- */
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      var mod = e.ctrlKey || e.metaKey;

      if (e.code === 'Space') { e.preventDefault(); togglePlay(); return; }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); exportWav(); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); if (engine.hasAudio()) setSelection({ start: 0, end: engine.length }); return; }
      if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); doAct('delete'); return; }
      if (e.key === 'Home') { e.preventDefault(); stopPlayback(); setCursor(0); return; }
      if (!mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); wf.zoomIn(); return; }
      if (!mod && e.key === '-') { e.preventDefault(); wf.zoomOut(); return; }
    });

    // ilk çizim (boş)
    wf.resize();
    updateTime(null);
    // hata ayıklama / test için dışa ver
    CaYa.app = { engine: engine, wf: wf, hist: hist, state: state, openFile: openFile, doAct: doAct, exportWav: exportWav };
  });
})(window.CaYa = window.CaYa || {});
