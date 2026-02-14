# Tech Pulse — Automated Pipeline Setup Instructions

> Ove upute su namijenjene za AI model (Kimi / OpenClaw) da autonomno postavi
> cijeli automatizirani pipeline za Tech Pulse portal.
> Pipeline radi POTPUNO REMOTE — ne treba pristup lokalnom file sustavu.
> Članci se publishaju preko **GitHub API-ja**, a Vercel automatski deploya.

---

## Kako radi (arhitektura)

```
RSS Feeds → scraper.py (OpenAI rewrite) → bot.py (Telegram)
   ↓ Admin klikne "Approve ✅"
publish_remote.py → GitHub API → commit MDX u repo → Vercel auto-deploy
```

**Ključno**: Nema potrebe za lokalnim pristupom! Sve ide preko GitHub API-ja.
Kad se committa novi .mdx file u `content/` folder na GitHubu, Vercel
automatski pokrene build i deploya novu verziju stranice.

---

## Preduvjeti

- **Python 3.11+**
- **Telegram** account
- **GitHub** account s repozitorijem `tech-pulse`
- **OpenAI** API ključ (za rewriting članaka)
- **Vercel** account povezan s GitHub repom (za auto-deploy)

---

## KORAK 1: Instaliraj dependencies

```bash
cd pipeline/
pip install -r requirements.txt
```

---

## KORAK 2: Napravi GitHub repo i poveži s Vercelom

### 2a. GitHub repo
1. Na https://github.com/new napravi repo `tech-pulse`
2. Pushaj postojeći kod:
```bash
cd tech-pulse/
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TVOJ-USERNAME/tech-pulse.git
git push -u origin main
```

### 2b. GitHub Personal Access Token
1. Idi na https://github.com/settings/tokens?type=beta
2. "Generate new token" (Fine-grained)
3. Ime: "Tech Pulse Pipeline"
4. Repository access: Only select repositories → `tech-pulse`
5. Permissions: Contents → Read and write
6. Generate → kopiraj token (počinje s `github_pat_...` ili `ghp_...`)

### 2c. Vercel auto-deploy
1. Na https://vercel.com/dashboard klikni "Add New Project"
2. Import `tech-pulse` repo s GitHuba
3. Framework: Next.js (auto-detect)
4. Deploy!

Sada svaki commit na `main` branch = automatski deploy.

---

## KORAK 3: Napravi Telegram bota

1. U Telegramu nađi **@BotFather**
2. Pošalji: `/newbot`
3. Ime: `Tech Pulse Pipeline`
4. Username: `techpulse_pipeline_bot` (mora biti unikatan)
5. Kopiraj **BOT TOKEN**

### Doznaj svoj Chat ID:
1. Pošalji bilo koju poruku botu
2. Otvori u browseru: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Nađi `"chat":{"id":123456789}` — to je tvoj **CHAT ID**

---

## KORAK 4: Napravi .env file

```bash
cd pipeline/
cp .env.example .env
```

Popuni `.env`:

```env
# Telegram
TELEGRAM_BOT_TOKEN=7123456789:AAH...tvoj-token
TELEGRAM_ADMIN_CHAT_ID=123456789

# OpenAI (za rewriting članaka)
OPENAI_API_KEY=sk-tvoj-openai-key
OPENAI_MODEL=gpt-4o

# GitHub API (KLJUČNO - ovo omogućuje remote publishing)
GITHUB_TOKEN=ghp_tvoj-github-token
GITHUB_REPO=tvoj-username/tech-pulse

# Git branch
GIT_BRANCH=main

# Scraper
SCRAPE_INTERVAL_MINUTES=30
MAX_ARTICLES_PER_SCRAPE=10
```

---

## KORAK 5: Pokreni bota

```bash
cd pipeline/
python bot.py
```

---

## KORAK 6: Testiraj

