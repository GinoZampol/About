import pathlib, io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import build2 as b
OUT = pathlib.Path(__file__).parent
FONTS = (OUT/'fonts'/'fonts4.css').read_text()
b.S = 10.5

BASE4 = '''*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1920px;overflow:hidden;background:#000;font-family:'Share Tech Mono',monospace}
.stage{position:relative;width:1080px;height:1920px;overflow:hidden;background:#000;color:#fff}
.lb{position:absolute;left:0;right:0;height:96px;background:#000;z-index:20}.lb.t{top:0}.lb.b{bottom:0}
.scan{position:absolute;inset:0;z-index:18;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px)}
.vig{position:absolute;inset:0;z-index:17;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.6) 100%)}
.chart{position:absolute;left:0;right:0;top:600px;z-index:5}
.grid{position:absolute;left:60px;right:60px;top:0;height:730px}.grid i{position:absolute;left:0;right:0;border-top:1px dashed rgba(255,255,255,.16)}
.grid i:nth-child(1){top:0}.grid i:nth-child(2){top:243px}.grid i:nth-child(3){top:486px}.grid i:nth-child(4){top:730px}
.bars{height:730px;display:flex;align-items:flex-end;justify-content:center;gap:22px;position:relative}
.bw{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:200px}.bw.gap{margin-left:70px}
.bar{width:100%;position:relative;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 72%,transparent),color-mix(in srgb,var(--c) 16%,transparent));border:2px solid var(--c);border-bottom:0;box-shadow:0 0 38px color-mix(in srgb,var(--c) 55%,transparent),inset 0 0 44px color-mix(in srgb,var(--c) 22%,transparent)}
.bar:before{content:"";position:absolute;inset:0;background:radial-gradient(rgba(255,255,255,.4) 1.2px,transparent 1.7px) 0 0/10px 10px;opacity:.45}
.bar:after{content:"";position:absolute;left:-2px;right:-2px;top:-2px;height:5px;background:#fff;box-shadow:0 0 18px #fff,0 0 40px var(--c)}
.bad{--c:var(--bad)}.good{--c:var(--good)}
.lab{position:absolute;bottom:-52px;font-size:28px;letter-spacing:8px;color:#e6ecf5;text-shadow:0 0 12px rgba(255,255,255,.4)}
.mag{position:absolute;width:290px;height:290px;left:50%;top:50%;margin-left:-125px;transform:translateY(-175px) rotate(-8deg);filter:drop-shadow(0 0 14px rgba(255,255,255,.7))}
.groups{display:flex;justify-content:center;margin-top:92px}
.grp{width:422px;text-align:center;border-top:1px solid rgba(255,255,255,.75);padding-top:16px;position:relative}.grp+.grp{margin-left:70px}
.grp:before,.grp:after{content:"";position:absolute;top:-5px;width:1px;height:9px;background:#fff}.grp:before{left:0}.grp:after{right:0}
.gt{font-family:Syncopate,sans-serif;font-weight:700;font-size:22px;letter-spacing:5px;line-height:1.45;text-transform:uppercase;text-shadow:0 0 14px rgba(255,255,255,.5)}
.gs{font-size:22px;letter-spacing:9px;margin-top:8px;opacity:.7;text-transform:uppercase}
.tag{position:absolute;left:0;right:0;text-align:center;font-size:24px;letter-spacing:10px;color:#cfd7e4;text-transform:uppercase;z-index:6}
.t{position:absolute;left:40px;right:40px;text-align:center;font-family:Michroma,sans-serif;text-transform:uppercase;line-height:1.2;z-index:6;color:#fff;text-shadow:0 0 22px rgba(255,255,255,.55),3px 0 rgba(255,70,70,.5),-3px 0 rgba(70,200,255,.5)}
.sub{position:absolute;left:60px;right:60px;text-align:center;font-family:Syncopate,sans-serif;font-weight:400;font-size:23px;letter-spacing:7px;color:#cfd7e4;text-transform:uppercase;z-index:6}
.foot{position:absolute;bottom:128px;left:0;right:0;text-align:center;font-size:21px;letter-spacing:6px;color:#9aa6b8;z-index:6;text-transform:uppercase}
.planet{position:absolute;z-index:1}.shade{position:absolute;left:0;right:0;top:1290px;height:560px;z-index:3;background:linear-gradient(transparent,rgba(0,0,0,.78) 34%)}.shade2{position:absolute;left:0;right:0;top:560px;height:760px;z-index:3;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.32),transparent 70%)}
.wjw{position:absolute;left:0;top:620px;width:800px;height:440px;z-index:9}
.wjw>.wj,.wjw>img.wj{position:absolute;left:50px;top:90px;width:300px;height:340px;transform:none;filter:drop-shadow(0 0 18px rgba(255,255,255,.28))}
.bubble{position:absolute;left:322px;top:0;width:452px;padding:24px 22px;background:#fff;color:#000;border-radius:30px;font-family:Inter,sans-serif;font-weight:900;font-size:46px;line-height:1.05;text-align:center;text-transform:uppercase;box-shadow:0 0 44px rgba(255,255,255,.35)}
.bubble u{text-decoration:none;color:#e5192b}
.bubble:after{content:"";position:absolute;left:26px;bottom:-24px;width:44px;height:44px;background:#fff;transform:rotate(45deg) skew(8deg,8deg);border-radius:0 0 8px 0}
'''

