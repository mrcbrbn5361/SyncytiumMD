<div align="center">

# 🧬 SyncytiumMD

**Tek bağlam. Her AI kodlama aracı. Sıfır kopyala-yapıştır.**

[![npm](https://img.shields.io/npm/v/syncytium-md)](https://www.npmjs.com/package/syncytium-md)
[![CI](https://github.com/mrcbrbn5361/SyncytiumMD/actions/workflows/syncytium.yml/badge.svg)](https://github.com/mrcbrbn5361/SyncytiumMD/actions/workflows/syncytium.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6.0-5FA04E)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[English](./README.md) · [Türkçe](./README.tr.md)

</div>

---

## Problem

İşte **Cursor**'u kullanıyorsunuz, terminalde **Claude Code**, PR'larda
**Copilot** ve CI'da üç CLI ajanı. Her biri kendi talimat dosyasını istiyor.
Aynı kuralların dört kopyasını tutuyorsunuz, hepsi ayrışıyor ve hiçbir ajan
dün diğerlerinin ne yaptığını bilmiyor.

## Çözüm

Kuralları **bir kez**, `.syncytium/` içinde tutun ve her aracın kendi
biçimine *transpile* edin.

```
.syncytium/            kanonik, insan tarafından yazılan, git'te takip edilen
  rules/*.md           kod stili, güvenlik, test, mimari, …
  memory/decisions.md  ADR'ler — proje neden böyle
  HANDOFF.md           canlı ajan sopası: kimde, sırada ne var
        │
        │  syncytium sync
        ▼
CLAUDE.md   AGENTS.md   GEMINI.md   AGENT.md   CONVENTIONS.md
.cursorrules   .clinerules   .roomodes   .windsurfrules   .traerules
.cursor/rules/*.mdc          .gemini/antigravity/rules/*.md
.github/copilot-instructions.md + .github/instructions/*.instructions.md
```

Üretilen her dosya kaynağını belirten bir banner taşır ve
`syncytium diff --check` herhangi bir sapmada CI'ınızı başarısız kılar.
`syncytium clean` yalnızca banner'lı dosyaları siler — kendi yazdığınız
kurallara asla dokunmaz.

## Hızlı başlangıç

```bash
npx syncytium init          # .syncytium/ iskeletini oluştur (stack algılanır)
npx syncytium sync          # tüm köprü dosyalarını üret
npx syncytium graph         # 3D bilgi grafiğini tarayıcıda aç
```

**Node.js 22.6+** gerekir. Global kurulum gerekmez; `npx` yeterli.

## Neler var

| | |
|---|---|
| **10 hazır adaptör** | Cursor, Claude Code, GitHub Copilot, Cline/Roo, Antigravity, Windsurf, Trae, OpenCode, **AGENTS.md**, **GEMINI.md** |
| **Stack farkındalıklı şablonlar** | TypeScript, JavaScript, Python, Go, **Rust**, Java, Kotlin, PHP, Ruby, .NET, Swift, Elixir, genel |
| **Çoklu ajan güvenliği** | Kalp atışı olan kiralama tabanlı çalışma alanı kilidi, handoff sopası, 100 kayıtlık denetim izi |
| **Sapma tespiti** | Gerçek unified diff'ler, sahipsiz dosya tespiti ve CI'da gerçekten hata kodu döndüren `--check` |
| **Canlı 3D grafik** | WebGL bilgi kozmosu, vault gezgini, Markdown belge okuyucu — `127.0.0.1`'e bağlı |
| **MCP sunucusu** | zod doğrulamalı girdi ve token bütçeli çıktı ile 18 araç |
| **CI + git hook** | `syncytium ci` ve `syncytium hook install` ikisi de sıfır sapmayı zorunlu kılar |
| **Her yerde `--json`** | Her komut makine tarafından okunabilir çıktı üretir |

## Komutlar

Tam liste için `syncytium --help`.

### Bağlam

| Komut | Ne yapar |
|---|---|
| `init [ad]` | `.syncytium/` iskeleti. `--template <stack>`, `--force` |
| `sync` | Tüm köprü dosyalarını yeniden üret. `-t/--target`, `--no-prune`, `-f/--force` |
| `watch` | Her değişiklikte otomatik senkron. `-a/--agent` ayrıca kilidi tutar ve uzatır |
| `diff` | Gerçek yamalarıyla sapmayı göster. **`--check`** CI'da 1 döner, `--full` tam hunk'ları verir |
| `doctor` | Uygulanabilir `fix:` ipuçlarıyla 11 sağlık kontrolü. `--strict` |
| `lint` | Kuralları, frontmatter'ı ve ADR şemasını doğrular. `--fix` kebab-case ve eksik başlıkları onarır |
| `validate` | `syncytium.config.json`'u ve her kuralı şemaya karşı doğrular. `--fix` |
| `clean` | Yalnızca banner'lı dosyaları siler. `--dry-run` |
| `export` | Her yere yapıştırılabilecek tek bir taşınabilir Markdown paketi. `--html`, `--max-rule-chars` |
| `import` | Mevcut `CLAUDE.md`, `.cursorrules` vb. dosyalarını `.syncytium/` içine geri taşır. `--dry-run` |
| `adapters` | Kayıtlı tüm adaptörleri ve hedeflerini listeler |
| `status` | Proje + handoff + kilit özeti tek ekranda |

### Kurallar ve kararlar

```bash
syncytium rules [sorgu]                      # katalogda ara
syncytium rule add --title "..." --body "..."  # yeni kural ekle
syncytium rule show <id>                     # bir kuralı incele
syncytium rule update <id> --body-file x.md  # yerinde düzenle
syncytium rule remove <id>                   # sil + üretilen dosyaları temizle

syncytium adr list                           # mimari kararlar
syncytium adr add --title "..." --context "..." \
                  --decision "..." --consequences "..."
syncytium adr show ADR-006
syncytium adr remove ADR-006
```

### Çoklu ajan koordinasyonu

```bash
syncytium lock acquire --agent "Cursor" --goal "Auth refactor"
syncytium lock heartbeat --agent "Cursor"    # kirayı uzat
syncytium lock status
syncytium lock release --agent "Cursor"

syncytium handoff -i                          # etkileşimli sihirbaz
syncytium handoff --from "Cursor" --to "Claude" \
  -s ready_for_review -g "v1'i çıkar" -d "…" -t "…"
syncytium log -n 20                           # sopa denetim izi
```

### Koruma katmanı

```bash
syncytium hook install              # sapmada commit'i engelle
syncytium hook install --auto-sync  # ya da her commit'te sadece yeniden senkronla
syncytium ci                        # .github/workflows/syncytium.yml sapma kapısı
syncytium ci --force                # mevcut workflow'u yeniden üret
```

### Bilgi grafiği

```bash
syncytium graph                        # 3D WebGL kozmosu + vault gezgini
syncytium graph --category ide         # yalnızca IDE adaptörleri
syncytium graph --compact              # dosya ve etiket düğümlerini gizle
syncytium graph --no-open --port 4000
```

Sunucu `127.0.0.1`'e bağlanır ve döngü dışı `Host` başlıklarını reddeder
(DNS-rebinding koruması). `.env*`, `*.pem`, `*.key`, `.git/**` gibi kök
içindeki sırları sunmayı reddeder.

### MCP

```jsonc
{
  "mcpServers": {
    "syncytium": {
      "command": "npx",
      "args": ["-y", "syncytium-mcp"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

CLI zaten kuruluysa `syncytium mcp` de olur. Araçlar arasında
`syncytium_get_context`, `syncytium_handoff`, `syncytium_create_rule`,
`syncytium_update_rule`, `syncytium_remove_rule`, `syncytium_record_decision`,
`syncytium_sync`, `syncytium_diff`, `syncytium_doctor`, `syncytium_validate`,
`syncytium_lock_acquire/release/status`, `syncytium_get_graph` ve fazlası var.
Her girdi zod ile doğrulanır; her çıktı dökülmek yerine özetlenir.

## `.syncytiumignore`

Üretilen hedefleri hem `sync` hem `diff` dışında bırakır. `**`, `?`,
dizin-özel kalıplar ve `!` olumsuzlaması dahil tam gitignore söz dizimi:

```
# Bu araçları yönetme
.cursorrules
.github/instructions/

# Ama bunu yönet
!.github/instructions/keep.md
```

## Özel adaptörler

Herhangi bir aracı `syncytium.config.json` içinde tanımlayın — kod gerekmez:

```jsonc
{
  "customAdapters": [
    {
      "id": "zed",
      "name": "Zed",
      "targetFile": ".rules/zed.md",
      "includeHandoff": true,
      "includeArchitecture": true
    }
  ],
  "enabledAdapters": ["cursor", "claude", "zed"]
}
```

## Kütüphane kullanımı

```ts
import { SyncytiumEngine } from 'syncytium-md';

const engine = new SyncytiumEngine(process.cwd());
await engine.sync();
const { hasDrift, summary } = await engine.diff();
const graph = await engine.getKnowledgeGraph({ category: 'ide' });
```

## Geliştirme

```bash
npm install
npm run verify      # typecheck -> build -> 114 test
```

Bkz: [CONTRIBUTING.md](./CONTRIBUTING.md) ve
[`.syncytium/architecture.md`](./.syncytium/architecture.md).

## Lisans

MIT © [Miraç Birben](https://github.com/mrcbrbn5361)