1. U Telegramu pošalji botu: `/test`
2. Dobiješ test članak s gumbima
3. Klikni **Approve ✅**
4. Bot committa MDX na GitHub → Vercel deploya → članak je live za ~60s
5. Pošalji `/scrape` za ručni scrape RSS feedova

---

## Remote Publishing API (za Kimi / OpenClaw / bilo koji AI)

### Objašnjenje za AI model:

Za publishanje članka na Tech Pulse, koristi GitHub Contents API.
NE TREBAŠ pristup lokalnom disku. Samo GitHub token i repo name.

### Opcija A: Koristi `publish_remote.py`

```python
from publish_remote import publish_to_github

article = {
    "id": "2026-02-14-tesla-optimus-preorder",
    "title": "Tesla Optimus Robot Now Available for Pre-Order",
    "category": "robotics",
    "date": "2026-02-14T12:00:00Z",
    "excerpt": "Tesla opens pre-orders for Optimus humanoid robot at $20,000.",
    "source": {"name": "The Verge", "url": "https://theverge.com/article"},
    "image": {"url": "/images/articles/placeholder.jpg", "alt": "Tesla Optimus robot"},
    "tags": ["tesla", "optimus", "robot", "humanoid"],
    "geo": {"name": "Austin, Texas", "lat": 30.2672, "lon": -97.7431, "countryCode": "US"},
    "featured": false,
    "content": "## Tesla Opens Optimus Pre-Orders\n\nContent here in Markdown..."
}

result = publish_to_github(article)
print(result)
# {"success": True, "message": "Published: Tesla Optimus...", "url": "https://github.com/..."}
```

### Opcija B: Direktno koristi GitHub API (bez Pythona)

```bash
# 1. Generiraj MDX content
# 2. Base64 encodaj
# 3. PUT na GitHub API

curl -X PUT \
  -H "Authorization: Bearer ghp_TVOj_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/USERNAME/tech-pulse/contents/content/robotics/2026-02-14-article.mdx \
  -d '{
    "message": "Add article: Tesla Optimus",
    "content": "BASE64_ENCODED_MDX_CONTENT",
    "branch": "main"
  }'
```

### Opcija C: Za bilo koji AI/bot koji zna HTTP

**Endpoint**: `PUT https://api.github.com/repos/{owner}/{repo}/contents/content/{category}/{id}.mdx`

**Headers**:
```
Authorization: Bearer {GITHUB_TOKEN}
Accept: application/vnd.github+json
```

**Body**:
```json
{
  "message": "Add article: {title}",
  "content": "{base64_encoded_mdx_file}",
  "branch": "main"
}
```

**MDX file format** (ovo se base64 encodira):
```
---
id: "2026-02-14-slug"
title: "Article Title"
category: "ai"
date: "2026-02-14T12:00:00Z"
excerpt: "Short description max 250 chars"
source:
  name: "TechCrunch"
  url: "https://source-url.com"
image:
  url: "/images/articles/placeholder.jpg"
  alt: "Image description"
tags: ["tag1", "tag2"]
geo:
  name: "San Francisco, California"
  lat: 37.7749
  lon: -122.4194
  countryCode: "US"
featured: false
approved: true
---

## Article Heading

Article body in Markdown format...
```

---

## Format članka (JSON)

```json
{
  "id": "2026-02-14-url-slug-lowercase",
  "title": "Full Article Title",
  "category": "ai|gaming|space|technology|medicine|society|robotics",
  "date": "2026-02-14T12:00:00Z",
  "excerpt": "Max 250 characters summary.",
  "source": {"name": "Source Name", "url": "https://original-url"},
  "image": {"url": "/images/articles/x.jpg", "alt": "Description"},
  "tags": ["tag1", "tag2", "tag3"],
  "geo": {"name": "City, Country", "lat": 0.0, "lon": 0.0, "countryCode": "XX"},
  "featured": false,
  "content": "## Heading\n\nMarkdown body 400-900 words..."
}
```