def page(name, css, body):
    html=f'<!doctype html><html><head><meta charset="utf-8"><style>{FONTS}{BASE4}{css}</style></head><body><div class="stage">{body}<div class="vig"></div><div class="scan"></div><div class="lb t"></div><div class="lb b"></div></div></body></html>'
    (OUT/f"{name}.html").write_text(html)

def wojak(img=False):
    wj = '<img class="wj" src="wojak_pix.png">' if img else b.WOJAK
    return f'<div class="wjw">{wj}<div class="bubble">European colonialism did <u>so many</u> bad things!!</div></div>'

def mag(c="#fff"): return b.mag(c, 10, "rgba(255,255,255,.14)")

def chart(pre, eu, c="#fff"): return b.chart(pre, eu, mag(c), ("BAD","GOOD"))

def moon(d, x, y, op=1, seed=5):
    return f'''<svg class="planet" style="left:{x-d/2}px;top:{y-d/2}px;opacity:{op}" width="{d}" height="{d}" viewBox="0 0 1000 1000"><defs>
<filter id="mn{seed}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".013 .016" numOctaves="6" seed="{seed}" result="t"/><feDiffuseLighting in="t" surfaceScale="16" diffuseConstant="1.15" lighting-color="#e4e4e4"><feDistantLight azimuth="215" elevation="46"/></feDiffuseLighting></filter>
<filter id="mr{seed}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0035 .005" numOctaves="4" seed="{seed+3}"/><feColorMatrix values="0 0 0 0 .05  0 0 0 0 .05  0 0 0 0 .06  16 0 0 0 -8.2"/></filter>
<clipPath id="mc{seed}"><circle cx="500" cy="500" r="480"/></clipPath>
<radialGradient id="ms{seed}" cx="66%" cy="38%" r="78%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity=".96"/></radialGradient></defs>
<g clip-path="url(#mc{seed})"><rect width="1000" height="1000" filter="url(#mn{seed})" opacity=".78"/><rect width="1000" height="1000" filter="url(#mr{seed})" opacity=".3"/><rect width="1000" height="1000" fill="url(#ms{seed})"/></g></svg>'''

