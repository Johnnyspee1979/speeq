#!/usr/bin/env python3
"""
SpeeQ Juridisch PDF builder.

Reads markdown files from ../*.md, converts to branded HTML, then renders to PDF
via headless Chrome.

Usage:  python3 build.py
"""
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    import markdown
except ImportError:
    print("Installing markdown library...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "markdown"])
    import markdown

HERE = Path(__file__).parent.resolve()
SRC_DIR = HERE.parent  # docs/juridisch/
OUT_DIR = HERE  # docs/juridisch/pdf/

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Documenten om te renderen
DOCS = [
    {
        "src": "01-verwerkersovereenkomst.md",
        "out": "SpeeQ-Verwerkersovereenkomst.pdf",
        "title": "Verwerkersovereenkomst",
        "subtitle": "Data Processing Agreement — AVG / GDPR",
    },
    {
        "src": "02-algemene-voorwaarden.md",
        "out": "SpeeQ-Algemene-Voorwaarden.pdf",
        "title": "Algemene Voorwaarden",
        "subtitle": "Voorwaarden voor het gebruik van SpeeQ",
    },
    {
        "src": "03-privacyverklaring.md",
        "out": "SpeeQ-Privacyverklaring.pdf",
        "title": "Privacyverklaring",
        "subtitle": "Hoe wij omgaan met persoonsgegevens",
    },
    {
        "src": "04-soa-service-overeenkomst.md",
        "out": "SpeeQ-Service-Overeenkomst.pdf",
        "title": "Service-Overeenkomst (SOA)",
        "subtitle": "Inhoudelijke afspraken per pakket",
    },
]


COVER_TEMPLATE = """
<section class="cover">
  <div class="brand">
    <img src="assets/logo.png" alt="SpeeQ" />
    <div class="brand-text">Spee Solutions · Wkb-borging</div>
  </div>
  <h1>{title}</h1>
  <p class="subtitle">{subtitle}</p>
  <div class="meta">
    <strong>Versie 1.0</strong> &nbsp;·&nbsp; 2026-05-13 &nbsp;·&nbsp; Spee Solutions &nbsp;·&nbsp; KvK 99314770
  </div>
</section>
"""

HTML_SHELL = """<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>{title} — SpeeQ</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
{cover}
<main>
{body}
</main>
<footer class="doc-footer">
  Versie 1.0 · 2026-05-13 · Spee Solutions · https://speesolutions.com
</footer>
</body>
</html>
"""


def strip_first_h1_and_meta(md_text: str) -> str:
    """Verwijder eerste # heading + initiele meta-blockquote, want die staan al in de cover."""
    lines = md_text.splitlines()
    out = []
    skipped_h1 = False
    in_initial_meta = False
    for i, line in enumerate(lines):
        # Strip leidende # heading 1x
        if not skipped_h1 and line.startswith("# ") and not line.startswith("## "):
            skipped_h1 = True
            continue
        # Strip de eerste > blockquote-blok dat direct onder de h1 staat (metadata)
        if skipped_h1 and not out and line.startswith(">"):
            in_initial_meta = True
            continue
        if in_initial_meta:
            if line.startswith(">") or line.strip() == "":
                continue
            in_initial_meta = False
        out.append(line)
    # Strip leading empties
    while out and out[0].strip() == "":
        out.pop(0)
    return "\n".join(out)


def render_pdf(html_file: Path, pdf_file: Path) -> None:
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_file}",
        f"file://{html_file.absolute()}",
    ]
    print(f"  → rendering {pdf_file.name}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  FOUT: {result.stderr[:500]}")
        sys.exit(1)


def build_one(doc: dict) -> None:
    src_path = SRC_DIR / doc["src"]
    if not src_path.exists():
        print(f"  WAARSCHUWING: {src_path} bestaat niet, sla over.")
        return

    md_text = src_path.read_text(encoding="utf-8")
    md_text = strip_first_h1_and_meta(md_text)

    body_html = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists", "attr_list"],
    )

    cover = COVER_TEMPLATE.format(
        title=doc["title"],
        subtitle=doc["subtitle"],
    )

    html_full = HTML_SHELL.format(
        title=doc["title"],
        cover=cover,
        body=body_html,
    )

    html_path = OUT_DIR / (Path(doc["out"]).stem + ".html")
    html_path.write_text(html_full, encoding="utf-8")
    print(f"  ✓ HTML  → {html_path.name}")

    pdf_path = OUT_DIR / doc["out"]
    render_pdf(html_path, pdf_path)
    print(f"  ✓ PDF   → {pdf_path.name}")


def main():
    print(f"SpeeQ Juridisch PDF builder")
    print(f"  src: {SRC_DIR}")
    print(f"  out: {OUT_DIR}")
    print()
    for doc in DOCS:
        print(f"[{doc['src']}]")
        build_one(doc)
        print()
    print(f"Klaar. {len(DOCS)} PDF's gemaakt in {OUT_DIR}/")


if __name__ == "__main__":
    main()
