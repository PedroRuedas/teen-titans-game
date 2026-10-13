# Gera os ícones do app a partir do "T" do favicon (mesma geometria: viewBox 32, dois retângulos com contorno).
from PIL import Image, ImageDraw
OUT = 'C:/Users/pedro/Documents/TeenTitans/icons'
YEL, DARK, BG = (255, 225, 74, 255), (23, 18, 31, 255), (7, 4, 15, 255)

def draw_t(d, ox, oy, k):
    # rect(x,y,w,h) com contorno de 2 unidades centrado na borda, como no SVG
    for x, y, w, h in [(3, 3, 26, 8), (12, 10, 8, 19)]:
        d.rectangle([ox + (x - 1) * k, oy + (y - 1) * k, ox + (x + w + 1) * k, oy + (y + h + 1) * k], fill=DARK)
        d.rectangle([ox + (x + 1) * k, oy + (y + 1) * k, ox + (x + w - 1) * k, oy + (y + h - 1) * k], fill=YEL)

def icon(size, t_frac, bg, radius_frac, name):
    S = size * 4  # supersampling
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        if radius_frac: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius_frac), fill=BG)
        else: d.rectangle([0, 0, S, S], fill=BG)
    k = S * t_frac / 28.0           # o T ocupa x 2..30, y 2..30 (28 unidades com o contorno)
    o = (S - 28 * k) / 2 - 2 * k
    draw_t(d, o, o, k)
    im.resize((size, size), Image.LANCZOS).save(OUT + '/' + name)

icon(192, 0.78, True, 0.22, 'icon-192.png')
icon(512, 0.78, True, 0.22, 'icon-512.png')
icon(512, 0.56, True, 0, 'icon-maskable-512.png')   # área segura do ícone adaptável (círculo de 80%)
icon(180, 0.70, True, 0, 'apple-touch-icon.png')
icon(48, 0.95, False, 0, 'favicon-48.png')
print('ok')
