# 產生一條「簡化版罌粟花田」的 SVG 長條（左右可無縫銜接）。全部是自己畫的扁平色塊，沒有用到任何素材圖。
import random, math, sys
W, H = 1800, 340
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 11)
GREENS = ['#6f8f4e', '#86a366', '#5c7c41', '#9bb37e', '#74955a']
REDS = ['#d92a20', '#e2382b', '#c9221c', '#ea4a33', '#d6301f', '#e2382b', '#d92a20']
PALE = ['#f3b3b8', '#f7d9d2', '#fbf4ec']
PALE_RATIO = 0      # 粉色、白色花的比例；0 = 全部紅色。想混一點淡色花可以改成 0.09 之類的值
out = []
def wrap(draw, x, margin=60):
    # 靠近左右邊界的元素在另一側再畫一次，橫向重複時才接得起來
    draw(x)
    if x < margin: draw(x + W)
    if x > W - margin: draw(x - W)

def blade(x):
    h = rnd.triangular(30, 230, 70); lean = rnd.uniform(-18, 18); c = rnd.choice(GREENS)
    w = rnd.uniform(1.0, 2.2); o = rnd.uniform(.45, .9)
    def d(px): out.append(f'<path d="M{px:.1f} {H} Q{px+lean*.3:.1f} {H-h*.55:.1f} {px+lean:.1f} {H-h:.1f}" stroke="{c}" stroke-width="{w:.1f}" opacity="{o:.2f}" fill="none" stroke-linecap="round"/>')
    wrap(d, x)

def leaf(x):
    h = rnd.uniform(18, 60); c = rnd.choice(GREENS); s = rnd.choice([-1, 1]); w = rnd.uniform(5, 9)
    def d(px): out.append(f'<path d="M{px:.1f} {H} Q{px+s*w:.1f} {H-h*.6:.1f} {px+s*w*1.6:.1f} {H-h:.1f} Q{px-s*1:.1f} {H-h*.5:.1f} {px:.1f} {H}Z" fill="{c}" opacity=".8"/>')
    wrap(d, x)

def stem(px, hx, hy, c, w):
    bend = rnd.uniform(-14, 14)
    out.append(f'<path d="M{px:.1f} {H} Q{px+bend:.1f} {(H+hy)/2:.1f} {hx:.1f} {hy:.1f}" stroke="{c}" stroke-width="{w:.1f}" fill="none" stroke-linecap="round"/>')

def poppy(x):
    # 越高的花越小、越稀：像花田往遠處退
    t = rnd.random() ** 1.7                      # 0 = 近（低、大），1 = 遠（高、小）
    hy = H - (46 + t * 250) + rnd.uniform(-10, 10)
    r = (17 - t * 9.5) * rnd.uniform(.85, 1.15)
    kind = rnd.choices(['open', 'cup', 'bud'], [5, 3, 1.3])[0]
    pale = rnd.random() < PALE_RATIO
    col = rnd.choice(PALE) if pale else rnd.choice(REDS)
    dark = '#b98b90' if pale else '#a5181a'
    g = rnd.choice(GREENS); sw = max(1.2, r * .13)
    def d(px):
        hx = px + rnd.uniform(-10, 10)
        if kind == 'bud':
            stem(px, hx, hy + r * .2, g, sw)
            out.append(f'<ellipse cx="{hx:.1f}" cy="{hy+r*.45:.1f}" rx="{r*.33:.1f}" ry="{r*.55:.1f}" fill="{g}" transform="rotate({rnd.uniform(-25,25):.0f} {hx:.1f} {hy:.1f})"/>')
        elif kind == 'cup':
            stem(px, hx, hy + r * .7, g, sw)
            out.append(f'<path d="M{hx-r:.1f} {hy-r*.35:.1f} Q{hx-r*1.05:.1f} {hy+r*.95:.1f} {hx:.1f} {hy+r*.9:.1f} Q{hx+r*1.05:.1f} {hy+r*.95:.1f} {hx+r:.1f} {hy-r*.35:.1f} Q{hx+r*.5:.1f} {hy-r*.75:.1f} {hx:.1f} {hy-r*.3:.1f} Q{hx-r*.5:.1f} {hy-r*.75:.1f} {hx-r:.1f} {hy-r*.35:.1f}Z" fill="{col}"/>')
            out.append(f'<path d="M{hx-r*.55:.1f} {hy-r*.2:.1f} Q{hx:.1f} {hy+r*.75:.1f} {hx+r*.55:.1f} {hy-r*.2:.1f} Q{hx:.1f} {hy+r*.2:.1f} {hx-r*.55:.1f} {hy-r*.2:.1f}Z" fill="{dark}" opacity=".55"/>')
        else:
            stem(px, hx, hy + r * .5, g, sw)
            rot = rnd.uniform(0, 90)
            for k in range(4):
                a = math.radians(rot + k * 90)
                out.append(f'<circle cx="{hx+math.cos(a)*r*.48:.1f}" cy="{hy+math.sin(a)*r*.42:.1f}" r="{r*.62:.1f}" fill="{col if k%2==0 else (col if pale else rnd.choice(REDS))}"/>')
            out.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{r*.27:.1f}" fill="#2a2320"/>')
            out.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{r*.11:.1f}" fill="#8fa35a"/>')
    return hy, x, d

for _ in range(520): blade(rnd.uniform(0, W))
for _ in range(110): leaf(rnd.uniform(0, W))
flowers = sorted((poppy(rnd.uniform(0, W)) for _ in range(150)), key=lambda f: f[0])   # 遠的先畫
for _, x, d in flowers: wrap(d, x)
for _ in range(260):   # 最前面再補一層矮草，蓋住花莖的根部
    x = rnd.uniform(0, W); h = rnd.uniform(14, 48); lean = rnd.uniform(-8, 8); c = rnd.choice(GREENS)
    wrap(lambda px: out.append(f'<path d="M{px:.1f} {H} Q{px+lean*.4:.1f} {H-h*.5:.1f} {px+lean:.1f} {H-h:.1f}" stroke="{c}" stroke-width="{rnd.uniform(1.4,2.6):.1f}" fill="none" stroke-linecap="round"/>'), x)
open(sys.argv[1], 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">' + ''.join(out) + '</svg>')
print(len(out), 'shapes')
