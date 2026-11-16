#!/usr/bin/env python3
"""Genererar platshållar-SVG:er för rätter som saknar bild.

Varje SVG får kategorins färg, ett mönster (så att zoomen syns) och bildens
hash-ID – aldrig rättens namn. Filnamnet är neutralt, t.ex. images/a7f3c2.svg.

Användning:
    python3 tools/make_placeholders.py          # bara rätter utan bild
    python3 tools/make_placeholders.py --force  # skriv om alla platshållare (.svg)
"""
import argparse
import hashlib
import json
import random
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "dishes.json"
IMAGES = ROOT / "images"

CATEGORY_COLORS = {
    "Bakat": ("#E9A23B", "#FFF1D0"),
    "Smörgås": ("#D9825B", "#FFE6D6"),
    "Pizza": ("#C8553D", "#FFDCD2"),
    "Pasta": ("#E8B730", "#FFF5CF"),
    "Sås": ("#C98F6B", "#FBE7D9"),
    "Ugnsrätt": ("#A8763E", "#F6E4CC"),
    "Varmrätt": ("#8C5E58", "#F1DEDA"),
    "Ägg": ("#E3B505", "#FFF6C7"),
    "Pannkaka": ("#C99560", "#F8E8D4"),
    "Tilltugg": ("#D9667F", "#FFDDE4"),
    "Soppa": ("#6F9A5E", "#E3F0DA"),
    "Sallad": ("#5E9A86", "#DAF0E8"),
}
DEFAULT_COLORS = ("#8A8A8A", "#EEEEEE")


def svg_for(image_id: str, category: str) -> str:
    base, light = CATEGORY_COLORS.get(category, DEFAULT_COLORS)
    rng = random.Random(image_id)
    shapes = []
    # "Osthål" i olika storlekar – ger något att se på varje zoomnivå.
    for _ in range(46):
        r = rng.choice([8, 14, 22, 36, 60, 95])
        cx, cy = rng.randint(0, 1200), rng.randint(0, 1200)
        op = rng.choice([0.18, 0.3, 0.45])
        shapes.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{light}" opacity="{op}"/>')
    # Vågiga "skinkrand"-linjer.
    for i in range(7):
        y = 90 + i * 170 + rng.randint(-40, 40)
        a = rng.randint(30, 80)
        shapes.append(
            f'<path d="M0 {y} C 300 {y - a}, 500 {y + a}, 800 {y} S 1100 {y - a}, 1200 {y}" '
            f'stroke="{light}" stroke-width="{rng.choice([6, 12, 20])}" fill="none" opacity="0.35"/>'
        )
    # Litet rutnät med koordinater så att man ser var man är inzoomad.
    grid = []
    for gx in range(0, 1200, 150):
        for gy in range(0, 1200, 150):
            grid.append(
                f'<text x="{gx + 8}" y="{gy + 22}" font-size="16" fill="#000" opacity="0.25" '
                f'font-family="monospace">{gx // 12},{gy // 12}</text>'
            )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200">
  <rect width="1200" height="1200" fill="{base}"/>
  {''.join(shapes)}
  {''.join(grid)}
  <rect x="380" y="530" width="440" height="140" rx="28" fill="#2B1D14" opacity="0.82"/>
  <text x="600" y="600" text-anchor="middle" dominant-baseline="middle" font-size="64"
        font-family="monospace" fill="{light}">#{image_id}</text>
</svg>
'''


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="generera om alla SVG-platshållare")
    args = ap.parse_args()

    dishes = json.loads(DATA.read_text(encoding="utf-8"))
    IMAGES.mkdir(exist_ok=True)
    made = 0
    for d in dishes:
        img = d.get("image") or ""
        is_placeholder = img.endswith(".svg")
        if img and not (args.force and is_placeholder):
            continue
        if img and is_placeholder:
            image_id = Path(img).stem
        else:
            image_id = hashlib.sha1(secrets.token_bytes(16)).hexdigest()[:8]
        (IMAGES / f"{image_id}.svg").write_text(svg_for(image_id, d["category"]), encoding="utf-8")
        d["image"] = f"images/{image_id}.svg"
        if not d.get("credit"):
            d["credit"] = "Platshållare (genererad SVG)"
        if d.get("focus") == {"x": 50, "y": 50}:
            rng = random.Random(image_id)
            d["focus"] = {"x": rng.randint(25, 75), "y": rng.randint(25, 75)}
        made += 1

    DATA.write_text(json.dumps(dishes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Klart: {made} platshållare skrivna till {IMAGES}")


if __name__ == "__main__":
    main()
