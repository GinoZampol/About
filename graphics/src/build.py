import pathlib
S = 10  # px per percent
OUT = pathlib.Path(__file__).parent

def mag(stroke="#111", glass="rgba(255,255,255,.35)", w=14, rough=False, handle="#111"):
    f = 'filter="url(#rough)"' if rough else ''
    return f'''<svg class="mag" viewBox="0 0 300 300" {f}>
<circle cx="115" cy="115" r="85" fill="{glass}" stroke="{stroke}" stroke-width="{w}"/>
<path d="M62 85 A60 60 0 0 1 100 52" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".9"/>
<line x1="178" y1="178" x2="270" y2="270" stroke="{handle}" stroke-width="{w+12}" stroke-linecap="round"/></svg>'''

def panel(title, sub, bad, good, extra_cls="", magsvg="", tag=""):
    return f'''<div class="panel {extra_cls}">
  <div class="ptitle">{title}</div><div class="psub">{sub}</div>
  <div class="bars">
    <div class="bw bad"><div class="val">{bad}%</div><div class="bar" style="height:{bad*S}px"></div>{magsvg}<div class="lab">BAD</div></div>
    <div class="bw good"><div class="val">{good}%</div><div class="bar" style="height:{good*S}px"></div><div class="lab">GOOD</div></div>
  </div></div>'''

def chart(pre, eu, magsvg):
    def bw(kind, val, extra="", m=""):
        return f'<div class="bw {kind} {extra}"><div class="val">{val}%</div><div class="bar" style="height:{val*S}px"></div>{m}<div class="lab">{kind.upper()}</div></div>'
    return f'''<div class="chart"><div class="bars">{bw("bad",22)}{bw("good",27)}{bw("bad",12,"gap",magsvg)}{bw("good",65)}</div>
<div class="groups"><div class="grp pre"><div class="ptitle">{pre}</div><div class="psub">before</div></div><div class="grp eu"><div class="ptitle">{eu}</div><div class="psub">after</div></div></div></div>'''

DEFS = '''<svg width="0" height="0" style="position:absolute"><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter></svg>'''

BASE = '''*{box-sizing:border-box;margin:0;padding:0}body{width:1080px;height:1920px;overflow:hidden;font-family:Inter,'Liberation Sans',sans-serif}
.stage{position:relative;width:1080px;height:1920px;overflow:hidden}
.chart{position:absolute;left:0;right:0;top:680px}
.bars{height:760px;display:flex;align-items:flex-end;justify-content:center;gap:22px;position:relative}.bw.gap{margin-left:70px}
.groups{display:flex;justify-content:center;margin-top:92px}.grp{width:422px;text-align:center;border-top:8px solid #888;padding-top:14px}.grp+.grp{margin-left:70px}
.grp .ptitle{height:auto!important;margin-bottom:6px}.grp .psub{height:auto!important;margin:0!important;display:block!important}
.bw{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:200px}
.bar{width:100%}.val{font-weight:900;font-size:76px;line-height:1;margin-bottom:8px}
.lab{position:absolute;bottom:-62px;font-weight:900;font-size:40px;letter-spacing:2px}
.mag{position:absolute;width:290px;height:290px;left:50%;top:50%;margin-left:-125px;transform:translateY(-175px) rotate(-8deg);pointer-events:none}
.bw.bad .mag{bottom:auto}
.foot{position:absolute;bottom:50px;left:0;right:0;text-align:center;font-size:26px;font-weight:600;opacity:.65}
'''

def page(name, css, body):
    html = f'<!doctype html><html><head><meta charset="utf-8"><style>{BASE}{css}</style></head><body>{DEFS}<div class="stage">{body}</div></body></html>'
    (OUT / f"{name}.html").write_text(html)

# 1 TABLOID ----------------------------------------------------------
css = '''.stage{background:#0a0a0a}
.haz{position:absolute;left:0;right:0;height:56px;background:repeating-linear-gradient(-45deg,#ffd800 0 34px,#0a0a0a 34px 68px)}
.tag{position:absolute;top:100px;left:50px;background:#e10600;color:#fff;font-weight:900;font-size:44px;padding:8px 28px;letter-spacing:4px;transform:rotate(-2deg)}
h1{position:absolute;top:190px;left:50px;right:50px;color:#fff;font-weight:900;font-size:112px;line-height:.95;letter-spacing:-3px;text-transform:uppercase}
h1 em{font-style:normal;color:#ffd800}
h2{position:absolute;top:585px;left:50px;right:50px;color:#ffd800;font-weight:800;font-size:46px}
.ptitle{color:#fff;font-weight:900;font-size:40px;text-transform:uppercase;text-align:center;line-height:1.05;height:84px}
.psub{color:#aaa;font-size:26px;font-weight:600;margin-bottom:16px;height:32px}
.val{color:#fff}.lab{color:#fff}
.bad .bar{background:#e10600;box-shadow:0 0 40px #e1060088}.good .bar{background:#16d94a;box-shadow:0 0 40px #16d94a77}
.mag{filter:drop-shadow(0 8px 0 #000)}
.foot{color:#fff}.grp.eu{border-top-color:#ffd800}.grp .ptitle{color:#fff}'''
body = f'''<div class="haz" style="top:0"></div><div class="tag">BREAKING</div>
<h1>Colonialism was <em>all bad</em>… right?</h1><h2>Now look at the actual ratio 👀</h2>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",mag("#ffd800","rgba(255,216,0,.25)",14,False,"#ffd800"))}
<div class="foot">Illustrative figures · bad vs good outcomes</div><div class="haz" style="bottom:0"></div>'''
page("v1-breaking-tabloid", css, body)