def globe(d, x, y, ocean=("#1b3a8c","#07123a"), land="#d3dcec", dots="#6a7dff", grid="#9ab8ff", glow="#3f9bff", seed=7, op=1, thr=(24,-13.4)):
    a,bv=thr
    return f'''<svg class="planet" style="left:{x-d/2}px;top:{y-d/2}px;opacity:{op}" width="{d}" height="{d}" viewBox="0 0 1000 1000"><defs>
<radialGradient id="oc{seed}" cx="42%" cy="34%" r="80%"><stop offset="0" stop-color="{ocean[0]}"/><stop offset="1" stop-color="{ocean[1]}"/></radialGradient>
<radialGradient id="at{seed}" cx="50%" cy="50%" r="50%"><stop offset=".82" stop-color="{glow}" stop-opacity="0"/><stop offset=".92" stop-color="{glow}" stop-opacity=".5"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="lm{seed}" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
<clipPath id="cp{seed}"><circle cx="500" cy="500" r="430"/></clipPath>
<pattern id="dt{seed}" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="2.4" fill="{land}"/></pattern>
<pattern id="do{seed}" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="1.15" fill="{dots}"/></pattern>
<filter id="ld{seed}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0042 .0058" numOctaves="5" seed="{seed}" result="n"/><feColorMatrix in="n" result="m" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  {a} 0 0 0 {bv}"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
<filter id="bl{seed}"><feGaussianBlur stdDeviation="9"/></filter></defs>
<circle cx="500" cy="500" r="500" fill="url(#at{seed})"/>
<circle cx="500" cy="500" r="430" fill="url(#oc{seed})"/>
<g clip-path="url(#cp{seed})"><rect width="1000" height="1000" fill="url(#do{seed})"/>
<rect width="1000" height="1000" fill="{land}" opacity=".16" filter="url(#ld{seed})"/><rect width="1000" height="1000" fill="url(#dt{seed})" filter="url(#ld{seed})"/>
<g fill="none" stroke="{grid}" stroke-width="1.2" opacity=".3"><ellipse cx="500" cy="500" rx="110" ry="430"/><ellipse cx="500" cy="500" rx="230" ry="430"/><ellipse cx="500" cy="500" rx="340" ry="430"/><ellipse cx="500" cy="500" rx="430" ry="90"/><ellipse cx="500" cy="500" rx="430" ry="200"/><ellipse cx="500" cy="500" rx="430" ry="320"/></g>
<circle cx="500" cy="500" r="430" fill="url(#lm{seed})"/></g>
<circle cx="500" cy="500" r="430" fill="none" stroke="{glow}" stroke-width="7" filter="url(#bl{seed})" opacity=".95"/><circle cx="500" cy="500" r="430" fill="none" stroke="#fff" stroke-width="1.5" opacity=".55"/></svg>'''

PAL = lambda bad,good: f':root{{--bad:{bad};--good:{good}}}'

# S1 MOON --------------------------------------------------------------------------------
page("s1-moon-ledger", PAL("#ff4a3a","#eaf4ff")+'''.t{top:170px;font-size:66px}.ring{position:absolute;z-index:2;left:-380px;top:860px;width:1560px;height:560px;border:1.5px solid rgba(255,255,255,.4);border-radius:50%;transform:rotate(-13deg);box-shadow:0 0 14px rgba(255,255,255,.2)}''',
f'''{moon(1300,590,1010,.8)}<div class="shade"></div><div class="ring"></div>
<div class="tag" style="top:122px">Outcomes // Before &amp; After_</div>
<div class="t">The ratio they<br>won’t show you</div><div class="sub" style="top:440px">Colonialism · harm vs. good</div>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism")}{wojak()}<div class="foot">Illustrative · not exact figures</div>''')

# S2 EARTH GRID --------------------------------------------------------------------------------
page("s2-earth-grid", PAL("#ff5646","#5dffc0")+'''.t{top:175px;font-size:88px}''',
f'''{globe(2300,540,1639,seed=7,op=.95)}<div class="shade"></div>
<div class="tag" style="top:122px">Analysis // 1884–1960_</div>
<div class="t">Colonialism:<br>all bad?</div><div class="sub" style="top:470px">Run the numbers</div>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism")}{wojak()}<div class="foot">Illustrative · not exact figures</div>''')

# S3 MARS GHOST -----------------------------------------------------------------------------------
ghost=''.join(f'<div class="gh" style="top:{y}px;opacity:{o}">All bad?</div>' for y,o in [(118,.35),(205,.55),(380,.55),(467,.3)])
page("s3-mars-ghost", PAL("#ff3d2a","#ffe0b0")+'''.gh{position:absolute;left:0;right:0;text-align:center;font-family:Michroma,sans-serif;font-size:90px;text-transform:uppercase;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,.55);z-index:3}
.solid{position:absolute;left:0;right:0;top:292px;text-align:center;font-family:Michroma,sans-serif;font-size:90px;text-transform:uppercase;color:#fff;z-index:6;text-shadow:0 0 26px rgba(255,255,255,.6),3px 0 rgba(255,80,40,.5),-3px 0 rgba(255,200,120,.4)}
.sw{position:absolute;right:120px;top:570px;font-size:22px;letter-spacing:9px;color:#d8c8b8;z-index:6}''',
f'''{globe(2000,540,1500,ocean=("#5e3420","#220f08"),land="#ffb27a",dots="#d27a42",grid="#ffc898",glow="#ff8c3a",seed=9,op=.95,thr=(24,-13.0))}
<div class="shade"></div>{ghost}<div class="solid">All bad?</div><div class="sw">They left this out_</div>
<div class="tag" style="top:122px">Ledger // Archive_</div>
{chart("Pre-colonial<br>African regimes","European<br>colonialism")}{wojak()}<div class="foot">Illustrative · not exact figures</div>''')

