# Türkçe geliştirici kanalları — duyuru metinleri

Hedef kitle notu: TR geliştirici toplulukları Cursor/Claude Code kullanımında
dünya ortalamasının üzerinde; buradan gelecek ilk yıldızlar + geri bildirim en
doğal akış. İngilizce ana dağıtım dili; TR ilk geri bildirim kanalı olarak
konumlanır (writing-block stratejisi).

## Kanal önerileri (duyuru günü her kanalın kendi paylaşım kurallarını kontrol et)

- devnotlar.com paylaşım alanı
- Türkiye'nin büyük yazılım Discord'ları (ilgili #proje-paylasim kanalları)
- Reddit r/Turkey (self-promo kurallarına tabi), Ekşi Sözlük (entry olarak)
- X TR dev circle (aşağıdaki metnin kısa thread hali)

## Ortak metin (Discord/forum)

Selam! Cursor + Claude Code + Copilot'ı aynı repoda kullanan varsa bu
problem tanıdık: her aracın kendi talimat dosyası var, kopyalar birbiriyle
savaşíyor ve ajanlardan biri işi bitirince diğeri "dün ne oldu"yu bilmiyor.

Açık kaynak bir araç yazdım: **SyncytiumMD** (MIT, npm).

Tek fikir: kuralları `.syncytium/` klasöründe bir kere tut; araçların kendi
formatlarına (AGENTS.md, CLAUDE.md, .cursor/rules, GEMINI.md, Copilot…) biz
üretelim. Ama asıl odak koordinasyon:

- **handoff sopası** — "kimde, ne bitti, sırada ne, dikkat:",
  100 kayıtlık denetim iziyle
- **kiralama kilidi** — iki ajan aynı dosyaya aynı anda dalmaz; süresi dolan
  kiralama çöken ajanı repoya kilitlemez
- **CI drift gate** — üretilen dosyalardan biri elle düzenlenirse PR gerçek
  unified diff'le düşer
- **23 araçlık MCP sunucusu** — yıkıcı işlemler dry-run-first + geri alınabilir
- **3D bilgi grafiği** — bonus; tamamen local, 127.0.0.1'e bağlı

`npx syncytium init && npx syncytium sync` ile 2 dakikada denenir.
Repo: github.com/mrcbrbn5361/SyncytiumMD · npm: syncytium-md

Eleştirilere açığım, özellikle "2. hafta silerim" diyecek dostlara. 👋

## TR X thread (kısa)

1/ AI ajanların aynı repoda ama birbirinden habersiz: Cursor'un kurallı başka,
Claude Code'un başka; biri işi bitirince diğerleri bilmiyor.
2/ Tek kaynak `.syncytium/` → her aracın formatını üretir (AGENTS.md dahil).
3/ Asıl fark: handoff sopası + kiralama kilidi + CI drift gate + 23 araçlık MCP.
4/ MIT, local-first, npx ile 2 dk. buyrun 👇
