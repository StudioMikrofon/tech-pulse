"""
Tech Pulse RSS Scraper
======================
Scrapes RSS feeds from configured sources, uses OpenAI to rewrite articles
as tech news pieces, extracts geo data, and produces article candidates
for editorial approval via Telegram.
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PIPELINE_DIR = Path(__file__).resolve().parent
SOURCES_FILE = PIPELINE_DIR / "rss_sources.json"
GEO_MAP_FILE = PIPELINE_DIR / "geo_map.json"
SEEN_FILE = PIPELINE_DIR / "seen_articles.json"
ENV_FILE = PIPELINE_DIR / ".env"

# Load environment variables from the pipeline directory
load_dotenv(ENV_FILE)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

VALID_CATEGORIES = ["ai", "gaming", "space", "technology", "medicine", "society", "robotics"]

# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def load_sources() -> list[dict]:
    """Load RSS source configurations from rss_sources.json."""
    try:
        with open(SOURCES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("sources", [])
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"[scraper] Error loading sources: {exc}", file=sys.stderr)
        return []


def load_geo_map() -> dict:
    """Load known geo locations and company HQ mappings from geo_map.json."""
    try:
        with open(GEO_MAP_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"[scraper] Error loading geo map: {exc}", file=sys.stderr)
        return {"known_locations": {}, "company_hq": {}}


def load_seen() -> set[str]:
    """Load set of previously-seen article URLs from seen_articles.json."""
    try:
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return set(data)
    except FileNotFoundError:
        return set()
    except json.JSONDecodeError as exc:
        print(f"[scraper] Error loading seen articles: {exc}", file=sys.stderr)
        return set()


def save_seen(seen: set[str]) -> None:
    """Persist the set of seen article URLs to seen_articles.json."""
    try:
        with open(SEEN_FILE, "w", encoding="utf-8") as f:
            json.dump(sorted(seen), f, indent=2, ensure_ascii=False)
    except OSError as exc:
        print(f"[scraper] Error saving seen articles: {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Feed scraping
# ---------------------------------------------------------------------------

def _clean_html(raw_html: str) -> str:
    """Strip HTML tags and return plain text."""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=" ", strip=True)


def _parse_published(entry) -> str:
    """Extract an ISO-8601 published date from a feed entry, or return now."""
    for attr in ("published_parsed", "updated_parsed"):
        tp = getattr(entry, attr, None)
        if tp:
            try:
                dt = datetime(*tp[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()


def scrape_feeds() -> list[dict]:
    """
    Parse all configured RSS feeds and return a list of *new* raw entries
    (those not already in the seen set).

    Each entry dict contains:
        source_name, source_url, title, link, published, summary
    """
    sources = load_sources()
    seen = load_seen()
    new_entries: list[dict] = []

    for source in sources:
        name = source.get("name", "Unknown")
        url = source.get("url", "")
        if not url:
            continue

        print(f"[scraper] Fetching {name}: {url}", file=sys.stderr)
        try:
            feed = feedparser.parse(url)
        except Exception as exc:
            print(f"[scraper] Failed to parse {name}: {exc}", file=sys.stderr)
            continue

        for entry in feed.entries:
            link = getattr(entry, "link", "")
            if not link or link in seen:
                continue

            summary_raw = getattr(entry, "summary", "") or getattr(entry, "description", "")
            summary = _clean_html(summary_raw)

            new_entries.append({
                "source_name": name,
                "source_url": url,
                "title": getattr(entry, "title", "Untitled"),
                "link": link,
                "published": _parse_published(entry),
                "summary": summary[:2000],  # cap at 2000 chars for the prompt
            })

            # Mark as seen immediately to avoid duplicates within the same run
            seen.add(link)

    # Persist updated seen set
    save_seen(seen)
    print(f"[scraper] Found {len(new_entries)} new articles across all feeds.", file=sys.stderr)
    return new_entries


# ---------------------------------------------------------------------------
# OpenAI article processing
# ---------------------------------------------------------------------------

def _build_known_locations_hint(geo_map: dict) -> str:
    """Build a compact hint string of known location names for the prompt."""
    names = list(geo_map.get("known_locations", {}).keys())
    companies = list(geo_map.get("company_hq", {}).keys())
    return (
        "Known locations: " + ", ".join(names) + "\n"
        "Known company HQs: " + ", ".join(f"{c} -> {geo_map['company_hq'][c]}" for c in companies)
    )


def _resolve_geo(geo_raw: dict | None, geo_map: dict) -> dict | None:
    """
    If the model returned a geo name that matches a known location in geo_map,
    use the canonical coordinates. Otherwise keep the model's response as-is.
    """
    if not geo_raw or not isinstance(geo_raw, dict):
        return None

    geo_name = geo_raw.get("name", "")
    known = geo_map.get("known_locations", {})
    company_hq = geo_map.get("company_hq", {})

    # Check if the name directly matches a known location key
    for key, loc in known.items():
        if key.lower() in geo_name.lower():
            return {
                "name": loc["name"],
                "lat": loc["lat"],
                "lon": loc["lon"],
                "countryCode": loc["countryCode"],
            }

    # Check if a known company name appears in the geo name
    for company, hq_key in company_hq.items():
        if company.lower() in geo_name.lower() and hq_key in known:
            loc = known[hq_key]
            return {
                "name": loc["name"],
                "lat": loc["lat"],
                "lon": loc["lon"],
                "countryCode": loc["countryCode"],
            }

    # Fall back to the model's own coordinates if present
    if geo_raw.get("lat") is not None and geo_raw.get("lon") is not None:
        return {
            "name": geo_raw.get("name", "Unknown"),
            "lat": float(geo_raw["lat"]),
            "lon": float(geo_raw["lon"]),
            "countryCode": geo_raw.get("countryCode", ""),
        }

    return None


def process_article(entry: dict, geo_map: dict) -> dict | None:
    """
    Use OpenAI to rewrite a feed entry into a Tech Pulse article candidate.

    Returns a dict with keys:
        source_name, source_url, original_link, published,
        category, title, excerpt, content, tags, geo
    or None if processing fails.
    """
    if not OPENAI_API_KEY:
        print("[scraper] OPENAI_API_KEY not set. Skipping article.", file=sys.stderr)
        return None

    client = OpenAI(api_key=OPENAI_API_KEY)

    locations_hint = _build_known_locations_hint(geo_map)

    system_prompt = (
        "You are a senior tech journalist writing for Tech Pulse, a modern tech news portal. "
        "You rewrite source material into original, engaging tech news articles. "
        "Your writing is factual, concise, and accessible to a broad tech-savvy audience. "
        "Always write in English."
    )

    user_prompt = f"""Rewrite the following RSS feed entry as a Tech Pulse article.