# S4 GLITCH PIXEL ------------------------------------------------------------------------------------
page("s4-glitch-moon", PAL("#ff2e55","#3dffd0")+'''.t{top:170px}
.gl{position:absolute;left:40px;right:40px;top:170px;text-align:center;font-family:Michroma,sans-serif;font-size:50px;line-height:1.2;text-transform:uppercase;z-index:7;mix-blend-mode:screen}
.g1{color:#00f0ff;clip-path:inset(8% 0 70% 0);transform:translateX(7px)}.g2{color:#ff2e8b;clip-path:inset(52% 0 20% 0);transform:translateX(-8px)}
.px{position:absolute;z-index:10}''',
f'''{moon(900,830,780,.85,seed=12)}
<div class="tag" style="top:122px">File 001 // Corrupted_</div>
<div class="t" style="font-size:50px">They called it<br>all bad.<br>The data disagrees.</div><div class="gl g1">They called it<br>all bad.<br>The data disagrees.</div><div class="gl g2">They called it<br>all bad.<br>The data disagrees.</div>
<div class="px" style="left:380px;top:1000px;width:36px;height:36px;background:#3dffd0"></div><div class="px" style="left:416px;top:1036px;width:24px;height:24px;background:#ff2e8b"></div><div class="px" style="left:44px;top:760px;width:48px;height:24px;background:#00f0ff;opacity:.8"></div>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism")}{wojak(True)}<div class="foot">Illustrative · not exact figures</div>''')

# S5 HUD RADAR ------------------------------------------------------------------------------------------
rings=''.join(f'<circle cx="540" cy="1120" r="{r}" fill="none" stroke="#1d5f9a" stroke-opacity="{o}" stroke-width="1.5"/>' for r,o in [(200,.5),(340,.4),(480,.32),(620,.25),(760,.18)])
br=lambda x,y,sx,sy: f'<path d="M{x} {y+60*sy} L{x} {y} L{x+60*sx} {y}" fill="none" stroke="#6fd8ff" stroke-width="3" />'
page("s5-hud-radar", PAL("#ff4a4a","#38e8ff")+'''.stage{background:radial-gradient(900px 900px at 50% 60%,#06223d 0%,#02070e 70%)}
.gridbg{position:absolute;inset:96px 0;background-image:linear-gradient(rgba(80,170,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(80,170,255,.09) 1px,transparent 1px);background-size:60px 60px;z-index:0}
.t{top:165px;font-size:78px}.rule{position:absolute;left:150px;right:150px;top:505px;height:1px;background:#6fd8ff;box-shadow:0 0 12px #6fd8ff;z-index:6}
.tel{position:absolute;font-size:19px;letter-spacing:4px;color:#6fd8ff;opacity:.8;z-index:6;line-height:1.7}
.bar{background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--c) 40%,transparent) 0 3px,transparent 3px 11px)!important;box-shadow:0 0 30px color-mix(in srgb,var(--c) 45%,transparent)!important}.bar:before{display:none}''',
f'''<div class="gridbg"></div><svg style="position:absolute;inset:0;z-index:1" width="1080" height="1920">{rings}<line x1="540" y1="500" x2="540" y2="1780" stroke="#1d5f9a" stroke-opacity=".3"/><line x1="0" y1="1120" x2="1080" y2="1120" stroke="#1d5f9a" stroke-opacity=".3"/>{br(46,112,1,1)}{br(1034,112,-1,1)}{br(46,1808,1,-1)}{br(1034,1808,-1,-1)}</svg>
<div class="tag" style="top:122px;color:#6fd8ff">Scan 0001 // Live_</div>
<div class="t">The chart<br>that broke<br>the narrative</div><div class="rule"></div>
<div class="tel" style="left:62px;top:530px">SRC // ARCHIVE<br>REF // LEDGER</div><div class="tel" style="right:62px;top:530px;text-align:right">MODE // COMPARE<br>STATUS // OPEN_</div>
{chart("Pre-colonial<br>African regimes","European<br>colonialism","#6fd8ff")}{wojak()}<div class="foot" style="color:#6fd8ff">Illustrative · not exact figures</div>''')
