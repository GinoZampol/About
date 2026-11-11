import pathlib, math
import build2 as b
OUT = pathlib.Path(__file__).parent
FONTS = (OUT/'fonts'/'fonts.css').read_text()
GOLD = "linear-gradient(180deg,#fbeeb0 0%,#e3bf55 28%,#a97d1d 52%,#e9c862 78%,#fff0b8 100%)"

def page(name, css, body):
    (OUT/f"{name}.html").write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{FONTS}{b.BASE}{css}</style></head><body><div class="stage">{body}</div></body></html>')

def border(c1="#d9b44a", c2="#8c6a1c", inset=30):
    i=inset; W,H=1080,1920
    def corner(x,y,sx,sy):
        return f'<g transform="translate({x},{y}) scale({sx},{sy})"><path d="M0 0 L120 0 M0 0 L0 120" stroke="{c1}" stroke-width="5" fill="none"/><path d="M22 22 L96 22 M22 22 L22 96" stroke="{c2}" stroke-width="2.5" fill="none"/><circle cx="22" cy="22" r="9" fill="{c1}"/><path d="M0 0 Q60 14 120 0" stroke="{c1}" stroke-width="2" fill="none" opacity=".6"/><path d="M130 0 l10 8 l-10 8 l-10 -8z M0 130 l8 10 l-8 10 l-8 -10z" fill="{c1}"/></g>'
    return f'''<svg class="bord" viewBox="0 0 {W} {H}"><rect x="{i}" y="{i}" width="{W-2*i}" height="{H-2*i}" fill="none" stroke="{c1}" stroke-width="5"/><rect x="{i+14}" y="{i+14}" width="{W-2*i-28}" height="{H-2*i-28}" fill="none" stroke="{c2}" stroke-width="2"/>
{corner(i,i,1,1)}{corner(W-i,i,-1,1)}{corner(i,H-i,1,-1)}{corner(W-i,H-i,-1,-1)}</svg>'''

def laurel(color="#d9b44a", flip=False):
    leaves=''
    for k in range(9):
        t=k/8; x=10+t*180; y=40-math.sin(t*math.pi*.9)*26+ (t*8)
        a=-35+t*10
        leaves+=f'<ellipse cx="{x:.1f}" cy="{y-9:.1f}" rx="14" ry="5.5" transform="rotate({a-30:.0f} {x:.1f} {y-9:.1f})" fill="{color}"/><ellipse cx="{x:.1f}" cy="{y+9:.1f}" rx="14" ry="5.5" transform="rotate({a+30:.0f} {x:.1f} {y+9:.1f})" fill="{color}"/>'
    st=f'<path d="M0 44 Q100 6 196 40" fill="none" stroke="{color}" stroke-width="3"/>'
    tr='transform="scale(-1,1) translate(-200,0)"' if flip else ''
    return f'<svg class="lau" viewBox="0 0 200 70"><g {tr}>{st}{leaves}</g></svg>'

def wojak(bubble_bg="#fbf3dc", ink="#1b1208", frame=GOLD):
    return f'''<div class="wjw">{b.WOJAK}<div class="bubble">European colonialism did <u>so many</u> bad things!!</div></div>'''

COMMON = f'''
.bord{{position:absolute;inset:0;width:1080px;height:1920px;z-index:6;pointer-events:none}}
.lau{{width:170px;height:60px}}
.kick{{position:absolute;top:84px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:22px;font-family:Cinzel,serif;font-weight:700;font-size:31px;letter-spacing:9px;text-transform:uppercase}}
h1{{position:absolute;left:70px;right:70px;text-align:center;text-transform:uppercase}}
h2{{position:absolute;left:90px;right:90px;text-align:center}}
.gold{{background:{GOLD};-webkit-background-clip:text;background-clip:text;color:transparent}}
.grid i{{border-top:2px solid #ffffff1c}}
.grp{{border-top:4px double currentColor!important}}.gt{{font-family:Cinzel,serif!important;font-weight:700!important;font-size:30px!important;letter-spacing:2px}}
.gs{{font-family:'Cormorant Garamond',serif!important;font-style:italic;font-size:34px!important;opacity:.85}}
.lab{{font-family:Cinzel,serif!important;font-weight:700;font-size:30px!important;letter-spacing:4px;bottom:-54px}}
.bar{{box-shadow:inset 0 0 0 4px rgba(255,236,170,.0),0 14px 30px #0006;position:relative}}
.bad .bar{{background:linear-gradient(90deg,#4a0a10,#a8232c 42%,#5d0c13);border:4px solid #e3bf55;border-bottom:0}}
.good .bar{{background:linear-gradient(90deg,#063d28,#1f8f5f 42%,#073f2a);border:4px solid #e3bf55;border-bottom:0}}
.bars:after{{content:"";position:absolute;left:60px;right:60px;bottom:-6px;height:6px;background:{GOLD}}}
.wjf{{position:absolute;left:66px;top:150px;width:292px;height:344px;border-radius:50%;padding:13px;background:{GOLD};box-shadow:0 14px 30px #0008,inset 0 0 0 3px #7a5a14}}
.wjf .in{{width:100%;height:100%;border-radius:50%;overflow:hidden;position:relative;background:radial-gradient(circle at 50% 35%,#6b5436,#2b1d0e 80%);box-shadow:inset 0 0 40px #000a}}
.wjf .wj{{position:absolute;left:-17px;top:20px;width:300px;height:340px;transform:none}}
.wjw>.wj{{left:50px!important;top:96px!important;width:320px!important;height:363px!important;transform:rotate(-3deg)!important;filter:drop-shadow(0 12px 14px #0007)}}
div.wjw .bubble{{left:322px!important;width:452px!important;padding:22px 20px!important;font-family:'Playfair Display',serif!important;font-weight:900!important;font-size:50px!important;line-height:1.04!important;background:#fbf3dc!important;color:#1b1208!important;border:6px solid #1b1208!important;border-radius:34px!important;box-shadow:10px 10px 0 #0006!important}}
.bubble u{{color:#9c1620!important}}.bubble:after{{background:#fbf3dc!important;border-color:#1b1208!important}}
'''

