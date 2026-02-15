"""
publish_remote.py — Publish articles to Tech Pulse via GitHub API

No local access needed. Creates/updates MDX files directly in the GitHub
repository, which triggers Vercel auto-deploy.

Usage:
    python publish_remote.py article.json
    echo '{"id": ...}' | python publish_remote.py --stdin

Requires in .env:
    GITHUB_TOKEN - GitHub Personal Access Token (with repo scope)
    GITHUB_REPO  - Repository in format "username/repo-name"
"""

import base64
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "")  # e.g. "chagalj/tech-pulse"
GITHUB_BRANCH = os.getenv("GIT_BRANCH", "main")
GITHUB_API = "https://api.github.com"

VALID_CATEGORIES = ["ai", "gaming", "space", "technology", "medicine", "society", "robotics"]


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def generate_mdx(data: dict) -> str:
    """Convert article JSON to MDX frontmatter + content."""
    geo = data.get("geo") or {}
    source = data.get("source", {})
    image = data.get("image", {})
    tags = data.get("tags", [])

    lines = [
        "---",
        f'id: "{data["id"]}"',
        f'title: "{data["title"].replace(chr(34), chr(92)+chr(34))}"',
        f'category: "{data["category"]}"',
        f'date: "{data["date"]}"',
        f'excerpt: "{data["excerpt"].replace(chr(34), chr(92)+chr(34))}"',
        f"source:",
        f'  name: "{source.get("name", "")}"',
        f'  url: "{source.get("url", "")}"',
        f"image:",
        f'  url: "{image.get("url", "/images/articles/placeholder.jpg")}"',
        f'  alt: "{image.get("alt", "Article image").replace(chr(34), chr(92)+chr(34))}"',
        f'tags: [{", ".join(f"{chr(34)}{t}{chr(34)}" for t in tags)}]',
    ]

    if geo and geo.get("lat") is not None:
        lines += [
            f"geo:",
            f'  name: "{geo.get("name", "Global")}"',
            f'  lat: {geo["lat"]}',
            f'  lon: {geo["lon"]}',
            f'  countryCode: "{geo.get("countryCode", "XX")}"',
        ]
    else:
        lines += [
            f"geo:",
            f'  name: "Global"',
            f"  lat: 0",
            f"  lon: 0",
            f'  countryCode: "XX"',
        ]

    lines += [
        f'featured: {str(data.get("featured", False)).lower()}',
        f'approved: true',
        "---",
        "",
        data.get("content", "").strip(),
        "",
    ]

    return "\n".join(lines)


def get_existing_file_sha(file_path: str) -> str | None:
    """Check if file exists in repo and return its SHA (needed for updates)."""
    url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{file_path}"
    resp = requests.get(url, headers=_headers(), params={"ref": GITHUB_BRANCH})
    if resp.status_code == 200:
        return resp.json().get("sha")
    return None