# 2 DOODLE NOTEBOOK ------------------------------------------------------
css = '''.stage{background:#fbf6e6;background-image:linear-gradient(#9ec9ee66 2px,transparent 2px),linear-gradient(90deg,#9ec9ee44 2px,transparent 2px);background-size:60px 60px}
.stage:before{content:"";position:absolute;left:90px;top:0;bottom:0;width:4px;background:#ff6b6b99}
h1{position:absolute;top:90px;left:110px;right:50px;font-weight:900;font-size:176px;line-height:.88;color:#111;letter-spacing:-6px;transform:rotate(-3deg);filter:url(#rough)}
h1 span{background:linear-gradient(transparent 62%,#ffe14d 62% 92%,transparent 92%);padding:0 8px}
h2{position:absolute;top:490px;left:110px;right:60px;font-weight:800;font-size:54px;color:#2b4bff;transform:rotate(-1.5deg);filter:url(#rough)}
.chart{filter:url(#rough)}
.ptitle{font-weight:900;font-size:42px;text-align:center;color:#111;line-height:1.05;height:88px}
.psub{font-size:28px;font-weight:700;color:#555;margin-bottom:12px;height:34px;font-style:italic}
.val{color:#111}.lab{color:#111}
.bar{border:8px solid #111;border-bottom:0;border-radius:6px 6px 0 0}
.bad .bar{background:repeating-linear-gradient(-45deg,#ff4d4d 0 14px,#ff8a8a 14px 26px)}
.good .bar{background:repeating-linear-gradient(-45deg,#33c26b 0 14px,#7fe3a3 14px 26px)}
.bars:after{content:"";position:absolute;left:-10px;right:-10px;bottom:-4px;height:8px;background:#111;border-radius:4px}
.arrow{position:absolute;right:70px;top:1500px;font-weight:900;font-size:52px;color:#e0262b;transform:rotate(-6deg);filter:url(#rough);text-align:center;line-height:1.05}
.foot{color:#111;font-style:italic}.grp{border-top:8px solid #111;border-radius:6px;filter:url(#rough)}'''
body = f'''<h1>ALL BAD?? <span>look closer</span></h1><h2>↓ same story, but with receipts</h2>
{chart("Pre-colonial<br>Africa","European<br>colonialism",mag("#111","rgba(255,255,255,.55)",14,True,"#111"))}
<div class="foot">illustrative figures · bad vs good outcomes</div>'''
page("v2-doodle-notebook", css, body)

# 3 NEON DARK --------------------------------------------------------------
css = '''.stage{background:radial-gradient(1200px 900px at 20% 0%,#3a1170 0%,transparent 60%),radial-gradient(1000px 900px at 100% 100%,#00425a 0%,transparent 60%),#07060f}
.kick{position:absolute;top:110px;left:60px;font-weight:800;font-size:36px;letter-spacing:10px;color:#00f0ff;text-transform:uppercase}
h1{position:absolute;top:175px;left:60px;right:60px;font-weight:900;font-size:124px;line-height:.92;letter-spacing:-4px;color:#fff;text-transform:uppercase;text-shadow:0 0 40px #b04dff}
h1 b{background:linear-gradient(90deg,#00f0ff,#ff2bd6);-webkit-background-clip:text;color:transparent;text-shadow:none}
h2{position:absolute;top:585px;left:60px;right:60px;font-weight:600;font-size:46px;color:#c9c4ff}
.ptitle{color:#fff;font-weight:900;font-size:38px;text-align:center;text-transform:uppercase;line-height:1.05;height:82px}
.psub{color:#9a95d0;font-size:26px;font-weight:600;height:32px;margin-bottom:12px}
.val{color:#fff}.lab{color:#c9c4ff}
.bar{border-radius:18px 18px 4px 4px}
.bad .bar{background:linear-gradient(#ff5470,#a0102d);box-shadow:0 0 50px #ff2d55aa}
.good .bar{background:linear-gradient(#5dffa3,#00a85a);box-shadow:0 0 50px #00ff88aa}
.mag{filter:drop-shadow(0 0 18px #00f0ff)}
.foot{color:#fff}.grp.eu{border-top-color:#00f0ff;box-shadow:0 -14px 30px -12px #00f0ff}.grp.pre{border-top-color:#8a86c9}'''
body = f'''<div class="kick">Side by side</div><h1>The ratio <b>nobody</b> shows you</h1><h2>Bad vs good outcomes, before and after.</h2>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",mag("#00f0ff","rgba(0,240,255,.18)",13,False,"#00f0ff"))}
<div class="foot">Illustrative figures · bad vs good outcomes</div>'''
page("v3-neon-ratio", css, body)

