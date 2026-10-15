"""Build the Assignment 2 submission zip.

Writes dist/<team>_a1b.zip with one top folder named <team>_a1b/, as the brief asks.
The zip holds the files git tracks plus new files that git does not ignore, minus
the folders and file types the brief excludes. Run it from any directory:

    python scripts/make_submission.py --team 5
"""

import argparse
import re
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
MAX_BYTES = 20_000_000  # "strictly under 20 MB"

# Entries the brief names, plus the folders the brief excludes.
REQUIRED = [
    "README.md",
    "docs/handover_note.md",
    "docs/api_endpoints.md",
    "docs/design",
    "sql",
    "mongo",
    "data_generation",
    "api",
    "web",
]
EXCLUDED_DIRS = {
    "node_modules", "venv", ".venv", "__pycache__", "dist", "build",
    ".svelte-kit", "test-results", "playwright-report", ".devenv", ".git",
    # Local dev tooling, not part of the submission.
    ".claude",
}
# Root-level files that are dev tooling or the course briefs, not part of the submission.
EXCLUDED_ROOT_FILES = {".mcp.json", "CLAUDE.md", "skills-lock.json"}
EXCLUDED_SUFFIXES = {".pyc", ".zip", ".tar", ".gz", ".tgz", ".dump", ".bson", ".archive", ".log"}


def git(*args: str) -> str:
    result = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, check=True)
    return result.stdout


def candidate_files() -> list[str]:
    # -c tracked, -o other files, --exclude-standard honours .gitignore (node_modules, .venv, ...).
    listing = git("ls-files", "-co", "--exclude-standard", "-z")
    return sorted(p for p in listing.split("\0") if p)


def skip_reason(rel: str) -> str | None:
    parts = PurePosixPath(rel).parts
    if any(part in EXCLUDED_DIRS for part in parts[:-1]):
        return "excluded folder"
    name = parts[-1]
    suffix = PurePosixPath(name).suffix.lower()
    if len(parts) == 1 and (name in EXCLUDED_ROOT_FILES or suffix == ".pdf"):
        return "dev tooling or course brief at the root"
    if suffix in EXCLUDED_SUFFIXES:
        return "excluded file type"
    if "dump" in name.lower() and suffix == ".sql":
        return "database dump"
    if (ROOT / rel).is_symlink():
        return "symlink (points into the dev container)"
    if not (ROOT / rel).is_file():
        return "missing on disk"
    return None


def check_required() -> None:
    missing = [p for p in REQUIRED if not (ROOT / p).exists()]
    if missing:
        sys.exit(f"error: missing required paths: {', '.join(missing)}")


def commit_named_in(text: str) -> str | None:
    # The README cannot name its own commit (that commit does not exist yet), so accept any
    # hash in the README that resolves to a commit in this repository.
    for candidate in re.findall(r"\b[0-9a-f]{7,40}\b", text):
        result = subprocess.run(
            ["git", "-C", str(ROOT), "rev-parse", "--verify", "-q", f"{candidate}^{{commit}}"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    return None


def check_readme(team: str) -> list[str]:
    warnings = []
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    if not re.search(r"https://github\.com/\S+", text):
        warnings.append("README.md has no GitHub repository URL")
    named = commit_named_in(text)
    if named is None:
        warnings.append("README.md names no commit that exists in this repository")
    else:
        # Files that differ from the named commit (other than the README) would not be in that commit.
        changed = [p for p in git("diff", "--name-only", named).splitlines() if p != "README.md"]
        if changed:
            warnings.append(f"files changed since the commit named in README ({named[:7]}): {', '.join(changed[:5])}")
    if re.search(r"\bTODO\b", text):
        warnings.append("README.md still contains TODO markers")
    if f"{team}_a1b" not in text and team not in text:
        warnings.append(f"README.md does not mention team number {team}")
    return warnings


def check_git_clean() -> list[str]:
    if git("status", "--porcelain").strip():
        return ["uncommitted changes will be zipped; commit first so the README commit hash matches"]
    return []


def build(team: str) -> tuple[Path, int, dict[str, int]]:
    top = f"{team}_a1b"
    out = ROOT / "dist" / f"{top}.zip"
    out.parent.mkdir(exist_ok=True)
    out.unlink(missing_ok=True)

    included: list[str] = []
    skipped: dict[str, int] = {}
    for rel in candidate_files():
        reason = skip_reason(rel)
        if reason:
            skipped[reason] = skipped.get(reason, 0) + 1
        else:
            included.append(rel)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for rel in included:
            archive.write(ROOT / rel, f"{top}/{rel}")
    return out, len(included), skipped


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--team", default="5", help="new team number (default: 5)")
    args = parser.parse_args()
    if not args.team.isdigit():
        sys.exit("error: --team must be a number")

    check_required()
    warnings = check_readme(args.team) + check_git_clean()

    out, count, skipped = build(args.team)
    size = out.stat().st_size
    if size >= MAX_BYTES:
        sys.exit(f"error: {out.name} is {size / 1_000_000:.1f} MB, the limit is under 20 MB")

    print(f"wrote {out.relative_to(ROOT)}: {count} files, {size / 1_000_000:.2f} MB")
    for reason, n in sorted(skipped.items()):
        print(f"skipped {n} ({reason})")
    for warning in warnings:
        print(f"warning: {warning}")


if __name__ == "__main__":
    main()
