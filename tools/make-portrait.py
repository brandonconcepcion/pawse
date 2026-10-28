#!/usr/bin/env python3
"""Turns a dog photo into chunky pixel-art rows (palette letters) for a framed wall portrait.

  python3 tools/make-portrait.py PHOTO --box X0,Y0,X1,Y1 --ellipse CX,CY,RX,RY [--ellipse ...] \
      [--size 28] [--gains R,G,B] [--gamma 1] [--preview out.png]

--box      square crop of the photo (pixels) around the dog.
--ellipse  (crop coordinates) areas of the dog to keep. Everything outside fades to the room's teal, so a busy
           background (TV, cabinet, lamp) doesn't turn into noise. Repeat for head, ear, chest...
--gains    white balance: multiply R,G,B. Sample the dog's white fur: gains = target(245,240,235) / fur color.
           Warm room lighting makes a white dog look tan without this.
--gamma    below 1 lifts the shadows (applied before --gains). A dim photo, where the fur in shade reads brown/gray, needs ~0.6.
Prints the PORTRAIT rows to paste into js/toys.js. Needs Pillow and numpy (dev tool only, not part of the app).
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

# One letter per palette color (all from js/pixel.js `C`, plus 'W' warm white). Neutrals only: it's a white dog.
PALETTE = {
    'k': '000000', 'n': '1D2B53', 's': '5F574F', 'S': 'C2C3C7', 'c': 'FFF1E8', 'w': 'FFFFFF', 'W': 'DCD3CA',
    't': 'A28879', 'd': '291814', 'm': '49333B', 'p': 'FFCCAA', 'l': '83769C', 'g': '125359',
}


def make(photo, box, size, ellipses, gains, contrast=1.15, background=(18, 83, 89), gamma=1.0):
    image = Image.open(photo).convert('RGB').crop(box)
    lifted = 255 * (np.asarray(image).astype(float) / 255) ** gamma
    balanced = np.clip(lifted * np.array(gains), 0, 255).astype('uint8')
    image = ImageEnhance.Contrast(Image.fromarray(balanced)).enhance(contrast)
    w, h = image.size
    keep = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(keep)
    for cx, cy, rx, ry in ellipses:
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    keep = keep.filter(ImageFilter.GaussianBlur(w * 0.035))
    faded = Image.blend(image, Image.new('RGB', (w, h), background), 1.0)
    image = Image.composite(image, faded, keep).resize((size, size), Image.LANCZOS)
    palette = Image.new('P', (1, 1))
    flat = [int(hex_[i:i + 2], 16) for hex_ in PALETTE.values() for i in (0, 2, 4)]
    palette.putpalette(flat + [0] * (768 - len(flat)))
    indexed = image.quantize(palette=palette, dither=Image.NONE)
    letters = list(PALETTE)
    return [''.join(letters[i] for i in row) for row in np.asarray(indexed)], indexed.convert('RGB')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('photo')
    parser.add_argument('--box', required=True)
    parser.add_argument('--ellipse', action='append', required=True)
    parser.add_argument('--size', type=int, default=28)
    parser.add_argument('--gains', default='1,1,1')
    parser.add_argument('--gamma', type=float, default=1.0)
    parser.add_argument('--preview')
    args = parser.parse_args()
    nums = lambda text: [float(v) for v in text.split(',')]
    rows, preview = make(args.photo, tuple(int(v) for v in nums(args.box)), args.size,
                         [nums(e) for e in args.ellipse], nums(args.gains), gamma=args.gamma)
    if args.preview:
        preview.resize((preview.width * 10, preview.height * 10), Image.NEAREST).save(args.preview)
    print('const PORTRAIT = [')
    for row in rows:
        print(f"  '{row}',")
    print('];')
