# 產生一條底部花田的 SVG 長條（左右可無縫銜接）。全部是程式畫的扁平色塊，沒有用到任何素材圖。
import random, math, sys
W, H = 1800, 340
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 11)
GREENS = ['#6f8f4e', '#86a366', '#5c7c41', '#9bb37e', '#74955a']
REDS = ['#d92a20', '#e2382b', '#c9221c', '#ea4a33', '#d6301f', '#e2382b', '#d92a20']
PALE = ['#f3b3b8', '#f7d9d2', '#fbf4ec']
DAISY_PETALS = ['#fffefa', '#fffdf7', '#f8f5eb']
DAISY_CENTERS = ['#e4c25c', '#d9ad45', '#edcf72']
PALE_RATIO = 0      # 粉色、白色花的比例；0 = 全部紅色。想混一點淡色花可以改成 0.09 之類的值
GRASS_KEEP = 0.15   # 草（草葉、葉片、前排矮草）維持原本的 15%；花不受影響
FLOWER_KEEP = 0.96  # 花要畫出來的比例；相較 0.64 約增加到 1.5 倍。草不受影響
# 草的隨機數照樣全部抽完，只是有些不畫出來，這樣改這個比例時，花的位置和樣子完全不會變
keep_rnd = random.Random(1000 + (int(sys.argv[2]) if len(sys.argv) > 2 else 11))
flower_rnd = random.Random(2000 + (int(sys.argv[2]) if len(sys.argv) > 2 else 11))
# 花和葉子的造型：
#   'poppy'  比較像罌粟花：四片有皺褶的薄花瓣、花瓣根部的黑斑、黑色雄蕊圍著綠色的種莢、垂頭的花苞、羽狀分裂的葉子
#   'simple' 原本的簡化造型（四個圓當花瓣）
#   'daisy'  白色細長花瓣、淡黃色花心與細葉
# 依 STYLE 切換花種；整片花田仍以可無縫平鋪的向量圖輸出
STYLE = 'daisy'
# 造型細節（花瓣皺褶、花苞朝向等）用另一組隨機數，這樣不會影響位置
shape_rnd = random.Random(3000 + (int(sys.argv[2]) if len(sys.argv) > 2 else 11))
INK = '#1d1412'       # 花瓣根部的黑斑、雄蕊
POD = '#a3b07a'       # 種莢頂端
POD_LINE = '#6b7845'  # 種莢頂端放射狀的紋路

def shade(hexcol, f):
    # f < 1 變暗、f > 1 變亮
    rgb = [int(hexcol[i:i+2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(c * f))) for c in rgb)

def petal_path(cx, cy, ang, span, R, squash, phase, wob):
    # 從花心往外展開的扇形花瓣，外緣有細小的波浪（罌粟花瓣薄而皺）
    n = 10
    pts = []
    for i in range(n + 1):
        a = ang - span / 2 + span * i / n
        edge = 1 + wob * math.sin(i * 2.3 + phase) + wob * .5 * math.sin(i * 5.1 + phase * 1.7)
        round_ = .9 + .1 * math.cos((i / n - .5) * math.pi)
        rr = R * edge * round_
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * squash))
    bx, by = cx + math.cos(ang) * R * .06, cy + math.sin(ang) * R * .06 * squash
    d = f'M{bx:.1f} {by:.1f} L{pts[0][0]:.1f} {pts[0][1]:.1f}'
    d += f' L{(pts[0][0]+pts[1][0])/2:.1f} {(pts[0][1]+pts[1][1])/2:.1f}'
    for i in range(1, n):
        mx, my = (pts[i][0] + pts[i+1][0]) / 2, (pts[i][1] + pts[i+1][1]) / 2
        d += f' Q{pts[i][0]:.1f} {pts[i][1]:.1f} {mx:.1f} {my:.1f}'
    d += f' L{pts[n][0]:.1f} {pts[n][1]:.1f}Z'
    return d

def dots(points, rad):
    # 一串小圓點合成一條 path（雄蕊），檔案比較小
    return ''.join(f'M{x-rad:.1f} {y:.1f}a{rad:.2f} {rad:.2f} 0 1 0 {2*rad:.2f} 0a{rad:.2f} {rad:.2f} 0 1 0 {-2*rad:.2f} 0' for x, y in points)
