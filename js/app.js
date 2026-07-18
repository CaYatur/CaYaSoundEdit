/* ============================================================
   CaYaSound · app.js
   UI orkestrasyonu: dosya G/Ç, transport, araçlar, geçmiş,
   klavye kısayolları, oynatma imleci animasyonu.
   ============================================================ */
(function (CaYa) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var $ = function (id) { return document.getElementById(id); };
    var t = CaYa.i18n.t;

    var engine = new CaYa.Engine();
    var hist = new CaYa.History(180 * 1024 * 1024);

    var wf = new CaYa.Waveform({
      ruler: $('ruler'), waveL: $('waveL'), waveR: $('waveR'), overlay: $('overlay'),
      scrollHost: $('waveScroll'), hbar: $('hbar'), hbarThumb: $('hbarThumb'),
      onSeek: function (sample) { setCursor(sample); },
      onSelect: function (sel) { setSelection(sel); },
      onView: function () { positionGainHandle(); }
    });

    var state = { cursor: 0, selection: null, playFrom: 0, raf: null, clipboard: null };

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
    function busy(txt) { $('busyText').textContent = txt || t('busy_processing'); $('busy').hidden = false; }
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
        $('stSel').textContent = t('st_sel', {
          a: fmtTime(s.start / sr), b: fmtTime(s.end / sr), d: fmtTime((s.end - s.start) / sr)
        });
      } else {
        $('stSel').textContent = t('st_no_sel');
      }
    }
    function updateInfo() {
      if (engine.hasAudio()) {
        $('infName').textContent = engine.name || '—';
        $('infName').title = engine.name || '';
        $('infDur').textContent = fmtTime(engine.duration());
        $('infRate').textContent = engine.sampleRate + ' Hz';
        $('infCh').textContent = engine.sourceChannels <= 1 ? t('info_mono') : t('info_stereo');
        $('stFile').textContent = engine.name;
      } else {
        $('infName').textContent = '—'; $('infName').title = '';
        $('infDur').textContent = '—'; $('infRate').textContent = '—'; $('infCh').textContent = '—';
        $('stFile').textContent = t('st_no_file');
      }
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
      commitGain(); endGainRun();  // seçim değişmeden önce bekleyeni kesinleştir, seriyi bitir
      if (sel && sel.end > sel.start) {
        state.selection = {
          start: Math.max(0, Math.min(engine.length, sel.start)),
          end: Math.max(0, Math.min(engine.length, sel.end))
        };
      } else {
        state.selection = null;
      }
      updateSelStatus(); paintOverlay(); positionGainHandle();
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

    /* ---------- kayan Kazanç tutamacı ----------
       Seçim üzerinde belirir; dikey sürükleyerek (veya tekerlekle) kazanç
       uygulanır. Bir "hareket" (basılı-sürükle ya da tekerlek serisi) TEK
       geçmiş adımıdır: önizleme her karede taban dilimden yeniden türetilir
       (birikmez), bırakınca yalnızca bir kez kaydedilir. Böylece Ctrl+Z tek
       adımda tam olarak geri döner. */
    var ghEl = $('gainHandle'), ghVal = $('gainHandleVal');
    var GAIN_MAX = 24;
    var gain = null;         // etkin oturum: { base:[L,R], start, end, db, raf, wheelTimer }
    var gainRun = null;      // aynı seçimde art arda kazançları TEK geçmiş adımında birleştir
    function endGainRun() { gainRun = null; } // başka bir işlem seriyi bozar

    function fmtDb(db) {
      var r = Math.round(db * 10) / 10;
      if (r === 0) r = 0; // -0'ı normalle
      return (r >= 0 ? '+' : '') + r.toFixed(1) + ' dB';
    }
    function positionGainHandle() {
      var s = state.selection;
      if (!engine.hasAudio() || !s || s.end <= s.start) { ghEl.hidden = true; return; }
      var x0 = wf.sampleToX(s.start), x1 = wf.sampleToX(s.end);
      if (x1 < 0 || x0 > wf.width) { ghEl.hidden = true; return; } // seçim görünmüyor
      var mid = (Math.max(0, x0) + Math.min(wf.width, x1)) / 2;
      ghEl.hidden = false;
      var half = (ghEl.offsetWidth || 120) / 2, pad = 6;
      var cx = Math.max(half + pad, Math.min(wf.width - half - pad, mid));
      ghEl.style.left = cx + 'px';
      if (!gain) ghVal.textContent = fmtDb(0);
    }
    function beginGain() {
      commitGain(); // varsa önceki oturumu kesinleştir
      var s = state.selection;
      if (!engine.hasAudio() || !s || s.end <= s.start) return false;
      if (engine.playing) stopPlayback();
      // Yalnızca bölgenin taban kopyasını sakla (tüm klibin değil): hareket
      // yalnızca [start,end] aralığını değiştirir; geçmiş anlık görüntüsü
      // gerekirse commit anında bundan yeniden kurulur (boşa kopya yok).
      gain = {
        base: [engine.channels[0].slice(s.start, s.end), engine.channels[1].slice(s.start, s.end)],
        start: s.start, end: s.end, db: 0, raf: 0, wheelTimer: 0
      };
      ghEl.classList.add('dragging');
      return true;
    }
    function renderGain() {
      if (!gain) return;
      gain.raf = 0;
      engine.setRegionGain(gain.base, gain.start, gain.end, gain.db);
      wf.draw(); // wf.channels === engine.channels → yerinde yazım anında görünür
    }
    function updateGain(db) {
      if (!gain) return;
      if (db > GAIN_MAX) db = GAIN_MAX; else if (db < -GAIN_MAX) db = -GAIN_MAX;
      gain.db = db;
      ghVal.textContent = fmtDb(db);
      ghEl.setAttribute('aria-valuenow', Math.round(db));
      if (!gain.raf) gain.raf = requestAnimationFrame(renderGain);
    }
    function commitGain() {
      if (!gain) return;
      var g = gain; gain = null; // yeniden-giriş güvenliği: önce temizle
      if (g.wheelTimer) clearTimeout(g.wheelTimer);
      if (g.raf) cancelAnimationFrame(g.raf);
      ghEl.classList.remove('dragging');
      var db = Math.round(g.db * 10) / 10;
      engine.setRegionGain(g.base, g.start, g.end, db); // son durumu kesinleştir
      ghVal.textContent = fmtDb(0); // baklandı → tutamak yine +0'da bekler
      if (db === 0) { wf.setChannels(engine.channels); return; } // net değişiklik yok
      // Aynı seçimde art arda kazanç: yalnızca İLK hareket geçmişe yazılır.
      // Sonrakiler o anlık görüntüyü korur → tek Ctrl+Z serinin tamamını geri alır.
      if (gainRun && gainRun.start === g.start && gainRun.end === g.end) {
        afterEdit();
      } else {
        // Hareket öncesi durumu yeniden kur: mevcut klip + bölgeye taban dilimi.
        var snap = engine.snapshot();
        snap.channels[0].set(g.base[0], g.start);
        snap.channels[1].set(g.base[1], g.start);
        hist.record(snap);
        gainRun = { start: g.start, end: g.end };
        afterEdit();
      }
      toast('ok', t('toast_gain_applied', { db: (db > 0 ? '+' : '') + db }));
    }

    (function bindGainHandle() {
      var dragging = false, startY = 0, startDb = 0, fine = false;
      function down(e) {
        if (e.button != null && e.button !== 0) return; // sadece sol tuş
        if (!beginGain()) return;
        dragging = true; startY = e.clientY; startDb = gain.db; fine = e.shiftKey;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        e.preventDefault(); e.stopPropagation();
      }
      function move(e) {
        if (!dragging || !gain) return;
        var sens = fine ? 0.05 : 0.2;      // dB / piksel
        updateGain(startDb + (startY - e.clientY) * sens); // yukarı = artı
        e.preventDefault();
      }
      function up() {
        dragging = false;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        commitGain();
      }
      ghEl.addEventListener('pointerdown', down);

      // Tekerlek: ±1 dB; kısa boşluktan sonra tek geçmiş adımı olarak kaydet
      ghEl.addEventListener('wheel', function (e) {
        if (!engine.hasAudio() || !state.selection) return;
        if (!gain && !beginGain()) return;
        updateGain(gain.db + (e.deltaY < 0 ? 1 : -1));
        if (gain.wheelTimer) clearTimeout(gain.wheelTimer);
        gain.wheelTimer = setTimeout(commitGain, 500);
        e.preventDefault(); e.stopPropagation();
      }, { passive: false });

      // Çift tık: bekleyen ayarı sıfırla
      ghEl.addEventListener('dblclick', function (e) {
        if (gain) updateGain(0);
        e.preventDefault();
      });
    })();

    /* ---------- kanal kilidi (solo) + pano ----------
       Kanal başlığına tıkla → yalnız o kanal düzenlenir (solo), diğeri kilitlenir;
       aynı başlığa tekrar tıkla → iki kanal da açılır. Bölge/efekt işlemleri ve
       Kopyala/Yapıştır yalnızca ETKİN kanallara uygulanır. Böylece bir kanalı
       kopyalayıp diğerini açıp yapıştırarak sesi kanaldan kanala taşıyabilirsin. */
    var chanEls = [$('chanL'), $('chanR')];
    var btnPaste = document.querySelector('[data-act="paste"]');
    function updateChannelUI() {
      var a = engine.active, solo = a[0] !== a[1];
      for (var c = 0; c < 2; c++) {
        chanEls[c].classList.toggle('ch-locked', !a[c]);
        chanEls[c].classList.toggle('ch-active', a[c] && solo);
        var lbl = chanEls[c].querySelector('.ch-label');
        if (lbl) lbl.setAttribute('aria-pressed', String(!a[c]));
      }
    }
    function toggleChannel(ch) {
      if (!engine.hasAudio()) return;
      commitGain(); endGainRun(); // sürüklenen kazanç varsa önce kesinleştir
      var a = engine.active;
      var soloThis = a[ch] && !a[ch ^ 1];          // ch şu an tek etkin kanal mı
      engine.active = soloThis ? [true, true]      // → iki kanalı da aç
                    : (ch === 0 ? [true, false] : [false, true]); // → yalnız ch etkin
      updateChannelUI();
    }
    function refreshPaste() { if (btnPaste) btnPaste.disabled = !engine.hasAudio() || !state.clipboard; }
    function activeChannels() {
      var t = [];
      for (var c = 0; c < 2; c++) if (engine.active[c]) t.push(c);
      return t;
    }
    function doCopy() {
      if (!engine.hasAudio()) return;
      var r = range(), data = [], t2 = activeChannels();
      for (var i = 0; i < t2.length; i++) data.push(engine.channels[t2[i]].slice(r[0], r[1]));
      if (!data.length) return;
      state.clipboard = { data: data };
      refreshPaste();
      toast('ok', t('toast_copied', { n: data.length }));
    }
    function doPaste() {
      if (!engine.hasAudio()) return;
      if (!state.clipboard) { toast('err', t('toast_paste_empty')); return; }
      var targets = activeChannels();
      if (!targets.length) return;
      var pos = (state.selection && state.selection.end > state.selection.start)
        ? state.selection.start : state.cursor;
      if (pos >= engine.length) { toast('err', t('toast_paste_pos')); return; }
      var cb = state.clipboard;
      commit(function () { engine.pasteOverwrite(cb.data, pos, targets); });
      toast('ok', t('toast_pasted'));
    }
    function writesLocked(chs) {
      for (var i = 0; i < chs.length; i++) if (!engine.active[chs[i]]) return true;
      return false;
    }

    /* ---------- düzenleme commit ---------- */
    function afterEdit() {
      wf.setChannels(engine.channels);
      updateUndoRedo(); updateInfo(); updateSelStatus(); updateTime(null); paintOverlay();
    }
    function commit(fn, resetCursor) {
      commitGain(); endGainRun();
      if (engine.playing) stopPlayback();
      var snap = engine.snapshot();
      var res = fn();
      if (res === false) { toast('err', t('toast_op_fail')); return; }
      hist.record(snap);
      clampAfterEdit(resetCursor);
      afterEdit();
    }
    function commitAsync(label, promiseFn) {
      commitGain(); endGainRun();
      if (engine.playing) stopPlayback();
      var snap = engine.snapshot();
      busy(t('busy_applying', { label: label }));
      promiseFn().then(function () {
        hist.record(snap);
        afterEdit();
        toast('ok', t('toast_applied', { label: label }));
      }).catch(function (e) {
        toast('err', t('toast_fx_err', { label: label, e: (e && e.message ? e.message : e) }));
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
      commitGain();
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
      commitGain(); endGainRun();
      busy(t('busy_decoding', { name: file.name }));
      var reader = file.arrayBuffer ? file.arrayBuffer() : readAsArrayBuffer(file);
      reader.then(function (ab) {
        return engine.loadFile(ab, file.name);
      }).then(function () {
        hist.clear();
        state.cursor = 0; state.selection = null;
        engine.active = [true, true]; state.clipboard = null; // kilit + pano sıfırla
        wf.setData(engine.channels, engine.sampleRate);
        setLoaded();
        updateChannelUI(); refreshPaste();
        updateInfo(); updateSelStatus(); updateTime(null); updateUndoRedo(); paintOverlay();
        $('dropzone').classList.add('hide');
        toast('ok', t('toast_loaded', { name: file.name }));
      }).catch(function (e) {
        toast('err', t('toast_open_err', { e: (e && e.message ? e.message : e) }));
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
      var sel = '.tool, .fx-apply, .ch-label, #btnExport, #btnStart, #btnPlay, #btnStop, ' +
        '#btnZoomIn, #btnZoomOut, #btnZoomFit, #bassRange, #trebleRange';
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
          if (!state.selection) { toast('err', t('toast_need_region')); break; }
          var st = state.selection;
          commit(function () { engine.trim(st.start, st.end); }, true);
          break;
        case 'delete':
          if (!state.selection) { toast('err', t('toast_need_del_region')); break; }
          var sd = state.selection;
          if (sd.end - sd.start >= engine.length) { toast('err', t('toast_cant_del_all')); break; }
          commit(function () { engine.deleteRange(sd.start, sd.end); }, true);
          break;
        case 'silence': r = range(); commit(function () { engine.silenceRange(r[0], r[1]); }); break;
        case 'reverse': r = range(); commit(function () { engine.reverseRange(r[0], r[1]); }); break;
        case 'fadeIn': r = range(); commit(function () { engine.fade(r[0], r[1], 'in'); }); break;
        case 'fadeOut': r = range(); commit(function () { engine.fade(r[0], r[1], 'out'); }); break;
        case 'copy': doCopy(); break;
        case 'paste': doPaste(); break;
        // Kanal yönlendirme işlemleri kilitli hedef kanala yazamaz.
        case 'copyLR':
          if (writesLocked([1])) { toast('err', t('toast_target_locked')); break; }
          commit(function () { engine.copyChannel(0, 1); }); break;
        case 'copyRL':
          if (writesLocked([0])) { toast('err', t('toast_target_locked')); break; }
          commit(function () { engine.copyChannel(1, 0); }); break;
        case 'swap':
          if (writesLocked([0, 1])) { toast('err', t('toast_target_locked')); break; }
          commit(function () { engine.swap(); }); break;
        case 'mono':
          if (writesLocked([0, 1])) { toast('err', t('toast_target_locked')); break; }
          commit(function () { engine.mono(); }); break;
        case 'muteL':
          if (writesLocked([0])) { toast('err', t('toast_target_locked')); break; }
          commit(function () { engine.silenceChannel(0); }); break;
        case 'muteR':
          if (writesLocked([1])) { toast('err', t('toast_target_locked')); break; }
          commit(function () { engine.silenceChannel(1); }); break;
        case 'normalize':
          r = range();
          commit(function () { return engine.normalize(-0.3, r[0], r[1]); });
          break;
        case 'bass':
          commitAsync(t('label_bass'), function () {
            return engine.applyFilter('lowshelf', 200, parseFloat($('bassRange').value) || 0, 0);
          });
          break;
        case 'treble':
          commitAsync(t('label_treble'), function () {
            return engine.applyFilter('highshelf', 3200, parseFloat($('trebleRange').value) || 0, 0);
          });
          break;
      }
    }

    /* ---------- geçmiş ---------- */
    function undo() {
      commitGain(); endGainRun();
      if (engine.playing) stopPlayback();
      var prev = hist.undo(engine.snapshot());
      if (!prev) return;
      engine.restore(prev);
      clampAfterEdit(false); afterEdit();
    }
    function redo() {
      commitGain(); endGainRun();
      if (engine.playing) stopPlayback();
      var next = hist.redo(engine.snapshot());
      if (!next) return;
      engine.restore(next);
      clampAfterEdit(false); afterEdit();
    }

    /* ---------- dışa aktarma ---------- */
    function exportWav() {
      if (!engine.hasAudio()) return;
      commitGain();
      var depth = parseInt($('fmtSelect').value, 10);
      try {
        var blob = engine.exportWAV(depth);
        var base = (engine.name || 'ses').replace(/\.[^.]+$/, '');
        download(blob, base + '-cayasound.wav');
        toast('ok', t('toast_exported', { fmt: (depth === 32 ? '32-bit float' : '16-bit PCM') }));
      } catch (e) {
        toast('err', t('toast_export_err', { e: e.message }));
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
    $('btnLang').addEventListener('click', function () {
      $('langLabel').textContent = CaYa.i18n.toggle().toUpperCase();
    });

    // araç butonları
    var tools = document.querySelectorAll('[data-act]');
    for (var i = 0; i < tools.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () { doAct(btn.getAttribute('data-act')); });
      })(tools[i]);
    }

    // kanal başlıkları = kilit (solo) düğmesi
    var chLabels = document.querySelectorAll('.ch-label');
    for (var ci = 0; ci < chLabels.length; ci++) {
      (function (b) {
        b.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); // seçim başlatma
        b.addEventListener('click', function () { toggleChannel(parseInt(b.getAttribute('data-ch'), 10)); });
      })(chLabels[ci]);
    }

    // efekt kaydırıcı etiketleri
    function sign(v) { return (v > 0 ? '+' : '') + v; }
    $('bassRange').addEventListener('input', function (e) { $('bassVal').textContent = sign(e.target.value) + ' dB'; });
    $('trebleRange').addEventListener('input', function (e) { $('trebleVal').textContent = sign(e.target.value) + ' dB'; });
    // başlangıç etiketleri
    $('bassVal').textContent = sign($('bassRange').value) + ' dB';
    $('trebleVal').textContent = sign($('trebleRange').value) + ' dB';

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
    // Butona tıklayınca odağı bırak: Boşluk ve kısayollar her zaman çalışsın
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (b) b.blur();
    });

    document.addEventListener('keydown', function (e) {
      var el = e.target, tag = (el.tagName || '').toUpperCase();
      var typing = tag === 'TEXTAREA' || tag === 'SELECT' ||
        (tag === 'INPUT' && el.type !== 'range') || el.isContentEditable;

      // Boşluk = Oynat/Duraklat — odak nerede olursa olsun (metin kutuları hariç)
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        if (typing) return;
        e.preventDefault();
        if (el && el.blur) el.blur();
        togglePlay();
        return;
      }
      if (typing) return;

      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); exportWav(); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); if (engine.hasAudio()) setSelection({ start: 0, end: engine.length }); return; }
      if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); doAct('copy'); return; }
      if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); doAct('paste'); return; }
      if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); doAct('delete'); return; }
      if (e.key === 'Home') { e.preventDefault(); stopPlayback(); setCursor(0); return; }
      if (!mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); wf.zoomIn(); return; }
      if (!mod && e.key === '-') { e.preventDefault(); wf.zoomOut(); return; }
    });

    // dil: cihaz diline göre; algılanamazsa İngilizce. Statik + dinamik metinleri kur.
    CaYa.onLangChange = function () {
      updateInfo(); updateSelStatus(); updateTime(null);
      $('langLabel').textContent = CaYa.i18n.current().toUpperCase();
    };
    CaYa.i18n.apply(CaYa.i18n.detect());

    // ilk çizim (boş)
    wf.resize();
    updateTime(null);
    updateChannelUI();
    // hata ayıklama / test için dışa ver
    CaYa.app = { engine: engine, wf: wf, hist: hist, state: state, openFile: openFile, doAct: doAct, exportWav: exportWav, toggleChannel: toggleChannel };
  });
})(window.CaYa = window.CaYa || {});