# O1 GILDED MIDNIGHT ------------------------------------------------------------------
page("o1-gilded-midnight", COMMON+f'''.stage{{background:radial-gradient(900px 900px at 50% 0%,#17315c 0%,transparent 70%),radial-gradient(900px 700px at 50% 100%,#0e2347 0%,transparent 70%),#050b18;color:#e8c860}}
.kick{{color:#e3bf55}}.lau path{{}}
h1{{top:165px;font-family:'Playfair Display',serif;font-weight:900;font-size:98px;line-height:1.03;letter-spacing:2px;background:{GOLD};-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 14px #000a)}}
h2{{top:625px;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:600;font-size:48px;color:#d8d2bd}}
.lab{{color:#e8c860}}.gt{{color:#f2e7c4}}.gs{{color:#d8c690}}.grp{{color:#e3bf55}}
.mag{{filter:drop-shadow(0 0 18px #e3bf5599)}}.foot{{text-align:center;color:#b9a56a;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:28px;bottom:78px}}''',
f'''{border()}<div class="kick">{laurel(flip=False)}<span>An Account of Empire</span>{laurel("#d9b44a",True)}</div>
<h1>They called it all bad. The ledger disagrees.</h1><h2>The chart that never made the textbooks</h2>
{b.chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",b.mag("#e3bf55",12,"rgba(255,240,190,.22)"),("BAD","GOOD"))}{wojak()}<div class="foot">Illustrative, not exact figures</div>''')

# O2 PARCHMENT ATLAS -----------------------------------------------------------------------
PARCH = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='700' height='700'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' seed='3'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .08  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
page("o2-parchment-atlas", COMMON+f'''.stage{{background:{PARCH},radial-gradient(1000px 1100px at 50% 45%,#f1dfb2 0%,#e2c88c 62%,#b98f4f 100%);color:#2c1a08}}
.kick{{color:#5b3a12}}.lau{{filter:brightness(.55) sepia(1)}}
h1{{top:165px;font-family:'Playfair Display',serif;font-weight:900;font-size:94px;line-height:1.04;color:#2c1a08;letter-spacing:1px}}
h1 i{{color:#8e1b1b}}
h2{{top:625px;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:700;font-size:50px;color:#5b3a12}}
.grid i{{border-top:2px dashed #5b3a1244}}
.bad .bar{{background:repeating-linear-gradient(45deg,#7d1616 0 8px,#9c2222 8px 14px);border:4px solid #2c1a08;border-bottom:0}}
.good .bar{{background:repeating-linear-gradient(45deg,#1f5a38 0 8px,#2c7648 8px 14px);border:4px solid #2c1a08;border-bottom:0}}
.bars:after{{background:#2c1a08!important;height:6px}}
.lab{{color:#2c1a08}}.gt{{color:#2c1a08}}.gs{{color:#5b3a12}}.grp{{color:#2c1a08}}
.mag{{filter:drop-shadow(5px 7px 4px #3a1f0a66)}}.foot{{text-align:center;color:#5b3a12;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:28px;bottom:78px}}
.rose{{position:absolute;right:62px;top:48px;width:110px;opacity:.55;z-index:2}}
.wjf{{background:linear-gradient(180deg,#8a6a2c,#5a3d12,#8a6a2c)}}''',
f'''{border("#3a2208","#6b4a1a")}<div class="kick"><span>A True &amp; Faithful Reckoning</span></div>
<h1>The truth they <i>struck</i> from the record</h1><h2>The colonial ledger, set down plainly</h2>
{b.chart("Pre-colonial<br>African regimes","European<br>colonialism",b.mag("#2c1a08",12,"rgba(255,248,220,.35)"),("BAD","GOOD"))}{wojak()}<div class="foot">Illustrative, not exact figures</div>''')