def grass(make):
    start = len(out)
    make()
    if keep_rnd.random() >= GRASS_KEEP: del out[start:]
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
    if STYLE == 'daisy':
        w = rnd.uniform(3, 6)
        def d(px):
            out.append(f'<path d="M{px:.1f} {H} Q{px+s*w:.1f} {H-h*.58:.1f} {px+s*w*1.7:.1f} {H-h:.1f} Q{px+s*w*.35:.1f} {H-h*.78:.1f} {px:.1f} {H}Z" fill="{c}" opacity=".72"/>')
        return wrap(d, x)
    if STYLE == 'simple':
        def d(px): out.append(f'<path d="M{px:.1f} {H} Q{px+s*w:.1f} {H-h*.6:.1f} {px+s*w*1.6:.1f} {H-h:.1f} Q{px-s*1:.1f} {H-h*.5:.1f} {px:.1f} {H}Z" fill="{c}" opacity=".8"/>')
        return wrap(d, x)
    # 羽狀分裂的葉子：一條中肋，兩側各有幾片往上翹的尖裂片
    pairs = shape_rnd.choice([3, 4, 4, 5])
    jit = [shape_rnd.uniform(.8, 1.2) for _ in range(pairs * 2)]
    def d(px):
        P0, P1, P2 = (px, H), (px + s * w, H - h * .6), (px + s * w * 1.6, H - h)
        def at(f):
            # 中肋上的點和法線
            x_ = (1-f)**2*P0[0] + 2*(1-f)*f*P1[0] + f*f*P2[0]
            y_ = (1-f)**2*P0[1] + 2*(1-f)*f*P1[1] + f*f*P2[1]
            dx = 2*(1-f)*(P1[0]-P0[0]) + 2*f*(P2[0]-P1[0]); dy = 2*(1-f)*(P1[1]-P0[1]) + 2*f*(P2[1]-P1[1])
            L = math.hypot(dx, dy) or 1
            return x_, y_, -dy / L, dx / L
        side_pts = {1: [], -1: []}
        for side in (1, -1):
            for i in range(pairs):
                f0 = .12 + .8 * i / pairs; f1 = f0 + .8 / pairs * .55
                lobe = w * .95 * (1 - f0) ** .5 * jit[i * 2 + (side > 0)]
                x0, y0, nx, ny = at(f0)
                side_pts[side].append((x0 + nx * side * lobe * .18, y0 + ny * side * lobe * .18))  # 凹口
                x1, y1, nx, ny = at(min(f1, .97))
                side_pts[side].append((x1 + nx * side * lobe, y1 + ny * side * lobe - lobe * .25))  # 尖端，略往上翹
        tip = at(1)
        pts = [P0] + side_pts[1] + [(tip[0], tip[1])] + side_pts[-1][::-1] + [P0]
        out.append('<path d="M' + ' L'.join(f'{a:.1f} {b:.1f}' for a, b in pts) + f'Z" fill="{c}" opacity=".8"/>')
    wrap(d, x)

def stem(px, hx, hy, c, w):
    bend = rnd.uniform(-14, 14)
    out.append(f'<path d="M{px:.1f} {H} Q{px+bend:.1f} {(H+hy)/2:.1f} {hx:.1f} {hy:.1f}" stroke="{c}" stroke-width="{w:.1f}" fill="none" stroke-linecap="round"/>')

def poppy_simple(x, t, hy, r, kind, pale, col, g, sw):
    dark = '#b98b90' if pale else '#a5181a'
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
    return d

