<div align="center">

  <img src="public/icon.png" alt="LivelyLyrics Logo" width="108" height="108" style="border-radius: 24px; box-shadow: 0 12px 32px rgba(30, 215, 96, 0.35);" />

  # LivelyLyrics

  ### Ultra-Lightweight, Floating, iOS 26 Liquid Glass Synced Lyrics Miniplayer
  **Powered by Rust + Tauri v2 & Electron Dual-Core Architecture for macOS, Windows & Linux**

  <!-- Primary Project Badges -->
  <p>
    <a href="https://github.com/malikp66/lively-lyrics/releases">
      <img src="https://img.shields.io/badge/Release-v3.0.0-1ed760?style=for-the-badge&logo=spotify&logoColor=white" alt="Release v3.0.0" />
    </a>
    <a href="https://www.rust-lang.org/">
      <img src="https://img.shields.io/badge/Rust-1.80+-dea584?style=for-the-badge&logo=rust&logoColor=white" alt="Rust 1.80+" />
    </a>
    <a href="https://v2.tauri.app/">
      <img src="https://img.shields.io/badge/Tauri-v2.0-24C8D8?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri v2" />
    </a>
    <a href="https://electronjs.org/">
      <img src="https://img.shields.io/badge/Electron-Dual--Core-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron Dual-Core" />
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" alt="License MIT" />
    </a>
  </p>

  <!-- Live GitHub Repo Stats -->
  <p>
    <a href="https://github.com/malikp66/lively-lyrics/stargazers">
      <img src="https://img.shields.io/github/stars/malikp66/lively-lyrics?style=for-the-badge&logo=star&color=1ed760&labelColor=121620" alt="GitHub Stars" />
    </a>
    <a href="https://github.com/malikp66/lively-lyrics/network/members">
      <img src="https://img.shields.io/github/forks/malikp66/lively-lyrics?style=for-the-badge&logo=git&color=06b6d4&labelColor=121620" alt="GitHub Forks" />
    </a>
    <a href="https://github.com/malikp66/lively-lyrics/releases">
      <img src="https://img.shields.io/github/downloads/malikp66/lively-lyrics/total?style=for-the-badge&logo=github&color=a855f7&labelColor=121620" alt="Total Downloads" />
    </a>
    <a href="https://github.com/malikp66/lively-lyrics/issues">
      <img src="https://img.shields.io/github/issues/malikp66/lively-lyrics?style=for-the-badge&logo=github&color=f59e0b&labelColor=121620" alt="Open Issues" />
    </a>
    <a href="https://github.com/malikp66/lively-lyrics/commits/main">
      <img src="https://img.shields.io/github/last-commit/malikp66/lively-lyrics?style=for-the-badge&logo=git&color=ec4899&labelColor=121620" alt="Last Commit" />
    </a>
  </p>

  <p align="center">
    <b>LivelyLyrics</b> menghadirkan pengalaman lirik karaoke real-time yang melayang (<i>floating</i>), tembus klik (<i>click-through ghost mode</i>), dan berestetika <b>iOS 26 Liquid Glass</b> ultra-jernih untuk <b>macOS</b>, <b>Windows</b>, dan <b>Linux</b> — kini ditenagai oleh <b>Rust + Tauri v2</b> dengan konsumsi RAM ultra-rendah (< 35MB) tanpa memerlukan login ataupun Spotify API Key.
  </p>

  <p align="center">
    <a href="https://github.com/malikp66/lively-lyrics/releases/latest">
      <img src="https://img.shields.io/badge/Download-Latest_Release-1ed760?style=for-the-badge&logo=github&logoColor=white" alt="Download Latest Release" />
    </a>
    <a href="https://github.com/malikp66/lively-lyrics/releases/latest">
      <img src="https://img.shields.io/badge/macOS_(Apple_Silicon_&_Intel)-DMG-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS" />
    </a>
    <a href="https://github.com/malikp66/lively-lyrics/releases/latest">
      <img src="https://img.shields.io/badge/Windows-Setup_.exe-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows" />
    </a>
    <a href="https://github.com/malikp66/lively-lyrics/releases/latest">
      <img src="https://img.shields.io/badge/Linux-AppImage_%7C_deb-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download Linux" />
    </a>
  </p>

  <p align="center">
    <a href="#-mengapa-livelylyrics">Mengapa LivelyLyrics?</a> •
    <a href="#-fitur-unggulan">Fitur Utama</a> •
    <a href="#-mode-tampilan">Mode Tampilan</a> •
    <a href="#-shortcut-keyboard">Shortcut Keyboard</a> •
    <a href="#-kustomisasi-tampilan--teks">Kustomisasi Tampilan</a> •
    <a href="#-arsitektur-sistem--migrasi-rust">Arsitektur Rust</a> •
    <a href="#-pengembangan--build-mandiri">Pengembangan & Build</a> •
    <a href="#-faq">FAQ</a>
  </p>