# O3 MARBLE & GOLD -------------------------------------------------------------------------
MARB = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.003 .009' numOctaves='5' seed='11'/><feColorMatrix values='0 0 0 0 .2  0 0 0 0 .2  0 0 0 0 .22  0 0 0 -0.55 0.36'/></filter><rect width='100%' height='100%' filter='url(%23m)'/></svg>\")"
page("o3-marble-verdict", COMMON+f'''.stage{{background:{MARB},linear-gradient(160deg,#fbfaf6,#e9e6df 60%,#f6f3ec);color:#16130d}}
.kick{{color:#8c6a1c}}
h1{{top:170px;font-family:Cinzel,serif;font-weight:900;font-size:128px;line-height:1.0;letter-spacing:3px;color:#16130d}}
h1 span{{background:{GOLD};-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 #7a5a14)}}
h2{{top:620px;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:700;font-size:54px;color:#4a4233}}
.grid i{{border-top:2px solid #16130d1a}}
.lab{{color:#16130d}}.gt{{color:#16130d}}.gs{{color:#6b5f48}}.grp{{color:#8c6a1c}}
.bars:after{{background:{GOLD}!important}}
.mag{{filter:drop-shadow(0 8px 6px #0004)}}.foot{{text-align:center;color:#6b5f48;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:28px;bottom:78px}}''',
f'''{border("#b8902c","#d9b44a")}<div class="kick"><span>Anno Domini &nbsp;·&nbsp; A Reckoning</span></div>
<h1>The <span>verdict</span> of history</h1><h2>The chart they never showed you</h2>
{b.chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",b.mag("#8c6a1c",12,"rgba(255,255,255,.5)"),("BAD","GOOD"))}{wojak()}<div class="foot">Illustrative, not exact figures</div>''')

# O4 LIBRARY GREEN & BRASS ---------------------------------------------------------------------
LEATH = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='l'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='4' seed='8'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .38 0'/></filter><rect width='100%' height='100%' filter='url(%23l)'/></svg>\")"
page("o4-library-brass", COMMON+f'''.stage{{background:{LEATH},radial-gradient(1000px 1100px at 50% 40%,#12503a 0%,#0a2d21 70%,#05160f 100%);color:#efe3bd}}
.kick{{color:#d4b25a}}
h1{{top:165px;font-family:'Playfair Display',serif;font-weight:900;font-size:100px;line-height:1.03;color:#f4e9c4;text-shadow:0 3px 0 #000a}}
h1 i{{background:{GOLD};-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none}}
h2{{top:625px;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:600;font-size:50px;color:#cfc29a}}
.lab{{color:#e6cf86}}.gt{{color:#f4e9c4}}.gs{{color:#cbbd8a}}.grp{{color:#d4b25a}}
.mag{{filter:drop-shadow(0 10px 8px #000a)}}.foot{{text-align:center;color:#aa9d6d;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:28px;bottom:78px}}
.wjf{{box-shadow:0 14px 30px #000c}}''',
f'''{border("#d4b25a","#8f742a")}<div class="kick">{laurel("#d4b25a")}<span>The Dissenting Account</span>{laurel("#d4b25a",True)}</div>
<h1>What the <i>history books</i> left out</h1><h2>Bound in green. Weighed on one page.</h2>
{b.chart("Pre-colonial<br>African regimes","European<br>colonialism",b.mag("#d4b25a",12,"rgba(255,245,200,.18)"),("BAD","GOOD"))}{wojak()}<div class="foot">Illustrative, not exact figures</div>''')

# O5 BURGUNDY EPIC -----------------------------------------------------------------------------------
page("o5-burgundy-epic", COMMON+f'''.stage{{background:radial-gradient(700px 700px at 50% 12%,#a3262e 0%,transparent 70%),radial-gradient(1100px 900px at 50% 100%,#2a0509 0%,transparent 70%),linear-gradient(#4a0b14,#1b0408);color:#f1d98a}}
.stage:after{{content:"";position:absolute;inset:0;box-shadow:inset 0 0 260px 40px #000d;pointer-events:none;z-index:4}}
.kick{{color:#f1d98a;font-size:34px}}
h1{{top:160px;font-family:Cinzel,serif;font-weight:900;font-size:122px;line-height:1.0;letter-spacing:4px;background:{GOLD};-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 18px #000)}}
h2{{top:590px;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:700;font-size:52px;color:#ecd9ab}}
.lab{{color:#f1d98a}}.gt{{color:#fbeec3}}.gs{{color:#e8d398}}.grp{{color:#d9b44a}}
.grid i{{border-top:2px solid #ffffff1a}}
.mag{{filter:drop-shadow(0 0 22px #ffd96b99)}}.foot{{text-align:center;color:#c9b27a;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:28px;bottom:78px;z-index:5}}''',
f'''{border("#e3bf55","#9a7a22")}<div class="kick">{laurel("#e3bf55")}<span>M D C C C</span>{laurel("#e3bf55",True)}</div>
<h1>The ledger nobody dares open</h1><h2>One chart. Two sides of the empire.</h2>
{b.chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",b.mag("#f1d98a",12,"rgba(255,240,190,.22)"),("BAD","GOOD"))}{wojak()}<div class="foot">Illustrative, not exact figures</div>''')