### Pravila:
- **id**: `YYYY-MM-DD-slug` format, lowercase, samo slova/brojevi/crtice
- **category**: MORA biti jedan od: `ai`, `gaming`, `space`, `technology`, `medicine`, `society`, `robotics`
- **date**: ISO 8601 s timezone
- **excerpt**: max 250 znakova
- **tags**: 1-10 tagova, lowercase
- **geo**: koristi koordinate iz `geo_map.json`, ili postavi `null` za Global
- **content**: Markdown, 400-900 riječi, koristi `##` za podnaslove
- **featured**: `true` = prikaži kao glavnu vijest na homepage

---

## Brisanje članka (remote)

```python
from publish_remote import delete_article
result = delete_article("ai", "2026-02-14-article-slug")
```

Ili CLI:
```bash
python publish_remote.py --delete ai 2026-02-14-article-slug
```

---

## Listanje svih članaka

```python
from publish_remote import list_articles
articles = list_articles()
# ["ai/2026-02-13-openai-gpt5-release.mdx", "gaming/2026-02-12-gta-vi-launch.mdx", ...]
```

Ili CLI:
```bash
python publish_remote.py --list
```

---

## Kako najnoviji članci zamjenjuju starije

Članci se sortiraju po `date` polju. Najnoviji idu na vrh.
Homepage prikazuje:
- **Hero**: Članak s `featured: true` (ili najnoviji)
- **Grid**: Ostali sortirani po datumu

Za rotaciju: obriši stare članke s `delete_article()` ili postavi `approved: false`.

---

## RSS Feed izvori

Konfigurirani u `rss_sources.json`. Trenutno 12 izvora:
TechCrunch, The Verge, Ars Technica, Wired, SpaceNews, Space.com,
MIT Tech Review, IEEE Spectrum, STAT News, Engadget, VentureBeat, The Robot Report.

Dodaj nove u `rss_sources.json`:
```json
{"name": "Novi Izvor", "url": "https://example.com/rss", "categories": ["ai"], "priority": 1}
```

---

## Geo lokacije

Poznate lokacije su u `geo_map.json` (55+ lokacija).
Uključuje tech hub-ove (Silicon Valley, Seoul, Shenzhen...),
svemirske baze (Cape Canaveral, Baikonur...) i company HQ mapiranja
(OpenAI→San Francisco, Tesla→Austin, Samsung→Seoul...).

---

## Kategorije i boje na globusu

| Kategorija | Boja | Emoji |
|-----------|------|-------|
| AI | #A78BFA ljubičasta | 🧠 |
| Gaming | #F87171 crvena | 🎮 |
| Space | #60A5FA plava | 🚀 |
| Technology | #34D399 zelena | ⚙️ |
| Medicine | #FB923C narančasta | 💊 |
| Society | #F472B6 roza | 👥 |
| Robotics | #38BDF8 cyan | 🤖 |

---

## Troubleshooting

| Problem | Rješenje |
|---------|---------|
| GitHub API 401 | Token neispravan ili istekao. Generiraj novi na github.com/settings/tokens |
| GitHub API 404 | Repo ne postoji ili token nema pristup. Provjeri GITHUB_REPO format: `username/repo` |
| GitHub API 409 | Conflict - file se updejta istovremeno. Pokušaj ponovo. |
| Vercel ne deploya | Provjeri je li repo povezan na vercel.com dashboard |
| OpenAI error | Provjeri API key i kredit na OpenAI accountu |
| Bot ne odgovara | Provjeri TELEGRAM_BOT_TOKEN i da je bot pokrenut |

---

## Automatski startup

### Windows (Task Scheduler):
- Program: `python`, Arguments: `bot.py`, Start in: `pipeline/`

### Linux (systemd/cron):
```bash
# crontab -e
@reboot cd /path/to/pipeline && python bot.py >> bot.log 2>&1 &
```

---

**KRAJ UPUTA**
