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

---

## 🤝 Çoklu Ajan Devir Teslimi (Handoff Protokolü)

Farklı araçlar arasında geçiş yaparken bağlamı (context) asla kaybetmeyin:

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

SyncytiumMD dahili bir MCP sunucusu içerir. Böylece MCP destekleyen araçlar (Cursor, Claude Desktop, Cline, Antigravity) terminale gitmeden doğrudan çalışma anında (runtime) hafızaya erişebilir.

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

### Sunulan MCP Tool'ları:
- `syncytium_get_context`: Proje kurallarını, mimarisini, ADR kararlarını ve aktif durumu sorgular.
- `syncytium_handoff`: Bir ajanın görevini tamamlayıp bayrağı sonrakine devretmesini sağlar.
- `syncytium_record_decision`: Alınan yeni bir mimari kararı (`ADR`) hafızaya kaydeder ve dağıtır.
- `syncytium_sync`: Dosyaları anında yeniden senkronize eder.

---

## 🧹 Temizleme Komutu (Clean)

Git reponuzda türetilen dosyaların kalabalık yapmasını istemiyorsanız:
```bash
npx syncytium clean
```
Yalnızca Syncytium tarafından üretilen hedef dosyaları güvenle kaldırır; `.syncytium/` ana kaynağınıza asla dokunmaz.

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
MIT Lisansı © 2026 SyncytiumMD Ekibi
