#!/usr/bin/env python3
"""
SpeeQ LinkedIn templates renderer.
Rendert banner + 5 posts naar PNG via headless Chrome.

Gebruik:  python3 build.py
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

JOBS = [
    {"html": "banner.html",            "out": "banner-1584x396.png",       "w": 1584, "h": 396},
    {"html": "post-01-testimonial.html", "out": "post-01-testimonial.png", "w": 1080, "h": 1080},
    {"html": "post-02-tip.html",       "out": "post-02-tip.png",           "w": 1080, "h": 1080},
    {"html": "post-03-update.html",    "out": "post-03-update.png",        "w": 1080, "h": 1080},
    {"html": "post-04-bts.html",       "out": "post-04-bts.png",           "w": 1080, "h": 1080},
    {"html": "post-05-compare.html",   "out": "post-05-compare.png",       "w": 1080, "h": 1080},
]


def render(job: dict) -> None:
    html_path = HERE / job["html"]
    out_path = HERE / job["out"]
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        f"--window-size={job['w']},{job['h']}",
        f"--screenshot={out_path}",
        f"file://{html_path}",
    ]
    print(f"  → {job['out']} ({job['w']}x{job['h']})")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"     FOUT: {result.stderr[:300]}")
        sys.exit(1)


def main():
    print("SpeeQ LinkedIn renderer")
    for j in JOBS:
        render(j)
    print(f"\nKlaar. {len(JOBS)} PNG's in {HERE}/")


if __name__ == "__main__":
    main()
