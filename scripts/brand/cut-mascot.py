"""Cut the mascot out of public/logo.png (white bg + "DU PYQ" text) into
public/mascot.webp with a transparent background. Re-run if the logo changes."""
from collections import deque
from PIL import Image, ImageFilter

im = Image.open("public/logo.png").convert("RGBA")
W, H = im.size
px = im.load()

def bg(p):  # near-white, no colour cast (the mascot's belly is pale *green*)
    r, g, b, _ = p
    return min(r, g, b) > 222 and max(r, g, b) - min(r, g, b) < 20

# Flood the background in from the edges.
seen = bytearray(W * H)
q = deque((x, y) for x in range(W) for y in (0, H - 1))
q.extend((x, y) for y in range(H) for x in (0, W - 1))
while q:
    x, y = q.popleft()
    i = y * W + x
    if seen[i] or not bg(px[x, y]):
        continue
    seen[i] = 1
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
            q.append((nx, ny))

mask = Image.new("L", (W, H), 255)
mk = mask.load()
for y in range(H):
    for x in range(W):
        if seen[y * W + x]:
            mk[x, y] = 0

# Drop the "DU PYQ" lettering: every opaque blob that lies wholly right of the mascot.
TEXT_X = 570
comp = bytearray(W * H)
for sy in range(H):
    for sx in range(TEXT_X, W):
        if mk[sx, sy] == 0 or comp[sy * W + sx]:
            continue
        blob, q, left = [], deque([(sx, sy)]), W
        comp[sy * W + sx] = 1
        while q:
            x, y = q.popleft()
            blob.append((x, y))
            left = min(left, x)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H and mk[nx, ny] and not comp[ny * W + nx]:
                    comp[ny * W + nx] = 1
                    q.append((nx, ny))
        if left >= TEXT_X:
            for x, y in blob:
                mk[x, y] = 0

# Soften the cut edge a touch so there's no white halo on dark backgrounds.
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
im.putalpha(mask)
im = im.crop(mask.getbbox())
im.thumbnail((480, 480), Image.LANCZOS)
im.save("public/mascot.webp", "WEBP", quality=88, method=6)
print(im.size)
