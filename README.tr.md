# 🧬 SyncytiumMD

**Yapay Zeka Kodlama Araçları İçin Evrensel Context, Kural ve Handoff Köprüsü**

[English](README.md) | [Türkçe](README.tr.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

> **Biyolojide "Syncytium":** Birden fazla hücre çekirdeğinin tek bir sitoplazmayı ve ortak kaynakları paylaşarak uyum içinde çalıştığı hücre yapısıdır.  
> **Yazılımda "SyncytiumMD":** Cursor, Claude Code, GitHub Copilot, Cline, Antigravity, Windsurf, Trae, OpenCode gibi tüm AI araçlarının ortak bir Markdown bellek katmanı ve kuralları üzerinde birlikte çalıştığı evrensel köprüdür.

---

## 🚀 Neden SyncytiumMD?

Modern geliştiriciler artık tek bir AI aracına bağlı kalmıyor:
- **Planlama & Derin Mimari:** Google Antigravity / Claude Code
- **Satır İçi Kod Tamamlama & Düzenleme:** Cursor / GitHub Copilot / Windsurf
- **Otonom Alt Ajan Döngüleri:** Cline / Roo Code / OpenCode / Aider
- **Yeni Nesil AI IDE'leri:** Trae, Kiro, Qoder, Zed

Ancak bu araçların her biri kuralları ve bağlamı farklı dosyalarda arar:
`.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.clinerules`, `.windsurfrules`, `.traerules`, `AGENT.md`...

**SyncytiumMD**, bu parçalanmayı **Tek Doğruluk Kaynağı (`.syncytium/`)** altında birleştirir; kuralları her aracın formatına otomatik dönüştürür, canlı eşitler ve ajanlar arasında **kesintisiz bayrak devir teslimi (Handoff)** sağlar.

---

## 🔌 Desteklenen Araçlar ve Eşleme Matrisi

| AI Aracı / IDE | Kategori | Çıktı Dosyası / Köprü | Yetenekler |
| :--- | :--- | :--- | :--- |
| **Cursor IDE** | IDE | `.cursor/rules/*.mdc`, `.cursorrules` | Glob desenleri, `alwaysApply`, YAML Frontmatter, Aktif Handoff Kuralı |
| **Claude Code CLI** | CLI | `CLAUDE.md` | Tekilleştirilmiş mimari, mühendislik kuralları, aktif görevler, ADR hafızası |
| **GitHub Copilot** | Extension | `.github/copilot-instructions.md` | Depo seviyesinde standart kurallar ve güvenlik kısıtlamaları |
| **Cline & Roo Code** | Extension | `.clinerules`, `.roomodes` | Otonom çalıştırma kuralları, güvenlik sınırları, devir teslim protokolü |
| **Google Antigravity** | Agent | `.gemini/antigravity/rules/*.md` | Modüler çalışma alanı kuralları ve proje context'i |
| **Windsurf IDE** | IDE | `.windsurfrules` | Codeium / Windsurf kuralları ve mimari özeti |
| **Trae IDE** | IDE | `.traerules` | ByteDance Trae AI IDE çalışma alanı kuralları |
| **OpenCode / Aider / Zed / Kiro / Qoder** | CLI/Agent | `AGENT.md`, `CONVENTIONS.md` | Açık standart evrensel ajan kuralları |
| **Özel Tanımlı (Generic)** | Herhangi | Kullanıcı tanımlı dosya | `syncytium.config.json` ile dilediğiniz özel aracı ekleme |

---

## 📦 Hızlı Başlangıç

### 1. Çalışma Alanında Başlatma
```bash
npx syncytium init
```
Bu komut projenizde `.syncytium/` klasörünü oluşturur:
```text
.syncytium/
├── syncytium.config.json    # Hangi araçların aktif olduğunu yönetir
├── architecture.md          # Sistemin genel mimarisi ve teknoloji yığını
├── HANDOFF.md               # Ajanlar arası canlı devir teslim bayrağı
├── rules/                   # Modüler kurallarınız (kod stili, güvenlik, test)
│   ├── code-style.md
│   ├── security.md
│   └── testing-standards.md
└── memory/                  # Mimari Karar Kayıtları (ADRs)
    └── decisions.md
```

### 2. Tüm Hedef Araçlara Senkronize Etme
```bash
npx syncytium sync
```
Tek komutla `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.clinerules`, `AGENT.md` vb. tüm köprü dosyaları anında derlenip oluşturulur.

### 3. Canlı İzleyici (Watcher Daemon)
```bash
npx syncytium watch
```
`.syncytium/` altındaki herhangi bir kuralı, mimari notu veya devir teslim bilgisini güncellediğiniz an, tüm bağlı IDE ve CLI araçlarının dosyaları milisaniyeler içinde eşitlenir.

### 4. Sağlık & Teşhis Aracı (`doctor`)
```bash
npx syncytium doctor
```
`.syncytium/` dizin yapısını, yapılandırma dosyasının geçerliliğini, kuralları, ADR hafızasını, aktif devir teslim (handoff) bayrağını ve türetilen köprü dosyalarının tutarlılığını kapsamlı şekilde denetler.

### 5. Bağlam Kayması Tespiti (`diff`)
```bash
npx syncytium diff
```
Disk üzerindeki köprü dosyalarını `.syncytium/` ana kaynağıyla karşılaştırır; senkronize olmayan, eksik veya değiştirilmiş dosyaları anında listeler.

### 6. Tersine Göç / İçe Aktarma (`import`)
```bash
npx syncytium import
```
Projedeki mevcut dağınık AI kural dosyalarını (`CLAUDE.md`, `.cursorrules`, `.clinerules`, `.github/copilot-instructions.md` vb.) otomatik tarar ve `.syncytium/rules/` altına modüler kurallar olarak aktarır. Önizleme için `--dry-run` bayrağını ekleyebilirsiniz.

### 7. Ajan Devir Teslim Zaman Çizelgesi (`log`)
```bash
npx syncytium log
```
Ajanlar arasında tamamlanan hedefleri, sıradaki görevleri ve devir teslim geçmişini görsel bir terminal zaman çizelgesiyle listeler.

### 8. Kural ve Bağlam Linter'ı (`lint`)
```bash
npx syncytium lint

# Kural isimlerini otomatik kebab-case'e dönüştür ve eksik frontmatter başlık/ID'lerini onar:
npx syncytium lint --fix
```
Kural dosyalarının isimlendirme standartlarını (kebab-case), YAML frontmatter şemasını ve içerik bütünlüğünü commit öncesi denetler.

### 9. Git Pre-Commit Kancası (`hook`)
```bash
# Kurallar senkronize değilse commiti engelle
npx syncytium hook install

# Veya her git commit işleminde köprü dosyalarını otomatik senkronize et
npx syncytium hook install --auto-sync
```
`.git/hooks/pre-commit` kancasını kurarak projedeki bağlam kaymalarını (context drift) engeller.

### 10. GitHub Actions CI Üreticisi (`ci`)
```bash
npx syncytium ci
```
Pull Request'lerde bağlam kaymasını (`syncytium diff`) ve kural geçerliliğini (`syncytium lint`) otomatik denetleyen `.github/workflows/syncytium.yml` iş akışını tek tıkla kurar.

### 11. Seçici Hariç Tutma (`.syncytiumignore`)
Projenizin kök dizininde bir `.syncytiumignore` dosyası oluşturarak belirli köprü dosyalarının veya kuralların üretilmesini engelleyebilirsiniz:
```text
# Belirli dosyaların üretilmesini engelle
.traerules
.windsurfrules
*.spec.md
```

### 12. Kanonik Kural Kataloğu ve Arama (`rules`)
```bash
# .syncytium/rules/ altındaki tüm kuralları listele
npx syncytium rules

# Başlık, açıklama veya etikete göre kural ara
npx syncytium rules typescript
```

### 13. Çoklu Ajan Çakışma Kilidi (`lock`)
Birden fazla yapay zeka ajanının veya geliştiricinin aynı anda çakışan işler yapmasını süreli kilit (lease-based lock) mekanizmasıyla önler:
```bash
# 45 dakikalık kilit al
npx syncytium lock acquire --agent Cursor --goal "Kimlik doğrulama modülü refaktörü" --lease 45

# Kilit durumunu kontrol et
npx syncytium lock status

# İş bitince kilidi aç
npx syncytium lock release --agent Cursor
```

### 14. 🌌 Obsidian Studio & 3D WebGL Bilgi Galaksisi (`graph` / `ui`)
Projenizin tüm yapay zeka beyin topolojisini ve araçlarını tarayıcınızda Obsidian benzeri çift panelli stüdyo ve interaktif 3D WebGL uzay galaksisi olarak görselleştirir ve inceler:
```bash
# http://localhost:3737 üzerinde Obsidian Studio & 3D görselleştiriciyi başlat
npx syncytium graph

# CLI üzerinden doğrudan belirli perspektifleri filtreleyerek aç:
npx syncytium graph --category ide        # Sadece Cursor, Windsurf, Trae
npx syncytium graph --category cli        # Sadece Claude Code, Antigravity, OpenCode
npx syncytium graph --category extension  # Sadece GitHub Copilot, Cline
npx syncytium graph --category brain      # Sadece kanonik .syncytium/ ortak beyni

# Büyük projeler için ultra hafif kompakt mod:
npx syncytium graph --compact
```
- **Obsidian Dosya Gezgini (Sol Panel):** Kanonik `.syncytium/` kasasını (`rules/`, `memory/` ADRs, `architecture.md`, `HANDOFF.md`) ve IDE'ler, CLI'lar ile VSCode Eklentilerine göre gruplanmış araç adaptörlerini hiyerarşik klasör ağacı olarak listeler. Tıklanan dosyanın 3D düğümüne kamera otomatik uçar ve dokümanını açar.
- **3D Celestial WebGL Galaksi (Orta Panel):** Three.js tabanlı, kısıtlı Coulomb itme gücü ve sönümleme fiziğiyle sıfır titreme ve uyku modu (%0 CPU yükü).
- **Obsidian Doküman Okuyucu (Sağ Panel):** Canlı Markdown ayrıştırıcı, YAML frontmatter etiketleri, bağlı beyin düğümleri ve kaynak rozeti (`🧠 Canonical Source of Truth (.syncytium)` veya `⚡ Transpiled from .syncytium/`).
- **Perspektif Değiştirici Butonları:** Arayüz üst çubuğundan tek tıkla `🌌 Universal Brain`, `🖥️ IDEs`, `⌨️ CLIs`, `🧩 VSCode Extensions` ve `📜 Core Vault` görünümleri arasında anlık geçiş.
- **Canlı SSE Senkronizasyonu:** `.syncytium/` altındaki herhangi bir dosya güncellendiğinde tarayıcı yenilenmeden hem 3D uzay hem de doküman okuyucu canlı güncellenir.

---

## 🤝 Çoklu Ajan Devir Teslimi (Handoff Protokolü)

Farklı araçlar arasında geçiş yaparken bağlamı (context) asla kaybetmeyin. Bayrak devrini parametrelerle ya da interaktif sihirbazla yönetebilirsiniz:

### İnteraktif Terminal Sihirbazı:
```bash
npx syncytium handoff -i
```
Terminal üzerinden soru-cevap şeklinde bitiren ajanı, sıradaki ajanı, durumu, hedefi ve tavsiye notlarını pratikçe girmenizi sağlar.

### Komut Satırı ile Hızlı Devir:
```bash
# Antigravity ile plan yaptınız, Cursor'a inline kodlama devrediyorsunuz:
npx syncytium handoff \
  --from Antigravity \
  --to Cursor \
  --status in_progress \
  --goal "Kimlik doğrulama controller'ını uygula" \
  --done "Veritabanı migrasyonu tamamlandı" \
  --task "src/routes/auth.ts controller'ını yaz" \
  --file "src/routes/auth.ts" \
  --notes "JWT süresi 15dk olacak, refresh token Redis'e yazılacak"
```

Cursor'ı açtığınızda `.cursor/rules/syncytium-handoff.mdc` veya Claude Code'da `CLAUDE.md`, en tepede doğrudan bu notu ve sıradaki görevi otomatik olarak görür.

---

## 🤖 Model Context Protocol (MCP) Sunucusu

SyncytiumMD dahili bir MCP sunucusu içerir. Böylece MCP destekleyen araçlar (Cursor, Claude Desktop, Cline, Antigravity) terminale gitmeden doğrudan çalışma anında (runtime) hafızaya erişebilir ve araçları otonom olarak çalıştırabilir.

### MCP Yapılandırması (Cursor, Claude Desktop veya Antigravity için)
```json
{
  "mcpServers": {
    "syncytium": {
      "command": "node",
      "args": ["/path/to/SyncytiumMD/dist/mcp/index.js"]
    }
  }
}
```

### Sunulan Otonom MCP Tool'ları:
- `syncytium_get_context`: Proje kurallarını, mimarisini, ADR kararlarını ve aktif durumu sorgular.
- `syncytium_handoff`: Bir ajanın görevini tamamlayıp bayrağı sonrakine devretmesini sağlar.
- `syncytium_record_decision`: Alınan yeni bir mimari kararı (`ADR`) hafızaya kaydeder ve dağıtır.
- `syncytium_sync`: Dosyaları anında yeniden senkronize eder.
- `syncytium_get_history`: Geçmiş görev tamamlanmalarını ve devir teslim zaman çizelgesini inceler.
- `syncytium_lint`: Kuralları ve şema bütünlüğünü çalışma anında denetler.
- `syncytium_diff`: `.syncytium/` ile hedef köprü dosyaları arasındaki kaymayı tespit eder.

---

## 🧹 Temizleme Komutu (Clean)

Git reponuzda türetilen dosyaların kalabalık yapmasını istemiyorsanız:
```bash
npx syncytium clean
```
Yalnızca Syncytium tarafından üretilen hedef dosyaları güvenle kaldırır; `.syncytium/` ana kaynağınıza asla dokunmaz.

---

## ❓ Sıkça Sorulan Sorular (FAQ)

### SyncytiumMD, elle `.cursorrules` veya `CLAUDE.md` yazmaktan nasıl farklıdır?
Elle ayrı ayrı kural dosyası yazmak **bağlam kopukluğuna (context drift)** neden olur. Cursor kurallarını güncellediğinizde Claude Code veya Copilot bundan haberdar olmaz. SyncytiumMD, `.syncytium/` içinde tek bir doğruluk kaynağı sunar ve kuralları tüm araçların kendi yerel formatına otomatik olarak derler.

### Çoklu Ajan Devir Teslimi (Handoff) Nasıl Çalışır?
Araçlar arasında geçiş yaparken (örneğin Antigravity'de plan yapıp Cursor'da kod yazmaya geçerken):
```bash
npx syncytium handoff --from Antigravity --to Cursor --goal "Auth controller'ı yaz"
```
komutunu çalıştırmanız yeterlidir. `HANDOFF.md` güncellenir ve hemen `.cursor/rules/syncytium-handoff.mdc` ile `CLAUDE.md` dosyalarına yansıtılır. Hedef aracı açtığınızda güncel hedefi ve sıradaki görevleri hazır bulursunuz.

### SyncytiumMD'yi bir MCP (Model Context Protocol) sunucusu olarak kullanabilir miyim?
Evet. SyncytiumMD yerleşik bir MCP sunucusu (`syncytium-mcp`) ile gelir. Cursor, Claude Desktop ve Antigravity gibi araçlar doğrudan çalışma anında (runtime) `syncytium_get_context`, `syncytium_handoff` ve `syncytium_record_decision` gibi araçları çağırabilir.

### SyncytiumMD Git repomu kirletir mi?
Hayır. Commit atmadan önce `npx syncytium clean` çalıştırarak türetilen dosyaları saniyeler içinde silebilirsiniz. İsterseniz takım arkadaşlarınızın da faydalanması için reponuzda bırakabilirsiniz.

### Kendi özel veya şirket içi AI araçlarımı ekleyebilir miyim?
Evet. `.syncytium/syncytium.config.json` içine özel bir adaptör tanımı ekleyerek istediğiniz dosya yoluna derleme yapabilirsiniz.

---

## 🛠️ Geliştirme ve Test

```bash
# Bağımlılıkları kur
npm install

# TypeScript derlemesi
npm run build

# Test süitini çalıştır
npm test
```

---

## 📄 Lisans
MIT Lisansı © 2026 Miraç Birben & SyncytiumMD Ekibi

