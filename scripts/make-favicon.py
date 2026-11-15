"""Build the tab icon from the brand mark.

The mark is a wide, light emblem on transparency: at 16 px on a pale tab strip it
reads as nothing. This script crops it to its artwork, lays it on the site's night
background with a rounded corner, and writes two PNGs (64 and 180 px).

Run: python scripts/make-favicon.py
"""

import struct
import sys
import zlib

SRC = 'assets/img/teranga-mark.png'
OUT = [('assets/img/favicon-64.png', 64), ('assets/img/favicon-180.png', 180)]


def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    pos = 8
    ihdr = None
    palette = None
    trns = None
    idat = b''
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctype == b'IHDR':
            ihdr = struct.unpack('>IIBBBBB', chunk)
        elif ctype == b'PLTE':
            palette = chunk
        elif ctype == b'tRNS':
            trns = chunk
        elif ctype == b'IDAT':
            idat += chunk
        elif ctype == b'IEND':
            break
        pos += 12 + length

    w, h, depth, color, _comp, _filt, _inter = ihdr
    raw = zlib.decompress(idat)
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    stride = (w * channels * depth + 7) // 8
    bpp = max(1, channels * depth // 8)
    rows = []
    prev = bytearray(stride)
    p = 0
    for _ in range(h):
        ft = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if ft == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 255
        elif ft == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif ft == 3:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif ft == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        rows.append(bytes(line))
        prev = line

    pixels = []
    for y in range(h):
        row = rows[y]
        for x in range(w):
            if color == 6:
                i = x * 4
                pixels.append(tuple(row[i:i + 4]))
            elif color == 3:
                idx = row[x]
                r, g, b = palette[idx * 3:idx * 3 + 3]
                a = trns[idx] if trns and idx < len(trns) else 255
                pixels.append((r, g, b, a))
            elif color == 2:
                i = x * 3
                pixels.append(tuple(row[i:i + 3]) + (255,))
            else:
                pixels.append((0, 0, 0, 255))
    return w, h, pixels


def crop(w, h, pixels):
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if pixels[y * w + x][3] > 12:
                minx = min(minx, x)
                maxx = max(maxx, x)
                miny = min(miny, y)
                maxy = max(maxy, y)
    if maxx < 0:
        return w, h, 0, 0, pixels
    return maxx - minx + 1, maxy - miny + 1, minx, miny, pixels


def sample(w, h, pixels, x0, y0, cw, ch, size, inset):
    """Box-filter the artwork down to `size` square, keeping its aspect."""
    scale = min((size - inset * 2) / cw, (size - inset * 2) / ch)
    dw = max(1, int(round(cw * scale)))
    dh = max(1, int(round(ch * scale)))
    ox = (size - dw) // 2
    oy = (size - dh) // 2
    out = []
    for y in range(size):
        for x in range(size):
            if x < ox or x >= ox + dw or y < oy or y >= oy + dh:
                out.append((0, 0, 0, 0))
                continue
            sx0 = x0 + int((x - ox) / scale)
            sy0 = y0 + int((y - oy) / scale)
            sx1 = min(x0 + cw, sx0 + max(1, int(round(1 / scale))))
            sy1 = min(y0 + ch, sy0 + max(1, int(round(1 / scale))))
            r = g = b = a = n = 0
            for yy in range(sy0, sy1):
                for xx in range(sx0, sx1):
                    pr, pg, pb, pa = pixels[yy * w + xx]
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
                    n += 1
            if a:
                out.append((r // a, g // a, b // a, a // n))
            else:
                out.append((0, 0, 0, 0))
    return out


def rounded(size, colour):
    """A dark plate with the sight's corner radius, as a pixel list."""
    radius = size * 0.22
    out = []
    for y in range(size):
        for x in range(size):
            # distance to the nearest corner centre
            cx = radius if x < radius else (size - 1 - radius if x > size - 1 - radius else x)
            cy = radius if y < radius else (size - 1 - radius if y > size - 1 - radius else y)
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d > radius + 0.5:
                out.append((0, 0, 0, 0))
            else:
                out.append(colour)
    return out


def over(base, top):
    out = []
    for (br, bg, bb, ba), (tr, tg, tb, ta) in zip(base, top):
        a = ta / 255
        na = a + (ba / 255) * (1 - a)
        if na == 0:
            out.append((0, 0, 0, 0))
            continue
        out.append((
            int((tr * a + br * (ba / 255) * (1 - a)) / na),
            int((tg * a + bg * (ba / 255) * (1 - a)) / na),
            int((tb * a + bb * (ba / 255) * (1 - a)) / na),
            int(round(na * 255)),
        ))
    return out


def write_png(path, size, pixels):
    raw = b''
    for y in range(size):
        raw += b'\x00' + bytes(v for px in pixels[y * size:(y + 1) * size] for v in px)

    def chunk(tag, payload):
        body = tag + payload
        return struct.pack('>I', len(payload)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def main():
    w, h, pixels = read_png(SRC)
    cw, ch, x0, y0, pixels = crop(w, h, pixels)
    for path, size in OUT:
        plate = rounded(size, (10, 15, 26, 255))
        art = sample(w, h, pixels, x0, y0, cw, ch, size, max(1, size // 16))
        write_png(path, size, over(plate, art))
        print(path, size, 'from', (cw, ch))


if __name__ == '__main__':
    sys.exit(main())
