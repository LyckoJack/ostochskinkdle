#!/usr/bin/env python3
"""Lägger in en bild för en rätt.

Beskär till kvadrat (bildramen i spelet är kvadratisk), skalar ner till max
1200 px, sparar som WebP med hashat filnamn i images/ och uppdaterar
data/dishes.json (image, och valfritt credit/focus).

Exempel:
    python3 tools/add_image.py ~/Bilder/paj.jpg ost-och-skinkpaj \\
        --credit "Egen bild" --focus 42 61

    python3 tools/add_image.py foto.jpg cordon-bleu \\
        --credit "Foto: N.N., CC BY-SA 4.0, via Wikimedia Commons" --no-crop

Kräver Pillow:  pip install Pillow
"""
import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow saknas. Installera med:  pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "dishes.json"
IMAGES = ROOT / "images"
MAX_SIZE = 1200


def center_square(img):
    w, h = img.size
    s = min(w, h)
    left, top = (w - s) // 2, (h - s) // 2
    return img.crop((left, top, left + s, top + s))


def main():
    # Windows-konsoler/pipes med cp1252 klarar inte alla tecken (×, →) – krascha inte på utskrift.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except AttributeError:
            pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image", type=Path, help="källbild (jpg/png/webp/…)")
    ap.add_argument("dish_id", help="rättens id i dishes.json, t.ex. ost-och-skinkpaj")
    ap.add_argument("--credit", help='t.ex. "Egen bild" eller "Foto: N.N., CC BY-SA 4.0, via Wikimedia Commons"')
    ap.add_argument("--source", help="länk till originalet/licensen, t.ex. Commons-sidan")
    ap.add_argument("--focus", nargs=2, type=float, metavar=("X", "Y"), help="fokuspunkt i procent, t.ex. 42 61")
    ap.add_argument("--no-crop", action="store_true", help="beskär inte till kvadrat (spelet visar då object-fit: cover)")
    ap.add_argument("--quality", type=int, default=82, help="WebP-kvalitet (standard 82)")
    ap.add_argument("--remove-old", action="store_true", help="radera rättens tidigare bildfil i images/")
    args = ap.parse_args()

    dishes = json.loads(DATA.read_text(encoding="utf-8"))
    dish = next((d for d in dishes if d["id"] == args.dish_id), None)
    if dish is None:
        ids = ", ".join(sorted(d["id"] for d in dishes))
        sys.exit(f"Okänt id '{args.dish_id}'. Giltiga id:n:\n{ids}")

    if not args.image.is_file():
        sys.exit(f"Hittar inte bilden: {args.image}")

    with Image.open(args.image) as src:
        img = ImageOps.exif_transpose(src)  # rätta rotation från mobilkameror
        img = img.convert("RGB")
    if not args.no_crop:
        img = center_square(img)
    img.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=args.quality, method=6)  # ingen EXIF följer med
    data = buf.getvalue()

    # Neutralt namn: hash av innehållet + id, så att samma bild till två rätter inte krockar.
    name = hashlib.sha256(data + dish["id"].encode()).hexdigest()[:10] + ".webp"
    IMAGES.mkdir(exist_ok=True)
    (IMAGES / name).write_bytes(data)

    old = dish.get("image") or ""
    dish["image"] = f"images/{name}"
    if args.credit is not None:
        dish["credit"] = args.credit
    elif (dish.get("credit") or "").startswith("Platshållare"):
        dish["credit"] = ""
        print("OBS: credit är tomt – lägg till med --credit")
    if args.source is not None:
        dish["source"] = args.source
    if args.focus:
        x, y = (max(0.0, min(100.0, v)) for v in args.focus)
        dish["focus"] = {"x": round(x, 1), "y": round(y, 1)}

    DATA.write_text(json.dumps(dishes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.remove_old and old.startswith("images/") and old != dish["image"]:
        still_used = any(d.get("image") == old for d in dishes)
        old_path = ROOT / old
        if not still_used and old_path.is_file():
            old_path.unlink()
            print(f"Raderade gammal bild: {old}")

    kb = len(data) / 1024
    print(f"{dish['name']}: {dish['image']} ({img.size[0]}×{img.size[1]}, {kb:.0f} kB)")
    if not args.focus:
        print(f"Tips: sätt fokuspunkt via ?debug=1 → välj '{dish['id']}' → klicka i bilden.")


if __name__ == "__main__":
    main()