def publish_to_github(article: dict) -> dict:
    """
    Publish an article by creating/updating an MDX file in the GitHub repo.

    Returns: {"success": bool, "message": str, "url": str}
    """
    if not GITHUB_TOKEN:
        return {"success": False, "message": "GITHUB_TOKEN not set", "url": ""}
    if not GITHUB_REPO:
        return {"success": False, "message": "GITHUB_REPO not set", "url": ""}

    # Validate category
    category = article.get("category", "technology")
    if category not in VALID_CATEGORIES:
        category = "technology"
        article["category"] = category

    # Ensure ID exists — ASCII-only slug (strip diacritics: š→s, č→c, etc.)
    if not article.get("id"):
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        slug = article.get("title", "untitled").lower()
        # Normalize unicode: decompose diacritics then strip combining marks
        slug = unicodedata.normalize("NFKD", slug)
        slug = slug.encode("ascii", "ignore").decode("ascii")
        slug = re.sub(r"[^a-z0-9]+", "-", slug)
        slug = slug.strip("-")[:60].rstrip("-")
        article["id"] = f"{date_str}-{slug}"
    else:
        # Also sanitize existing IDs that may contain non-ASCII
        old_id = article["id"]
        sanitized = unicodedata.normalize("NFKD", old_id)
        sanitized = sanitized.encode("ascii", "ignore").decode("ascii")
        sanitized = re.sub(r"[^a-z0-9-]+", "-", sanitized.lower())
        sanitized = sanitized.strip("-").rstrip("-")
        if sanitized != old_id:
            article["id"] = sanitized

    # Ensure date exists
    if not article.get("date"):
        article["date"] = datetime.now(timezone.utc).isoformat()

    # Generate MDX
    mdx_content = generate_mdx(article)
    file_path = f"content/{category}/{article['id']}.mdx"

    # Check if file exists (for update)
    existing_sha = get_existing_file_sha(file_path)

    # Create/update file via GitHub API
    url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{file_path}"
    payload = {
        "message": f"Add article: {article['title'][:60]}",
        "content": base64.b64encode(mdx_content.encode("utf-8")).decode("ascii"),
        "branch": GITHUB_BRANCH,
    }

    if existing_sha:
        payload["sha"] = existing_sha
        payload["message"] = f"Update article: {article['title'][:60]}"

    resp = requests.put(url, headers=_headers(), json=payload)

    if resp.status_code in (200, 201):
        file_url = resp.json().get("content", {}).get("html_url", "")
        action = "Updated" if existing_sha else "Published"
        return {
            "success": True,
            "message": f"{action}: {article['title']}",
            "url": file_url,
            "file_path": file_path,
        }
    else:
        error = resp.json().get("message", resp.text[:200])
        return {
            "success": False,
            "message": f"GitHub API error ({resp.status_code}): {error}",
            "url": "",
        }


def delete_article(category: str, article_id: str) -> dict:
    """Delete an article from the repo."""
    file_path = f"content/{category}/{article_id}.mdx"
    sha = get_existing_file_sha(file_path)

    if not sha:
        return {"success": False, "message": f"Article not found: {file_path}"}

    url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{file_path}"
    payload = {
        "message": f"Remove article: {article_id}",
        "sha": sha,
        "branch": GITHUB_BRANCH,
    }

    resp = requests.delete(url, headers=_headers(), json=payload)

    if resp.status_code == 200:
        return {"success": True, "message": f"Deleted: {file_path}"}
    else:
        error = resp.json().get("message", resp.text[:200])
        return {"success": False, "message": f"Delete failed: {error}"}


def list_articles() -> list[str]:
    """List all article files in the repo."""
    articles = []
    for cat in VALID_CATEGORIES:
        url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/content/{cat}"
        resp = requests.get(url, headers=_headers(), params={"ref": GITHUB_BRANCH})
        if resp.status_code == 200:
            for item in resp.json():
                if item["name"].endswith(".mdx"):
                    articles.append(f"{cat}/{item['name']}")
    return articles


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def read_input() -> dict:
    args = sys.argv[1:]
    if "--stdin" in args:
        return json.loads(sys.stdin.read())
    if "--list" in args:
        print("Articles in repo:")
        for a in list_articles():
            print(f"  {a}")
        sys.exit(0)
    if "--delete" in args:
        idx = args.index("--delete")
        if idx + 2 < len(args):
            result = delete_article(args[idx + 1], args[idx + 2])
            print(result["message"])
            sys.exit(0 if result["success"] else 1)
        else:
            print("Usage: --delete <category> <article-id>")
            sys.exit(1)
    if not args or args[0].startswith("-"):
        print("Usage:")
        print("  python publish_remote.py article.json    # Publish article")
        print('  echo \'{"id":...}\' | python publish_remote.py --stdin')
        print("  python publish_remote.py --list           # List all articles")
        print("  python publish_remote.py --delete ai my-article-id")
        sys.exit(1)

    with open(args[0], "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    data = read_input()
    result = publish_to_github(data)
    print(result["message"])
    if result.get("url"):
        print(f"URL: {result['url']}")
    sys.exit(0 if result["success"] else 1)