</div>

---

## 💡 Mengapa LivelyLyrics?

Aplikasi desktop pemutar musik resmi seperti Spotify memiliki keterbatasan saat kita sedang *multitasking*:
1. **Tidak Ada Miniplayer Lirik Melayang**: Saat bermain game, coding di VS Code, mendesain di Figma, atau browsing, lirik lagu tidak bisa dipantau tanpa harus bolak-balik berpindah jendela.
2. **Kaku & Boros Resource**: Miniplayer berbasis browser berat dapat memakan ratusan MB RAM dan membebani GPU/CPU.
3. **Desain Monoton**: Tidak menyatu dengan estetika OS modern dan wallpaper desktop.
4. **Lirik Sering Desync**: Database lirik sering kali salah memilih versi video klip resmi YouTube (yang memiliki intro video 10-15 detik) daripada versi audio album resmi Spotify.

**LivelyLyrics memecahkan semua masalah tersebut:**
- 🦀 **Migrasi Rust + Tauri v2**: Penggunaan memori terpangkas drastis menjadi **< 35 MB RAM** dengan startup instan di bawah 1 detik.
- 🍏 **iOS 26 Liquid Glassmorphism**: Desain kaca cair multi-layer dengan specular highlight border, refraction backdrop blur, pill capsule controls, dan ambient glow adaptif.
- 🎯 **Duration-Precision Scoring Engine**: Algoritma pencocokan durasi otomatis (< 0.3 detik) dan penalti entri video/MV klip untuk mencegah delay lirik.
- 🔁 **Candidate Cycling pada Re-sync**: Cukup klik tombol sync ulang untuk otomatis beralih ke kandidat pengunggah lirik alternatif bila diperlukan.
- ⌨️ **Instant Offset Hotkeys**: Tombol pintas `[` (-0.5s), `]` (+0.5s), dan `\` (Reset) disertai floating iOS Liquid Capsule Toast.
- 👻 **Always-on-Top & Ghost Mode**: Melayang di atas layar penuh (termasuk Full-Screen Space di macOS), dengan kursor tembus klik tanpa mengganggu pekerjaan.

---

## ✨ Fitur Unggulan

| Fitur | Deskripsi |
| :--- | :--- |
| 🦀 **Rust Core Engine** | Backend berkecepatan tinggi berbasis Rust & Tauri v2; hemat daya, footprint biner ringkas, dan performa mulus tanpa beban. |
| 🍏 **iOS 26 Liquid Glass UI** | Visual material kaca cair dengan efek specular rim light, corner radius halus khas iOS, dan typography responsif. |
| 🪟 **Floating Always-On-Top** | Jendela tetap berada di lapisan paling atas layar (termasuk di atas *Full-Screen Workspace* pada macOS). |
| 👻 **Ghost Mode (Click-Through)** | Aktifkan dengan shortcut `Ctrl+Alt+G` (`Cmd+Option+G` di Mac). Kursor mouse menembus jendela langsung ke aplikasi di belakangnya. |
| ⏱️ **Duration-Precision Lyrics Engine** | Memfilter dan menilai kandidat lirik LRCLIB berdasarkan kecocokan durasi lagu Spotify secara presisi serta mengeliminasi delay video klip YouTube. |
| 🔄 **Alternate Candidate Cycling** | Tekan tombol **Sync Ulang** (`Cmd+R` / `Ctrl+R`) untuk berganti antar kandidat lirik `.lrc` yang tersedia di database. |
| ⌨️ **Real-Time Offset Hotkeys** | Tekan `[` (-0.5s), `]` (+0.5s), atau `\` (Reset 0s) dengan visual pop-up **iOS Liquid Capsule Toast** secara real-time. |
| 🎯 **Interactive Seek** | Klik baris lirik mana pun atau klik timeline scrubber untuk melompati pemutaran lagu langsung ke detik tersebut. |
| 💬 **Only-Lyrics (Pure Subtitle)** | Mode minimalis subtitle melayang tanpa cover art dan tombol navigasi; ideal untuk game atau menonton presentasi. |
| 🌈 **Adaptive Ambient Glow** | Pancaran cahaya ambient lembut di belakang card yang beradaptasi secara otomatis dengan warna dominan cover art album. |
| ✍️ **Deep Typography Styling** | 5 pilihan font studio (`Plus Jakarta Sans`, `Inter`, `Outfit`, `Playfair Display`, `JetBrains Mono`), kustomisasi ukuran, ketebalan, *UPPERCASE*, *Italic*, *Neon Glow*, hingga *Crisp Outline*. |
| 📍 **Smart Window Memory** | Mengingat posisi koordinat dan ukuran jendela terakhir secara otomatis di setiap sesi. |

---

## 🖥️ Mode Tampilan Fleksibel

LivelyLyrics menyediakan **3 mode tampilan adaptif** yang dapat disesuaikan dengan kebutuhan Anda:

| Mode | Karakteristik Visual | Komponen yang Ditampilkan | Ideal Untuk |
| :--- | :--- | :--- | :--- |
| 🎴 **Card Mode**<br>*(Expanded Default)* | Jendela iOS 26 Liquid Glass dengan visual dan kontrol komprehensif | Artwork album HD, live equalizer, scrubber interaktif dengan time preview, kontrol playback, dan aliran lirik penuh | Multitasking santai, mendengarkan musik di desktop |
| 💊 **Compact Mode**<br>*(Dynamic Island)* | Kapsul horizontal ramping hemat ruang | Mini cover art, info lagu, scrubber mini, dan baris lirik aktif | Diletakkan di sudut layar saat coding atau menulis |
| 💬 **Only-Lyrics Mode**<br>*(Pure Subtitle)* | Pita lirik subtitle transparan melayang tanpa chrome/border tebal | Baris lirik aktif yang auto-scroll di tengah layar dengan toolbar melayang otomatis saat kursor mendekat | Bermain game, menonton video, atau membaca dokumen |

---

## ⌨️ Shortcut Keyboard

Pintasan keyboard otomatis menyesuaikan dengan platform Anda (**Windows/Linux** vs **macOS**):

| Aksi | Windows & Linux | macOS |
| :--- | :---: | :---: |
| **Toggle Mode Hanya Lirik (Subtitle)** | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>L</kbd> | <kbd>Cmd ⌘</kbd> + <kbd>Option ⌥</kbd> + <kbd>L</kbd> |
| **Toggle Ghost Mode (Tembus Klik)** | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>G</kbd> | <kbd>Cmd ⌘</kbd> + <kbd>Option ⌥</kbd> + <kbd>G</kbd> |
| **Force Resync / Siklus Opsi Lirik** | <kbd>Ctrl</kbd> + <kbd>R</kbd> | <kbd>Cmd ⌘</kbd> + <kbd>R</kbd> |
| **Mundurkan Lirik (-0.5 Detik)** | <kbd>[</kbd> | <kbd>[</kbd> |
| **Majukan Lirik (+0.5 Detik)** | <kbd>]</kbd> | <kbd>]</kbd> |
| **Reset Offset Lirik (0.00s)** | <kbd>\</kbd> | <kbd>\</kbd> |
| **Play / Pause Pemutaran** | <kbd>Space</kbd> | <kbd>Space</kbd> |
| **Buka / Tutup Pengaturan** | Klik ikon `⚙️` / <kbd>Esc</kbd> | Klik ikon `⚙️` / <kbd>Esc</kbd> |

---

## 🎨 Kustomisasi Tampilan & Teks

Buka panel **Pengaturan** melalui ikon slider (`⚙️`) untuk mempersonalisasi tampilan secara *real-time*:

### 1. Gaya Material & Latar Belakang (Glassmorphism)
- **Gaya Kaca**: *iOS Liquid Glass*, *Frosted Glass*, *Obsidian Dark*, *Minimal*, atau *Custom Tint* (HEX picker bebas).
- **Transparansi Jendela**: Slider `15%` hingga `100%` (otomatis menjadi solid saat panel Pengaturan dibuka agar teks opsi selalu jelas terbaca).
- **Intensitas Blur Kaca**: Slider `0px` hingga `45px`.

### 2. Tipografi & Gaya Lirik
- **Tema Aksen & Ambient**: 6 preset warna (*Spotify Green*, *Velvet Purple*, *Cyber Cyan*, *Sunset Amber*, *Rose*, *Frost*) + *Custom Accent Color Picker*.
- **Warna Teks Lirik Aktif**: *Putih Bersih*, *Mengikuti Warna Aksen*, *Gold Champagne*, *Ice Cyan*, atau warna kustom.
- **Warna Teks Non-Aktif**: Preset kontras (*Default*, *Cool Slate*, *Warm*, *Mint*) atau warna kustom.
- **Koleksi Font Studio**: `Plus Jakarta Sans`, `Inter`, `Outfit`, `Playfair Display` (Serif elegan), dan `JetBrains Mono` (Coding look).
- **Format & Dekorasi**: `Normal`, `Italic`, `UPPERCASE`, atau `Capitalize`.
- **Efek Pendar (Glow) & Garis Tepi (Outline)**: *Neon Glow* (Lembut / Kuat) serta opsi *Drop Shadow* atau *Crisp Outline* agar teks tetap terbaca sangat kontras di atas wallpaper terang atau layar game.

---

## 🏗️ Arsitektur Sistem & Migrasi Rust

LivelyLyrics mengusung arsitektur **Tauri v2 + Rust Native Core** dengan kompatibilitas **Dual-Core (Electron Fallback)**:

```mermaid
flowchart TD
    MusicApp["Spotify / Apple Music / MPRIS"] --> OS["Native Media Protocol (JXA / SMTC / Playerctl)"]
    OS --> RustCore["Rust Core Engine (Tauri v2)"]
    RustCore --> Poller["Precision Media Poller (1000ms heartbeat)"]
    RustCore --> Scorer["LRCLIB Duration-Precision Scorer"]
    Scorer --> CandidateFilter["Video-Delay Stripper & Candidate Sorter"]
    CandidateFilter --> LyricsSync["Sync & Cycle Engine"]
    RustCore --> Webview["iOS 26 Liquid Glass Renderer"]
    LyricsSync --> Webview
    Webview --> RAF["High-FPS Animation Loop (35ms)"]
