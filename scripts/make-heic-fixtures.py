# SPDX-License-Identifier: GPL-3.0-or-later
#
# Generates the synthetic HEIC test photos in tests/fixtures/photos/ (CC0).
# Needs Pillow and pillow-heif (pip install pillow pillow-heif), which bundle
# libheif with the x265 encoder:
#
#   python scripts/make-heic-fixtures.py
#
# Each photo is a quadrant pattern (top-left red, top-right green,
# bottom-left blue, bottom-right yellow) so orientation is easy to check.
# Both carry EXIF DateTimeOriginal 2026:07:14 19:42:10, offset +02:00.
# rotated.heic is written from the same pattern with EXIF orientation 6,
# which pillow-heif turns into rotated pixels plus an irot box, as phones do:
# it is stored 800×1200 with irot = 90° clockwise, and displays 1200×800
# (with the pattern upside down relative to landscape.heic).

from pathlib import Path

import pillow_heif
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures' / 'photos'
COLOURS = [(229, 57, 53), (67, 160, 71), (30, 136, 229), (253, 216, 53)]  # TL, TR, BL, BR


def pattern(w: int, h: int) -> Image.Image:
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w // 2 - 1, h // 2 - 1], fill=COLOURS[0])
    d.rectangle([w // 2, 0, w - 1, h // 2 - 1], fill=COLOURS[1])
    d.rectangle([0, h // 2, w // 2 - 1, h - 1], fill=COLOURS[2])
    d.rectangle([w // 2, h // 2, w - 1, h - 1], fill=COLOURS[3])
    return im


def exif(orientation: int | None = None) -> bytes:
    e = Image.Exif()
    e[0x0110] = 'Synthetic'
    ex = e.get_ifd(0x8769)
    ex[0x9003] = '2026:07:14 19:42:10'  # DateTimeOriginal
    ex[0x9011] = '+02:00'  # OffsetTimeOriginal
    if orientation:
        e[0x0112] = orientation  # pillow-heif turns this into an irot box
    return e.tobytes()


def save(name: str, im: Image.Image, orientation: int | None = None) -> None:
    im.info['exif'] = exif(orientation)
    pillow_heif.from_pillow(im).save(OUT / name, quality=90)


OUT.mkdir(parents=True, exist_ok=True)
save('landscape.heic', pattern(1200, 800))
save('rotated.heic', pattern(1200, 800), orientation=6)
save('portrait.heic', pattern(900, 1200))
print(f'wrote {OUT}')


# Small fixtures for the other formats. jpg/png/webp carry EXIF orientation 6
# and the same date; gif, tiff and avif are formats import must refuse.
def save_other(name: str, fmt: str, **kw) -> None:
    pattern(300, 200).save(OUT / name, fmt, exif=exif(6), **kw)


save_other('oriented.jpg', 'JPEG', quality=90)
save_other('oriented.png', 'PNG')
save_other('oriented.webp', 'WEBP', quality=90)
pattern(30, 20).save(OUT / 'refused.gif', 'GIF')
pattern(30, 20).save(OUT / 'refused.tiff', 'TIFF')
try:
    pattern(30, 20).save(OUT / 'refused.avif', 'AVIF')
except (KeyError, OSError) as e:
    print(f'no AVIF encoder ({e}); skipping refused.avif')


# A Display P3 HEIC, as iPhones write them: two flat patches, left
# (200, 60, 60) and right (60, 160, 90), in P3 values, with the Display P3
# ICC profile (CC0, Compact-ICC-Profiles) in its colr box.
P3_ICC = (OUT.parent / 'icc' / 'DisplayP3-v2-magic.icc').read_bytes()
p3 = Image.new('RGB', (400, 200), (200, 60, 60))
ImageDraw.Draw(p3).rectangle([200, 0, 399, 199], fill=(60, 160, 90))
p3.info['icc_profile'] = P3_ICC
pillow_heif.from_pillow(p3).save(OUT / 'display-p3.heic', quality=100)
