/* ============================================================
   CaYaSound · i18n.js
   Türkçe / İngilizce. Cihaz diline göre otomatik seçim,
   algılanamazsa varsayılan İngilizce. Tercih localStorage'da.
   ============================================================ */
(function (CaYa) {
  'use strict';

  var DICT = {
    tr: {
      brand_tag: 'Ses Düzenleyici',
      btn_open: 'Aç', btn_open_t: 'Ses dosyası aç (O)',
      btn_undo: 'Geri Al', btn_undo_t: 'Geri al (Ctrl+Z)',
      btn_redo: 'Yinele', btn_redo_t: 'Yinele (Ctrl+Y)',
      btn_export: 'Dışa Aktar', btn_export_t: 'Dışa aktar (Ctrl+S)',
      lang_t: 'Dil / Language',

      t_start: 'Başa dön (Home)',
      t_play: 'Oynat / Duraklat (Boşluk)',
      t_stop: 'Durdur',
      t_vol: 'Dinleme sesi',
      t_zoomout: 'Uzaklaş', t_zoomfit: 'Sığdır', t_zoomin: 'Yakınlaş',
      zoom_fit: 'Sığdır',

      ch_left: 'SOL · L', ch_right: 'SAĞ · R',
      ch_locked: 'KİLİTLİ',
      ch_lock_t: 'Kanalı kilitle/aç — yalnız etkin kanal düzenlenir',

      dz_title: 'Ses dosyasını buraya bırak',
      dz_formats: 'WAV · MP3 · FLAC · OGG · M4A — ya da bilgisayardan seç',
      dz_open: 'Dosya Seç',
      dz_hint: 'Her şey tarayıcında işlenir · dosyaların hiçbir yere yüklenmez',

      sel_title: 'Seçim',
      sel_hint: 'Dalga üzerinde sürükleyerek bir bölge seç.',
      act_selectAll: 'Tümünü Seç', act_selectNone: 'Seçimi Kaldır',
      act_trim: 'Seçime Kırp', act_delete: 'Seçimi Sil',
      act_silence: 'Sustur', act_reverse: 'Ters Çevir',
      act_fadeIn: 'Fade In', act_fadeOut: 'Fade Out',
      act_copy: 'Kopyala', act_paste: 'Yapıştır',

      ch_title: 'Kanallar',
      ch_hint: 'Sol/sağ kanal işlemleri (tüm klip).',
      ch_lock_hint: 'İpucu: dalga üzerindeki SOL / SAĞ başlığına tıkla → yalnız o kanal düzenlenir (diğeri kilitlenir). Bir kanalı kopyalayıp diğerine yapıştırarak sesi taşıyabilirsin.',
      act_copyLR: 'Sol → Sağ Kopyala', act_copyRL: 'Sağ → Sol Kopyala',
      act_swap: 'Kanalları Değiştir', act_mono: 'Mono Yap',
      act_muteL: 'Sol Kanalı Kapat', act_muteR: 'Sağ Kanalı Kapat',

      fx_title: 'Efektler',
      fx_bass: 'Bas', fx_bass_apply: 'Bası Uygula',
      fx_treble: 'Tiz', fx_treble_apply: 'Tizi Uygula',
      fx_gain_moved: 'Kazanç için dalga üzerinde bir bölge seç ve beliren tutamacı yukarı/aşağı sürükle.',
      gain_handle_t: 'Sürükle: kazanç · tekerlek: ±1 dB · Shift: ince ayar',
      fx_tone_hint: 'Bas ve tiz tüm klibe uygulanır.',
      act_normalize: 'Normalleştir',

      file_title: 'Dosya',
      file_name: 'Ad', file_dur: 'Süre', file_rate: 'Örnekleme', file_ch: 'Kanal',

      busy_processing: 'İşleniyor…',
      busy_decoding: '“{name}” çözümleniyor…',
      busy_applying: '{label} uygulanıyor…',

      toast_loaded: '{name} yüklendi',
      toast_open_err: 'Dosya açılamadı: {e}',
      toast_need_region: 'Önce dalga üzerinde bir bölge seç',
      toast_need_del_region: 'Önce silinecek bölgeyi seç',
      toast_cant_del_all: 'Tümünü silemezsin',
      toast_op_fail: 'İşlem uygulanamadı',
      toast_applied: '{label} uygulandı',
      toast_gain_applied: 'Kazanç uygulandı: {db} dB',
      toast_fx_err: '{label} hatası: {e}',
      toast_exported: 'WAV dışa aktarıldı ({fmt})',
      toast_export_err: 'Dışa aktarma hatası: {e}',
      toast_copied: '{n} kanal kopyalandı',
      toast_pasted: 'Yapıştırıldı',
      toast_paste_empty: 'Önce bir bölge kopyala',
      toast_paste_pos: 'İmleç klibin sonunda — yapıştırılamıyor',
      toast_target_locked: 'Hedef kanal kilitli — önce başlığa tıklayıp aç',

      st_no_file: 'dosya yok',
      st_no_sel: 'seçim yok',
      st_sel: 'seçim {a} → {b}  ({d})',

      info_mono: '1 (mono → stereo)', info_stereo: '2 (stereo)',
      label_bass: 'Bas', label_treble: 'Tiz'
    },

    en: {
      brand_tag: 'Audio Editor',
      btn_open: 'Open', btn_open_t: 'Open audio file (O)',
      btn_undo: 'Undo', btn_undo_t: 'Undo (Ctrl+Z)',
      btn_redo: 'Redo', btn_redo_t: 'Redo (Ctrl+Y)',
      btn_export: 'Export', btn_export_t: 'Export (Ctrl+S)',
      lang_t: 'Language / Dil',

      t_start: 'Go to start (Home)',
      t_play: 'Play / Pause (Space)',
      t_stop: 'Stop',
      t_vol: 'Monitor volume',
      t_zoomout: 'Zoom out', t_zoomfit: 'Fit', t_zoomin: 'Zoom in',
      zoom_fit: 'Fit',

      ch_left: 'LEFT · L', ch_right: 'RIGHT · R',
      ch_locked: 'LOCKED',
      ch_lock_t: 'Lock/unlock channel — only the active channel is edited',

      dz_title: 'Drop your audio file here',
      dz_formats: 'WAV · MP3 · FLAC · OGG · M4A — or pick from your computer',
      dz_open: 'Choose File',
      dz_hint: 'Everything runs in your browser · your files are never uploaded',

      sel_title: 'Selection',
      sel_hint: 'Drag across the waveform to select a region.',
      act_selectAll: 'Select All', act_selectNone: 'Clear Selection',
      act_trim: 'Trim to Selection', act_delete: 'Delete Selection',
      act_silence: 'Silence', act_reverse: 'Reverse',
      act_fadeIn: 'Fade In', act_fadeOut: 'Fade Out',
      act_copy: 'Copy', act_paste: 'Paste',

      ch_title: 'Channels',
      ch_hint: 'Left/right channel operations (whole clip).',
      ch_lock_hint: 'Tip: click the LEFT / RIGHT header on the waveform → only that channel is edited (the other is locked). Copy one channel and paste into the other to move audio.',
      act_copyLR: 'Copy Left → Right', act_copyRL: 'Copy Right → Left',
      act_swap: 'Swap Channels', act_mono: 'Make Mono',
      act_muteL: 'Mute Left', act_muteR: 'Mute Right',

      fx_title: 'Effects',
      fx_bass: 'Bass', fx_bass_apply: 'Apply Bass',
      fx_treble: 'Treble', fx_treble_apply: 'Apply Treble',
      fx_gain_moved: 'For gain, select a region on the waveform and drag the handle that appears up or down.',
      gain_handle_t: 'Drag: gain · wheel: ±1 dB · Shift: fine',
      fx_tone_hint: 'Bass and treble apply to the whole clip.',
      act_normalize: 'Normalize',

      file_title: 'File',
      file_name: 'Name', file_dur: 'Duration', file_rate: 'Sample rate', file_ch: 'Channels',

      busy_processing: 'Processing…',
      busy_decoding: 'Decoding “{name}”…',
      busy_applying: 'Applying {label}…',

      toast_loaded: '{name} loaded',
      toast_open_err: 'Couldn’t open file: {e}',
      toast_need_region: 'First select a region on the waveform',
      toast_need_del_region: 'First select a region to delete',
      toast_cant_del_all: 'You can’t delete everything',
      toast_op_fail: 'Operation couldn’t be applied',
      toast_applied: '{label} applied',
      toast_gain_applied: 'Gain applied: {db} dB',
      toast_fx_err: '{label} error: {e}',
      toast_exported: 'WAV exported ({fmt})',
      toast_export_err: 'Export error: {e}',
      toast_copied: '{n} channel(s) copied',
      toast_pasted: 'Pasted',
      toast_paste_empty: 'Copy a region first',
      toast_paste_pos: 'Cursor is at the clip end — can’t paste',
      toast_target_locked: 'Target channel is locked — click its header to unlock',

      st_no_file: 'no file',
      st_no_sel: 'no selection',
      st_sel: 'selection {a} → {b}  ({d})',

      info_mono: '1 (mono → stereo)', info_stereo: '2 (stereo)',
      label_bass: 'Bass', label_treble: 'Treble'
    }
  };

  var LS_KEY = 'cayasound_lang';
  var current = 'en';

  function detect() {
    try {
      var stored = localStorage.getItem(LS_KEY);
      if (stored === 'tr' || stored === 'en') return stored;
    } catch (e) {}
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || navigator.userLanguage || ''];
    for (var i = 0; i < langs.length; i++) {
      var l = (langs[i] || '').toLowerCase();
      if (l.indexOf('tr') === 0) return 'tr';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'en'; // varsayılan / default: İngilizce
  }

  function t(key, params) {
    var d = DICT[current] || DICT.en;
    var s = d[key];
    if (s == null) s = (DICT.en[key] != null ? DICT.en[key] : key);
    if (params) for (var k in params) s = s.split('{' + k + '}').join(params[k]);
    return s;
  }

  function apply(lang) {
    if (lang === 'tr' || lang === 'en') current = lang;
    try { localStorage.setItem(LS_KEY, current); } catch (e) {}
    document.documentElement.setAttribute('lang', current);
    document.title = 'CaYaSound · ' + t('brand_tag');

    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));

    var tt = document.querySelectorAll('[data-i18n-title]');
    for (var j = 0; j < tt.length; j++) tt[j].title = t(tt[j].getAttribute('data-i18n-title'));

    if (typeof CaYa.onLangChange === 'function') CaYa.onLangChange(current);
  }

  CaYa.i18n = {
    t: t,
    apply: apply,
    detect: detect,
    current: function () { return current; },
    toggle: function () { apply(current === 'tr' ? 'en' : 'tr'); return current; }
  };
})(window.CaYa = window.CaYa || {});