def daisy(x):
    # 細長的白色小花，沿用花田原本的高度分布與無縫接合方式。
    t = rnd.random() ** 1.7
    hy = H - (46 + t * 250) + rnd.uniform(-10, 10)
    r = (14 - t * 7) * rnd.uniform(.85, 1.15)
    kind = rnd.choices(['open', 'bud'], [10, 1])[0]
    g = rnd.choice(GREENS)
    petal = rnd.choice(DAISY_PETALS)
    center = rnd.choice(DAISY_CENTERS)
    petals = shape_rnd.choice([9, 10, 11, 12, 13])
    rotation = shape_rnd.uniform(0, math.tau)
    squash = shape_rnd.uniform(.78, .96)
    stem_w = max(1.0, r * .09)
    cache = {}

    def draw(px):
        hx = px + rnd.uniform(-10, 10)
        bend = rnd.uniform(-14, 14)
        end_y = hy + r * (.25 if kind == 'open' else .65)
        o = [f'<path d="M{px:.1f} {H} Q{px+bend:.1f} {(H+end_y)/2:.1f} {hx:.1f} {end_y:.1f}" stroke="{g}" stroke-width="{stem_w:.1f}" fill="none" stroke-linecap="round"/>']
        if kind == 'bud':
            o.append(f'<ellipse cx="{hx:.1f}" cy="{hy:.1f}" rx="{r*.32:.1f}" ry="{r*.55:.1f}" fill="{petal}" transform="rotate({rnd.uniform(-20,20):.0f} {hx:.1f} {hy:.1f})"/>')
            o.append(f'<path d="M{hx-r*.22:.1f} {hy+r*.3:.1f} Q{hx:.1f} {hy+r*.55:.1f} {hx+r*.22:.1f} {hy+r*.3:.1f}" stroke="{g}" stroke-width="{max(.7,r*.08):.1f}" fill="none" stroke-linecap="round"/>')
        else:
            for i in range(petals):
                a = rotation + i * math.tau / petals
                cx = hx + math.cos(a) * r * .45
                cy = hy + math.sin(a) * r * .45 * squash
                shade_col = shade(petal, .97 if i % 2 else 1.0)
                o.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{r*.17:.1f}" ry="{r*.43:.1f}" fill="{shade_col}" transform="rotate({math.degrees(a)+90:.1f} {cx:.1f} {cy:.1f})"/>')
            o.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{r*.25:.1f}" fill="{center}"/>')
            if r > 9:
                n = 8
                seeds = [(hx + math.cos(rotation + i*math.tau/n)*r*.15, hy + math.sin(rotation + i*math.tau/n)*r*.15*squash) for i in range(n)]
                o.append(f'<path d="{dots(seeds, max(.35,r*.035))}" fill="#c99a37"/>')
        return o

    def d(px):
        if not cache:
            cache['x0'] = px
            cache['svg'] = draw(px)
            out.extend(cache['svg'])
        else:
            # 花田左右邊緣使用同一朵花的平移副本，確保平鋪時不露接縫。
            out.append(f'<g transform="translate({px-cache["x0"]:.1f} 0)">' + ''.join(cache['svg']) + '</g>')
    return hy, x, d

