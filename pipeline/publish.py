"""
publish.py — Publish an article to Tech Pulse

Standalone script that takes a JSON article payload, writes it as MDX,
and optionally commits + pushes to git for auto-deploy.

Usage:
    python publish.py article.json
    python publish.py article.json --no-push
    echo '{"id": ...}' | python publish.py --stdin
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from dotenv import load_dotenv

# Load .env from same directory
load_dotenv(Path(__file__).parent / ".env")

TECH_PULSE_DIR = os.getenv("TECH_PULSE_DIR", str(Path(__file__).parent.parent))
GIT_AUTO_PUSH = os.getenv("GIT_AUTO_PUSH", "true").lower() == "true"
GIT_REMOTE = os.getenv("GIT_REMOTE", "origin")
GIT_BRANCH = os.getenv("GIT_BRANCH", "main")


def publish_article(article_data: dict, push: bool = True) -> bool:
    """
    Publish an article by:
    1. Writing JSON to a temp file
    2. Running add-article.ts script
    3. Git add, commit, push (if enabled)

    Returns True on success, False on failure.
    """
    project_dir = Path(TECH_PULSE_DIR)

    if not project_dir.exists():
        print(f"ERROR: Project directory not found: {project_dir}", file=sys.stderr)
        return False

    # 1. Write to temp JSON file
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    )
    try:
        json.dump(article_data, tmp, ensure_ascii=False, indent=2)
        tmp.close()

        print(f"Publishing: {article_data.get('title', 'Unknown')}")

        # 2. Run add-article script
        result = subprocess.run(
            ["npx", "tsx", "scripts/add-article.ts", "--input", tmp.name],
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            print(f"ERROR: add-article failed:\n{result.stderr}", file=sys.stderr)
            return False

        print(result.stdout)

        # 3. Git operations
        if push and GIT_AUTO_PUSH:
            title_short = article_data.get("title", "article")[:60]

            # Stage content files
            subprocess.run(
                ["git", "add", "content/"],
                cwd=str(project_dir),
                capture_output=True,
                timeout=10,
            )

            # Commit
            commit_result = subprocess.run(
                ["git", "commit", "-m", f"Add article: {title_short}"],
                cwd=str(project_dir),
                capture_output=True,
                text=True,
                timeout=10,
            )

            if commit_result.returncode != 0:
                print(f"WARNING: Git commit issue: {commit_result.stderr}", file=sys.stderr)
            else:
                print(f"Committed: {title_short}")

            # Push
            push_result = subprocess.run(
                ["git", "push", GIT_REMOTE, GIT_BRANCH],
                cwd=str(project_dir),
                capture_output=True,
                text=True,
                timeout=30,
            )

            if push_result.returncode != 0:
                print(f"WARNING: Git push issue: {push_result.stderr}", file=sys.stderr)
            else:
                print(f"Pushed to {GIT_REMOTE}/{GIT_BRANCH}")

        print("SUCCESS: Article published!")
        return True

    except subprocess.TimeoutExpired:
        print("ERROR: Command timed out", file=sys.stderr)
        return False
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return False
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def read_input() -> dict:
    """Read article JSON from file argument or stdin."""
    args = sys.argv[1:]

    if "--stdin" in args:
        raw = sys.stdin.read()
        return json.loads(raw)

    if "--no-push" in args:
        args.remove("--no-push")

    if not args:
        print("Usage: python publish.py <article.json> [--no-push]")
        print("       echo '{...}' | python publish.py --stdin [--no-push]")
        sys.exit(1)

    file_path = Path(args[0])
    if not file_path.exists():
        print(f"File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    no_push = "--no-push" in sys.argv
    data = read_input()
    success = publish_article(data, push=not no_push)
    sys.exit(0 if success else 1)
