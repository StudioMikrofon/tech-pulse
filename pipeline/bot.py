"""
bot.py — Tech Pulse Telegram Bot

Receives article candidates from the scraper, sends them to an admin
for approval via Telegram inline buttons, and publishes approved articles.

Usage:
    python bot.py

Requires .env with:
    TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TECH_PULSE_DIR
"""

import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from publish_remote import publish_to_github
from scraper import get_candidates

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv(Path(__file__).parent / ".env")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = int(os.getenv("TELEGRAM_ADMIN_CHAT_ID", "0"))
SCRAPE_INTERVAL = int(os.getenv("SCRAPE_INTERVAL_MINUTES", "30")) * 60

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------
pending: dict[str, dict] = {}      # id -> article candidate
published: list[str] = []           # list of published titles
editing: dict[int, str] = {}        # chat_id -> article id being edited

CATEGORY_EMOJI = {
    "ai": "🧠",
    "gaming": "🎮",
    "space": "🚀",
    "technology": "⚙️",
    "medicine": "💊",
    "society": "👥",
    "robotics": "🤖",
}


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text[:60].strip("-")


def make_article_id(title: str) -> str:
    """Generate article ID from date + title slug."""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{date_str}-{slugify(title)}"


# ---------------------------------------------------------------------------
# Message formatting
# ---------------------------------------------------------------------------
def format_candidate(article: dict) -> str:
    """Format article candidate for Telegram message."""
    cat = article.get("category", "technology")
    emoji = CATEGORY_EMOJI.get(cat, "📰")
    geo_name = article.get("geo", {}).get("name", "Global")
    tags = " ".join(f"#{t.replace('-', '_')}" for t in article.get("tags", [])[:5])

    return (
        f"📰 <b>NEW ARTICLE CANDIDATE</b>\n\n"
        f"Category: {emoji} <b>{cat.upper()}</b>\n"
        f"Title: <b>{article.get('title', 'Untitled')}</b>\n\n"
        f"Excerpt: <i>{article.get('excerpt', '')[:200]}</i>\n\n"
        f"Source: {article.get('source', {}).get('name', 'Unknown')}\n"
        f"Location: 📍 {geo_name}\n"
        f"Tags: {tags}\n"
    )


def make_buttons(article_id: str) -> InlineKeyboardMarkup:
    """Create approve/reject/edit buttons."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_{article_id}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{article_id}"),
        ],
        [
            InlineKeyboardButton("✏️ Edit Title", callback_data=f"edit_{article_id}"),
        ],
    ])


# ---------------------------------------------------------------------------
# Bot handlers
# ---------------------------------------------------------------------------
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🛰️ <b>Tech Pulse Pipeline Bot</b>\n\n"
        "Commands:\n"
        "/scrape — Manually trigger a scrape\n"
        "/status — Show bot status\n"
        "/test — Send a test article candidate\n\n"
        "I will periodically scrape RSS feeds and send you article "
        "candidates for approval. Approved articles are automatically "
        "published to Tech Pulse.",
        parse_mode="HTML",
    )


async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        f"📊 <b>Tech Pulse Status</b>\n\n"
        f"Pending candidates: {len(pending)}\n"
        f"Published this session: {len(published)}\n"
        f"Scrape interval: {SCRAPE_INTERVAL // 60} min\n",
        parse_mode="HTML",
    )


async def cmd_scrape(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🔍 Scraping feeds...")
    await run_scrape(ctx)


async def cmd_test(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Send a test article candidate for verification."""
    test_article = {
        "id": make_article_id("Test Article Pipeline Check"),
        "title": "Test Article — Pipeline Check",
        "category": "technology",
        "date": datetime.now(timezone.utc).isoformat(),
        "excerpt": "This is a test article to verify the pipeline is working correctly.",
        "source": {"name": "Tech Pulse Test", "url": "https://tech-pulse-delta.vercel.app"},
        "image": {"url": "/images/articles/test.jpg", "alt": "Test article image"},
        "tags": ["test", "pipeline"],
        "geo": {"name": "Zagreb, Croatia", "lat": 45.815, "lon": 15.9819, "countryCode": "HR"},
        "content": "## Test Article\n\nThis is a test article generated by the Tech Pulse pipeline bot to verify that the publishing system works correctly.\n\n## Verification\n\nIf you see this on the website after approving, the pipeline is fully operational.",
    }

    article_id = test_article["id"]
    pending[article_id] = test_article

    await ctx.bot.send_message(
        chat_id=update.effective_chat.id,
        text=format_candidate(test_article),
        reply_markup=make_buttons(article_id),
        parse_mode="HTML",
    )