def poppy(x):
    if STYLE == 'daisy':
        return daisy(x)
    # 越高的花越小、越稀：像花田往遠處退
    t = rnd.random() ** 1.7                      # 0 = 近（低、大），1 = 遠（高、小）
    hy = H - (46 + t * 250) + rnd.uniform(-10, 10)
    r = (17 - t * 9.5) * rnd.uniform(.85, 1.15)
    kind = rnd.choices(['open', 'cup', 'bud'], [5, 3, 1.3])[0]
    pale = rnd.random() < PALE_RATIO
    col = rnd.choice(PALE) if pale else rnd.choice(REDS)
    g = rnd.choice(GREENS); sw = max(1.2, r * .13)
    if STYLE == 'simple':
        return hy, x, poppy_simple(x, t, hy, r, kind, pale, col, g, sw)

    # 造型細節（只用 shape_rnd）
    squash = shape_rnd.uniform(.72, .9)            # 正面的花稍微斜著看，所以上下壓扁一點
    phases = [shape_rnd.uniform(0, 6.3) for _ in range(6)]
    wob = shape_rnd.uniform(.04, .08)              # 花瓣外緣皺褶的程度
    tilt = shape_rnd.uniform(-16, 16)              # 側面的花歪一點頭
    side = shape_rnd.choice([-1, 1])               # 花苞往哪邊垂
    opening = shape_rnd.random() < .3              # 有些花苞裂開，露出一點紅
    stem_w = max(1.0, r * .1)

    def consume():
        # 跟原本的畫法用掉一樣多的隨機數，順序也一樣，其他花和草才不會換位置
        v = {'dx': rnd.uniform(-10, 10), 'bend': rnd.uniform(-14, 14)}
        if kind == 'bud':
            v['rot'] = rnd.uniform(-25, 25)
        elif kind == 'open':
            v['rot'] = rnd.uniform(0, 90)
            v['alt'] = [None if (k % 2 == 0 or pale) else rnd.choice(REDS) for k in range(4)]
        return v

    def draw(px, v):
        o = []
        hx = px + v['dx']
        def stem_to(ex, ey, extra=''):
            o.append(f'<path d="M{px:.1f} {H} Q{px+v["bend"]:.1f} {(H+ey)/2:.1f} {ex:.1f} {ey:.1f}{extra}" stroke="{g}" stroke-width="{stem_w:.1f}" fill="none" stroke-linecap="round"/>')
        if kind == 'open':
            stem_to(hx, hy + r * .3)
            rot = math.radians(v['rot'])
            back = shade(col, .8)
            for k in (0, 2):     # 後面兩片大花瓣，顏色深一點
                o.append(f'<path d="{petal_path(hx, hy, rot + k*math.pi/2, math.radians(122), r*1.1, squash, phases[k], wob)}" fill="{back}"/>')
            for k in (1, 3):     # 前面兩片
                c = v['alt'][k] or col
                o.append(f'<path d="{petal_path(hx, hy, rot + k*math.pi/2, math.radians(106), r*.98, squash, phases[k], wob)}" fill="{c}"/>')
                if r > 10:       # 花瓣上淡淡的紋路
                    a = rot + k * math.pi / 2
                    for dv in (-.28, .28):
                        ex, ey = hx + math.cos(a + dv) * r * .85, hy + math.sin(a + dv) * r * .85 * squash
                        o.append(f'<path d="M{hx:.1f} {hy:.1f} Q{hx+math.cos(a)*r*.5:.1f} {hy+math.sin(a)*r*.5*squash:.1f} {ex:.1f} {ey:.1f}" stroke="{shade(c, .72)}" stroke-width="{r*.03:.2f}" opacity=".35" fill="none"/>')
            # 每片花瓣根部的黑斑，合起來是花心周圍一圈深色
            blot = ''.join(petal_path(hx, hy, rot + k*math.pi/2, math.radians(64), r*.44, squash, phases[k+2 if k < 4 else 0], .05) for k in range(4))
            o.append(f'<path d="{blot}" fill="{INK}" opacity=".9"/>')
            if r > 9:            # 一圈黑色雄蕊
                n = 14
                ring = [(hx + math.cos(rot + i*2*math.pi/n) * r*.27, hy + math.sin(rot + i*2*math.pi/n) * r*.27*squash) for i in range(n)]
                o.append(f'<path d="{dots(ring, max(.45, r*.05))}" fill="{INK}"/>')
            # 中間的綠色種莢頂端，帶放射狀紋路
            pr = r * .18
            o.append(f'<ellipse cx="{hx:.1f}" cy="{hy:.1f}" rx="{pr:.1f}" ry="{pr*squash:.1f}" fill="{POD}"/>')
            if r > 9:
                rays = ''.join(f'M{hx:.1f} {hy:.1f}L{hx+math.cos(rot+i*math.pi/4)*pr*.95:.1f} {hy+math.sin(rot+i*math.pi/4)*pr*.95*squash:.1f}' for i in range(8))
                o.append(f'<path d="{rays}" stroke="{POD_LINE}" stroke-width="{max(.3, r*.022):.2f}"/>')
        elif kind == 'cup':
            # 側面看的碗狀花：後面的花瓣比較高，前面兩片交疊，碗口看得到深色的花心和雄蕊
            stem_to(hx, hy + r * .72)
            back = shade(col, .78)
            q = lambda a, b: f'{hx + a*r:.1f} {hy + b*r:.1f}'
            g_open = f'<g transform="rotate({tilt:.0f} {hx:.1f} {hy + r*.7:.1f})">'
            parts = [
                f'<path d="M{q(-.95,-.42)} Q{q(-.62,-.9 + phases[0]*.01)} {q(-.15,-.66)} Q{q(.35,-.92 + phases[1]*.01)} {q(.95,-.44)} C{q(1.02,.28)} {q(.45,.8)} {q(0,.8)} C{q(-.45,.8)} {q(-1.02,.28)} {q(-.95,-.42)}Z" fill="{back}"/>',
                f'<ellipse cx="{hx:.1f}" cy="{hy - r*.36:.1f}" rx="{r*.6:.1f}" ry="{r*.15:.1f}" fill="{INK}" opacity=".88"/>',
            ]
            if r > 9:
                tops = [(hx + (i - 3) * r * .15, hy - r * (.44 + .04 * math.sin(i * 1.7 + phases[2]))) for i in range(7)]
                parts.append(f'<path d="{dots(tops, max(.45, r*.05))}" fill="{INK}"/>')
            parts += [
                f'<path d="M{q(-1.0,-.18)} Q{q(-.72,-.5)} {q(-.36,-.3)} Q{q(-.06,-.44)} {q(.16,-.2)} C{q(.26,.36)} {q(.1,.82)} {q(-.05,.84)} C{q(-.56,.82)} {q(-1.06,.36)} {q(-1.0,-.18)}Z" fill="{col}"/>',
                f'<path d="M{q(1.0,-.2)} Q{q(.74,-.52)} {q(.4,-.34)} Q{q(.12,-.46)} {q(-.12,-.24)} C{q(-.2,.34)} {q(-.04,.82)} {q(.08,.84)} C{q(.58,.82)} {q(1.06,.34)} {q(1.0,-.2)}Z" fill="{shade(col, .93)}"/>',
            ]
            if r > 10:
                for a, b in ((-.55, -.25), (-.25, -.3), (.3, -.32), (.6, -.27)):
                    parts.append(f'<path d="M{q(a*.3, .78)} Q{q(a*.8, .3)} {q(a, b)}" stroke="{shade(col, .7)}" stroke-width="{r*.03:.2f}" opacity=".3" fill="none"/>')
            o.append(g_open + ''.join(parts) + '</g>')
        else:
            # 垂頭的花苞：莖在頂端彎成一個鉤，花苞往下吊著
            top_y = hy - r * .35
            hook = f' Q{hx + side*r*.12:.1f} {hy - r*.95:.1f} {hx + side*r*.55:.1f} {hy - r*.62:.1f}'
            stem_to(hx, top_y, hook)
            bx, by = hx + side * r * .64, hy - r * .05
            ang = -side * 16 + v['rot'] * .3
            bud = [f'<ellipse cx="{bx:.1f}" cy="{by:.1f}" rx="{r*.34:.1f}" ry="{r*.54:.1f}" fill="{shade(g, .95)}"/>']
            if opening:
                bud.append(f'<path d="M{bx:.1f} {by - r*.2:.1f} Q{bx + r*.12:.1f} {by + r*.2:.1f} {bx:.1f} {by + r*.56:.1f} Q{bx - r*.12:.1f} {by + r*.2:.1f} {bx:.1f} {by - r*.2:.1f}Z" fill="{col}"/>')
            else:
                bud.append(f'<path d="M{bx:.1f} {by - r*.5:.1f} L{bx:.1f} {by + r*.52:.1f}" stroke="{shade(g, .72)}" stroke-width="{max(.3, r*.03):.2f}"/>')
            if r > 9:   # 細細的毛
                hairs = ''.join(f'M{bx + math.cos(a)*r*.34:.1f} {by + math.sin(a)*r*.54:.1f}l{math.cos(a)*r*.12:.1f} {math.sin(a)*r*.12:.1f}' for a in (.4, 1.1, 2.0, 2.7, 3.6, 5.3, 5.9))
                bud.append(f'<path d="{hairs}" stroke="{g}" stroke-width="{max(.25, r*.02):.2f}" opacity=".7"/>')
            o.append(f'<g transform="rotate({ang:.0f} {bx:.1f} {by - r*.5:.1f})">' + ''.join(bud) + '</g>')
        return o

    cache = {}
    def d(px):
        v = consume()
        if 'svg' not in cache:
            cache['x0'] = px
            cache['svg'] = draw(px, v)
            out.extend(cache['svg'])
        else:
            # 左右銜接處的分身：直接平移同一朵花，接縫才會完全對上
            out.append(f'<g transform="translate({px - cache["x0"]:.1f} 0)">' + ''.join(cache['svg']) + '</g>')
    return hy, x, d