```

### Keunggulan Rust Backend:
1. **Low Memory Footprint**: Hanya menggunakan ~30-35MB RAM dibandingkan ~120-180MB pada arsitektur Electron murni.
2. **Instant Window Dragging**: Memanfaatkan native OS event handling untuk pergeseran jendela yang mulus tanpa stutter.
3. **Smart Candidate Matching**: Algoritma cerdas yang membedakan rekaman audio studio dari klip musik YouTube berdasarkan delta durasi milidetik dan filter metadata.

---

## 🛠️ Pengembangan & Build Mandiri

Bagi developer yang ingin menjalankan atau mengompilasi LivelyLyrics sendiri dari *source code*:

### Prasyarat
- [Node.js](https://nodejs.org/) v18+ & npm
- [Rust](https://www.rust-lang.org/tools/install) v1.80+ (`cargo`)

### 1. Mode Development (Tauri v2 - Rekomendasi)
```bash
git clone https://github.com/malikp66/lively-lyrics.git
cd lively-lyrics
npm install

# Menjalankan mode development Tauri v2 (Rust + Hot Reload)
npm run tauri:dev
```

### 2. Mode Development (Electron Fallback)
```bash
npm start
```

### 3. Menjalankan Unit Test Rust
```bash
cd src-tauri
cargo test
```
*Termasuk unit test untuk validasi sinkronisasi audio album vs YouTube video klip.*

### 4. Mem-build Paket Installer Rilis (Tauri v2)
Hasil build installer native akan otomatis tersimpan di folder `src-tauri/target/release/bundle/`:
```bash
npm run tauri:build
```

### 5. Mem-build Paket Installer (Electron)
```bash
npm run dist:mac    # macOS (.dmg & .zip)
npm run dist:win    # Windows (.exe installer NSIS & portable)
npm run dist:linux  # Linux (.AppImage & .deb)
```

---

## ❓ FAQ (Frequently Asked Questions)

<details>
<summary><b>Apakah saya perlu Spotify Premium atau Spotify API Key?</b></summary>
<br>
<b>Sama sekali tidak!</b> LivelyLyrics beroperasi langsung melalui protokol sesi media sistem operasi (macOS JXA Automation, Windows SMTC, atau Linux MPRIS2). Akun Spotify Free maupun Premium dapat menggunakannya tanpa perlu login akun atau membuat aplikasi pengembang di Spotify Developer Dashboard.
</details>

<details>
<summary><b>Mengapa lirik lagu tertentu sempat terlambat beberapa detik, dan bagaimana solusinya?</b></summary>
<br>
Hal ini biasanya terjadi jika lirik diunggah dari video klip YouTube (yang memiliki intro dialog/helikopter 10-15 detik) alih-alih audio album resmi. LivelyLyrics v3.0.0 kini memiliki <b>Duration-Precision Scoring</b> yang otomatis memilih versi audio studio bersih. Jika masih ada selisih, cukup tekan tombol <b>Sync Ulang (Cmd+R / Ctrl+R)</b> untuk berganti ke kandidat lirik berikutnya, atau gunakan hotkey <code>[</code> dan <code>]</code> untuk fine-tune offset.
</details>

<details>
<summary><b>Bagaimana cara keluar dari Ghost Mode saat jendela tidak dapat diklik?</b></summary>
<br>
Cukup tekan kombinasi keyboard shortcut <b><code>Cmd + Option + G</code></b> (macOS) atau <b><code>Ctrl + Alt + G</code></b> (Windows/Linux).
</details>

<details>
<summary><b>Bagaimana cara mengaktifkan izin di macOS jika dicegat System Settings?</b></summary>
<br>
Buka <b>System Settings &rarr; Privacy & Security</b>, scroll ke bawah ke bagian Security, lalu klik <b>Open Anyway</b>. Pada dialog Automation, klik <b>Allow / OK</b> agar aplikasi diizinkan membaca judul lagu dan posisi detik dari Spotify / Apple Music.
</details>

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah lisensi **[MIT License](LICENSE)**. Bebas digunakan, dimodifikasi, dan didistribusikan untuk keperluan personal maupun komersial.

<div align="center">
  <p>Dibuat dengan ❤️ untuk para penikmat musik, estetika desktop, dan multitasking di macOS, Windows, dan Linux.</p>
</div>