async def handle_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Handle approve/reject/edit button presses."""
    query = update.callback_query
    await query.answer()

    data = query.data
    if not data:
        return

    # Parse action and article ID
    parts = data.split("_", 1)
    if len(parts) != 2:
        return

    action, article_id = parts[0], parts[1]
    article = pending.get(article_id)

    if not article:
        await query.edit_message_text("⚠️ Article no longer available (expired or already processed).")
        return

    if action == "approve":
        await query.edit_message_text(
            f"⏳ Publishing: <b>{article['title']}</b>...",
            parse_mode="HTML",
        )

        # Build full article payload for GitHub API
        article_payload = {
            "id": article_id,
            "title": article.get("title", "Untitled"),
            "category": article.get("category", "technology"),
            "date": article.get("published") or article.get("date", datetime.now(timezone.utc).isoformat()),
            "excerpt": article.get("excerpt", ""),
            "source": {
                "name": article.get("source_name", article.get("source", {}).get("name", "Unknown")),
                "url": article.get("original_link", article.get("source", {}).get("url", "")),
            },
            "image": article.get("image", {"url": "/images/articles/placeholder.jpg", "alt": "Article image"}),
            "tags": article.get("tags", []),
            "geo": article.get("geo"),
            "featured": article.get("featured", False),
            "content": article.get("content", ""),
        }

        # Publish via GitHub API (no local access needed)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, publish_to_github, article_payload)

        if result["success"]:
            published.append(article["title"])
            del pending[article_id]
            await query.edit_message_text(
                f"✅ <b>Published:</b> {article['title']}\n\n"
                f"🌐 Vercel auto-deploy triggered. Live in ~60 seconds.",
                parse_mode="HTML",
            )
        else:
            await query.edit_message_text(
                f"❌ <b>Publish failed:</b> {article['title']}\n"
                f"Error: {result['message']}",
                parse_mode="HTML",
            )

    elif action == "reject":
        title = article["title"]
        del pending[article_id]
        await query.edit_message_text(
            f"❌ <b>Rejected:</b> {title}",
            parse_mode="HTML",
        )

    elif action == "edit":
        editing[query.from_user.id] = article_id
        await query.edit_message_text(
            f"✏️ <b>Editing:</b> {article['title']}\n\n"
            f"Send me the new title:",
            parse_mode="HTML",
        )


async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Handle text messages (for title editing)."""
    user_id = update.effective_user.id

    if user_id in editing:
        article_id = editing.pop(user_id)
        article = pending.get(article_id)

        if not article:
            await update.message.reply_text("⚠️ Article no longer available.")
            return

        new_title = update.message.text.strip()
        article["title"] = new_title

        # Generate new ID based on new title
        new_id = make_article_id(new_title)
        article["id"] = new_id
        del pending[article_id]
        pending[new_id] = article

        await update.message.reply_text(
            f"✅ Title updated!\n\n" + format_candidate(article),
            reply_markup=make_buttons(new_id),
            parse_mode="HTML",
        )


# ---------------------------------------------------------------------------
# Scraper integration
# ---------------------------------------------------------------------------
async def run_scrape(ctx: ContextTypes.DEFAULT_TYPE):
    """Run the scraper and send candidates to admin."""
    try:
        loop = asyncio.get_event_loop()
        candidates = await loop.run_in_executor(None, get_candidates)

        if not candidates:
            await ctx.bot.send_message(
                chat_id=ADMIN_CHAT_ID,
                text="🔍 Scrape complete — no new articles found.",
            )
            return

        await ctx.bot.send_message(
            chat_id=ADMIN_CHAT_ID,
            text=f"🔍 Found <b>{len(candidates)}</b> new article(s):",
            parse_mode="HTML",
        )

        for candidate in candidates:
            article_id = candidate.get("id") or make_article_id(candidate.get("title", "untitled"))
            candidate["id"] = article_id
            pending[article_id] = candidate

            await ctx.bot.send_message(
                chat_id=ADMIN_CHAT_ID,
                text=format_candidate(candidate),
                reply_markup=make_buttons(article_id),
                parse_mode="HTML",
            )

            # Small delay to avoid Telegram rate limits
            await asyncio.sleep(1)

    except Exception as e:
        log.error(f"Scrape failed: {e}")
        try:
            await ctx.bot.send_message(
                chat_id=ADMIN_CHAT_ID,
                text=f"⚠️ Scrape error: {e}",
            )
        except Exception:
            pass


async def scheduled_scrape(ctx: ContextTypes.DEFAULT_TYPE):
    """Periodic scrape callback for JobQueue."""
    await run_scrape(ctx)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN not set in .env", file=sys.stderr)
        sys.exit(1)

    if not ADMIN_CHAT_ID:
        print("ERROR: TELEGRAM_ADMIN_CHAT_ID not set in .env", file=sys.stderr)
        sys.exit(1)

    log.info("Starting Tech Pulse Pipeline Bot...")

    app = Application.builder().token(BOT_TOKEN).build()

    # Register handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("scrape", cmd_scrape))
    app.add_handler(CommandHandler("test", cmd_test))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Schedule periodic scrape
    if SCRAPE_INTERVAL > 0:
        app.job_queue.run_repeating(
            scheduled_scrape,
            interval=SCRAPE_INTERVAL,
            first=10,  # first scrape 10 seconds after boot
        )
        log.info(f"Scheduled scraping every {SCRAPE_INTERVAL // 60} minutes")

    log.info("Bot is running. Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