for _ in range(520): grass(lambda: blade(rnd.uniform(0, W)))
for _ in range(110): grass(lambda: leaf(rnd.uniform(0, W)))
flowers = sorted((poppy(rnd.uniform(0, W)) for _ in range(150)), key=lambda f: f[0])   # 遠的先畫
for _, x, d in flowers:
    # 每朵花都照樣畫一遍（把隨機數用完），再決定要不要留下，這樣其他花和草的位置都不會變
    start = len(out)
    wrap(d, x)
    if flower_rnd.random() >= FLOWER_KEEP: del out[start:]
for _ in range(260):   # 最前面再補一層矮草，蓋住花莖的根部
    def front():
        x = rnd.uniform(0, W); h = rnd.uniform(14, 48); lean = rnd.uniform(-8, 8); c = rnd.choice(GREENS)
        wrap(lambda px: out.append(f'<path d="M{px:.1f} {H} Q{px+lean*.4:.1f} {H-h*.5:.1f} {px+lean:.1f} {H-h:.1f}" stroke="{c}" stroke-width="{rnd.uniform(1.4,2.6):.1f}" fill="none" stroke-linecap="round"/>'), x)
    grass(front)
open(sys.argv[1], 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">' + ''.join(out) + '</svg>')
print(len(out), 'shapes')
