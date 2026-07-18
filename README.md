<div align="center">

<img src="favicon.svg" alt="CaYaSound" width="96" height="96" />

# 🎧 CaYaSound

**Tarayıcıda çalışan ses düzenleyici — Adobe Audition tarzı dalga formu, sol/sağ kanal düzenleme, bas artırma ve WAV dışa aktarma.**
_Browser-based audio editor — Audition-style waveform, L/R channel editing, bass boost & WAV export._

[![Canlı Demo](https://img.shields.io/badge/Canl%C4%B1_Demo-GitHub_Pages-e51e2b?style=for-the-badge)](https://cayatur.github.io/CaYaSoundEdit/)
[![CaYaDev](https://img.shields.io/badge/CaYaDev-cayadev.com-0b0608?style=for-the-badge)](https://cayadev.com)

🌐 **Türkçe / English** — arayüz cihaz diline göre otomatik seçilir (algılanamazsa İngilizce), üstteki 🌐 düğmesiyle değiştirilebilir.

</div>

---

CaYaSound; ses dosyalarını **tamamen tarayıcıda** (Web Audio API) düzenlemeni sağlar.
Dosyaların hiçbir sunucuya yüklenmez — her işlem senin cihazında yapılır. Kurulum yok,
build adımı yok; saf HTML/CSS/JS. GitHub Pages'te ve `file://` ile doğrudan çalışır.

## ✨ Özellikler

### 🌊 Görselleştirme
- Sol ve sağ kanal **ayrı ayrı** üst üste (Audition tarzı) dalga formu
- Zaman cetveli, oynatma imleci ve gerçek zamanlı ilerleme
- Yakınlaştırma / uzaklaştırma / sığdırma + yatay kaydırma (fare tekerleği: kaydır, `Ctrl`+tekerlek: zoom)
- Sürükleyerek bölge seçimi

### 🔊 Kanal işlemleri
- **Kanal kilidi (solo):** dalga üzerindeki **SOL** / **SAĞ** başlığına tıkla → yalnız o
  kanal düzenlenir, diğeri kilitlenir. Tüm bölge/efekt işlemleri kilitli kanala dokunmaz.
- **Kopyala / Yapıştır** (`Ctrl+C` / `Ctrl+V`): etkin kanal(lar)dan kopyala, imleç
  konumuna yapıştır. Bir kanalı kopyalayıp diğerini açıp yapıştırarak sesi **kanaldan
  kanala taşı** (ör. sol → sağ).
- **Sol → Sağ** ve **Sağ → Sol** kanal kopyalama
- Kanalları değiştirme (swap)
- **Sol kanalı kapat** / **Sağ kanalı kapat**
- Mono'ya indirme

### ✂️ Düzenleme
- Seçime **kırpma** (trim)
- Seçimi **silme** (cut) ve birleştirme
- Seçimi **susturma**
- **Ters çevirme** (reverse)
- **Fade in / Fade out** (eşit güç eğrisi)

### 🎚️ Efektler
- **Bas artırma / azaltma** (low-shelf, −15…+15 dB)
- **Tiz** (high-shelf)
- **Kazanç** (−24…+24 dB): seçim üzerinde beliren **kayan tutamacı** dikey sürükle
  (`Shift` = ince ayar, fare tekerleği = ±1 dB). Bir sürükleme = tek geri-al adımı.
- **Normalleştirme** (−0.3 dBFS)

### 💾 Diğer
- Sınırsıza yakın **Geri Al / Yinele** (bellek korumalı yığın)
- **WAV dışa aktarma**: 16-bit PCM veya 32-bit float
- Klavye kısayolları
- CaYaDev temasıyla uyumlu koyu + kırmızı arayüz, Türkçe

## ⌨️ Kısayollar

| Kısayol | İşlev |
|---|---|
| `Boşluk` | Oynat / Duraklat |
| `Ctrl + Z` / `Ctrl + Y` | Geri al / Yinele |
| `Ctrl + S` | WAV dışa aktar |
| `Ctrl + A` | Tümünü seç |
| `Ctrl + C` / `Ctrl + V` | Kopyala / Yapıştır (etkin kanallara) |
| `Delete` | Seçimi sil |
| `Home` | Başa dön |
| `+` / `-` | Yakınlaş / Uzaklaş |

## 🚀 Kullanım

1. **[Canlı demoyu](https://cayatur.github.io/CaYaSoundEdit/)** aç ya da bu depoyu indir.
2. Bir ses dosyasını (WAV, MP3, FLAC, OGG, M4A) sürükle-bırak veya **Aç**'a tıkla.
3. Dalga üzerinde sürükleyerek bölge seç, araç panelinden işlemleri uygula.
   Sesi yükseltmek için seçim üzerinde beliren tutamacı yukarı/aşağı sürükle.
4. **Dışa Aktar** ile düzenlenmiş sesi WAV olarak indir.

> Not: Mono dosyalar, sol/sağ kanal işlemleri çalışabilsin diye içeride stereo'ya
> yükseltilir. `decodeAudioData` sesi tarayıcının örnekleme hızına dönüştürebilir;
> dışa aktarma bu hızda yapılır.

## 🛠️ Yerelde çalıştırma

Herhangi bir statik sunucu yeterli:

```bash
# Python
python -m http.server 8080
# ya da Node
npx serve
```

Sonra `http://localhost:8080` adresini aç. Dosyayı doğrudan çift tıklayarak (`file://`) da açabilirsin.

## 📁 Yapı

```
CaYaSoundEdit/
├── index.html          # Arayüz
├── css/style.css       # CaYaDev teması
├── js/
│   ├── wav.js          # WAV kodlayıcı (16/32-bit)
│   ├── history.js      # Bayt sınırlı geri al/yinele
│   ├── audio-engine.js # Ses motoru (tek doğruluk kaynağı)
│   ├── waveform.js     # Canvas çizim + piksel↔örnek dönüşümü
│   └── app.js          # UI orkestrasyonu
└── favicon.svg
```

## 📜 Lisans

[MIT](LICENSE) © 2026 [CaYatur · CaYaDev](https://cayadev.com)
