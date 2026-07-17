/* ============================================================
   CaYaSound · history.js
   Geri al / yinele — bellek (bayt) sınırlı yığın.
   Snapshot = { channels: [Float32Array...], sampleRate, meta }
   ============================================================ */
(function (CaYa) {
  'use strict';

  function History(maxBytes) {
    this.maxBytes = maxBytes || 180 * 1024 * 1024; // ~180 MB tavan
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
  }

  History.prototype._size = function (snap) {
    var b = 0;
    for (var i = 0; i < snap.channels.length; i++) b += snap.channels[i].byteLength;
    return b;
  };

  History.prototype._trim = function () {
    // En eski undo girdilerinden başlayarak tavanın altına in.
    while (this.bytes > this.maxBytes && this.undoStack.length > 0) {
      var old = this.undoStack.shift();
      this.bytes -= this._size(old);
    }
  };

  // Bir düzenlemeden ÖNCE mevcut durumu kaydet.
  History.prototype.record = function (snap) {
    this.undoStack.push(snap);
    this.bytes += this._size(snap);
    // Yeni işlem redo geçmişini geçersiz kılar.
    for (var i = 0; i < this.redoStack.length; i++) this.bytes -= this._size(this.redoStack[i]);
    this.redoStack.length = 0;
    this._trim();
  };

  // cur = düzenleme sonrası mevcut durum; önceki durumu döndürür (yoksa null).
  History.prototype.undo = function (cur) {
    if (!this.undoStack.length) return null;
    this.redoStack.push(cur);
    this.bytes += this._size(cur);
    var prev = this.undoStack.pop();
    this.bytes -= this._size(prev);
    return prev;
  };

  History.prototype.redo = function (cur) {
    if (!this.redoStack.length) return null;
    this.undoStack.push(cur);
    this.bytes += this._size(cur);
    var next = this.redoStack.pop();
    this.bytes -= this._size(next);
    return next;
  };

  History.prototype.clear = function () {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.bytes = 0;
  };

  History.prototype.canUndo = function () { return this.undoStack.length > 0; };
  History.prototype.canRedo = function () { return this.redoStack.length > 0; };

  CaYa.History = History;
})(window.CaYa = window.CaYa || {});