# 4 VINTAGE POSTER -------------------------------------------------------------
css = '''.stage{background:#efe2c0;background-image:radial-gradient(#00000012 1.5px,transparent 1.5px);background-size:14px 14px;font-family:'DejaVu Serif','Liberation Serif',serif}
.frame{position:absolute;inset:26px;border:8px double #1c2b4a}
.rib{position:absolute;top:100px;left:50%;transform:translateX(-50%);background:#a3201a;color:#f6ecd0;font-weight:900;font-size:40px;letter-spacing:6px;padding:12px 60px;white-space:nowrap}
h1{position:absolute;top:195px;left:60px;right:60px;text-align:center;font-weight:900;font-size:84px;line-height:1.02;color:#1c2b4a;text-transform:uppercase}
h1 i{color:#a3201a}
h2{position:absolute;top:470px;left:60px;right:60px;text-align:center;font-size:38px;font-style:italic;color:#1c2b4a}
.chart{top:620px}
.ptitle{font-weight:900;font-size:36px;text-align:center;color:#1c2b4a;text-transform:uppercase;line-height:1.1;height:80px}
.psub{font-size:26px;font-style:italic;color:#6b5a38;margin-bottom:10px;height:32px}
.val{color:#1c2b4a;font-size:70px}.lab{color:#1c2b4a;font-size:34px}
.bar{border:5px solid #1c2b4a;border-bottom:0}
.bad .bar{background:#a3201a}.good .bar{background:#2e6b3f}
.bars:after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:6px;background:#1c2b4a}
.mag{filter:drop-shadow(5px 6px 0 #00000055)}
.foot{color:#1c2b4a;font-style:italic;bottom:70px}.grp{border-top:5px solid #1c2b4a}.grp.eu{border-top-color:#a3201a}'''
body = f'''<div class="frame"></div><div class="rib">★ THE FACTS ★</div><h1>The <i>uncomfortable</i> ratio</h1><h2>Bad outcomes vs. good — before &amp; after European rule</h2>
{chart("Pre-colonial<br>African regimes","European<br>colonialism",mag("#1c2b4a","rgba(255,255,255,.4)",14,False,"#5b3a1c"))}
<div class="foot">Illustrative figures · bad vs good outcomes</div>'''
page("v4-vintage-poster", css, body)

# 5 POP ART COMIC -----------------------------------------------------------------
css = '''.stage{background:#ffe600;background-image:radial-gradient(#ff3b3b55 6px,transparent 7px);background-size:36px 36px}
h1{position:absolute;top:70px;left:40px;right:40px;font-weight:900;font-size:138px;line-height:.9;color:#fff;-webkit-text-stroke:10px #000;paint-order:stroke fill;text-transform:uppercase;text-shadow:10px 10px 0 #000;letter-spacing:-4px;transform:rotate(-2deg)}
h1 em{font-style:normal;color:#ff2d55}
.burst{position:absolute;right:30px;top:470px;width:300px;height:210px;background:#fff;border:8px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:50px;line-height:1;transform:rotate(7deg);box-shadow:8px 8px 0 #000}
.burst:after{content:"";position:absolute;left:30px;bottom:-34px;border:24px solid transparent;border-top:44px solid #000;transform:rotate(18deg)}
h2{position:absolute;top:520px;left:50px;width:640px;font-weight:900;font-size:56px;line-height:1;color:#000;text-transform:uppercase}
.chart{top:700px}
.ptitle{font-weight:900;font-size:38px;text-transform:uppercase;text-align:center;line-height:1.02;height:78px}
.psub{display:none}
.bars{height:760px}
.val{color:#000;font-size:80px}.lab{color:#000}
.bar{border:8px solid #000;border-bottom:0;box-shadow:8px 0 0 #000}
.bad .bar{background:#ff2d55}.good .bar{background:#18c964}
.mag{filter:drop-shadow(6px 6px 0 #000)}
.foot{color:#000;opacity:1;bottom:36px;font-size:28px}.grp{border-top:10px solid #000}.grp.eu{border-top-color:#ff2d55}'''
body = f'''<h1>Bad?! <em>Look</em> at the ratio</h1><h2>Everyone yells "evil." Nobody shows this.</h2><div class="burst">WAIT…<br>WHAT?!</div>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",mag("#000","rgba(255,255,255,.6)",15,False,"#000"))}
<div class="foot">Illustrative figures · bad vs good outcomes</div>'''
page("v5-pop-art-comic", css, body)
