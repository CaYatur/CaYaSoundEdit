/* ============================================================
   CaYaSound · wav.js
   Kanal verilerini (Float32Array[]) WAV Blob'una kodlar.
   bitDepth: 16 (PCM tamsayı) veya 32 (IEEE float)
   ============================================================ */
(function (CaYa) {
  'use strict';

  function encodeWAV(channels, sampleRate, bitDepth) {
    bitDepth = bitDepth === 32 ? 32 : 16;
    var numChannels = channels.length;
    var numFrames = channels[0] ? channels[0].length : 0;
    var bytesPerSample = bitDepth / 8;
    var blockAlign = numChannels * bytesPerSample;
    var dataSize = numFrames * blockAlign;

    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);
    var format = bitDepth === 32 ? 3 : 1; // 3 = IEEE float, 1 = PCM
    var p = 0;

    function str(s) { for (var i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); }
    function u32(v) { view.setUint32(p, v, true); p += 4; }
    function u16(v) { view.setUint16(p, v, true); p += 2; }

    // RIFF header
    str('RIFF'); u32(36 + dataSize); str('WAVE');
    // fmt chunk
    str('fmt '); u32(16); u16(format); u16(numChannels);
    u32(sampleRate); u32(sampleRate * blockAlign); u16(blockAlign); u16(bitDepth);
    // data chunk
    str('data'); u32(dataSize);

    // Interleaved PCM
    if (bitDepth === 16) {
      for (var i = 0; i < numFrames; i++) {
        for (var c = 0; c < numChannels; c++) {
          var s = channels[c][i];
          s = s < -1 ? -1 : s > 1 ? 1 : s;
          view.setInt16(p, Math.round(s * 32767), true);
          p += 2;
        }
      }
    } else {
      for (var j = 0; j < numFrames; j++) {
        for (var d = 0; d < numChannels; d++) {
          view.setFloat32(p, channels[d][j], true);
          p += 4;
        }
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  CaYa.wav = { encodeWAV: encodeWAV };
})(window.CaYa = window.CaYa || {});