SOURCE: {entry['source_name']}
TITLE: {entry['title']}
LINK: {entry['link']}
PUBLISHED: {entry['published']}
SUMMARY:
{entry['summary']}

INSTRUCTIONS:
1. Choose the single best category from: {', '.join(VALID_CATEGORIES)}
2. Write a new, compelling headline (title).
3. Write an excerpt of max 250 characters summarising the key point.
4. Write the full article as 400-700 words in Markdown. Be factual and informative.
   Do NOT copy the original text verbatim - rewrite it in your own words.
   Use subheadings (##) where appropriate.
5. Include 3-5 relevant hyperlinks in the article body where appropriate.
   - Link to official websites, product pages, company sites, event pages, etc.
   - Use standard Markdown link syntax: [text](url)
   - Only use real, well-known URLs (e.g. official company sites, Wikipedia for concepts)
   - Don't link every word - be selective and natural
6. Generate 3-7 relevant tags (lowercase, no hashes).
7. Determine the primary geographic location relevant to this story.
   {locations_hint}
   If the article mentions a known company, map it to the company HQ.
   If you can identify a location, provide name, lat, lon, countryCode.
   If no location is relevant, set geo to null.

Respond with ONLY valid JSON (no markdown fences) in this exact schema:
{{
  "category": "string",
  "title": "string",
  "excerpt": "string",
  "content": "string (markdown)",
  "tags": ["string"],
  "geo": {{ "name": "string", "lat": number, "lon": number, "countryCode": "string" }} | null
}}"""

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=2000,
        )

        raw_text = response.choices[0].message.content.strip()

        # Strip markdown code fences if the model wrapped the JSON
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        result = json.loads(raw_text)

        # Validate category
        category = result.get("category", "technology").lower()
        if category not in VALID_CATEGORIES:
            category = "technology"

        # Validate excerpt length
        excerpt = result.get("excerpt", "")[:250]

        # Validate tags
        tags = result.get("tags", [])
        if not isinstance(tags, list):
            tags = []
        tags = [str(t).lower().strip() for t in tags[:7]]

        # Resolve geo against known locations
        geo = _resolve_geo(result.get("geo"), geo_map)

        return {
            "source_name": entry["source_name"],
            "source_url": entry["source_url"],
            "original_link": entry["link"],
            "published": entry["published"],
            "category": category,
            "title": result.get("title", entry["title"]),
            "excerpt": excerpt,
            "content": result.get("content", ""),
            "tags": tags,
            "geo": geo,
        }

    except json.JSONDecodeError as exc:
        print(
            f"[scraper] JSON parse error for '{entry['title']}': {exc}",
            file=sys.stderr,
        )
        return None
    except Exception as exc:
        print(
            f"[scraper] OpenAI error for '{entry['title']}': {exc}",
            file=sys.stderr,
        )
        return None


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def get_candidates() -> list[dict]:
    """
    Main entry point. Scrapes all configured RSS feeds, processes new articles
    through OpenAI, and returns a list of article candidate dicts ready for
    Telegram approval.
    """
    geo_map = load_geo_map()
    entries = scrape_feeds()

    candidates: list[dict] = []

    for i, entry in enumerate(entries, start=1):
        print(
            f"[scraper] Processing {i}/{len(entries)}: {entry['title'][:80]}",
            file=sys.stderr,
        )
        candidate = process_article(entry, geo_map)
        if candidate:
            candidates.append(candidate)

        # Small delay to respect rate limits
        if i < len(entries):
            time.sleep(1)

    print(f"[scraper] Produced {len(candidates)} candidates from {len(entries)} new articles.", file=sys.stderr)
    return candidates


# ---------------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("Tech Pulse RSS Scraper - Test Run")
    print("=" * 60)
    print(f"Sources file : {SOURCES_FILE}")
    print(f"Geo map file : {GEO_MAP_FILE}")
    print(f"Seen file    : {SEEN_FILE}")
    print(f"OpenAI model : {OPENAI_MODEL}")
    print(f"API key set  : {'Yes' if OPENAI_API_KEY else 'NO - articles will be skipped'}")
    print("=" * 60)

    candidates = get_candidates()

    if not candidates:
        print("\nNo candidates produced. Either no new articles or OpenAI key is missing.")
    else:
        for idx, c in enumerate(candidates, start=1):
            print(f"\n{'─' * 60}")
            print(f"Candidate {idx}/{len(candidates)}")
            print(f"  Category : {c['category']}")
            print(f"  Title    : {c['title']}")
            print(f"  Excerpt  : {c['excerpt']}")
            print(f"  Source   : {c['source_name']}")
            print(f"  Link     : {c['original_link']}")
            print(f"  Tags     : {', '.join(c['tags'])}")
            print(f"  Geo      : {c['geo']}")
            print(f"  Content  : {c['content'][:200]}...")

    print(f"\n{'=' * 60}")
    print(f"Total candidates: {len(candidates)}")
    print("=" * 60)
