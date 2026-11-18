# Builds frontend/public/email-hero.png (email banner) from the logo.
# Run: python3 frontend/scripts/email-hero.py frontend/public/email-logo.png frontend/public/email-hero.png
import sys, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
src, out = sys.argv[1], sys.argv[2]
W, H = 1200, 600
img = Image.new('RGB', (W, H), (9, 8, 22))
# faint stars
random.seed(7); d = ImageDraw.Draw(img)
for _ in range(140):
    x, y = random.randrange(W), random.randrange(int(H*.7)); c = random.randint(60, 150)
    d.point((x, y), fill=(c, c, c + 20))
# light streak: several blurred diagonal bands, colour layers
def band(color, width, blur, offset, alpha):
    layer = Image.new('L', (W, H), 0); ld = ImageDraw.Draw(layer)
    for i in range(width):
        t = 1 - abs(i - width/2) / (width/2)
        ld.line([(-100, 470 + offset + i), (W + 100, 300 + offset + i)], fill=int(255*alpha*t), width=1)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    col = Image.new('RGB', (W, H), color)
    return Image.composite(col, Image.new('RGB', (W, H), 0), layer)
for color, w, b, off, a in [((236, 200, 255), 260, 70, 120, .9), ((255, 214, 196), 200, 60, 200, .9), ((134, 59, 255), 200, 60, -40, .9), ((70, 90, 255), 120, 35, -10, .9),
                            ((245, 185, 160), 90, 25, 40, .8), ((255, 255, 255), 26, 8, 20, 1)]:
    img = ImageChops.add(img, band(color, w, b, off, a))
# fade bottom into white
fade = Image.linear_gradient('L').resize((W, H)); fade = fade.point(lambda v: (lambda t: int(255 * t * t * (3 - 2 * t)))(min(1, max(0, (v - 150) / 105))))
img = Image.composite(Image.new('RGB', (W, H), 'white'), img, fade)
# white logo
logo = Image.open(src).convert('RGBA'); r, g, b, a = logo.split()
lum = logo.convert('L')
white = Image.new('RGBA', logo.size, (255, 255, 255, 0)); white.putalpha(a)
purple = Image.eval(ImageChops.difference(r, g), lambda v: 255 if v > 60 else 0)  # keep accent divider
logo = Image.composite(logo, white, ImageChops.multiply(purple, a))
lw = 560; logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
img.paste(logo, ((W - lw)//2, 110), logo)
img.save(out, optimize=True)
